import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@cnma/react-ui';
import {
    BookOpen, Boxes, Cpu, FileText, Network, Sliders,
} from 'lucide-react';
import { AiModelManagementPage } from '@cnma/sap-aicore-integrate/react';
import { aiModelApi } from '@/services/ai-model-service';
import { useStepPrompts } from '@/hooks/use-step-prompts';
import { GeneralSettingsTab } from '../ai-settings/general-settings-tab';
import { DisciplineSection } from './discipline-section';
import { RetrievalEngineSection } from './retrieval-engine-section';
import { GraphStepParamsSection } from './graph-step-params-section';

const DISCIPLINES = [
    { code: 'D1', title: 'Establish Team', engine: 'Rules + Precedents' },
    { code: 'D2', title: 'Describe Problem', engine: 'AI + Facts' },
    { code: 'D3', title: 'Containment Actions', engine: 'AI + Precedents' },
    { code: 'D4', title: 'Root Cause Analysis', engine: 'AI + Blind Verification' },
    { code: 'D5', title: 'Corrective Actions', engine: 'AI + D4 Alignment' },
    { code: 'D6', title: 'Validate Actions', engine: 'Rules + Plan Generation' },
    { code: 'D7', title: 'Preventive Actions', engine: 'AI + FMEA Link' },
    { code: 'D8', title: 'Team Recognition', engine: 'AI + Summary' },
];

export function WorkflowPage() {
    const prompts = useStepPrompts();

    const [activeTab, setActiveTab] = useState<'global' | 'graph' | 'disciplines' | 'models'>('global');
    const [selectedDiscipline, setSelectedDiscipline] = useState<string>('D1');

    return (
        <div className="p-6 space-y-6 w-full min-w-0">
            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                        <Sliders className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">AI Configuration</h1>
                        <p className="text-sm text-muted-foreground">
                            Configure global LLM models, precedent retrieval thresholds, and prompts for each 8D Discipline (D1 – D8).
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link to="/guide" className="flex items-center gap-1.5">
                            <BookOpen className="h-4 w-4" />
                            User Guide
                        </Link>
                    </Button>
                </div>
            </div>

            {/*
              * ── Chuỗi nghiệp vụ, nói trước khi nói về cấu hình AI ──
              *
              * Trang này cấu hình NỬA SAU của chuỗi. Nửa đầu — ghi nhận lỗi, rồi
              * quyết định có mở 8D hay không — không có AI nào tham gia, và trước
              * Phase 2 nó cũng không hiện ra ở đâu cả: bấm "Record Defect" là ra
              * thẳng một 8D, nên người đọc trang này tưởng mọi lỗi đều chạy qua
              * những gì bên dưới. Không phải. Phần lớn lỗi dừng ở bước ②.
              */}
            <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2">
                <h2 className="text-base font-semibold tracking-tight">Where AI enters the chain</h2>
                <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
                    {[
                        { n: '1', label: 'Inspection result', hint: 'Recorded in Master Data', ai: false },
                        { n: '2', label: 'Defect recorded', hint: 'Master Data → Defect Records. No AI.', ai: false },
                        { n: '3', label: '8D opened', hint: 'A separate, deliberate decision — one 8D per defect, at most', ai: false },
                        { n: '4', label: 'Precedents retrieved', hint: 'Knowledge Graph / Scoring', ai: true },
                        { n: '5', label: 'D1 – D8 drafted', hint: 'Configured below', ai: true },
                        { n: '6', label: 'Case closed', hint: 'Joins the Closed Case Library', ai: false },
                    ].map((s, i, arr) => (
                        <li key={s.n} className="flex items-center gap-2">
                            <span
                                title={s.hint}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-medium ${
                                    s.ai
                                        ? 'border-primary/30 bg-primary/10 text-primary'
                                        : 'border-border bg-background text-muted-foreground'
                                }`}
                            >
                                <span className="font-mono text-xs opacity-70">{s.n}</span>
                                {s.label}
                            </span>
                            {i < arr.length - 1 && <span className="text-muted-foreground/50">→</span>}
                        </li>
                    ))}
                </ol>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-4xl">
                    <strong className="font-semibold text-foreground">Steps ② and ③ are two separate acts.</strong>{' '}
                    Recording a defect does not open an 8D — most defects are closed without one. An 8D is
                    opened explicitly from <Link to="/master-data" className="underline underline-offset-2">Defect Records</Link>,
                    or from an open defect in the Create 8D Report dialog, and a defect can carry at most one.
                    Only the highlighted steps are configured on this page.
                </p>
            </div>

            {/* ── Top Level Category Switcher (Ordered from High-Level to Detailed) ── */}
            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-muted/60 rounded-xl border">
                {/* Tab 1: Global AI & Retrieval Engine */}
                <Button
                    variant={activeTab === 'global' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('global')}
                    className="h-9 text-sm rounded-lg font-medium"
                >
                    <Cpu className="h-4 w-4 mr-1.5" />
                    Global AI & Retrieval Engine
                </Button>

                {/* Tab 2: Graph Retrieval Weights (D1 - D8) */}
                <Button
                    variant={activeTab === 'graph' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('graph')}
                    className="text-xs rounded-lg font-medium"
                >
                    <Network className="h-3.5 w-3.5 mr-1.5" />
                    Graph Retrieval Weights
                </Button>

                {/* Tab 3: 8D Disciplines Configuration (D1 - D8) */}
                <Button
                    variant={activeTab === 'disciplines' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('disciplines')}
                    className="h-9 text-sm rounded-lg font-medium"
                >
                    <FileText className="h-4 w-4 mr-1.5" />
                    8D Disciplines Configuration (D1 – D8)
                </Button>

                {/* Tab 3: Model Registry */}
                <Button
                    variant={activeTab === 'models' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('models')}
                    className="h-9 text-sm rounded-lg font-medium"
                >
                    <Boxes className="h-4 w-4 mr-1.5" />
                    Model Registry
                </Button>
            </div>

            {/* ─── TAB 1: GLOBAL AI & RETRIEVAL ENGINE ─── */}
            {activeTab === 'global' && (
                <div className="space-y-6">
                    {/* Precedent Retrieval Engine (HANA Graph vs Vector Search) */}
                    <RetrievalEngineSection />

                    <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
                        <div>
                            <h2 className="text-lg font-semibold tracking-tight">Global AI Activity Bindings</h2>
                            <p className="text-sm text-muted-foreground">
                                Configure which AI models handle data parsing, defect analysis, and quality reviews across all 8D steps.
                            </p>
                        </div>

                        <GeneralSettingsTab />
                    </div>
                </div>
            )}

            {/* ─── TAB 2: GRAPH RETRIEVAL WEIGHTS (D1 to D8) ─── */}
            {activeTab === 'graph' && <GraphStepParamsSection />}

            {/* ─── TAB 3: 8D DISCIPLINE CONFIGURATION (D1 to D8) ─── */}
            {activeTab === 'disciplines' && (
                <div className="space-y-6">
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight">8D Discipline Rules & Prompts</h2>
                        <p className="text-sm text-muted-foreground">
                            Select a discipline below to inspect its input schema, prompt guidance, form fields, and safety constraints.
                        </p>
                    </div>

                    {/* Discipline Tabs Bar (D1 -> D8) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                        {DISCIPLINES.map((d) => {
                            const isSelected = selectedDiscipline === d.code;
                            return (
                                <button
                                    key={d.code}
                                    type="button"
                                    onClick={() => setSelectedDiscipline(d.code)}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                                        isSelected
                                            ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/20'
                                            : 'bg-card hover:bg-accent hover:text-accent-foreground border-border'
                                    }`}
                                >
                                    <span className="font-mono text-sm font-bold">{d.code}</span>
                                    <span className="text-xs font-semibold leading-tight line-clamp-1 mt-0.5">{d.title}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Selected Discipline Details Banner */}
                    {selectedDiscipline && (
                        <div className="space-y-4">
                            {/* Discipline Section Inspector & Inline Editor */}
                            <DisciplineSection
                                stepCode={selectedDiscipline}
                                prompt={prompts.byCode[selectedDiscipline] ?? null}
                                onReload={prompts.reload}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* ─── TAB 3: MODEL REGISTRY ─── */}
            {activeTab === 'models' && (
                <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight">AI Core Model Registry</h2>
                        <p className="text-sm text-muted-foreground">
                            Synchronize deployed LLMs from AI Core, manage availability, and set rate limits.
                        </p>
                    </div>

                    <AiModelManagementPage api={aiModelApi} />
                </div>
            )}
        </div>
    );
}
