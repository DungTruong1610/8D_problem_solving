import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowRight,
    CheckCircle2,
    ChevronDown,
    Clock,
    FileText,
    Info,
    Play,
    RefreshCw,
    ShieldCheck,
    XCircle,
} from 'lucide-react';
import { Button, cn } from '@cnma/react-ui';
import { eightDService } from '@/services/eightd-service';
import { JudgeReportModal } from '@/components/verify/JudgeReportModal';
import { TestCaseReportModal } from '@/components/verify/TestCaseReportModal';
import {
    TEST_CASE_SUMMARIES,
    type TestCaseSummary,
} from '@/components/verify/test-case-summary-data';
import {
    JUDGE_STOP_LABEL,
    type JudgeEvaluation,
    type JudgeStopType,
} from '../../../../../../shared/judge-evaluation';
import {
    JUDGE_PRESETS,
    TEST_CASES,
    buildReferenceReport,
    type VerifyHarnessReport,
} from '../guide-data';
import { GuideCard, TabIntro } from '../guide-ui';

type ReportSource = 'live' | 'reference';

/**
 * Kết quả khi KHÔNG gọi được backend: chỉ là luật đơn giản chạy ở trình duyệt,
 * không tra kho case, và được đánh dấu `simulated`. Không đưa ra con số nào mà
 * nó không thật sự tính.
 */
function localEvaluation(parsed: any, reason: string, decision: JudgeEvaluation['decision'], stopType: JudgeStopType | null, simulated: boolean): JudgeEvaluation {
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const stops = stopType ? [{
        id: `${stopType}:local:D1`,
        type: stopType,
        step: 'D1',
        reason,
        questionForHuman: stopType === 'outside-scope'
            ? 'This is not a quality notification. Should it be routed to another process?'
            : 'Please provide the missing defect data.',
        requiredRole: stopType === 'outside-scope' ? 'Requester' : 'Quality Engineer',
        blocking: true,
    }] : [];
    return {
        decision,
        reason,
        timestamp: new Date().toISOString(),
        durationMs: 0,
        primaryStopType: stopType,
        stops,
        facts: {
            notificationId: str(parsed?.notificationId) ?? str(parsed?.invoiceId),
            documentType: decision === 'GRACEFULLY_REFUSED' ? 'Not evaluated as a defect' : 'Quality notification',
            symptom: str(parsed?.symptomShortText) ?? str(parsed?.description),
            materialId: str(parsed?.material?.materialId),
            workCenterId: str(parsed?.workCenter?.workCenterId),
            defectCode: str(parsed?.defect?.defectCode),
            measurements: Array.isArray(parsed?.inspections)
                ? parsed.inspections.map((i: any) => ({ characteristic: String(i?.characteristic ?? 'Inspection'), measured: String(i?.measuredValue ?? ''), spec: String(i?.specValue ?? '') }))
                : [],
            gaps: [],
        },
        validation: { blocking: [], warnings: 0 },
        precedentCheck: { performed: false, matchingCases: 0, basis: 'Not run — the case library is only searched on the server.', sample: [] },
        nextStep: {
            title: decision === 'GRACEFULLY_REFUSED' ? 'Refused' : 'Run again when the backend is reachable',
            summary: simulated
                ? 'Without the server, only the basic input checks ran. Precedent search and the full stop rules need the backend.'
                : reason,
            questions: stops.map((s) => s.questionForHuman),
            roles: stops.map((s) => s.requiredRole),
        },
        simulated,
    };
}

/** Luật tối thiểu khi backend không trả lời. */
function simulateJudge(parsed: any): JudgeEvaluation {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return localEvaluation(parsed, 'The input is not a JSON object.', 'GRACEFULLY_REFUSED', 'unverified-facts', true);
    }
    if (parsed.invoiceId || parsed.amountVnd || /finance|accounting|hr|payroll/i.test(String(parsed.department ?? ''))) {
        return localEvaluation(parsed, 'This looks like a finance document, not a quality notification — refused.', 'GRACEFULLY_REFUSED', 'outside-scope', true);
    }
    if (!parsed.notificationId && !parsed.symptomShortText && !parsed.defect) {
        return localEvaluation(parsed, 'No notificationId, symptom or defect — the defect cannot be identified.', 'GRACEFULLY_REFUSED', 'unverified-facts', true);
    }
    return localEvaluation(parsed, 'Looks like a quality notification. The precedent search and stop rules need the server, so no verdict is given here.', 'ESCALATED', null, true);
}

const STOP_PILL: Record<JudgeStopType, string> = {
    'unverified-facts': 'border-warning/40 text-warning',
    'outside-scope': 'border-info/40 text-info',
    'exceeds-authority': 'border-primary/40 text-primary',
};

function StopPill({ type }: { type?: JudgeStopType | null }) {
    if (!type) return <span className="inline-flex w-[124px] justify-center text-xs text-muted-foreground">no stop</span>;
    return (
        <span className={cn('inline-flex w-[124px] justify-center rounded-full border px-2 py-0.5 text-xs font-medium', STOP_PILL[type])}>
            {JUDGE_STOP_LABEL[type]}
        </span>
    );
}

const DECISION_LABEL: Record<JudgeEvaluation['decision'], string> = {
    HANDLED_APPROPRIATELY: 'Handled — no stop',
    ESCALATED: 'Stopped — handed to a person',
    GRACEFULLY_REFUSED: 'Refused',
};

const DECISION_STYLE: Record<string, string> = {
    HANDLED_APPROPRIATELY: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
    ESCALATED: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    GRACEFULLY_REFUSED: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
};

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <GuideCard className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </GuideCard>
    );
}

export function EvaluationTab() {
    const navigate = useNavigate();

    // ── Verify harness ──
    const [isRunning, setIsRunning] = useState(false);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [report, setReport] = useState<VerifyHarnessReport | null>(null);
    const [source, setSource] = useState<ReportSource>('live');
    const [expanded, setExpanded] = useState<string | null>(null);
    const timerRef = useRef<number | null>(null);

    // ── Judge sandbox ──
    const [judgeText, setJudgeText] = useState('');
    const [isJudging, setIsJudging] = useState(false);
    const [judgeResult, setJudgeResult] = useState<JudgeEvaluation | null>(null);

    // ── Modals ──
    const [summaryCase, setSummaryCase] = useState<TestCaseSummary | null>(null);
    const [isJudgeModalOpen, setIsJudgeModalOpen] = useState(false);

    // "Open case" only makes sense for cases that exist in this database. The
    // harness evaluates TC-02 and TC-04 without persisting a report, so with the
    // shipped seed data their button stays disabled instead of opening a 404.
    const { data: reports } = useQuery({
        queryKey: ['8d', 'reports'],
        queryFn: () => eightDService.list(),
    });
    const existingCases = useMemo(
        () => new Set((reports?.value ?? []).map((r) => r.notificationId)),
        [reports],
    );

    const runVerify = async () => {
        setIsRunning(true);
        setReport(null);
        setElapsedMs(0);
        const started = Date.now();
        timerRef.current = window.setInterval(() => setElapsedMs(Date.now() - started), 100);
        try {
            const res = await fetch('/api/verify/sprint1');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setReport(await res.json());
            setSource('live');
        } catch {
            setReport(buildReferenceReport());
            setSource('reference');
        } finally {
            if (timerRef.current) window.clearInterval(timerRef.current);
            setIsRunning(false);
        }
    };

    const evaluateJudge = async () => {
        if (!judgeText.trim()) return;
        // JSON hỏng là lỗi của đầu vào, không phải backend sập — nói đúng như vậy.
        let parsed: unknown;
        try {
            parsed = JSON.parse(judgeText);
        } catch (err: any) {
            setJudgeResult(localEvaluation(null, `The input is not valid JSON (${err?.message ?? 'parse error'}), so it was refused.`, 'GRACEFULLY_REFUSED', 'unverified-facts', false));
            return;
        }
        setIsJudging(true);
        setJudgeResult(null);
        try {
            const res = await fetch('/api/verify/judge-input', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setJudgeResult(await res.json());
        } catch {
            setJudgeResult(simulateJudge(parsed));
        } finally {
            setIsJudging(false);
        }
    };

    return (
        <div className="space-y-5">
            <TabIntro
                title="Evaluation"
                description="Run the four reference test cases, then try any unseen payload in the sandbox."
                action={
                    <Button type="button" size="sm" className="gap-1.5" onClick={runVerify} disabled={isRunning}>
                        {isRunning ? <RefreshCw className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                        {isRunning ? `Running… ${(elapsedMs / 1000).toFixed(1)}s` : 'Run verification'}
                    </Button>
                }
            />

            {report && source === 'reference' && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    <span>The backend could not be reached, so these are reference results — not a live run. Start the backend and run again.</span>
                </div>
            )}

            {report && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatTile
                        label="Passed"
                        value={`${report.passed} / ${report.total}`}
                        hint={report.verdict === 'PASS' ? 'All cases passed' : `${report.failed} failed`}
                    />
                    <StatTile
                        label="Total time"
                        value={`${(report.totalDurationMs / 1000).toFixed(2)}s`}
                        hint={`Budget ${(report.targetDurationLimitMs / 1000).toFixed(0)}s`}
                    />
                    <StatTile
                        label="Source"
                        value={source === 'live' ? 'Live run' : 'Reference'}
                        hint={new Date(report.executedAt).toLocaleString()}
                    />
                </div>
            )}

            {/* Test cases */}
            <GuideCard className="p-0">
                <div className="flex items-center justify-between border-b px-5 py-3.5">
                    <h3 className="text-sm font-semibold text-foreground">Test cases</h3>
                    {!report && <span className="text-xs text-muted-foreground">Not run yet</span>}
                </div>
                <ul className="divide-y">
                    {TEST_CASES.map((tc) => {
                        const result = report?.results.find((r) => r.id === tc.id);
                        const caseId = result?.notificationId || tc.notificationId;
                        const canOpenCase = existingCases.has(caseId);
                        const isOpen = expanded === tc.id;

                        return (
                            <li key={tc.id}>
                                <div className="flex flex-col gap-3 px-5 py-3.5 md:flex-row md:items-center">
                                    <button
                                        type="button"
                                        onClick={() => setExpanded(isOpen ? null : tc.id)}
                                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                                        aria-expanded={isOpen}
                                    >
                                        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', isOpen ? '' : '-rotate-90')} />
                                        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">{tc.id}</span>
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-medium text-foreground">{tc.title}</span>
                                            <span className="block text-xs text-muted-foreground">{tc.quadrant}</span>
                                        </span>
                                    </button>

                                    <div className="flex shrink-0 items-center gap-2 pl-7 md:pl-0">
                                        <span className="w-16 text-right font-mono text-xs text-muted-foreground">
                                            {result ? `${result.durationMs}ms` : '—'}
                                        </span>
                                        {result ? <StopPill type={result.stopType} /> : <span className="inline-flex w-[124px] justify-center text-xs text-muted-foreground">—</span>}
                                        <StatusPill status={result?.status} />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5"
                                            onClick={() => setSummaryCase(TEST_CASE_SUMMARIES[tc.id] ?? null)}
                                        >
                                            <FileText className="size-3.5" />
                                            Summary
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5"
                                            disabled={!canOpenCase}
                                            title={canOpenCase ? `Open ${caseId}` : `No 8D report for ${caseId} in this database`}
                                            onClick={() => navigate(`/8d/${caseId}`)}
                                        >
                                            Open case
                                            <ArrowRight className="size-3.5" />
                                        </Button>
                                    </div>
                                </div>

                                {isOpen && (
                                    <div className="grid grid-cols-1 gap-4 border-t bg-muted/20 px-5 py-4 text-sm md:grid-cols-3 md:pl-12">
                                        <div className="space-y-1">
                                            <p className="text-xs font-medium text-muted-foreground">Input</p>
                                            <p className="text-foreground">{tc.summary}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xs font-medium text-muted-foreground">Expected</p>
                                            <p className="text-foreground">{tc.expected}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xs font-medium text-muted-foreground">Actual</p>
                                            <p className="text-foreground">{result?.actualBehavior ?? 'Run verification to see the result.'}</p>
                                        </div>
                                        {result?.stops && result.stops.length > 0 && (
                                            <div className="space-y-1 md:col-span-3">
                                                <p className="text-xs font-medium text-muted-foreground">Where the AI stopped</p>
                                                <ul className="space-y-1">
                                                    {result.stops.map((st) => (
                                                        <li key={st.id} className="text-foreground">
                                                            <span className="font-medium">{JUDGE_STOP_LABEL[st.type]} · {st.step}</span> — {st.reason}{' '}
                                                            <span className="text-muted-foreground">Asks {st.requiredRole}: {st.questionForHuman}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        <p className="font-mono text-xs text-muted-foreground md:col-span-3">{tc.jsonPath}</p>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </GuideCard>

            {/* Judge sandbox */}
            <GuideCard className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <ShieldCheck className="size-[18px]" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">Judge sandbox</h3>
                            <p className="mt-0.5 text-sm text-muted-foreground">Paste any JSON and see whether it is handled, stopped for a person, or refused — and why.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">Try:</span>
                        {JUDGE_PRESETS.map((preset) => (
                            <Button
                                key={preset.key}
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => { setJudgeText(JSON.stringify(preset.payload, null, 2)); setJudgeResult(null); }}
                            >
                                {preset.label}
                            </Button>
                        ))}
                    </div>
                </div>

                <textarea
                    value={judgeText}
                    onChange={(e) => { setJudgeText(e.target.value); setJudgeResult(null); }}
                    spellCheck={false}
                    wrap="off"
                    placeholder='{"notificationId": "8D-10049002", "symptomShortText": "Coolant weeping…"}'
                    className="h-44 w-full resize-none rounded-lg border bg-muted/30 p-4 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary"
                />

                <div className="flex justify-end">
                    <Button type="button" size="sm" onClick={evaluateJudge} disabled={isJudging || !judgeText.trim()}>
                        {isJudging ? 'Evaluating…' : 'Evaluate'}
                    </Button>
                </div>

                {judgeResult && (
                    <div className={cn('flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between', DECISION_STYLE[judgeResult.decision] ?? DECISION_STYLE.GRACEFULLY_REFUSED)}>
                        <div className="min-w-0 space-y-0.5">
                            <p className="flex flex-wrap items-center gap-2 font-semibold">
                                {judgeResult.decision === 'HANDLED_APPROPRIATELY' && judgeResult.stops.length > 0
                                    ? 'Handled — sign-off needed at closure'
                                    : DECISION_LABEL[judgeResult.decision]}
                                {judgeResult.primaryStopType && (
                                    <span className="rounded-full border border-current/30 px-2 py-px text-xs font-medium">
                                        Stop: {JUDGE_STOP_LABEL[judgeResult.primaryStopType]}
                                    </span>
                                )}
                                {judgeResult.simulated && <span className="text-xs font-normal opacity-75">(browser check only — backend unreachable)</span>}
                            </p>
                            <p>{judgeResult.reason}</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5 bg-background" onClick={() => setIsJudgeModalOpen(true)}>
                            <FileText className="size-3.5" />
                            Full report
                        </Button>
                    </div>
                )}
            </GuideCard>

            <TestCaseReportModal isOpen={!!summaryCase} onClose={() => setSummaryCase(null)} testCase={summaryCase} />
            <JudgeReportModal isOpen={isJudgeModalOpen} onClose={() => setIsJudgeModalOpen(false)} report={judgeResult} />
        </div>
    );
}

function StatusPill({ status }: { status?: 'PASS' | 'FAIL' }) {
    if (!status) {
        return (
            <span className="inline-flex w-[76px] items-center justify-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <Clock className="size-3" />
                Pending
            </span>
        );
    }
    const pass = status === 'PASS';
    return (
        <span
            className={cn(
                'inline-flex w-[76px] items-center justify-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                pass ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/10 text-red-700 dark:text-red-300',
            )}
        >
            {pass ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
            {status}
        </span>
    );
}
