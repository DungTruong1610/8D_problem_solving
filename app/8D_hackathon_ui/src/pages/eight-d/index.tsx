import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Spinner, cn } from '@cnma/react-ui';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { ClipboardList, Columns3, FileSpreadsheet, Info, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { exportWorklistToExcel } from './export-8d-excel';
import {
    eightDService,
    isCustomerComplaint,
    reviewStatusOf,
    type Report8D,
} from '@/services/eightd-service';
import {
    compareByUrgency,
    getCaseWorkload,
    matchesFilter,
    PRIORITY_LABEL,
    STEP_SHORT_LABEL,
    WORKLIST_FILTER_LABEL,
    type CaseWorkload,
    type WorklistFilter,
} from '@/lib/case-workload';
import { useValueHelp } from '@/hooks/use-value-help';
import { useUserInfo } from '@/hooks/use-user-info';
import { VALUE_HELP_IDS } from '@/services/value-help-service';
import { ReportStatusBadge } from './status-badge';
import { AnalyzeDialog } from './analyze-dialog';

/**
 * Danh sách báo cáo 8D — worklist.
 *
 * ── Vì sao bảng này đổi hình (Phase 3.2) ──
 * Bảng cũ trả lời "case này LÀ gì": mã, vật tư, triệu chứng, nguyên nhân, ai tạo.
 * Đó là mô tả. Một điều phối viên mở danh sách với ba mươi case mở thì hỏi ba câu
 * khác, và bảng cũ không trả lời được câu nào:
 *
 *   *cái nào cần tôi hôm nay*  — không có hạn, không có tuổi case, không có mức
 *   *nó đang tắc ở đâu*        — "0/8" không nói case đang nằm ở D4
 *   *nó nặng đến đâu*          — lỗi bóng bề mặt và hàng khách trả về hiện y hệt nhau
 *
 * Nên: thêm Severity, Current step, Days Open, Due Date, 8D Team Leader; bỏ
 * Created By (nó và Last Updated By hiện cùng một địa chỉ ở gần như mọi dòng);
 * và đẩy Root cause / CoPQ / Work centre / Plant / Created By sang bộ cột phụ.
 *
 * ── Vì sao có polling ──
 * Phân tích chạy ở nền và mất 60-90 giây. Bảng này tự làm mới mỗi 4 giây CHỪNG
 * NÀO còn ít nhất một report ở trạng thái `Analyzing`, rồi tự dừng. Poll vô điều
 * kiện sẽ gọi API mãi mãi dù chẳng có gì thay đổi.
 */

const POLL_INTERVAL_MS = 4_000;
const TOTAL_STEPS = 8;

/** Dòng của bảng: report cộng với mọi thứ suy ra được về nó, tính một lần. */
interface WorklistRow extends Report8D {
    work: CaseWorkload;
}

/**
 * Tiến độ duyệt của một case: x/8 bước đã được ký.
 *
 * Đếm theo `reviewStatus = 'Approved'`, tức chữ ký thật của con người, không
 * phải "AI đã sinh ra chữ". Report phân tích trước khi có cột duyệt đọc lên là
 * null và tính là chưa duyệt — xem `reviewStatusOf`.
 */
function CompletenessCell({ report }: { report: Report8D }) {
    const steps = report.disciplines ?? [];
    const approved = steps.filter((d) => reviewStatusOf(d) === 'Approved').length;
    const done = approved === TOTAL_STEPS;

    return (
        <div className="min-w-0">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div
                    className={cn('h-full rounded-full transition-all', done ? 'bg-success' : 'bg-primary')}
                    style={{ width: `${(approved / TOTAL_STEPS) * 100}%` }}
                />
            </div>
            <span className="mt-1 block text-sm tabular-nums text-muted-foreground">
                {approved}/{TOTAL_STEPS} steps
            </span>
        </div>
    );
}

/** Màu của mức nghiêm trọng — ba mức của FECLAS, không phải thang tự chế. */
const SEVERITY_TONE: Record<string, string> = {
    Critical: 'bg-destructive/10 text-destructive',
    Major: 'bg-warning/10 text-warning',
    Minor: 'bg-muted text-muted-foreground',
};

function formatDateTime(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatDate(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function RunningSpinner() {
    return (
        <div className="flex items-center gap-1.5 text-primary">
            <Spinner className="w-3.5 h-3.5" />
            <span className="text-sm font-medium">Analyzing…</span>
        </div>
    );
}

/**
 * Khai báo cột.
 *
 * ── Vì sao là một mảng chứ không phải JSX ──
 * Nhãn, bề rộng và cách vẽ của một cột nằm CÙNG một chỗ. Bản viết tay trước đây
 * tách header và ô ra hai nơi, nên sửa một cột phải sửa hai chỗ — và đó đúng là
 * cách cột CoPQ trôi thành canh phải ở dưới mà canh trái ở trên.
 *
 * ── Vì sao hai bộ ──
 * Bộ mặc định trả lời "cái nào cần tôi". Bộ phụ là những cột có thật nhưng không
 * thuộc câu hỏi đó: nguyên nhân gốc dài và vô nghĩa trước D4, CoPQ chỉ dùng khi
 * làm báo cáo, work centre và plant chỉ dùng khi lọc theo xưởng. Bỏ hẳn chúng là
 * mất dữ liệu; để mặc định là làm loãng đúng ba cột đáng nhìn.
 */
const CORE_COLUMNS: DataTableColumn<WorklistRow>[] = [
    {
        key: 'notificationId',
        labelKey: '8D ID',
        width: 140,
        minWidth: 120,
        className: 'font-mono text-sm font-semibold',
    },
    {
        // Mắt xích ngược về bản ghi lỗi. Hiện Ở ĐÂY chứ không chỉ ở trang chi
        // tiết, vì câu hỏi "case này mở từ lỗi nào" là câu hỏi của người quét
        // danh sách, không phải của người đã mở một case ra đọc.
        //
        // Gạch ngang KHÔNG phải lỗi dữ liệu: case nhập bằng JSON không đi qua bản
        // ghi lỗi nào, và đó là đường nhập hợp lệ.
        key: 'sourceDefectId',
        labelKey: 'Defect',
        width: 140,
        minWidth: 110,
        renderType: 'custom',
        render: (_v, row) => (
            row.sourceDefectId
                ? <span className="font-mono text-sm">{row.sourceDefectId}</span>
                : <span className="text-sm text-muted-foreground" title="Imported as JSON — no defect record">—</span>
        ),
    },
    {
        key: 'origin',
        labelKey: 'Origin',
        width: 160,
        minWidth: 130,
        renderType: 'custom',
        // Chu day du, khong phai ma Q1/Q3. Nguoi doc worklist khong phai ai cung
        // thuoc bang ma phan loai thong bao cua SAP.
        //
        // Số hiệu khiếu nại đi kèm ở dòng dưới, chỉ với Q1. Kế hoạch xin "tên
        // khách hàng" ở đây; dữ liệu không có tên khách ở bất kỳ đâu, và số hiệu
        // này là thứ duy nhất chỉ đích danh vụ việc bên phía khách — cũng là thứ
        // người ta đọc lên khi gọi cho khách.
        render: (_v, row) => {
            const q1 = isCustomerComplaint(row.origin);
            return (
                <div className="min-w-0">
                    <span
                        className={cn(
                            'inline-block rounded-full px-2.5 py-1 text-sm font-medium',
                            q1 ? 'bg-destructive/10 text-destructive' : 'bg-info/10 text-info',
                        )}
                    >
                        {q1 ? 'Customer Complaint' : 'Internal Defect'}
                    </span>
                    {q1 && row.customerRef && (
                        <div
                            className="mt-0.5 font-mono text-sm text-muted-foreground truncate"
                            title="Customer complaint reference"
                        >
                            {row.customerRef}
                        </div>
                    )}
                </div>
            );
        },
    },
    {
        key: 'materialDesc',
        labelKey: 'Material',
        width: 180,
        minWidth: 130,
        renderType: 'custom',
        // Mo ta truoc, ma sau va nho hon: "Bracket Housing X240" noi duoc voi nguoi
        // doc, con "MAT-10247" thi chi noi duoc voi he thong.
        render: (_v, row) => (
            <div className="min-w-0">
                <div className="text-sm">{row.materialDesc || row.materialId || '-'}</div>
                {row.materialDesc && row.materialId && (
                    <div className="font-mono text-sm text-muted-foreground">{row.materialId}</div>
                )}
            </div>
        ),
    },
    {
        key: 'symptomShortText',
        labelKey: 'Symptom',
        width: 300,
        minWidth: 200,
        renderType: 'custom',
        render: (_v, row) => (
            <span className="text-sm">{row.symptomShortText || '-'}</span>
        ),
    },
    {
        /**
         * Mức nghiêm trọng (SAP FECLAS).
         *
         * `Reports.defectClass` gần như luôn rỗng ở dữ liệu hiện có, nên giá trị
         * thật đến từ danh mục mã lỗi — xem `defectClassOf` ở dưới. Gạch ngang
         * nghĩa là mã lỗi không có trong danh mục, một tình huống mà bài test
         * `defectCatalogue` đã canh sẵn.
         */
        key: 'defectClass',
        labelKey: 'Severity',
        width: 110,
        minWidth: 95,
        renderType: 'custom',
        render: (_v, row) => {
            const cls = row.work.defectClass;
            if (!cls) return <span className="text-sm text-muted-foreground">—</span>;
            return (
                <span
                    className={cn(
                        'inline-block rounded-full px-2.5 py-1 text-sm font-medium',
                        SEVERITY_TONE[cls] ?? 'bg-muted text-muted-foreground',
                    )}
                    title={`${PRIORITY_LABEL[row.work.priority]} priority — ${row.work.priorityReason}`}
                >
                    {cls}
                </span>
            );
        },
    },
    {
        /**
         * Bước đang nợ chữ ký, cạnh thanh tiến độ.
         *
         * "0/8" nói case chưa xong; nó KHÔNG nói case đang nằm ở đâu. Hai case
         * cùng 3/8 mà một đang ở D4 còn một đang chờ D2 thì cần hai người khác
         * nhau. Bước bị trả lại hiện đè lên bước kế tiếp, vì nó gấp hơn.
         */
        key: 'currentStep',
        labelKey: 'Current step',
        width: 150,
        minWidth: 125,
        renderType: 'custom',
        render: (_v, row) => {
            const { currentStep, currentStepLabel, changeRequested, closed } = row.work;
            if (closed) return <span className="text-sm text-success">Signed off</span>;
            if (changeRequested.length) {
                return (
                    <span
                        className="inline-block rounded-full bg-warning/10 px-2.5 py-1 text-sm font-medium text-warning"
                        title={`Sent back for changes: ${changeRequested.join(', ')}`}
                    >
                        {changeRequested[0]} · changes
                    </span>
                );
            }
            if (!currentStep) return <span className="text-sm text-muted-foreground">—</span>;
            return (
                <span className="text-sm">
                    <span className="font-mono font-semibold">{currentStep}</span>
                    <span className="text-muted-foreground"> {currentStepLabel ?? STEP_SHORT_LABEL[currentStep]}</span>
                </span>
            );
        },
    },
    {
        key: 'disciplines',
        labelKey: 'Completeness',
        width: 130,
        minWidth: 115,
        renderType: 'custom',
        render: (_v, row) => <CompletenessCell report={row} />,
    },
    {
        key: 'status',
        labelKey: 'Status',
        width: 120,
        minWidth: 105,
        renderType: 'custom',
        render: (_v, row) => (
            row.status === 'Analyzing' ? <RunningSpinner /> : <ReportStatusBadge status={row.status} />
        ),
    },
    {
        /**
         * Số ngày case 8D đã chạy — từ lúc MỞ 8D, và dừng khi đóng.
         *
         * Không tính từ `foundDate`: độ trễ tiếp nhận là một con số riêng, ở cột
         * phụ "Response lag". Xem chú thích của `daysOpen`.
         */
        key: 'createdAt',
        labelKey: 'Days open',
        width: 105,
        minWidth: 95,
        renderType: 'custom',
        render: (_v, row) => {
            const { ageDays, closed, closureOverdue } = row.work;
            if (ageDays === null) return <span className="text-sm text-muted-foreground">—</span>;
            return (
                <span
                    className={cn(
                        'text-sm tabular-nums',
                        closureOverdue ? 'font-semibold text-destructive' : 'text-foreground',
                    )}
                    title={closed ? `Closed after ${ageDays} days` : `Opened ${formatDate(row.createdAt)}`}
                >
                    {ageDays}d{closed ? ' (closed)' : ''}
                </span>
            );
        },
    },
    {
        /**
         * Hạn hoàn tất — thứ CÓ NGƯỜI cam kết, không phải thứ suy ra được.
         *
         * Hai đường ghi vào cùng một cột: SLA thật của case Q1, hoặc một ngày do
         * người mở case tự đặt (popup mở 8D, và sửa lại được ở thẻ tổng quan —
         * `case-commitments.tsx`).
         *
         * Quyết định Q12 nói thẳng: HỆ THỐNG không bịa hạn cho case nội bộ. Một
         * hạn bịa trông y hệt hạn thật, và người đọc không có cách nào phân biệt.
         * Nó không cấm một con người tự đặt hạn cho mình — đó là điều ngược lại,
         * và là lý do ô này trống chứ không phải khoá.
         */
        key: 'slaResponseDue',
        labelKey: 'Due date',
        width: 135,
        minWidth: 115,
        renderType: 'custom',
        render: (_v, row) => {
            const { dueDate, daysUntilDue: dueIn, slaOverdue, closed } = row.work;
            if (!dueDate) {
                return (
                    <span
                        className="text-sm text-muted-foreground"
                        title="No due date committed — set one on the case overview"
                    >
                        —
                    </span>
                );
            }
            return (
                <div className="min-w-0">
                    <div className={cn('text-sm tabular-nums', slaOverdue && 'font-semibold text-destructive')}>
                        {formatDate(dueDate)}
                    </div>
                    {!closed && dueIn !== null && (
                        <div className={cn(
                            'text-sm tabular-nums',
                            slaOverdue ? 'text-destructive' : dueIn <= 3 ? 'text-warning' : 'text-muted-foreground',
                        )}>
                            {dueIn < 0 ? `${Math.abs(dueIn)}d overdue` : dueIn === 0 ? 'due today' : `in ${dueIn}d`}
                        </div>
                    )}
                </div>
            );
        },
    },
    {
        /**
         * Ai đang giữ case.
         *
         * Trưởng nhóm 8D chốt ở D1. Trước lúc đó hiện người điều phối, LÀM MỜ —
         * "đã có người tiếp nhận" và "đã có người nhận việc" là hai trạng thái
         * khác nhau, và hiện chúng giống hệt nhau là nói dối về trạng thái thứ hai.
         */
        key: 'teamLeader',
        labelKey: '8D Team Leader',
        width: 160,
        minWidth: 130,
        renderType: 'custom',
        render: (_v, row) => {
            const { owner, ownerIsFallback } = row.work;
            if (!owner) return <span className="text-sm text-muted-foreground">Unassigned</span>;
            return (
                <span
                    className={cn('text-sm truncate', ownerIsFallback ? 'text-muted-foreground italic' : 'text-foreground')}
                    title={ownerIsFallback ? 'Coordinator — 8D team leader not confirmed in D1 yet' : '8D Team Leader (D1)'}
                >
                    {owner}
                </span>
            );
        },
    },
    {
        // `Created By` bị bỏ khỏi bộ mặc định: ở gần như mọi dòng nó hiện đúng
        // cùng một địa chỉ với `Last Updated By`, nên nó chiếm chỗ mà không thêm
        // thông tin. Nó vẫn còn, ở bộ cột phụ.
        key: 'modifiedBy',
        labelKey: 'Last updated',
        width: 155,
        minWidth: 130,
        renderType: 'custom',
        render: (_v, row) => (
            <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                    {row.modifiedBy || row.createdBy || 'System'}
                </div>
                <div className="text-sm text-muted-foreground tabular-nums mt-0.5">
                    {formatDateTime(row.modifiedAt || row.createdAt)}
                </div>
            </div>
        ),
    },
];

/** Bộ cột phụ — có thật, chỉ không thuộc câu hỏi "cái nào cần tôi hôm nay". */
const OPTIONAL_COLUMNS: DataTableColumn<WorklistRow>[] = [
    {
        key: 'rootCauseCategory',
        labelKey: 'Root cause',
        width: 200,
        minWidth: 150,
        renderType: 'custom',
        // Vô nghĩa trước D4 và dài sau D4 — hai lý do để nó không nằm ở bộ mặc định.
        render: (_v, row) => (
            <span className="text-sm text-muted-foreground">{row.rootCauseCategory || '—'}</span>
        ),
    },
    {
        /**
         * Độ trễ tiếp nhận: phát hiện lỗi → mở 8D.
         *
         * Đây là con số mà chú thích cũ của `ageInDays` lo lắng, giờ đứng riêng.
         * Nó đo khâu tiếp nhận, không đo tiến độ case — hai việc, hai người, hai cột.
         */
        key: 'foundDate',
        labelKey: 'Response lag',
        width: 130,
        minWidth: 110,
        renderType: 'custom',
        render: (_v, row) => {
            const lag = row.work.responseLagDays;
            if (lag === null) return <span className="text-sm text-muted-foreground">—</span>;
            return (
                <span
                    className={cn('text-sm tabular-nums', lag > 7 ? 'text-warning' : 'text-muted-foreground')}
                    title={`Defect found ${formatDate(row.foundDate)}, 8D opened ${formatDate(row.createdAt)}`}
                >
                    {lag}d
                </span>
            );
        },
    },
    {
        key: 'copqEur',
        labelKey: 'CoPQ (EUR)',
        width: 130,
        minWidth: 110,
        renderType: 'custom',
        render: (_v, row) => {
            const value = row.copqEur === null || row.copqEur === undefined ? null : Number(row.copqEur);
            return (
                <span className="text-sm tabular-nums">
                    {value === null || Number.isNaN(value)
                        ? '—'
                        : value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                </span>
            );
        },
    },
    {
        key: 'workCenterDesc',
        labelKey: 'Work centre',
        width: 170,
        minWidth: 130,
        renderType: 'custom',
        render: (_v, row) => (
            <div className="min-w-0">
                <div className="text-sm truncate">{row.workCenterDesc || row.workCenterId || '—'}</div>
                {row.workCenterDesc && row.workCenterId && (
                    <div className="font-mono text-sm text-muted-foreground">{row.workCenterId}</div>
                )}
            </div>
        ),
    },
    {
        key: 'plant',
        labelKey: 'Plant',
        width: 90,
        minWidth: 80,
        renderType: 'custom',
        render: (_v, row) => <span className="font-mono text-sm">{row.plant || '—'}</span>,
    },
    {
        key: 'createdBy',
        labelKey: 'Created by',
        width: 155,
        minWidth: 130,
        renderType: 'custom',
        render: (_v, row) => (
            <div className="min-w-0">
                <div className="text-sm truncate">{row.createdBy || 'System'}</div>
                <div className="text-sm text-muted-foreground tabular-nums mt-0.5">
                    {formatDateTime(row.createdAt)}
                </div>
            </div>
        ),
    },
];

/** Thứ tự chip: bốn chip của kế hoạch trước, rồi các lát cắt cũ. */
const FILTER_ORDER: WorklistFilter[] = [
    'all',
    'mine',
    'overdue',
    'critical',
    'awaitingApproval',
    'changeRequested',
    'inProcess',
    'customer',
    'closed',
];

export function EightDListPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [analyzeOpen, setAnalyzeOpen] = useState(false);
    const [filter, setFilter] = useState<WorklistFilter>('all');
    const [showOptional, setShowOptional] = useState(false);
    const { userInfo } = useUserInfo();

    /**
     * Report vừa được xếp lịch: BỎ cache của bảng trước khi rời trang.
     *
     * Không bỏ thì cache còn giữ danh sách chụp TRƯỚC khi report tồn tại. Lúc
     * người dùng bấm back, bảng dựng lại từ đúng bản chụp đó — thiếu hàng mới, và
     * vì thiếu nên `refetchInterval` không thấy ai đang `Analyzing` nên không bao
     * giờ bật polling. Bảng đứng im chứ không phải chậm.
     */
    const goToNewReport = (reportID: string) => {
        void queryClient.invalidateQueries({ queryKey: ['8d'] });
        navigate(`/8d/${reportID}`);
    };

    const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
        queryKey: ['8d', 'reports'],
        queryFn: () => eightDService.list(),
        // Mặc định toàn cục là staleTime 5 phút — SAI cho bảng này. Quay lại từ
        // trang chi tiết trong vòng 5 phút thì React Query coi cache còn tươi và
        // không hỏi lại, nên bảng thiếu hẳn report vừa tạo. Tệ hơn: thiếu hàng đó
        // thì `refetchInterval` dưới đây thấy không có ai `Analyzing` và tắt luôn
        // polling — bảng đứng im vĩnh viễn chứ không phải chậm vài giây.
        staleTime: 0,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
        // Tự động làm mới: khi có case Analyzing thì poll nhanh mỗi 4s;
        // khi không có case Analyzing thì vẫn poll nền mỗi 6s để tự động đón
        // case mới mở từ Defect Records hay tab khác mà không cần người dùng bấm F5.
        refetchInterval: (query) => {
            const rows = query.state.data?.value ?? [];
            return rows.some((r: Report8D) => r.status === 'Analyzing') ? POLL_INTERVAL_MS : 6_000;
        },
        // Một lượt phân tích mất 3-5 phút; không ai ngồi nhìn hết chừng đó. Mặc
        // định React Query dừng đếm giờ khi tab bị ẩn, nên đổi tab rồi quay lại
        // là thấy trạng thái cũ. Cho chạy tiếp cả khi tab ở nền.
        refetchIntervalInBackground: true,
    });

    /**
     * Danh mục mã lỗi, chỉ để tra ra Severity.
     *
     * `Reports.defectClass` rỗng ở gần hết dữ liệu hiện có, nhưng defect class là
     * thuộc tính của MÃ chứ không phải của một lần xảy ra lỗi — nên tra từ danh
     * mục là đúng bản chất, không phải đường vòng. Cùng nguồn F4 mà form ghi nhận
     * lỗi dùng, nên hai màn hình không thể nói hai mức khác nhau cho cùng một mã.
     */
    const defectCodes = useValueHelp(VALUE_HELP_IDS.defectCode);
    const defectClassOf = useMemo(() => {
        const byCode = new Map<string, string>();
        for (const entry of defectCodes.entries) {
            const key = String(entry.key ?? '').trim().toUpperCase();
            const cls = String(entry.defectClass ?? '').trim();
            if (key && cls) byCode.set(key, cls);
        }
        return (code: string | null | undefined) =>
            byCode.get(String(code ?? '').trim().toUpperCase()) ?? null;
    }, [defectCodes.entries]);

    /**
     * Danh tính của người đang đăng nhập, để chip "My cases" so được.
     *
     * Nhiều dạng vì cột chủ sở hữu lưu TÊN người lấy từ danh bạ Business Partner,
     * còn phiên đăng nhập biết display name / email / id — ba thứ không nhất thiết
     * viết giống nhau. Xem `isMyCase`.
     */
    const identities = useMemo(
        () => [userInfo.displayName, userInfo.name, userInfo.email, userInfo.id].filter(Boolean),
        [userInfo.displayName, userInfo.name, userInfo.email, userInfo.id],
    );

    const rows = useMemo<WorklistRow[]>(() => {
        const list = (data?.value ?? []).map((report) => ({
            ...report,
            work: getCaseWorkload(report, defectClassOf),
        }));
        // Sắp theo mức gấp, KHÔNG theo `createdAt desc` như trước: "cái nào mới
        // nhất" là câu không ai hỏi khi mở worklist, và nó đẩy đúng case gấp nhất
        // (thường là case cũ nhất) xuống cuối bảng.
        return list.sort(compareByUrgency);
    }, [data, defectClassOf]);

    /** Đếm cho từng chip: một chip rỗng phải nhìn ra là rỗng, không phải là hỏng. */
    const counts = useMemo(() => {
        const out = {} as Record<WorklistFilter, number>;
        for (const key of FILTER_ORDER) {
            out[key] = rows.filter((r) => matchesFilter(r.work, key, identities)).length;
        }
        return out;
    }, [rows, identities]);

    const visibleRows = useMemo(
        () => rows.filter((r) => matchesFilter(r.work, filter, identities)),
        [rows, filter, identities],
    );

    const columns = useMemo(
        () => (showOptional ? [...CORE_COLUMNS, ...OPTIONAL_COLUMNS] : CORE_COLUMNS),
        [showOptional],
    );

    const running = rows.filter((r) => r.status === 'Analyzing').length;

    return (
        <div className="p-6 md:p-8 w-full min-w-0 space-y-6">
            {/* ── Tiêu đề & thanh thao tác ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                        <ClipboardList className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">8D Reports</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Open cases first, most urgent at the top — by severity, customer commitment, then age
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            try {
                                exportWorklistToExcel(visibleRows);
                                toast.success(`Exported ${visibleRows.length} 8D cases to Excel!`);
                            } catch (err: any) {
                                toast.error(`Export failed: ${err?.message ?? err}`);
                            }
                        }}
                        title="Export current 8D worklist to Excel"
                        className="gap-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 font-semibold shadow-2xs"
                    >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        Export Excel
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowOptional((v) => !v)}
                        title="Root cause, response lag, CoPQ, work centre, plant, created by"
                    >
                        <Columns3 className="w-4 h-4" />
                        {showOptional ? 'Fewer columns' : 'More columns'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                        <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
                        Refresh
                    </Button>
                    <Button size="sm" onClick={() => setAnalyzeOpen(true)}>
                        <Sparkles className="w-4 h-4" />
                        Create 8D Report
                    </Button>
                </div>
            </div>

            {running > 0 && (
                <div className="flex items-center gap-2 text-sm text-info bg-info/5 border border-info/20 rounded-lg px-3.5 py-2.5">
                    <Spinner className="w-3.5 h-3.5" />
                    {running} analysis running — this page refreshes automatically. Each run takes about 3 minutes.
                </div>
            )}

            {/*
              ── Chip lọc ──
              Câu hỏi thật sự khi mở worklist là "cái nào cần tôi", và hôm qua nó
              chỉ trả lời được bằng cách đọc từng dòng. Con số trên mỗi chip là cố
              ý: một chip rỗng phải nhìn ra được là rỗng THẬT, chứ không giống một
              bộ lọc hỏng.
            */}
            <div className="flex flex-wrap items-center gap-1.5">
                {FILTER_ORDER.map((key) => {
                    const active = filter === key;
                    const count = counts[key] ?? 0;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setFilter(key)}
                            className={cn(
                                'rounded-full border px-3 py-1.5 text-sm transition-colors',
                                active
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : count === 0
                                        ? 'border-border/60 text-muted-foreground/60 hover:bg-muted'
                                        : 'border-border text-foreground hover:bg-muted',
                            )}
                        >
                            {WORKLIST_FILTER_LABEL[key]}
                            <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* ── Banner giải thích ── */}
            <Card className="p-4 bg-muted/40 border border-border/60">
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                        <span className="font-semibold text-foreground">Reading this list:</span>{' '}
                        <span className="font-medium text-foreground">Days open</span> counts from when the 8D was
                        opened, not from when the defect was found — that delay is its own column,{' '}
                        <span className="font-medium text-foreground">Response lag</span>, under More columns.{' '}
                        <span className="font-medium text-foreground">Due date</span> is a commitment somebody made:
                        the customer SLA on a complaint, or a date the team set for itself. It is never invented —
                        an empty cell means nobody has committed to one yet.
                    </div>
                </div>
            </Card>

            {/* ── Trạng thái tải / lỗi ── */}
            {isLoading && (
                <div className="flex justify-center p-12">
                    <Spinner className="w-6 h-6 text-primary" />
                </div>
            )}

            {isError && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
                    Failed to load reports: {(error as Error).message}
                </div>
            )}

            <DataTable<WorklistRow>
                data={visibleRows}
                columns={columns}
                isLoading={isLoading}
                error={isError ? (error as Error) : null}
                onRowClick={(row) => navigate(`/8d/${row.ID}`)}
                emptyMessageKey={
                    filter === 'all'
                        ? 'No 8D reports yet. Click Create 8D Report to start an analysis.'
                        : `No cases match "${WORKLIST_FILTER_LABEL[filter]}".`
                }
                errorMessageKey="Failed to load reports."
            />

            <AnalyzeDialog
                open={analyzeOpen}
                onOpenChange={setAnalyzeOpen}
                onScheduled={goToNewReport}
            />
        </div>
    );
}

export default EightDListPage;
