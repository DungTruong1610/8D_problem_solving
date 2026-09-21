import React, { useState, useEffect, useMemo } from 'react';
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
    ClipboardCheck,
    Edit,
    FileCode,
    Layers,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    Trash2,
    XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    inspectionLotsService,
    useNextNumber,
    type InspectionLotItem,
} from '@/services/master-data-service';
import { useValueHelp } from '@/hooks/use-value-help';
import { ValueHelpInput } from '@/components/ui/ValueHelpInput';
import { findEntry, isOutsideCatalogue, VALUE_HELP_IDS } from '@/services/value-help-service';

/*
 * ── Số lô kiểm tra do SERVER cấp ─────────────────────────────────────────────
 *
 * Ở đây từng có `generateNextLotId(items)` — `max(items) + 1` tính trong trình
 * duyệt. Nó hỏng ba kiểu, và cả ba đều lặng lẽ:
 *
 *   1. `items` là những dòng ĐANG TẢI, không phải cả bảng. Lọc theo vật tư hoặc
 *      sang trang thứ hai là "số kế tiếp" có thể đã tồn tại.
 *   2. Hai người mở form cùng lúc thì cùng thấy một số và cùng lưu.
 *   3. Số hiện ra ngay khi mở form, nên mỗi form bỏ dở đốt một số.
 *
 * Giờ ô để trống và server cấp số trong chính transaction của lệnh insert (xem
 * `srv/src/domain/numberRange.ts`). Gõ tay vẫn được — dữ liệu nhập từ ngoài mang
 * số của chính nó, và SAP hỗ trợ cả hai kiểu.
 */

export function InspectionLotsTab() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [selectedMaterial, setSelectedMaterial] = useState<string>('ALL');
    const [selectedConforming, setSelectedConforming] = useState<string>('ALL');
    const [createOpen, setCreateOpen] = useState(false);
    const [createDialogKey, setCreateDialogKey] = useState(0);
    const [jsonImportOpen, setJsonImportOpen] = useState(false);
    const [editItem, setEditItem] = useState<InspectionLotItem | null>(null);
    const [deleteItem, setDeleteItem] = useState<InspectionLotItem | null>(null);

    const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
        queryKey: ['master-data', 'inspection-lots', search, selectedMaterial, selectedConforming],
        queryFn: () => inspectionLotsService.list({
            search,
            materialId: selectedMaterial !== 'ALL' ? selectedMaterial : undefined,
            conforming: selectedConforming === 'PASS' ? true : selectedConforming === 'FAIL' ? false : undefined,
            top: 200,
        }),
    });

    const { data: allData } = useQuery({
        queryKey: ['master-data', 'inspection-lots-all'],
        queryFn: () => inspectionLotsService.list({ top: 1000 }),
    });

    const rows = data?.value ?? [];
    const allRows = allData?.value ?? rows;

    // Distinct materials for filter dropdown
    const allMaterials = Array.from(new Set(allRows.map((r) => r.materialId).filter(Boolean))).sort();

    const createMutation = useMutation({
        mutationFn: (item: Partial<InspectionLotItem>) => inspectionLotsService.create(item),
        onSuccess: () => {
            toast.success('Inspection lot created successfully.');
            setCreateOpen(false);
            void queryClient.invalidateQueries({ queryKey: ['master-data', 'inspection-lots'] });
            void queryClient.invalidateQueries({ queryKey: ['number-range'] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error?.message ?? err?.message ?? 'Failed to create inspection lot.');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, item }: { id: string; item: Partial<InspectionLotItem> }) =>
            inspectionLotsService.update(id, item),
        onSuccess: () => {
            toast.success('Inspection lot updated successfully.');
            setEditItem(null);
            void queryClient.invalidateQueries({ queryKey: ['master-data', 'inspection-lots'] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error?.message ?? err?.message ?? 'Failed to update inspection lot.');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => inspectionLotsService.delete(id),
        onSuccess: () => {
            toast.success('Inspection lot deleted successfully.');
            setDeleteItem(null);
            void queryClient.invalidateQueries({ queryKey: ['master-data', 'inspection-lots'] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error?.message ?? err?.message ?? 'Failed to delete inspection lot.');
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
                            placeholder="Search Lot ID, Material, Characteristic, Equipment..."
                            className="pl-8 text-sm h-9 bg-background"
                        />
                    </div>

                    <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
                        <SelectTrigger className="w-36 text-sm h-9">
                            <SelectValue placeholder="Material" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Materials</SelectItem>
                            {allMaterials.map((mat) => (
                                <SelectItem key={mat} value={mat}>
                                    {mat}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={selectedConforming} onValueChange={setSelectedConforming}>
                        <SelectTrigger className="w-32 text-sm h-9">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Results</SelectItem>
                            <SelectItem value="PASS">Pass Only</SelectItem>
                            <SelectItem value="FAIL">Fail Only</SelectItem>
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
                        variant="outline"
                        size="sm"
                        onClick={() => setJsonImportOpen(true)}
                        className="h-9 gap-1.5 text-sm text-primary border-primary/30 hover:bg-primary/5 font-medium"
                    >
                        <FileCode className="w-4 h-4" />
                        Import JSON
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
                        Add Inspection Lot
                    </Button>
                </div>
            </div>

            {/* Table Card */}
            <Card className="overflow-hidden border border-border/80 shadow-xs">
                {isLoading ? (
                    <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
                        <Spinner className="w-4 h-4" /> Loading inspection lots…
                    </div>
                ) : isError ? (
                    <div className="p-8 text-center text-sm text-destructive">
                        <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                        Failed to load inspection lots: {(error as Error)?.message}
                    </div>
                ) : rows.length === 0 ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                        <Layers className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                        No inspection lots found matching filters.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-border/80 bg-muted/50 font-semibold text-muted-foreground">
                                    <th className="py-3 px-4 w-32">Lot ID</th>
                                    <th className="py-3 px-4 w-36">Material ID</th>
                                    <th className="py-3 px-4 min-w-[180px]">Characteristic</th>
                                    <th className="py-3 px-4 w-40">Equipment / Fixture</th>
                                    <th className="py-3 px-4 w-32">Measured Value</th>
                                    <th className="py-3 px-4 w-28">Result</th>
                                    <th className="py-3 px-4 w-32">Lot Date</th>
                                    <th className="py-3 px-4 w-24 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {rows.map((row) => (
                                    <tr key={row.ID} className="hover:bg-muted/30 transition-colors">
                                        <td className="py-3 px-4 font-mono font-bold text-foreground">
                                            {row.lotId}
                                        </td>
                                        <td className="py-3 px-4 font-mono font-medium text-foreground">
                                            {row.materialId}
                                        </td>
                                        <td className="py-3 px-4 font-medium text-foreground">
                                            {row.characteristic}
                                        </td>
                                        <td className="py-3 px-4 font-mono text-muted-foreground">
                                            {row.equipment || '—'}
                                        </td>
                                        <td className="py-3 px-4 font-mono font-semibold text-foreground">
                                            {row.measuredValue != null ? `${row.measuredValue} ${row.unit || ''}` : '—'}
                                        </td>
                                        <td className="py-3 px-4">
                                            {row.conforming ? (
                                                <Badge
                                                    variant="outline"
                                                    className="border-success/30 text-success bg-success/10 text-sm font-semibold px-2.5 py-0.5 gap-1"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Pass
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="outline"
                                                    className="border-destructive/30 text-destructive bg-destructive/10 text-sm font-semibold px-2.5 py-0.5 gap-1"
                                                >
                                                    <XCircle className="w-3.5 h-3.5" /> Fail
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 tabular-nums text-muted-foreground">
                                            {row.lotDate || '—'}
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

            {/* Create Dialog */}
            <InspectionLotFormDialog
                key={`lot-create-${createDialogKey}`}
                open={createOpen}
                onOpenChange={setCreateOpen}
                title="Add Inspection Lot (QM Data)"
                isPending={createMutation.isPending}
                onSubmit={(values) => createMutation.mutate(values)}
            />

            {/* JSON Import Dialog */}
            <InspectionLotJsonImportDialog
                open={jsonImportOpen}
                onOpenChange={setJsonImportOpen}
                onSuccess={() => {
                    void queryClient.invalidateQueries({ queryKey: ['master-data', 'inspection-lots'] });
                    void queryClient.invalidateQueries({ queryKey: ['master-data', 'inspection-lots-all'] });
                }}
            />

            {/* Edit Dialog */}
            {editItem && (
                <InspectionLotFormDialog
                    open={Boolean(editItem)}
                    onOpenChange={(open) => !open && setEditItem(null)}
                    title={`Edit Inspection Lot — ${editItem.lotId}`}
                    initialValues={editItem}
                    isPending={updateMutation.isPending}
                    onSubmit={(values) => updateMutation.mutate({ id: editItem.ID, item: values })}
                />
            )}

            {/* Delete Dialog */}
            {deleteItem && (
                <Dialog open={Boolean(deleteItem)} onOpenChange={(open) => !open && setDeleteItem(null)}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
                                <AlertCircle className="w-5 h-5" />
                                Delete Inspection Lot
                            </DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground mt-2">
                            Are you sure you want to delete lot <strong className="font-mono text-foreground">{deleteItem.lotId}</strong> ({deleteItem.characteristic})?
                            This will affect historical Is/Is-Not population statistics for material {deleteItem.materialId}.
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

function InspectionLotFormDialog({
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
    initialValues?: InspectionLotItem;
    isPending: boolean;
    onSubmit: (values: Partial<InspectionLotItem>) => void;
}) {
    // Trống khi tạo mới: server cấp số lúc lưu. Có sẵn khi sửa — số đã cấp rồi.
    const [lotId, setLotId] = useState(() => initialValues?.lotId || '');
    const isEdit = Boolean(initialValues?.lotId);
    const nextLotIdQuery = useNextNumber('INSPLOT', open && !isEdit);

    useEffect(() => {
        if (open) {
            if (isEdit) {
                setLotId(initialValues?.lotId || '');
            } else if (nextLotIdQuery.data && !lotId) {
                setLotId(nextLotIdQuery.data);
            }
        }
    }, [open, initialValues, isEdit, nextLotIdQuery.data, lotId]);

    const displayedLotId = isEdit
        ? lotId
        : (lotId || nextLotIdQuery.data || 'Allocating ID...');
    const [materialId, setMaterialId] = useState(initialValues?.materialId || '');
    const [characteristic, setCharacteristic] = useState(initialValues?.characteristic || '');
    const [equipment, setEquipment] = useState(initialValues?.equipment || '');
    const [workCenterId, setWorkCenterId] = useState(initialValues?.workCenterId || '');
    const [measuredValue, setMeasuredValue] = useState(initialValues?.measuredValue || '');
    const [unit, setUnit] = useState(initialValues?.unit || 'mm');
    const [conforming, setConforming] = useState(initialValues?.conforming ?? true);
    const [lotDate, setLotDate] = useState(initialValues?.lotDate || new Date().toISOString().split('T')[0]);
    const [plant, setPlant] = useState(initialValues?.plant || '1000');
    const [originCode, setOriginCode] = useState('03');

    // ── F4: nhà máy CỨNG, vật tư thì không ──
    // `PLANT` là danh mục static độc lập — khoá cứng được.
    // `MATERIAL` đọc từ `HistoricalCases`, tức là chỉ chứa vật tư ĐÃ TỪNG có case
    // 8D đóng. Đa số vật tư không có. Khoá cứng ở đây nghĩa là không ghi được lô
    // kiểm tra cho một vật tư chưa từng hỏng — vô lý, vì lô kiểm tra là thứ có
    // TRƯỚC lỗi. Nên gợi ý và cảnh báo gõ sai, không chặn.
    const plantVh = useValueHelp(VALUE_HELP_IDS.plant, { enabled: open });
    const materialVh = useValueHelp(VALUE_HELP_IDS.material, { enabled: open });
    const workCenterVh = useValueHelp(VALUE_HELP_IDS.workCenter, { enabled: open });
    const plantOutside = isOutsideCatalogue(plantVh.entries, plant, plantVh.loading);

    /**
     * Trạm suy ra từ mã thiết bị — CHỈ để gợi ý, không tự điền.
     *
     * Quy ước `<trạm>-<đồ gá>` là quy ước của bộ dữ liệu mẫu, không phải luật.
     * Ô cũ áp phép cắt này lên mọi mã, kèm giá trị dự phòng cứng `WC-MILL-07`, và
     * hiển thị kết quả như thể đó là dữ liệu — trong khi nó chưa từng được lưu.
     * Ở đây chỉ đề xuất khi phần cắt ra KHỚP một trạm có thật trong danh mục, và
     * người dùng phải bấm nhận. Đoán được xác nhận thì không còn là đoán.
     */
    const derivedWorkCenter = useMemo(() => {
        const guess = equipment.split('-').slice(0, 3).join('-');
        if (!guess || guess === equipment.trim()) return null;
        return findEntry(workCenterVh.entries, guess)?.key ?? null;
    }, [equipment, workCenterVh.entries]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // `lotId` KHÔNG nằm trong danh sách bắt buộc nữa: để trống là hợp lệ, và
        // server sẽ cấp số. Chỉ Material và Characteristic là thứ người dùng biết.
        if (!materialId.trim() || !characteristic.trim()) {
            toast.error('Material and Characteristic are required.');
            return;
        }
        if (plantOutside) {
            toast.error(`Plant "${plant.trim()}" is not in the plant list.`, {
                description: 'Pick one from the list, or maintain the plant list first.',
            });
            return;
        }

        const finalLotId = isEdit ? lotId.trim() : undefined;
        onSubmit({
            ...(finalLotId ? { lotId: finalLotId } : {}),
            materialId: materialId.trim(),
            characteristic: characteristic.trim(),
            equipment: equipment.trim() || null,
            workCenterId: workCenterId.trim() || null,
            measuredValue: measuredValue.trim() || null,
            unit: unit.trim() || null,
            conforming,
            lotDate: lotDate || null,
            plant: plant.trim() || null,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-4xl md:max-w-5xl !max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0 rounded-2xl border-border/90 shadow-2xl overflow-hidden">
                {/* QM Header Strip */}
                <div className="bg-gradient-to-r from-blue-950/20 via-blue-900/10 to-transparent px-6 py-4 border-b border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className="p-2.5 rounded-xl bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-600/30 shrink-0">
                            <ClipboardCheck className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <DialogTitle className="text-base font-bold text-foreground tracking-tight">
                                     {title}
                                 </DialogTitle>
                                 <Badge variant="outline" className="font-mono text-xs border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/5 shrink-0 px-2.5 py-0.5">
                                     QM • QA01/QE51N
                                 </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                Quality Management — Record Characteristic Inspection Results & Usage Decision
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                        <Badge variant="secondary" className="font-mono text-sm font-semibold px-3 py-1 whitespace-nowrap">
                            Plant {plant || '1000'}
                        </Badge>
                        <Badge variant="outline" className="text-sm font-semibold border-border text-muted-foreground px-3 py-1 whitespace-nowrap">
                            Origin: {originCode === '03' ? '03 (In-Process)' : '01 (Goods Receipt)'}
                        </Badge>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <div className="p-6 space-y-4 flex-1 overflow-y-auto min-h-0">
                        {/* Section 1: General Header Data (Allgemeine Daten) */}
                        <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3.5 shadow-2xs">
                            <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                <span className="text-base font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                                    1. Inspection Lot Identification (Prüflos Header)
                                </span>
                                <span className="text-xs text-muted-foreground font-mono">QALS-PRUEFLOS</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                                <div className="sm:col-span-4 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-semibold text-foreground">
                                            Inspection Lot ID (Prüflos)
                                        </Label>
                                        <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 border-primary/30 bg-primary/10 text-primary">
                                            {isEdit ? 'Assigned' : 'System Assigned'}
                                        </Badge>
                                    </div>
                                    <Input
                                        value={displayedLotId}
                                        disabled
                                        readOnly
                                        className="font-mono text-sm h-9 font-semibold bg-muted/60 text-foreground cursor-not-allowed select-all"
                                    />
                                    <p className="text-sm leading-snug text-muted-foreground">
                                        {isEdit
                                            ? 'Fixed inspection lot number (QALS). Cannot be modified.'
                                            : 'Auto-assigned by system number sequence (QALS) on save.'}
                                    </p>
                                </div>

                                <div className="sm:col-span-4 space-y-1">
                                    <Label className="text-sm font-semibold text-foreground">
                                        Inspection Origin (Herkunft)
                                    </Label>
                                    <Select value={originCode} onValueChange={setOriginCode}>
                                        <SelectTrigger className="text-sm h-9 bg-background">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="03">03 — In-Process Production</SelectItem>
                                            <SelectItem value="01">01 — Goods Receipt (Vendor)</SelectItem>
                                            <SelectItem value="04">04 — Goods Receipt from Production</SelectItem>
                                            <SelectItem value="89">89 — Other Manual Inspection</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="sm:col-span-4 space-y-1">
                                    <Label className="text-sm font-semibold text-foreground">
                                        Plant (Werk)
                                    </Label>
                                    <ValueHelpInput
                                        value={plant}
                                        onChange={setPlant}
                                        entries={plantVh.entries}
                                        loading={plantVh.loading}
                                        strict
                                        catalogLabel="the plant list"
                                        maintenanceHint="Maintain the plant list first."
                                        placeholder="e.g. 1000"
                                    />
                                </div>

                                <div className="sm:col-span-6 space-y-1">
                                    <Label className="text-sm font-semibold text-foreground">
                                        Material Number (Material) *
                                    </Label>
                                    <ValueHelpInput
                                        value={materialId}
                                        onChange={setMaterialId}
                                        entries={materialVh.entries}
                                        loading={materialVh.loading}
                                        catalogLabel="the material master"
                                        scoringNote="D2 matches this code exactly when it pulls inspection history — a new material is fine, a typo is not."
                                        placeholder="e.g. MAT-10247"
                                        className="[&_input]:font-semibold [&_input]:text-primary"
                                    />
                                </div>

                                <div className="sm:col-span-6 space-y-1">
                                    <Label className="text-sm font-semibold text-foreground">
                                        Inspection Date (Prüfdatum)
                                    </Label>
                                    <Input
                                        type="date"
                                        value={lotDate}
                                        onChange={(e) => setLotDate(e.target.value)}
                                        className="text-sm h-9 bg-background"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Work Center & Equipment (Arbeitsplatz & Equipment) */}
                        <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3.5 shadow-2xs">
                            <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                <span className="text-base font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                                    2. Work Center & Equipment Assignment (Arbeitsplatz & Equipment)
                                </span>
                                <span className="text-xs text-muted-foreground font-mono">QAMR-EQUIPMENT</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold text-foreground">
                                        Equipment / Fixture (Vorrichtung) *
                                    </Label>
                                    <Input
                                        value={equipment}
                                        onChange={(e) => setEquipment(e.target.value)}
                                        placeholder="e.g. WC-MILL-07-F1"
                                        className="font-mono text-sm h-9 bg-background font-medium"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold text-foreground">
                                        Work Center Reference (Arbeitsplatz)
                                    </Label>
                                    <ValueHelpInput
                                        value={workCenterId}
                                        onChange={setWorkCenterId}
                                        entries={workCenterVh.entries}
                                        loading={workCenterVh.loading}
                                        placeholder="e.g. WC-MILL-07"
                                        catalogLabel="the work center list"
                                        scoringNote="Precedent matching scores work center on an exact match."
                                    />
                                    {derivedWorkCenter && derivedWorkCenter !== workCenterId.trim() && (
                                        <button
                                            type="button"
                                            onClick={() => setWorkCenterId(derivedWorkCenter)}
                                            className="text-sm leading-snug text-primary underline-offset-2 hover:underline"
                                        >
                                            Use {derivedWorkCenter} — from the equipment code
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Characteristic Results Recording & Valuation (Ergebniserfassung - QE51N) */}
                        <div className="rounded-xl border border-border/80 bg-card p-4 space-y-4 shadow-2xs">
                            <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                <span className="text-base font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                                    3. Characteristic Result Recording & Usage Decision (QE51N)
                                </span>
                                <span className="text-xs text-muted-foreground font-mono">QAMV / QASR</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                                <div className="sm:col-span-6 space-y-1">
                                    <Label className="text-sm font-semibold text-foreground">
                                        Master Inspection Characteristic (Prüfmerkmal) *
                                    </Label>
                                    <Input
                                        value={characteristic}
                                        onChange={(e) => setCharacteristic(e.target.value)}
                                        placeholder="e.g. Flange burr height"
                                        className="text-sm h-9 bg-background font-medium"
                                        required
                                    />
                                </div>

                                <div className="sm:col-span-3 space-y-1">
                                    <Label className="text-sm font-semibold text-foreground">
                                        Measured Value (Messwert)
                                    </Label>
                                    <Input
                                        value={measuredValue}
                                        onChange={(e) => setMeasuredValue(e.target.value)}
                                        placeholder="e.g. 0.32"
                                        className="font-mono text-sm h-9 bg-background font-bold"
                                    />
                                </div>

                                <div className="sm:col-span-3 space-y-1">
                                    <Label className="text-sm font-semibold text-foreground">
                                        Unit (Einheit)
                                    </Label>
                                    <Input
                                        value={unit}
                                        onChange={(e) => setUnit(e.target.value)}
                                        placeholder="e.g. mm"
                                        className="text-sm h-9 bg-background"
                                    />
                                </div>
                            </div>

                            {/* Characteristic Valuation Decision */}
                            <div className="pt-2">
                                <Label className="text-sm font-semibold text-foreground block mb-2">
                                    Characteristic Valuation (Merkmalsbewertung / VBEWERTUNG)
                                </Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setConforming(true)}
                                        className={cn(
                                            'flex items-center gap-3.5 p-3.5 rounded-xl border text-left transition-all cursor-pointer',
                                            conforming
                                                ? 'border-emerald-500 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/40'
                                                : 'border-border bg-card hover:bg-muted/40 opacity-70'
                                        )}
                                    >
                                        <div className={cn(
                                            'p-2 rounded-lg shrink-0',
                                            conforming ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'
                                        )}>
                                            <CheckCircle2 className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-semibold text-sm text-foreground flex items-center justify-between gap-2">
                                                <span>Accepted (A) — Conforming</span>
                                                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium">Pass / In-Spec</span>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-0.5">
                                                Result conforms with drawing tolerance limits
                                            </p>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setConforming(false)}
                                        className={cn(
                                            'flex items-center gap-3.5 p-3.5 rounded-xl border text-left transition-all cursor-pointer',
                                            !conforming
                                                ? 'border-rose-500 bg-rose-500/10 shadow-xs ring-1 ring-rose-500/40'
                                                : 'border-border bg-card hover:bg-muted/40 opacity-70'
                                        )}
                                    >
                                        <div className={cn(
                                            'p-2 rounded-lg shrink-0',
                                            !conforming ? 'bg-rose-600 text-white' : 'bg-muted text-muted-foreground'
                                        )}>
                                            <XCircle className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-semibold text-sm text-foreground flex items-center justify-between gap-2">
                                                <span>Rejected (R) — Non-Conforming</span>
                                                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 font-medium">Fail / Out-of-Spec</span>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-0.5">
                                                Exceeds specification limit (Lead for Is / Is-Not)
                                            </p>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Dialog Footer Actions */}
                    <div className="p-4 sm:px-6 border-t border-border/70 flex flex-col sm:flex-row items-center justify-between gap-3 bg-background shrink-0">
                        <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                            <span>ISO 9001 / IATF 16949 QM Audit Compliant</span>
                        </div>
                        <div className="flex items-center gap-2.5 self-end sm:self-center">
                            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-9 px-4 text-sm">
                                Cancel
                            </Button>
                            <Button type="submit" size="sm" disabled={isPending || plantOutside} className="h-9 px-5 text-sm bg-primary text-primary-foreground font-semibold">
                                {isPending ? <Spinner className="w-4 h-4 mr-1.5" /> : null}
                                Save Inspection Lot
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function InspectionLotJsonImportDialog({
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
    "lotId": "0010000001",
    "materialId": "MAT-10247",
    "characteristic": "Flange burr height",
    "equipment": "WC-MILL-07-F1",
    "workCenterId": "WC-MILL-07",
    "measuredValue": "0.32",
    "unit": "mm",
    "conforming": false,
    "lotDate": "2026-08-25",
    "plant": "1000"
  },
  {
    "lotId": "0010000004",
    "materialId": "MAT-10247",
    "characteristic": "Flange burr height",
    "equipment": "WC-MILL-07-F2",
    "workCenterId": "WC-MILL-07",
    "measuredValue": "0.04",
    "unit": "mm",
    "conforming": true,
    "lotDate": "2026-08-25",
    "plant": "1000"
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

        const items: Array<Partial<InspectionLotItem>> = Array.isArray(parsed) ? parsed : [parsed as Partial<InspectionLotItem>];

        if (items.length === 0) {
            setParseError('JSON array is empty.');
            return;
        }

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            // `lotId` tuỳ chọn: file xuất từ hệ thống khác thì mang số của nó, còn
            // file dựng tay thì để server cấp. Hai trường kia không ai cấp hộ được.
            if (!item.materialId || !item.characteristic) {
                setParseError(`Item at index ${i} is missing required fields (materialId, characteristic).`);
                return;
            }
        }

        setImporting(true);
        let successCount = 0;
        let failCount = 0;
        const errors: string[] = [];

        for (const item of items) {
            try {
                await inspectionLotsService.create({
                    ...(item.lotId ? { lotId: String(item.lotId).trim() } : {}),
                    materialId: String(item.materialId).trim(),
                    characteristic: String(item.characteristic).trim(),
                    equipment: item.equipment ? String(item.equipment).trim() : null,
                    // Không suy từ `equipment` khi thiếu: nhập hàng loạt không có ai
                    // ngồi xác nhận, và một trạm đoán sai thì im lặng đi thẳng vào
                    // dữ liệu gốc.
                    workCenterId: item.workCenterId ? String(item.workCenterId).trim() : null,
                    measuredValue: item.measuredValue != null ? String(item.measuredValue).trim() : null,
                    unit: item.unit ? String(item.unit).trim() : null,
                    conforming: item.conforming ?? true,
                    lotDate: item.lotDate || null,
                    plant: item.plant ? String(item.plant).trim() : null,
                });
                successCount++;
            } catch (err: any) {
                failCount++;
                errors.push(err?.response?.data?.error?.message ?? err?.message ?? 'Failed to save');
            }
        }

        setImporting(false);
        if (successCount > 0) {
            toast.success(`Imported ${successCount} QM inspection lot${successCount > 1 ? 's' : ''} successfully!`);
            onSuccess();
            onOpenChange(false);
            setJsonText('');
        }
        if (failCount > 0) {
            toast.error(`Failed to import ${failCount} lot(s): ${errors[0] || ''}`);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-3xl md:max-w-4xl !max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 rounded-2xl border-border/90 shadow-2xl overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-border/70 bg-muted/20 shrink-0">
                    <DialogTitle className="text-base font-bold flex items-center gap-2">
                        <FileCode className="w-5 h-5 text-primary" />
                        Import Inspection History from JSON
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Paste single lot object or array of lot inspection records.
                    </p>
                </div>

                <div className="p-5 sm:p-6 flex flex-col flex-1 min-h-0 space-y-3 overflow-hidden">
                    <div className="flex items-center justify-between shrink-0">
                        <p className="text-sm text-muted-foreground">
                            Paste a single JSON object or an array of inspection lot records:
                        </p>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleLoadSample}
                            className="h-8 text-sm text-primary hover:underline cursor-pointer"
                        >
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
                        <Button type="button" size="sm" onClick={handleImport} disabled={importing} className="h-9 text-sm bg-primary font-semibold">
                            {importing ? <Spinner className="w-4 h-4 mr-1.5" /> : null}
                            Import Lots
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
