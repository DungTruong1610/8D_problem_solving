import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Badge, Button, Card, CardContent, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea } from '@cnma/react-ui';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { EditorModeToolbar } from './EditorModeToolbar';
import type { ConstraintsConfig, StepRule } from './types';

export function ConstraintsEditor({ stepCode, value, onChange }: { stepCode: string; value: ConstraintsConfig; onChange: (value: ConstraintsConfig) => void }) {
    const [selectedId, setSelectedId] = useState(value.rules[0]?.id ?? '');
    const [viewMode, setViewMode] = useState<'form' | 'json'>('form');
    const [jsonText, setJsonText] = useState(() => JSON.stringify(value, null, 2));
    const [jsonError, setJsonError] = useState<string | null>(null);
    const selected = value.rules.find((rule) => rule.id === selectedId) ?? null;
    const update = (patch: Partial<StepRule>) => selected && onChange({ ...value, rules: value.rules.map((rule) => rule.id === selected.id ? { ...rule, ...patch } : rule) });
    const add = () => { const id = `${stepCode}_RULE_${value.rules.length + 1}`; onChange({ ...value, rules: [...value.rules, { id, name: 'New rule', type: 'sourcePattern', severity: 'warning', enabled: true, message: '' }] }); setSelectedId(id); };
    const remove = () => { if (!selected) return; const rules = value.rules.filter((rule) => rule.id !== selected.id); onChange({ ...value, rules }); setSelectedId(rules[0]?.id ?? ''); };

    return <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <div className="flex shrink-0 items-center gap-3 border-b bg-card px-6 py-2"><Switch id="constraints-enabled" checked={value.enabled !== false} onCheckedChange={(enabled) => onChange({ ...value, enabled })} /><div><Label htmlFor="constraints-enabled" className="text-sm font-semibold">Enable {stepCode} constraints</Label><p className="text-sm text-muted-foreground">Rule sets are enforced during post-processing.</p></div></div>
        <div className="shrink-0 px-4 pt-4"><EditorModeToolbar mode={viewMode} onVisual={() => setViewMode('form')} onJson={() => { setJsonText(JSON.stringify(value, null, 2)); setJsonError(null); setViewMode('json'); }} actions={viewMode === 'form' ? <Button size="sm" variant="outline" className="h-9 text-sm font-medium" onClick={add}><Plus className="h-4 w-4" /> Add rule</Button> : undefined} /></div>
        {viewMode === 'json' ? <div className="relative min-h-0 flex-1 overflow-hidden">{jsonError && <p className="absolute bottom-4 right-4 z-10 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">JSON error: {jsonError}</p>}<Editor height="100%" language="json" value={jsonText} onChange={(text) => { const next = text ?? ''; setJsonText(next); try { onChange(JSON.parse(next) as ConstraintsConfig); setJsonError(null); } catch (error) { setJsonError(error instanceof Error ? error.message : 'Invalid JSON'); } }} options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, automaticLayout: true }} /></div> : <>
        <div className="grid min-h-0 flex-1 md:grid-cols-[18rem_1fr]">
            <div className="min-w-0 space-y-2 overflow-y-auto border-r bg-muted/20 p-3">{value.rules.map((rule) => <Button key={rule.id} variant={selectedId === rule.id ? 'secondary' : 'ghost'} className="h-auto min-w-0 w-full justify-start overflow-hidden border p-3 text-left" onClick={() => setSelectedId(rule.id)}><ShieldCheck className="mr-2 h-4 w-4 shrink-0" /><div className="min-w-0 flex-1 overflow-hidden"><p className="truncate text-sm font-semibold">{rule.name ?? rule.id}</p><div className="mt-1 flex min-w-0 flex-wrap gap-1"><Badge variant="outline" className="max-w-full truncate text-xs font-semibold px-2 py-0.5">{rule.type}</Badge><Badge className="shrink-0 text-xs font-semibold px-2 py-0.5" variant={rule.severity === 'error' ? 'destructive' : 'secondary'}>{rule.severity}</Badge></div></div></Button>)}</div>
            <div className="overflow-y-auto p-5">{selected ? <Card><CardContent className="grid gap-4 p-5 md:grid-cols-2">
                <div className="space-y-2"><Label className="text-sm font-semibold">Rule ID</Label><Input className="h-9 text-sm" value={selected.id} onChange={(event) => { const id = event.target.value; onChange({ ...value, rules: value.rules.map((rule) => rule.id === selected.id ? { ...rule, id } : rule) }); setSelectedId(id); }} /></div>
                <div className="space-y-2"><Label className="text-sm font-semibold">Name</Label><Input className="h-9 text-sm" value={selected.name ?? ''} onChange={(event) => update({ name: event.target.value })} /></div>
                <div className="space-y-2"><Label className="text-sm font-semibold">Rule type</Label><Select value={selected.type} onValueChange={(type) => update({ type })}><SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent>{['sourcePattern', 'dataBackedWhenInputPresent', 'requiredDisclosure', 'citationRequired'].map((type) => <SelectItem key={type} value={type} className="text-sm">{type}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label className="text-sm font-semibold">Outcome severity</Label><Select value={selected.severity} onValueChange={(severity) => update({ severity: severity as StepRule['severity'] })}><SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="error" className="text-sm">Error</SelectItem><SelectItem value="warning" className="text-sm">Warning</SelectItem><SelectItem value="info" className="text-sm">Info</SelectItem></SelectContent></Select></div>
                <div className="space-y-2 md:col-span-2"><Label className="text-sm font-semibold">Message</Label><Textarea className="text-sm" value={selected.message} onChange={(event) => update({ message: event.target.value })} /></div>
                {selected.type === 'sourcePattern' && <div className="space-y-2 md:col-span-2"><Label className="text-sm font-semibold">Allowed source pattern</Label><Input className="h-9 font-mono text-sm" value={selected.pattern ?? ''} onChange={(event) => update({ pattern: event.target.value })} /></div>}
                {selected.type === 'dataBackedWhenInputPresent' && <div className="space-y-2 md:col-span-2"><Label className="text-sm font-semibold">Input fields</Label><Input className="h-9 text-sm" value={(selected.inputFields ?? []).join(', ')} onChange={(event) => update({ inputFields: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></div>}
                <div className="flex items-center gap-2"><Switch id="rule-enabled" checked={selected.enabled !== false} onCheckedChange={(enabled) => update({ enabled })} /><Label htmlFor="rule-enabled" className="text-sm font-medium">Rule enabled</Label></div>
                <div className="flex justify-end"><Button variant="ghost" className="h-9 text-sm text-destructive" onClick={remove}><Trash2 className="h-4 w-4" /> Remove rule</Button></div>
            </CardContent></Card> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Add or select a rule.</div>}</div>
        </div></>}
    </div>;
}
