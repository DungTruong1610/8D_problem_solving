import { useNavigate } from 'react-router-dom';
import { ArrowRight, Cpu, Layers, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { Button } from '@cnma/react-ui';
import { AI_CONFIG_CARDS } from '../guide-data';
import { GuideCard, IconTile, TabIntro } from '../guide-ui';

const ICONS: Record<typeof AI_CONFIG_CARDS[number]['key'], LucideIcon> = {
    model: Cpu,
    prompts: SlidersHorizontal,
    retrieval: Layers,
};

export function AiConfigTab() {
    const navigate = useNavigate();

    return (
        <div className="space-y-5">
            <TabIntro
                title="AI configuration"
                description="Everything below is changed on the AI Configuration page — no code or redeploy needed."
                action={
                    <Button type="button" size="sm" className="gap-1.5" onClick={() => navigate('/workflow')}>
                        Open AI Configuration
                        <ArrowRight className="size-3.5" />
                    </Button>
                }
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {AI_CONFIG_CARDS.map((card) => {
                    const Icon = ICONS[card.key];
                    return (
                        <GuideCard key={card.key} className="flex flex-col gap-4">
                            <div className="flex items-start gap-3">
                                <IconTile><Icon className="size-[18px]" /></IconTile>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
                                    <p className="mt-0.5 text-sm text-muted-foreground">{card.summary}</p>
                                </div>
                            </div>

                            <ul className="divide-y rounded-lg border">
                                {card.items.map((item) => (
                                    <li key={item.label} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                                        <span className="truncate font-medium text-foreground">{item.label}</span>
                                        <span className="text-right text-xs text-muted-foreground">{item.note}</span>
                                    </li>
                                ))}
                            </ul>
                        </GuideCard>
                    );
                })}
            </div>
        </div>
    );
}
