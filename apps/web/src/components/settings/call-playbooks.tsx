'use client';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LEAD_STATUSES, statusLabel } from '@/lib/pipeline';
import type { CallPlaybook } from '@/types';

const REASONS = ['new_lead', 'retry', 'callback', 'reengage', 'bulk_import', 'manual', 'workflow'];

const emptyPlaybook = (): CallPlaybook => ({
  name: '',
  enabled: true,
  match: { sources: [], tags: [], statuses: [], reasons: [] },
  agentName: '',
  language: '',
  firstMessage: '',
  instructions: '',
});

const listToText = (v: string[]) => v.join(', ');
const textToList = (v: string) => v.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

function Chips({ options, value, onChange, labelOf }: { options: string[]; value: string[]; onChange: (v: string[]) => void; labelOf?: (o: string) => string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${on ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'}`}
          >
            {labelOf ? labelOf(o) : o.replace(/_/g, ' ')}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Lead-type scripts: "for leads from the widget, be X and open with Y".
 * The first enabled playbook whose filters all match the lead is used.
 */
export function CallPlaybooksEditor({ value, onChange }: { value: CallPlaybook[]; onChange: (v: CallPlaybook[]) => void }) {
  const update = (i: number, patch: Partial<CallPlaybook>) => onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const updateMatch = (i: number, patch: Partial<CallPlaybook['match']>) => update(i, { match: { ...value[i].match, ...patch } });

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No playbooks yet — every lead gets the default script above. Add one to treat, say, <em>Google Maps prospects</em> or <em>re-engagement calls</em> differently.
        </p>
      )}
      {value.map((p, i) => (
        <div key={i} className="space-y-3 rounded-xl border bg-muted/20 p-4">
          <div className="flex items-center gap-3">
            <BookOpen className="h-4 w-4 text-primary" />
            <Input className="h-9 flex-1" value={p.name} placeholder="Playbook name, e.g. Google Maps prospects" onChange={(e) => update(i, { name: e.target.value })} />
            <Label className="text-xs">On</Label>
            <Switch checked={p.enabled} onCheckedChange={(v) => update(i, { enabled: v })} />
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-rose-600" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove playbook"><Trash2 className="h-4 w-4" /></Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Applies to leads from sources <span className="text-muted-foreground">(comma; empty = any)</span></Label>
              <Input className="h-9" value={listToText(p.match.sources)} placeholder="widget, import, google_maps" onChange={(e) => updateMatch(i, { sources: textToList(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">…with any of these tags <span className="text-muted-foreground">(comma; empty = any)</span></Label>
              <Input className="h-9" value={listToText(p.match.tags)} placeholder="vip, real-estate" onChange={(e) => updateMatch(i, { tags: textToList(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">…in these stages</Label>
              <Chips options={[...LEAD_STATUSES]} value={p.match.statuses} onChange={(v) => updateMatch(i, { statuses: v })} labelOf={statusLabel} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">…for these call reasons</Label>
              <Chips options={REASONS} value={p.match.reasons} onChange={(v) => updateMatch(i, { reasons: v })} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Agent name <span className="text-muted-foreground">(optional)</span></Label>
              <Input className="h-9" value={p.agentName} placeholder="default" onChange={(e) => update(i, { agentName: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Language</Label>
              <Select value={p.language || 'default'} onValueChange={(v) => update(i, { language: (v === 'default' ? '' : v) as CallPlaybook['language'] })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="hi-en">Hinglish</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-3">
              <Label className="text-xs">Opening line <span className="text-muted-foreground">(optional — {'{{leadName}} {{agentName}} {{companyName}}'})</span></Label>
              <Input className="h-9" value={p.firstMessage} placeholder="Keep the default" onChange={(e) => update(i, { firstMessage: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-3">
              <Label className="text-xs">How to handle these leads</Label>
              <Textarea rows={3} value={p.instructions} placeholder="These are newly listed businesses without a website. Lead with the free consultation, keep it under 3 minutes, and aim for a WhatsApp follow-up rather than a meeting." onChange={(e) => update(i, { instructions: e.target.value })} />
            </div>
          </div>
        </div>
      ))}
      {value.length < 20 && (
        <Button variant="outline" size="sm" onClick={() => onChange([...value, emptyPlaybook()])}><Plus className="h-4 w-4" /> Add playbook</Button>
      )}
    </div>
  );
}
