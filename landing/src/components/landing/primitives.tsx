'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * The four bits of motion the page is built from.
 *
 * Each is its own client island so the sections around them stay server
 * components — the crawler receives the finished copy, and only the animation
 * hydrates.
 */

/** Thin gradient bar that tracks how far down the page the reader is. */
export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? (window.scrollY / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-0.5" aria-hidden="true">
      <div
        className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

/**
 * Fade + lift on first scroll into view. Opacity and a small translate only, so
 * nothing reflows and the page never jumps while it settles.
 *
 * `data-reveal` is the hook the <noscript> rule in the layout uses to force the
 * content visible when JavaScript never runs.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal=""
      className={`transition-all duration-[650ms] ease-out ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * Counts up once, when scrolled into view.
 *
 * The final value is also the server-rendered text, so the number is in the
 * HTML before any script runs — the count-up only replaces it on the client.
 */
export function CountUp({
  end,
  duration = 1500,
  className = '',
}: {
  end: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState<number | null>(null);
  const done = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    setValue(0);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || done.current) return;
        done.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - start) / duration, 1);
          setValue(Math.round((1 - Math.pow(1 - p, 3)) * end));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [end, duration]);

  return (
    <span ref={ref} className={className}>
      {value === null ? end : value}
    </span>
  );
}

/**
 * Swaps one word in place. Words render stacked in a single grid cell so the box
 * is always as wide as the longest one — the line never reflows.
 */
export function WordRotate({ words, className = '' }: { words: string[]; className?: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), 2400);
    return () => clearInterval(id);
  }, [words.length]);

  return (
    <span className={`grid ${className}`}>
      {words.map((word, i) => (
        <span
          key={word}
          aria-hidden={i !== index}
          className={`col-start-1 row-start-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent transition-all duration-500 ${
            i === index
              ? 'translate-y-0 opacity-100 blur-0'
              : 'pointer-events-none -translate-y-1.5 opacity-0 blur-[3px]'
          }`}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

/**
 * The hero's cursor spotlight. The position is written straight to CSS custom
 * properties, so moving the mouse never re-renders React.
 */
export function HeroSpotlight({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
    node.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
  };

  return (
    <div ref={ref} onMouseMove={onMove} className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(460px circle at var(--spot-x, 70%) var(--spot-y, 25%), color-mix(in srgb, var(--color-primary) 12%, transparent), transparent 70%)',
        }}
      />
      {children}
    </div>
  );
}
