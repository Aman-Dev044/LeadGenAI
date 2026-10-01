import type { LucideIcon } from 'lucide-react';

/** Small label above every section heading. Server-rendered — no interactivity. */
export function Eyebrow({
  icon: Icon,
  children,
  className = '',
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-[10.5px] font-black tracking-[0.13em] text-primary uppercase ${className}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </p>
  );
}
