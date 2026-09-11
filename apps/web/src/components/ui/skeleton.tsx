import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg bg-muted animate-shimmer bg-[linear-gradient(90deg,transparent_0%,color-mix(in_srgb,var(--color-foreground)_6%,transparent)_50%,transparent_100%)] bg-[length:200%_100%]',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
