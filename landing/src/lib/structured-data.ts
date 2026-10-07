import { BRAND, COMPANY } from '@/lib/brand';
import { FAQS, PLANS } from '@/lib/landing-data';
import { CONTACT_EMAIL, SITE_KEYWORDS, SITE_URL, siteUrl } from '@/lib/site';

/**
 * Schema.org graph for the site.
 *
 * Everything here is derived from the same arrays the page renders, so the
 * markup can never advertise a price or an answer the visitor cannot see —
 * which is both the Google guideline and the reason to build it this way.
 *
 * Deliberately absent: `aggregateRating` and `Review`. The testimonials on the
 * landing page are illustrative copy, not collected reviews, and marking them
 * up would claim a star rating we cannot substantiate. Add them here only once
 * the quotes come from real, attributable customers.
 */

const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const PRODUCT_ID = `${SITE_URL}/#product`;

export const organizationSchema = {
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: COMPANY.name,
  alternateName: COMPANY.shortName,
  url: COMPANY.url,
  logo: {
    '@type': 'ImageObject',
    url: siteUrl('/icon-512.png'),
    width: 512,
    height: 512,
  },
  email: CONTACT_EMAIL,
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: CONTACT_EMAIL,
      availableLanguage: ['en'],
    },
  ],
};

export const websiteSchema = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  url: SITE_URL,
  name: BRAND.name,
  description: BRAND.taglineLong,
  inLanguage: 'en',
  publisher: { '@id': ORGANIZATION_ID },
};

/**
 * The product itself. Every plan on the pricing table becomes an `Offer`, with
 * the annual price expressed as its own yearly offer so a comparison engine
 * sees the real discount instead of inferring one.
 */
export const productSchema = {
  '@type': 'SoftwareApplication',
  '@id': PRODUCT_ID,
  name: BRAND.name,
  alternateName: BRAND.signature,
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Sales & CRM',
  operatingSystem: 'Web browser',
  url: SITE_URL,
  description: BRAND.taglineLong,
  image: siteUrl('/icon-512.png'),
  keywords: SITE_KEYWORDS.join(', '),
  publisher: { '@id': ORGANIZATION_ID },
  featureList: [
    'Autonomous AI sales agent with tool calling',
    'RAG knowledge base grounded in your own documents',
    'Real-time lead qualification and intent scoring',
    'Live human takeover mid-conversation',
    'Multi-channel follow-up automation (email, SMS, WhatsApp)',
    'Google Maps and public-forum outbound prospecting',
    'Visitor analytics, UTM and referrer attribution',
    'Multi-tenant workspaces with role-based access control',
    'Webhooks and REST API',
  ],
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'INR',
    lowPrice: Math.min(...PLANS.map((plan) => plan.monthly)),
    highPrice: Math.max(...PLANS.map((plan) => plan.monthly)),
    offerCount: PLANS.length,
    offers: PLANS.flatMap((plan) => {
      const base = {
        '@type': 'Offer' as const,
        name: `${BRAND.name} ${plan.name}`,
        description: plan.features.join(', '),
        priceCurrency: 'INR',
        availability: 'https://schema.org/InStock',
        url: siteUrl('/#pricing'),
      };

      const monthly = {
        ...base,
        name: `${base.name} (monthly)`,
        price: plan.monthly,
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: plan.monthly,
          priceCurrency: 'INR',
          billingDuration: 1,
          billingIncrement: 1,
          unitCode: 'MON',
        },
      };

      // The free tier has no annual variant to advertise.
      if (plan.yearly === 0) return [monthly];

      return [
        monthly,
        {
          ...base,
          name: `${base.name} (annual)`,
          price: plan.yearly,
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: plan.yearly,
            priceCurrency: 'INR',
            billingDuration: 12,
            billingIncrement: 1,
            unitCode: 'MON',
          },
        },
      ];
    }),
  },
};

export const faqSchema = {
  '@type': 'FAQPage',
  '@id': `${SITE_URL}/#faq`,
  mainEntity: FAQS.map((faq) => ({
    '@type': 'Question',
    name: faq.q,
    acceptedAnswer: { '@type': 'Answer', text: faq.a },
  })),
};

/** The landing page's full graph, emitted as one `<script type="application/ld+json">`. */
export const landingGraph = {
  '@context': 'https://schema.org',
  '@graph': [
    organizationSchema,
    websiteSchema,
    productSchema,
    faqSchema,
    {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/#webpage`,
      url: SITE_URL,
      name: BRAND.signature,
      description: BRAND.taglineLong,
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': PRODUCT_ID },
      primaryImageOfPage: { '@type': 'ImageObject', url: siteUrl('/opengraph-image') },
      inLanguage: 'en',
    },
  ],
};

/** The privacy policy's graph — a `WebPage` plus the breadcrumb back to home. */
export const privacyGraph = {
  '@context': 'https://schema.org',
  '@graph': [
    organizationSchema,
    {
      '@type': 'WebPage',
      '@id': `${siteUrl('/privacy')}#webpage`,
      url: siteUrl('/privacy'),
      name: `Privacy Policy | ${BRAND.name}`,
      description: `How ${BRAND.name} collects, protects and processes lead, conversation and workspace data.`,
      isPartOf: { '@id': WEBSITE_ID },
      inLanguage: 'en',
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Privacy Policy', item: siteUrl('/privacy') },
      ],
    },
  ],
};
