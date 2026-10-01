'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Menu, Moon, Sun, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/brand/logo';
import { BRAND } from '@/lib/brand';
import { NAV_LINKS } from '@/lib/landing-data';
import { ROUTES } from '@/lib/site';
import { useTheme } from '@/hooks/use-theme';

/**
 * Sticky glass header.
 *
 * Client-side for two reasons only: the theme toggle and the mobile menu. The
 * anchor links themselves are plain <a> so they work before hydration.
 */
export function SiteHeader() {
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  // A stray open menu behind a scrolled page reads as a bug — close it once the
  // reader has moved on, and on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-2.5" aria-label={`${BRAND.name} home`}>
          <LogoMark className="h-9 w-9 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105" />
          <span className="leading-none">
            <span className="block text-lg font-extrabold tracking-tight">
              Lead<span className="text-gradient">Bells</span>
            </span>
            <span className="mt-0.5 hidden text-[9px] font-bold tracking-[0.13em] text-muted-foreground uppercase sm:block">
              {BRAND.tagline}
            </span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-6 text-[13px] font-semibold text-muted-foreground lg:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-border/70 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <a href={ROUTES.login} className="hidden sm:block">
            <Button variant="ghost" size="sm" className="text-[13px] font-semibold">
              Sign in
            </Button>
          </a>
          <a href={ROUTES.register}>
            <Button variant="gradient" size="sm" className="gap-1.5 text-[13px] font-bold">
              Start free <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </a>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-border/70 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground lg:hidden"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile nav — the anchor list the lg: nav hides */}
      <nav
        id="mobile-nav"
        aria-label="Primary mobile"
        hidden={!menuOpen}
        className="border-t border-border/50 bg-background/95 px-4 py-3 backdrop-blur-xl sm:px-6 lg:hidden"
      >
        <ul className="flex flex-col gap-0.5">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-[13.5px] font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                {link.label}
              </a>
            </li>
          ))}
          <li className="mt-1 border-t border-border/50 pt-2 sm:hidden">
            <a
              href={ROUTES.login}
              className="block rounded-lg px-3 py-2.5 text-[13.5px] font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              Sign in
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
