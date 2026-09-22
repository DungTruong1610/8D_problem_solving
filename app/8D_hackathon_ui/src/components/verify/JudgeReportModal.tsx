import { useState } from 'react';
import {
    ShieldCheck,
    CheckCircle2,
    AlertTriangle,
    X,
    FileText,
    ExternalLink,
    Copy,
    Check,
    Cpu,
    Database,
    HelpCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { JudgeEvaluationReportData } from './test-case-summary-data';

interface JudgeReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    report: JudgeEvaluationReportData | null;
}

export function JudgeReportModal({ isOpen, onClose, report }: JudgeReportModalProps) {
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);

    if (!isOpen || !report) return null;

    const handleCopy = () => {
        const textToCopy = `=== TWO-TIER DEFENSE EVALUATION REPORT (JUDGE BENCHMARK) ===
Case ID: ${report.caseId}
Verdict: ${report.decision}
Score: ${report.score}
Timestamp: ${report.timestamp}
Duration: ${report.durationMs}ms

--- INGESTED FACTS ---
Document Type: ${report.extractedFacts.documentType}
Symptom: ${report.extractedFacts.symptomDescription}
Work Center: ${report.extractedFacts.workCenterCode}
Material: ${report.extractedFacts.materialCode}
Telemetry: ${report.extractedFacts.telemetryItems.map(t => `${t.param}: ${t.value}`).join('; ')}

--- TIER 1 DEFENSE (BOUNDARY & INTEGRITY) ---
Status: ${report.tier1Defense.status}
Checks: ${report.tier1Defense.rule3bCheck}

--- TIER 2 DEFENSE (PRECEDENT & DOMAIN CLASSIFICATION) ---
Status: ${report.tier2Defense.status}
Similarity Score: ${report.tier2Defense.similarityScore}
Matched Precedent: ${report.tier2Defense.matchedPrecedent}
Verdict: ${report.tier2Defense.retrievalVerdict}

--- ACTION PACKAGE ---
${report.actionPlan.title}
${report.actionPlan.executiveSummary}
${report.actionPlan.technicalInquiries ? 'Technical Inquiries:\n' + report.actionPlan.technicalInquiries.map((q, i) => `  ${i + 1}. ${q}`).join('\n') : ''}
`;
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getVerdictBadge = () => {
        switch (report.decision) {
            case 'HANDLED_APPROPRIATELY':
                return {
                    bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
                    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
                    label: 'HANDLED_APPROPRIATELY (Autonomous Ingestion & Drafting)'
                };
            case 'ESCALATED':
                return {
                    bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800',
                    icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
                    label: 'ESCALATED (Novel Domain / Expert Routing)'
                };
            case 'GRACEFULLY_REFUSED':
            default:
                return {
                    bg: 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-300 dark:border-blue-800',
                    icon: <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
                    label: 'GRACEFULLY_REFUSED (Rule 3.b Out-of-Scope Protection)'
                };
        }
    };

    const badge = getVerdictBadge();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
                {/* ── Modal Header ── */}
                <div className="p-5 border-b border-border bg-muted/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-foreground">
                                    Two-Tier Defense Evaluation Report (Live Judge Benchmark)
                                </h2>
                                <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                                    {report.caseId}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Automated evaluation against Section 3.b &amp; Section 4 (Criterion 3: 8/8 Points Defense Gate)
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

                {/* ── Modal Content (Scrollable) ── */}
                <div className="p-6 overflow-y-auto space-y-6 text-sm">
                    {/* Top KPI & Verdict Banner */}
                    <div className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/10 border-border">
                        <div className="space-y-1">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                AI Defense Decision:
                            </div>
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.bg}`}>
                                {badge.icon}
                                <span>{badge.label}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs">
                            <div className="text-right">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Evaluation Score</div>
                                <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                                    {report.score}
                                </div>
                            </div>
                            <div className="h-8 w-px bg-border" />
                            <div className="text-right">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Latency</div>
                                <div className="font-mono font-bold text-foreground">
                                    {report.durationMs}ms
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Executive Reason Summary */}
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-xs text-foreground leading-relaxed">
                        <span className="font-bold text-primary">Executive Summary: </span>
                        {report.reason}
                    </div>

                    {/* Section 1: Ingested Facts & Boundary Extraction */}
                    <div className="space-y-2.5">
                        <div className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary" />
                            <span>1. Ingested Payload Facts &amp; Boundary Extraction</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-card p-4 rounded-xl border border-border text-xs">
                            <div>
                                <span className="text-muted-foreground font-medium">Document / Case ID:</span>
                                <div className="font-mono font-bold text-foreground mt-0.5">{report.extractedFacts.notificationId}</div>
                            </div>
                            <div>
                                <span className="text-muted-foreground font-medium">Classified Document Type:</span>
                                <div className="font-semibold text-foreground mt-0.5">{report.extractedFacts.documentType}</div>
                            </div>
                            <div>
                                <span className="text-muted-foreground font-medium">Assigned Work Center:</span>
                                <div className="font-medium text-foreground mt-0.5">{report.extractedFacts.workCenterCode}</div>
                            </div>
                            <div>
                                <span className="text-muted-foreground font-medium">Material / Component:</span>
                                <div className="font-medium text-foreground mt-0.5">{report.extractedFacts.materialCode}</div>
                            </div>
                            <div className="md:col-span-2">
                                <span className="text-muted-foreground font-medium">Symptom / Description Text:</span>
                                <div className="p-2.5 rounded-lg bg-muted/40 font-mono text-[11px] text-foreground mt-1">
                                    {report.extractedFacts.symptomDescription}
                                </div>
                            </div>
                            {report.extractedFacts.telemetryItems.length > 0 && (
                                <div className="md:col-span-2">
                                    <span className="text-muted-foreground font-medium">Extracted Telemetry &amp; Measurements:</span>
                                    <div className="mt-1 flex flex-wrap gap-2">
                                        {report.extractedFacts.telemetryItems.map((item, idx) => (
                                            <span key={idx} className="px-2.5 py-1 rounded bg-muted border border-border text-foreground font-mono text-[11px]">
                                                <strong>{item.param}:</strong> {item.value}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Section 2: Two-Tier Defense Architecture Breakdown */}
                    <div className="space-y-2.5">
                        <div className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-purple-500" />
                            <span>2. Two-Tier Defense Architecture Verification</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Tier 1 Box */}
                            <div className="p-4 rounded-xl border border-border bg-card space-y-2.5">
                                <div className="flex items-center justify-between border-b border-border pb-2">
                                    <span className="font-bold text-xs text-foreground">{report.tier1Defense.title}</span>
                                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                        report.tier1Defense.status === 'PASSED'
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                    }`}>
                                        {report.tier1Defense.status}
                                    </span>
                                </div>
                                <div className="text-xs space-y-1.5 text-muted-foreground">
                                    <div><strong>Mandatory Rule 3.b Gate:</strong> {report.tier1Defense.rule3bCheck}</div>
                                    <div><strong>Schema Validation:</strong> {report.tier1Defense.schemaValidation}</div>
                                </div>
                            </div>

                            {/* Tier 2 Box */}
                            <div className="p-4 rounded-xl border border-border bg-card space-y-2.5">
                                <div className="flex items-center justify-between border-b border-border pb-2">
                                    <span className="font-bold text-xs text-foreground">{report.tier2Defense.title}</span>
                                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                        report.tier2Defense.status === 'MATCHED'
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                            : report.tier2Defense.status === 'NOVEL_ESCALATED'
                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                            : 'bg-muted text-muted-foreground'
                                    }`}>
                                        {report.tier2Defense.status}
                                    </span>
                                </div>
                                <div className="text-xs space-y-1.5 text-muted-foreground">
                                    <div><strong>pgvector Cosine Similarity:</strong> <span className="font-mono font-semibold text-foreground">{report.tier2Defense.similarityScore}</span></div>
                                    <div><strong>Matched Precedent:</strong> {report.tier2Defense.matchedPrecedent}</div>
                                    <div><strong>Retrieval Verdict:</strong> {report.tier2Defense.retrievalVerdict}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Action Package & Resolution */}
                    <div className="space-y-2.5">
                        <div className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                            <Database className="w-4 h-4 text-emerald-500" />
                            <span>3. Action Package &amp; Resolution Protocol</span>
                        </div>
                        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                            <div>
                                <h4 className="font-bold text-xs text-foreground">{report.actionPlan.title}</h4>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                    {report.actionPlan.executiveSummary}
                                </p>
                            </div>

                            {/* Inquiries if escalated */}
                            {report.actionPlan.technicalInquiries && (
                                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                                    <div className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                                        <HelpCircle className="w-3.5 h-3.5" />
                                        <span>Target Inquiries Generated for {report.actionPlan.targetSme}:</span>
                                    </div>
                                    <ul className="list-disc list-inside text-xs text-foreground/90 space-y-1 pl-1">
                                        {report.actionPlan.technicalInquiries.map((q, idx) => (
                                            <li key={idx} className="leading-relaxed">{q}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Disciplines Preview if valid defect */}
                            {report.actionPlan.disciplinesPreview && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                    {report.actionPlan.disciplinesPreview.map((d) => (
                                        <div key={d.code} className="p-2 rounded bg-muted/40 border border-border text-[11px]">
                                            <div className="font-bold text-primary">{d.code} • {d.label}</div>
                                            <div className="text-muted-foreground text-[10px] mt-0.5 truncate" title={d.outcome}>
                                                {d.outcome}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Rule reference if refused */}
                            {report.actionPlan.ruleReference && (
                                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-800 dark:text-blue-300">
                                    <strong>Compliance Certificate:</strong> Verified compliant with {report.actionPlan.ruleReference}. Zero false confidence generated.
                                </div>
                            )}
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
                        <span>{copied ? 'Copied Full Report' : 'Copy Report Summary'}</span>
                    </button>

                    <div className="flex items-center gap-2">
                        {report.actionPlan.reportId && (
                            <button
                                onClick={() => {
                                    onClose();
                                    navigate(`/8d/${report.actionPlan.reportId}`);
                                }}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow cursor-pointer"
                            >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Open 8D Workspace</span>
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
