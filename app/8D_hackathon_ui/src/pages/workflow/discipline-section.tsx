import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Badge, Button, Card, CardContent, CardHeader,
    Label, Spinner, Switch, Textarea,
} from '@cnma/react-ui';
import {
    LayoutTemplate, MessageSquareCode, ShieldAlert, Save, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { updateStepPrompt, resetRetrievalConfig, type StepPrompt } from '@/services/retrieval-service';
import { ConstraintsEditor } from '../ai-settings/step-prompt-editor/ConstraintsEditor';
import { FormMappingEditor } from '../ai-settings/step-prompt-editor/FormMappingEditor';
import { normalizeFormSchema, parseConfig, stringifyConfig } from '../ai-settings/step-prompt-editor/json';
import { RawConfigEditor } from '../ai-settings/step-prompt-editor/RawConfigEditor';
import { StepEditorTabNavigation, type StepEditorTab } from '../ai-settings/step-prompt-editor/StepEditorTabNavigation';
import { StepObjectSchemaEditor } from '../object-schema/StepObjectSchemaEditor';
import type { ConstraintsConfig, FormSchemaConfig } from '../ai-settings/step-prompt-editor/types';

type ConfigField = 'combinedPrompt' | 'formSchemaJson' | 'constraintsJson';
const CONFIG_FIELDS: ConfigField[] = ['combinedPrompt', 'formSchemaJson', 'constraintsJson'];

const FALLBACK_STEP_PROMPTS: Record<string, Partial<StepPrompt>> = {
    D1: {
        stepCode: 'D1',
        label: 'Establish the Team',
        description: 'Suggest roles and people from the teams of matching precedent cases.',
        systemPrompt: `Name the leader and members with their functions. Explain in one or two sentences why this mix of skills suits this specific defect.\n\nWhen no team is recorded on this case, do NOT fall back to generic job titles. Propose the actual people from the precedent teams, by name and function.`,
        combinedPrompt: `Extract the official team leader and members with their functions.\nExplain why the skill mix is appropriate for this problem.\nWhen official team data is missing, recommend people only from matching precedent cases and cite precedents#N.\nWhen neither current team data nor precedents exist, state that manual assignment is required.`,
        inputSchemaJson: JSON.stringify({
            type: 'object',
            properties: {
                teamMembers: { type: 'array', title: 'Team members', description: 'Official team leader and members from the current case.', 'x-source': 'sap_qm', items: { type: 'object', properties: {} } },
                teamSize: { type: 'number', title: 'Team size', description: 'Calculated number of current team members.', 'x-source': 'ai_enrichment' },
                precedentTeams: { type: 'array', title: 'Precedent teams', description: 'Teams from similar completed 8D cases.', 'x-source': 'vector_search', items: { type: 'object', properties: {} } },
            },
            required: [],
            additionalProperties: false,
        }, null, 2),
        formSchemaJson: JSON.stringify({
            fields: [
                { key: 'content', label: 'D1 team recommendation', widget: 'textarea', width: '100%', constraints: { required: true, minLength: 20, maxLength: 1000 } },
                { key: 'sources', label: 'Evidence sources', widget: 'tag-selector', width: '100%', constraints: { pattern: '^(team\\.|precedents#)' } },
                { key: 'confidence', label: 'Confidence', widget: 'input', width: '50%', constraints: { min: 0, max: 100 } },
                { key: 'dataBacked', label: 'Data backed', widget: 'checkbox', width: '50%', constraints: {} },
            ],
            groups: [{ id: 'team', label: 'Team assignment', fieldKeys: ['content', 'sources', 'confidence', 'dataBacked'], width: '100', columns: 2, order: 10 }],
        }, null, 2),
        constraintsJson: JSON.stringify({
            enabled: true,
            rules: [
                { id: 'D1_GROUNDING', name: 'Ground team identities', type: 'sourcePattern', severity: 'error', enabled: true, pattern: '^(team\\.|precedents#)', message: 'Team names must come from the current team or a cited precedent.' },
                { id: 'D1_DATA_BACKED', name: 'Correct data-backed flag', type: 'dataBackedWhenInputPresent', severity: 'warning', enabled: true, inputFields: ['teamMembers', 'precedentTeams'], message: 'Set dataBacked to false when current and precedent team data are both empty.' },
            ],
        }, null, 2),
        enabled: true,
        version: 1,
    },
    D2: {
        stepCode: 'D2',
        label: 'Describe the Problem',
        description: 'Draft the problem paragraph and the 5W2H grid from verified case facts.',
        systemPrompt: `Write 5W2H: what, where, when, who, why it matters, how, how many. Quantify with measured vs specification values and the extent affected. Use the Is / Is-Not comparison to bound the problem.`,
        combinedPrompt: `Describe the problem with verified 5W2H facts.\nQuantify measured-versus-specification differences when values exist.\nUse Is/Is-Not boundaries and cite every factual statement.\nDo not invent missing measurements or locations.`,
        inputSchemaJson: JSON.stringify({ type: 'object', properties: {
            header: { type: 'object', title: 'Case header', 'x-source': 'sap_qm', properties: {} },
            product: { type: 'object', title: 'Material and product', 'x-source': 'sap_qm', properties: {} },
            defect: { type: 'object', title: 'Defect details', 'x-source': 'sap_qm', properties: {} },
            inspections: { type: 'array', title: 'Inspection results', 'x-source': 'sap_qm', items: { type: 'object', properties: {} } },
            isIsNot: { type: 'object', title: 'Is / Is-Not analysis', 'x-source': 'manual_input', properties: {} },
            derivedFacts: { type: 'array', title: 'Derived facts', 'x-source': 'ai_enrichment', items: { type: 'string' } },
        }, required: [], additionalProperties: false }, null, 2),
        formSchemaJson: JSON.stringify({ fields: [
            { key: 'summary', label: 'Problem summary', widget: 'textarea', width: '100%', constraints: { required: true, minLength: 20, maxLength: 500 } },
            { key: 'content', label: '5W2H and Is / Is-Not analysis', widget: 'textarea', width: '100%', constraints: { required: true, minLength: 50, maxLength: 2000 } },
            { key: 'sources', label: 'Evidence sources', widget: 'tag-selector', width: '100%', constraints: {} },
            { key: 'confidence', label: 'Confidence', widget: 'input', width: '50%', constraints: { min: 0, max: 1 } },
            { key: 'dataBacked', label: 'Data backed', widget: 'checkbox', width: '50%', constraints: {} },
        ], groups: [{ id: 'problem', label: 'Problem description', fieldKeys: ['summary', 'content', 'sources', 'confidence', 'dataBacked'], width: '100', columns: 2, order: 10 }] }, null, 2),
        constraintsJson: JSON.stringify({ enabled: true, rules: [
            { id: 'D2_CITATIONS', name: 'Require factual citations', type: 'citationRequired', severity: 'error', enabled: true, message: 'Measured values and verified facts require sources.' },
            { id: 'D2_SOURCES', name: 'Use problem evidence', type: 'sourcePattern', severity: 'warning', enabled: true, pattern: '^(header|product|defect|inspections|isIsNot|derivedFacts)', message: 'D2 sources must resolve to problem evidence.' },
        ] }, null, 2),
        enabled: true,
        version: 1,
    },
    D3: {
        stepCode: 'D3',
        label: 'Interim Containment Actions',
        description: 'Surface containment actions, or reuse the top precedent when none exist yet.',
        systemPrompt: `Report the containment actions on record with their status. Explain what each one protects and what residual exposure remains. If the case is a customer complaint, address material already at the customer.`,
        combinedPrompt: `List immediate containment actions with owner and status when recorded.\nExplain how each action protects the customer or process.\nIf no current action exists, present precedent actions only as proposals and cite precedents#N.\nClearly distinguish recorded actions from recommendations.`,
        inputSchemaJson: JSON.stringify({ type: 'object', properties: {
            actions: { type: 'object', title: 'Current actions', 'x-source': 'sap_qm', properties: {} },
            customer: { type: 'object', title: 'Customer impact', 'x-source': 'sap_qm', properties: {} },
            precedents: { type: 'array', title: 'Precedent actions', 'x-source': 'vector_search', items: { type: 'object', properties: {} } },
        }, required: [], additionalProperties: false }, null, 2),
        formSchemaJson: JSON.stringify({ fields: [
            { key: 'summary', label: 'Containment summary', widget: 'textarea', width: '100%', constraints: { required: true, maxLength: 500 } },
            { key: 'content', label: 'Containment action analysis', widget: 'textarea', width: '100%', constraints: { required: true, minLength: 20, maxLength: 2000 } },
            { key: 'actionItems', label: 'Recommended follow-up actions', widget: 'multiSelect', width: '100%', constraints: {} },
            { key: 'sources', label: 'Evidence sources', widget: 'tag-selector', width: '100%', constraints: {} },
            { key: 'confidence', label: 'Confidence', widget: 'input', width: '50%', constraints: { min: 0, max: 1 } },
            { key: 'dataBacked', label: 'Data backed', widget: 'checkbox', width: '50%', constraints: {} },
        ], groups: [{ id: 'containment', label: 'Interim containment', fieldKeys: ['summary', 'content', 'actionItems', 'sources', 'confidence', 'dataBacked'], width: '100', columns: 2, order: 10 }] }, null, 2),
        constraintsJson: JSON.stringify({ enabled: true, rules: [
            { id: 'D3_SOURCES', name: 'Ground containment actions', type: 'sourcePattern', severity: 'error', enabled: true, pattern: '^(actions\.containment|customer|precedents#)', message: 'Containment actions must be recorded actions or cited proposals.' },
            { id: 'D3_DATA_BACKED', name: 'Correct data-backed flag', type: 'dataBackedWhenInputPresent', severity: 'warning', enabled: true, inputFields: ['actions', 'precedents'], message: 'Set dataBacked false when neither current nor precedent actions exist.' },
        ] }, null, 2),
        enabled: true,
        version: 1,
    },
    D4: {
        stepCode: 'D4',
        label: 'Root Cause Analysis',
        description: 'Walk the 5-Why chain and weigh it against the independent diagnosis.',
        systemPrompt: `The most important discipline. Walk the 5-Why chain step by step, citing the evidence at each step. Then state the confirmed Ishikawa category and why the other five categories were ruled out.`,
        combinedPrompt: `Walk the recorded 5-Why chain and evaluate Ishikawa 6M evidence.\nState the confirmed root cause only when supported by evidence.\nInclude an Independent verification section that reports agreement or disagreement with the blind diagnosis.\nTreat precedent root causes as hypotheses, never as facts for this case.`,
        inputSchemaJson: JSON.stringify({ type: 'object', properties: {
            fiveWhy: { type: 'array', title: '5-Why chain', 'x-source': 'sap_qm', items: { type: 'object', properties: {} } },
            ishikawa: { type: 'array', title: 'Ishikawa findings', 'x-source': 'sap_qm', items: { type: 'object', properties: {} } },
            rootCause: { type: 'object', title: 'Recorded root cause', 'x-source': 'sap_qm', properties: {} },
            independent: { type: 'object', title: 'Independent diagnosis', 'x-source': 'ai_enrichment', properties: {} },
            precedents: { type: 'array', title: 'Precedent root causes', 'x-source': 'vector_search', items: { type: 'object', properties: {} } },
        }, required: [], additionalProperties: false }, null, 2),
        formSchemaJson: JSON.stringify({ fields: [
            { key: 'summary', label: 'Root cause summary', widget: 'textarea', width: '100%', constraints: { required: true, maxLength: 500 } },
            { key: 'content', label: '5-Why, Ishikawa and independent verification', widget: 'textarea', width: '100%', constraints: { required: true, minLength: 50, maxLength: 2500 } },
            { key: 'sources', label: 'Evidence sources', widget: 'tag-selector', width: '100%', constraints: {} },
            { key: 'confidence', label: 'Confidence', widget: 'input', width: '50%', constraints: { min: 0, max: 1 } },
            { key: 'dataBacked', label: 'Data backed', widget: 'checkbox', width: '50%', constraints: {} },
        ], groups: [{ id: 'root-cause', label: 'Root cause analysis', fieldKeys: ['summary', 'content', 'sources', 'confidence', 'dataBacked'], width: '100', columns: 2, order: 10 }] }, null, 2),
        constraintsJson: JSON.stringify({ enabled: true, rules: [
            { id: 'D4_DISCLOSURE', name: 'Independent verification disclosure', type: 'requiredDisclosure', severity: 'error', enabled: true, pattern: 'independent verification', message: 'D4 must disclose agreement or disagreement with the independent diagnosis.' },
            { id: 'D4_SOURCES', name: 'Ground root cause analysis', type: 'sourcePattern', severity: 'error', enabled: true, pattern: '^(fiveWhy|ishikawa|rootCause|independent|precedents#)', message: 'D4 sources must resolve to root-cause evidence.' },
        ] }, null, 2),
        enabled: true,
        version: 1,
    },
    D5: {
        stepCode: 'D5', label: 'Permanent Corrective Actions', description: 'Tie each corrective action to a step of the root cause chain.',
        systemPrompt: `Report the corrective actions on record. For each, state explicitly which step of the D4 chain it addresses. Flag any part of the root cause that no corrective action currently covers.`,
        combinedPrompt: `Report the corrective actions on record.\nFor each, state explicitly which step of the D4 chain it addresses.\nFlag any part of the root cause that no corrective action currently covers.`,
        inputSchemaJson: JSON.stringify({ type: 'object', properties: { actions: { type: 'array', title: 'Actions', 'x-source': 'sap_qm' } } }, null, 2),
        formSchemaJson: JSON.stringify({ fields: [{ key: 'content', label: 'Corrective actions analysis', widget: 'textarea' }] }, null, 2),
        constraintsJson: JSON.stringify({ enabled: true, rules: [] }, null, 2),
        enabled: true, version: 1,
    },
    D6: {
        stepCode: 'D6', label: 'Verify Effectiveness', description: 'Write the verification plan; this dataset carries no verification evidence.',
        systemPrompt: `No data. Write the verification plan: what to measure, over what sample size, across what period, against what acceptance criterion, and who signs it off.`,
        combinedPrompt: `Write a concrete verification plan.\nSpecify metrics, sample size, observation period, and acceptance criteria based on inspection specs.`,
        inputSchemaJson: JSON.stringify({ type: 'object', properties: { inspections: { type: 'array', title: 'Inspections', 'x-source': 'sap_qm' } } }, null, 2),
        formSchemaJson: JSON.stringify({ fields: [{ key: 'content', label: 'Verification plan', widget: 'textarea' }] }, null, 2),
        constraintsJson: JSON.stringify({ enabled: true, rules: [] }, null, 2),
        enabled: true, version: 1,
    },
    D7: {
        stepCode: 'D7', label: 'Prevent Recurrence', description: 'Preventive actions and the FMEA entry to update.',
        systemPrompt: `Report the preventive actions on record and how the FMEA entry should be updated. Where the dataset has no preventive action or no FMEA link, say so and propose what a systemic fix would need to cover.`,
        combinedPrompt: `Report preventive actions and FMEA update requirements.\nHighlight systemic prevention measures.`,
        inputSchemaJson: JSON.stringify({ type: 'object', properties: { fmea: { type: 'object', title: 'FMEA Link', 'x-source': 'sap_qm' } } }, null, 2),
        formSchemaJson: JSON.stringify({ fields: [{ key: 'content', label: 'Preventive actions analysis', widget: 'textarea' }] }, null, 2),
        constraintsJson: JSON.stringify({ enabled: true, rules: [] }, null, 2),
        enabled: true, version: 1,
    },
    D8: {
        stepCode: 'D8', label: 'Closure and Recognition', description: 'Lessons learned and the completeness gate over D1–D7.',
        systemPrompt: `Summarise lessons learned, both what worked and what did not. Recognise the team by name. State what remains open if the case is not yet closed.`,
        combinedPrompt: `Summarise lessons learned and acknowledge team members by name.\nCheck case closure prerequisites.`,
        inputSchemaJson: JSON.stringify({ type: 'object', properties: { lessonsLearned: { type: 'object', title: 'Lessons learned', 'x-source': 'sap_qm' } } }, null, 2),
        formSchemaJson: JSON.stringify({ fields: [{ key: 'content', label: 'Lessons learned and recognition', widget: 'textarea' }] }, null, 2),
        constraintsJson: JSON.stringify({ enabled: true, rules: [] }, null, 2),
        enabled: true, version: 1,
    },
};

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unexpected error';
}

export function DisciplineSection({ stepCode = 'D1', prompt, onReload }: { stepCode?: string; prompt: StepPrompt | null; onReload?: () => void }) {
    const fallback = FALLBACK_STEP_PROMPTS[stepCode] || FALLBACK_STEP_PROMPTS['D1'];
    const activePrompt: StepPrompt = (prompt || fallback) as StepPrompt;

    const [draft, setDraft] = useState<Record<ConfigField, string>>({
        combinedPrompt: '', formSchemaJson: '', constraintsJson: '',
    });
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<StepEditorTab>('schema');

    const loadDraft = useCallback((p: StepPrompt) => setDraft({
        combinedPrompt: p.combinedPrompt ?? p.systemPrompt ?? '',
        formSchemaJson: p.formSchemaJson ?? '',
        constraintsJson: p.constraintsJson ?? '',
    }), []);

    useEffect(() => {
        loadDraft(activePrompt);
    }, [activePrompt, loadDraft]);

    const dirty = CONFIG_FIELDS.some((f) => draft[f] !== (activePrompt[f] ?? (f === 'combinedPrompt' ? activePrompt.systemPrompt : '') ?? ''));


    const form = useMemo(() => {
        const parsed = parseConfig<FormSchemaConfig>(draft.formSchemaJson, { fields: [] });
        return { ...parsed, value: normalizeFormSchema(parsed.value, activePrompt.stepCode) };
    }, [draft.formSchemaJson, activePrompt.stepCode]);

    const constraints = useMemo(() => parseConfig<ConstraintsConfig>(draft.constraintsJson, { enabled: true, rules: [] }), [draft.constraintsJson]);

    const setField = (field: ConfigField, value: string) => setDraft((prev) => ({ ...prev, [field]: value }));

    async function handleSave() {
        if (form.error || constraints.error) {
            toast.error('Fix invalid JSON before saving');
            return;
        }
        setSaving(true);
        try {
            await updateStepPrompt(activePrompt.stepCode, {
                ...draft,
                systemPrompt: draft.combinedPrompt,
                version: (activePrompt.version || 1) + 1,
            });
            toast.success(`${activePrompt.stepCode} configuration saved`);
            if (onReload) onReload();
        } catch (error: unknown) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    }

    async function handleRestore() {
        if (!window.confirm(`Restore only ${activePrompt.stepCode} to the shipped defaults?`)) return;
        setSaving(true);
        try {
            await resetRetrievalConfig(`prompt:${activePrompt.stepCode}`);
            toast.success(`${activePrompt.stepCode} defaults restored`);
            if (onReload) onReload();
        } catch (error: unknown) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-4">
            {/* Header bar with Inline Actions - NO REDIRECT BUTTONS */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-bold text-primary">{activePrompt.stepCode}</span>
                        <h3 className="text-base font-semibold">{activePrompt.label}</h3>
                        <Badge variant="outline" className="font-mono text-sm font-semibold px-2 py-0.5">v{activePrompt.version || 1}</Badge>
                        {dirty && <Badge variant="secondary" className="text-sm font-semibold px-2 py-0.5">Unsaved changes</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{activePrompt.description}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 border-r pr-3 mr-1">
                        <Switch
                            id={`switch-${activePrompt.stepCode}`}
                            checked={activePrompt.enabled !== false}
                            onCheckedChange={async (enabled) => {
                                await updateStepPrompt(activePrompt.stepCode, { enabled });
                                if (onReload) onReload();
                            }}
                        />
                        <Label htmlFor={`switch-${activePrompt.stepCode}`} className="text-sm font-medium cursor-pointer">Enabled</Label>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={handleRestore}
                        className="h-9 text-sm"
                    >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Restore Defaults
                    </Button>

                    <Button
                        size="sm"
                        disabled={!dirty || saving || Boolean(form.error || constraints.error)}
                        onClick={handleSave}
                        className="h-9 text-sm font-semibold"
                    >
                        {saving ? <Spinner className="h-3.5 w-3.5 mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                        Save {activePrompt.stepCode} Configuration
                    </Button>
                </div>
            </div>

            {/* Full Inline Config & Prompt Editor */}
            <Card className="border shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 pb-3 border-b">
                    <StepEditorTabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                    {/* Tab 1: System Prompt */}
                    {activeTab === 'prompt' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <MessageSquareCode className="h-4 w-4 text-primary" />
                                        {activePrompt.stepCode} System Prompt & Agent Guidance
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                        Define the AI reasoning rules and instructions for {activePrompt.label}.
                                    </p>
                                </div>
                                <Badge variant={draft.combinedPrompt.split(/\r?\n/).length > 80 ? 'destructive' : 'secondary'} className="text-xs font-semibold px-2 py-0.5">
                                    {draft.combinedPrompt.split(/\r?\n/).length}/80 lines
                                </Badge>
                            </div>
                            <Textarea
                                className="min-h-80 font-mono text-sm leading-relaxed border bg-background"
                                value={draft.combinedPrompt}
                                onChange={(e) => setField('combinedPrompt', e.target.value)}
                                placeholder="Enter system prompt instructions..."
                            />
                        </div>
                    )}

                    {/* Tab 2: Output Form Mapping */}
                    {activeTab === 'form' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <LayoutTemplate className="h-4 w-4 text-primary" />
                                    Output Form Mapping (What {activePrompt.stepCode} fills in)
                                </h4>
                            </div>
                            {form.error ? (
                                <RawConfigEditor
                                    value={draft.formSchemaJson}
                                    error={form.error}
                                    onChange={(v) => setField('formSchemaJson', v)}
                                />
                            ) : (
                                <FormMappingEditor
                                    stepCode={activePrompt.stepCode}
                                    value={form.value}
                                    onChange={(v) => setField('formSchemaJson', stringifyConfig(v))}
                                />
                            )}
                        </div>
                    )}

                    {/* Object Schema — has its own Save. The header's
                        "Save D… Configuration" covers the prompt tabs only. */}
                    {activeTab === 'schema' && (
                        <div className="-m-4 flex min-h-160 flex-col">
                            <StepObjectSchemaEditor
                                stepCode={activePrompt.stepCode}
                                stepLabel={activePrompt.label}
                            />
                        </div>
                    )}

                    {/* Tab 4: Guardrails & Constraints */}
                    {activeTab === 'constraints' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <ShieldAlert className="h-4 w-4 text-primary" />
                                    Safety Guardrails & Constraints (What {activePrompt.stepCode} may not claim)
                                </h4>
                            </div>
                            {constraints.error ? (
                                <RawConfigEditor
                                    value={draft.constraintsJson}
                                    error={constraints.error}
                                    onChange={(v) => setField('constraintsJson', v)}
                                />
                            ) : (
                                <ConstraintsEditor
                                    stepCode={activePrompt.stepCode}
                                    value={constraints.value}
                                    onChange={(v) => setField('constraintsJson', stringifyConfig(v))}
                                />
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
