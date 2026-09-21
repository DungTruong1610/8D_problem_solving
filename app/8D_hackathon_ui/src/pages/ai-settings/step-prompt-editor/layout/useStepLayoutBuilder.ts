import { useMemo, useState } from 'react';
import { KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { FormFieldConfig, FormGroupConfig, FormSchemaConfig, FormSpacerConfig } from '../types';

export function useStepLayoutBuilder(value: FormSchemaConfig, onChange: (value: FormSchemaConfig) => void) {
    const [selectedField, setSelectedField] = useState<string | null>(value.fields[0]?.key ?? null);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [activeField, setActiveField] = useState<FormFieldConfig | null>(null);
    const [overId, setOverId] = useState<string | null>(null);
    const [addGroupOpen, setAddGroupOpen] = useState(false);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    const groups = useMemo(() => [...(value.groups ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [value.groups]);
    const spacers = value.spacers ?? [];
    const assigned = useMemo(() => new Set(groups.flatMap((group) => group.fieldKeys)), [groups]);
    const unassignedFields = value.fields.filter((field) => !assigned.has(field.key));
    const selectedFieldConfig = value.fields.find((field) => field.key === selectedField) ?? null;
    const selectedGroupConfig = groups.find((group) => group.id === selectedGroup) ?? null;
    const commit = (patch: Partial<FormSchemaConfig>) => onChange({ ...value, ...patch });
    const setGroups = (next: FormGroupConfig[]) => commit({ groups: next.map((group, index) => ({ ...group, order: (index + 1) * 10 })) });
    const updateField = (key: string, patch: Partial<FormFieldConfig>) => commit({ fields: value.fields.map((field) => field.key === key ? { ...field, ...patch } : field) });
    const addGroup = (label: string) => { const id = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || `group-${groups.length + 1}`; if (groups.some((group) => group.id === id)) return; setGroups([...groups, { id, label, fieldKeys: [], width: '100', columns: 2 }]); setSelectedGroup(id); setSelectedField(null); };
    const updateGroup = (id: string, patch: Partial<FormGroupConfig>) => setGroups(groups.map((group) => group.id === id ? { ...group, ...patch } : group));
    const deleteGroup = (id: string) => { commit({ groups: groups.filter((group) => group.id !== id), spacers: spacers.filter((spacer) => spacer.groupId !== id) }); if (selectedGroup === id) setSelectedGroup(null); };
    const moveGroup = (id: string, direction: -1 | 1) => { const index = groups.findIndex((group) => group.id === id); const target = index + direction; if (index >= 0 && target >= 0 && target < groups.length) setGroups(arrayMove(groups, index, target)); };
    const removeFromLayout = (key: string) => setGroups(groups.map((group) => ({ ...group, fieldKeys: group.fieldKeys.filter((fieldKey) => fieldKey !== key) })));
    const moveField = (groupId: string, key: string, direction: -1 | 1) => { const group = groups.find((item) => item.id === groupId); if (!group) return; const index = group.fieldKeys.indexOf(key); const target = index + direction; if (index >= 0 && target >= 0 && target < group.fieldKeys.length) updateGroup(groupId, { fieldKeys: arrayMove(group.fieldKeys, index, target) }); };
    const addSpacer = (groupId: string) => { const next: FormSpacerConfig = { id: `spacer-${Date.now()}`, groupId, order: spacers.filter((item) => item.groupId === groupId).length * 10 + 10, colSpan: 1, height: 'medium' }; commit({ spacers: [...spacers, next] }); };
    const deleteSpacer = (id: string) => commit({ spacers: spacers.filter((spacer) => spacer.id !== id) });
    const onDragStart = ({ active }: DragStartEvent) => setActiveField(value.fields.find((field) => `field-${field.key}` === String(active.id)) ?? null);
    const onDragOver = ({ over }: DragOverEvent) => setOverId(over ? String(over.id) : null);
    const onDragEnd = ({ active, over }: DragEndEvent) => {
        setActiveField(null); setOverId(null); if (!over) return;
        const key = String(active.id).replace('field-', ''); const targetId = String(over.id);
        if (targetId === 'unassigned') { removeFromLayout(key); setSelectedField(key); return; }
        if (targetId === 'canvas') {
            if (groups.length === 0) {
                const newGroupId = 'group-1';
                const newGroup: FormGroupConfig = { id: newGroupId, label: 'General', fieldKeys: [key], width: '100', columns: 2 };
                setGroups([newGroup]); setSelectedGroup(newGroupId); setSelectedField(key); return;
            } else {
                const targetGroup = groups[groups.length - 1];
                if (targetGroup) {
                    setGroups(groups.map((g) => g.id === targetGroup.id ? { ...g, fieldKeys: [...g.fieldKeys.filter((k) => k !== key), key] } : { ...g, fieldKeys: g.fieldKeys.filter((k) => k !== key) }));
                    setSelectedGroup(targetGroup.id); setSelectedField(key);
                }
                return;
            }
        }
        const source = groups.find((group) => group.fieldKeys.includes(key));
        const target = groups.find((group) => targetId === `group-${group.id}` || group.fieldKeys.some((fieldKey) => targetId === `field-${fieldKey}`));
        if (!target) return;
        const overKey = targetId.replace('field-', '');
        if (source?.id === target.id && target.fieldKeys.includes(overKey)) { updateGroup(target.id, { fieldKeys: arrayMove(target.fieldKeys, target.fieldKeys.indexOf(key), target.fieldKeys.indexOf(overKey)) }); setSelectedField(key); return; }
        setGroups(groups.map((group) => group.id === target.id ? { ...group, fieldKeys: [...group.fieldKeys.filter((item) => item !== key), key] } : { ...group, fieldKeys: group.fieldKeys.filter((item) => item !== key) }));
        setSelectedField(key);
    };
    return { sensors, groups, spacers, unassignedFields, selectedField, selectedGroup, selectedFieldConfig, selectedGroupConfig, activeField, overId, addGroupOpen, setSelectedField, setSelectedGroup, setAddGroupOpen, updateField, addGroup, updateGroup, deleteGroup, moveGroup, removeFromLayout, moveField, addSpacer, deleteSpacer, onDragStart, onDragOver, onDragEnd };
}
