'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Radar, Plus, MapPin, Sparkles, AlertTriangle, Play, Pause, Trash2,
  Store, Inbox, Flame, Globe2, Calendar, ChevronRight, Wand2,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { TableSkeleton } from '@/components/shared/data-table';
import { WorkspaceRequiredNotice, useWorkspaceRequired } from '@/components/shared/workspace-required';
import { formatDate, cn } from '@/lib/utils';

type ServiceType = { id: string; label: string };

interface CampaignForm {
  name: string;
  description: string;
  serviceTypes: string[];
  businessCategories: string;
  locations: string;
  regionCode: string;
  maxResultsPerRun: number;
  onlyNewListings: boolean;
  maxReviewCount: number;
  newListingMaxAgeDays: number;
  requireNoWebsite: boolean;
  requirePhone: boolean;
  aiEnabled: boolean;
  minScore: number;
  generateOutreach: boolean;
  scheduleMode: 'manual' | 'daily' | 'weekly';
  autoImport: boolean;
}

const emptyForm: CampaignForm = {
  name: '',
  description: '',
  serviceTypes: ['website', 'mobile_app'],
  businessCategories: '',
  locations: '',
  regionCode: 'IN',
  maxResultsPerRun: 60,
  onlyNewListings: true,
  maxReviewCount: 15,
  newListingMaxAgeDays: 365,
  requireNoWebsite: false,
  requirePhone: true,
  aiEnabled: true,
  minScore: 40,
  generateOutreach: true,
  scheduleMode: 'manual',
  autoImport: false,
};

const splitList = (value: string) =>
  value
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter(Boolean);

export default function AiAutomationPage() {
  const queryClient = useQueryClient();
  const needsWorkspace = useWorkspaceRequired();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CampaignForm>({ ...emptyForm });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [preview, setPreview] = useState<string[] | null>(null);

  const set = <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const { data: sourcesData } = useQuery({
    queryKey: ['ai-automation-sources'],
    queryFn: () => api.get<any>('/lead-automation/sources'),
  });
  const sources = sourcesData?.data?.sources || sourcesData?.sources || [];
  const serviceTypes: ServiceType[] = sourcesData?.data?.serviceTypes || sourcesData?.serviceTypes || [];
  const mapsConfigured = sources.find((s: any) => s.id === 'google_maps')?.configured;

  const { data, isLoading } = useQuery({
    queryKey: ['ai-automation-campaigns'],
    queryFn: () => api.get<any>('/lead-automation/campaigns', { page: 1, limit: 50 }),
  });
  const campaigns: any[] = data?.data?.data || data?.data || [];

  const { data: statsData } = useQuery({
    queryKey: ['ai-automation-stats'],
    queryFn: () => api.get<any>('/lead-automation/prospects/stats'),
  });
  const stats = statsData?.data || statsData || {};

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/lead-automation/campaigns', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-automation-campaigns'] });
      setShowCreate(false);
      setForm({ ...emptyForm });
      setPreview(null);
      toast.success('Campaign created');
    },
    onError: (err: any) => toast.error(err?.message || 'Could not create campaign'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/lead-automation/campaigns/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-automation-campaigns'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/lead-automation/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-automation-campaigns'] });
      setDeleteTarget(null);
      toast.success('Campaign deleted');
    },
    onError: (err: any) => toast.error(err?.message || 'Delete failed'),
  });

  const previewMutation = useMutation({
    mutationFn: (body: any) => api.post<any>('/lead-automation/preview-queries', body),
    onSuccess: (res: any) => setPreview(res?.data?.queries || res?.queries || []),
    onError: (err: any) => toast.error(err?.message || 'Preview failed'),
  });

  const canSubmit = useMemo(
    () =>
      form.name.trim().length > 1 &&
      (splitList(form.businessCategories).length > 0 || form.serviceTypes.length > 0),
    [form],
  );

  const buildPayload = () => ({
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    serviceTypes: form.serviceTypes,
    businessCategories: splitList(form.businessCategories),
    locations: splitList(form.locations),
    regionCode: form.regionCode.toUpperCase().slice(0, 2),
    maxResultsPerRun: Number(form.maxResultsPerRun) || 60,
    autoImport: form.autoImport,
    filters: {
      onlyNewListings: form.onlyNewListings,
      maxReviewCount: Number(form.maxReviewCount) || 0,
      newListingMaxAgeDays: Number(form.newListingMaxAgeDays) || 0,
      requireNoWebsite: form.requireNoWebsite,
      requirePhone: form.requirePhone,
    },
    aiQualification: {
      enabled: form.aiEnabled,
      minScore: Number(form.minScore) || 0,
      generateOutreach: form.generateOutreach,
    },
    schedule: { mode: form.scheduleMode },
  });

  const toggleService = (id: string) =>
    setForm((f) => ({
      ...f,
      serviceTypes: f.serviceTypes.includes(id)
        ? f.serviceTypes.filter((s) => s !== id)
        : [...f.serviceTypes, id],
    }));

  return (
    <div>
      <PageHeader
        icon={Radar}
        eyebrow="Admin only"
        title="AI Automation"
        description="Find newly listed businesses on Google Maps, let AI score them for fit, and verify each one against its real listing before you reach out."
        actions={
          <Button onClick={() => setShowCreate(true)} disabled={!mapsConfigured || needsWorkspace}>
            <Plus className="mr-2 h-4 w-4" />
            New campaign
          </Button>
        }
      />

      {needsWorkspace && <WorkspaceRequiredNotice feature="AI Automation" />}

      {mapsConfigured === false && (
        <Card className="mb-6 flex items-start gap-3 border-amber-500/30 bg-amber-500/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm">
            <p className="font-semibold">Google Places API key missing</p>
            <p className="mt-1 text-muted-foreground">
              Add <code className="rounded bg-muted px-1 py-0.5 text-xs">GOOGLE_PLACES_API_KEY</code> to{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">apps/api/.env</code> and restart the API.
              Enable <strong>Places API (New)</strong> on the Google Cloud project with billing on — campaigns
              cannot run without it.
            </p>
          </div>
        </Card>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Prospects found" value={stats.total ?? 0} icon={Store} tone="primary" />
        <StatCard
          title="Awaiting review"
          value={stats.pending ?? 0}
          icon={Inbox}
          tone="warning"
          description="Verify, then import"
        />
        <StatCard
          title="Newly listed"
          value={stats.newListings ?? 0}
          icon={Sparkles}
          tone="violet"
          description="Recently added to Maps"
        />
        <StatCard
          title="No website"
          value={stats.noWebsite ?? 0}
          icon={Globe2}
          tone="success"
          description="Strongest buying signal"
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Radar}
          title="No campaigns yet"
          description="A campaign is a set of business categories and cities to sweep on Google Maps. Create one to start collecting prospects."
          actionLabel={mapsConfigured && !needsWorkspace ? 'Create campaign' : undefined}
          onAction={mapsConfigured && !needsWorkspace ? () => setShowCreate(true) : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <Card key={campaign._id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/ai-automation/${campaign._id}`}
                    className="font-semibold hover:text-primary truncate block"
                  >
                    {campaign.name}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {campaign.description || `${(campaign.businessCategories || []).slice(0, 3).join(', ') || 'AI-picked categories'}`}
                  </p>
                </div>
                <Badge variant={campaign.status === 'active' ? 'success' : 'secondary'} dot>
                  {campaign.status}
                </Badge>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {(campaign.locations || []).slice(0, 3).map((loc: string) => (
                  <Badge key={loc} variant="outline" className="gap-1">
                    <MapPin className="h-3 w-3" />
                    {loc}
                  </Badge>
                ))}
                {(campaign.locations || []).length > 3 && (
                  <Badge variant="outline">+{campaign.locations.length - 3}</Badge>
                )}
                {campaign.schedule?.mode !== 'manual' && (
                  <Badge variant="info" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    {campaign.schedule?.mode}
                  </Badge>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-center">
                <div>
                  <p className="text-lg font-bold tabular">{campaign.stats?.totalNew ?? 0}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Found</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular text-amber-600 dark:text-amber-400">
                    {campaign.pendingCount ?? 0}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">To review</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular text-emerald-600 dark:text-emerald-400">
                    {campaign.stats?.totalImported ?? 0}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Imported</p>
                </div>
              </div>

              {campaign.lastError && (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  {campaign.lastError}
                </p>
              )}

              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <span className="text-[11px] text-muted-foreground">
                  {campaign.lastRunAt ? `Last run ${formatDate(campaign.lastRunAt)}` : 'Never run'}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      toggleMutation.mutate({
                        id: campaign._id,
                        status: campaign.status === 'active' ? 'paused' : 'active',
                      })
                    }
                    title={campaign.status === 'active' ? 'Pause' : 'Activate'}
                  >
                    {campaign.status === 'active' ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(campaign)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                  <Link href={`/dashboard/ai-automation/${campaign._id}`}>
                    <Button variant="outline" size="sm">
                      Open
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create campaign */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New prospecting campaign</DialogTitle>
            <DialogDescription>
              Google gives no &quot;listing created&quot; date, so a listing counts as new when it has few
              reviews, its oldest review is recent, or this workspace has never seen it before.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Campaign name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="New gyms & clinics — Jaipur"
                />
              </div>
              <div className="space-y-2">
                <Label>Country code</Label>
                <Input
                  value={form.regionCode}
                  onChange={(e) => set('regionCode', e.target.value.toUpperCase())}
                  placeholder="IN"
                  maxLength={2}
                />
                <p className="text-xs text-muted-foreground">
                  ISO code — IN, US, GB, AE, AU, CA. It is added to every search and any result
                  from another country is dropped.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>What are you selling?</Label>
              <div className="flex flex-wrap gap-1.5">
                {serviceTypes.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => toggleService(service.id)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      form.serviceTypes.includes(service.id)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40',
                    )}
                  >
                    {service.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Drives the search terms and how the AI judges fit.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Business categories</Label>
                <Textarea
                  rows={3}
                  value={form.businessCategories}
                  onChange={(e) => set('businessCategories', e.target.value)}
                  placeholder="gym, dental clinic, boutique"
                />
                <p className="text-xs text-muted-foreground">
                  Comma separated. Leave empty and AI will pick the categories most likely to buy.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Locations</Label>
                <Textarea
                  rows={3}
                  value={form.locations}
                  onChange={(e) => set('locations', e.target.value)}
                  placeholder="Jaipur, Udaipur, Kota"
                />
                <p className="text-xs text-muted-foreground">Each category is searched in each location.</p>
              </div>
            </div>

            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  previewMutation.mutate({
                    serviceTypes: form.serviceTypes,
                    businessCategories: splitList(form.businessCategories),
                    locations: splitList(form.locations),
                    regionCode: form.regionCode.toUpperCase().slice(0, 2),
                  })
                }
                disabled={previewMutation.isPending}
              >
                <Wand2 className="mr-2 h-4 w-4" />
                {previewMutation.isPending ? 'Building…' : 'Preview search queries'}
              </Button>
              {preview && (
                <div className="mt-3 rounded-lg border bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-semibold">
                    {preview.length} Google Maps {preview.length === 1 ? 'query' : 'queries'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.slice(0, 24).map((q) => (
                      <Badge key={q} variant="secondary" className="font-normal">
                        {q}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-semibold">What counts as a lead</p>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm">Only newly listed businesses</Label>
                  <p className="text-xs text-muted-foreground">Skip established listings entirely.</p>
                </div>
                <Switch
                  checked={form.onlyNewListings}
                  onCheckedChange={(v) => set('onlyNewListings', v)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm">Max reviews</Label>
                  <Input
                    type="number"
                    min={0}
                    max={500}
                    value={form.maxReviewCount}
                    onChange={(e) => set('maxReviewCount', Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">0 = ignore review count.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Oldest review within (days)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={3650}
                    value={form.newListingMaxAgeDays}
                    onChange={(e) => set('newListingMaxAgeDays', Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">0 = skip the (pricier) review lookup.</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm">Only businesses without a website</Label>
                  <p className="text-xs text-muted-foreground">
                    The strongest signal that they need web or app work.
                  </p>
                </div>
                <Switch
                  checked={form.requireNoWebsite}
                  onCheckedChange={(v) => set('requireNoWebsite', v)}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm">Must have a phone number</Label>
                  <p className="text-xs text-muted-foreground">No phone means nobody to call.</p>
                </div>
                <Switch checked={form.requirePhone} onCheckedChange={(v) => set('requirePhone', v)} />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">AI qualification</p>
                  <p className="text-xs text-muted-foreground">
                    Scores fit, names the service to pitch and drafts a first line.
                  </p>
                </div>
                <Switch checked={form.aiEnabled} onCheckedChange={(v) => set('aiEnabled', v)} />
              </div>

              {form.aiEnabled && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm">Minimum score</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={form.minScore}
                      onChange={(e) => set('minScore', Number(e.target.value))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 pt-7">
                    <Label className="text-sm">Draft outreach message</Label>
                    <Switch
                      checked={form.generateOutreach}
                      onCheckedChange={(v) => set('generateOutreach', v)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Schedule</Label>
                <Select
                  value={form.scheduleMode}
                  onValueChange={(v) => set('scheduleMode', v as CampaignForm['scheduleMode'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual only</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Max prospects per run</Label>
                <Input
                  type="number"
                  min={5}
                  max={200}
                  value={form.maxResultsPerRun}
                  onChange={(e) => set('maxResultsPerRun', Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Caps your Google Places spend per run.</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
              <div>
                <Label className="text-sm">Import straight into Leads</Label>
                <p className="text-xs text-muted-foreground">
                  Off by default — reviewing first keeps the pipeline clean.
                </p>
              </div>
              <Switch checked={form.autoImport} onCheckedChange={(v) => set('autoImport', v)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(buildPayload())}
              disabled={!canSubmit || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating…' : 'Create campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete campaign?</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.name}&quot; stops running. Prospects it already collected stay where they
              are.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(deleteTarget._id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
