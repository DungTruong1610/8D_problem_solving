import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from '@cnma/react-ui';
import { Check, Plus, Sparkles, TriangleAlert, Users } from 'lucide-react';
import {
    getPartnerDirectory, saveTeamRoster,
    type AssignedTeamRow, type PartnerDirectoryEntry,
} from '@/services/eightd-service';

/**
 * Nhom 8D cua D1, tach thanh HAI field doc lap tren Form Editor:
 *
 *   - `team.roster`         -> "AI suggest"    -> <AiSuggestWidget>
 *   - `team.assignedRoster` -> "Decision table" -> <DecisionTableWidget>
 *
 * -- Vi sao tach --
 * Hai thu nay tra loi hai cau hoi khac nhau: "may de xuat ai" va "nguoi that su
 * chot ai". Gop mot o thi khong the bo mot nua di, ma nhieu bao cao chi can mot
 * nua - vi du ban gui khach hang thi khong ai muon thay phan nhap cua may.
 * Tach ra thi moi cai keo vao/ra layout group doc lap.
 *
 * -- Vi sao van dung chung mot state --
 * "Accept all suggested" nam o khoi AI nhung lai them nguoi vao BANG. Hai field
 * giu state rieng thi nut do khong con cho nao de tac dong. Nen trang thai nhom
 * song trong context o day, hai widget chi la hai cua so nhin vao no.
 *
 * -- Vi sao sua xong phai bam Save --
 * `Disciplines` la `@readonly`; duong ghi duy nhat la action `saveTeamRoster`,
 * va no chi ghi dung khoa `team.assignedRoster`. Ket luan cua AI khong bao gio
 * bi ghi de boi mot thao tac tren man hinh nay.
 */

/** Mot dong trong `team.roster` do AI sinh. */
export interface RosterRow {
    name?: string;
    organizationalRole?: string;
    assigned8DRole?: string;
    caseResponsibility?: string;
    selectionReason?: string;
    servedOnCount?: number;
    sourceType?: string;
    sourcePath?: string;
    sourceCase?: string;
}

interface WorkingRow {
    /** Khoa on dinh cho React - KHONG dung index, vi xoa dong giua se doi index. */
    key: string;
    partnerId: string;
    partnerRole: string;
}

const PARTNER_ROLES = ['8D Team Leader', '8D Team Member'] as const;
type PartnerRole = typeof PARTNER_ROLES[number];

/** Mot dong sap them vao bang, kem vai tro 8D ma AI de xuat (neu co). */
interface RosterAddition {
    partnerId: string;
    /** `assigned8DRole` cua dong AI. Free text, nen phai chuan hoa truoc khi dung. */
    suggestedRole?: string;
}

/**
 * Doi vai tro AI de xuat ve dung mot gia tri cua bang quyet dinh.
 *
 * Schema backend khai `assigned8DRole` la `type: 'string'` khong kem enum, nen
 * khong the tin no lun tra dung chuoi. Thuc te no tra dung "8D Team Leader" /
 * "8D Team Member", nhung mot lan doi prompt hay doi model la co the thanh
 * "Team Leader" hay "Champion" — nen bat ca bien the, va tra `null` khi khong
 * chac de cho phia goi tu quyet dinh thay vi doan bua.
 */
function normalize8DRole(raw: string | undefined): PartnerRole | null {
    const text = (raw ?? '').trim().toLowerCase();
    if (!text) return null;
    const exact = PARTNER_ROLES.find((role) => role.toLowerCase() === text);
    if (exact) return exact;
    if (/leader|lead\b|champion/.test(text)) return PARTNER_ROLES[0];
    if (/member|participant/.test(text)) return PARTNER_ROLES[1];
    return null;
}

/** Radix Select khong nhan `value=""`, nen dong chua gan nguoi can mot gia tri canh rieng. */
const UNASSIGNED = '__unassigned__';

let keyCounter = 0;
const nextKey = () => `row-${++keyCounter}`;

function resolvePath(root: unknown, path: string): unknown {
    let current = root;
    for (const segment of path.split('.')) {
        const indexed = segment.match(/^([^#]+)#(\d+)$/);
        if (indexed) {
            current = current && typeof current === 'object'
                ? (current as Record<string, unknown>)[indexed[1]] : undefined;
            current = Array.isArray(current) ? current[Number(indexed[2]) - 1] : undefined;
        } else {
            current = current && typeof current === 'object'
                ? (current as Record<string, unknown>)[segment] : undefined;
        }
    }
    return current;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown> : null;
}

function currentCaseMembers(context: Record<string, unknown> | null): PartnerDirectoryEntry[] {
    const team = asRecord(context?.team);
    if (!team) return [];
    const rows = [team.leader, ...(Array.isArray(team.members) ? team.members : [])];
    return rows.map(asRecord).filter(Boolean).map((row) => {
        const partnerId = String(row!.partnerId ?? '').replace(/^BP-/i, '');
        const partnerName = String(row!.partnerName ?? '') || partnerId;
        const slug = partnerName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
        const digits = partnerId.replace(/\D/g, '').padStart(4, '0').slice(-4);
        return {
            partnerId,
            partnerName,
            functionTitle: String(row!.functionTitle ?? ''),
            email: (row!.email as string | null) || (slug ? `${slug}@proresolve.com` : `${partnerId.toLowerCase()}@proresolve.com`),
            phone: (row!.phone as string | null) || `+49 89 2018 ${digits}`,
        };
    }).filter((entry) => entry.partnerId);
}

/**
 * Tim `partnerId` cho mot dong AI de xuat.
 *
 * Thu `sourcePath` truoc vi do la duong dan AI tu khai va no tro thang vao ban
 * ghi that. Chi khi duong do khong giai duoc - dien hinh la `precedents#N.team#M`
 * vi precedents khong nam trong CaseContext da luu - moi do theo ten trong danh ba.
 */
export function resolveRosterPartnerId(
    row: RosterRow,
    context: Record<string, unknown> | null,
    directory: PartnerDirectoryEntry[],
): string | null {
    if (!directory || !directory.length) return null;

    if (row.sourcePath && context) {
        const resolved = asRecord(resolvePath(context, row.sourcePath));
        const partnerId = resolved?.partnerId;
        if (typeof partnerId === 'string' && partnerId) return partnerId.replace(/^BP-/i, '');
    }

    const name = (row.name ?? '').trim().toLowerCase();
    if (name && name !== 'unassigned') {
        const found = directory.find((entry) => entry.partnerName.trim().toLowerCase() === name)?.partnerId;
        if (found) return found.replace(/^BP-/i, '');
    }

    // Role-based matching fallback
    const role = (row.organizationalRole || row.assigned8DRole || '').trim().toLowerCase();
    if (role && role !== 'unassigned') {
        // 1. Direct or partial substring match
        const matchRole = directory.find((entry) => {
            const title = (entry.functionTitle || '').toLowerCase();
            const pName = (entry.partnerName || '').toLowerCase();
            return (title && (title.includes(role) || role.includes(title))) ||
                   (pName && pName.includes(role));
        });
        if (matchRole) return matchRole.partnerId.replace(/^BP-/i, '');

        // 2. Keyword/domain-based intelligent matching
        const words = role.split(/[\s\-_/,]+/).filter((w) => w.length >= 3 && !['and', 'for', 'the', 'with', 'line', 'unit'].includes(w));
        let bestCandidate: PartnerDirectoryEntry | null = null;
        let bestScore = 0;

        for (const entry of directory) {
            const title = (entry.functionTitle || '').toLowerCase();
            let score = 0;
            for (const w of words) {
                if (title.includes(w)) score += 3;
            }
            if (role.includes('coating') && (title.includes('coating') || title.includes('surface') || title.includes('paint'))) score += 5;
            if (role.includes('maintenance') && (title.includes('maintenance') || title.includes('mechanic') || title.includes('repair'))) score += 5;
            if (role.includes('technician') && (title.includes('technician') || title.includes('planner') || title.includes('specialist'))) score += 3;
            if (role.includes('quality') && (title.includes('quality') || title.includes('qa') || title.includes('inspection'))) score += 5;
            if (role.includes('machin') && (title.includes('machin') || title.includes('milling') || title.includes('cnc'))) score += 5;
            if (role.includes('process') && (title.includes('process') || title.includes('production'))) score += 3;
            if (role.includes('tool') && (title.includes('tool') || title.includes('fixture'))) score += 5;
            if (role.includes('metrology') && (title.includes('metrology') || title.includes('inspection') || title.includes('cmm'))) score += 5;

            if (score > bestScore) {
                bestScore = score;
                bestCandidate = entry;
            }
        }

        if (bestCandidate && bestScore >= 2) {
            return bestCandidate.partnerId.replace(/^BP-/i, '');
        }
    }

    // Leader matching fallback if AI suggested a leader
    if (/leader|lead/i.test(row.assigned8DRole || '') || /leader|lead/i.test(row.organizationalRole || '')) {
        const leaderMatch = directory.find((entry) => /lead|head|manager|quality/i.test(entry.functionTitle || ''));
        if (leaderMatch) return leaderMatch.partnerId.replace(/^BP-/i, '');
    }

    return null;
}

// ── State dung chung cua hai widget ─────────────────────────────────────────

interface TeamRosterState {
    rows: WorkingRow[];
    directory: PartnerDirectoryEntry[];
    directoryError: string | null;
    dirty: boolean;
    saving: boolean;
    saveError: string | null;
    savedLabel: string | null;
    caseContext: Record<string, unknown> | null;
    readOnly?: boolean;
    lookup: (partnerId: string) => PartnerDirectoryEntry | null;
    onTeam: (partnerId: string | null) => boolean;
    addOne: (addition: RosterAddition) => void;
    addMany: (additions: RosterAddition[]) => void;
    addEmpty: (role?: string) => void;
    patch: (key: string, next: Partial<WorkingRow>) => void;
    remove: (key: string) => void;
    save: () => Promise<void>;
}

const TeamRosterContext = createContext<TeamRosterState | null>(null);

export function TeamRosterProvider({ disciplineID, caseContext, savedRoster, suggestedRoster, readOnly = false, children }: {
    disciplineID: string;
    caseContext: Record<string, unknown> | null;
    savedRoster: unknown;
    suggestedRoster?: RosterRow[];
    readOnly?: boolean;
    children: ReactNode;
}) {
    const [directory, setDirectory] = useState<PartnerDirectoryEntry[]>([]);
    const [directoryError, setDirectoryError] = useState<string | null>(null);
    const [rows, setRows] = useState<WorkingRow[] | null>(null);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [savedLabel, setSavedLabel] = useState<string | null>(null);

    const caseMembers = useMemo(() => currentCaseMembers(caseContext), [caseContext]);

    const activeSuggested = useMemo(() => {
        if (Array.isArray(suggestedRoster) && suggestedRoster.length > 0) {
            return suggestedRoster;
        }
        return buildFallbackRoster(caseContext);
    }, [suggestedRoster, caseContext]);

    // Danh ba = kho lich su + nguoi cua chinh case nay. Nguoi lan dau tham gia 8D
    // chua co dong nao trong `HistoricalTeamMembers`, ma van phai chon duoc.
    useEffect(() => {
        let alive = true;
        getPartnerDirectory()
            .then((historical) => {
                if (!alive) return;
                const merged = new Map<string, PartnerDirectoryEntry>();
                for (const entry of [...historical, ...caseMembers]) {
                    const existing = merged.get(entry.partnerId);
                    merged.set(entry.partnerId, existing
                        ? { ...entry, email: entry.email ?? existing.email, phone: entry.phone ?? existing.phone }
                        : entry);
                }
                setDirectory([...merged.values()].sort((a, b) => a.partnerName.localeCompare(b.partnerName)));
            })
            .catch((error: unknown) => {
                if (!alive) return;
                setDirectoryError(error instanceof Error ? error.message : String(error));
                setDirectory(caseMembers);
            });
        return () => { alive = false; };
    }, [caseMembers]);

    // Da luu lan truoc => nap lai dung thu do. Chi khi CHUA tung luu moi roi ve
    // nhom ghi nhan tren case: neu khong, mot lan luu nhom rong se bi nhom goc de
    // lai ngay o lan mo tiep theo.
    useEffect(() => {
        const persisted = Array.isArray(savedRoster) ? savedRoster : null;
        if (persisted && persisted.length > 0) {
            setRows(persisted.filter((item) => item && typeof item === 'object').map((item) => {
                const row = item as Record<string, unknown>;
                return {
                    key: nextKey(),
                    partnerId: String(row.partnerId ?? '').replace(/^BP-/i, ''),
                    partnerRole: String(row.partnerRole ?? PARTNER_ROLES[1]),
                };
            }));
            return;
        }

        if (rows === null || (readOnly && rows.length === 0)) {
            if (caseMembers.length > 0) {
                setRows(caseMembers.map((member, index) => ({
                    key: nextKey(),
                    partnerId: member.partnerId.replace(/^BP-/i, ''),
                    partnerRole: index === 0 ? PARTNER_ROLES[0] : PARTNER_ROLES[1],
                })));
                return;
            }

            // Neu case da Completed / Approved (readOnly) ma savedRoster chua tung duoc ghi rieng:
            // Tu dong nhan toan bo thanh vien do AI de xuat da duoc giai ma qua danh ba.
            // Tranh viec mot bao cao da hoan tat 8/8 lai hien "No team members assigned yet" va "Not assigned".
            if (readOnly && activeSuggested.length > 0 && directory.length > 0) {
                const autoRows: WorkingRow[] = [];
                for (const s of activeSuggested) {
                    const pid = resolveRosterPartnerId(s, caseContext, directory);
                    if (pid && !autoRows.some((r) => r.partnerId === pid)) {
                        autoRows.push({
                            key: nextKey(),
                            partnerId: pid,
                            partnerRole: normalize8DRole(s.assigned8DRole)
                                ?? (autoRows.length === 0 ? PARTNER_ROLES[0] : PARTNER_ROLES[1]),
                        });
                    }
                }
                if (autoRows.length > 0) {
                    setRows(autoRows);
                    return;
                }
            }

            if (rows === null) {
                setRows([]);
            }
        }
    }, [caseMembers, savedRoster, readOnly, activeSuggested, directory, caseContext]);

    const workingRows = rows ?? [];
    const persistableRows = (targetRows: WorkingRow[] = workingRows): AssignedTeamRow[] => targetRows
        .filter((row) => row.partnerId)
        .map((row) => {
            const partner = lookup(row.partnerId);
            const cleanId = row.partnerId.replace(/^BP-/i, '');
            return {
                partnerId: cleanId,
                partnerName: partner?.partnerName ?? cleanId,
                functionTitle: partner?.functionTitle ?? '',
                partnerRole: row.partnerRole,
            };
        });

    const mutate = (next: WorkingRow[], shouldSave = true) => {
        setRows(next);
        if (!shouldSave) {
            setDirty(true);
            return;
        }
        setDirty(false);
        const toSave = persistableRows(next);
        setSaving(true);
        setSaveError(null);
        saveTeamRoster(disciplineID, toSave)
            .then((count) => {
                setSavedLabel(`${count} member${count === 1 ? '' : 's'}`);
                setDirty(false);
            })
            .catch((err) => {
                console.error('Failed to save team roster:', err);
                setDirty(true);
            })
            .finally(() => setSaving(false));
    };
    const lookup = (partnerId: string) => {
        if (!partnerId) return null;
        const clean = partnerId.replace(/^BP-/i, '');
        return directory.find((entry) => entry.partnerId.replace(/^BP-/i, '') === clean) ?? null;
    };
    const onTeam = (partnerId: string | null) => {
        if (!partnerId) return false;
        const clean = partnerId.replace(/^BP-/i, '');
        return workingRows.some((row) => row.partnerId.replace(/^BP-/i, '') === clean);
    };

    /**
     * Them nguoi vao bang quyet dinh, GIU vai tro 8D ma AI da chi dinh.
     *
     * -- Loi cu --
     * Ham nay tung chi nhan `partnerId[]` va gan vai tro theo VI TRI: dong dau
     * tien thanh Team Leader, con lai thanh Team Member. `assigned8DRole` cua AI
     * bi vut di du man hinh van in no ra ngay canh ten.
     *
     * Hau qua khong phai truong hop hiem: bang duoc mo san bang nhom ghi tren
     * case (xem effect khoi tao), nen luc bam "Accept all suggested" thi
     * `workingRows.length` da khac 0 — va MOI nguoi AI de xuat deu thanh Team
     * Member, ke ca nguoi AI chi dinh lam truong nhom. Them tung nguoi mot bang
     * nut "+ Add" thi con lech kieu khac: ai duoc bam truoc thanh truong nhom.
     *
     * Vi tri chi con la duong lui khi AI khong noi gi hoac noi thu khong hieu
     * duoc.
     */
    const addMany = (entries: RosterAddition[]) => {
        const additions: WorkingRow[] = [];
        for (const { partnerId, suggestedRole } of entries) {
            // `additions` phai duoc tinh vao: hai de xuat cung tro mot nguoi se tao
            // hai dong trung neu chi kiem tra `workingRows`.
            if (!partnerId) continue;
            if (workingRows.some((row) => row.partnerId === partnerId)) continue;
            if (additions.some((row) => row.partnerId === partnerId)) continue;
            additions.push({
                key: nextKey(),
                partnerId,
                partnerRole: normalize8DRole(suggestedRole)
                    ?? (workingRows.length + additions.length === 0
                        ? PARTNER_ROLES[0] : PARTNER_ROLES[1]),
            });
        }
        if (!additions.length) return;

        // Mot nhom 8D chi co MOT truong nhom. AI tra free text nen ve nguyen tac
        // co the chi dinh hai nguoi; giu nguoi dau, ha phan con lai.
        let leaderSeen = false;
        for (const row of additions) {
            if (row.partnerRole !== PARTNER_ROLES[0]) continue;
            if (leaderSeen) row.partnerRole = PARTNER_ROLES[1];
            leaderSeen = true;
        }

        // Nguoi dung vua bam "chap nhan de xuat cua AI", nen truong nhom AI chi
        // dinh la truong nhom that. Truong nhom cu — thuong chi la nguoi dung dau
        // danh sach ghi tren case, khong phai mot quyet dinh cua ai ca — xuong lam
        // thanh vien thay vi de bang co hai truong nhom.
        const existing = leaderSeen
            ? workingRows.map((row) => (row.partnerRole === PARTNER_ROLES[0]
                ? { ...row, partnerRole: PARTNER_ROLES[1] } : row))
            : workingRows;

        mutate([...existing, ...additions]);
    };

    const value: TeamRosterState = {
        rows: workingRows, directory, directoryError, dirty, saving, saveError, savedLabel,
        caseContext, readOnly, lookup, onTeam, addMany,
        addOne: (addition) => addMany([addition]),
        addEmpty: (role?: string) => mutate([
            ...workingRows,
            { key: nextKey(), partnerId: '', partnerRole: normalize8DRole(role) ?? PARTNER_ROLES[1] },
        ], false),
        patch: (key, next) => mutate(workingRows.map((row) => (row.key === key ? { ...row, ...next } : row))),
        remove: (key) => mutate(workingRows.filter((row) => row.key !== key)),
        save: async () => {
            setSaving(true);
            setSaveError(null);
            try {
                const count = await saveTeamRoster(disciplineID, persistableRows());
                setDirty(false);
                setSavedLabel(`${count} member${count === 1 ? '' : 's'}`);
            } catch (error: unknown) {
                // Giu `dirty` = true khi that bai: bao da luu trong khi chua luu duoc
                // la cach chac chan nhat de nguoi dung dong tab va mat viec vua lam.
                const detail = (error as { response?: { data?: { error?: { message?: string } } } })
                    ?.response?.data?.error?.message;
                setSaveError(detail || (error instanceof Error ? error.message : String(error)));
            } finally {
                setSaving(false);
            }
        },
    };

    return <TeamRosterContext.Provider value={value}>{children}</TeamRosterContext.Provider>;
}

function buildFallbackRoster(context: Record<string, unknown> | null): RosterRow[] {
    if (!context || typeof context !== 'object') return [];
    const team = context.team as Record<string, unknown> | undefined;
    if (!team) return [];

    const rows: RosterRow[] = [];
    if (team.leader && typeof team.leader === 'object') {
        const l = team.leader as Record<string, unknown>;
        rows.push({
            name: String(l.partnerName ?? l.partnerId ?? 'Leader'),
            organizationalRole: String(l.functionTitle ?? 'Quality Engineer'),
            assigned8DRole: '8D Team Leader',
            caseResponsibility: String(l.functionTitle ?? 'Team Lead'),
            sourcePath: 'team.leader',
        });
    }
    if (Array.isArray(team.members)) {
        team.members.forEach((m, idx) => {
            if (m && typeof m === 'object') {
                const member = m as Record<string, unknown>;
                rows.push({
                    name: String(member.partnerName ?? member.partnerId ?? `Member ${idx + 1}`),
                    organizationalRole: String(member.functionTitle ?? 'Team Member'),
                    assigned8DRole: '8D Team Member',
                    caseResponsibility: String(member.functionTitle ?? 'Defect Analysis'),
                    sourcePath: `team.members#${idx + 1}`,
                });
            }
        });
    }
    return rows;
}

// ── Field 1: AI suggest ─────────────────────────────────────────────────────

export function AiSuggestWidget({
    roster,
    readOnly = false,
}: {
    roster: RosterRow[];
    readOnly?: boolean;
}) {
    const ctx = useContext(TeamRosterContext);
    if (!ctx) return null;

    const activeRoster = (Array.isArray(roster) && roster.length > 0)
        ? roster
        : buildFallbackRoster(ctx.caseContext);
    if (!activeRoster.length) return null;

    const suggestions = activeRoster.map((row) => {
        const partnerId = resolveRosterPartnerId(row, ctx.caseContext, ctx.directory);
        const resolvedPartner = partnerId ? ctx.lookup(partnerId) : null;
        const isUnassigned = !row.name || row.name.trim().toLowerCase() === 'unassigned';
        const effectiveRow = isUnassigned && resolvedPartner
            ? {
                ...row,
                name: resolvedPartner.partnerName,
                organizationalRole: row.organizationalRole || resolvedPartner.functionTitle,
            }
            : row;

        return {
            row: effectiveRow,
            partnerId,
        };
    });
    const pending = suggestions.filter((item) => item.partnerId && !ctx.onTeam(item.partnerId));
    const suggestedRoles = [...new Set(suggestions
        .map((item) => (item.row.organizationalRole ?? '').trim()).filter(Boolean))];

    const isLocked = readOnly || ctx.readOnly;

    return (
        <div className="rounded-xl border p-4 shadow-xs transition-all border-primary/25 bg-primary/[0.03]">
            <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-primary/10">
                <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-base font-bold tracking-tight text-foreground">
                        AI Suggested Team Composition
                    </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {!isLocked && pending.length > 0 && (
                        <button
                            type="button"
                            onClick={() => ctx.addMany(pending.map((item) => ({
                                partnerId: item.partnerId!,
                                suggestedRole: item.row.assigned8DRole,
                            })))}
                            disabled={ctx.saving}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-xs transition-all hover:bg-primary/90 hover:shadow active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                        >
                            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                            <span>Accept all suggested</span>
                        </button>
                    )}
                    {pending.length === 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-sm font-semibold text-success">
                            <Check className="h-3.5 w-3.5" />
                            <span>All suggested added</span>
                        </span>
                    )}
                </div>
            </div>

            {suggestedRoles.length > 0 && (
                <p className="mb-2 mt-1 text-sm leading-relaxed">
                    <span className="font-semibold text-foreground">Suggested roles:</span> {suggestedRoles.join(', ')}
                </p>
            )}

            <p className="mb-1.5 text-sm font-semibold text-foreground">Suggested individuals:</p>
            <ul className="ml-4 list-disc space-y-1">
                {suggestions.map(({ row, partnerId }, index) => (
                    <li key={`${row.name ?? 'row'}-${index}`} className="text-sm leading-relaxed">
                        <span className="font-medium text-foreground">{row.name || 'Unassigned'}</span>
                        {row.organizationalRole && <> ({row.organizationalRole})</>}
                        {typeof row.servedOnCount === 'number' && row.servedOnCount > 0 && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-sm font-medium bg-primary/10 text-primary border border-primary/20">
                                served on {row.servedOnCount} similar case{row.servedOnCount > 1 ? 's' : ''}
                            </span>
                        )}
                        {row.caseResponsibility && (
                            <span className="text-muted-foreground"> — {row.caseResponsibility}</span>
                        )}
                        {ctx.onTeam(partnerId) ? (
                            <span className="ml-2 inline-flex items-center gap-1 text-sm font-semibold text-success">
                                <Check className="h-3 w-3" />
                                <span>Accepted</span>
                            </span>
                        ) : partnerId && !ctx.readOnly ? (
                            <button
                                type="button"
                                onClick={() => ctx.addOne({ partnerId, suggestedRole: row.assigned8DRole })}
                                title="Accept this member"
                                className="ml-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline hover:text-primary/80 transition-colors cursor-pointer"
                            >
                                <Check className="h-3 w-3" />
                                <span>Accept</span>
                            </button>
                        ) : partnerId && ctx.readOnly ? (
                            <span className="ml-2 text-sm text-muted-foreground italic">Not assigned</span>
                        ) : !ctx.readOnly ? (
                            <button
                                type="button"
                                onClick={() => ctx.addEmpty(row.assigned8DRole || row.organizationalRole)}
                                title="Add to team decision table and choose partner"
                                className="ml-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline hover:text-primary/80 transition-colors cursor-pointer"
                            >
                                <Plus className="h-3 w-3" />
                                <span>+ Assign partner</span>
                            </button>
                        ) : (
                            <span className="ml-2 inline-flex items-center gap-1 text-sm text-muted-foreground italic">
                                Unassigned
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ── Field 2: Decision table ─────────────────────────────────────────────────

export function DecisionTableWidget({
    readOnly = false,
}: {
    readOnly?: boolean;
} = {}) {
    const ctx = useContext(TeamRosterContext);
    if (!ctx) return null;

    // Chu cai dau cho avatar - o vuong bo goc mau xanh, giong mockup.
    const initials = (name: string) => name.split(' ').filter(Boolean)
        .map((word) => word[0]).join('').slice(0, 2).toUpperCase() || '?';

    const isLocked = readOnly || ctx.readOnly;

    return (
        <div className="min-w-0 overflow-hidden rounded-xl border bg-card p-4 shadow-xs transition-all border-border/70">
            <div className="mb-3 pb-2 border-b border-border/60 flex min-w-0 items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Users className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 break-words text-base font-bold tracking-tight text-foreground">
                        Team Members
                    </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {!isLocked && (
                        <button
                            type="button"
                            onClick={() => ctx.addEmpty()}
                            disabled={ctx.saving}
                            className="rounded-md border border-input bg-card px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/60 disabled:opacity-50 cursor-pointer"
                        >
                            Add
                        </button>
                    )}
                </div>
            </div>

            <div className="max-w-full overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            {['', 'Partner', 'Partner Role', 'E-Mail Address', 'Telephone number', ''].map((label, index) => (
                                <th key={index} className="border-b px-2.5 py-2 text-left text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {ctx.rows.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-2.5 py-5 text-center text-sm text-muted-foreground">
                                    No team members assigned yet.
                                </td>
                            </tr>
                        ) : ctx.rows.map((row) => {
                            const partner = ctx.lookup(row.partnerId);
                            return (
                                <tr key={row.key} className={cn(isLocked && 'opacity-90')}>
                                    <td className="border-b px-2.5 py-2 align-middle">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-[#0a6ed1] text-xs font-bold text-white">
                                            {partner ? initials(partner.partnerName) : '?'}
                                        </div>
                                    </td>
                                    <td className="border-b px-2.5 py-2 align-middle">
                                        <Select
                                            disabled={isLocked}
                                            value={row.partnerId ? row.partnerId.replace(/^BP-/i, '') : UNASSIGNED}
                                            onValueChange={(value) => ctx.patch(row.key, {
                                                partnerId: value === UNASSIGNED ? '' : value.replace(/^BP-/i, ''),
                                            })}
                                        >
                                            <SelectTrigger className={cn('h-9 max-w-[240px] text-sm', isLocked && 'cursor-not-allowed opacity-75 bg-muted/40')}>
                                                <SelectValue placeholder="— select partner —" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={UNASSIGNED}>— select partner —</SelectItem>
                                                {ctx.directory.map((entry) => {
                                                    const cleanId = entry.partnerId.replace(/^BP-/i, '');
                                                    return (
                                                        <SelectItem key={entry.partnerId} value={cleanId} className="text-sm">
                                                            {cleanId} — {entry.partnerName}
                                                            {entry.functionTitle ? ` (${entry.functionTitle})` : ''}
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="border-b px-2.5 py-2 align-middle">
                                        <Select
                                            disabled={isLocked}
                                            value={row.partnerRole}
                                            onValueChange={(value) => ctx.patch(row.key, { partnerRole: value })}
                                        >
                                            <SelectTrigger className={cn('h-9 max-w-[210px] text-sm', isLocked && 'cursor-not-allowed opacity-75 bg-muted/40')}><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {PARTNER_ROLES.map((role) => (
                                                    <SelectItem key={role} value={role} className="text-sm">{role}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="border-b px-2.5 py-2 align-middle text-sm text-muted-foreground">
                                        {partner?.email || '—'}
                                    </td>
                                    <td className="border-b px-2.5 py-2 align-middle text-sm text-muted-foreground">
                                        {partner?.phone || '—'}
                                    </td>
                                    <td className="border-b px-2.5 py-2 text-right align-middle">
                                        {!isLocked && (
                                            <button
                                                type="button"
                                                onClick={() => ctx.remove(row.key)}
                                                className="rounded-md px-2.5 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-muted/60 cursor-pointer"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {ctx.saveError && (
                <p className="flex items-start gap-1.5 text-sm text-destructive">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Could not save: {ctx.saveError}
                </p>
            )}
            <p className={cn('border-t pt-3 text-sm leading-relaxed', ctx.dirty ? 'text-warning' : 'text-muted-foreground')}>
                {ctx.dirty
                    ? 'Unsaved changes — click Save to store this team on the report.'
                    : ctx.savedLabel
                        ? `Team saved to the report (${ctx.savedLabel}). It will still be here after a reload.`
                        : 'Partner and role are assigned manually, matching the Business Partner (BP) assignment in the Resolve Internal Problems app. E-mail and telephone are queried automatically from the BP master record — never typed by hand.'}
            </p>
            {ctx.directoryError && (
                <p className="flex items-start gap-1.5 text-sm text-warning">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Partner directory could not be loaded ({ctx.directoryError}) — only people already on this case are selectable.
                </p>
            )}
        </div>
    );
}
