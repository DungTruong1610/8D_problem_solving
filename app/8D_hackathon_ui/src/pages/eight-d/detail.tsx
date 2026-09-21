import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Badge,
    Button,
    Card,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Spinner,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    cn,
} from '@cnma/react-ui';

import {
    AlertCircle, ArrowLeft, Braces, Cpu, Database, FileSpreadsheet, History, Layers,
    RefreshCw, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    eightDService,
    isCustomerComplaint,
    type Report8D,
} from '@/services/eightd-service';
import { DisciplineCard } from './discipline-card';
import { SchemaDisciplineCard, resolveD4RootCause } from './schema-discipline-card';
import { useStepPrompts } from '@/hooks/use-step-prompts';
import { ReportStatusBadge } from './status-badge';
import { DisciplineReviewBox } from './review-controls';
import { ActionChecklist, parseCaseActions } from './action-checklist';
import { EvidenceTab } from './evidence-tab';
import { CaseStepper } from './case-stepper';
import { CaseCommitments } from './case-commitments';
import { AuditTrailPanel } from './audit-trail-panel';
import { export8DToExcel } from './export-8d-excel';
import { CaseProvenanceProvider } from './ai-provenance-info';

/**
 * Chi tiết một báo cáo 8D.
 *
 * Trong lúc report còn ở `Analyzing`, trang tự làm mới mỗi 4 giây rồi dừng khi
 * xong — cùng cơ chế với trang danh sách. Phân tích chạy ở nền trên server nên
 * đây là cách duy nhất để biết đã xong hay chưa.
 */

/**
 * Nhịp poll phải dài hơn thời gian một response, nếu không request chồng lên
 * nhau và hàng đợi tự làm chậm chính nó. Đo trên HANA Cloud: mỗi lượt
 * `Reports(id)?$expand=disciplines` mất 2,7–5,6 giây vì kéo về cả `sourcePayload`,
 * `caseContext` và `resultJson` của từng bước. Đặt 1,5 giây là gửi lượt mới khi
 * lượt trước còn chưa về.
 *
 * 3 giây vẫn đủ "trực tiếp": một đợt bước mất 6–16 giây mới xong.
 */
const POLL_INTERVAL_MS = 3_000;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="text-sm mt-0.5">{children ?? '—'}</div>
        </div>
    );
}

function formatEur(v: number | null) {
    if (v == null) return '—';
    return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
    }).format(v);
}

type MainTab = 'disciplines' | 'evidence' | 'summary';

const MAIN_TABS: { value: MainTab; label: string; icon: typeof Layers }[] = [
    { value: 'disciplines', label: '8D Disciplines', icon: Layers },
    { value: 'evidence', label: 'Evidence', icon: Database },
    { value: 'summary', label: 'Case Overview', icon: Sparkles },
];

export function EightDDetailPage() {
    const { id = '' } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [showPayload, setShowPayload] = useState(false);
    const [showAudit, setShowAudit] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [activeDiscipline, setActiveDiscipline] = useState('D1');
    const [mainTab, setMainTab] = useState<MainTab>('disciplines');
    /*
     * Bước mà tab Evidence phải mở sẵn khi người dùng bấm badge từ tab bên kia.
     * Giữ ở đây chứ không trong EvidenceTab vì badge nằm ở cây component khác.
     */
    const [evidenceFocus] = useState<{ code: string; seq: number } | null>(null);



    // Bo cuc SONG, doc thang tu StepPrompts - khong phai ban chup luc phan tich.
    //
    // Doi lai: sua Form Editor roi F5 la thay ngay, khong phai chay lai AI sau
    // moi lan keo mot field. Cai gia phai tra la mot bao cao da phat hanh se doi
    // hinh khi ai do chinh cau hinh - nen `resultJson` (KET LUAN cua AI) van la
    // ban chup bat bien; chi rieng chuyen bay cai gi len man hinh moi la song.
    const stepPrompts = useStepPrompts();

    const { data: report, isLoading, isError, error } = useQuery({
        queryKey: ['8d', 'report', id],
        queryFn: () => eightDService.getWithDisciplines(id),
        enabled: !!id,
        // Mặc định toàn cục là staleTime 5 phút. Với một bản ghi đang đổi trạng
        // thái thì đó là sai: quay lại trang trong vòng 5 phút sẽ dựng từ cache
        // cũ, hiện `Analyzing` dù phân tích đã xong từ lâu.
        staleTime: 0,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
        refetchInterval: (query) =>
            (query.state.data as Report8D | undefined)?.status === 'Analyzing'
                ? POLL_INTERVAL_MS
                : false,
        // Một lượt phân tích mất 3-5 phút. Mặc định React Query dừng đếm giờ khi
        // tab bị ẩn, nên đổi tab đi làm việc khác rồi quay lại là gặp đúng cái
        // spinner cũ. Cho chạy tiếp cả khi tab ở nền.
        refetchIntervalInBackground: true,
    });

    const reanalyze = useMutation({
        mutationFn: () => eightDService.reanalyze(id),
        onSuccess: () => {
            toast.success('Re-analysis scheduled', {
                description: 'This takes about 3 minutes. The page updates automatically.',
            });
            queryClient.invalidateQueries({ queryKey: ['8d'] });
        },
        onError: (e: any) => {
            toast.error(
                e?.response?.data?.error?.message ?? e?.message ?? 'Could not re-run the analysis.',
            );
        },
    });

    useEffect(() => {
        if (report?.status === 'Failed' && report?.errorMessage) {
            console.error('[8D Copilot] AI Analysis Error Details:', report.errorMessage);
        }
    }, [report?.status, report?.errorMessage]);

    useEffect(() => {
        if (report?.status && report.status !== 'Analyzing') {
            void queryClient.invalidateQueries({ queryKey: ['8d', 'reports'] });
        }
    }, [report?.status, queryClient]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
                <Spinner className="w-4 h-4" /> Loading report…
            </div>
        );
    }

    if (isError || !report) {
        return (
            <div className="flex flex-col items-center gap-3 py-24 px-6 text-center">
                <AlertCircle className="w-8 h-8 text-destructive" />
                <p className="text-sm font-medium">Could not load this report</p>
                <p className="text-sm text-muted-foreground max-w-md">
                    {(error as Error)?.message ?? 'It may have been deleted.'}
                </p>
                <Button variant="outline" size="sm" onClick={() => {
                    void queryClient.invalidateQueries({ queryKey: ['8d'] });
                    navigate('/8d');
                }}>
                    Back to list
                </Button>
            </div>
        );
    }

    const disciplines = [...(report.disciplines ?? [])].sort((a, b) => a.sequence - b.sequence);
    const customerFacing = isCustomerComplaint(report.origin);
    const running = report.status === 'Analyzing';
    const caseActions = parseCaseActions(report.caseContext);

    const handleExportExcel = async () => {
        if (!report) return;
        try {
            setExporting(true);
            await export8DToExcel(report);
            toast.success('8D Report exported to Excel successfully!');
        } catch (err: any) {
            toast.error(`Export failed: ${err?.message ?? err}`);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="p-6 md:p-8 w-full min-w-0 space-y-6">

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="min-w-0">
                    <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => {
                        void queryClient.invalidateQueries({ queryKey: ['8d'] });
                        navigate('/8d');
                    }}>
                        <ArrowLeft className="w-4 h-4" />
                        8D Reports
                    </Button>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-xl font-bold font-mono">{report.notificationId}</h1>
                        <ReportStatusBadge status={report.status} />
                    </div>

                    <p className="text-sm text-muted-foreground mt-1">{report.symptomShortText}</p>

                    {/*
                      * Nguồn của case: lỗi nào đã sinh ra báo cáo này.
                      *
                      * Nói rõ cả khi KHÔNG có, vì "không có bản ghi lỗi" là một sự
                      * thật về case chứ không phải một ô trống — nó cho biết case
                      * này vào bằng đường nhập JSON, nên đừng đi tìm một số lỗi
                      * không tồn tại.
                      */}
                    <p className="text-sm text-muted-foreground mt-1.5">
                        {report.sourceDefectId ? (
                            <>
                                Opened from defect{' '}
                                <span className="font-mono text-foreground">{report.sourceDefectId}</span>
                            </>
                        ) : (
                            'Imported as JSON — no source defect record'
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={exporting}
                        onClick={handleExportExcel}
                        title="Export 8D Report to Excel (multi-sheet workbook)"
                        className="gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/50 shadow-2xs"
                    >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        {exporting ? 'Exporting…' : 'Export Excel'}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAudit(true)}
                        title="Audit Log"
                    >
                        <History className="w-4 h-4 text-primary" />
                        Audit Log
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowPayload(true)}>
                        <Braces className="w-4 h-4" />
                        Source JSON
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={running || reanalyze.isPending}
                        onClick={() => reanalyze.mutate()}
                    >
                        <RefreshCw className={cn('w-4 h-4', reanalyze.isPending && 'animate-spin')} />
                        Re-analyze
                    </Button>
                </div>
            </div>

            {/* ── Đang chạy ── */}
            {running && (
                <div className="flex items-center gap-2 text-sm text-info bg-info/5 border border-info/20 rounded-lg px-4 py-3">
                    <Spinner className="w-4 h-4" />
                    Analysis in progress — extracting facts, then drafting the eight disciplines.
                    This page updates automatically.
                </div>
            )}

            {/* ── Thất bại ── */}
            {report.status === 'Failed' && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-4 py-3">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium">Analysis failed</p>
                        <p className="text-sm mt-1 text-muted-foreground">
                            An error occurred during AI analysis execution. Please retry running the analysis or inspect the browser console for details.
                        </p>
                    </div>
                </div>
            )}

            {/* ── Main Content ── */}
            <CaseProvenanceProvider caseContext={report.caseContext} precedentsJson={report.precedentsJson} reportID={id}>
                <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as MainTab)} className="w-full space-y-6">
                    <TabsList className="h-10 w-full max-w-lg gap-1 rounded-xl border border-border/80 bg-muted/60 p-1">
                        {MAIN_TABS.map(({ value, label, icon: Icon }) => (
                            <TabsTrigger
                                key={value}
                                value={value}
                                className="h-8 flex-1 cursor-pointer gap-1.5 rounded-lg text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs"
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <TabsContent value="disciplines" className="mt-0 outline-none">
                        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">

                            {/* ── Cot trai: tien do + dieu huong ── */}
                            <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
                                <Card className="overflow-hidden py-3">
                                    <CaseStepper
                                        disciplines={disciplines}
                                        active={activeDiscipline}
                                        onSelect={setActiveDiscipline}
                                        isAnalyzing={running}
                                    />
                                </Card>
                            </aside>

                            {/* ── Cot giua: buoc dang mo ── */}
                            <section className="min-w-0 space-y-4">
                                {(() => {
                                    const selected = disciplines.find((d) => d.code === activeDiscipline);
                                    if (selected) {
                                        return (
                                            <div key={selected.ID} className="min-w-0 space-y-4">
                                                <DisciplineReviewBox
                                                    discipline={selected}
                                                    siblings={disciplines}
                                                    liveFormSchemaJson={stepPrompts.byCode[selected.code]?.formSchemaJson ?? null}
                                                    caseContext={report.caseContext}
                                                    precedentsJson={report.precedentsJson}
                                                />

                                            {selected.code !== 'D6' && (
                                                (selected.formSchemaJson || stepPrompts.byCode[selected.code]?.formSchemaJson)
                                                    ? <SchemaDisciplineCard discipline={selected} caseContext={report.caseContext} liveFormSchemaJson={stepPrompts.byCode[selected.code]?.formSchemaJson ?? null} siblings={disciplines} reportID={id} />
                                                    : <DisciplineCard discipline={selected} />
                                            )}

                                            {selected.code === 'D6' && (() => {
                                                const d4 = disciplines.find((d) => d.code === 'D4');
                                                const d4RootCause = resolveD4RootCause(d4, report.caseContext);
                                                return (
                                                    <ActionChecklist
                                                        actions={caseActions}
                                                        disciplines={disciplines}
                                                        caseContext={report.caseContext}
                                                        reportID={id}
                                                        rootCause={d4RootCause !== '—' ? d4RootCause : (report.rootCauseCategory ?? '')}
                                                    />
                                                );
                                            })()}
                                        </div>
                                    );
                                }
                                if (running) {
                                    return (
                                        <Card className="p-12 flex flex-col items-center justify-center text-center space-y-3 bg-muted/20 border-dashed">
                                            <Spinner className="w-6 h-6 text-primary" />
                                            <div>
                                                <h3 className="font-semibold text-base">AI is drafting {activeDiscipline}...</h3>
                                                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                                                    Extracting facts and running analysis for {activeDiscipline}. This page updates automatically in real-time.
                                                </p>
                                            </div>
                                        </Card>
                                    );
                                }
                                return (
                                    <div className="py-12 text-center text-sm text-muted-foreground">
                                        Discipline {activeDiscipline} is not available for this report.
                                    </div>
                                );
                            })()}
                        </section>
                    </div>
                    </TabsContent>

                {/* ── Tab 2: Bằng chứng ── */}
                <TabsContent value="evidence" className="mt-0 outline-none">
                    <EvidenceTab report={report} disciplines={disciplines} focus={evidenceFocus} />
                </TabsContent>

                {/* ── Tab 3: Case Overview & AI Insights ── */}
                <TabsContent value="summary" className="mt-0 space-y-6 outline-none">
                    {/* ── Thông tin case ── */}
                    <Card className="p-5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Field label="Origin">{report.origin}</Field>
                            <Field label="Defect status">{report.sapStatus}</Field>
                            <Field label="Found">{report.foundDate ?? '—'}</Field>
                            {/*
                              Ưu tiên số + đơn vị; câu mô tả chỉ là đường lui cho các
                              case tạo trước khi hai cột đó tồn tại.
                            */}
                            <Field label="Extent">
                                {report.defectQuantity != null
                                    ? `${report.defectQuantity}${report.defectQuantityUom ? ` ${report.defectQuantityUom}` : ''}`
                                    : (report.quantityExtent || '—')}
                            </Field>

                            <Field label="Material">
                                <span className="font-mono text-sm">{report.materialId}</span>
                                <div className="text-sm text-muted-foreground">{report.materialDesc}</div>
                                {report.plant && (
                                    <div className="text-sm text-muted-foreground">Plant {report.plant}</div>
                                )}
                            </Field>
                            <Field label="Batch"><span className="font-mono text-sm">{report.batchId}</span></Field>
                            {/*
                              Nhóm mã đứng TRƯỚC mã, ngăn cách bằng "/": mã lỗi chỉ
                              duy nhất trong nhóm của nó, nên hiện mã một mình là
                              hiện một khoá thiếu vế. Case cũ không có nhóm thì chỉ
                              hiện mã — không bịa nhóm vào.
                            */}
                            <Field label="Defect">
                                <span className="font-mono text-sm">
                                    {report.defectCodeGroup ? `${report.defectCodeGroup} / ` : ''}{report.defectCode}
                                </span>
                                <div className="text-sm text-muted-foreground">{report.defectText}</div>
                                {report.defectClass && (
                                    <div className="text-sm text-muted-foreground">
                                        Severity: {report.defectClass}
                                    </div>
                                )}
                            </Field>
                            <Field label="Work center">
                                <span className="font-mono text-sm">{report.workCenterId}</span>
                                <div className="text-sm text-muted-foreground">{report.workCenterDesc}</div>
                            </Field>

                            <Field label="Root cause">{report.rootCauseCategory ?? '—'}</Field>
                            <Field label="Cost of poor quality">{formatEur(report.copqEur)}</Field>
                            <Field label="FMEA">{report.fmeaId ?? '—'}</Field>
                            <Field label="Team size">{report.teamSize ?? '—'}</Field>
                            <Field label="Reference no.">
                                <span className="font-mono text-sm">{report.referenceNumber || '—'}</span>
                            </Field>
                            {/*
                              Hai ô CUỐI vì chúng là hai ô duy nhất sửa được, và
                              gài một ô sửa được vào giữa mười ô chỉ đọc là mời
                              người dùng thử bấm vào những ô còn lại.
                            */}
                            <CaseCommitments report={report} customerFacing={customerFacing} />
                        </div>
                    </Card>

                    {/* ── Tóm tắt AI ── */}
                    {(report.internalSummary || report.customerSummary) && (
                        <Tabs defaultValue="internal">
                            <TabsList>
                                <TabsTrigger value="internal">Internal summary</TabsTrigger>
                                {customerFacing && (
                                    <TabsTrigger value="customer">Customer summary</TabsTrigger>
                                )}
                            </TabsList>

                            <TabsContent value="internal" className="mt-3">
                                <Card className="p-5 text-sm leading-relaxed">
                                    {report.internalSummary ?? '—'}
                                </Card>
                            </TabsContent>

                            {customerFacing && (
                                <TabsContent value="customer" className="mt-3">
                                    <Card className="p-5 text-sm leading-relaxed">
                                        {report.customerSummary ?? '—'}
                                        <p className="text-sm text-muted-foreground mt-3 pt-3 border-t">
                                            Written for the customer — no employee names, equipment IDs or cost figures.
                                        </p>
                                    </Card>
                                </TabsContent>
                            )}
                        </Tabs>
                    )}

                    {/* ── Vết chạy & Model AI ── */}
                    {report.analyzedAt && (
                        <Card className="p-4 bg-muted/30 border border-border/60">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-foreground flex items-center gap-1.5">
                                        <Cpu className="w-4 h-4 text-primary" />
                                        AI Models Used:
                                    </span>
                                    {report.aiModelParse && (
                                        <Badge variant="secondary" className="font-mono text-sm gap-1.5 px-2.5 py-0.5">
                                            <span className="text-sm text-muted-foreground font-sans">Parse:</span>
                                            {report.aiModelParse}
                                        </Badge>
                                    )}
                                    {report.aiModelAnalyze && (
                                        <Badge variant="secondary" className="font-mono text-sm gap-1.5 px-2.5 py-0.5">
                                            <span className="text-sm text-muted-foreground font-sans">Analyze:</span>
                                            {report.aiModelAnalyze}
                                        </Badge>
                                    )}
                                </div>

                                <div className="flex items-center gap-3 shrink-0 text-sm">
                                    <span>Generated: <strong className="font-normal text-foreground">{new Date(report.analyzedAt).toLocaleString('en-GB')}</strong></span>
                                    <span>·</span>
                                    <span>Tokens: <strong className="font-normal text-foreground">{report.tokensUsed?.toLocaleString()}</strong></span>
                                    {report.durationMs != null && (
                                        <>
                                            <span>·</span>
                                            <span>Duration: <strong className="font-normal text-foreground">{(report.durationMs / 1000).toFixed(0)}s</strong></span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </CaseProvenanceProvider>

            {/* ── Dialog Audit Log ── */}
            <Dialog open={showAudit} onOpenChange={setShowAudit}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="w-4 h-4 text-primary" />
                            Audit Trail — {report.notificationId}
                        </DialogTitle>
                        <DialogDescription>
                            Sign-offs, change requests, and status transitions recorded for this 8D case.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-1">
                        <AuditTrailPanel reportID={report.ID} />
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── JSON gốc ── */}
            <Dialog open={showPayload} onOpenChange={setShowPayload}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Source dataset — {report.notificationId}</DialogTitle>
                    </DialogHeader>
                    <PayloadViewer reportID={report.ID} />
                </DialogContent>
            </Dialog>
        </div>
    );
}

/**
 * Tải `sourcePayload` theo yêu cầu.
 *
 * Cột này nặng ~50 KB nên không nằm trong truy vấn chính — kéo về mỗi lần mở
 * trang chi tiết, và mỗi 4 giây khi đang poll, là lãng phí.
 */
function PayloadViewer({ reportID }: { reportID: string }) {
    const { data, isLoading } = useQuery({
        queryKey: ['8d', 'payload', reportID],
        queryFn: () => eightDService.getById(reportID),
        staleTime: Infinity,
    });

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
                <Spinner className="w-4 h-4" /> Loading…
            </div>
        );
    }

    let pretty = data?.sourcePayload ?? '';
    try {
        pretty = JSON.stringify(JSON.parse(pretty), null, 2);
    } catch {
        /* hiện nguyên trạng nếu không parse được */
    }

    return (
        <pre className="text-sm font-mono bg-muted rounded-lg p-4 overflow-auto max-h-[65vh]">
            {pretty}
        </pre>
    );
}

export default EightDDetailPage;
