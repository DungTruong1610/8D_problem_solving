import { useState, type ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Code2, Eye, ShieldCheck, Sliders, Sparkles, Terminal, type LucideIcon } from 'lucide-react';
import { Button, Tabs, TabsContent, TabsList, TabsTrigger, cn } from '@cnma/react-ui';
import { GUIDE_TABS, resolveGuideTab, type GuideTabId } from './guide-data';
import { GuideTour } from './guide-tour';
import { OverviewTab } from './sections/overview-tab';
import { AiConfigTab } from './sections/ai-config-tab';
import { TestCaseTab } from './sections/test-case-tab';
import { EvaluationTab } from './sections/evaluation-tab';
import { CliTab } from './sections/cli-tab';

const TAB_ICONS: Record<GuideTabId, LucideIcon> = {
    'overview': Eye,
    'ai-config': Sliders,
    'test-case': Code2,
    'evaluation': ShieldCheck,
    'cli': Terminal,
};

const TAB_PANELS: Record<GuideTabId, ComponentType> = {
    'overview': OverviewTab,
    'ai-config': AiConfigTab,
    'test-case': TestCaseTab,
    'evaluation': EvaluationTab,
    'cli': CliTab,
};

/**
 * One tab = one section. The previous layout stacked all five sections and
 * scrolled to an anchor, which landed in the wrong place whenever content above
 * changed height (e.g. after a verify run). The active tab lives in `?tab=` so it
 * survives reloads and can be linked to.
 */
export function GuidePage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = resolveGuideTab(searchParams);
    const [isTourOpen, setIsTourOpen] = useState(false);

    const selectTab = (tab: string) => {
        setSearchParams({ tab }, { replace: true });
        document.getElementById('main-scroll-container')?.scrollTo({ top: 0 });
    };

    return (
        <div className="w-full min-w-0 p-6 md:p-8">
            <div className="mx-auto max-w-6xl space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                            <BookOpen className="size-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-foreground">User &amp; Judge Guide</h1>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                                How to use 8D Copilot, configure the AI and verify the test cases.
                            </p>
                        </div>
                    </div>
                    <Button type="button" className="gap-2 self-start md:self-auto" onClick={() => setIsTourOpen(true)}>
                        <Sparkles className="size-4" />
                        Take the tour
                    </Button>
                </div>

                <Tabs value={activeTab} onValueChange={selectTab} className="w-full gap-0">
                    {/* Sticky so the tab bar stays reachable inside long tabs */}
                    {/* The border lives on this wrapper and the list is pulled 1px over it, so
                        the active underline covers the line without making the list overflow. */}
                    <div className="sticky top-0 z-10 border-b bg-background/95 pt-1 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                        <TabsList className="-mb-px flex h-auto w-full justify-start gap-1 overflow-x-auto overflow-y-hidden rounded-none bg-transparent p-0 [scrollbar-width:none] md:grid md:grid-cols-5">
                            {GUIDE_TABS.map((tab, i) => {
                                const Icon = TAB_ICONS[tab.id];
                                const isActive = activeTab === tab.id;
                                return (
                                    <TabsTrigger
                                        key={tab.id}
                                        value={tab.id}
                                        className={cn(
                                            'inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-none border-0 border-b-2 border-transparent bg-transparent px-4 text-sm font-medium shadow-none transition-colors',
                                            'text-muted-foreground hover:text-foreground focus-visible:ring-0 focus-visible:outline-none',
                                            'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none',
                                            isActive && '!border-primary !text-foreground',
                                        )}
                                    >
                                        <Icon className={cn('size-4', isActive ? 'text-primary' : '')} />
                                        <span className="whitespace-nowrap">
                                            <span className="mr-1 text-muted-foreground">{i + 1}.</span>
                                            {tab.label}
                                        </span>
                                    </TabsTrigger>
                                );
                            })}
                        </TabsList>
                    </div>

                    {GUIDE_TABS.map((tab) => {
                        const Panel = TAB_PANELS[tab.id];
                        return (
                            // forceMount keeps each tab's state (validator input, verify
                            // results, sandbox text) when the user switches away and back.
                            <TabsContent
                                key={tab.id}
                                value={tab.id}
                                forceMount
                                className="mt-6 outline-none data-[state=inactive]:hidden"
                            >
                                <Panel />
                            </TabsContent>
                        );
                    })}
                </Tabs>
            </div>

            <GuideTour open={isTourOpen} onOpenChange={setIsTourOpen} />
        </div>
    );
}
