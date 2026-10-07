import { CLI_COMMANDS } from '../guide-data';
import { CopyButton, GuideCard, TabIntro } from '../guide-ui';

export function CliTab() {
    return (
        <div className="space-y-5">
            <TabIntro
                title="Command line"
                description="Run these from the repository root."
            />

            <GuideCard className="p-0">
                <ul className="divide-y">
                    {CLI_COMMANDS.map((item) => (
                        <li key={item.id} className="flex flex-col gap-2.5 px-5 py-4 md:flex-row md:items-center md:gap-6">
                            <div className="md:w-60 md:shrink-0">
                                <p className="text-sm font-medium text-foreground">{item.title}</p>
                                <p className="text-xs text-muted-foreground">{item.note}</p>
                            </div>
                            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100">
                                {item.cmd}
                            </code>
                            <div className="shrink-0">
                                <CopyButton text={item.cmd} />
                            </div>
                        </li>
                    ))}
                </ul>
            </GuideCard>
        </div>
    );
}
