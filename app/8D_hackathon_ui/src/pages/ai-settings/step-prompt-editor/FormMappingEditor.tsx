import { useCallback, useState } from 'react';
import Editor from '@monaco-editor/react';
import { closestCenter, DndContext, DragOverlay, pointerWithin, type CollisionDetection } from '@dnd-kit/core';
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@cnma/react-ui';
import { Eye, GripVertical } from 'lucide-react';
import type { FormFieldConfig, FormSchemaConfig } from './types';
import { EditorModeToolbar } from './EditorModeToolbar';
import { AddLayoutGroupDialog } from './layout/AddLayoutGroupDialog';
import { LayoutCanvasPanel } from './layout/LayoutCanvasPanel';
import { LayoutConfigPanel } from './layout/LayoutConfigPanel';
import { LayoutFieldsPanel } from './layout/LayoutFieldsPanel';
import { useStepLayoutBuilder } from './layout/useStepLayoutBuilder';

export function FormMappingEditor({ stepCode, value, onChange }: { stepCode: string; value: FormSchemaConfig; onChange: (value: FormSchemaConfig) => void }) {
    const builder = useStepLayoutBuilder(value, onChange);
    const [mode, setMode] = useState<'form' | 'json'>('form');
    const [jsonText, setJsonText] = useState(() => JSON.stringify(value, null, 2));
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [reviewOpen, setReviewOpen] = useState(false);
    const collisionDetection: CollisionDetection = useCallback((args) => {
        const pointerCollisions = pointerWithin(args);
        return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
    }, []);
    const switchToJson = () => { setJsonText(JSON.stringify(value, null, 2)); setJsonError(null); setMode('json'); };

    return <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background p-4">
        <EditorModeToolbar mode={mode} onVisual={() => setMode('form')} onJson={switchToJson} actions={<Button variant="outline" size="sm" className="h-9 text-sm font-medium" onClick={() => setReviewOpen(true)}><Eye className="h-4 w-4" /> Review layout</Button>} />
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-card">
            {mode === 'json' ? <div className="relative h-full min-h-0 overflow-hidden">{jsonError && <p className="absolute bottom-4 right-4 z-10 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">JSON error: {jsonError}</p>}<Editor height="100%" language="json" value={jsonText} onChange={(text) => { const next = text ?? ''; setJsonText(next); try { onChange(JSON.parse(next) as FormSchemaConfig); setJsonError(null); } catch (error) { setJsonError(error instanceof Error ? error.message : 'Invalid JSON'); } }} options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, automaticLayout: true }} /></div> : <DndContext sensors={builder.sensors} collisionDetection={collisionDetection} onDragStart={builder.onDragStart} onDragOver={builder.onDragOver} onDragEnd={builder.onDragEnd}>
                <div className="flex h-full min-h-0 overflow-hidden"><LayoutFieldsPanel fields={builder.unassignedFields} selectedField={builder.selectedField} isDragging={Boolean(builder.activeField)} overId={builder.overId} onSelect={(key) => { builder.setSelectedField(key); builder.setSelectedGroup(null); }} onAddGroup={() => builder.setAddGroupOpen(true)} /><LayoutCanvasPanel groups={builder.groups} allFields={value.fields} spacers={builder.spacers} selectedField={builder.selectedField} selectedGroup={builder.selectedGroup} overId={builder.overId} onSelectField={(key) => { builder.setSelectedField(key); builder.setSelectedGroup(null); }} onSelectGroup={(id) => { builder.setSelectedGroup(id); builder.setSelectedField(null); }} onRemoveField={builder.removeFromLayout} onDeleteGroup={builder.deleteGroup} onMoveGroup={builder.moveGroup} onMoveField={builder.moveField} onAddSpacer={builder.addSpacer} onDeleteSpacer={builder.deleteSpacer} /><LayoutConfigPanel field={builder.selectedFieldConfig} group={builder.selectedGroupConfig} onFieldChange={(patch) => builder.selectedField && builder.updateField(builder.selectedField, patch)} onGroupChange={(patch) => builder.selectedGroup && builder.updateGroup(builder.selectedGroup, patch)} /></div>
                <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
                    {builder.activeField && (
                        <div className="flex min-h-9 h-auto w-[220px] select-none cursor-grabbing items-start gap-2 rounded-md border border-info bg-card px-2.5 py-2 text-sm shadow-lg ring-1 ring-info/30">
                            <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 font-medium leading-normal break-words whitespace-normal text-foreground">{builder.activeField.label ?? builder.activeField.key}</span>
                            <Badge variant="outline" className="mt-0.5 shrink-0 text-xs font-semibold px-2 py-0.5">{builder.activeField.widget}</Badge>
                        </div>
                    )}
                </DragOverlay>
            </DndContext>}
        </div>
        <AddLayoutGroupDialog open={builder.addGroupOpen} onOpenChange={builder.setAddGroupOpen} onAdd={builder.addGroup} />
        <Dialog open={reviewOpen} onOpenChange={setReviewOpen}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>{stepCode} form layout review</DialogTitle><DialogDescription className="text-sm">Each field key is the AI output path. Layout settings only control presentation.</DialogDescription></DialogHeader><div className="max-h-[70vh] space-y-4 overflow-y-auto rounded-lg bg-muted/20 p-4">{builder.groups.map((group) => <section key={group.id} className="rounded-xl border bg-card p-4"><h3 className="mb-3 text-base font-semibold">{group.label}</h3><div className="grid grid-cols-6 gap-3">{group.fieldKeys.map((key) => value.fields.find((field) => field.key === key)).filter((field): field is FormFieldConfig => Boolean(field)).map((field) => <div key={field.key} className={field.width === '33%' ? 'col-span-2' : field.width === '50%' ? 'col-span-3' : 'col-span-6'}><div className="rounded-lg border bg-background p-3"><p className="text-sm font-semibold">{field.label ?? field.key}</p><p className="mt-1 truncate font-mono text-xs text-muted-foreground">{field.key}</p></div></div>)}</div></section>)}</div><DialogFooter><Button className="h-9 text-sm font-semibold px-4" onClick={() => setReviewOpen(false)}>Close review</Button></DialogFooter></DialogContent></Dialog>
    </div>;
}
