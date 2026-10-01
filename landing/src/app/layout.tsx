import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { BRAND, COMPANY } from '@/lib/brand';
import { SITE_KEYWORDS, SITE_URL } from '@/lib/site';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

/**
 * Inter, self-hosted by next/font at build time — no request to Google at
 * runtime, which keeps the CSP's `font-src 'self'` honest and removes a render-
 * blocking round trip. `display: swap` means text paints in the fallback first
 * rather than sitting invisible.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  // Every relative URL below (canonical, OG image, manifest) resolves against this.
  metadataBase: new URL(SITE_URL),

  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.taglineLong,
  applicationName: BRAND.name,
  keywords: SITE_KEYWORDS,
  category: 'technology',

  authors: [{ name: COMPANY.name, url: COMPANY.url }],
  creator: COMPANY.name,
  publisher: COMPANY.name,

  alternates: {
    canonical: '/',
  },

  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.taglineLong,
    // `app/opengraph-image.tsx` supplies the image; listing it here too would
    // duplicate the tag.
  },

  twitter: {
    card: 'summary_large_image',
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.taglineLong,
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },

  manifest: '/manifest.webmanifest',

  // Stops iOS Safari turning every number in the pricing table into a phone link.
  formatDetection: { telephone: false, email: false, address: false },

  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),

  other: {
    'msapplication-TileColor': '#4f46e5',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Matches the two `--color-background` tokens, so the browser chrome on
  // mobile blends into the page in either theme.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f6fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0d16' },
  ],
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        {/* Runs before first paint so a dark-mode visitor never sees a white flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/*
          Sections fade in on scroll via IntersectionObserver. With scripting
          off that observer never fires, so force every revealed block visible
          rather than serving an invisible page.
        */}
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body className={inter.className}>
        <a
          href="#main"
          className="sr-only rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
