'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Eye, Lock, X } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

type Page = {
  path: string;
  label: string;
  group: string;
  roles: string[];
  locked?: boolean;
};

/**
 * Which menu items one teammate sees.
 *
 * Only pages their role already allows are listed, and the list can only take
 * pages away - so an administrator can narrow somebody's menu but never hand
 * out something the role was not entitled to. Every endpoint behind these
 * pages stays gated on the API regardless.
 */
export function PagePermissionsDialog({
  user,
  onOpenChange,
}: {
  user: any | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [allowed, setAllowed] = useState<Set<string>>(new Set());

  const { data: catalogue } = useQuery({
    queryKey: ['users', 'page-catalogue'],
    queryFn: () => api.get<any>('/users/page-catalogue'),
    enabled: !!user,
  });

  const pages: Page[] = useMemo(() => {
    const all: Page[] = (catalogue as any)?.data?.pages || [];
    return user ? all.filter((p) => p.roles.includes(user.role)) : [];
  }, [catalogue, user]);

  // An empty stored list means "no restriction", which shows as everything on
  useEffect(() => {
    if (!user || !pages.length) return;
    const stored: string[] = user.pagePermissions || [];
    setAllowed(new Set(stored.length ? stored : pages.map((p) => p.path)));
  }, [user, pages]);

  const save = useMutation({
    mutationFn: () => api.patch(`/users/${user._id || user.id}/permissions`, { pages: [...allowed] }),
    onSuccess: () => {
      toast.success('Menu updated. They see the change on their next page load.');
      qc.invalidateQueries({ queryKey: ['users'] });
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err?.message || 'Could not save the menu'),
  });

  const groups = useMemo(() => {
    const by = new Map<string, Page[]>();
    for (const p of pages) by.set(p.group, [...(by.get(p.group) || []), p]);
    return [...by.entries()];
  }, [pages]);

  const toggle = (path: string, on: boolean) =>
    setAllowed((prev) => {
      const next = new Set(prev);
      if (on) next.add(path);
      else next.delete(path);
      return next;
    });

  const optional = pages.filter((p) => !p.locked);
  const onCount = optional.filter((p) => allowed.has(p.path)).length;
  const allOn = onCount === optional.length;

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            What {user?.firstName || 'they'} can see
            {user?.role && (
              <Badge variant="secondary" className="ml-2 align-middle">
                {String(user.role).replace('_', ' ').toLowerCase()}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Switch off anything they do not need. Only pages their role already allows are listed - this can narrow
            their menu, never widen it.
          </DialogDescription>
        </DialogHeader>

        {user?.role === 'VIEWER' && (
          <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              A viewer is read-only everywhere and <strong>never sees a lead&rsquo;s e-mail or phone number</strong> -
              not on screen, not in the data behind it. That holds whatever you switch on here.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between rounded-xl border p-3">
          <p className="text-sm">
            <span className="font-semibold">{onCount}</span> of {optional.length} optional pages on
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAllowed(new Set(pages.map((p) => p.path)))}
              disabled={allOn}
            >
              Select all
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAllowed(new Set(pages.filter((p) => p.locked).map((p) => p.path)))}
              disabled={onCount === 0}
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {groups.map(([group, items]) => (
            <div key={group}>
              <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">{group}</p>
              <div className="mt-2 space-y-1">
                {items.map((p) => (
                  <label
                    key={p.path}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                      p.locked ? 'bg-muted/40' : 'cursor-pointer hover:bg-muted/40'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {p.locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                      {p.label}
                      {p.locked && <span className="text-[11px] text-muted-foreground">always on</span>}
                    </span>
                    <Switch
                      checked={p.locked || allowed.has(p.path)}
                      disabled={p.locked}
                      onCheckedChange={(v) => toggle(p.path, v)}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
          {!pages.length && (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading the menu…</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" /> Cancel
          </Button>
          <Button variant="gradient" onClick={() => save.mutate()} disabled={save.isPending || !pages.length}>
            <Check className="h-4 w-4" /> Save menu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
