import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import {
  fetchJson,
  ISocialSourceProvider,
  normalizeBody,
  RawSocialPost,
  SocialSearchParams,
  SocialSearchResult,
} from './social-source.interface';

const DAY_MS = 24 * 60 * 60 * 1000;
/** CanadaBuys ships one large CSV; re-downloading it per query would be absurd. */
const CSV_CACHE_MS = 60 * 60 * 1000;
const MAX_CSV_BYTES = 40 * 1024 * 1024;
/**
 * canada.ca answers with headers in ~2s but frequently stalls part-way through
 * the 6.5 MB body. A healthy download finishes well inside this; a stalled one
 * gives up before it can spoil the rest of the run.
 */
const CSV_DOWNLOAD_TIMEOUT_MS = 45_000;

/** EU/EEA countries whose notices are published through TED. */
const TED_ALPHA3: Record<string, string> = {
  AT: 'AUT', BE: 'BEL', BG: 'BGR', HR: 'HRV', CY: 'CYP', CZ: 'CZE', DK: 'DNK', EE: 'EST',
  FI: 'FIN', FR: 'FRA', DE: 'DEU', GR: 'GRC', HU: 'HUN', IE: 'IRL', IT: 'ITA', LV: 'LVA',
  LT: 'LTU', LU: 'LUX', MT: 'MLT', NL: 'NLD', PL: 'POL', PT: 'PRT', RO: 'ROU', SK: 'SVK',
  SI: 'SVN', ES: 'ESP', SE: 'SWE', NO: 'NOR', IS: 'ISL', LI: 'LIE',
};
const TED_COUNTRIES = new Set(Object.keys(TED_ALPHA3));
/** Reverse map, so a notice's alpha-3 becomes the alpha-2 the rest of the app uses. */
const TED_ALPHA2 = Object.fromEntries(Object.entries(TED_ALPHA3).map(([a2, a3]) => [a3, a2]));

/**
 * UNSPSC/CPV families that mean "software, IT or web work". Anything outside
 * these is construction, catering or stationery - noise for an agency.
 */
const IT_CPV_PREFIXES = ['72', '48'];
const IT_KEYWORDS = [
  'software', 'website', 'web site', 'web development', 'application', 'digital',
  'portal', 'crm', 'erp', 'mobile app', 'it services', 'information technology',
  'system development', 'platform', 'cloud', 'chatbot', 'automation',
];

/**
 * Public procurement notices: the EU's TED, the UK's Find a Tender and Canada's
 * CanadaBuys open data.
 *
 * Every one of these is an official government feed that needs no key and no
 * account, and the intent is as explicit as prospecting gets - an organisation
 * publishing a budgeted requirement with a deadline attached.
 *
 * Which portals run is decided by the campaign's selected countries, so the
 * country picker built for the social sources works here unchanged.
 */
@Injectable()
export class TendersProvider implements ISocialSourceProvider {
  readonly id = 'tenders';
  readonly label = 'Public tenders (EU / UK / Canada)';
  readonly requiredEnv: string[] = [];
  readonly setupHint =
    'No setup needed - TED, UK Find a Tender and CanadaBuys are open government feeds. ' +
    'Select GB, CA or any EU country on the campaign to choose which portals run.';

  private readonly logger = new Logger(TendersProvider.name);

  /** Parsed CanadaBuys rows, kept briefly so several queries share one download. */
  private canadaCache: { rows: Record<string, string>[]; expiresAt: number } | null = null;

  constructor(private readonly configService: ConfigService) {}

  private cfg(key: string, fallback: string): string {
    return this.configService.get<string>(`socialProspecting.tenders.${key}`) || fallback;
  }

  private get timeoutMs(): number {
    return this.configService.get<number>('socialProspecting.httpTimeoutMs') || 30000;
  }

  /** Open feeds - always available. */
  isConfigured(): boolean {
    return true;
  }

  async search(params: SocialSearchParams): Promise<SocialSearchResult> {
    const posts: RawSocialPost[] = [];
    const warnings: string[] = [];
    const seen = new Set<string>();
    let apiCalls = 0;

    const regions = (params.regionCodes || []).map((c) => c.toUpperCase());
    // With no country chosen, sweep everything rather than silently doing nothing.
    const runTed = !regions.length || regions.some((c) => TED_COUNTRIES.has(c));
    const runUk = !regions.length || regions.includes('GB');
    const runCanada = !regions.length || regions.includes('CA');

    if (!runTed && !runUk && !runCanada) {
      return {
        posts,
        apiCalls,
        warnings: [
          'Public tenders covers the EU, the UK and Canada. None of the selected countries ' +
            'are served by these portals, so this source was skipped.',
        ],
      };
    }

    const perPortal = Math.max(5, Math.ceil(params.limit / [runTed, runUk, runCanada].filter(Boolean).length));

    if (runTed) {
      try {
        const out = await this.fromTed(params, perPortal, regions);
        apiCalls += out.apiCalls;
        warnings.push(...out.warnings);
        for (const p of out.posts) if (!seen.has(p.externalId)) { seen.add(p.externalId); posts.push(p); }
      } catch (err: any) {
        warnings.push(`TED (EU tenders) failed: ${err?.message}`);
      }
    }

    if (runUk && posts.length < params.limit) {
      try {
        const out = await this.fromUk(params, perPortal);
        apiCalls += out.apiCalls;
        warnings.push(...out.warnings);
        for (const p of out.posts) if (!seen.has(p.externalId)) { seen.add(p.externalId); posts.push(p); }
      } catch (err: any) {
        warnings.push(`UK Find a Tender failed: ${err?.message}`);
      }
    }

    if (runCanada && posts.length < params.limit) {
      try {
        const out = await this.fromCanada(params, perPortal);
        apiCalls += out.apiCalls;
        warnings.push(...out.warnings);
        for (const p of out.posts) if (!seen.has(p.externalId)) { seen.add(p.externalId); posts.push(p); }
      } catch (err: any) {
        warnings.push(`CanadaBuys failed: ${err?.message}`);
      }
    }

    return { posts: posts.slice(0, params.limit), apiCalls, warnings };
  }

  // ── TED (European Union) ────────────────────────────────────────────────

  private async fromTed(
    params: SocialSearchParams,
    limit: number,
    regions: string[],
  ): Promise<SocialSearchResult> {
    // TED's expert search accepts YYYYMMDD or today(-n) - an ISO date is rejected.
    const since = `today(-${Math.max(1, Math.round(params.maxAgeDays))})`;
    // CPV 72 = IT services, 48 = software packages. Far more precise than
    // keyword matching against titles in 24 languages.
    const cpv = IT_CPV_PREFIXES.map((p) => `classification-cpv=${p}*`).join(' OR ');
    const wanted = regions.map((c) => TED_ALPHA3[c]).filter(Boolean);
    const countryClause = wanted.length
      ? ` AND buyer-country IN (${wanted.map((c) => `"${c}"`).join(' ')})`
      : '';

    const json = await fetchJson(
      this.cfg('tedUrl', 'https://api.ted.europa.eu/v3/notices/search'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `(${cpv}) AND publication-date>=${since}${countryClause}`,
          fields: ['publication-number', 'notice-title', 'publication-date', 'buyer-name', 'buyer-country', 'links'],
          limit: Math.min(limit, 100),
        }),
      },
      this.timeoutMs,
      'TED',
    );

    const posts: RawSocialPost[] = [];
    for (const notice of json?.notices || []) {
      const id = notice?.['publication-number'];
      if (!id) continue;
      const title = firstText(notice?.['notice-title']);
      const buyer = firstText(notice?.['buyer-name']);
      const url =
        firstText(notice?.links?.pdf?.ENG) ||
        firstText(notice?.links?.xml?.MUL) ||
        `https://ted.europa.eu/en/notice/${id}`;

      posts.push({
        externalId: `ted_${id}`,
        sourceUrl: url,
        title: title || `TED notice ${id}`,
        body: normalizeBody(
          [title, buyer ? `Contracting authority: ${buyer}` : ''].filter(Boolean).join('. '),
        ),
        authorHandle: buyer || undefined,
        communityName: 'TED - EU public procurement',
        postedAt: parseDate(notice?.['publication-date']),
        dateConfidence: 'exact',
        countryHint: TED_ALPHA2[firstText(notice?.['buyer-country']).toUpperCase()] || undefined,
        engagement: {},
        raw: { source: 'ted', publicationNumber: id },
      });
    }
    return { posts, apiCalls: 1, warnings: [] };
  }

  // ── UK Find a Tender ────────────────────────────────────────────────────

  private async fromUk(params: SocialSearchParams, limit: number): Promise<SocialSearchResult> {
    const since = new Date(Date.now() - params.maxAgeDays * DAY_MS).toISOString();
    const url =
      `${this.cfg('ukUrl', 'https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages')}?` +
      new URLSearchParams({ updatedFrom: since, limit: String(Math.min(limit, 100)) }).toString();

    const json = await fetchJson(url, { method: 'GET' }, this.timeoutMs, 'UK Find a Tender');

    const posts: RawSocialPost[] = [];
    for (const release of json?.releases || []) {
      const tender = release?.tender || {};
      const title: string = tender.title || '';
      const description: string = tender.description || '';
      // The UK feed carries every sector, so the IT filter happens here.
      if (!looksLikeItWork(`${title} ${description}`, tender?.classification?.id)) continue;

      const id = release?.ocid || release?.id;
      if (!id) continue;
      const buyer = release?.buyer?.name || '';

      posts.push({
        externalId: `uk_${id}`,
        sourceUrl:
          tender?.documents?.[0]?.url ||
          `https://www.find-tender.service.gov.uk/Search/Results?keywords=${encodeURIComponent(title)}`,
        title,
        body: normalizeBody([description || title, buyer ? `Buyer: ${buyer}` : ''].filter(Boolean).join('. ')),
        authorHandle: buyer || undefined,
        communityName: 'UK Find a Tender',
        postedAt: parseDate(release?.date),
        dateConfidence: 'exact',
        countryHint: 'GB',
        engagement: {},
        raw: { source: 'uk_fts', ocid: id },
      });
      if (posts.length >= limit) break;
    }
    return { posts, apiCalls: 1, warnings: [] };
  }

  // ── CanadaBuys ──────────────────────────────────────────────────────────

  private async fromCanada(params: SocialSearchParams, limit: number): Promise<SocialSearchResult> {
    const rows = await this.canadaRows();
    const cutoff = Date.now() - params.maxAgeDays * DAY_MS;
    const posts: RawSocialPost[] = [];

    for (const row of rows) {
      const title = row['title-titre-eng'] || '';
      const category = row['unspscDescription-eng'] || row['gsinDescription-nibsDescription-eng'] || '';
      if (!looksLikeItWork(`${title} ${category}`)) continue;

      const published = parseDate(row['publicationDate-datePublication']);
      if (published && published.getTime() < cutoff) continue;

      const ref = row['referenceNumber-numeroReference'] || row['solicitationNumber-numeroSollicitation'];
      if (!ref) continue;

      const buyer = row['contractingEntityName-nomEntitContractante-eng'] || '';
      const closes = row['tenderClosingDate-appelOffresDateCloture'];

      posts.push({
        externalId: `ca_${ref}`,
        sourceUrl: `https://canadabuys.canada.ca/en/tender-opportunities?search=${encodeURIComponent(ref)}`,
        title,
        body: normalizeBody(
          [
            title,
            category ? `Category: ${category}` : '',
            buyer ? `Buyer: ${buyer}` : '',
            closes ? `Closes: ${closes}` : '',
          ]
            .filter(Boolean)
            .join('. '),
        ),
        authorHandle: buyer || undefined,
        communityName: 'CanadaBuys',
        postedAt: published,
        dateConfidence: 'exact',
        countryHint: 'CA',
        engagement: {},
        raw: { source: 'canadabuys', reference: ref },
      });
      if (posts.length >= limit) break;
    }

    return { posts, apiCalls: 1, warnings: [] };
  }

  /** CanadaBuys publishes a single CSV of every open notice; cache it briefly. */
  private async canadaRows(): Promise<Record<string, string>[]> {
    if (this.canadaCache && this.canadaCache.expiresAt > Date.now()) return this.canadaCache.rows;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CSV_DOWNLOAD_TIMEOUT_MS);
    try {
      const res = await fetch(
        this.cfg(
          'canadaUrl',
          'https://canadabuys.canada.ca/opendata/pub/openTenderNotice-ouvertAvisAppelOffres.csv',
        ),
        {
          signal: controller.signal,
          // canada.ca answers Node's default user agent with a 403.
          headers: { 'User-Agent': 'LeadGenAI/1.0 (+lead-prospecting)', Accept: 'text/csv,*/*' },
        },
      );
      if (!res.ok) throw new Error(`CanadaBuys returned ${res.status}`);

      const text = await res.text();
      if (text.length > MAX_CSV_BYTES) throw new Error('CanadaBuys feed was unexpectedly large');

      const rows = parseCsv(text);
      this.canadaCache = { rows, expiresAt: Date.now() + CSV_CACHE_MS };
      this.logger.log(`CanadaBuys feed cached: ${rows.length} notices`);
      return rows;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error(
          'CanadaBuys stalled while sending its notices feed. The EU and UK ' +
            'portals are unaffected; try again later or drop CA from the campaign.',
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** TED returns most text fields as arrays or per-language maps. */
function firstText(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return firstText(value[0]);
  if (typeof value === 'object') {
    const preferred = value.eng ?? value.ENG ?? value.en;
    if (preferred) return firstText(preferred);
    return firstText(Object.values(value)[0]);
  }
  return '';
}

function parseDate(value: any): Date | undefined {
  if (!value) return undefined;
  let text = String(value).trim();
  // TED emits "2026-08-18+02:00" - a date carrying a UTC offset but no time,
  // which Date.parse rejects outright. The date alone is all we need.
  const dateWithOffset = text.match(/^(\d{4}-\d{2}-\d{2})[+-]\d{2}:\d{2}$/);
  if (dateWithOffset) text = dateWithOffset[1];
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? undefined : new Date(parsed);
}

/** Tender feeds carry every sector; only software and IT work is relevant. */
function looksLikeItWork(text: string, cpv?: string): boolean {
  if (cpv && IT_CPV_PREFIXES.some((p) => String(cpv).startsWith(p))) return true;
  const haystack = text.toLowerCase();
  return IT_KEYWORDS.some((k) => haystack.includes(k));
}

/**
 * Minimal RFC-4180 reader - enough for these feeds, and avoids pulling a CSV
 * dependency in for one provider. Handles quoted fields, escaped quotes and
 * newlines inside quotes.
 */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  if (!rows.length) return [];
  // Strip the UTF-8 BOM the feed starts with, or the first column never matches.
  const headers = rows[0].map((h) => h.replace(/^﻿/, '').trim());
  return rows.slice(1).map((values) => {
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = (values[i] || '').trim();
    });
    return record;
  });
}
