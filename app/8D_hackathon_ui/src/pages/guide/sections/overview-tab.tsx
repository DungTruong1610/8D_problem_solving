import { useNavigate } from 'react-router-dom';
import { ArrowRight, ClipboardList, Database, FileSearch, Workflow, type LucideIcon } from 'lucide-react';
import { Button } from '@cnma/react-ui';
import { PAGE_CARDS } from '../guide-data';
import { GuideCard, IconTile, TabIntro } from '../guide-ui';

const ICONS: Record<typeof PAGE_CARDS[number]['key'], LucideIcon> = {
    '8d-list': ClipboardList,
    '8d-detail': FileSearch,
    'master-data': Database,
    'workflow': Workflow,
};

export function OverviewTab() {
    const navigate = useNavigate();

    return (
        <div className="space-y-5">
            <TabIntro
                title="Pages at a glance"
                description="What each page is for and the three things you do there."
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {PAGE_CARDS.map((page) => {
                    const Icon = ICONS[page.key];
                    return (
                        <GuideCard key={page.key} className="flex flex-col gap-4">
                            <div className="flex items-start gap-3">
                                <IconTile><Icon className="size-[18px]" /></IconTile>
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-sm font-semibold text-foreground">{page.title}</h3>
                                    <p className="mt-0.5 text-sm text-muted-foreground">{page.summary}</p>
                                </div>
                            </div>

                            <ol className="space-y-2 text-sm text-muted-foreground">
                                {page.steps.map((step, i) => (
                                    <li key={step} className="flex items-start gap-2.5">
                                        <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
                                            {i + 1}
                                        </span>
                                        <span>{step}</span>
                                    </li>
                                ))}
                            </ol>

                            <div className="mt-auto flex items-center justify-between border-t pt-3">
                                <code className="text-xs text-muted-foreground">#{page.route}</code>
                                <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate(page.route)}>
                                    Open
                                    <ArrowRight className="size-3.5" />
                                </Button>
                            </div>
                        </GuideCard>
                    );
                })}
            </div>
        </div>
    );
}
