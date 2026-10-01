import { ImageResponse } from 'next/og';
import { BRAND, COMPANY } from '@/lib/brand';

/**
 * The social card, generated at request time rather than shipped as a PNG, so
 * it can never drift from the brand strings in `brand.ts`.
 *
 * Satori (what `ImageResponse` renders with) supports a subset of CSS and SVG:
 * no `mask-composite`, no `conic-gradient`, no `backdrop-filter`. The bell is
 * therefore drawn with plain filled paths instead of the masked mark used on
 * the site, and the background is a linear gradient rather than the aurora.
 */

export const alt = BRAND.signature;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          backgroundImage: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 52%, #C026D3 100%)',
          color: '#FFFFFF',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Soft highlight, standing in for the site's aurora blobs */}
        <div
          style={{
            position: 'absolute',
            top: -180,
            right: -120,
            width: 620,
            height: 620,
            borderRadius: 620,
            background: 'rgba(255,255,255,0.14)',
            display: 'flex',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg width="76" height="76" viewBox="0 0 64 64">
            <rect x="2" y="2" width="60" height="60" rx="17.5" fill="rgba(255,255,255,0.18)" />
            <path
              d="M14 43 C18 38, 19.5 33, 19.5 27 C19.5 19.5, 25 14, 32 14 C39 14, 44.5 19.5, 44.5 27 C44.5 33, 46 38, 50 43 Z"
              fill="#FFFFFF"
            />
            <rect x="12.5" y="43" width="39" height="3.5" rx="1.75" fill="#FFFFFF" />
            <circle cx="32" cy="11" r="3" fill="#FFFFFF" />
            <path
              d="M32 47.5 C32 50.25, 33 51.25, 35.5 52.25 C33 53.25, 32 54.25, 32 57 C32 54.25, 31 53.25, 28.5 52.25 C31 51.25, 32 50.25, 32 47.5 Z"
              fill="#FFFFFF"
            />
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: -1 }}>{BRAND.name}</div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: 3,
                textTransform: 'uppercase',
                opacity: 0.82,
              }}
            >
              {BRAND.tagline}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Satori needs an explicit display on any element with more than one
              child, so each line is its own flex row rather than a <br/>. */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: 68,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: -2,
            }}
          >
            {['Every lead captured,', 'qualified and ringing', 'in one workspace.'].map((line) => (
              <div key={line} style={{ display: 'flex' }}>
                {line}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {['Website chat', 'WhatsApp', 'Google Maps', 'Reddit', 'Public tenders'].map((chip) => (
              <div
                key={chip}
                style={{
                  display: 'flex',
                  padding: '10px 20px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.16)',
                  border: '1px solid rgba(255,255,255,0.28)',
                  fontSize: 22,
                  fontWeight: 600,
                }}
              >
                {chip}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 22,
            opacity: 0.82,
          }}
        >
          <div style={{ display: 'flex' }}>Autonomous AI sales agents · inbound &amp; outbound</div>
          <div style={{ display: 'flex' }}>{COMPANY.poweredBy}</div>
        </div>
      </div>
    ),
    size,
  );
}
