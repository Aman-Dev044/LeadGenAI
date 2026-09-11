'use client';
import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

/** Card-styled strip that holds search + filter controls above a table or list. */
export function Toolbar({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mb-4 flex flex-wrap items-center gap-2.5 rounded-xl border bg-card p-2.5 shadow-card', className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  containerClassName?: string;
}

export function SearchInput({ value, onChange, className, containerClassName, placeholder = 'Search…', ...props }: SearchInputProps) {
  return (
    <div className={cn('relative min-w-[200px] flex-1 max-w-sm', containerClassName)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn('pl-9 pr-8 h-9', className)}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** Thin vertical divider for toolbars. */
export function ToolbarDivider() {
  return <div className="hidden h-6 w-px bg-border sm:block" />;
}

/** Right-aligned group inside a Toolbar. */
export function ToolbarSpacer() {
  return <div className="flex-1" />;
}
