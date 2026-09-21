import { useState } from 'react';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    cn,
} from '@cnma/react-ui';
import { ClipboardList, Database, FolderKanban, Layers, Tags } from 'lucide-react';
import { CodeCataloguesTab } from './CodeCataloguesTab';
import { DefectsTab } from './DefectsTab';
import { HistoricalDefectsTab } from './HistoricalDefectsTab';
import { InspectionLotsTab } from './InspectionLotsTab';

/**
 * Mỗi tab nói rõ nó LÀ CÁI GÌ, ngay dưới thanh tab.
 *
 * Hai tên cũ đều tuyên bố sai. "QM Inspection Lots" hứa hẹn đối tượng lô kiểm tra
 * của SAP — một header với N kết quả; bảng đằng sau nó là một lô một đặc tính, và
 * việc thật của nó là làm tập so sánh cho Is/Is-Not. "Historical Defects" nghe như
 * chỗ ghi nhận lỗi; nó là kho tiền lệ, chỉ chứa case đã đóng.
 */
const TAB_CAPTIONS = {
    'inspection-lots': 'Inspection History — the comparison population behind D2\'s Is / Is-Not analysis. One row is one characteristic measured on one lot, not the full inspection lot object.',
    'defects': 'Defect Records — every quality defect recorded, whether or not it warrants an 8D. Most defects are closed here; opening an 8D is a separate, deliberate decision made on this list.',
    'historical-cases': 'Closed Case Library — the precedent store the AI retrieves from. Completed and closed cases only; an open case has no proven lesson to reuse.',
    'code-catalogues': 'Master Data & Catalogues — centralized reference catalogs and value helps: defect codes, quality tasks, material batches, departments, coordinators, plants, and master data.',
} as const;

type MasterDataTab = keyof typeof TAB_CAPTIONS;

export function MasterDataPage() {
    // Lô kiểm tra đứng trước: chuỗi là ② lô → ③ kết quả → ④ lỗi, và thứ tự tab nên
    // dạy chuỗi đó chứ không mâu thuẫn với nó. Tab "Defects" đã chen vào giữa ở
    // Phase 2 — nó là mắt xích ④, đứng sau kết quả kiểm tra và trước case đã đóng.
    const [activeTab, setActiveTab] = useState<MasterDataTab>('inspection-lots');

    return (
        <div className="p-6 md:p-8 w-full min-w-0 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                        <Database className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Master Data Management</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Maintain the inspection history behind Is/Is-Not comparison, the defect records an 8D can be opened from, and the closed case library the AI retrieves precedents from
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as MasterDataTab)}
                className="w-full space-y-4"
            >
                <TabsList className="grid w-full grid-cols-4 max-w-3xl bg-muted/60 p-1 rounded-xl border border-border/80 h-11 shadow-xs">
                    <TabsTrigger
                        value="inspection-lots"
                        className={cn(
                            'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all h-9 cursor-pointer border-0 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0',
                            'hover:text-foreground text-muted-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
                            'data-[state=active]:bg-black/[0.05] dark:data-[state=active]:bg-white/[0.08] data-[state=active]:!shadow-none data-[state=active]:!text-black dark:data-[state=active]:!text-white data-[state=active]:border-transparent',
                            activeTab === 'inspection-lots' && '!text-black dark:!text-white !bg-black/[0.05] dark:!bg-white/[0.08] !shadow-none',
                        )}
                    >
                        <Layers className={cn('h-4 w-4 transition-colors', activeTab === 'inspection-lots' ? 'text-black dark:text-white' : 'text-muted-foreground')} />
                        <span>Inspection History</span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="defects"
                        className={cn(
                            'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all h-9 cursor-pointer border-0 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0',
                            'hover:text-foreground text-muted-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
                            'data-[state=active]:bg-black/[0.05] dark:data-[state=active]:bg-white/[0.08] data-[state=active]:!shadow-none data-[state=active]:!text-black dark:data-[state=active]:!text-white data-[state=active]:border-transparent',
                            activeTab === 'defects' && '!text-black dark:!text-white !bg-black/[0.05] dark:!bg-white/[0.08] !shadow-none',
                        )}
                    >
                        <ClipboardList className={cn('h-4 w-4 transition-colors', activeTab === 'defects' ? 'text-black dark:text-white' : 'text-muted-foreground')} />
                        <span>Defect Records</span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="historical-cases"
                        className={cn(
                            'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all h-9 cursor-pointer border-0 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0',
                            'hover:text-foreground text-muted-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
                            'data-[state=active]:bg-black/[0.05] dark:data-[state=active]:bg-white/[0.08] data-[state=active]:!shadow-none data-[state=active]:!text-black dark:data-[state=active]:!text-white data-[state=active]:border-transparent',
                            activeTab === 'historical-cases' && '!text-black dark:!text-white !bg-black/[0.05] dark:!bg-white/[0.08] !shadow-none',
                        )}
                    >
                        <FolderKanban className={cn('h-4 w-4 transition-colors', activeTab === 'historical-cases' ? 'text-black dark:text-white' : 'text-muted-foreground')} />
                        <span>Closed Case Library</span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="code-catalogues"
                        className={cn(
                            'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all h-9 cursor-pointer border-0 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0',
                            'hover:text-foreground text-muted-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
                            'data-[state=active]:bg-black/[0.05] dark:data-[state=active]:bg-white/[0.08] data-[state=active]:!shadow-none data-[state=active]:!text-black dark:data-[state=active]:!text-white data-[state=active]:border-transparent',
                            activeTab === 'code-catalogues' && '!text-black dark:!text-white !bg-black/[0.05] dark:!bg-white/[0.08] !shadow-none',
                        )}
                    >
                        <Tags className={cn('h-4 w-4 transition-colors', activeTab === 'code-catalogues' ? 'text-black dark:text-white' : 'text-muted-foreground')} />
                        <span>Value Help</span>
                    </TabsTrigger>
                </TabsList>

                <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
                    {TAB_CAPTIONS[activeTab]}
                </p>

                {/* Tab 1: Inspection History — Is/Is-Not population */}
                <TabsContent value="inspection-lots" className="mt-0 outline-none space-y-4">
                    <InspectionLotsTab />
                </TabsContent>

                {/* Tab 2: Defect Records — mắt xích ④, nơi 8D được mở ra một cách có chủ ý */}
                <TabsContent value="defects" className="mt-0 outline-none space-y-4">
                    <DefectsTab />
                </TabsContent>

                {/* Tab 3: Closed Case Library — precedent store */}
                <TabsContent value="historical-cases" className="mt-0 outline-none space-y-4">
                    <HistoricalDefectsTab />
                </TabsContent>

                {/* Tab 4: Code Catalogues — hai danh mục mã QM đứng cạnh nhau */}
                <TabsContent value="code-catalogues" className="mt-0 outline-none space-y-4">
                    <CodeCataloguesTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default MasterDataPage;
