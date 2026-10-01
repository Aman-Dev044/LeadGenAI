import type { MetadataRoute } from 'next';
import { SITE_PAGES, siteUrl } from '@/lib/site';

/**
 * Built from `SITE_PAGES`, so adding a route to the site adds it to the sitemap
 * in the same edit rather than a forgotten second one.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return SITE_PAGES.map((page) => ({
    url: siteUrl(page.path),
    lastModified,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
