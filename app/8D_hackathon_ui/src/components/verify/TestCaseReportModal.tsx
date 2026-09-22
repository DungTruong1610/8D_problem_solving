import { useState } from 'react';
import {
    CheckCircle2,
    X,
    FileText,
    ExternalLink,
    Copy,
    Check,
    Cpu,
    Database,
    Clock,
    Activity,
    ShieldCheck,
    Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TestCaseSummary } from './test-case-summary-data';

interface TestCaseReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    testCase: TestCaseSummary | null;
}

export function TestCaseReportModal({ isOpen, onClose, testCase }: TestCaseReportModalProps) {
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);

    if (!isOpen || !testCase) return null;

    const handleCopy = () => {
        const textToCopy = `=== ${testCase.id} FULL SUMMARY REPORT: ${testCase.title} ===
Quadrant: ${testCase.quadrant}
Status: ${testCase.status} (${testCase.score})
Execution Duration: ${testCase.durationMs}ms
Notification ID: ${testCase.notificationId}
Material: ${testCase.materialId}
Work Center: ${testCase.workCenter}

--- 1. SCENARIO & OBJECTIVE ---
${testCase.scenario.description}
Context: ${testCase.scenario.productionContext}
Challenge: ${testCase.scenario.challengeType}

--- 2. EMPIRICAL TELEMETRY & PHYSICAL EVIDENCE ---
Metric: ${testCase.empiricalEvidence.keyMetric}
Specification Limit: ${testCase.empiricalEvidence.toleranceSpec}
Sensor Telemetry: ${testCase.empiricalEvidence.sensorTelemetry}
Finding Analysis: ${testCase.empiricalEvidence.findingAnalysis}

--- 3. TWO-TIER AI DEFENSE ---
Tier 1: ${testCase.defenseBreakdown.tier1Schema}
Tier 2: ${testCase.defenseBreakdown.tier2Retrieval}
Similarity: ${testCase.defenseBreakdown.similarityScore}
Bias Resolution: ${testCase.defenseBreakdown.biasOverrideResult || 'N/A'}

--- 4. 8D DISCIPLINES MATRIX ---
${testCase.disciplinesMatrix.map(d => `[${d.code} ${d.name}]: ${d.summary}`).join('\n')}

--- 5. AUDIT & RUBRIC COMPLIANCE ---
Rubric: ${testCase.auditCompliance.rubricItem}
Verdict: ${testCase.auditCompliance.complianceVerdict}
Hallucination Check: ${testCase.auditCompliance.hallucinationCheck}
`;
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
                {/* ── Modal Header ── */}
                <div className="p-5 border-b border-border bg-muted/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                                    {testCase.id}
                                </span>
                                <h2 className="text-lg font-bold text-foreground">
                                    {testCase.title}
                                </h2>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {testCase.quadrant} • Comprehensive Evaluation &amp; Evidence Summary
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                        title="Close Modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Modal Body (Scrollable) ── */}
                <div className="p-6 overflow-y-auto space-y-6 text-sm">
                    {/* Top KPI Summary Banner */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/20 p-4 rounded-xl border border-border">
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Test Status</div>
                            <div className="font-bold text-emerald-600 dark:text-emerald-400 text-base mt-0.5 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" />
                                {testCase.status} (PASS)
                            </div>
                        </div>

                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Criterion 2 Score</div>
                            <div className="font-bold text-foreground text-base mt-0.5">
                                {testCase.score}
                            </div>
                        </div>

                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">AI Duration</div>
                            <div className="font-mono font-bold text-blue-600 dark:text-blue-400 text-base mt-0.5 flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {testCase.durationMs}ms
                            </div>
                        </div>

                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">8D Case ID</div>
                            <div className="font-mono font-bold text-primary text-base mt-0.5">
                                {testCase.notificationId}
                            </div>
                        </div>
                    </div>

                    {/* Section 1: Scenario & Manufacturing Challenge */}
                    <div className="space-y-2">
                        <div className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary" />
                            <span>1. Scenario &amp; Production Context</span>
                        </div>
                        <div className="p-4 rounded-xl border border-border bg-card space-y-2 text-xs">
                            <p className="text-foreground leading-relaxed">
                                {testCase.scenario.description}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border/60 text-muted-foreground">
                                <div><strong>Production Context:</strong> {testCase.scenario.productionContext}</div>
                                <div><strong>Strategic Challenge:</strong> {testCase.scenario.challengeType}</div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Empirical Telemetry & Physical Evidence */}
                    <div className="space-y-2">
                        <div className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                            <Activity className="w-4 h-4 text-emerald-500" />
                            <span>2. Empirical Telemetry &amp; Objective Finding</span>
                        </div>
                        <div className="p-4 rounded-xl border border-border bg-card space-y-3 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="p-3 rounded-lg bg-muted/40 border border-border">
                                    <span className="text-muted-foreground font-semibold">Key Inspection Metric:</span>
                                    <div className="font-bold text-foreground mt-0.5">{testCase.empiricalEvidence.keyMetric}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/40 border border-border">
                                    <span className="text-muted-foreground font-semibold">Drawing / Tolerance Limit:</span>
                                    <div className="font-mono font-bold text-amber-600 dark:text-amber-400 mt-0.5">{testCase.empiricalEvidence.toleranceSpec}</div>
                                </div>
                            </div>

                            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
                                <span className="font-bold text-primary">Measured Telemetry:</span>
                                <div className="font-mono text-foreground">{testCase.empiricalEvidence.sensorTelemetry}</div>
                            </div>

                            <p className="text-muted-foreground leading-relaxed">
                                <strong>Analytical Finding:</strong> {testCase.empiricalEvidence.findingAnalysis}
                            </p>
                        </div>
                    </div>

                    {/* Section 3: Two-Tier AI Defense Breakdown */}
                    <div className="space-y-2">
                        <div className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-purple-500" />
                            <span>3. Two-Tier AI Defense &amp; Bias Safeguards</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="p-3.5 rounded-xl border border-border bg-card space-y-1.5">
                                <span className="font-bold text-foreground flex items-center gap-1.5">
                                    <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                                    Tier 1: Boundary &amp; Ingestion Filter
                                </span>
                                <p className="text-muted-foreground leading-relaxed">
                                    {testCase.defenseBreakdown.tier1Schema}
                                </p>
                            </div>

                            <div className="p-3.5 rounded-xl border border-border bg-card space-y-1.5">
                                <span className="font-bold text-foreground flex items-center gap-1.5">
                                    <Database className="w-3.5 h-3.5 text-purple-500" />
                                    Tier 2: Retrieval &amp; Anti-Hallucination
                                </span>
                                <p className="text-muted-foreground leading-relaxed">
                                    {testCase.defenseBreakdown.tier2Retrieval}
                                </p>
                                <div className="text-[11px] font-mono text-primary font-semibold">
                                    Precedent Score: {testCase.defenseBreakdown.similarityScore}
                                </div>
                            </div>
                        </div>

                        {testCase.defenseBreakdown.biasOverrideResult && (
                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
                                <strong>Bias Safeguard Verdict:</strong> {testCase.defenseBreakdown.biasOverrideResult}
                            </div>
                        )}
                    </div>

                    {/* Section 4: 8D Disciplines Synthesis Table */}
                    <div className="space-y-2">
                        <div className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                            <Layers className="w-4 h-4 text-primary" />
                            <span>4. 8D Disciplines Synthesis (D1 – D8)</span>
                        </div>
                        <div className="border border-border rounded-xl overflow-hidden bg-card">
                            <div className="divide-y divide-border text-xs">
                                {testCase.disciplinesMatrix.map((d) => (
                                    <div key={d.code} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-muted/20 transition-colors">
                                        <div className="flex items-start sm:items-center gap-2.5">
                                            <span className="font-mono font-bold text-primary w-8 shrink-0">
                                                {d.code}
                                            </span>
                                            <span className="font-semibold text-foreground w-44 shrink-0">
                                                {d.name}:
                                            </span>
                                            <span className="text-muted-foreground">
                                                {d.summary}
                                            </span>
                                        </div>
                                        <span className="self-start sm:self-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                            {d.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Section 5: Audit & Compliance */}
                    <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-1.5 text-xs">
                        <div className="font-bold text-foreground flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            <span>5. Hackathon Evaluation Rubric Audit</span>
                        </div>
                        <div className="text-muted-foreground">
                            <strong>Compliance:</strong> {testCase.auditCompliance.complianceVerdict}
                        </div>
                        <div className="text-muted-foreground">
                            <strong>Hallucination Check:</strong> {testCase.auditCompliance.hallucinationCheck}
                        </div>
                    </div>
                </div>

                {/* ── Modal Footer ── */}
                <div className="p-4 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3">
                    <button
                        onClick={handleCopy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-all cursor-pointer"
                    >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copied Full Report' : 'Copy Summary Report'}</span>
                    </button>

                    <div className="flex items-center gap-2">
                        {testCase.reportId && (
                            <button
                                onClick={() => {
                                    onClose();
                                    navigate(`/8d/${testCase.reportId}`);
                                }}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow cursor-pointer"
                            >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Open Full 8D Workspace</span>
                                <ExternalLink className="w-3 h-3" />
                            </button>
                        )}

                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
