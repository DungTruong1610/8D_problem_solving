/**
 * Tab Defects — sổ lỗi chất lượng đã ghi nhận (QMEL).
 *
 * ── Vì sao tab này tồn tại ──
 * Trước Phase 2, lỗi không có chỗ đứng riêng: bấm "Record Defect" là tạo thẳng
 * một báo cáo 8D. Nghĩa là app không trả lời được câu hỏi cơ bản nhất của quản
 * lý chất lượng — "tháng này có bao nhiêu lỗi, bao nhiêu cái cần 8D" — vì mọi
 * lỗi đều đã là một 8D.
 *
 * ── Vì sao form ghi nhận là `CreateDefectDialog` chứ không phải form riêng ──
 * Form đó đã có đủ tám F4, quy tắc ép `entryMode` theo nguồn gốc, sentinel 'N/A'
 * cho case không hướng khách hàng, và lưới kết quả đo. Dựng một form thứ hai ở
 * đây là dựng bản sao thứ hai của toàn bộ luật nhập liệu — và bản sao sẽ lệch.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    Badge,
    Button,
    Card,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Spinner,
    cn,
} from '@cnma/react-ui';
import {
    AlertCircle,
    ClipboardList,
    ExternalLink,
    Plus,
    RefreshCw,
    Pencil,
    Search,
    Sparkles,
    Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    defectsService,
    DEFECT_STATUS_TONE,
    type DefectItem,
    type DefectStatus,
} from '@/services/defect-service';
import { CreateDefectDialog } from '@/pages/create-defect';
import axiosInstance from '@/services/core/axios-instance';

const STATUSES: Array<DefectStatus | 'ALL'> = ['ALL', 'Open', 'In Process', 'Completed'];

export function DefectsTab() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<DefectStatus | 'ALL'>('ALL');
    const [createOpen, setCreateOpen] = useState(false);
    const [createDialogKey, setCreateDialogKey] = useState(0);
    const [deleteItem, setDeleteItem] = useState<DefectItem | null>(null);

    /**
     * Bản ghi đang sửa — bản ĐẦY ĐỦ, không phải dòng của danh sách.
     *
     * `list()` chỉ chọn khoảng hai mươi cột và không kéo `characteristics`. Đưa
     * dòng danh sách thẳng vào form sửa thì lưới kết quả đo mở ra trống, và bấm
     * Save sẽ ghi đè số liệu đo thật bằng một lưới rỗng — mất dữ liệu, không có
     * cảnh báo nào. Nên phải nạp bản đầy đủ trước rồi mới mở form.
     */
    const [editItem, setEditItem] = useState<DefectItem | null>(null);
    const [loadingEdit, setLoadingEdit] = useState<string | null>(null);

    async function openEdit(row: DefectItem) {
        setLoadingEdit(row.ID);
        try {
            const item = await defectsService.getWithCharacteristics(row.ID);
            const reportID = reportByDefect.get(item.defectId);
            if (!reportID && item.status !== 'Completed') {
                item.status = 'Open';
            }
            setEditItem(item);
        } catch (err: any) {
            toast.error(err?.response?.data?.error?.message ?? err?.message ?? 'Could not load the defect.');
        } finally {
            setLoadingEdit(null);
        }
    }

    const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
        queryKey: ['master-data', 'defects', search, status],
        queryFn: () => defectsService.list({
            search,
            status: status === 'ALL' ? undefined : status,
            top: 200,
        }),
    });

    /**
     * Lỗi nào đã có 8D.
     *
     * Truy vấn RIÊNG chứ không suy từ `status`: một lỗi `In Process` chưa chắc đã
     * có 8D — người dùng có thể tự đặt trạng thái đó. Chỉ sự tồn tại của một
     * `Reports.sourceDefectId` mới là bằng chứng, và nó cũng chính là điều kiện
     * mà server dùng để trả 409.
     */
    const { data: linked } = useQuery({
        queryKey: ['master-data', 'defect-links'],
        queryFn: async () => {
            const res = await axiosInstance.get<{ value: Array<{ ID: string; sourceDefectId: string | null }> }>(
                'api/cnma/EIGHTD_SRV/Reports?$select=ID,sourceDefectId&$filter=sourceDefectId ne null&$top=1000',
            );
            return res.data?.value ?? [];
        },
    });

    const reportByDefect = useMemo(() => {
        const map = new Map<string, string>();
        for (const r of linked ?? []) if (r.sourceDefectId) map.set(r.sourceDefectId, r.ID);
        return map;
    }, [linked]);

    const rows = data?.value ?? [];

    const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: ['master-data', 'defects'] });
        void queryClient.invalidateQueries({ queryKey: ['master-data', 'defect-links'] });
        void queryClient.invalidateQueries({ queryKey: ['8d'] });
        void queryClient.invalidateQueries({ queryKey: ['number-range'] });
    };

    const startMutation = useMutation({
        mutationFn: (d: DefectItem) => defectsService.startEightD(d.defectId),
        onSuccess: (reportID, d) => {
            toast.success(`8D opened for defect ${d.defectId}`, {
                description: 'Analysis takes about 3 minutes. The report page updates automatically.',
            });
            invalidate();
            void queryClient.invalidateQueries({ queryKey: ['8d'] });
            navigate(`/8d/${reportID}`);
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error?.message ?? err?.message ?? 'Could not open the 8D.');
            // 409 nghĩa là danh sách đã cũ — nạp lại để nút biến mất.
            invalidate();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => defectsService.delete(id),
        onSuccess: () => {
            toast.success('Defect deleted.');
            setDeleteItem(null);
            invalidate();
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error?.message ?? err?.message ?? 'Failed to delete the defect.');
        },
    });

    return (
        <div className="space-y-4">
            {/* Filter & Action Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 flex-1 min-w-[280px] max-w-2xl">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search Defect ID, symptom, material, defect text..."
                            className="pl-8 text-sm h-9 bg-background"
                        />
                    </div>

                    <Select value={status} onValueChange={(v) => setStatus(v as DefectStatus | 'ALL')}>
                        <SelectTrigger className="w-36 text-sm h-9">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            {STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                    {s === 'ALL' ? 'All Statuses' : s}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="h-9 gap-1.5 text-sm"
                    >
                        <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
                        Refresh
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => {
                            setCreateDialogKey((k) => k + 1);
                            setCreateOpen(true);
                        }}
                        className="h-9 gap-1.5 text-sm bg-primary text-primary-foreground font-semibold"
                    >
                        <Plus className="w-4 h-4" />
                        Record Defect
                    </Button>
                </div>
            </div>

            <Card className="overflow-hidden border border-border/80 shadow-xs">
                {isLoading ? (
                    <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
                        <Spinner className="w-4 h-4" /> Loading defects…
                    </div>
                ) : isError ? (
                    <div className="p-8 text-center text-sm text-destructive">
                        <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                        Failed to load defects: {(error as Error)?.message}
                    </div>
                ) : rows.length === 0 ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                        <ClipboardList className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                        No defect matches these filters.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-border/80 bg-muted/50 font-semibold text-muted-foreground">
                                    <th className="py-3 px-4 w-36">Defect ID</th>
                                    <th className="py-3 px-4 w-28">Status</th>
                                    <th className="py-3 px-4 min-w-[240px]">Symptom</th>
                                    <th className="py-3 px-4 w-40">Material</th>
                                    <th className="py-3 px-4 w-36">Work Centre</th>
                                    <th className="py-3 px-4 w-28">Severity</th>
                                    <th className="py-3 px-4 w-28">Found</th>
                                    <th className="py-3 px-4 w-44 text-right">8D</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {rows.map((row) => {
                                    const reportID = reportByDefect.get(row.defectId);
                                    const done = row.status === 'Completed';
                                    // Defect chưa start 8D (hiển thị button start 8D) thì status bắt buộc là "Open"
                                    const effectiveStatus: DefectStatus = done
                                        ? 'Completed'
                                        : !reportID
                                        ? 'Open'
                                        : (row.status === 'Open' ? 'In Process' : (row.status as DefectStatus) || 'In Process');
                                    return (
                                        <tr key={row.ID} className="hover:bg-muted/30 transition-colors">
                                            <td className="py-3 px-4 font-mono font-bold text-foreground">
                                                {row.defectId}
                                            </td>
                                            <td className="py-3 px-4">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        'text-sm font-semibold px-2.5 py-0.5',
                                                        DEFECT_STATUS_TONE[effectiveStatus] || DEFECT_STATUS_TONE['Open'],
                                                    )}
                                                >
                                                    {effectiveStatus}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4 font-medium text-foreground">
                                                {row.symptomShortText || '—'}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="text-foreground">{row.materialDesc || row.materialId || '—'}</div>
                                                {row.materialDesc && row.materialId && (
                                                    <div className="font-mono text-sm text-muted-foreground">
                                                        {row.materialId}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 font-mono text-muted-foreground">
                                                {row.workCenterId || '—'}
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground">
                                                {row.defectClass || '—'}
                                            </td>
                                            <td className="py-3 px-4 tabular-nums text-muted-foreground">
                                                {row.foundDate || '—'}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {/*
                                                      * Ba trạng thái, ba giao diện khác nhau — KHÔNG phải một
                                                      * nút bị làm mờ. "Đã có 8D" và "lỗi đã đóng" là hai lý do
                                                      * khác nhau, và một nút xám im lặng không nói được lý do
                                                      * nào cả.
                                                      */}
                                                    {reportID ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 gap-1.5 text-sm"
                                                            onClick={() => navigate(`/8d/${reportID}`)}
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                            Open 8D
                                                        </Button>
                                                    ) : done ? (
                                                        <span className="text-sm text-muted-foreground">
                                                            Closed without 8D
                                                        </span>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 gap-1.5 text-sm font-semibold"
                                                            disabled={startMutation.isPending}
                                                            onClick={() => startMutation.mutate(row)}
                                                        >
                                                            {startMutation.isPending && startMutation.variables?.ID === row.ID
                                                                ? <Spinner className="w-3.5 h-3.5" />
                                                                : <Sparkles className="w-3.5 h-3.5" />}
                                                            Start 8D
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Edit defect ${row.defectId}`}
                                                        title="Edit this defect"
                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                        disabled={loadingEdit === row.ID}
                                                        onClick={() => void openEdit(row)}
                                                    >
                                                        {loadingEdit === row.ID
                                                            ? <Spinner className="w-3.5 h-3.5" />
                                                            : <Pencil className="w-4 h-4" />}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Delete defect ${row.defectId}`}
                                                        title="Delete this defect"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={() => setDeleteItem(row)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/*
              * `key` ép React dựng lại form mỗi khi đổi bản ghi.
              *
              * Hộp thoại giữ khoảng ba mươi ô trong state của chính nó. Không có
              * `key`, mở lỗi A rồi mở lỗi B sẽ thấy hình ảnh ghép của cả hai —
              * `useEffect` đổ dữ liệu vào từng ô mà nó biết, còn ô mà B để trống
              * thì vẫn giữ giá trị của A. Ghi mới sau khi sửa cũng dính y như vậy.
              */}
            <CreateDefectDialog
                key={editItem?.ID ?? `new-${createDialogKey}`}
                open={createOpen || Boolean(editItem)}
                onOpenChange={(v) => {
                    if (v) return;
                    setCreateOpen(false);
                    setEditItem(null);
                }}
                defect={editItem}
                onCreated={() => invalidate()}
            />

            <AlertDialog open={Boolean(deleteItem)} onOpenChange={(v) => !v && setDeleteItem(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete defect {deleteItem?.defectId}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteItem && reportByDefect.has(deleteItem.defectId)
                                ? 'This defect already has an 8D report. The report keeps its defect number for the audit trail, but the defect record itself will be gone.'
                                : 'The defect record and its measured characteristics will be removed. This cannot be undone.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deleteMutation.isPending}
                            onClick={() => deleteItem && deleteMutation.mutate(deleteItem.ID)}
                        >
                            {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
