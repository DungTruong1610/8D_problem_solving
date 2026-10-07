import { useState } from 'react';
import { AlertCircle, CheckCircle2, Download, RotateCcw } from 'lucide-react';
import { Button, cn } from '@cnma/react-ui';
import {
    QUADRANT_TIPS,
    SANDBOX_INITIAL_JSON,
    SCHEMA_FIELDS,
    STANDARD_TEST_CASE_TEMPLATE,
    type FieldRequirement,
} from '../guide-data';
import { CopyButton, GuideCard, TabIntro } from '../guide-ui';

const TEMPLATE_TEXT = JSON.stringify(STANDARD_TEST_CASE_TEMPLATE, null, 2);
const SANDBOX_TEXT = JSON.stringify(SANDBOX_INITIAL_JSON, null, 2);

interface ValidationResult {
    isValid: boolean;
    category?: string;
    message: string;
    missingFields: string[];
}

function validatePayload(text: string): ValidationResult {
    let parsed: any;
    try {
        parsed = JSON.parse(text);
    } catch (err: any) {
        return { isValid: false, message: `Invalid JSON: ${err.message}`, missingFields: [] };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { isValid: false, message: 'The payload must be a JSON object.', missingFields: [] };
    }

    const missing: string[] = [];
    if (!parsed.notificationId) missing.push('notificationId');
    if (!parsed.symptomShortText) missing.push('symptomShortText');
    if (!(parsed.materialId || parsed.material?.materialId)) missing.push('material.materialId');
    if (!(parsed.workCenterId || parsed.workCenter?.workCenterId)) missing.push('workCenter.workCenterId');

    let category = 'Happy path';
    if (parsed.invoiceId || parsed.amountVnd || parsed.department === 'Finance & Accounting') {
        category = 'Out of domain (not a manufacturing defect)';
    } else if (parsed.workCenter?.workCenterId === 'WC-WELD-11' || parsed.symptomShortText?.toLowerCase().includes('laser')) {
        category = 'Safe refusal';
    } else if (parsed.symptomShortText?.includes('Grat') || parsed.symptomShortText?.includes(',')) {
        category = 'Dirty data';
    } else if (parsed.causesIshikawa?.some((c: any) => c.category === 'Man') && parsed.inspections?.length > 0) {
        category = 'Bias hunter';
    }

    return missing.length > 0
        ? { isValid: false, category, message: `Missing ${missing.length} required field${missing.length > 1 ? 's' : ''}.`, missingFields: missing }
        : { isValid: true, category, message: 'All required fields are present.', missingFields: [] };
}

function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE_TEXT], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'test-case-template-8D.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

const REQUIREMENT_STYLE: Record<FieldRequirement, string> = {
    Required: 'bg-red-500/10 text-red-700 dark:text-red-300',
    Recommended: 'bg-primary/10 text-primary',
    Optional: 'bg-muted text-muted-foreground',
};

export function TestCaseTab() {
    const [jsonInput, setJsonInput] = useState(SANDBOX_TEXT);
    const [result, setResult] = useState<ValidationResult | null>(null);

    return (
        <div className="space-y-5">
            <TabIntro
                title="Test case format"
                description="Start from the template, then check your own JSON before running it."
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Template */}
                <GuideCard className="flex min-w-0 flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-foreground">Template</h3>
                        <div className="flex items-center gap-2">
                            <CopyButton text={TEMPLATE_TEXT} />
                            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
                                <Download className="size-3.5" />
                                Download
                            </Button>
                        </div>
                    </div>
                    <pre className="h-80 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100">
                        <code>{TEMPLATE_TEXT}</code>
                    </pre>
                </GuideCard>

                {/* Validator */}
                <GuideCard className="flex min-w-0 flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-foreground">Validate your JSON</h3>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => { setJsonInput(SANDBOX_TEXT); setResult(null); }}
                            >
                                <RotateCcw className="size-3.5" />
                                Reset
                            </Button>
                            <Button type="button" size="sm" onClick={() => setResult(validatePayload(jsonInput))}>
                                Validate
                            </Button>
                        </div>
                    </div>
                    <textarea
                        value={jsonInput}
                        onChange={(e) => { setJsonInput(e.target.value); setResult(null); }}
                        spellCheck={false}
                        wrap="off"
                        className="h-80 w-full resize-none rounded-lg border bg-muted/30 p-4 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Paste a test case JSON here…"
                    />
                    {result && (
                        <div
                            className={cn(
                                'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm',
                                result.isValid
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                                    : 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200',
                            )}
                        >
                            {result.isValid ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
                            <div className="min-w-0 space-y-0.5">
                                <p className="font-medium">{result.message}</p>
                                {result.missingFields.length > 0 && (
                                    <p className="font-mono text-xs">{result.missingFields.join(' · ')}</p>
                                )}
                                {result.category && <p className="text-xs opacity-80">Detected scenario: {result.category}</p>}
                            </div>
                        </div>
                    )}
                </GuideCard>
            </div>

            {/* Field reference */}
            <GuideCard className="p-0">
                <div className="border-b px-5 py-3.5">
                    <h3 className="text-sm font-semibold text-foreground">Field reference</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-xs text-muted-foreground">
                            <tr className="border-b">
                                <th className="px-5 py-2.5 font-medium">Field</th>
                                <th className="px-5 py-2.5 font-medium">Status</th>
                                <th className="px-5 py-2.5 font-medium">Type</th>
                                <th className="px-5 py-2.5 font-medium">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {SCHEMA_FIELDS.map((field) => (
                                <tr key={field.name}>
                                    <td className="whitespace-nowrap px-5 py-2.5 font-mono text-xs font-semibold text-foreground">{field.name}</td>
                                    <td className="px-5 py-2.5">
                                        <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', REQUIREMENT_STYLE[field.requirement])}>
                                            {field.requirement}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-2.5 font-mono text-xs text-muted-foreground">{field.type}</td>
                                    <td className="px-5 py-2.5 text-muted-foreground">{field.note}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </GuideCard>

            {/* Scenario tips */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {QUADRANT_TIPS.map((tip) => (
                    <GuideCard key={tip.id} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">{tip.id}</span>
                            <h4 className="text-sm font-semibold text-foreground">{tip.title}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground">{tip.hint}</p>
                    </GuideCard>
                ))}
            </div>
        </div>
    );
}
