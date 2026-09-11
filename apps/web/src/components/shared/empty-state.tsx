import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Extra action rendered next to the primary one */
  secondary?: React.ReactNode;
  className?: string;
  /** Compact version for use inside cards */
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, secondary, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-xl border border-dashed bg-card/60',
        compact ? 'py-10 px-4' : 'py-20 px-6',
        className,
      )}
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-3xl bg-brand-gradient opacity-20 blur-xl" />
        <div className={cn('relative flex items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg shadow-primary/30 animate-float', compact ? 'h-12 w-12' : 'h-16 w-16')}>
          <Icon className={compact ? 'h-6 w-6' : 'h-8 w-8'} />
        </div>
      </div>
      <h3 className={cn('font-semibold', compact ? 'text-base' : 'text-lg')}>{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {(actionLabel || secondary) && (
        <div className="mt-5 flex items-center gap-2">
          {actionLabel && onAction && <Button onClick={onAction}>{actionLabel}</Button>}
          {secondary}
        </div>
      )}
    </div>
  );
}
