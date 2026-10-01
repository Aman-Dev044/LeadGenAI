import { BRAND, COMPANY } from '@/lib/brand';

/**
 * Everything the marketing site needs to know about *where* it lives.
 *
 * This app is deployed separately from the product, so two origins matter:
 * `SITE_URL` is this site (canonicals, sitemap, Open Graph), and `APP_URL` is
 * the dashboard every call-to-action sends people to. Both come from env so a
 * preview deploy never emits production canonicals.
 */

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

/** Canonical origin of this marketing site. No trailing slash. */
export const SITE_URL = stripTrailingSlash(
  process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3002',
);

/** Origin of the actual product. Every auth/dashboard link resolves against it. */
export const APP_URL = stripTrailingSlash(
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001',
);

/** Absolute URL on this marketing site — for canonicals, sitemap and JSON-LD. */
export const siteUrl = (path = '/') => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

/** Absolute URL into the product. Used by every "Start free" / "Sign in" link. */
export const appUrl = (path = '/') => `${APP_URL}${path.startsWith('/') ? path : `/${path}`}`;

/** The three destinations the CTAs use, so no string is repeated across sections. */
export const ROUTES = {
  register: appUrl('/auth/register'),
  login: appUrl('/auth/login'),
  dashboard: appUrl('/dashboard'),
} as const;

export const CONTACT_EMAIL = 'info.cyberbells@gmail.com';

/** Pages that exist on this site — the sitemap and the footer both read this. */
export const SITE_PAGES = [
  { path: '/', changeFrequency: 'weekly' as const, priority: 1 },
  { path: '/privacy', changeFrequency: 'yearly' as const, priority: 0.3 },
];

/**
 * Keyword set for `<meta name="keywords">` and the structured-data `keywords`
 * field. Kept in one place so the two never drift apart.
 */
export const SITE_KEYWORDS = [
  'AI lead generation',
  'AI sales agent',
  'conversational AI for websites',
  'lead qualification software',
  'AI chatbot for lead capture',
  'lead scoring software',
  'outbound prospecting AI',
  'Google Maps lead scraper',
  'Reddit lead generation',
  'WhatsApp lead capture',
  'multi-tenant SaaS CRM',
  'automated appointment booking',
  'live chat handoff',
  BRAND.name,
  COMPANY.shortName,
];
