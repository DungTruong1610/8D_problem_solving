import type { ReactNode } from 'react';
import { cn } from '@cnma/react-ui';
import { Award, CheckCircle2, Coins, Crosshair, TriangleAlert, Users } from 'lucide-react';
import type { Discipline8D } from '@/services/eightd-service';
import { Markdown } from './markdown';

/**
 * D8 — tóm tắt đóng case trên một màn hình.
 *
 * Thay cho lưới field chung của Form Editor (mỗi field một hộp, độ cao lệch
 * nhau, ô COPQ đứng một mình nửa trống): ba con số nhìn lướt, hai bài học đặt
 * cạnh nhau để so, và phần ghi nhận đội kèm đúng những người đã ngồi trong đội.
 * Nội dung vẫn là chữ AI soạn trong `resultJson` — bố cục mới không viết thêm gì.
 */

interface RosterRow {
    partnerId?: string;
    partnerName?: string;
    functionTitle?: string;
    partnerRole?: string;
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function parse(value: unknown): Record<string, any> | null {
    if (!value) return null;
    if (typeof value === 'object') return value as Record<string, any>;
    try {
        const parsed = JSON.parse(String(value));
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function formatEur(value: unknown): string | null {
    const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d.-]/g, ''));
    if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return null;
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

function StatTile({ icon, label, value, empty }: { icon: ReactNode; label: string; value: string | null; empty: string }) {
    return (
        <div className="flex min-w-0 items-start gap-3 rounded-xl border bg-card p-4 shadow-xs">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
            <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                {value
                    ? <p className="mt-0.5 line-clamp-2 break-words text-sm font-semibold text-foreground" title={value}>{value}</p>
                    : <p className="mt-0.5 text-sm italic text-muted-foreground">{empty}</p>}
            </div>
        </div>
    );
}

function LessonCard({ tone, title, body }: { tone: 'good' | 'bad'; title: string; body: string | null }) {
    const good = tone === 'good';
    return (
        <div className={cn('flex min-w-0 flex-col rounded-xl border bg-card p-4 shadow-xs border-t-2', good ? 'border-t-success' : 'border-t-warning')}>
            <div className="mb-2 flex items-center gap-2">
                {good
                    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    : <TriangleAlert className="h-4 w-4 shrink-0 text-warning" />}
                <h4 className="text-sm font-semibold text-foreground">{title}</h4>
            </div>
            {body
                ? <div className="text-sm leading-relaxed text-foreground/90"><Markdown>{body}</Markdown></div>
                : <p className="text-sm italic text-muted-foreground">Not provided</p>}
        </div>
    );
}

export function ClosureSummaryWidget({
    data,
    context,
    siblings,
    rootCause,
}: {
    data: Record<string, unknown>;
    context: Record<string, unknown> | null;
    siblings: Discipline8D[];
    /** Kết luận nguyên nhân gốc đã chốt ở D4 (`resolveD4RootCause`). */
    rootCause: string;
}) {
    const closure = (data.closure ?? {}) as Record<string, unknown>;
    const copq = formatEur(closure.costOfPoorQuality) ?? formatEur(context?.copqEur);

    const d1 = siblings.find((d) => d.code === 'D1');
    const roster: RosterRow[] = (() => {
        const list = parse(d1?.resultJson)?.team?.assignedRoster;
        return Array.isArray(list) ? list.filter((r) => text(r?.partnerName) || text(r?.partnerId)) : [];
    })();
    const leader = roster.find((r) => /leader/i.test(String(r.partnerRole ?? '')));
    const teamValue = roster.length
        ? `${roster.length} member${roster.length === 1 ? '' : 's'}${leader?.partnerName ? ` · led by ${leader.partnerName}` : ''}`
        : null;

    const recognition = text(closure.teamRecognition);

    return (
        <div className="min-w-0 space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <StatTile icon={<Coins className="size-[18px]" />} label="Cost of poor quality" value={copq} empty="Not recorded" />
                <StatTile icon={<Crosshair className="size-[18px]" />} label="Root cause" value={rootCause && rootCause !== '-' ? rootCause : null} empty="Not concluded in D4" />
                <StatTile icon={<Users className="size-[18px]" />} label="8D team" value={teamValue} empty="No team saved in D1" />
            </div>

            <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lessons learned</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <LessonCard tone="good" title="What worked" body={text(closure.lessonsWhatWorked)} />
                    <LessonCard tone="bad" title="What did not" body={text(closure.lessonsWhatDidNot)} />
                </div>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-xs">
                <div className="mb-2 flex items-center gap-2">
                    <Award className="h-4 w-4 shrink-0 text-primary" />
                    <h4 className="text-sm font-semibold text-foreground">Team recognition</h4>
                </div>
                {recognition
                    ? <div className="text-sm leading-relaxed text-foreground/90"><Markdown>{recognition}</Markdown></div>
                    : <p className="text-sm italic text-muted-foreground">Not provided</p>}
                {roster.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                        {roster.map((r) => {
                            const name = text(r.partnerName) ?? String(r.partnerId);
                            return (
                                <li key={`${r.partnerId}-${name}`} className="flex items-center gap-2 rounded-full border bg-muted/30 py-1 pl-1 pr-3">
                                    <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                                        {initials(name)}
                                    </span>
                                    <span className="text-sm text-foreground">{name}</span>
                                    {r.partnerRole && <span className="text-xs text-muted-foreground">{/leader/i.test(r.partnerRole) ? 'Leader' : 'Member'}</span>}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
