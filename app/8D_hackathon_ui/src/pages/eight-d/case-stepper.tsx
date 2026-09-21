import { Check, Loader2 } from 'lucide-react';
import { cn } from '@cnma/react-ui';
import { reviewStatusOf, type Discipline8D } from '@/services/eightd-service';
import { blockedBy, stepProgress, type StepCode } from '../../../../../shared/step-status';

/**
 * Cột trái: tiến độ tám bước và điều hướng giữa chúng.
 * Hiển thị toàn bộ 8D steps D1..D8 từ đầu và cập nhật trạng thái thời gian thực.
 */
const STEP_CODES = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'] as const;

const STEP_LABELS: Record<string, string> = {
    D1: 'Team',
    D2: 'Problem',
    D3: 'Containment',
    D4: 'Root Cause',
    D5: 'Corrective',
    D6: 'Implement',
    D7: 'Preventive',
    // "Team Recognition", không phải "Closure": SAP và trang /workflow đều gọi
    // bước này như vậy, và D8 trong phương pháp 8D là ghi nhận công của nhóm chứ
    // không phải đóng hồ sơ. Trùng chữ "Team" với D1 là chấp nhận được — số bước
    // và mã đứng ngay trước nhãn nên không ai đọc nhầm hai bước này với nhau.
    D8: 'Team Recognition',
};

export function CaseStepper({
    disciplines,
    active,
    onSelect,
    isAnalyzing = false,
}: {
    disciplines: Discipline8D[];
    active: string;
    onSelect: (code: string) => void;
    isAnalyzing?: boolean;
}) {
    const total = 8;
    const approved = disciplines.filter((d) => reviewStatusOf(d) === 'Approved').length;
    const pct = (approved / total) * 100;
    const byCode = new Map(disciplines.map((d) => [d.code, d]));
    const completedCodes = new Set(disciplines.map((d) => d.code));

    return (
        <div className="min-w-0">
            <div className="px-3 pb-3">
                <div className="text-base font-semibold text-foreground">Completeness</div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-border">
                    <div
                        className={cn(
                            'h-full rounded-full transition-all',
                            approved === total ? 'bg-success' : 'bg-primary',
                        )}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <div className="mt-1 text-sm tabular-nums text-muted-foreground">
                    {approved}/{total} steps complete
                </div>
            </div>

            <nav className="min-w-0">
                {STEP_CODES.map((code, index) => {
                    const discipline = byCode.get(code);
                    const isActive = code === active;

                    let statusText = 'Pending';
                    let done = false;
                    let isCurrentAnalyzing = false;

                    if (discipline) {
                        const revStatus = reviewStatusOf(discipline);
                        done = revStatus === 'Approved';
                        if (done) {
                            statusText = 'Complete';
                        } else if (revStatus === 'ChangeRequested') {
                            statusText = 'Changes requested';
                        } else {
                            statusText = discipline.workState === 'InProgress' ? 'In process' : 'Not started';
                        }
                    } else if (isAnalyzing) {
                        // Backend sinh theo ĐỢT song song, nên bước về đích không
                        // theo thứ tự D1..D8 và không phải bước nào chưa có dữ
                        // liệu cũng đang chạy. Suy trạng thái từ chính đồ thị phụ
                        // thuộc: bước đã đủ tiền đề mới là đang sinh, còn lại là
                        // đang chờ — và nói rõ chờ ai.
                        const progress = stepProgress(code as StepCode, completedCodes, true);
                        isCurrentAnalyzing = progress === 'generating';
                        statusText = isCurrentAnalyzing
                            ? 'Generating...'
                            : `Waiting for ${blockedBy(code as StepCode, completedCodes).join(', ')}`;
                    }

                    return (
                        <button
                            key={code}
                            type="button"
                            onClick={() => onSelect(code)}
                            className={cn(
                                'flex w-full min-w-0 items-start gap-2.5 px-3 py-2.5 text-left transition-colors',
                                isActive
                                    ? 'border-l-2 border-l-primary bg-primary/[0.06]'
                                    : 'border-l-2 border-l-transparent hover:bg-muted/60',
                            )}
                        >
                            <span
                                className={cn(
                                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                                    done && 'bg-success text-white',
                                    !done && discipline && reviewStatusOf(discipline) === 'ChangeRequested' && 'bg-warning text-white',
                                    !done && discipline && reviewStatusOf(discipline) === 'Draft' && discipline.workState === 'InProgress' && 'border border-primary text-primary bg-primary/10',
                                    !done && discipline && reviewStatusOf(discipline) === 'Draft' && discipline.workState !== 'InProgress' && 'border border-border text-muted-foreground',
                                    !discipline && isCurrentAnalyzing && 'border border-info text-info bg-info/10',
                                    !discipline && !isCurrentAnalyzing && 'border border-border/50 text-muted-foreground/50',
                                )}
                            >
                                {done ? (
                                    <Check className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                                ) : isCurrentAnalyzing ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    index + 1
                                )}
                            </span>

                            <span className="min-w-0">
                                <span
                                    className={cn(
                                        'block truncate text-sm',
                                        isActive ? 'font-semibold text-foreground' : 'font-medium',
                                        !discipline && !isCurrentAnalyzing && 'text-muted-foreground/70',
                                    )}
                                >
                                    {code} · {STEP_LABELS[code]}
                                </span>
                                <span
                                    className={cn(
                                        'block text-sm',
                                        done ? 'text-success'
                                            : discipline && reviewStatusOf(discipline) === 'ChangeRequested' ? 'text-warning'
                                                : discipline && discipline.workState === 'InProgress' ? 'text-primary font-medium'
                                                    : isCurrentAnalyzing ? 'text-info font-medium'
                                                        : 'text-muted-foreground',
                                    )}
                                >
                                    {statusText}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
