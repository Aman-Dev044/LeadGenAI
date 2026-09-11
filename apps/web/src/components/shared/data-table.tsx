'use client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  isLoading?: boolean;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  emptyDescription?: string;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border bg-card shadow-card overflow-hidden">
      <div className="flex gap-4 border-b bg-muted/50 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-border/60 px-4 py-4 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn('h-4 flex-1', c === 0 && 'max-w-[40%]')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function TablePagination({
  total, page, limit, totalPages, onPageChange, onLimitChange, className,
}: {
  total: number; page: number; limit: number; totalPages: number;
  onPageChange?: (page: number) => void; onLimitChange?: (limit: number) => void; className?: string;
}) {
  if (total <= 0) return null;
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1 py-4', className)}>
      <p className="text-xs text-muted-foreground tabular">
        Showing <span className="font-semibold text-foreground">{(page - 1) * limit + 1}</span>–
        <span className="font-semibold text-foreground">{Math.min(page * limit, total)}</span> of{' '}
        <span className="font-semibold text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        {onLimitChange && (
          <Select value={String(limit)} onValueChange={(v) => onLimitChange(Number(v))}>
            <SelectTrigger className="h-8 w-[84px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((v) => (
                <SelectItem key={v} value={String(v)}>{v} / page</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center rounded-lg border bg-card shadow-xs">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-r-none" disabled={page <= 1} onClick={() => onPageChange?.(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-3 text-xs font-medium tabular border-x h-8 inline-flex items-center">
            {page} / {Math.max(totalPages, 1)}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-l-none" disabled={page >= totalPages} onClick={() => onPageChange?.(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DataTable<T extends { _id: string }>({
  columns, data, total = 0, page = 1, limit = 10, totalPages = 1,
  onPageChange, onLimitChange, isLoading, onRowClick, emptyMessage = 'No data found', emptyDescription,
}: DataTableProps<T>) {
  if (isLoading) return <TableSkeleton cols={columns.length} />;

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => (
              <TableHead key={col.key} className={col.className}>{col.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="h-40 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Inbox className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{emptyMessage}</p>
                  {emptyDescription && <p className="text-xs">{emptyDescription}</p>}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => (
              <TableRow
                key={item._id}
                className={onRowClick ? 'cursor-pointer' : ''}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.render ? col.render(item) : (item as any)[col.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <TablePagination
        total={total}
        page={page}
        limit={limit}
        totalPages={totalPages}
        onPageChange={onPageChange}
        onLimitChange={onLimitChange}
      />
    </div>
  );
}
