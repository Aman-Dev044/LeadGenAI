import type { MetadataRoute } from 'next';
import { SITE_URL, siteUrl } from '@/lib/site';

/**
 * Preview and local deploys must never be indexed — they would compete with the
 * real domain for the same copy. `NEXT_PUBLIC_SITE_URL` is the switch: if it is
 * not a real https origin, the whole site is disallowed.
 */
const isProduction = SITE_URL.startsWith('https://');

export default function robots(): MetadataRoute.Robots {
  if (!isProduction) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Nothing here is private, but these add no value to an index.
        disallow: ['/api/', '/_next/'],
      },
    ],
    sitemap: siteUrl('/sitemap.xml'),
    host: SITE_URL,
  };
}
