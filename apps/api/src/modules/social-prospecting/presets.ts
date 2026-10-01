/**
 * Product defaults for Leads Scrap AI: what a buying-intent post tends to say,
 * and where such posts tend to live.
 *
 * These are domain knowledge, not configuration - no keys, endpoints or limits
 * live here (those are all in `configuration.ts` / env). A campaign overrides
 * any of it from the dashboard.
 */

/** Buying-intent phrases per service type, used when a campaign lists no keywords. */
export const KEYWORD_PACKS: Record<string, string[]> = {
  website: [
    'need a website',
    'looking for a web developer',
    'need someone to build my site',
    'website redesign help',
    'who can build me a website',
  ],
  ecommerce: [
    'need an online store',
    'looking for shopify developer',
    'want to sell online',
    'need e-commerce website',
  ],
  mobile_app: [
    'need an app developer',
    'looking to build an app',
    'want to build a mobile app',
    'need someone to make an app',
  ],
  ios_app: ['need an iOS developer', 'looking to build an iPhone app'],
  android_app: ['need an Android developer', 'looking to build an Android app'],
  erp_system: ['need an ERP', 'looking for ERP software', 'outgrown our spreadsheets'],
  crm: [
    'need a CRM',
    'looking for CRM recommendations',
    'CRM for small business',
    'managing leads in spreadsheets',
  ],
  custom_software: [
    'need custom software',
    'looking for a software developer',
    'need an internal tool built',
  ],
  ai_chatbot: [
    'need a chatbot',
    'AI assistant for my business',
    'automate customer support',
    'looking for a chatbot developer',
  ],
  llm_application: ['need an AI developer', 'want to build with LLMs', 'looking for AI integration'],
  automation: [
    'need to automate this',
    'looking for automation help',
    'tired of doing this manually',
  ],
  seo_marketing: ['need SEO help', 'looking for a marketing agency', 'need more traffic'],
};

/** Last-resort phrases when a campaign picked no service types at all. */
export const GENERIC_KEYWORDS = [
  'need a developer',
  'looking to hire a developer',
  'need software built',
  'looking for an agency',
];

/** Curated subreddit buckets offered as one-click presets in the campaign form. */
export const SUBREDDIT_PRESETS: { id: string; label: string; subreddits: string[] }[] = [
  {
    id: 'direct_hiring',
    label: 'Direct hiring',
    subreddits: ['forhire', 'slavelabour', 'DoneDirtCheap', 'freelance_forhire', 'jobbit'],
  },
  {
    id: 'business_owners',
    label: 'Business owners',
    subreddits: ['smallbusiness', 'Entrepreneur', 'EntrepreneurRideAlong', 'startups', 'SaaS'],
  },
  {
    id: 'build_requests',
    label: 'Build requests',
    subreddits: ['AppIdeas', 'SomebodyMakeThis', 'nocode', 'webdev', 'web_design'],
  },
  {
    id: 'india',
    label: 'India',
    subreddits: ['IndiaStartups', 'developersIndia', 'IndiaBusiness'],
  },
  {
    id: 'tool_hunting',
    label: 'Tool hunting',
    subreddits: ['sysadmin', 'msp', 'CRM'],
  },
];

/**
 * Sites worth sweeping with the SERP source, offered as one-click presets.
 *
 * None of these need an integration: the SERP source reaches any site through a
 * `site:` filter, so adding a market is a matter of listing its domains here.
 */
export const SITE_PRESETS: { id: string; label: string; sites: string[] }[] = [
  { id: 'quora', label: 'Quora', sites: ['quora.com'] },
  { id: 'indiehackers', label: 'Indie Hackers', sites: ['indiehackers.com'] },
  { id: 'linkedin_posts', label: 'LinkedIn (public posts)', sites: ['linkedin.com/posts'] },
  { id: 'facebook_groups', label: 'Facebook (public groups)', sites: ['facebook.com/groups'] },
  {
    id: 'agency_directories',
    label: 'Agency directories',
    // People arrive on these specifically to pick an agency.
    sites: ['clutch.co', 'designrush.com', 'goodfirms.co'],
  },
  {
    id: 'freelance_marketplaces',
    label: 'Freelance marketplaces',
    sites: ['upwork.com/freelance-jobs', 'peopleperhour.com', 'guru.com', 'truelancer.com'],
  },
  {
    id: 'usa',
    label: 'USA - small business',
    sites: ['alignable.com', 'nextdoor.com', 'startupschool.org'],
  },
  {
    id: 'uk',
    label: 'UK - small business',
    sites: ['ukbusinessforums.co.uk', 'bark.com'],
  },
  {
    id: 'australia',
    label: 'Australia - small business',
    sites: ['flyingsolo.com.au', 'forums.whirlpool.net.au'],
  },
  {
    id: 'uae',
    label: 'UAE / Gulf',
    sites: ['uaetenders.com', 'bayt.com', 'dubizzle.com'],
  },
  {
    id: 'product_switchers',
    // A bad review of a competitor is someone already shopping for a replacement.
    label: 'Review sites (switchers)',
    sites: ['g2.com', 'capterra.com', 'trustpilot.com'],
  },
  {
    id: 'platform_support',
    label: 'Platform support forums',
    sites: ['wordpress.org/support', 'community.shopify.com', 'sitepoint.com'],
  },
  {
    id: 'forums',
    label: 'Marketing forums',
    sites: ['warriorforum.com', 'forums.digitalpoint.com'],
  },
];

/**
 * Phrases that mark the author as a seller advertising services rather than a
 * buyer looking for them. Applied before any AI spend when
 * `filters.excludeSellers` is on.
 */
export const SELLER_MARKERS = [
  '[for hire]',
  'for hire',
  'hire me',
  'my portfolio',
  'dm me for',
  'i offer',
  'we offer',
  'our agency',
  'services i provide',
  'available for work',
  'open for work',
  'i can build',
  'we build',
];

/**
 * Country list lives in `common/constants` because AI Automation needs the same
 * one - re-exported here so existing imports keep working.
 */
export { COUNTRIES, COUNTRY_NAMES, countryName } from '../../common/constants/countries';
