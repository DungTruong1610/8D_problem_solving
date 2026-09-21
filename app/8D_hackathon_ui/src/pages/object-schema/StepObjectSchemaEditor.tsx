import { useState } from 'react';
import {
    DndContext, DragOverlay, KeyboardSensor, PointerSensor,
    useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
    Badge, Button, Spinner,
} from '@cnma/react-ui';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AlertTriangle, Plus, Save, X } from 'lucide-react';
import { useObjectSchema } from '@/hooks/use-object-schema';
import type { SourceFieldInfo } from '@/services/retrieval-service';
import { SourceFieldsPanel } from './SourceFieldsPanel';
import { ProfileConfigPanel } from './ProfileConfigPanel';
import { StepScorePanel } from './StepScorePanel';
import { newCriterionFrom } from './newCriterion';

/**
 * The Object Schema tab of one 8D step.
 *
 * Same workbench as the standalone page, locked to the profile this step runs:
 *
 *   left    every SAP field, scanned from real case payloads
 *   centre  the fields this step compares, their weights, and its thresholds
 *   right   what the current settings actually do — score a real pair of cases
 *
 * This is the first tab of a step for a reason: the other tabs decide how the
 * step writes, this one decides what it gets to see. A perfect prompt over three
 * wrong precedents still produces a wrong answer.
 */
export function StepObjectSchemaEditor({
    stepCode, stepLabel,
}: { stepCode: string; stepLabel: string }) {
    const state = useObjectSchema(stepCode);
    const { draft, activeProfileKey, availableFields, fieldByPath } = state;
    const [dragging, setDragging] = useState<SourceFieldInfo | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const usedPaths = new Set((draft?.fields ?? []).map((c) => c.sourceField ?? ''));

    const onDragEnd = ({ active, over }: DragEndEvent) => {
        setDragging(null);
        if (!draft) return;

        const criterionKey = active.data.current?.criterionKey as string | undefined;
        if (criterionKey) {
            if (over?.id === 'source-fields') {
                state.setDraft({ fields: draft.fields.filter((c) => c.criterionKey !== criterionKey) });
            }
            return;
        }

        if (over?.id !== 'profile-fields') return;
        const field = active.data.current?.field as SourceFieldInfo | undefined;
        if (!field || usedPaths.has(field.path)) return;

        const taken = new Set(draft.fields.map((c) => c.criterionKey));
        state.setDraft({
            fields: [...draft.fields, newCriterionFrom(field, activeProfileKey, taken)],
        });
    };

    if (state.loading || !draft) {
        return (
            <div className="flex min-h-96 flex-1 items-center justify-center text-sm text-muted-foreground">
                <Spinner className="mr-2.5 h-5 w-5 text-primary" /> Loading similarity schema...
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3">
                    <div className="min-w-0">
                        <h3 className="text-base font-bold text-foreground">
                            Similarity Schema — what {stepCode} compares
                        </h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Profile <span className="font-medium text-foreground">{draft.label}</span> decides
                            which past cases {stepLabel} is shown.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                        {state.blockingError && (
                            <div className="flex max-w-md items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-sm text-destructive">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <span>{state.blockingError}</span>
                            </div>
                        )}
                        {state.dirty && (
                            <>
                                <Badge variant="secondary" className="text-sm font-semibold px-2 py-0.5 text-amber-600 dark:text-amber-400">
                                    Unsaved changes
                                </Badge>
                                <Button variant="ghost" size="sm" disabled={state.saving} onClick={state.discard} className="h-9 text-sm">
                                    <X className="mr-1 h-4 w-4" /> Discard
                                </Button>
                            </>
                        )}
                        <Button
                            size="sm"
                            className="h-9 text-sm gap-1.5 font-semibold"
                            disabled={!state.dirty || state.saving || Boolean(state.blockingError)}
                            onClick={() => void state.save()}
                        >
                            {state.saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                            Save Schema
                        </Button>
                    </div>
                </div>

                <DndContext
                    sensors={sensors}
                    onDragStart={({ active }: DragStartEvent) =>
                        setDragging((active.data.current?.field as SourceFieldInfo) ?? null)}
                    onDragEnd={onDragEnd}
                    onDragCancel={() => setDragging(null)}
                >
                    <div className="flex min-h-0 flex-1">
                        <SourceFieldsPanel
                            fields={availableFields}
                            caseCount={state.catalogCaseCount}
                            usedPaths={usedPaths}
                        />

                        <ProfileConfigPanel
                            draft={draft}
                            profileKey={activeProfileKey}
                            fieldByPath={fieldByPath}
                            ownerByStep={state.ownerByStep}
                            profileLabelOf={(key) =>
                                state.profiles.find((p) => p.profileKey === key)?.label ?? key}
                            isDragging={dragging !== null}
                            maxScore={state.maxScore}
                            lockedStepCode={stepCode}
                            onChange={state.setDraft}
                        />

                        <StepScorePanel
                            stepCode={stepCode}
                            profileKey={activeProfileKey}
                            minScore={draft.minScore}
                            maxScore={state.maxScore}
                            dirty={state.dirty}
                        />
                    </div>

                    <DragOverlay>
                        {dragging && (
                            <div className="flex items-center gap-2 rounded-lg border border-primary/50 bg-card p-2 text-sm shadow-xl ring-2 ring-primary/30">
                                <Plus className="h-4 w-4 text-primary" />
                                <span className="font-semibold text-foreground">{dragging.label}</span>
                                <span className="font-mono text-muted-foreground">{dragging.path}</span>
                            </div>
                        )}
                    </DragOverlay>
                </DndContext>
            </div>
        </TooltipProvider>
    );
}
