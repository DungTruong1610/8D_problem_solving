import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Calendar,
    Input,
    Label,
    Popover,
    PopoverContent,
    PopoverTrigger,
    cn,
} from '@cnma/react-ui';
import {
    CalendarDays,
    ClipboardList,
    Cpu,
    Gauge,
    Leaf,
    Package,
    Sparkles,
    User,
    X,
} from 'lucide-react';
import { classifyTaskCode, taskCodeGroupOf, taskCodeTextOf } from '../../../../../../shared/task-catalogue';
import type { ActionTask } from '../../../../../../shared/action-task';
import { getPartnerDirectory } from '@/services/eightd-service';
import { useValueHelp } from '@/hooks/use-value-help';
import { ValueHelpInput } from '@/components/ui/ValueHelpInput';
import { VALUE_HELP_IDS, type ValueHelpEntry } from '@/services/value-help-service';

/**
 * Ô nhập và chip dùng chung cho bảng task và popup chi tiết task (D3/D5/D6/D7).
 * Tách khỏi `action-table.tsx` để popup sống ở thư mục riêng mà không phải import
 * ngược lại bảng.
 */

/** Task được coi là đã publish nếu cờ published bật hoặc trạng thái không còn là Planned */
export function isTaskPublished(task: ActionTask): boolean {
    if (typeof task.published === 'boolean') return task.published;
    const s = String(task.status || '').trim().toLowerCase();
    return s !== 'planned' && s !== 'not started' && s !== '';
}

/** Ô trống phải nói RÕ là chưa ai điền, không được để trắng như lỗi hiển thị. */
export function Blank({ label }: { label: string }) {
    return <span className="italic text-muted-foreground/70">{label}</span>;
}

/** Ngày ISO hiển thị cho người đọc; chuỗi không phải ngày thì trả về rỗng. */
export function formatDate(iso: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    const parsed = new Date(`${iso}T00:00:00`);
    return Number.isNaN(parsed.getTime())
        ? ''
        : parsed.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Ô chọn ngày với lịch Popover mở lên trên (dropdownPlacement='top'). */
export function DatePickerField({
    id,
    value,
    onChange,
    dropdownPlacement = 'top',
}: {
    id?: string;
    value: string;
    onChange: (val: string) => void;
    dropdownPlacement?: 'top' | 'bottom';
}) {
    const [open, setOpen] = useState(false);

    const selectedDate = useMemo(() => {
        if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
        const d = new Date(`${value}T00:00:00`);
        return Number.isNaN(d.getTime()) ? undefined : d;
    }, [value]);

    const handleSelect = (date: Date | undefined) => {
        if (date) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            onChange(`${y}-${m}-${d}`);
        } else {
            onChange('');
        }
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    id={id}
                    type="button"
                    className="flex h-9 w-full items-center justify-between rounded-md border-2 border-[var(--input-border)] hover:border-[var(--input-border-hover)] focus-visible:border-[var(--color-brand)] outline-none bg-background px-3 py-1.5 text-sm text-foreground text-left transition-[color,box-shadow,border-color] cursor-pointer"
                >
                    <span className={cn('truncate', !value && 'text-muted-foreground')}>
                        {value ? formatDate(value) || value : 'YYYY-MM-DD'}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                        {value && (
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange('');
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.stopPropagation();
                                        onChange('');
                                    }
                                }}
                                className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer"
                                title="Clear date"
                            >
                                <X className="h-3.5 w-3.5" />
                            </span>
                        )}
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent
                side={dropdownPlacement}
                align="start"
                className="w-auto p-2 bg-popover border border-border shadow-md z-50"
            >
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleSelect}
                />
            </PopoverContent>
        </Popover>
    );
}

/** Mã nhiệm vụ ở dạng chip, kèm mô tả trong tooltip để bảng không phải rộng thêm. */
export function TaskCodeChip({ code }: { code: string }) {
    if (!code) return <Blank label="-" />;
    const text = taskCodeTextOf(code);
    return (
        <span
            title={text ? `${code} - ${text}` : code}
            className="inline-flex items-center rounded border border-border/70 bg-muted/50 px-2 py-0.5 font-mono text-sm font-medium text-foreground"
        >
            {code}
        </span>
    );
}

/** Huy hiệu Root Cause lấy từ D4 với màu sắc 6M Ishikawa tương ứng. */
export function RootCauseChip({ category }: { category?: string | null }) {
    const raw = String(category ?? '').trim();
    if (!raw || raw === '-') {
        return <span className="text-muted-foreground font-mono text-sm">-</span>;
    }
    const cat = raw.toLowerCase();
    const isMan = cat === 'man';
    const isMachine = cat === 'machine';
    const isMethod = cat === 'method';
    const isMaterial = cat === 'material';
    const isMeasurement = cat === 'measurement';
    const isEnvironment = cat === 'environment';

    const Icon =
        isMan ? User :
        isMachine ? Cpu :
        isMethod ? ClipboardList :
        isMaterial ? Package :
        isMeasurement ? Gauge :
        isEnvironment ? Leaf : Sparkles;

    const toneClass =
        isMan ? 'border-pink-200 bg-pink-50/70 text-pink-700 dark:border-pink-850 dark:bg-pink-950/40 dark:text-pink-300' :
        isMachine ? 'border-blue-200 bg-blue-50/70 text-blue-700 dark:border-blue-850 dark:bg-blue-950/40 dark:text-blue-300' :
        isMethod ? 'border-amber-200 bg-amber-50/70 text-amber-700 dark:border-amber-850 dark:bg-amber-950/40 dark:text-amber-300' :
        isMaterial ? 'border-orange-200 bg-orange-50/70 text-orange-700 dark:border-orange-850 dark:bg-orange-950/40 dark:text-orange-300' :
        isMeasurement ? 'border-cyan-200 bg-cyan-50/70 text-cyan-700 dark:border-cyan-850 dark:bg-cyan-950/40 dark:text-cyan-300' :
        isEnvironment ? 'border-emerald-200 bg-emerald-50/70 text-emerald-700 dark:border-emerald-850 dark:bg-emerald-950/40 dark:text-emerald-300' :
        'border-primary/20 bg-primary/10 text-primary';

    const displayTitle = raw.charAt(0).toUpperCase() + raw.slice(1);

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-sm font-semibold border font-mono tracking-tight',
                toneClass,
            )}
            title={`Root Cause from D4: ${displayTitle}`}
        >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span>{displayTitle}</span>
        </span>
    );
}

/**
 * Ô chọn mã nhiệm vụ, dùng chung cho form Add và ô Edit.
 *
 * ── Vì sao đi qua `ValueHelpInput` chứ không phải một `Select` đọc thẳng
 * `TASK_CODES` ──
 * Đọc thẳng hằng số thì gọn hơn và không cần mạng. Nhưng danh mục nhiệm vụ là
 * danh mục SAP (catalog type 2) y như danh mục lỗi (type 9) — ngày nối S/4, cả
 * hai phải đổi nguồn bằng cách sửa `sourceType` của MỘT DÒNG trong
 * `ValueHelpList`, không phải bằng cách sửa component. Một trong hai ô đi đường
 * riêng là đúng cái chỗ ngày đó sẽ bị bỏ quên.
 *
 * ── Vì sao KHÔNG `strict` ──
 * Ô mã lỗi khoá cứng vì nó là khoá chấm điểm tiền lệ: sai mã là mất điểm âm
 * thầm. Mã nhiệm vụ thì không chấm điểm — nó phục vụ tra cứu. Chặn lưu một việc
 * chỉ vì bộ luật chưa có mã cho nó là đổi một bản ghi thiếu mã lấy một việc
 * không được giao cho ai. Ô trống nói đúng sự thật: chưa mã hoá được.
 *
 * ── Vì sao nhóm là ô đọc-only ──
 * Cùng lý do với nhóm mã lỗi: một mã chỉ thuộc đúng một nhóm. Cho sửa nhóm là mở
 * đường cho một cặp nhóm/mã không tồn tại trong danh mục.
 */
export function TaskCodeField({
    code,
    onCodeChange,
    suggestedFrom,
    idPrefix,
}: {
    code: string;
    onCodeChange: (code: string) => void;
    /** Tên task đang gõ — dùng để gợi ý mã khi ô còn trống. */
    suggestedFrom: string;
    idPrefix: string;
}) {
    const taskCodeVh = useValueHelp(VALUE_HELP_IDS.taskCode);
    const suggestion = code ? null : classifyTaskCode(suggestedFrom)?.taskCode ?? null;
    // Nhóm suy từ mã bằng đúng hàm mà `normalizeTasks` dùng, nên thứ hiện trên
    // màn hình và thứ được lưu xuống không thể lệch nhau.
    const group = taskCodeGroupOf(code) ?? '';

    return (
        <>
            <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-task-code`} className="text-sm font-semibold text-muted-foreground">
                    Task Code
                </Label>
                <ValueHelpInput
                    id={`${idPrefix}-task-code`}
                    value={code}
                    onChange={onCodeChange}
                    entries={taskCodeVh.entries}
                    loading={taskCodeVh.loading}
                    quiet
                    dropdownPlacement="top"
                    catalogLabel="the task catalogue"
                    placeholder="e.g. TSK-1010"
                    inputClassName="text-sm"
                />
                {suggestion && (
                    <button
                        type="button"
                        onClick={() => onCodeChange(suggestion)}
                        className="flex items-start gap-1 text-left text-sm leading-snug text-primary hover:underline cursor-pointer"
                    >
                        <Sparkles className="mt-px h-3.5 w-3.5 shrink-0" />
                        <span>Suggested from the task name: {suggestion} - {taskCodeTextOf(suggestion)}</span>
                    </button>
                )}
            </div>
            <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-muted-foreground">Code Group</Label>
                <Input
                    value={group}
                    readOnly
                    placeholder="- from Task Code -"
                    className="h-9 text-sm bg-muted/40 font-mono"
                />
            </div>
        </>
    );
}

export function usePartnerValueHelp() {
    const { data: partners = [], isLoading } = useQuery({
        queryKey: ['partnerDirectory'],
        queryFn: getPartnerDirectory,
        staleTime: 5 * 60 * 1000,
    });

    const entries: ValueHelpEntry[] = useMemo(() => {
        return partners.map((p) => {
            const cleanId = p.partnerId.replace(/^BP-/i, '');
            const titlePart = p.functionTitle ? ` (${p.functionTitle})` : '';
            return {
                key: `${cleanId} - ${p.partnerName}${titlePart}`,
                text: p.email || p.functionTitle || '',
                partnerId: cleanId,
                partnerName: p.partnerName,
                functionTitle: p.functionTitle,
            };
        });
    }, [partners]);

    return { entries, loading: isLoading };
}
