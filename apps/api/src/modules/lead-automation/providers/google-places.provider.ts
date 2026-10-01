import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ILeadSourceProvider,
  LeadSourceSearchParams,
  LeadSourceSearchResult,
  RawProspect,
  RawProspectReview,
} from './lead-source.interface';

const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const DETAILS_URL = 'https://places.googleapis.com/v1/places';

/** Cheap tier: everything we need to filter on, without pulling reviews. */
const SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.businessStatus',
  'places.primaryTypeDisplayName',
  'places.types',
  'nextPageToken',
].join(',');

/** Billed higher, so it runs only on prospects that already passed the filters. */
const DETAILS_FIELD_MASK = ['id', 'reviews', 'googleMapsUri'].join(',');

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_PAGE_SIZE = 20;
/** Google caps text search at 3 pages (60 results) per query. */
const MAX_PAGES = 3;

type AddressComponent = { longText?: string; shortText?: string; types?: string[] };

@Injectable()
export class GooglePlacesProvider implements ILeadSourceProvider {
  readonly id = 'google_maps';
  readonly label = 'Google Maps';

  private readonly logger = new Logger(GooglePlacesProvider.name);

  constructor(private readonly configService: ConfigService) {}

  private get apiKey(): string {
    return this.configService.get<string>('googlePlaces.apiKey') || '';
  }

  /**
   * Set for the duration of one run so a workspace spends its own Places quota.
   * Runs are serialised per campaign, and the value is cleared in a `finally`.
   */
  private tenantApiKey: string | null = null;

  private get activeKey(): string {
    return this.tenantApiKey || this.apiKey;
  }

  /** Binds this provider to one workspace's key until `clearCredentials`. */
  useCredentials(credentials?: Record<string, string>) {
    this.tenantApiKey = credentials?.apiKey || null;
  }

  clearCredentials() {
    this.tenantApiKey = null;
  }

  isConfigured(credentials?: Record<string, string>): boolean {
    return !!(credentials?.apiKey || this.tenantApiKey || this.apiKey);
  }

  async search(params: LeadSourceSearchParams): Promise<LeadSourceSearchResult> {
    const warnings: string[] = [];
    const prospects: RawProspect[] = [];
    let apiCalls = 0;
    /**
     * Places treats `regionCode` as a *bias*, not a filter - a search for "gym"
     * with regionCode US happily returns gyms in other countries. The address
     * components come back with an ISO code, so the only dependable restriction
     * is to drop what came back from elsewhere.
     */
    const wantedCountry = (params.regionCode || '').trim().toUpperCase();
    let droppedByCountry = 0;

    if (!this.isConfigured()) {
      return { prospects, apiCalls, warnings: ['GOOGLE_PLACES_API_KEY is not configured'] };
    }

    let pageToken: string | undefined;
    // Older deployments of the API reject `pageSize`; we fall back once and remember.
    let usePageSize = true;

    for (let page = 0; page < MAX_PAGES && prospects.length < params.limit; page++) {
      const remaining = params.limit - prospects.length;
      const body: Record<string, any> = {
        textQuery: params.query,
        languageCode: params.languageCode || 'en',
      };
      if (params.regionCode) body.regionCode = params.regionCode;
      if (usePageSize) {
        body.pageSize = Math.min(MAX_PAGE_SIZE, remaining);
      } else {
        body.maxResultCount = Math.min(MAX_PAGE_SIZE, remaining);
      }
      if (pageToken) body.pageToken = pageToken;

      let response: any;
      try {
        response = await this.post(SEARCH_URL, body, SEARCH_FIELD_MASK);
        apiCalls++;
      } catch (err: any) {
        // Retry once with the legacy field name before giving up on the query.
        if (usePageSize && /pageSize|page_size|INVALID_ARGUMENT/i.test(err?.message || '')) {
          usePageSize = false;
          page--;
          continue;
        }
        warnings.push(`"${params.query}": ${err?.message || 'search failed'}`);
        break;
      }

      const places: any[] = response?.places || [];
      for (const place of places) {
        const mapped = this.mapPlace(place);
        if (mapped) {
          // A place Google could not attribute to any country is kept: dropping
          // it would silently lose real prospects on a data gap.
          if (wantedCountry && mapped.countryCode && mapped.countryCode !== wantedCountry) {
            droppedByCountry++;
          } else {
            prospects.push(mapped);
          }
        }
        if (prospects.length >= params.limit) break;
      }

      pageToken = response?.nextPageToken;
      if (!pageToken || places.length === 0) break;
    }

    if (droppedByCountry > 0) {
      warnings.push(
        `"${params.query}": dropped ${droppedByCountry} result(s) outside ${wantedCountry}.`,
      );
    }

    return { prospects, apiCalls, warnings };
  }

  async enrichReviews(
    prospects: RawProspect[],
    languageCode: string,
  ): Promise<{ apiCalls: number; warnings: string[] }> {
    const warnings: string[] = [];
    let apiCalls = 0;
    if (!this.isConfigured()) return { apiCalls, warnings };

    for (const prospect of prospects) {
      try {
        const url =
          `${DETAILS_URL}/${encodeURIComponent(prospect.externalId)}` +
          `?languageCode=${encodeURIComponent(languageCode || 'en')}`;
        const details = await this.get(url, DETAILS_FIELD_MASK);
        apiCalls++;

        const reviews: any[] = details?.reviews || [];
        if (!reviews.length) continue;

        const samples: RawProspectReview[] = [];
        const timestamps: number[] = [];

        for (const review of reviews) {
          const publishedAt = review?.publishTime ? new Date(review.publishTime) : undefined;
          if (publishedAt && !isNaN(publishedAt.getTime())) timestamps.push(publishedAt.getTime());
          samples.push({
            author: review?.authorAttribution?.displayName,
            text: review?.text?.text || review?.originalText?.text,
            rating: review?.rating,
            publishedAt,
            // Prefer the review's own deep link; fall back to the listing.
            url: review?.googleMapsUri || review?.authorAttribution?.uri || prospect.sourceUrl,
          });
        }

        prospect.reviewSamples = samples;
        if (timestamps.length) {
          prospect.oldestReviewAt = new Date(Math.min(...timestamps));
          prospect.newestReviewAt = new Date(Math.max(...timestamps));
        }
      } catch (err: any) {
        warnings.push(`details ${prospect.businessName}: ${err?.message || 'failed'}`);
      }
    }

    return { apiCalls, warnings };
  }

  // HTTP

  private async post(url: string, body: unknown, fieldMask: string) {
    return this.request(url, fieldMask, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async get(url: string, fieldMask: string) {
    return this.request(url, fieldMask, { method: 'GET' });
  }

  private async request(url: string, fieldMask: string, init: RequestInit) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          ...((init.headers as Record<string, string>) || {}),
          'X-Goog-Api-Key': this.activeKey,
          'X-Goog-FieldMask': fieldMask,
        },
      });

      const text = await res.text();
      const json = text ? safeJson(text) : {};

      if (!res.ok) {
        const message = json?.error?.message || `${res.status} ${res.statusText}`;
        throw new Error(message);
      }
      return json;
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new Error('Google Places request timed out');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // Mapping

  private mapPlace(place: any): RawProspect | null {
    const externalId: string | undefined = place?.id;
    const businessName: string | undefined = place?.displayName?.text;
    if (!externalId || !businessName) return null;

    const components: AddressComponent[] = place?.addressComponents || [];
    const pick = (type: string, short = false) => {
      const match = components.find((c) => (c.types || []).includes(type));
      return (short ? match?.shortText : match?.longText) || undefined;
    };

    return {
      externalId,
      // googleMapsUri is the canonical public listing; the search link is the fallback.
      sourceUrl:
        place?.googleMapsUri ||
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          businessName,
        )}&query_place_id=${externalId}`,
      businessName,
      category: place?.primaryTypeDisplayName?.text,
      categories: place?.types || [],
      phone: place?.nationalPhoneNumber || place?.internationalPhoneNumber,
      website: place?.websiteUri,
      address: place?.formattedAddress,
      city: pick('locality') || pick('postal_town') || pick('administrative_area_level_2'),
      state: pick('administrative_area_level_1'),
      country: pick('country'),
      // shortText is the ISO code; longText is the display name.
      countryCode: pick('country', true),
      postalCode: pick('postal_code'),
      location: {
        lat: place?.location?.latitude,
        lng: place?.location?.longitude,
      },
      rating: place?.rating || 0,
      reviewCount: place?.userRatingCount || 0,
      businessStatus: place?.businessStatus,
      raw: place,
    };
  }
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text.slice(0, 300) } };
  }
}
