import { Button, cn } from '@cnma/react-ui';

export type StepEditorTab = 'schema' | 'prompt' | 'form' | 'constraints';

const TABS: Array<{ id: StepEditorTab; label: string }> = [
    // First, because it runs first: this tab decides which past cases the step
    // is shown. The rest decide how it writes about them.
    { id: 'schema', label: 'Object Schema' },
    { id: 'prompt', label: 'Prompt guide' },
    { id: 'form', label: 'Form editor' },
    { id: 'constraints', label: 'Constraints' },
];

interface StepEditorTabNavigationProps {
    activeTab: StepEditorTab;
    onTabChange: (tab: StepEditorTab) => void;
    /**
     * Tab được phép hiện. Bỏ trống ⇒ tất cả.
     *
     * D5–D8 have no structured prompt editor yet, but they still retrieve
     * precedents — so they open on that one tab instead of being locked out.
     */
    availableTabs?: readonly StepEditorTab[];
}

export function StepEditorTabNavigation({
    activeTab, onTabChange, availableTabs,
}: StepEditorTabNavigationProps) {
    const visible = availableTabs ? TABS.filter((tab) => availableTabs.includes(tab.id)) : TABS;

    return <div className="shrink-0 border-b bg-primary-foreground px-2 py-1.5">
        <div className="flex items-center gap-0 overflow-x-auto">
            {visible.map((tab) => <Button
                key={tab.id}
                type="button"
                variant="ghost"
                onClick={() => onTabChange(tab.id)}
                className={cn(
                    'relative whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60',
                    activeTab === tab.id && 'text-primary',
                )}
                role="tab"
                aria-selected={activeTab === tab.id}
            >
                {tab.label}
                {activeTab === tab.id && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary" />}
            </Button>)}
        </div>
    </div>;
}
