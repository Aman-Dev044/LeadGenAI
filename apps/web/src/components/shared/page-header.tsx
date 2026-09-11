import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Icon shown in a tinted tile to the left of the title */
  icon?: LucideIcon;
  /** Small label above the title, e.g. "Owner console" */
  eyebrow?: string;
  /** Extra content under the description (tabs, filters, chips) */
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, icon: Icon, eyebrow, children, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 page-enter', className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {Icon && (
            <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-md shadow-primary/30">
              <Icon className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
            )}
            <h1 className="text-2xl md:text-[28px] font-bold tracking-tight leading-tight">{title}</h1>
            {description && <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
