import Link from 'next/link';
import { BRAND, COMPANY } from '@/lib/brand';
import { cn } from '@/lib/utils';

/**
 * The LeadBells mark.
 *
 * A bell mid-ring whose interior is a funnel of converging signal arcs, with
 * the clapper replaced by a spark: scattered traffic narrowing into one
 * qualified lead that rings in one place — the tagline drawn, and a nod to
 * Cyberbells.
 *
 * Drawn on a 64-unit grid with round caps so it holds from a 16px favicon up to
 * a hero render, and kept identical to `public/icon.svg` at 8x. No hooks are
 * used, so the mark works inside Server Components; the gradient and mask ids
 * are fixed and every instance declares the same definitions, which makes
 * duplicate ids on one page harmless.
 */
export function LogoMark({
  className,
  tone = 'gradient',
}: {
  className?: string;
  /** `gradient` = brand squircle, `plain` = currentColor on transparent. */
  tone?: 'gradient' | 'plain';
}) {
  const plain = tone === 'plain';
  const ink = plain ? 'currentColor' : '#FFFFFF';

  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={`${BRAND.name} — ${BRAND.tagline}`}
      className={cn('h-9 w-9', className)}
    >
      <defs>
        <linearGradient id="leadai-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="55%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#C026D3" />
        </linearGradient>
        <linearGradient id="leadai-rim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="leadai-sheen" cx="28%" cy="16%" r="62%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>

        {/* The bell, with the funnel arcs punched out of it */}
        <mask id="leadai-bell">
          <path
            d="M14 43 C18 38, 19.5 33, 19.5 27 C19.5 19.5, 25 14, 32 14 C39 14, 44.5 19.5, 44.5 27 C44.5 33, 46 38, 50 43 Z"
            fill="#FFFFFF"
          />
          <rect x="12.5" y="43" width="39" height="3.5" rx="1.75" fill="#FFFFFF" />
          <circle cx="32" cy="11" r="3" fill="#FFFFFF" />
          <g fill="none" stroke="#000000" strokeWidth="2.75" strokeLinecap="round">
            <path d="M22 25.25 Q32 31.5 42 25.25" />
            <path d="M25.5 33.25 Q32 37.5 38.5 33.25" />
          </g>
        </mask>
      </defs>

      {!plain && (
        <>
          <rect x="2" y="2" width="60" height="60" rx="17.5" fill="url(#leadai-bg)" />
          <rect x="2" y="2" width="60" height="60" rx="17.5" fill="url(#leadai-sheen)" />
          <rect
            x="2"
            y="2"
            width="60"
            height="60"
            rx="17.5"
            fill="none"
            stroke="url(#leadai-rim)"
            strokeWidth="1.25"
          />
        </>
      )}

      {/* Ring waves */}
      <g fill="none" stroke={ink} strokeWidth="2.5" strokeLinecap="round" opacity="0.5">
        <path d="M9.5 31.25 C7.5 27.75, 7.75 22.25, 10.5 18.75" />
        <path d="M54.5 31.25 C56.5 27.75, 56.25 22.25, 53.5 18.75" />
      </g>

      <rect x="0" y="0" width="64" height="64" fill={ink} mask="url(#leadai-bell)" />

      {/* Clapper: the qualified lead */}
      <path
        d="M32 47.5 C32 50.25, 33 51.25, 35.5 52.25 C33 53.25, 32 54.25, 32 57 C32 54.25, 31 53.25, 28.5 52.25 C31 51.25, 32 50.25, 32 47.5 Z"
        fill={ink}
      />
    </svg>
  );
}

/**
 * Mark + wordmark, with the tagline underneath when there is room for it.
 */
export function Logo({
  className,
  markClassName,
  size = 'md',
  showTagline = false,
  tone = 'gradient',
}: {
  className?: string;
  markClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  tone?: 'gradient' | 'plain';
}) {
  const sizes = {
    sm: { mark: 'h-8 w-8', name: 'text-[15px]', tagline: 'text-[9px]' },
    md: { mark: 'h-9 w-9', name: 'text-lg', tagline: 'text-[9.5px]' },
    lg: { mark: 'h-11 w-11', name: 'text-2xl', tagline: 'text-[11px]' },
  }[size];

  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark tone={tone} className={cn(sizes.mark, markClassName)} />
      <span className="leading-tight">
        <span className={cn('block font-extrabold tracking-tight', sizes.name)}>
          Lead
          <span className={tone === 'plain' ? 'opacity-80' : 'text-gradient'}>Bells</span>
        </span>
        {showTagline && (
          <span
            className={cn(
              'mt-0.5 block font-bold uppercase tracking-[0.13em] opacity-60',
              sizes.tagline,
            )}
          >
            {BRAND.tagline}
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * Attribution line required in every footer. The company name is the link out.
 */
export function PoweredBy({
  className,
  linkClassName,
}: {
  className?: string;
  linkClassName?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', className)}>
      <span className="opacity-70">Powered by</span>
      <Link
        href={COMPANY.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'font-semibold underline-offset-4 transition-colors hover:text-primary hover:underline',
          linkClassName,
        )}
      >
        {COMPANY.name}
      </Link>
    </span>
  );
}
