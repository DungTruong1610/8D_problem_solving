/**
 * Tab Code Catalogues — hai danh mục mã của QM, đặt cạnh nhau.
 *
 * ── Vì sao tab này tồn tại ──
 * Trước Phase 4, danh mục mã lỗi CÓ thật nhưng không ai nhìn thấy được: nó sống
 * trong `ValueHelpList` và chỉ ló ra qua ô gợi ý của form. Hệ quả là câu "add it
 * in Master Data first" trong cảnh báo F4 cứng chỉ tới một chỗ không tồn tại.
 * Tab này là chỗ đó.
 *
 * ── Vì sao chỉ đọc ──
 * Cả hai danh mục là dữ liệu chủ của SAP: mã lỗi là catalog type 9, mã nhiệm vụ
 * là type 2. Ngày nối S/4, chúng đổi `sourceType` sang 'external' và nguồn sự
 * thật nằm ngoài app này. Mở đường ghi ở đây là hứa một thứ sẽ phải rút lại —
 * và tệ hơn, là tạo ra một bản danh mục thứ hai lệch với bản của SAP. Đường sửa
 * đúng là sửa danh mục nguồn rồi seeder đối chiếu lại.
 *
 * ── Vì sao có cột "Used in closed cases" ──
 * Đó là toàn bộ lý do Phase 4 mã hoá nhiệm vụ. Câu hỏi "lần trước gặp chuyện này
 * chúng ta đã làm gì" trước đây phải đọc 78 câu văn mới trả lời được; có mã thì
 * nó là một phép đếm. Cột này là bằng chứng nhìn thấy được rằng phép đếm đó chạy
 * — và một mã đếm ra 0 nói đúng một điều có ích: chưa case đóng nào dùng tới nó.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Badge,
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
import { Info, Search, Tags } from 'lucide-react';
import { useValueHelp } from '@/hooks/use-value-help';
import { VALUE_HELP_IDS, type ValueHelpId, type ValueHelpEntry } from '@/services/value-help-service';
import axiosInstance from '@/services/core/axios-instance';

export type CatalogueCategory = 'QM Codes' | 'Production & Traceability' | 'Organization & Personnel';

export type CatalogueKey =
    | 'defect'
    | 'task'
    | 'characteristic'
    | 'batch'
    | 'material'
    | 'workCenter'
    | 'plant'
    | 'department'
    | 'coordinator';

interface CatalogueMeta {
    label: string;
    category: CatalogueCategory;
    catalogType: string;
    caption: string;
    codeId: ValueHelpId;
    groupId?: ValueHelpId;
    usagePath?: string;
    usageColumn?: string;
    usageLabel?: string;
}

const CATALOGUES: Record<CatalogueKey, CatalogueMeta> = {
    defect: {
        label: 'Defect Codes',
        category: 'QM Codes',
        catalogType: 'Catalog type 9 — defects (FECOD)',
        caption:
            'The coded vocabulary for what went wrong. Recording a defect requires one of these — '
            + 'an off-catalogue code scores zero on precedent retrieval without ever showing an error.',
        codeId: VALUE_HELP_IDS.defectCode,
        groupId: VALUE_HELP_IDS.defectCodeGroup,
        usagePath: 'HistoricalCases',
        usageColumn: 'defectCode',
        usageLabel: 'Closed cases with this code',
    },
    task: {
        label: 'Task Codes',
        category: 'QM Codes',
        catalogType: 'Catalog type 2 — quality tasks (QM-TASK)',
        caption:
            'The coded vocabulary behind every D3 / D5 / D7 action. A task keeps its own sentence; '
            + 'the code is what makes "what did we do last time this happened" a count instead of a read.',
        codeId: VALUE_HELP_IDS.taskCode,
        groupId: VALUE_HELP_IDS.taskCodeGroup,
        usagePath: 'HistoricalActions',
        usageColumn: 'taskCode',
        usageLabel: 'Used in closed cases',
    },
    characteristic: {
        label: 'Inspection Characteristics',
        category: 'Production & Traceability',
        catalogType: 'Master Inspection Characteristics (QPMK)',
        caption:
            'Engineering measurement characteristics and specification limits for D2 evidence and inspection plans.',
        codeId: VALUE_HELP_IDS.characteristic,
        usagePath: 'DefectCharacteristics',
        usageColumn: 'characteristic',
        usageLabel: 'Measurements recorded',
    },
    batch: {
        label: 'Batches',
        category: 'Production & Traceability',
        catalogType: 'Batch Management (MCHA / MCH1)',
        caption:
            'Material batches (lots) for product traceability and quarantine control. '
            + 'Cascading child of Material ID in the Record Defect form.',
        codeId: VALUE_HELP_IDS.batch,
        usagePath: 'HistoricalCases',
        usageColumn: 'batchId',
        usageLabel: 'Cases with this batch',
    },
    material: {
        label: 'Materials',
        category: 'Production & Traceability',
        catalogType: 'Material Master (MARA / MARC)',
        caption:
            'Finished goods and components seen on closed 8D cases. '
            + 'Selecting one in the defect form auto-fills description and material family.',
        codeId: VALUE_HELP_IDS.material,
        usagePath: 'HistoricalCases',
        usageColumn: 'materialId',
        usageLabel: 'Cases with this material',
    },
    workCenter: {
        label: 'Work Centers',
        category: 'Production & Traceability',
        catalogType: 'Work Centers (CRHD / ARBPL)',
        caption:
            'Shop floor machines and assembly workstations where defects are detected.',
        codeId: VALUE_HELP_IDS.workCenter,
        usagePath: 'HistoricalCases',
        usageColumn: 'workCenterId',
        usageLabel: 'Cases on this work center',
    },
    plant: {
        label: 'Plants',
        category: 'Production & Traceability',
        catalogType: 'Organizational Units (WERKS)',
        caption:
            'Manufacturing plants and operating sites where quality notifications and inspection lots originate.',
        codeId: VALUE_HELP_IDS.plant,
    },
    department: {
        label: 'Departments',
        category: 'Organization & Personnel',
        catalogType: 'Responsible Departments (QMEL-ABTEI)',
        caption:
            'Standard operating departments responsible for investigating, coordinating, or resolving quality notifications.',
        codeId: VALUE_HELP_IDS.department,
        usagePath: 'Defects',
        usageColumn: 'department',
        usageLabel: 'Logged defects in this dept',
    },
    coordinator: {
        label: 'Coordinators',
        category: 'Organization & Personnel',
        catalogType: 'Notification Coordinators (QMEL-PARNR)',
        caption:
            'Quality engineers and coordinators authorized to lead problem-solving processes and notifications.',
        codeId: VALUE_HELP_IDS.coordinator,
        usagePath: 'Defects',
        usageColumn: 'coordinator',
        usageLabel: 'Defects coordinated',
    },
};

const ALL_GROUPS = '__ALL__';

/**
 * Đếm số lần mục mã được sử dụng trong các bảng giao dịch.
 */
function useCodeUsage(path?: string, column?: string) {
    return useQuery({
        queryKey: ['master-data', 'code-usage', path, column],
        queryFn: async () => {
            if (!path || !column) return new Map<string, number>();
            try {
                const res = await axiosInstance.get<{ value: Array<Record<string, unknown>> }>(
                    `api/cnma/EIGHTD_SRV/${path}?$select=${column}&$top=5000`,
                );
                const counts = new Map<string, number>();
                for (const row of res.data?.value ?? []) {
                    const code = String(row?.[column] ?? '').trim().toUpperCase();
                    if (!code) continue;
                    counts.set(code, (counts.get(code) ?? 0) + 1);
                }
                return counts;
            } catch {
                return new Map<string, number>();
            }
        },
        enabled: Boolean(path && column),
        staleTime: 5 * 60 * 1000,
    });
}

export function CodeCataloguesTab() {
    const [catalogue, setCatalogue] = useState<CatalogueKey>('batch');
    const [search, setSearch] = useState('');
    const [group, setGroup] = useState<string>(ALL_GROUPS);

    const active = CATALOGUES[catalogue];
    const codesVh = useValueHelp(active.codeId);
    const groupsVh = useValueHelp(active.groupId ?? VALUE_HELP_IDS.defectCodeGroup, {
        enabled: Boolean(active.groupId),
    });

    const usage = useCodeUsage(active.usagePath, active.usageColumn);

    const groupText = useMemo(() => {
        const map = new Map<string, string>();
        if (!active.groupId) return map;
        for (const entry of groupsVh.entries) {
            map.set(String(entry.key), String(entry.text ?? ''));
        }
        return map;
    }, [groupsVh.entries, active.groupId]);

    const rows = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return codesVh.entries
            .filter((entry: ValueHelpEntry) => {
                const codeGroup = String(entry.codeGroup ?? '');
                if (group !== ALL_GROUPS && codeGroup && codeGroup !== group) return false;
                if (!needle) return true;
                const searchString = [
                    entry.key,
                    entry.text,
                    entry.codeGroup,
                    entry.materialId,
                    entry.materialDesc,
                    entry.plant,
                    entry.department,
                    entry.functionTitle,
                    entry.email,
                    entry.lead,
                    entry.status,
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                return searchString.includes(needle);
            })
            .sort((a, b) => String(a.key).localeCompare(String(b.key)));
    }, [codesVh.entries, search, group]);

    const usedCount = (code: string): number =>
        usage.data?.get(String(code).trim().toUpperCase()) ?? 0;

    return (
        <div className="space-y-4">
            {/* Phân nhóm chọn danh mục */}
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/80 w-fit">
                    {(Object.keys(CATALOGUES) as CatalogueKey[]).map((key) => {
                        const item = CATALOGUES[key];
                        const isSelected = catalogue === key;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => {
                                    setCatalogue(key);
                                    setGroup(ALL_GROUPS);
                                }}
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all cursor-pointer',
                                    isSelected
                                        ? 'bg-background text-foreground shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <span>{item.label}</span>
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        'text-xs px-1.5 py-0 h-4 border-border/60 font-semibold',
                                        item.category === 'QM Codes' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
                                        item.category === 'Production & Traceability' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                                        item.category === 'Organization & Personnel' && 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
                                    )}
                                >
                                    {item.category === 'QM Codes' ? 'QM' : item.category === 'Production & Traceability' ? 'Prod' : 'Org'}
                                </Badge>
                            </button>
                        );
                    })}
                </div>

                {/* Thanh tìm kiếm & lọc nhóm mã (nếu có) */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-1 max-w-xl">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={`Search ${active.label.toLowerCase()}...`}
                                className="pl-8 text-sm h-9 bg-background"
                            />
                        </div>
                        {active.groupId && (
                            <Select value={group} onValueChange={setGroup}>
                                <SelectTrigger className="w-52 text-sm h-9">
                                    <SelectValue placeholder="Code group" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL_GROUPS}>All code groups</SelectItem>
                                    {groupsVh.entries.map((entry) => (
                                        <SelectItem key={String(entry.key)} value={String(entry.key)}>
                                            {String(entry.key)} — {String(entry.text ?? '')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    <div className="text-sm text-muted-foreground font-medium">
                        Total entries: <span className="font-mono text-foreground font-bold">{rows.length}</span>
                    </div>
                </div>
            </div>

            <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
                {active.caption}
            </p>

            <Card className="overflow-hidden border border-border/80 shadow-xs">
                {codesVh.loading ? (
                    <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
                        <Spinner className="w-4 h-4" /> Loading the catalogue…
                    </div>
                ) : rows.length === 0 ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                        <Tags className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                        {codesVh.entries.length === 0
                            ? 'The catalogue could not be loaded or is empty.'
                            : 'No entries match these filters.'}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-border/80 bg-muted/50 font-semibold text-muted-foreground">
                                    {catalogue === 'characteristic' ? (
                                        <>
                                            <th className="py-3 px-4 w-32">MIC Code</th>
                                            <th className="py-3 px-4 min-w-[200px]">Characteristic Name</th>
                                            <th className="py-3 px-4 min-w-[200px]">Applicable Material</th>
                                            <th className="py-3 px-4 w-28 text-right">Lower Limit</th>
                                            <th className="py-3 px-4 w-28 text-right">Upper Limit</th>
                                            <th className="py-3 px-4 w-20">UoM</th>
                                            <th className="py-3 px-4 min-w-[180px]">Standard Equipment</th>
                                            <th className="py-3 px-4 w-28">Type</th>
                                        </>
                                    ) : catalogue === 'batch' ? (
                                        <>
                                            <th className="py-3 px-4 w-32">Batch ID</th>
                                            <th className="py-3 px-4 min-w-[200px]">Description</th>
                                            <th className="py-3 px-4 min-w-[220px]">Material Master</th>
                                            <th className="py-3 px-4 w-20">Plant</th>
                                            <th className="py-3 px-4 w-28">Status</th>
                                            <th className="py-3 px-4 w-28">Batch Date</th>
                                            <th className="py-3 px-4 w-36 text-right">{active.usageLabel}</th>
                                        </>
                                    ) : catalogue === 'coordinator' ? (
                                        <>
                                            <th className="py-3 px-4 w-32">Partner ID</th>
                                            <th className="py-3 px-4 min-w-[180px]">Partner Name</th>
                                            <th className="py-3 px-4 min-w-[180px]">Department</th>
                                            <th className="py-3 px-4 min-w-[180px]">Function / Role</th>
                                            <th className="py-3 px-4 min-w-[200px]">Contact Info</th>
                                            <th className="py-3 px-4 w-36 text-right">{active.usageLabel}</th>
                                        </>
                                    ) : catalogue === 'department' ? (
                                        <>
                                            <th className="py-3 px-4 w-28">Dept Code</th>
                                            <th className="py-3 px-4 min-w-[220px]">Department Name</th>
                                            <th className="py-3 px-4 w-24">Plant</th>
                                            <th className="py-3 px-4 min-w-[180px]">Lead Coordinator</th>
                                            <th className="py-3 px-4 w-36 text-right">{active.usageLabel}</th>
                                        </>
                                    ) : catalogue === 'material' ? (
                                        <>
                                            <th className="py-3 px-4 w-36">Material ID</th>
                                            <th className="py-3 px-4 min-w-[260px]">Description</th>
                                            <th className="py-3 px-4 w-44">Material Family</th>
                                            <th className="py-3 px-4 w-36 text-right">{active.usageLabel}</th>
                                        </>
                                    ) : catalogue === 'workCenter' ? (
                                        <>
                                            <th className="py-3 px-4 w-36">Work Center ID</th>
                                            <th className="py-3 px-4 min-w-[280px]">Description</th>
                                            <th className="py-3 px-4 w-36 text-right">{active.usageLabel}</th>
                                        </>
                                    ) : catalogue === 'plant' ? (
                                        <>
                                            <th className="py-3 px-4 w-28">Plant Code</th>
                                            <th className="py-3 px-4 min-w-[280px]">Description / Name</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="py-3 px-4 w-32">Code</th>
                                            <th className="py-3 px-4 min-w-[280px]">Description</th>
                                            <th className="py-3 px-4 w-64">Code Group</th>
                                            {catalogue === 'defect' && <th className="py-3 px-4 w-24">Class</th>}
                                            <th className="py-3 px-4 w-44 text-right">{active.usageLabel}</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {rows.map((entry) => {
                                    const code = String(entry.key);
                                    const used = usedCount(code);

                                    if (catalogue === 'characteristic') {
                                        return (
                                            <tr key={code} className="hover:bg-muted/30 transition-colors">
                                                <td className="py-3 px-4 font-mono font-bold text-foreground">{code}</td>
                                                <td className="py-3 px-4 font-medium text-foreground">{String(entry.text ?? '')}</td>
                                                <td className="py-3 px-4">
                                                    {entry.materialId ? (
                                                        <div>
                                                            <span className="font-mono font-medium text-foreground">{String(entry.materialId)}</span>
                                                            {Boolean(entry.materialDesc) && (
                                                                <span className="text-sm text-muted-foreground block">{String(entry.materialDesc)}</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground italic">General (All Materials)</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 font-mono text-right text-foreground">{String(entry.specLowerLimit ?? '—')}</td>
                                                <td className="py-3 px-4 font-mono text-right text-foreground">{String(entry.specUpperLimit ?? '—')}</td>
                                                <td className="py-3 px-4 font-mono text-muted-foreground">{String(entry.specUom ?? '—')}</td>
                                                <td className="py-3 px-4 font-mono text-sm text-foreground">{String(entry.defaultEquipment ?? '—')}</td>
                                                <td className="py-3 px-4">
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            'text-xs font-semibold px-2 py-0.5',
                                                            entry.charType === 'Qualitative'
                                                                ? 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                                                : 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
                                                        )}
                                                    >
                                                        {String(entry.charType ?? 'Quantitative')}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        );
                                    }

                                    if (catalogue === 'batch') {
                                        return (
                                            <tr key={code} className="hover:bg-muted/30 transition-colors">
                                                <td className="py-3 px-4 font-mono font-bold text-foreground">{code}</td>
                                                <td className="py-3 px-4 text-foreground">{String(entry.text ?? '')}</td>
                                                <td className="py-3 px-4">
                                                    {entry.materialId ? (
                                                        <div>
                                                            <span className="font-mono font-medium text-foreground">{String(entry.materialId)}</span>
                                                            {Boolean(entry.materialDesc) && (
                                                                <span className="text-sm text-muted-foreground block">{String(entry.materialDesc)}</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 font-mono text-muted-foreground">{String(entry.plant ?? '1000')}</td>
                                                <td className="py-3 px-4">
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            'text-xs font-semibold px-2 py-0.5',
                                                            entry.status === 'Quarantined'
                                                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                                                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                                                        )}
                                                    >
                                                        {String(entry.status ?? 'Unrestricted')}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4 font-mono text-muted-foreground">{String(entry.batchDate ?? '—')}</td>
                                                <td className="py-3 px-4 text-right">
                                                    {usage.isLoading ? (
                                                        <span className="text-muted-foreground">…</span>
                                                    ) : used > 0 ? (
                                                        <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 tabular-nums border-primary/30 bg-primary/5 text-primary">
                                                            {used}
                                                        </Badge>
                                                    ) : (
                                                        <span className="tabular-nums text-muted-foreground">0</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    }

                                    if (catalogue === 'coordinator') {
                                        return (
                                            <tr key={code} className="hover:bg-muted/30 transition-colors">
                                                <td className="py-3 px-4 font-mono font-bold text-foreground">{code}</td>
                                                <td className="py-3 px-4 font-semibold text-foreground">{String(entry.text ?? '')}</td>
                                                <td className="py-3 px-4 text-foreground">{String(entry.department ?? '—')}</td>
                                                <td className="py-3 px-4 text-muted-foreground">{String(entry.functionTitle ?? '—')}</td>
                                                <td className="py-3 px-4 text-sm">
                                                    <div className="text-foreground">{String(entry.email ?? '—')}</div>
                                                    <div className="text-muted-foreground font-mono">{String(entry.phone ?? '')}</div>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    {usage.isLoading ? (
                                                        <span className="text-muted-foreground">…</span>
                                                    ) : used > 0 ? (
                                                        <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 tabular-nums border-primary/30 bg-primary/5 text-primary">
                                                            {used}
                                                        </Badge>
                                                    ) : (
                                                        <span className="tabular-nums text-muted-foreground">0</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    }

                                    if (catalogue === 'department') {
                                        return (
                                            <tr key={code} className="hover:bg-muted/30 transition-colors">
                                                <td className="py-3 px-4 font-mono font-bold text-foreground">{code}</td>
                                                <td className="py-3 px-4 font-semibold text-foreground">{String(entry.text ?? '')}</td>
                                                <td className="py-3 px-4 font-mono text-muted-foreground">{String(entry.plant ?? '1000')}</td>
                                                <td className="py-3 px-4 text-foreground">{String(entry.lead ?? '—')}</td>
                                                <td className="py-3 px-4 text-right">
                                                    {usage.isLoading ? (
                                                        <span className="text-muted-foreground">…</span>
                                                    ) : used > 0 ? (
                                                        <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 tabular-nums border-primary/30 bg-primary/5 text-primary">
                                                            {used}
                                                        </Badge>
                                                    ) : (
                                                        <span className="tabular-nums text-muted-foreground">0</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    }

                                    if (catalogue === 'material') {
                                        return (
                                            <tr key={code} className="hover:bg-muted/30 transition-colors">
                                                <td className="py-3 px-4 font-mono font-bold text-foreground">{code}</td>
                                                <td className="py-3 px-4 text-foreground">{String(entry.text ?? entry.materialDesc ?? '')}</td>
                                                <td className="py-3 px-4 font-mono text-muted-foreground">{String(entry.materialFamily ?? entry.materialGroup ?? '—')}</td>
                                                <td className="py-3 px-4 text-right">
                                                    {usage.isLoading ? (
                                                        <span className="text-muted-foreground">…</span>
                                                    ) : used > 0 ? (
                                                        <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 tabular-nums border-primary/30 bg-primary/5 text-primary">
                                                            {used}
                                                        </Badge>
                                                    ) : (
                                                        <span className="tabular-nums text-muted-foreground">0</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    }

                                    if (catalogue === 'workCenter') {
                                        return (
                                            <tr key={code} className="hover:bg-muted/30 transition-colors">
                                                <td className="py-3 px-4 font-mono font-bold text-foreground">{code}</td>
                                                <td className="py-3 px-4 text-foreground">{String(entry.text ?? entry.workCenterDesc ?? '')}</td>
                                                <td className="py-3 px-4 text-right">
                                                    {usage.isLoading ? (
                                                        <span className="text-muted-foreground">…</span>
                                                    ) : used > 0 ? (
                                                        <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 tabular-nums border-primary/30 bg-primary/5 text-primary">
                                                            {used}
                                                        </Badge>
                                                    ) : (
                                                        <span className="tabular-nums text-muted-foreground">0</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    }

                                    if (catalogue === 'plant') {
                                        return (
                                            <tr key={code} className="hover:bg-muted/30 transition-colors">
                                                <td className="py-3 px-4 font-mono font-bold text-foreground">{code}</td>
                                                <td className="py-3 px-4 text-foreground">{String(entry.text ?? '')}</td>
                                            </tr>
                                        );
                                    }

                                    // Default: defect and task
                                    const codeGroup = String(entry.codeGroup ?? '');
                                    return (
                                        <tr key={code} className="hover:bg-muted/30 transition-colors">
                                            <td className="py-3 px-4 font-mono font-bold text-foreground">{code}</td>
                                            <td className="py-3 px-4 text-foreground">{String(entry.text ?? '')}</td>
                                            <td className="py-3 px-4">
                                                {codeGroup ? (
                                                    <>
                                                        <div className="font-mono text-foreground">{codeGroup}</div>
                                                        {groupText.get(codeGroup) && (
                                                            <div className="text-sm text-muted-foreground">
                                                                {groupText.get(codeGroup)}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            {catalogue === 'defect' && (
                                                <td className="py-3 px-4 text-muted-foreground">
                                                    {String(entry.defectClass ?? '—')}
                                                </td>
                                            )}
                                            <td className="py-3 px-4 text-right">
                                                {usage.isLoading ? (
                                                    <span className="text-muted-foreground">…</span>
                                                ) : used > 0 ? (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-xs font-semibold px-2 py-0.5 tabular-nums border-primary/30 bg-primary/5 text-primary"
                                                    >
                                                        {used}
                                                    </Badge>
                                                ) : (
                                                    <span className="tabular-nums text-muted-foreground">0</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <p className="flex items-start gap-1.5 text-sm leading-relaxed text-muted-foreground max-w-3xl">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                    {active.catalogType}. Read-only: These catalogues are master data maintained according to ERP/QM
                    standards. When connected to enterprise ERP, they are synchronized automatically.
                </span>
            </p>
        </div>
    );
}

export default CodeCataloguesTab;
