import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    Spinner,
    Textarea,
    cn,
} from '@cnma/react-ui';
import { AlertCircle, ArrowLeft, Braces, Search, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { eightDService } from '@/services/eightd-service';
import { defectsService, type DefectItem } from '@/services/defect-service';
import { ValueHelpInput } from '@/components/ui/ValueHelpInput';
import { useValueHelp } from '@/hooks/use-value-help';
import { VALUE_HELP_IDS } from '@/services/value-help-service';
import { ORIGIN_CUSTOMER } from '@/pages/create-defect';

/**
 * Mở một báo cáo 8D.
 *
 * ── Đường chính và đường phụ ──
 * Đường CHÍNH là mở 8D từ một lỗi đã ghi nhận: đó là chuỗi nghiệp vụ thật của SAP
 * QM — lỗi có trước, 8D là quyết định đến sau. Nó chiếm toàn bộ hộp thoại.
 *
 * Đường PHỤ là nhập một case dạng JSON (dán, tải file, hoặc lấy một sự vụ mẫu).
 * Nó tồn tại để nhập dữ liệu từ hệ thống khác và để demo, nhưng ba đường vào cùng
 * hiện một lúc thì hộp thoại trông như bốn việc ngang hàng nhau — và người dùng
 * mới không đoán được việc nào là việc của mình. Nên cả ba nằm sau MỘT nút biểu
 * tượng `{}` ở góc trên.
 *
 * ── Vì sao có bước xem trước ──
 * Bấm mở 8D là hành động KHÔNG lùi được: nó cấp một số báo cáo từ dải số và lật
 * bản ghi lỗi sang `In Process`. Bản trước gọi thẳng `startEightD` ngay trên cú
 * nhấp vào một dòng danh sách chỉ hiện ba mẩu thông tin. Chọn nhầm dòng là phải
 * đi dọn dữ liệu. Nên chọn và xác nhận là hai nhịp: nhịp một chọn, nhịp hai xem
 * đủ vật tư / lô / nhà máy / trạm / phân loại / kết quả đo rồi mới bấm.
 *
 * ── Vì sao validate JSON ở phía client ──
 * Không phải để thay backend — backend mới là nơi quyết định. Chỉ là JSON hỏng cú
 * pháp hoặc dán nhầm file thì bắt ngay tại chỗ rẻ hơn nhiều so với đi một vòng
 * server, và thông báo cũng cụ thể hơn.
 *
 * ⚠️ Kiểm tra dưới đây phải KHÔNG chặt hơn `extractDeepCase` ở
 * `srv/src/domain/eightd/caseMapper.ts`. Chặt hơn thì UI từ chối đúng những file
 * mà backend xử lý được — đó chính là lỗi đã xảy ra khi mock data chuyển sang
 * Deep Structure còn hàm này vẫn chỉ tìm `data.notifications`.
 */

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Gọi khi report đã được xếp lịch; nhận ID để điều hướng sang trang chi tiết. */
    onScheduled: (reportID: string) => void;
}

/**
 * Bóc lớp bọc của OData (`value: [ … ]`). Export SAP thật luôn có lớp này; file
 * viết tay thì không, nên phải chịu được cả hai.
 */
function unwrapOData(raw: any): any {
    if (!raw || typeof raw !== 'object' || !('value' in raw)) return raw;
    if (Array.isArray(raw.value)) return raw.value[0] ?? null;
    if (raw.value && typeof raw.value === 'object') return raw.value;
    return raw;
}

/** Kiểm tra nhanh xem chuỗi có phải một case 8D không, và lấy mã case. */
function inspect(text: string): { ok: true; caseId: string } | { ok: false; reason: string } {
    if (!text.trim()) return { ok: false, reason: 'Paste or upload a JSON case file first.' };

    let parsed: any;
    try {
        parsed = JSON.parse(text);
    } catch (e: any) {
        return { ok: false, reason: `Not valid JSON — ${e.message}` };
    }

    const obj = unwrapOData(parsed);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return { ok: false, reason: 'Expected a JSON object describing one defect case.' };
    }

    // Deep Structure Business JSON — định dạng chính hiện nay.
    const nid = obj.notificationId ?? obj.notification_id ?? obj.notification ?? obj.ID ?? obj.document;
    if (nid || obj.symptomShortText || obj.symptom_short_text) {
        return { ok: true, caseId: String(nid ?? 'unknown') };
    }

    // Golden Dataset cũ — vẫn nhận, bộ mock-data/beta còn ở định dạng này.
    if (Array.isArray(obj.data?.notifications) && obj.data.notifications.length > 0) {
        return { ok: true, caseId: String(obj.data.notifications[0]?.notification_id ?? 'unknown') };
    }
    if (obj.nested_case_view?.notification_id) {
        return { ok: true, caseId: String(obj.nested_case_view.notification_id) };
    }

    return {
        ok: false,
        reason:
            'This is valid JSON but not a defect case — expected a top-level "notificationId", ' +
            'or a "data.notifications" block.',
    };
}

/**
 * Sự vụ mẫu gói theo bundle UI.
 *
 * Có mặt vì bắt người dùng đi tìm file JSON trên máy là không demo được, và
 * người thử app cũng không có repo. Danh sách do `scripts/bundle-library.mjs`
 * sinh ra từ `mock-data/incoming/`.
 */
interface SampleIssue {
    file: string;
    notificationId: string;
    origin: string;
    symptom: string;
    workCenter: string | null;
    material: string | null;
    investigated: boolean;
}

/** Số ngày kể từ khi phát hiện lỗi. `null` khi không có ngày để đếm. */
function daysSince(isoDate: string | null | undefined): number | null {
    if (!isoDate) return null;
    const then = Date.parse(isoDate);
    if (Number.isNaN(then)) return null;
    return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

/** Một dòng của bảng xem trước. Để trống thì không vẽ — thà thiếu dòng còn hơn thừa dấu gạch. */
function PreviewRow({ label, value }: { label: string; value: string | null | undefined }) {
    if (!value) return null;
    return (
        <div className="flex min-w-0 gap-2 py-1">
            <span className="w-28 shrink-0 text-sm text-muted-foreground">{label}</span>
            <span className="min-w-0 flex-1 break-words text-sm font-medium">{value}</span>
        </div>
    );
}

/** Phân loại nguồn gốc lỗi QM SAP: Q1 (khách hàng), Q2 (nhà cung cấp), Q3 (nội bộ). */
function getDefectCategory(origin?: string | null): 'Q1' | 'Q2' | 'Q3' | 'Other' {
    const s = String(origin ?? '').trim().toUpperCase();
    if (s.startsWith('Q1')) return 'Q1';
    if (s.startsWith('Q2')) return 'Q2';
    if (s.startsWith('Q3')) return 'Q3';
    return 'Other';
}

/** Huy hiệu hiển thị loại defect chuẩn SAP QM với màu sắc phân biệt trực quan. */
function DefectTypeBadge({ origin }: { origin?: string | null }) {
    const cat = getDefectCategory(origin);
    const label =
        cat === 'Q1' ? 'Q1' :
        cat === 'Q2' ? 'Q2' :
        cat === 'Q3' ? 'Q3' : 'Other';

    const fullTitle =
        cat === 'Q1' ? 'Q1 - Customer Complaint' :
        cat === 'Q2' ? 'Q2 - Supplier Defect' :
        cat === 'Q3' ? 'Q3 - Internal Defect' : (origin || 'Unknown origin');

    return (
        <span
            title={fullTitle}
            className={cn(
                'inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold shrink-0 border font-mono tracking-tight min-w-[30px]',
                cat === 'Q1' && 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
                cat === 'Q2' && 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
                cat === 'Q3' && 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
                cat === 'Other' && 'bg-muted text-muted-foreground border-border',
            )}
        >
            {label}
        </span>
    );
}

export function AnalyzeDialog({ open, onOpenChange, onScheduled }: Props) {
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [samples, setSamples] = useState<SampleIssue[]>([]);
    const [defects, setDefects] = useState<DefectItem[] | null>(null);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<'ALL' | 'Q1' | 'Q2' | 'Q3'>('ALL');
    const [showImport, setShowImport] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // Lỗi đang được xem trước, và bản chi tiết của nó. `selected` đến từ danh sách
    // (đủ để vẽ tiêu đề ngay), `detail` đến sau qua một lượt gọi riêng — danh sách
    // không mang nhóm mã, hạn SLA hay kết quả đo.
    const [selected, setSelected] = useState<DefectItem | null>(null);
    const [detail, setDetail] = useState<DefectItem | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Hai cam kết của con người. Không suy ra được từ bản ghi lỗi — xem
    // `startEightD` ở `EightDService.cds`.
    const [dueDate, setDueDate] = useState('');
    const [coordinator, setCoordinator] = useState('');

    // Danh mục đối tác chỉ nạp khi hộp thoại mở: không ai cần nó ở màn hình danh
    // sách case, và nạp sẵn là một lượt gọi mạng cho một ô có thể không bao giờ
    // hiện ra.
    const partnerVh = useValueHelp(VALUE_HELP_IDS.partner, { enabled: open });

    useEffect(() => {
        if (!open || samples.length) return;
        // Không có mẫu cũng không sao — dán tay vẫn là đường thoát.
        fetch('samples/index.json')
            .then((r) => (r.ok ? r.json() : []))
            .then(setSamples)
            .catch(() => setSamples([]));
    }, [open, samples.length]);

    // Nạp lại MỖI LẦN mở, không cache: danh sách này là "lỗi chưa có 8D", và một
    // 8D vừa được người khác mở ra sẽ làm nó sai ngay. Hiện một dòng đã bị chiếm
    // thì người dùng bấm vào chỉ để nhận 409.
    useEffect(() => {
        if (!open) return;
        let alive = true;
        setDefects(null);
        defectsService
            .listStartable()
            .then((rows) => { if (alive) setDefects(rows); })
            .catch(() => { if (alive) setDefects([]); });
        return () => { alive = false; };
    }, [open]);

    /** Thống kê số lượng theo loại defect Q1, Q2, Q3 cho các nút filter */
    const typeCounts = useMemo(() => {
        const counts = { ALL: 0, Q1: 0, Q2: 0, Q3: 0 };
        if (!defects) return counts;
        counts.ALL = defects.length;
        for (const d of defects) {
            const cat = getDefectCategory(d.origin);
            if (cat === 'Q1') counts.Q1++;
            else if (cat === 'Q2') counts.Q2++;
            else if (cat === 'Q3') counts.Q3++;
        }
        return counts;
    }, [defects]);

    /**
     * Lọc ở phía client theo từ khóa tìm kiếm và loại defect Q1, Q2, Q3.
     */
    const visibleDefects = useMemo(() => {
        if (!defects) return null;
        let list = defects;
        if (filterType !== 'ALL') {
            list = list.filter((d) => getDefectCategory(d.origin) === filterType);
        }
        const q = search.trim().toLowerCase();
        if (!q) return list;
        return list.filter((d) =>
            [d.defectId, d.symptomShortText, d.defectText, d.origin]
                .some((f) => String(f ?? '').toLowerCase().includes(q)));
    }, [defects, search, filterType]);

    /**
     * Chọn một lỗi để xem trước. KHÔNG mở 8D — xem chú thích đầu file.
     *
     * Bản chi tiết nạp ở nền: tiêu đề và những trường danh sách đã có thì vẽ ngay,
     * phần còn lại điền vào khi về. Chặn cả khối cho đến khi mạng trả lời là bắt
     * người dùng nhìn một ô trống trong khi dữ liệu họ cần đã có sẵn một nửa.
     */
    function selectDefect(d: DefectItem) {
        setSelected(d);
        setDetail(null);
        setError(null);
        setDetailLoading(true);
        // Mặc định từ những gì danh sách đã biết; lượt chi tiết sẽ ghi đè.
        setDueDate('');
        setCoordinator(d.coordinator ?? '');

        defectsService
            .getWithCharacteristics(d.ID)
            .then((full) => {
                setDetail(full);
                // Hạn mặc định LẤY TỪ SLA và chỉ ở case hướng khách hàng (Q1). Case
                // nội bộ để trống: quyết định Q12 cấm hệ thống bịa một hạn không ai
                // hứa. Người dùng vẫn tự đặt được — ô này để trống chứ không khoá.
                setDueDate(full.origin === ORIGIN_CUSTOMER ? (full.slaResponseDue ?? '') : '');
                setCoordinator(full.coordinator ?? '');
            })
            .catch(() => { /* xem trước thiếu vẫn hơn không xem được */ })
            .finally(() => setDetailLoading(false));
    }

    /**
     * Mở 8D từ lỗi đang xem trước.
     *
     * Không dựng payload ở đây: server đọc thẳng bảng `Defects`. Đó là khác biệt
     * thật giữa nút này và đường nhập JSON — dữ liệu case không đi qua trình
     * duyệt, nên không có gì để sai lệch trên đường truyền. Hai trường gửi kèm là
     * ngoại lệ duy nhất, vì chúng không tồn tại ở đâu để mà đọc.
     */
    async function startFromDefect(d: DefectItem) {
        setBusy(true);
        setError(null);
        try {
            const reportID = await defectsService.startEightD(d.defectId, { dueDate, coordinator });
            toast.success(`Analysis scheduled for defect ${d.defectId}`, {
                description: 'This takes about 3 minutes. The page updates automatically.',
            });
            reset();
            onOpenChange(false);
            onScheduled(reportID);
        } catch (e: any) {
            setError(
                e?.response?.data?.error?.message ??
                e?.message ??
                'Could not start the 8D for this defect.',
            );
            setBusy(false);
            // 409 nghĩa là danh sách đã cũ — nạp lại để dòng đó biến mất, và bỏ
            // luôn phần xem trước: nó đang mô tả một lỗi không còn chọn được nữa.
            setSelected(null);
            setDetail(null);
            defectsService.listStartable().then(setDefects).catch(() => { /* giữ nguyên */ });
        }
    }

    async function loadSample(s: SampleIssue) {
        setError(null);
        try {
            const res = await fetch(`samples/${s.file}`);
            if (!res.ok) throw new Error(`${res.status}`);
            setText(JSON.stringify(await res.json(), null, 2));
        } catch (e: any) {
            setError(`Could not load the sample: ${e.message}`);
        }
    }

    const check = text ? inspect(text) : null;

    const reset = () => {
        setText('');
        setError(null);
        setBusy(false);
        setSearch('');
        setFilterType('ALL');
        setShowImport(false);
        setSelected(null);
        setDetail(null);
        setDueDate('');
        setCoordinator('');
    };

    async function handleFile(file: File) {
        setError(null);
        const content = await file.text();
        setText(content);
    }

    async function submit() {
        const result = inspect(text);
        if (!result.ok) {
            setError(result.reason);
            return;
        }

        setBusy(true);
        setError(null);

        try {
            const reportID = await eightDService.analyzeFromJson(text);
            toast.success(`Analysis scheduled for ${result.caseId}`, {
                // Con số đo được, không phải ước lượng: ~3 phút cho một case điển
                // hình. Hứa 60-90 giây thì đúng lúc chạy bình thường người dùng
                // đã tưởng hệ thống treo và bấm lại.
                description: 'This takes about 3 minutes. The page updates automatically.',
            });
            reset();
            onOpenChange(false);
            onScheduled(reportID);
        } catch (e: any) {
            // Backend trả về lý do rất cụ thể khi dataset vi phạm ràng buộc —
            // hiện nguyên văn, đừng thay bằng "Something went wrong".
            const message =
                e?.response?.data?.error?.message ??
                e?.message ??
                'Could not schedule the analysis.';
            setError(message);
            setBusy(false);
        }
    }

    // Bản chi tiết khi đã về, nếu chưa thì bản danh sách. Xem trước phải vẽ được
    // từ cả hai, chỉ khác ở chỗ bản danh sách thiếu vài dòng.
    const preview = detail ?? selected;
    const age = daysSince(preview?.foundDate);
    const errorText = error ?? (showImport && text && check && !check.ok ? check.reason : null);

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                if (!busy) {
                    if (!v) reset();
                    onOpenChange(v);
                }
            }}
        >
            <DialogContent className="w-[calc(100%-2rem)] max-w-2xl overflow-hidden">
                <DialogHeader>
                    <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                            <DialogTitle>Create 8D Report</DialogTitle>
                            <DialogDescription className="whitespace-normal sm:whitespace-nowrap">
                                {showImport
                                    ? 'Import a defect case from another system as JSON, or pick a sample issue.'
                                    : 'Pick the defect this 8D will investigate. A defect can have only one 8D.'}
                            </DialogDescription>
                        </div>

                        {/*
                          * Ba đường nhập JSON gộp sau một nút. Đặt ở header chứ
                          * không trong vùng cuộn để nó không trôi mất khi danh
                          * sách lỗi dài — đây là lối ra, và một lối ra cuộn mất
                          * thì không phải lối ra.
                          */}
                        <Button
                            type="button"
                            variant={showImport ? 'secondary' : 'ghost'}
                            size="icon"
                            disabled={busy}
                            aria-label={showImport ? 'Back to defect list' : 'Import a case as JSON'}
                            title={showImport ? 'Back to defect list' : 'Import a case as JSON'}
                            onClick={() => { setShowImport((v) => !v); setError(null); }}
                            className="mt-0.5 shrink-0"
                        >
                            {showImport ? <X className="h-4 w-4" /> : <Braces className="h-4 w-4" />}
                        </Button>
                    </div>
                </DialogHeader>

                <div className="min-w-0 space-y-3 max-h-[65vh] overflow-y-auto pr-1">
                    {/* ── Đường phụ: nhập JSON ─────────────────────────────── */}
                    {showImport && (
                        <>
                            <div className="flex items-center gap-2">
                                <Input
                                    ref={fileRef}
                                    type="file"
                                    accept="application/json,.json"
                                    className="hidden"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) void handleFile(f);
                                        e.target.value = '';
                                    }}
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => fileRef.current?.click()}
                                >
                                    <Upload className="w-4 h-4" />
                                    Upload file
                                </Button>

                                {text && (
                                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => setText('')}>
                                        Clear
                                    </Button>
                                )}

                                {check?.ok && (
                                    <span className="text-sm text-success ml-auto font-medium">
                                        Case {check.caseId} · {(text.length / 1024).toFixed(0)} KB
                                    </span>
                                )}
                            </div>

                            {samples.length > 0 && (
                                <div className="min-w-0 rounded-lg border border-dashed p-3">
                                    <p className="text-sm font-semibold">Or start from an incoming issue</p>
                                    <p className="mt-0.5 text-sm text-muted-foreground">
                                        Freshly logged cases — symptom and context only, no root cause, no
                                        actions, no team. That is what the Copilot is for.
                                    </p>
                                    <div className="mt-2 space-y-1">
                                        {samples.map((s) => (
                                             <Button
                                                key={s.file}
                                                type="button"
                                                variant="ghost"
                                                disabled={busy}
                                                onClick={() => void loadSample(s)}
                                                className="flex h-auto min-w-0 w-full items-start justify-start gap-2 whitespace-normal rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted disabled:opacity-50"
                                            >
                                                <span className="mt-0.5 font-mono text-sm text-muted-foreground">
                                                    {s.notificationId}
                                                </span>
                                                <span className="min-w-0 flex-1 text-left">
                                                    <span className="block break-words text-sm font-medium text-foreground">{s.symptom}</span>
                                                    <span className="block break-words text-sm font-normal text-muted-foreground">
                                                        {s.origin.startsWith('Q1') ? 'Customer complaint' : 'Internal defect'}
                                                        {s.workCenter && ` · ${s.workCenter}`}
                                                        {s.material && ` · ${s.material}`}
                                                    </span>
                                                </span>
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <Textarea
                                value={text}
                                onChange={(e) => { setText(e.target.value); setError(null); }}
                                disabled={busy}
                                placeholder='{ "notificationId": "8D-10048412", "symptomShortText": "…", "inspections": [ … ] }'
                                className="h-56 w-full min-w-0 max-w-full resize-none font-mono text-sm"
                            />

                            <p className="text-sm text-muted-foreground">
                                Sample datasets live in <code className="font-mono">mock-data/</code> in the repository.
                            </p>
                        </>
                    )}

                    {/* ── Đường chính, nhịp 1: chọn lỗi ────────────────────── */}
                    {!showImport && !selected && (
                        <div className="min-w-0 space-y-2.5">
                            {/* Search Input */}
                            <div className="relative w-full">
                                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    disabled={busy || defects === null}
                                    placeholder="Search defect ID or description..."
                                    className="h-9 pl-9 pr-8 text-sm w-full"
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                                        title="Clear search"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Quick Filter Buttons: All, Q1, Q2, Q3 */}
                            <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setFilterType('ALL')}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-colors cursor-pointer',
                                        filterType === 'ALL'
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <span>All</span>
                                    <span className="text-xs opacity-75">({typeCounts.ALL})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterType('Q1')}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-colors cursor-pointer',
                                        filterType === 'Q1'
                                            ? 'border-rose-600 bg-rose-600 text-white'
                                            : 'border-rose-200 text-rose-700 bg-rose-50/60 hover:bg-rose-100/70 dark:border-rose-800 dark:text-rose-300 dark:bg-rose-950/40',
                                    )}
                                >
                                    <span>Q1 Customer</span>
                                    <span className="text-xs opacity-75">({typeCounts.Q1})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterType('Q2')}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-colors cursor-pointer',
                                        filterType === 'Q2'
                                            ? 'border-amber-600 bg-amber-600 text-white'
                                            : 'border-amber-200 text-amber-700 bg-amber-50/60 hover:bg-amber-100/70 dark:border-amber-800 dark:text-amber-300 dark:bg-amber-950/40',
                                    )}
                                >
                                    <span>Q2 Supplier</span>
                                    <span className="text-xs opacity-75">({typeCounts.Q2})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterType('Q3')}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-colors cursor-pointer',
                                        filterType === 'Q3'
                                            ? 'border-blue-600 bg-blue-600 text-white'
                                            : 'border-blue-200 text-blue-700 bg-blue-50/60 hover:bg-blue-100/70 dark:border-blue-800 dark:text-blue-300 dark:bg-blue-950/40',
                                    )}
                                >
                                    <span>Q3 Internal</span>
                                    <span className="text-xs opacity-75">({typeCounts.Q3})</span>
                                </button>
                            </div>

                            {defects === null && (
                                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                                    <Spinner className="w-4 h-4" />
                                    Loading defects…
                                </div>
                            )}

                            {defects?.length === 0 && (
                                <p className="py-6 text-sm text-muted-foreground">
                                    No open defect is waiting for an 8D. Record one from the Defects screen first.
                                </p>
                            )}

                            {visibleDefects?.length === 0 && defects && defects.length > 0 && (
                                <p className="py-6 text-sm text-muted-foreground text-center">
                                    No defect matches {filterType !== 'ALL' ? `filter "${filterType}"` : ''}{search.trim() ? ` and search "${search.trim()}"` : ''}.
                                </p>
                            )}

                            {visibleDefects && visibleDefects.length > 0 && (
                                <div className="min-w-0 max-h-[46vh] space-y-1.5 overflow-y-auto rounded-lg border p-1.5">
                                    {visibleDefects.map((d) => (
                                        <Button
                                            key={d.ID}
                                            type="button"
                                            variant="ghost"
                                            disabled={busy}
                                            onClick={() => selectDefect(d)}
                                            className="flex h-auto min-w-0 w-full items-center justify-start gap-3 rounded-lg border border-border/40 p-2 text-left transition-all hover:bg-muted/60 hover:border-border cursor-pointer group"
                                        >
                                            {/* 1. Loại defect */}
                                            <DefectTypeBadge origin={d.origin} />

                                            {/* 2. ID */}
                                            <span className="font-mono text-sm font-semibold text-foreground/80 shrink-0">
                                                {d.defectId}
                                            </span>

                                            {/* 3. Description */}
                                            <span
                                                className="min-w-0 flex-1 text-sm font-normal text-foreground break-words truncate"
                                                title={d.symptomShortText || d.defectText || ''}
                                            >
                                                {d.symptomShortText || d.defectText || (
                                                    <span className="italic text-muted-foreground/70">(no description recorded)</span>
                                                )}
                                            </span>
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Đường chính, nhịp 2: xem trước rồi mới cam kết ───── */}
                    {!showImport && selected && preview && (
                        <div className="min-w-0 space-y-3">
                            <div className="flex min-w-0 items-start gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => { setSelected(null); setDetail(null); setError(null); }}
                                    className="h-8 shrink-0 px-2.5 text-sm"
                                >
                                    <ArrowLeft className="h-3.5 w-3.5" />
                                    Change
                                </Button>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <DefectTypeBadge origin={preview.origin} />
                                        <p className="font-mono text-sm text-muted-foreground">{preview.defectId}</p>
                                    </div>
                                    <p className="break-words text-base font-semibold mt-0.5">
                                        {preview.symptomShortText || '(no symptom recorded)'}
                                    </p>
                                </div>
                            </div>

                            {/*
                              * Xem trước CHỈ ĐỌC. Sửa ở đây sẽ tạo ra một bản ghi
                              * lỗi và một payload 8D nói hai điều khác nhau — sửa
                              * lỗi là việc của màn hình Defects.
                              */}
                            <div className="min-w-0 rounded-lg border bg-muted/30 p-3.5">
                                <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/50">
                                    <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                        What this 8D will analyse
                                    </p>
                                    {detailLoading && <Spinner className="h-3.5 w-3.5" />}
                                </div>

                                <div className="mt-2 min-w-0 divide-y divide-border/60">
                                    <div className="pb-1">
                                        <PreviewRow label="Origin" value={preview.origin} />
                                        <PreviewRow
                                            label="Found"
                                            value={preview.foundDate ? `${preview.foundDate}${age != null ? ` · ${age} days ago` : ''}` : null}
                                        />
                                        <PreviewRow label="Reference" value={preview.referenceNumber} />
                                    </div>

                                    <div className="py-1">
                                        <PreviewRow
                                            label="Material"
                                            value={preview.materialId ? `${preview.materialId}${preview.materialDesc ? ` — ${preview.materialDesc}` : ''}` : null}
                                        />
                                        <PreviewRow label="Batch" value={preview.batchId} />
                                        <PreviewRow label="Plant" value={preview.plant} />
                                        <PreviewRow
                                            label="Work centre"
                                            value={preview.workCenterId ? `${preview.workCenterId}${preview.workCenterDesc ? ` — ${preview.workCenterDesc}` : ''}` : null}
                                        />
                                    </div>

                                    <div className="py-1">
                                        <PreviewRow
                                            label="Defect code"
                                            value={preview.defectCode ? `${preview.defectCodeGroup ? `${preview.defectCodeGroup} / ` : ''}${preview.defectCode}${preview.defectText ? ` — ${preview.defectText}` : ''}` : null}
                                        />
                                        {/* S7: một khái niệm, một tên. Nhãn là Severity. */}
                                        <PreviewRow label="Severity" value={preview.defectClass} />
                                        <PreviewRow
                                            label="Quantity"
                                            value={preview.defectQuantity != null ? `${preview.defectQuantity}${preview.defectQuantityUom ? ` ${preview.defectQuantityUom}` : ''}` : null}
                                        />
                                        <PreviewRow label="Inspection lot" value={preview.inspectionLotId} />
                                    </div>

                                    {/*
                                      * Kết quả đo chỉ có ở bản chi tiết. Nói rõ
                                      * "không có" thay vì bỏ trắng cả khối: một
                                      * case không đo gì và một case chưa nạp xong
                                      * trông giống hệt nhau nếu im lặng.
                                      */}
                                    {!detailLoading && (
                                        <div className="pt-1.5">
                                            <p className="py-1 text-sm font-medium text-muted-foreground">
                                                {detail?.characteristics?.length
                                                    ? `Inspection results (${detail.characteristics.length})`
                                                    : 'No inspection results recorded.'}
                                            </p>
                                            {detail?.characteristics?.map((c, i) => (
                                                <div key={c.ID ?? i} className="flex min-w-0 gap-2 py-1">
                                                    <span className="w-28 shrink-0 truncate text-sm text-muted-foreground">
                                                        {c.characteristic}
                                                    </span>
                                                    <span className="min-w-0 flex-1 break-words text-sm font-medium">
                                                        {c.measuredValue || '—'}
                                                        {c.specUom ? ` ${c.specUom}` : ''}
                                                        {(c.specLowerLimit != null || c.specUpperLimit != null)
                                                            && ` (spec ${c.specLowerLimit ?? '−∞'} … ${c.specUpperLimit ?? '+∞'})`}
                                                        {c.valuation ? ` · ${c.valuation}` : ''}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/*
                              * Hai ô duy nhất được nhập ở đây. Đội, phát biểu vấn
                              * đề và biện pháp ngăn chặn CỐ Ý không có mặt: chúng
                              * là nội dung của D1/D2/D3, và điền trước khi phân
                              * tích chạy là đoán thay Copilot.
                              */}
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="min-w-0 space-y-1.5">
                                    <Label htmlFor="ad-due" className="text-sm font-semibold">
                                        Required completion date
                                    </Label>
                                    <Input
                                        id="ad-due"
                                        type="date"
                                        value={dueDate}
                                        disabled={busy}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                    <p className="text-sm leading-relaxed text-muted-foreground">
                                        {preview.origin === ORIGIN_CUSTOMER
                                            ? 'Defaults to the customer SLA on this complaint.'
                                            : 'Optional. Internal defects carry no SLA, so nothing is filled in — set a date only if the team commits to one.'}
                                    </p>
                                </div>

                                <div className="min-w-0 space-y-1.5">
                                    <Label htmlFor="ad-coord" className="text-sm font-semibold">
                                        Coordinator
                                    </Label>
                                    <ValueHelpInput
                                        id="ad-coord"
                                        value={coordinator}
                                        onChange={setCoordinator}
                                        // Ô này giữ TÊN, còn `entry.key` là mã đối
                                        // tác `BP-xxx`. `commit` dán key vào trước,
                                        // `onPick` chạy sau và ghi đè bằng tên —
                                        // thứ mà cột `coordinator` thật sự lưu.
                                        onPick={(entry) => setCoordinator(String(entry.partnerName ?? entry.text ?? entry.key ?? '').trim())}
                                        entries={partnerVh.entries}
                                        loading={partnerVh.loading}
                                        // `quiet`: giá trị ở đây là tên người, còn
                                        // danh mục so khớp theo mã đối tác — bật
                                        // cảnh báo lên thì mọi tên hợp lệ đều bị
                                        // gạch đỏ. Người điều phối cũng không tham
                                        // gia chấm điểm tiền lệ, nên không có gì
                                        // mất đi khi gõ một cái tên ngoài danh mục.
                                        quiet
                                        placeholder="e.g. Minh Dinh"
                                        className={cn(busy && 'pointer-events-none opacity-50')}
                                    />
                                    <p className="text-sm leading-relaxed text-muted-foreground">
                                        Defaults to the coordinator on the defect. Both fields stay editable
                                        after the 8D is created.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {errorText && (
                        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span className="break-words">{errorText}</span>
                        </div>
                    )}
                </div>

                <DialogFooter className="min-w-0">
                    <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => { reset(); onOpenChange(false); }}
                    >
                        Cancel
                    </Button>
                    {showImport ? (
                        <Button onClick={submit} disabled={busy || !check?.ok}>
                            {busy && <Spinner className="w-4 h-4" />}
                            {busy ? 'Creating…' : 'Create & Analyze'}
                        </Button>
                    ) : (
                        <Button
                            onClick={() => selected && void startFromDefect(selected)}
                            disabled={busy || !selected}
                        >
                            {busy && <Spinner className="w-4 h-4" />}
                            {busy ? 'Creating…' : 'Create & Analyze'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
