import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Badge,
    Button,
    Card,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Spinner,
    Textarea,
    cn,
} from '@cnma/react-ui';
import {
    AlertCircle,
    CheckCircle2,
    Edit,
    FileCode,
    FileText,
    FolderKanban,
    Layers,
    Microscope,
    Plus,
    RefreshCw,
    Search,
    Sparkles,
    Trash2,
    Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    historicalCasesService,
    useNextNumber,
    type HistoricalCaseItem,
} from '@/services/master-data-service';
import { eightDService } from '@/services/eightd-service';
import { useValueHelp } from '@/hooks/use-value-help';
import { ValueHelpInput } from '@/components/ui/ValueHelpInput';
import { applyReturnMapping, isOutsideCatalogue, VALUE_HELP_IDS } from '@/services/value-help-service';

/*
 * ── Số notification do SERVER cấp ────────────────────────────────────────────
 *
 * Ở đây từng có `generateNextNotificationId(items)` — `max(items) + 1` tính
 * trong trình duyệt, với ba chỗ hỏng lặng lẽ: `items` chỉ là những dòng đang
 * tải; hai người mở form cùng lúc thấy cùng một số; và số cấp ngay khi mở form
 * nên form bỏ dở thì đốt mất một số.
 *
 * Giờ ô để trống và server cấp trong chính transaction của lệnh insert (xem
 * `srv/src/domain/numberRange.ts`), rồi vá lại `sourcePayload.notificationId`
 * cho khớp. Gõ tay vẫn được — case nhập từ hệ thống khác mang số của nó.
 */

export function HistoricalDefectsTab() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [jsonImportOpen, setJsonImportOpen] = useState(false);
    const [editItem, setEditItem] = useState<HistoricalCaseItem | null>(null);
    const [deleteItem, setDeleteItem] = useState<HistoricalCaseItem | null>(null);

    const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
        queryKey: ['master-data', 'historical-cases', search],
        queryFn: () => historicalCasesService.list({ search, top: 100 }),
    });

    const rows = data?.value ?? [];

    const updateMutation = useMutation({
        mutationFn: ({ id, item }: { id: string; item: Partial<HistoricalCaseItem> }) =>
            historicalCasesService.update(id, item),
        onSuccess: () => {
            toast.success('Historical defect case updated successfully.');
            setEditItem(null);
            void queryClient.invalidateQueries({ queryKey: ['master-data', 'historical-cases'] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error?.message ?? err?.message ?? 'Failed to update case.');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => historicalCasesService.delete(id),
        onSuccess: () => {
            toast.success('Case deleted successfully.');
            setDeleteItem(null);
            void queryClient.invalidateQueries({ queryKey: ['master-data', 'historical-cases'] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error?.message ?? err?.message ?? 'Failed to delete case.');
        },
    });

    return (
        <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by Case ID, Material, Symptom, Defect..."
                        className="pl-8 text-sm h-9 bg-background"
                    />
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
                        onClick={() => setJsonImportOpen(true)}
                        className="h-9 gap-1.5 text-sm bg-primary text-primary-foreground font-semibold"
                    >
                        <FileCode className="w-4 h-4" />
                        Import JSON
                    </Button>
                </div>
            </div>

            {/* Content Table Card */}
            <Card className="overflow-hidden border border-border/80 shadow-xs">
                {isLoading ? (
                    <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
                        <Spinner className="w-4 h-4" /> Loading historical cases…
                    </div>
                ) : isError ? (
                    <div className="p-8 text-center text-sm text-destructive">
                        <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                        Failed to load data: {(error as Error)?.message}
                    </div>
                ) : rows.length === 0 ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                        <FolderKanban className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                        No historical defect cases found.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-border/80 bg-muted/50 font-semibold text-muted-foreground">
                                    <th className="py-3 px-4 w-36">Case ID</th>
                                    <th className="py-3 px-4 w-36">Origin</th>
                                    <th className="py-3 px-4 min-w-[180px]">Material</th>
                                    <th className="py-3 px-4 min-w-[160px]">Work Center</th>
                                    <th className="py-3 px-4 min-w-[240px]">Symptom & Defect</th>
                                    <th className="py-3 px-4 w-32">Root Cause</th>
                                    <th className="py-3 px-4 w-28">Status</th>
                                    <th className="py-3 px-4 w-32">Source</th>
                                    <th className="py-3 px-4 w-24 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {rows.map((row) => (
                                    <tr key={row.ID} className="hover:bg-muted/30 transition-colors">
                                        <td className="py-3 px-4 font-mono font-bold text-foreground">
                                            {row.notificationId}
                                        </td>
                                        <td className="py-3 px-4">
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    'text-sm font-semibold px-2.5 py-0.5',
                                                    row.origin?.includes('Customer') || row.origin?.startsWith('Q1')
                                                        ? 'border-destructive/30 text-destructive bg-destructive/5'
                                                        : 'border-info/30 text-info bg-info/5'
                                                )}
                                            >
                                                {row.origin?.includes('Customer') ? 'Customer (Q1)' : 'Internal (Q3)'}
                                            </Badge>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="font-medium text-foreground">{row.materialDesc || row.materialId}</div>
                                            {row.materialDesc && row.materialId && (
                                                <div className="font-mono text-sm text-muted-foreground">{row.materialId}</div>
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="font-mono text-foreground font-semibold">{row.workCenterId || '—'}</div>
                                            <div className="text-sm text-muted-foreground">{row.workCenterDesc || ''}</div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="font-medium text-foreground line-clamp-1">{row.symptomShortText || '—'}</div>
                                            <div className="text-sm text-muted-foreground line-clamp-1">
                                                {row.defectCode ? `[${row.defectCode}] ` : ''}{row.defectText || ''}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            {row.rootCauseCategory ? (
                                                <Badge variant="secondary" className="text-sm font-semibold px-2.5 py-0.5">
                                                    {row.rootCauseCategory}
                                                </Badge>
                                            ) : '—'}
                                        </td>
                                        <td className="py-3 px-4">
                                            {(() => {
                                                const s = (row.sapStatus || 'Closed').trim();
                                                const sLower = s.toLowerCase();
                                                if (sLower === 'completed' || sLower === 'complete') {
                                                    return (
                                                        <Badge
                                                            variant="outline"
                                                            className="border-success/30 text-success bg-success/10 text-sm font-semibold px-2.5 py-0.5"
                                                        >
                                                            {s}
                                                        </Badge>
                                                    );
                                                }
                                                if (sLower.includes('progress') || sLower.includes('process') || sLower === 'open') {
                                                    return (
                                                        <Badge
                                                            variant="outline"
                                                            className="border-info/30 text-info bg-info/10 text-sm font-semibold px-2.5 py-0.5"
                                                        >
                                                            {s}
                                                        </Badge>
                                                    );
                                                }
                                                return (
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-sm font-semibold px-2.5 py-0.5 text-muted-foreground bg-muted border border-border/60"
                                                    >
                                                        {s}
                                                    </Badge>
                                                );
                                            })()}
                                        </td>
                                        {/*
                                          * Nguồn gốc của dòng — câu hỏi đầu tiên khi ai đó thắc mắc
                                          * "sao AI lại trích dẫn case này". Case do app đóng có vết
                                          * duyệt của con người trên cả tám bước; dòng import chỉ có
                                          * những gì file cũ ghi lại. Hai thứ không đáng tin ngang nhau,
                                          * nên phải phân biệt được ngay trên danh sách.
                                          */}
                                        <td className="py-3 px-4">
                                            {row.provenance === 'closed-in-app' ? (
                                                <Badge
                                                    variant="outline"
                                                    className="border-success/30 text-success bg-success/10 text-sm font-semibold px-2.5 py-0.5 gap-1"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Closed in app
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="secondary"
                                                    className="text-sm font-semibold px-2.5 py-0.5 text-muted-foreground bg-muted border border-border/60 gap-1"
                                                >
                                                    <FileCode className="w-3.5 h-3.5" />
                                                    Imported
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                    onClick={() => setEditItem(row)}
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    onClick={() => setDeleteItem(row)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* JSON Import Dialog */}
            <CaseJsonImportDialog
                open={jsonImportOpen}
                onOpenChange={setJsonImportOpen}
                onSuccess={() => {
                    void queryClient.invalidateQueries({ queryKey: ['master-data', 'historical-cases'] });
                }}
            />

            {/* Edit Dialog */}
            {editItem && (
                <CaseFormDialog
                    open={Boolean(editItem)}
                    onOpenChange={(open) => !open && setEditItem(null)}
                    title={`Edit Case — ${editItem.notificationId}`}
                    initialValues={editItem}
                    isPending={updateMutation.isPending}
                    onSubmit={(values) => updateMutation.mutate({ id: editItem.ID, item: values })}
                />
            )}

            {/* Delete Confirmation */}
            {deleteItem && (
                <Dialog open={Boolean(deleteItem)} onOpenChange={(open) => !open && setDeleteItem(null)}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
                                <AlertCircle className="w-5 h-5" />
                                Delete Historical Case
                            </DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground mt-2">
                            Are you sure you want to delete case <strong className="font-mono text-foreground">{deleteItem.notificationId}</strong>?
                            This action cannot be undone.
                        </p>
                        <DialogFooter className="gap-2 mt-4">
                            <Button variant="outline" size="sm" onClick={() => setDeleteItem(null)} className="h-9 text-sm">Cancel</Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                disabled={deleteMutation.isPending}
                                onClick={() => deleteMutation.mutate(deleteItem.ID)}
                                className="h-9 text-sm"
                            >
                                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}

function CaseFormDialog({
    open,
    onOpenChange,
    title,
    initialValues,
    isPending,
    onSubmit,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    initialValues?: HistoricalCaseItem;
    isPending: boolean;
    onSubmit: (values: Partial<HistoricalCaseItem>) => void;
}) {
    // Attempt to parse parsed sourcePayload if available
    let parsedPayload: any = null;
    if (initialValues?.sourcePayload) {
        try {
            parsedPayload = JSON.parse(initialValues.sourcePayload);
        } catch {}
    }

    // Section 1: SAP Notification & Header
    // Trống khi tạo mới: server cấp số lúc lưu. Có sẵn khi sửa — số đã cấp rồi.
    const [notificationId, setNotificationId] = useState(() => initialValues?.notificationId || '');
    const isEdit = Boolean(initialValues?.notificationId);
    const nextDefectIdQuery = useNextNumber('DEFECT', open && !isEdit);

    useEffect(() => {
        if (open) {
            if (isEdit) {
                setNotificationId(initialValues?.notificationId || '');
            } else if (nextDefectIdQuery.data && !notificationId) {
                setNotificationId(nextDefectIdQuery.data);
            }
        }
    }, [open, initialValues, isEdit, nextDefectIdQuery.data, notificationId]);

    const displayedNotificationId = isEdit
        ? notificationId
        : (notificationId || nextDefectIdQuery.data || 'Allocating ID...');
    const [origin, setOrigin] = useState(initialValues?.origin || parsedPayload?.origin || 'Q3 - Internal Defect');
    const [sapStatus, setSapStatus] = useState(initialValues?.sapStatus || parsedPayload?.status || 'Closed');
    const [foundDate, setFoundDate] = useState(initialValues?.foundDate || parsedPayload?.foundDate || '');
    const [completionDate, setCompletionDate] = useState(initialValues?.completionDate || parsedPayload?.completionDate || '');
    const [quantityExtent, setQuantityExtent] = useState(initialValues?.quantityExtent || parsedPayload?.quantityExtent || '');
    const [symptomShortText, setSymptomShortText] = useState(initialValues?.symptomShortText || parsedPayload?.symptomShortText || '');
    const [reportedBy, setReportedBy] = useState(parsedPayload?.responsibility?.reportedBy || '');
    const [coordinator, setCoordinator] = useState(parsedPayload?.responsibility?.coordinator || '');

    // Section 2: Material & Production Context
    const [materialId, setMaterialId] = useState(initialValues?.materialId || parsedPayload?.material?.materialId || '');
    const [materialDesc, setMaterialDesc] = useState(initialValues?.materialDesc || parsedPayload?.material?.description || '');
    const [materialFamily, setMaterialFamily] = useState(initialValues?.materialFamily || parsedPayload?.material?.materialGroup || '');
    const [batchId, setBatchId] = useState(initialValues?.batchId || parsedPayload?.batch?.batchId || '');
    const [workCenterId, setWorkCenterId] = useState(initialValues?.workCenterId || parsedPayload?.workCenter?.workCenterId || '');
    const [workCenterDesc, setWorkCenterDesc] = useState(initialValues?.workCenterDesc || parsedPayload?.workCenter?.description || '');

    // Section 3: Defect & QM Measurements
    const [defectCode, setDefectCode] = useState(initialValues?.defectCode || parsedPayload?.defect?.defectCode || '');
    const [defectText, setDefectText] = useState(initialValues?.defectText || parsedPayload?.defect?.defectText || '');
    // Chỉ đọc, luôn suy từ mã đã chọn. Case cũ nhập từ workbook không có nhóm —
    // để trống chứ không đoán ngược từ mã.
    const [defectCodeGroup, setDefectCodeGroup] = useState(
        initialValues?.defectCodeGroup || parsedPayload?.defect?.defectCodeGroup || '',
    );

    // ── F4 trên màn hình Master Data ────────────────────────────────────────────
    //
    // Ba danh mục, nhưng KHÔNG cùng độ chặt — và sự khác nhau đó có lý do:
    //
    //  `DEFECT_CODE` là catalogue ĐỘC LẬP (`sourceType: 'static'`), không sinh ra
    //  từ màn hình này. Nên khoá cứng được, và phải khoá: một mã lỗi tự chế ở đây
    //  sẽ nằm trong kho case mà form ghi nhận lỗi không bao giờ chọn được — đúng
    //  cái tình trạng `verifyDefectCatalogueCoverage` sinh ra để phát hiện.
    //
    //  `MATERIAL` và `WORK_CENTER` thì `sourceType: 'reference'`, đọc NGƯỢC LẠI từ
    //  chính bảng mà form này ghi vào. Khoá cứng chúng ở đây là vòng tròn: không
    //  case nào thêm được cho một vật tư mới, vì vật tư chỉ có trong danh mục sau
    //  khi đã có case dùng nó. Kế hoạch nói "đường thoát cho một vật tư mới là
    //  Master Data" — vậy Master Data phải nhận được vật tư mới. Nên ở đây chúng
    //  GỢI Ý và cảnh báo gõ sai, không chặn.
    const materialVh = useValueHelp(VALUE_HELP_IDS.material, { enabled: open });
    const workCenterVh = useValueHelp(VALUE_HELP_IDS.workCenter, { enabled: open });
    const defectCodeVh = useValueHelp(VALUE_HELP_IDS.defectCode, { enabled: open });

    const defectCodeOutside = isOutsideCatalogue(defectCodeVh.entries, defectCode, defectCodeVh.loading);
    const [characteristic, setCharacteristic] = useState(parsedPayload?.inspections?.[0]?.characteristic || '');
    const [measuredValue, setMeasuredValue] = useState(parsedPayload?.inspections?.[0]?.measuredValue || '');
    const [specValue, setSpecValue] = useState(parsedPayload?.inspections?.[0]?.specValue || '');
    const [equipment, setEquipment] = useState(parsedPayload?.inspections?.[0]?.equipment || '');

    // Section 4: Root Cause, FMEA & Financial Impact
    const [rootCauseCategory, setRootCauseCategory] = useState(
        initialValues?.rootCauseCategory ||
        parsedPayload?.causesIshikawa?.find((c: any) => c.isRootCause === 'Y')?.category ||
        'Machine'
    );
    const [rootCauseDetail, setRootCauseDetail] = useState(
        parsedPayload?.causesIshikawa?.find((c: any) => c.isRootCause === 'Y')?.description ||
        parsedPayload?.fiveWhyChain?.[parsedPayload?.fiveWhyChain?.length - 1]?.answer ||
        ''
    );
    const [fmeaId, setFmeaId] = useState(initialValues?.fmeaId || parsedPayload?.fmeaLink?.fmeaId || '');
    const [copqEur, setCopqEur] = useState<string>(
        initialValues?.copqEur != null ? String(initialValues.copqEur) :
        parsedPayload?.costCopq?.costOfPoorQualityEur != null ? String(parsedPayload.costCopq.costOfPoorQualityEur) : ''
    );
    const [correctiveAction, setCorrectiveAction] = useState(
        parsedPayload?.actions?.find((a: any) => a.actionType === 'Corrective')?.actionText || ''
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // `notificationId` không còn bắt buộc: trống nghĩa là "server cấp đi".
        if (!materialId.trim()) {
            toast.error('Material ID is required.');
            return;
        }
        // F4 cứng cho mã lỗi: một mã ngoài catalogue lưu được ở đây sẽ nằm trong
        // kho case mà form ghi nhận lỗi không chọn lại được.
        if (defectCodeOutside) {
            toast.error(`Defect code "${defectCode.trim()}" is not in the catalogue.`, {
                description: 'Pick one from the list, or add it to the defect catalogue first.',
            });
            return;
        }

        const sourcePayloadObj = {
            notificationId: notificationId.trim(),
            origin,
            symptomShortText: symptomShortText.trim(),
            status: sapStatus,
            foundDate: foundDate.trim() || null,
            completionDate: completionDate.trim() || null,
            quantityExtent: quantityExtent.trim() || null,
            material: {
                materialId: materialId.trim(),
                description: materialDesc.trim() || undefined,
                materialGroup: materialFamily.trim() || undefined,
            },
            batch: batchId.trim() ? {
                batchId: batchId.trim(),
                materialId: materialId.trim(),
            } : undefined,
            defect: {
                defectCodeGroup: defectCodeGroup.trim() || undefined,
                defectCode: defectCode.trim() || undefined,
                defectText: defectText.trim() || undefined,
            },
            workCenter: {
                workCenterId: workCenterId.trim() || undefined,
                description: workCenterDesc.trim() || undefined,
            },
            inspections: characteristic.trim() ? [
                {
                    characteristic: characteristic.trim(),
                    measuredValue: measuredValue.trim() || undefined,
                    specValue: specValue.trim() || undefined,
                    equipment: equipment.trim() || undefined,
                }
            ] : (parsedPayload?.inspections || []),
            responsibility: {
                reportedBy: reportedBy.trim() || undefined,
                coordinator: coordinator.trim() || undefined,
            },
            causesIshikawa: rootCauseCategory ? [
                {
                    category: rootCauseCategory,
                    description: rootCauseDetail.trim() || `${rootCauseCategory} root cause factor`,
                    isRootCause: 'Y',
                    source: 'Historical Case Record',
                }
            ] : (parsedPayload?.causesIshikawa || []),
            fiveWhyChain: rootCauseDetail.trim() ? [
                {
                    stepNo: 1,
                    question: `Why did ${defectText.trim() || 'the defect'} occur?`,
                    answer: rootCauseDetail.trim(),
                    evidenceCitation: characteristic.trim() ? `Inspection characteristic ${characteristic.trim()}` : 'Historical analysis log',
                }
            ] : (parsedPayload?.fiveWhyChain || []),
            actions: correctiveAction.trim() ? [
                {
                    lineNo: 1,
                    actionType: 'Corrective',
                    actionText: correctiveAction.trim(),
                    status: 'Done',
                }
            ] : (parsedPayload?.actions || []),
            fmeaLink: fmeaId.trim() ? {
                fmeaId: fmeaId.trim(),
                description: `${defectText.trim() || 'Defect'} mitigation`,
            } : parsedPayload?.fmeaLink,
            costCopq: copqEur ? {
                costOfPoorQualityEur: Number(copqEur),
            } : parsedPayload?.costCopq,
        };

        const finalNotifId = isEdit ? notificationId.trim() : (notificationId.trim() || nextDefectIdQuery.data?.trim());
        onSubmit({
            ...(finalNotifId ? { notificationId: finalNotifId } : {}),
            origin,
            symptomShortText: symptomShortText.trim(),
            materialId: materialId.trim(),
            materialDesc: materialDesc.trim() || null,
            materialFamily: materialFamily.trim() || null,
            batchId: batchId.trim() || null,
            workCenterId: workCenterId.trim() || null,
            workCenterDesc: workCenterDesc.trim() || null,
            defectCodeGroup: defectCodeGroup.trim() || null,
            defectCode: defectCode.trim() || null,
            defectText: defectText.trim() || null,
            rootCauseCategory: rootCauseCategory || null,
            copqEur: copqEur ? Number(copqEur) : null,
            fmeaId: fmeaId.trim() || null,
            foundDate: foundDate.trim() || null,
            completionDate: completionDate.trim() || null,
            quantityExtent: quantityExtent.trim() || null,
            sapStatus,
            sourcePayload: JSON.stringify(sourcePayloadObj),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-4xl md:max-w-5xl !max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0 rounded-2xl border-border/90 shadow-2xl overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-border/70 bg-muted/20 shrink-0">
                    <DialogTitle className="text-lg font-bold flex items-center gap-2.5">
                        <FolderKanban className="w-5 h-5 text-primary" />
                        {title}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Complete Quality Notification master data specification according to ISO 9001 / IATF 16949 standards.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <div className="p-5 sm:p-6 space-y-6 flex-1 overflow-y-auto min-h-0">
                        {/* Section 1: Notification & Header */}
                        <div className="space-y-3 bg-muted/10 p-4 rounded-xl border border-border/60">
                            <div className="flex items-center gap-2 text-base font-bold uppercase tracking-wider text-primary">
                                <FileText className="w-4 h-4" />
                                1. Notification & General Header
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-semibold">Notification ID (QMNUM)</Label>
                                        <Badge variant="outline" className="text-xs font-semibold border-primary/30 bg-primary/10 text-primary">
                                            {isEdit ? 'Assigned' : 'System Assigned'}
                                        </Badge>
                                    </div>
                                    <Input
                                        value={displayedNotificationId}
                                        disabled
                                        readOnly
                                        className="font-mono text-sm h-9 font-semibold bg-muted/60 text-foreground cursor-not-allowed select-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Origin / Type (QMART)</Label>
                                    <Select value={origin} onValueChange={setOrigin}>
                                        <SelectTrigger className="text-sm h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Q3 - Internal Defect">Q3 - Internal Defect (Shop Floor)</SelectItem>
                                            <SelectItem value="Q1 - Customer Complaint">Q1 - Customer Complaint</SelectItem>
                                            <SelectItem value="Q2 - Supplier Defect">Q2 - Supplier Defect</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Status (QSTAT)</Label>
                                    <Select value={sapStatus} onValueChange={setSapStatus}>
                                        <SelectTrigger className="text-sm h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Closed">Closed</SelectItem>
                                            <SelectItem value="Completed">Completed</SelectItem>
                                            <SelectItem value="In Progress">In Progress</SelectItem>
                                            <SelectItem value="In Process">In Process</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Found Date (QMDAT)</Label>
                                    <Input
                                        type="date"
                                        value={foundDate}
                                        onChange={(e) => setFoundDate(e.target.value)}
                                        className="text-sm h-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Completion Date (QMDAB)</Label>
                                    <Input
                                        type="date"
                                        value={completionDate}
                                        onChange={(e) => setCompletionDate(e.target.value)}
                                        className="text-sm h-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Quantity on Hold / Extent (RKMNG)</Label>
                                    <Input
                                        value={quantityExtent}
                                        onChange={(e) => setQuantityExtent(e.target.value)}
                                        placeholder="e.g. 61 units on hold"
                                        className="text-sm h-9"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Reported By / Creator (PARNR)</Label>
                                    <Input
                                        value={reportedBy}
                                        onChange={(e) => setReportedBy(e.target.value)}
                                        placeholder="e.g. Hans Weber (Line 7)"
                                        className="text-sm h-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Coordinator / Partner (PARNR_KO)</Label>
                                    <Input
                                        value={coordinator}
                                        onChange={(e) => setCoordinator(e.target.value)}
                                        placeholder="e.g. Klaus Schmidt (Quality Mgr)"
                                        className="text-sm h-9"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-sm font-semibold">Symptom Short Text / Primary Description (QMTXT)</Label>
                                <Textarea
                                    value={symptomShortText}
                                    onChange={(e) => setSymptomShortText(e.target.value)}
                                    placeholder="e.g. Operator stopped the line - rough edge felt on flange after milling"
                                    className="text-sm resize-y min-h-[50px]"
                                />
                            </div>
                        </div>

                        {/* Section 2: Material & Production Context */}
                        <div className="space-y-3 bg-muted/10 p-4 rounded-xl border border-border/60">
                            <div className="flex items-center gap-2 text-base font-bold uppercase tracking-wider text-primary">
                                <Layers className="w-4 h-4" />
                                2. Material & Production Master Data
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Material ID (MATNR) *</Label>
                                    <ValueHelpInput
                                        value={materialId}
                                        onChange={setMaterialId}
                                        onPick={(entry) => {
                                            const filled = applyReturnMapping(entry, materialVh.returnMapping);
                                            if (filled.materialDesc) setMaterialDesc(filled.materialDesc);
                                            if (filled.materialGroup) setMaterialFamily(filled.materialGroup);
                                        }}
                                        entries={materialVh.entries}
                                        loading={materialVh.loading}
                                        catalogLabel="the material master"
                                        scoringNote="Precedent search matches this code exactly — a new material is fine, a typo is not."
                                        placeholder="e.g. MAT-10247"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Material Description (MAKTX)</Label>
                                    <Input
                                        value={materialDesc}
                                        onChange={(e) => setMaterialDesc(e.target.value)}
                                        placeholder="e.g. Bracket Housing X240"
                                        className="text-sm h-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Material Family / Group (MATKL)</Label>
                                    <Input
                                        value={materialFamily}
                                        onChange={(e) => setMaterialFamily(e.target.value)}
                                        placeholder="e.g. MG-HOUSING / CAST_BRACKET"
                                        className="font-mono text-sm h-9"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Batch ID (CHARG)</Label>
                                    <Input
                                        value={batchId}
                                        onChange={(e) => setBatchId(e.target.value)}
                                        placeholder="e.g. B-55901"
                                        className="font-mono text-sm h-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Work Center ID (ARBPL)</Label>
                                    <ValueHelpInput
                                        value={workCenterId}
                                        onChange={setWorkCenterId}
                                        onPick={(entry) => {
                                            const filled = applyReturnMapping(entry, workCenterVh.returnMapping);
                                            if (filled.workCenterDesc) setWorkCenterDesc(filled.workCenterDesc);
                                        }}
                                        entries={workCenterVh.entries}
                                        loading={workCenterVh.loading}
                                        catalogLabel="the work centre list"
                                        scoringNote="Precedent search matches this code exactly — a new work centre is fine, a typo is not."
                                        placeholder="e.g. WC-MILL-07"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Work Center Description (KTEXT)</Label>
                                    <Input
                                        value={workCenterDesc}
                                        onChange={(e) => setWorkCenterDesc(e.target.value)}
                                        placeholder="e.g. CNC Milling Line 7"
                                        className="text-sm h-9"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Defect Codes & QM Measurements. Cùng lý do
                            như hộp thoại ghi nhận lỗi — S7 bỏ "Defect Class" khỏi
                            giao diện, nên tiêu đề cũng không giữ lại "Classification". */}
                        <div className="space-y-3 bg-muted/10 p-4 rounded-xl border border-border/60">
                            <div className="flex items-center gap-2 text-base font-bold uppercase tracking-wider text-primary">
                                <Microscope className="w-4 h-4" />
                                3. Defect Codes & QM Measurements
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Defect Code (FECOD)</Label>
                                    <ValueHelpInput
                                        value={defectCode}
                                        onChange={setDefectCode}
                                        onPick={(entry) => {
                                            const filled = applyReturnMapping(entry, defectCodeVh.returnMapping);
                                            if (filled.defectText) setDefectText(filled.defectText);
                                            // Nhóm mã lấy từ chính dòng danh mục, không cho gõ:
                                            // một mã chỉ thuộc đúng một nhóm, nên để người dùng
                                            // sửa nhóm là mở đường cho một cặp nhóm/mã không tồn tại.
                                            setDefectCodeGroup(filled.defectCodeGroup ?? '');
                                        }}
                                        entries={defectCodeVh.entries}
                                        loading={defectCodeVh.loading}
                                        strict
                                        catalogLabel="the defect catalogue"
                                        maintenanceHint="Add the code to the defect catalogue first."
                                        placeholder="e.g. DEF-0489"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Code Group</Label>
                                    <Input
                                        value={defectCodeGroup}
                                        readOnly
                                        placeholder="— from Defect Code —"
                                        className="text-sm h-9 font-mono bg-muted/40"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Defect Description (FETXT)</Label>
                                    <Input
                                        value={defectText}
                                        onChange={(e) => setDefectText(e.target.value)}
                                        placeholder="e.g. Flange edge burr above limit"
                                        className="text-sm h-9"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1 border-t border-border/40">
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Inspection Characteristic</Label>
                                    <Input
                                        value={characteristic}
                                        onChange={(e) => setCharacteristic(e.target.value)}
                                        placeholder="e.g. Flange burr height"
                                        className="text-sm h-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Measured Value</Label>
                                    <Input
                                        value={measuredValue}
                                        onChange={(e) => setMeasuredValue(e.target.value)}
                                        placeholder="e.g. 0.32 mm"
                                        className="font-mono text-sm h-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Spec Limit / Tolerance</Label>
                                    <Input
                                        value={specValue}
                                        onChange={(e) => setSpecValue(e.target.value)}
                                        placeholder="e.g. max 0.10 mm"
                                        className="font-mono text-sm h-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Equipment / Fixture (EQUNR)</Label>
                                    <Input
                                        value={equipment}
                                        onChange={(e) => setEquipment(e.target.value)}
                                        placeholder="e.g. WC-MILL-07-F1"
                                        className="font-mono text-sm h-9"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 4: Root Cause, FMEA & Financial Impact */}
                        <div className="space-y-3 bg-muted/10 p-4 rounded-xl border border-border/60">
                            <div className="flex items-center gap-2 text-base font-bold uppercase tracking-wider text-primary">
                                <Wrench className="w-4 h-4" />
                                4. Root Cause Analysis, FMEA & Financial Impact (D4 / D7 / D8)
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Ishikawa 6M Category (URCOD)</Label>
                                    <Select value={rootCauseCategory} onValueChange={setRootCauseCategory}>
                                        <SelectTrigger className="text-sm h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Machine">Machine</SelectItem>
                                            <SelectItem value="Method">Method</SelectItem>
                                            <SelectItem value="Material">Material</SelectItem>
                                            <SelectItem value="Man">Man (Operator)</SelectItem>
                                            <SelectItem value="Measurement">Measurement</SelectItem>
                                            <SelectItem value="Milieu">Milieu (Environment)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">FMEA Reference ID (FMEAR)</Label>
                                    <Input
                                        value={fmeaId}
                                        onChange={(e) => setFmeaId(e.target.value)}
                                        placeholder="e.g. FMEA-MILL07-03"
                                        className="font-mono text-sm h-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">COPQ (Cost of Poor Quality in EUR)</Label>
                                    <Input
                                        type="number"
                                        value={copqEur}
                                        onChange={(e) => setCopqEur(e.target.value)}
                                        placeholder="e.g. 14200"
                                        className="font-mono text-sm h-9"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Root Cause Detail / 5-Why Conclusion (URTXT)</Label>
                                    <Textarea
                                        value={rootCauseDetail}
                                        onChange={(e) => setRootCauseDetail(e.target.value)}
                                        placeholder="e.g. Hydraulic clamping cylinder internal piston seal degradation on fixture F1"
                                        className="text-sm resize-y min-h-[50px]"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Proven Corrective Action (PCA / D5)</Label>
                                    <Textarea
                                        value={correctiveAction}
                                        onChange={(e) => setCorrectiveAction(e.target.value)}
                                        placeholder="e.g. Replaced cylinder seal kit with Viton seals; installed digital pressure sensor interlock"
                                        className="text-sm resize-y min-h-[50px]"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-row items-center justify-end gap-2.5 p-4 sm:px-6 border-t border-border/80 bg-background shrink-0">
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-9 text-sm">
                            Cancel
                        </Button>
                        <Button type="submit" size="sm" disabled={isPending || defectCodeOutside} className="h-9 text-sm bg-primary font-semibold gap-1.5">
                            {isPending ? <Spinner className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                            Save Historical Case
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function CaseJsonImportDialog({
    open,
    onOpenChange,
    onSuccess,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}) {
    const [jsonText, setJsonText] = useState('');
    const [importing, setImporting] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);

    const sampleJson = `[
  {
    "notificationId": "8D-10048412",
    "origin": "Q3 - Internal Defect",
    "symptomShortText": "Flange edge burr above limit after milling",
    "status": "In Process",
    "foundDate": "2026-08-03",
    "completionDate": null,
    "quantityExtent": "128 units affected",
    "material": {
      "materialId": "MAT-10247",
      "description": "Bracket Housing X240",
      "materialGroup": "MG-HOUSING"
    },
    "batch": {
      "batchId": "B-49172",
      "materialId": "MAT-10247"
    },
    "defect": {
      "defectCode": "DEF-0489",
      "defectText": "Flange edge burr above limit"
    },
    "workCenter": {
      "workCenterId": "WC-MILL-07",
      "description": "CNC Milling Line 7"
    },
    "inspections": [
      {
        "characteristic": "Flange burr height",
        "measuredValue": "0.32 mm",
        "specValue": "max 0.10 mm",
        "equipment": "WC-MILL-07-F1"
      }
    ],
    "causesIshikawa": [
      {
        "category": "Machine",
        "description": "Fixture F1 hydraulic cylinder seal degradation",
        "isRootCause": "Y"
      }
    ],
    "fiveWhyChain": [
      {
        "stepNo": 1,
        "question": "Why did flange have rough burr?",
        "answer": "Fixture clamping pressure dropped on F1"
      }
    ],
    "actions": [
      {
        "lineNo": 1,
        "actionType": "Corrective",
        "actionText": "Replace hydraulic cylinder seal kit on F1",
        "status": "Done"
      }
    ],
    "fmeaLink": {
      "fmeaId": "FMEA-MILL07-03",
      "description": "Fixture clamping loss"
    },
    "costCopq": {
      "costOfPoorQualityEur": 14200
    },
    "sapStatus": "Closed"
  }
]`;

    const handleLoadSample = () => {
        setJsonText(sampleJson);
        setParseError(null);
    };

    const handleImport = async () => {
        setParseError(null);
        if (!jsonText.trim()) {
            setParseError('Please enter JSON data.');
            return;
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(jsonText.trim());
        } catch (e: any) {
            setParseError(`Invalid JSON syntax: ${e.message}`);
            return;
        }

        const items: Array<any> = Array.isArray(parsed) ? parsed : [parsed];

        if (items.length === 0) {
            setParseError('JSON array is empty.');
            return;
        }

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            // `notificationId` tuỳ chọn: file xuất từ SAP mang số của nó, file dựng
            // tay thì để server cấp. `materialId` thì không ai cấp hộ được.
            const matId = item.materialId || item.material?.materialId;
            if (!matId) {
                setParseError(`Item at index ${i} is missing a required field (materialId).`);
                return;
            }
        }

        setImporting(true);
        try {
            /*
             * ── Vì sao gọi `seedCaseLibrary` chứ không tạo từng dòng ─────────────
             *
             * Ở đây từng có một vòng lặp `historicalCasesService.create(...)` tự tay
             * map khoảng 20 trường. Dòng nó sinh ra thiếu `defectKeywords`,
             * `searchText`, `attributesJson` và cả nhóm 8D lẫn danh sách hành động —
             * tức là case nằm trong kho, hiện trên màn hình này, và ăn 0 điểm ở mọi
             * tiêu chí tìm tiền lệ. Không có lỗi nào báo; nhìn từ phía người dùng nó
             * giống hệt "không có case nào tương tự".
             *
             * Action ở server đi qua đúng bộ mapper mà pipeline phân tích dùng, nên
             * một payload SAP lồng nhau đầy đủ vào kho nguyên vẹn thay vì bị dẹp
             * phẳng thành 20 cột. Nó cũng báo lại từng dòng bị bỏ và LÝ DO — thứ mà
             * vòng lặp cũ không có.
             *
             * Đánh đổi đã biết: action yêu cầu vai trò `admin`, còn `POST` trên
             * entity mở tới `User`. Nhập kho tiền lệ là việc quản trị dữ liệu, không
             * phải việc thường ngày của kỹ sư chất lượng, nên thu hẹp là đúng.
             */
            const report = await eightDService.seedCaseLibrary(items);

            if (report.inserted + report.replaced > 0) {
                const parts = [
                    report.inserted ? `${report.inserted} added` : '',
                    report.replaced ? `${report.replaced} replaced` : '',
                ].filter(Boolean).join(', ');
                toast.success(`Imported ${report.inserted + report.replaced} case(s): ${parts}.`);
                onSuccess();
                onOpenChange(false);
                setJsonText('');
            }

            if (report.skipped.length) {
                const first = report.skipped[0];
                toast.error(
                    `Skipped ${report.skipped.length} record(s). #${first.index + 1}: ${first.reason}`,
                );
                if (report.inserted + report.replaced === 0) {
                    setParseError(
                        report.skipped
                            .slice(0, 5)
                            .map((s) => `#${s.index + 1}${s.notificationId ? ` (${s.notificationId})` : ''}: ${s.reason}`)
                            .join('\n'),
                    );
                }
            }
        } catch (err: any) {
            const message = err?.response?.data?.error?.message ?? err?.message ?? 'Failed to import.';
            setParseError(message);
            toast.error(message);
        } finally {
            setImporting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-3xl md:max-w-4xl !max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 rounded-2xl border-border/90 shadow-2xl overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-border/70 bg-muted/20 shrink-0">
                    <DialogTitle className="text-base font-bold flex items-center gap-2">
                        <FileCode className="w-5 h-5 text-primary" />
                        Import Historical Defect Cases from JSON
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Supports both flat JSON and full nested Golden Case format.
                    </p>
                </div>

                <div className="p-5 sm:p-6 flex flex-col flex-1 min-h-0 space-y-3 overflow-hidden">
                    <div className="flex items-center justify-between shrink-0">
                        <p className="text-sm text-muted-foreground">
                            Paste a single JSON object or an array of defect case objects:
                        </p>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleLoadSample}
                            className="h-8 text-sm text-primary hover:underline cursor-pointer gap-1"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            Insert Sample Template
                        </Button>
                    </div>

                    <div className="flex-1 min-h-0">
                        <Textarea
                            value={jsonText}
                            onChange={(e) => { setJsonText(e.target.value); setParseError(null); }}
                            placeholder={sampleJson}
                            className="font-mono text-sm h-[360px] max-h-[50vh] sm:max-h-[55vh] w-full bg-background resize-none overflow-y-auto"
                        />
                    </div>

                    {parseError && (
                        <div className="flex items-center gap-1.5 text-sm text-destructive bg-destructive/10 p-2.5 rounded-md shrink-0">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{parseError}</span>
                        </div>
                    )}

                    <div className="flex flex-row items-center justify-end gap-2.5 pt-3 border-t border-border/80 shrink-0">
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={importing} className="h-9 text-sm">
                            Cancel
                        </Button>
                        <Button type="button" size="sm" onClick={handleImport} disabled={importing} className="h-9 text-sm bg-primary font-semibold gap-1.5">
                            {importing ? <Spinner className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            Import Cases
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
