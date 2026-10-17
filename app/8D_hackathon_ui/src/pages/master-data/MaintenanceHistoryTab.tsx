import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, Card, Spinner, cn } from '@cnma/react-ui';
import { AlertCircle, ChevronDown, ChevronRight, Info, RefreshCw, Wrench } from 'lucide-react';
import {
    eightDService,
    listMaintenanceHistory,
    type MaintenanceHistoryRow,
    type Report8D,
} from '@/services/eightd-service';

/**
 * Lịch sử bảo trì theo loại lỗi — CHỈ ĐỌC.
 *
 * Không phải một bảng dữ liệu: là góc nhìn tính ra trên các đề xuất D7 đã được kỹ
 * sư duyệt. Duyệt / từ chối vẫn chỉ ở D7, nên tab này không có nút tạo, sửa, xoá.
 * Con số nào không có trong dữ liệu thì nói thẳng là không có, không điền thay.
 */

const CONTROL_LABEL: Record<string, string> = {
    'preventive-maintenance': 'Preventive maintenance',
    calibration: 'Calibration',
    'error-proofing': 'Error-proofing (poka-yoke)',
    'work-instruction': 'Work instruction',
    'incoming-inspection': 'Incoming inspection',
    'condition-monitoring': 'Condition monitoring',
    'inspection-frequency': 'Increase inspection frequency',
};

const ALL = '__all__';
const controlLabel = (t: string) => CONTROL_LABEL[t] ?? t;

const formatInterval = (p: MaintenanceHistoryRow) => {
    if (!p.interval) return null;
    const { limit, actual, unit } = p.interval;
    return `${limit.toLocaleString('en-GB')} ${unit}${actual != null ? ` (actual ${actual.toLocaleString('en-GB')})` : ''}`;
};

const formatDate = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

export function MaintenanceHistoryTab() {
    const navigate = useNavigate();
    const [workCenter, setWorkCenter] = useState(ALL);
    const [controlType, setControlType] = useState(ALL);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
        queryKey: ['master-data', 'maintenance-history'],
        queryFn: listMaintenanceHistory,
        // Duyệt diễn ra ở D7, trang khác — giữ cache 5 phút mặc định thì vừa duyệt
        // xong mở tab này vẫn thấy "chưa có gì". Mở tab là đọc lại.
        staleTime: 0,
    });
    const groups = useMemo(() => data ?? [], [data]);

    const workCenters = useMemo(() => [...new Set(groups.map((g) => g.workCenterId))].sort(), [groups]);
    const controlTypes = useMemo(
        () => [...new Set(groups.flatMap((g) => g.proposals.map((p) => p.controlType)))].sort(),
        [groups],
    );

    const visible = groups
        .filter((g) => workCenter === ALL || g.workCenterId === workCenter)
        .map((g) => ({ ...g, proposals: g.proposals.filter((p) => controlType === ALL || p.controlType === controlType) }))
        .filter((g) => g.proposals.length > 0);

    const openCase = async (notificationId: string, row: MaintenanceHistoryRow) => {
        if (notificationId === row.notificationId) {
            navigate(`/8d/${row.reportID}`);
            return;
        }
        try {
            const found = (await eightDService.list()).value?.find((r: Report8D) => r.notificationId === notificationId);
            if (found) navigate(`/8d/${found.ID}`);
            else toast.info(`${notificationId} is a closed case in the case library - it has no 8D report in this system.`, {
                description: 'Its details are under Master Data → Closed Case Library.',
            });
        } catch (e) {
            toast.error(`Could not open case: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    const selectClass = 'h-9 rounded-md border border-input bg-background px-2 text-sm';

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    <select aria-label="Filter by work center" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)} className={selectClass}>
                        <option value={ALL}>All work centers</option>
                        {workCenters.map((wc) => <option key={wc} value={wc}>{wc}</option>)}
                    </select>
                    <select aria-label="Filter by control type" value={controlType} onChange={(e) => setControlType(e.target.value)} className={selectClass}>
                        <option value={ALL}>All control types</option>
                        {controlTypes.map((t) => <option key={t} value={t}>{controlLabel(t)}</option>)}
                    </select>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-9 gap-1.5 text-sm">
                    <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
                    Refresh
                </Button>
            </div>

            <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                History is derived from root causes (D4) and preventive actions (D7) approved by engineers. No predictions are used.
            </p>

            <Card className="overflow-hidden border border-border/80 shadow-xs" data-testid="maintenance-history-table">
                {isLoading ? (
                    <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
                        <Spinner className="h-4 w-4" /> Loading maintenance history…
                    </div>
                ) : isError ? (
                    <div className="p-8 text-center text-sm text-destructive">
                        <AlertCircle className="mx-auto mb-2 h-6 w-6" />
                        Failed to load data: {(error as Error)?.message}
                    </div>
                ) : groups.length === 0 ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                        <Wrench className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                        No maintenance plan has been approved yet — approve a proposal in step D7 of a report.
                    </div>
                ) : visible.length === 0 ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">No approved proposals match these filters.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-border/80 bg-muted/50 font-semibold text-muted-foreground">
                                    <th className="w-8 py-3 pl-4" />
                                    <th className="min-w-[200px] px-4 py-3">Defect Type</th>
                                    <th className="min-w-[140px] px-4 py-3">Work Center</th>
                                    <th className="min-w-[160px] px-4 py-3">Control Type</th>
                                    <th className="w-28 px-4 py-3 text-right">Occurrences</th>
                                    <th className="w-32 px-4 py-3 text-right">Latest Gap</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {visible.map((g) => {
                                    const key = `${g.defectCode}|${g.workCenterId}`;
                                    const open = expanded[key] ?? true;
                                    return (
                                        <Fragment key={key}>
                                            <tr
                                                className="cursor-pointer transition-colors hover:bg-muted/30"
                                                onClick={() => setExpanded((e) => ({ ...e, [key]: !open }))}
                                            >
                                                <td className="py-3 pl-4 text-muted-foreground">
                                                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-mono font-bold text-foreground">{g.defectCode}</div>
                                                    {g.defectText && <div className="text-muted-foreground">{g.defectText}</div>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-mono font-semibold text-foreground">{g.workCenterId}</div>
                                                    {g.workCenterDesc && <div className="text-muted-foreground">{g.workCenterDesc}</div>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {[...new Set(g.proposals.map((p) => controlLabel(p.controlType)))].join(', ')}
                                                    <div className="text-xs text-muted-foreground">
                                                        {g.proposals.length} approved proposal{g.proposals.length === 1 ? '' : 's'}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums">{g.occurrenceCount}</td>
                                                <td className="px-4 py-3 text-right tabular-nums">
                                                    {g.latestGapDays != null
                                                        ? `${g.latestGapDays} days`
                                                        : <span className="text-muted-foreground">Insufficient data</span>}
                                                </td>
                                            </tr>
                                            {open && (
                                                <tr className="bg-muted/20">
                                                    <td />
                                                    <td colSpan={5} className="px-4 pb-4 pt-1">
                                                        <table className="w-full text-left text-sm" data-testid="maintenance-history-proposals">
                                                            <thead>
                                                                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                                                                    <th className="py-2 pr-4 font-semibold">Control Type</th>
                                                                    <th className="py-2 pr-4 font-semibold">Required Action</th>
                                                                    <th className="py-2 pr-4 font-semibold">Frequency / Limit</th>
                                                                    <th className="py-2 pr-4 font-semibold">Approved By</th>
                                                                    <th className="py-2 font-semibold">Source Cases</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-border/40">
                                                                {g.proposals.map((p) => (
                                                                    <tr key={`${p.reportID}-${p.id}`} className="align-top">
                                                                        <td className="py-2 pr-4 font-medium">{controlLabel(p.controlType)}</td>
                                                                        <td className="max-w-md py-2 pr-4">
                                                                            {p.task}
                                                                            {p.note && <div className="mt-0.5 text-xs text-muted-foreground">Note: “{p.note}”</div>}
                                                                        </td>
                                                                        <td className="py-2 pr-4">
                                                                            {formatInterval(p) ?? <span className="text-muted-foreground">No measurement available</span>}
                                                                        </td>
                                                                        <td className="whitespace-nowrap py-2 pr-4">
                                                                            {p.decidedBy ?? '-'}
                                                                            <div className="text-xs text-muted-foreground">{formatDate(p.decidedAt)}</div>
                                                                        </td>
                                                                        <td className="py-2">
                                                                            <div className="flex flex-wrap gap-2">
                                                                                {p.sourceCaseIds.map((id) => (
                                                                                    <button
                                                                                        key={id}
                                                                                        type="button"
                                                                                        onClick={() => openCase(id, p)}
                                                                                        className="font-mono text-destructive underline underline-offset-2 hover:opacity-80"
                                                                                    >
                                                                                        {id}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
