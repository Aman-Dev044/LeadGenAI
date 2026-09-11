import { cn } from '@/lib/utils';

interface LoadingProps {
  label?: string;
  className?: string;
  /** Smaller inline spinner */
  size?: 'sm' | 'md';
}

export function Loading({ label = 'Loading', className, size = 'md' }: LoadingProps) {
  const dim = size === 'sm' ? 'h-6 w-6 border-2' : 'h-10 w-10 border-[3px]';
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground', className)}>
      <div className="relative">
        <div className={cn('rounded-full border-primary/15', dim)} />
        <div className={cn('absolute inset-0 animate-spin rounded-full border-transparent border-t-primary border-r-primary', dim)} />
      </div>
      {label && <p className="text-xs font-medium tracking-wide animate-pulse-soft">{label}…</p>}
    </div>
  );
}
