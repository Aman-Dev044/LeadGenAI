import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { AIProviderFactory } from '../../providers/ai/ai-provider.factory';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';

const UA = 'Mozilla/5.0 (compatible; LeadBellsBot/1.0; +https://leadbells.com)';
const MAX_PAGES = 40;
const MAX_DEPTH = 3;
const PAGE_TIMEOUT_MS = 20_000;
const MAX_PAGE_BYTES = 3 * 1024 * 1024;
/** Enough for the model to see the whole business without paying for the whole site. */
const MAX_PROFILE_CHARS = 60_000;

const SKIP_EXT = /\.(jpg|jpeg|png|gif|svg|webp|ico|css|js|mp4|mp3|zip|rar|woff2?|ttf|eot)(\?|$)/i;
const SKIP_PATH = /\/(wp-admin|wp-login|cart|checkout|my-account|login|signin|signup|register|privacy|terms|cookie)/i;

export interface SitePage {
  url: string;
  title: string;
  text: string;
}

export interface BusinessProfile {
  businessName: string;
  oneLiner: string;
  whatWeSell: string;
  services: string[];
  pricing: string;
  locations: string[];
  hours: string;
  usps: string[];
  /** Lines the agent can actually say to win the business, drawn from the site's own claims. */
  salesPitch: string[];
  /** What this business is better at than the alternatives, in its own words. */
  whyUs: string;
  faqs: { q: string; a: string }[];
  contact: { phone?: string; email?: string; whatsapp?: string; address?: string };
  doNotSay: string[];
  languages: string[];
}

/**
 * A workspace's own website, turned into something the AI can sell from.
 *
 * The admin types their URL, we check it is really there, read every page we
 * can reach on that domain, and boil the lot down to a business profile. The
 * profile goes into the calling prompt (a voice agent cannot stop to search
 * mid-sentence) and the page text goes into the knowledge base, which the chat
 * and WhatsApp agents search as they answer.
 */
@Injectable()
export class WebsiteService {
  private readonly logger = new Logger(WebsiteService.name);
  /** Workspaces with a crawl in flight, so a double click cannot start two. */
  private readonly running = new Set<string>();

  constructor(
    @InjectModel('Tenant') private readonly tenantModel: Model<any>,
    private readonly aiFactory: AIProviderFactory,
    private readonly knowledge: KnowledgeBaseService,
  ) {}

  // ─── Verify ───────────────────────────────────────────────────────

  private normaliseUrl(raw: string): URL {
    const trimmed = String(raw || '').trim();
    if (!trimmed) throw new BadRequestException('Enter your website address');
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    let url: URL;
    try {
      url = new URL(withScheme);
    } catch {
      throw new BadRequestException(`"${raw}" is not a valid web address`);
    }
    if (!/^https?:$/.test(url.protocol)) throw new BadRequestException('Only http and https addresses work');
    if (!url.hostname.includes('.')) throw new BadRequestException(`"${url.hostname}" does not look like a real domain`);
    if (/^(localhost|127\.|10\.|192\.168\.|0\.)/i.test(url.hostname)) {
      throw new BadRequestException('That address is only reachable from your own computer');
    }
    url.hash = '';
    return url;
  }

  /**
   * Is the site really there, and whose is it? Returns what we found so the
   * admin can confirm it is their own site before we read all of it.
   */
  async verify(tenantId: string, rawUrl: string) {
    const url = this.normaliseUrl(rawUrl);
    let res: any;
    try {
      res = await axios.get(url.toString(), {
        timeout: PAGE_TIMEOUT_MS,
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
        maxContentLength: MAX_PAGE_BYTES,
        maxRedirects: 5,
        validateStatus: () => true,
      });
    } catch (err: any) {
      throw new BadRequestException(
        err?.code === 'ENOTFOUND'
          ? `We could not find ${url.hostname}. Check the spelling.`
          : `We could not reach ${url.hostname}: ${err?.message || 'no response'}`,
      );
    }
    if (res.status >= 400) {
      throw new BadRequestException(`${url.hostname} answered with ${res.status}. Is the site live?`);
    }
    const contentType = String(res.headers?.['content-type'] || '');
    if (!contentType.includes('html')) {
      throw new BadRequestException(`${url.hostname} did not return a web page (${contentType || 'unknown type'})`);
    }

    const $ = cheerio.load(res.data);
    const title = ($('title').first().text() || '').trim().slice(0, 200);
    const description = ($('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '').trim().slice(0, 400);
    const siteName = ($('meta[property="og:site_name"]').attr('content') || '').trim().slice(0, 120);
    const logo = $('meta[property="og:image"]').attr('content') || '';
    const linkCount = $('a[href]').length;

    await this.tenantModel.updateOne(
      { _id: tenantId },
      {
        $set: {
          'website.url': url.toString(),
          'website.domain': url.hostname,
          'website.title': title,
          'website.description': description,
          'website.verifiedAt': new Date(),
          'website.status': 'verified',
          'website.error': '',
        },
      },
    );

    return {
      ok: true,
      url: url.toString(),
      domain: url.hostname,
      title,
      description,
      siteName,
      logo,
      linkCount,
      message: `Found ${title || url.hostname}. Read the whole site to teach your AI agents what you sell.`,
    };
  }

  // ─── Crawl ────────────────────────────────────────────────────────

  private extractPage(html: string, pageUrl: URL): { title: string; text: string; links: string[] } {
    const $ = cheerio.load(html);
    $('script, style, noscript, iframe, svg, form').remove();
    const title = ($('title').first().text() || $('h1').first().text() || '').trim().slice(0, 200);

    // Headings carry the structure a sales agent needs, so keep them marked
    const parts: string[] = [];
    $('h1, h2, h3, h4, li, p, td, dd, dt, blockquote, figcaption').each((_, el) => {
      const tag = (el as any).tagName || '';
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (!t || t.length < 2) return;
      parts.push(/^h[1-4]$/i.test(tag) ? `\n## ${t}` : t);
    });
    let text = parts.join('\n');
    if (text.replace(/\s/g, '').length < 120) {
      text = $('main').text() || $('article').text() || $('body').text();
    }
    text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 20_000);

    const links: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href || href.startsWith('#') || /^(mailto|tel|javascript|data):/i.test(href)) return;
      try {
        const next = new URL(href, pageUrl);
        next.hash = '';
        if (next.hostname.replace(/^www\./, '') !== pageUrl.hostname.replace(/^www\./, '')) return;
        if (SKIP_EXT.test(next.pathname) || SKIP_PATH.test(next.pathname)) return;
        links.push(next.toString());
      } catch {
        /* a broken href is not worth failing a crawl for */
      }
    });
    return { title, text, links };
  }

  /** Breadth-first over one domain, newest pages first, bounded in every direction. */
  private async crawlSite(startUrl: URL, onProgress?: (done: number, found: number) => void): Promise<SitePage[]> {
    const seen = new Set<string>([startUrl.toString()]);
    const queue: { url: string; depth: number }[] = [{ url: startUrl.toString(), depth: 0 }];
    const pages: SitePage[] = [];

    // A sitemap, when there is one, finds the pages no menu links to
    try {
      const sm = await axios.get(new URL('/sitemap.xml', startUrl).toString(), {
        timeout: 10_000,
        headers: { 'User-Agent': UA },
        validateStatus: () => true,
      });
      if (sm.status < 400 && String(sm.data).includes('<loc>')) {
        const $ = cheerio.load(String(sm.data), { xmlMode: true });
        $('url > loc, sitemap > loc').each((_, el) => {
          const loc = $(el).text().trim();
          if (!loc || seen.has(loc) || SKIP_EXT.test(loc) || SKIP_PATH.test(loc)) return;
          try {
            if (new URL(loc).hostname.replace(/^www\./, '') !== startUrl.hostname.replace(/^www\./, '')) return;
          } catch {
            return;
          }
          seen.add(loc);
          queue.push({ url: loc, depth: 1 });
        });
      }
    } catch {
      /* no sitemap is perfectly normal */
    }

    while (queue.length && pages.length < MAX_PAGES) {
      const batch = queue.splice(0, 4);
      const results = await Promise.all(
        batch.map(async ({ url, depth }) => {
          try {
            const res = await axios.get(url, {
              timeout: PAGE_TIMEOUT_MS,
              headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
              maxContentLength: MAX_PAGE_BYTES,
              maxRedirects: 3,
              validateStatus: () => true,
            });
            if (res.status >= 400 || !String(res.headers?.['content-type'] || '').includes('html')) return null;
            const parsed = this.extractPage(String(res.data), new URL(url));
            return { url, depth, ...parsed };
          } catch {
            return null;
          }
        }),
      );

      for (const r of results) {
        if (!r) continue;
        if (r.text && r.text.replace(/\s/g, '').length > 150) {
          pages.push({ url: r.url, title: r.title, text: r.text });
        }
        if (r.depth < MAX_DEPTH) {
          for (const link of r.links) {
            if (seen.size >= MAX_PAGES * 4 || seen.has(link)) continue;
            seen.add(link);
            queue.push({ url: link, depth: r.depth + 1 });
          }
        }
      }
      onProgress?.(pages.length, seen.size);
    }
    return pages;
  }

  // ─── Profile ──────────────────────────────────────────────────────

  private async buildProfile(tenantId: string, pages: SitePage[], domain: string): Promise<BusinessProfile | null> {
    const corpus = pages
      .map((p) => `### ${p.title || p.url}\n(${p.url})\n${p.text}`)
      .join('\n\n')
      .slice(0, MAX_PROFILE_CHARS);
    if (!corpus.trim()) return null;

    const provider = await this.aiFactory.getProviderForTenant(tenantId);
    const result = await provider.chatCompletion(
      [
        {
          role: 'system',
          content: [
            'You read a company website and write the briefing their phone agent will work from.',
            'Return STRICT JSON only, no prose, with these keys:',
            'businessName, oneLiner (one sentence a receptionist would say), whatWeSell (2-4 sentences),',
            'services (array of short strings), pricing (what the site actually states about price; empty string if it says nothing),',
            'locations (array), hours (string, empty if not stated), usps (array of up to 6 short strings),',
            'salesPitch (array of up to 6 short spoken lines a salesperson of THIS company would use to win a customer -',
            'each one built only from what the site actually claims, e.g. a price-match promise, what is included in a package,',
            'years in business, number of customers; write them the way a person speaks, not like website copy),',
            'whyUs (2-3 sentences on why a customer should choose this company rather than anyone else, again only from the site),',
            'faqs (array of up to 8 {q, a} taken from the site), contact {phone, email, whatsapp, address},',
            'doNotSay (array: anything the agent must NOT promise because the site does not commit to it - discounts, delivery dates, guarantees),',
            'languages (array of language codes the site is written in, e.g. ["en"], ["hi"]).',
            'Never invent a price, a phone number or a claim that is not on the site. Leave a field empty instead.',
          ].join('\n'),
        },
        { role: 'user', content: `Website: ${domain}\n\n${corpus}` },
      ],
      { temperature: 0.2, maxTokens: 2000 },
    );

    const raw = (result.content || '').replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try {
      const p = JSON.parse(raw);
      const arr = (v: any, n = 10): string[] =>
        Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 200)).slice(0, n) : [];
      return {
        businessName: String(p.businessName || '').slice(0, 120),
        oneLiner: String(p.oneLiner || '').slice(0, 300),
        whatWeSell: String(p.whatWeSell || '').slice(0, 1200),
        services: arr(p.services, 20),
        pricing: String(p.pricing || '').slice(0, 800),
        locations: arr(p.locations, 10),
        hours: String(p.hours || '').slice(0, 200),
        usps: arr(p.usps, 6),
        salesPitch: arr(p.salesPitch, 6),
        whyUs: String(p.whyUs || '').slice(0, 800),
        faqs: Array.isArray(p.faqs)
          ? p.faqs
              .filter((f: any) => f && typeof f.q === 'string' && typeof f.a === 'string')
              .slice(0, 8)
              .map((f: any) => ({ q: f.q.slice(0, 200), a: f.a.slice(0, 600) }))
          : [],
        contact: {
          phone: String(p.contact?.phone || '').slice(0, 40) || undefined,
          email: String(p.contact?.email || '').slice(0, 120) || undefined,
          whatsapp: String(p.contact?.whatsapp || '').slice(0, 40) || undefined,
          address: String(p.contact?.address || '').slice(0, 300) || undefined,
        },
        doNotSay: arr(p.doNotSay, 8),
        languages: arr(p.languages, 4),
      };
    } catch (err: any) {
      this.logger.warn(`Could not parse the business profile for ${domain}: ${err?.message}`);
      return null;
    }
  }

  /** The profile as the agents read it - short enough to sit in a prompt. */
  static briefFrom(profile: BusinessProfile | null | undefined, domain?: string): string {
    if (!profile) return '';
    const lines: string[] = [];
    if (profile.businessName) lines.push(`Business: ${profile.businessName}${domain ? ` (${domain})` : ''}`);
    if (profile.oneLiner) lines.push(profile.oneLiner);
    if (profile.whatWeSell) lines.push(`What we do: ${profile.whatWeSell}`);
    if (profile.services.length) lines.push(`Services: ${profile.services.join(' · ')}`);
    if (profile.pricing) lines.push(`Pricing on our website: ${profile.pricing}`);
    if (profile.locations.length) lines.push(`Where we are: ${profile.locations.join('; ')}`);
    if (profile.hours) lines.push(`Hours: ${profile.hours}`);
    if (profile.usps.length) lines.push(`Why people choose us: ${profile.usps.join(' · ')}`);
    if (profile.whyUs) lines.push(`Why us rather than anyone else: ${profile.whyUs}`);
    if (profile.salesPitch.length) {
      lines.push('Lines you can use to win the customer (all of these are true, they come from our own website):');
      for (const l of profile.salesPitch) lines.push(`- ${l}`);
    }
    if (profile.faqs.length) {
      lines.push('Questions customers ask, and the answers from our website:');
      for (const f of profile.faqs) lines.push(`- ${f.q} — ${f.a}`);
    }
    if (profile.doNotSay.length) lines.push(`NEVER promise: ${profile.doNotSay.join('; ')}`);
    return lines.join('\n').slice(0, 4000);
  }

  // ─── The whole job ────────────────────────────────────────────────

  /**
   * Read the site, store it as knowledge, write the profile. Runs in the
   * background; the dashboard polls `status`.
   */
  async startCrawl(tenantId: string, opts: { applyToAgents?: boolean } = {}) {
    const tenant: any = await this.tenantModel.findById(tenantId).select('website name').lean();
    const url = tenant?.website?.url;
    if (!url) throw new BadRequestException('Add and verify your website address first');
    if (this.running.has(tenantId)) return { started: false, message: 'We are already reading your website.' };

    this.running.add(tenantId);
    await this.tenantModel.updateOne(
      { _id: tenantId },
      { $set: { 'website.status': 'crawling', 'website.error': '', 'website.pagesFound': 0, 'website.startedAt': new Date() } },
    );

    void this.runCrawl(tenantId, url, !!opts.applyToAgents).finally(() => this.running.delete(tenantId));
    return { started: true, message: 'Reading your website now. This usually takes a minute or two.' };
  }

  private async runCrawl(tenantId: string, url: string, applyToAgents: boolean) {
    const start = new URL(url);
    try {
      const pages = await this.crawlSite(start, (done) => {
        void this.tenantModel.updateOne({ _id: tenantId }, { $set: { 'website.pagesFound': done } }).catch(() => undefined);
      });
      if (!pages.length) {
        await this.tenantModel.updateOne(
          { _id: tenantId },
          { $set: { 'website.status': 'failed', 'website.error': 'We could not read any text from this site. If it is built in JavaScript only, paste your key pages into the Knowledge Base instead.' } },
        );
        return;
      }

      // Everything the chat and WhatsApp agents will search through
      const combined = pages.map((p) => `--- Page: ${p.title || p.url} (${p.url}) ---\n${p.text}`).join('\n\n');
      const sourceId = await this.saveKnowledge(tenantId, start.hostname, combined);

      const profile = await this.buildProfile(tenantId, pages, start.hostname);

      await this.tenantModel.updateOne(
        { _id: tenantId },
        {
          $set: {
            'website.status': 'ready',
            'website.pagesFound': pages.length,
            'website.lastCrawledAt': new Date(),
            'website.knowledgeSourceId': sourceId || '',
            'website.pages': pages.slice(0, MAX_PAGES).map((p) => ({ url: p.url, title: p.title })),
            ...(profile ? { 'website.profile': profile } : {}),
          },
        },
      );

      if (profile && applyToAgents) await this.applyProfileToAgents(tenantId, profile, start.hostname);
      this.logger.log(`Read ${pages.length} page(s) of ${start.hostname} for workspace ${tenantId}`);
    } catch (err: any) {
      this.logger.error(`Website crawl failed for ${start.hostname}: ${err?.message}`);
      await this.tenantModel
        .updateOne({ _id: tenantId }, { $set: { 'website.status': 'failed', 'website.error': String(err?.message || 'Crawl failed').slice(0, 300) } })
        .catch(() => undefined);
    }
  }

  private async saveKnowledge(tenantId: string, domain: string, content: string): Promise<string | null> {
    try {
      const existing: any = await this.tenantModel.findById(tenantId).select('website.knowledgeSourceId').lean();
      const old = existing?.website?.knowledgeSourceId;
      if (old) await this.knowledge.deleteSource(tenantId, old).catch(() => undefined);
      const source: any = await this.knowledge.createSource(tenantId, {
        name: `Website — ${domain}`,
        type: 'text',
        rawContent: content.slice(0, 900_000),
      } as any);
      return String(source?._id || '') || null;
    } catch (err: any) {
      this.logger.warn(`Could not store website knowledge: ${err?.message}`);
      return null;
    }
  }

  /**
   * Puts what the website says in front of the agents: the calling agent gets
   * it in its prompt, the WhatsApp agent in its instructions. Only fills what
   * the workspace has not written itself.
   */
  async applyProfileToAgents(tenantId: string, profile: BusinessProfile, domain: string) {
    const tenant: any = await this.tenantModel.findById(tenantId).select('callingSettings whatsappSettings name').lean();
    const set: Record<string, any> = {};

    const offer = [profile.whatWeSell, profile.services.length ? `We offer: ${profile.services.join(', ')}.` : '', profile.pricing]
      .filter(Boolean)
      .join(' ')
      .slice(0, 1500);

    if (offer && !tenant?.callingSettings?.assistant?.offerSummary) set['callingSettings.assistant.offerSummary'] = offer;
    if (profile.businessName && !tenant?.callingSettings?.assistant?.companyName) {
      set['callingSettings.assistant.companyName'] = profile.businessName;
    }
    if (offer && !tenant?.whatsappSettings?.instructions) set['whatsappSettings.instructions'] = offer;

    if (Object.keys(set).length) await this.tenantModel.updateOne({ _id: tenantId }, { $set: set });
    return { applied: Object.keys(set) };
  }

  // ─── Read ─────────────────────────────────────────────────────────

  async status(tenantId: string) {
    const tenant: any = await this.tenantModel.findById(tenantId).select('website name').lean();
    const w = tenant?.website || {};
    return {
      url: w.url || '',
      domain: w.domain || '',
      title: w.title || '',
      description: w.description || '',
      status: w.status || 'none',
      verifiedAt: w.verifiedAt || null,
      lastCrawledAt: w.lastCrawledAt || null,
      pagesFound: w.pagesFound || 0,
      pages: w.pages || [],
      error: w.error || '',
      profile: w.profile || null,
      brief: WebsiteService.briefFrom(w.profile, w.domain),
      crawling: this.running.has(tenantId) || w.status === 'crawling',
    };
  }

  /** The briefing the agents put in their prompt. Empty when no site was read. */
  async briefFor(tenantId: string): Promise<string> {
    const tenant: any = await this.tenantModel.findById(tenantId).select('website.profile website.domain').lean();
    return WebsiteService.briefFrom(tenant?.website?.profile, tenant?.website?.domain);
  }

  async clear(tenantId: string) {
    const tenant: any = await this.tenantModel.findById(tenantId).select('website.knowledgeSourceId').lean();
    if (tenant?.website?.knowledgeSourceId) {
      await this.knowledge.deleteSource(tenantId, tenant.website.knowledgeSourceId).catch(() => undefined);
    }
    await this.tenantModel.updateOne({ _id: tenantId }, { $unset: { website: 1 } });
    return { cleared: true };
  }
}
