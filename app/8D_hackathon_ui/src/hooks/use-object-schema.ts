import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
    getProfileCriteria, getProfiles, getSourceFieldCatalog, getStepBindings,
    saveRetrievalProfile, STEP_CODES,
    type ProfileCriterion, type RetrievalProfile, type SourceFieldInfo, type StepBinding,
} from '@/services/retrieval-service';

/**
 * State for the Object Schema workbench.
 *
 * ── One screen, not two ──
 * Which fields a step compares and how heavily each one counts are the same
 * decision seen from two sides: dropping a field changes the reachable score,
 * and the threshold only means something against that score. Splitting them
 * across two screens meant every edit on one could silently overwrite the other,
 * and neither screen could show the consequence of its own change.
 *
 * So this hook owns the whole profile: identity, the 8D step it serves, the
 * fields it compares, their weights, and the retrieval thresholds.
 *
 * ── Draft, not live writes ──
 * These parts only mean something together — binding a step to a profile with no
 * fields is binding it to "never find a precedent". Edit a draft, then send the
 * desired state in ONE call, so there is no half-applied moment.
 */

/** A profile draft — exactly what Save sends. */
export interface ProfileDraft {
    label: string;
    description: string;
    /** Fields this profile compares, with their scoring parameters. */
    fields: ProfileCriterion[];
    /** The 8D step this profile serves. At most one — see `blockingError`. */
    steps: string[];
    /** Below this score no precedent is surfaced at all. */
    minScore: number;
    /** How many precedents to hand the step. */
    topN: number;
    /** Only completed / closed cases qualify as precedents. */
    closedOnly: boolean;
}

export interface ObjectSchemaState {
    catalog: SourceFieldInfo[];
    catalogCaseCount: number;
    profiles: RetrievalProfile[];
    loading: boolean;
    saving: boolean;

    activeProfileKey: string;
    selectProfile: (key: string) => void;
    activeProfile: RetrievalProfile | null;

    draft: ProfileDraft | null;
    setDraft: (patch: Partial<ProfileDraft>) => void;
    dirty: boolean;
    /** Lý do chưa lưu được, hoặc null khi hợp lệ. */
    blockingError: string | null;

    /** Field trong danh mục chưa được bản nháp dùng — nguồn của panel trái. */
    availableFields: SourceFieldInfo[];
    fieldByPath: Map<string, SourceFieldInfo>;
    /** Bước D → profile đang giữ nó trên SERVER. Để cảnh báo khi cướp bước. */
    ownerByStep: Record<string, string>;
    /** Số field của từng profile — panel danh sách cần, và nó là số của trang này. */
    fieldCountByProfile: Record<string, number>;
    /** Reachable score: the weights of every enabled field in the draft. */
    maxScore: number;

    save: () => Promise<void>;
    discard: () => void;
    /** Nạp lại từ server; truyền khoá để mở luôn profile vừa tạo. */
    reload: (selectKey?: string) => Promise<void>;
}

function toDraft(
    profile: RetrievalProfile,
    criteria: ProfileCriterion[],
    bindings: StepBinding[],
): ProfileDraft {
    const assignedSteps = STEP_CODES.filter((code) =>
        bindings.find((b) => b.stepCode === code)?.profile_profileKey === profile.profileKey,
    );
    return {
        label: profile.label ?? profile.profileKey,
        description: profile.description ?? '',
        fields: criteria
            .filter((c) => c.profile_profileKey === profile.profileKey)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
        steps: assignedSteps.slice(0, 1),
        minScore: profile.minScore,
        topN: profile.topN,
        closedOnly: profile.closedOnly,
    };
}

/**
 * @param stepCode when given, the workbench opens the profile that this 8D step
 *        runs and stays on it. The step editor embeds this hook that way, so a
 *        step's schema tab always shows the step's own profile rather than
 *        whichever profile was last opened on the standalone page.
 */
export function useObjectSchema(stepCode?: string): ObjectSchemaState {
    const [catalog, setCatalog] = useState<SourceFieldInfo[]>([]);
    const [catalogCaseCount, setCatalogCaseCount] = useState(0);
    const [profiles, setProfiles] = useState<RetrievalProfile[]>([]);
    const [criteria, setCriteria] = useState<ProfileCriterion[]>([]);
    const [bindings, setBindings] = useState<StepBinding[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeProfileKey, setActiveProfileKey] = useState('default');
    const [draft, setDraftState] = useState<ProfileDraft | null>(null);

    const reload = useCallback(async (selectKey?: string, skipCatalog = false) => {
        const fetchCatalog = skipCatalog
            ? Promise.resolve(null)
            : getSourceFieldCatalog();
        const [cat, p, c, b] = await Promise.all([
            fetchCatalog, getProfiles(), getProfileCriteria(), getStepBindings(),
        ]);
        if (cat) {
            setCatalog(cat.fields ?? []);
            setCatalogCaseCount(cat.caseCount ?? 0);
        }
        setProfiles(p);
        setCriteria(c);
        setBindings(b);

        // A step-scoped workbench always follows its step's binding. Otherwise
        // keep whatever profile is open — unless it was just deleted, in which
        // case fall back to the first one rather than showing an empty panel.
        const boundToStep = stepCode
            ? b.find((row) => row.stepCode === stepCode)?.profile_profileKey
            : undefined;
        const wanted = selectKey ?? boundToStep ?? activeProfileKey;
        const target = p.find((row) => row.profileKey === wanted) ?? p[0] ?? null;
        if (target) {
            setActiveProfileKey(target.profileKey);
            setDraftState(toDraft(target, c, b));
        } else {
            setDraftState(null);
        }
    }, [activeProfileKey, stepCode]);

    useEffect(() => {
        reload()
            .catch((e: any) => toast.error(`Could not load object schema: ${e.message}`))
            .finally(() => setLoading(false));
        // Chạy đúng một lần lúc mở trang. `reload` phụ thuộc `activeProfileKey`,
        // đưa nó vào deps sẽ nạp lại mỗi lần đổi profile và xoá mất bản nháp.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const serverDraft = useMemo(() => {
        const profile = profiles.find((p) => p.profileKey === activeProfileKey);
        return profile ? toDraft(profile, criteria, bindings) : null;
    }, [profiles, criteria, bindings, activeProfileKey]);

    /** Everything Save sends — this screen owns all of it, so compare all of it. */
    const saveShape = useCallback((d: ProfileDraft) => JSON.stringify({
        label: d.label,
        description: d.description,
        steps: d.steps,
        minScore: d.minScore,
        topN: d.topN,
        closedOnly: d.closedOnly,
        fields: d.fields.map((f) => [
            f.criterionKey, f.label, f.sourceField, f.matchType, f.weight,
            f.minSimilarity, f.enabled, f.fallbackMatch, f.fallbackField, f.fallbackWeight,
        ]),
    }), []);

    const dirty = useMemo(
        () => Boolean(draft && serverDraft && saveShape(draft) !== saveShape(serverDraft)),
        [draft, serverDraft, saveShape],
    );

    const setDraft = useCallback((patch: Partial<ProfileDraft>) => {
        setDraftState((current) => (current ? { ...current, ...patch } : current));
    }, []);

    const selectProfile = useCallback((key: string) => {
        if (key === activeProfileKey) return;
        if (dirty && !window.confirm('Discard unsaved changes to current profile?')) return;
        const profile = profiles.find((p) => p.profileKey === key);
        if (!profile) return;
        setActiveProfileKey(key);
        setDraftState(toDraft(profile, criteria, bindings));
    }, [activeProfileKey, dirty, profiles, criteria, bindings]);

    const discard = useCallback(() => {
        if (serverDraft) setDraftState(serverDraft);
    }, [serverDraft]);

    /**
     * Prevent invalid states from saving.
     */
    const blockingError = useMemo(() => {
        if (!draft) return null;
        if (!draft.label.trim()) return 'Profile must have a label.';
        if (draft.steps.length > 1) {
            return 'Each profile can only be assigned to a single 8D step.';
        }
        if (draft.steps.length && !draft.fields.length) {
            return `Profile is assigned to ${draft.steps.join(', ')} but contains no fields — that step would never match any precedent.`;
        }
        const maxScore = draft.fields
            .filter((f) => f.enabled)
            .reduce((sum, f) => sum + (f.weight ?? 0), 0);
        if (draft.steps.length && maxScore === 0) {
            return 'No field is enabled — the reachable score is 0, so nothing can pass the threshold.';
        }
        if (maxScore > 0 && draft.minScore > maxScore) {
            return `Threshold ${draft.minScore} is above the reachable score ${maxScore} — no case can ever qualify.`;
        }
        const cosineOnWrongField = draft.fields.find(
            (f) => f.matchType === 'cosine' && f.sourceField !== 'embedding',
        );
        if (cosineOnWrongField) {
            return `"${cosineOnWrongField.label}" uses Vector matching on "${cosineOnWrongField.sourceField}" — only the embedding field carries a vector.`;
        }
        return null;
    }, [draft]);

    const save = useCallback(async () => {
        if (!draft || blockingError) return;
        setSaving(true);
        try {
            await saveRetrievalProfile(activeProfileKey, {
                label: draft.label,
                description: draft.description,
                minScore: draft.minScore,
                topN: draft.topN,
                closedOnly: draft.closedOnly,
                // Full criteria, not just membership: this screen owns the weights
                // too now, so there is no other writer whose edits could be lost.
                criteria: draft.fields,
                steps: draft.steps,
            });
            await reload(activeProfileKey, true);
            toast.success(`Saved profile "${draft.label}".`);
        } catch (e: any) {
            toast.error(`Save failed: ${e?.response?.data?.error?.message ?? e.message}`);
        } finally {
            setSaving(false);
        }
    }, [draft, blockingError, activeProfileKey, reload]);

    const fieldByPath = useMemo(() => new Map(catalog.map((f) => [f.path, f])), [catalog]);

    const availableFields = useMemo(() => {
        // So theo `sourceField`, không theo `criterionKey`: hai tiêu chí khác tên
        // vẫn có thể trỏ vào cùng một field, và lúc đó field đó ĐÃ được dùng.
        const used = new Set((draft?.fields ?? []).map((c) => c.sourceField ?? ''));
        return catalog.filter((f) => !used.has(f.path));
    }, [catalog, draft]);

    const fieldCountByProfile = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const c of criteria) {
            counts[c.profile_profileKey] = (counts[c.profile_profileKey] ?? 0) + 1;
        }
        // Profile đang mở đếm theo BẢN NHÁP: kéo một field ra rồi vẫn thấy con số
        // cũ ở panel bên cạnh là hai chỗ nói hai chuyện về cùng một profile.
        if (draft) counts[activeProfileKey] = draft.fields.length;
        return counts;
    }, [criteria, draft, activeProfileKey]);

    const ownerByStep = useMemo(
        () => Object.fromEntries(
            STEP_CODES.map((code) => [
                code,
                bindings.find((b) => b.stepCode === code)?.profile_profileKey ?? 'default',
            ]),
        ),
        [bindings],
    );

    return {
        catalog,
        catalogCaseCount,
        profiles,
        loading,
        saving,
        activeProfileKey,
        selectProfile,
        activeProfile: profiles.find((p) => p.profileKey === activeProfileKey) ?? null,
        draft,
        setDraft,
        dirty,
        blockingError,
        availableFields,
        fieldByPath,
        ownerByStep,
        fieldCountByProfile,
        maxScore: (draft?.fields ?? [])
            .filter((f) => f.enabled)
            .reduce((sum, f) => sum + (f.weight ?? 0), 0),
        save,
        discard,
        reload,
    };
}
