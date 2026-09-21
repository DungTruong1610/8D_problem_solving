import { useMemo } from 'react';
import { cn } from '@cnma/react-ui';
import { AlertCircle, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { reviewStatusOf, type Discipline8D } from '@/services/eightd-service';

/**
 * Kiểm tra tính đầy đủ và nhất quán TRƯỚC KHI phát hành.
 *
 * ── Vì sao cần, khi mỗi bước đã có huy hiệu validation riêng ──
 * Huy hiệu đó chỉ nhìn thấy được khi người dùng MỞ đúng bước ấy. Muốn biết cả
 * báo cáo còn vướng gì, họ phải bấm qua tám bước và tự cộng trong đầu — mà đó
 * đúng là câu hỏi duy nhất cần trả lời ngay trước lúc đóng case.
 *
 * Luật thì đã có sẵn: `constraintsJson` của từng bước chạy lúc sinh báo cáo và
 * kết quả nằm trong `validationJson`. Bảng này không tính lại gì — nó chỉ mang
 * thứ đã tồn tại ra chỗ người ta cần nhìn.
 *
 * ── Vì sao KHÔNG chặn cứng ──
 * Một kỹ sư duyệt một bước dù còn cảnh báo là một quyết định hợp lệ: họ đọc luật,
 * họ thấy nó không áp dụng cho case này, họ ký. Biến cảnh báo thành rào chắn là
 * bắt họ nói dối để đi tiếp.
 *
 * Nhưng có một trường hợp đáng nêu riêng: bước ĐÃ DUYỆT mà vẫn còn lỗi. Đó là
 * chữ ký đặt lên một thứ mà máy nói là sai — không nhất thiết là nhầm, nhưng là
 * thứ người đọc audit sẽ hỏi đầu tiên.
 */

interface Violation {
    ruleId: string;
    path: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
}

interface ValidationSnapshot {
    violations?: Violation[];
}

interface StepFindings {
    code: string;
    title: string;
    approved: boolean;
    errors: Violation[];
    warnings: Violation[];
}

function parseViolations(raw: string | null): Violation[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as ValidationSnapshot;
        return Array.isArray(parsed?.violations) ? parsed.violations : [];
    } catch {
        // Một cột JSON hỏng không được làm sập bảng kiểm tra — nó chỉ có nghĩa là
        // bước đó không đóng góp phát hiện nào.
        return [];
    }
}

export function ReleaseCheckPanel({
    disciplines,
    onSelectStep,
}: {
    disciplines: Discipline8D[];
    /** Bấm vào một phát hiện thì mở thẳng bước tương ứng. */
    onSelectStep?: (code: string) => void;
}) {
    const findings = useMemo<StepFindings[]>(() => disciplines.map((d) => {
        const violations = parseViolations(d.validationJson);
        return {
            code: d.code,
            title: d.title,
            approved: reviewStatusOf(d) === 'Approved',
            errors: violations.filter((v) => v.severity === 'error'),
            warnings: violations.filter((v) => v.severity === 'warning'),
        };
    }), [disciplines]);

    const withFindings = findings.filter((f) => f.errors.length || f.warnings.length);
    const errorCount = findings.reduce((sum, f) => sum + f.errors.length, 0);
    const warningCount = findings.reduce((sum, f) => sum + f.warnings.length, 0);
    // Chữ ký đặt lên một bước mà máy nói là sai. Nêu riêng vì đây là dòng đầu
    // tiên một cuộc audit sẽ hỏi tới.
    const signedWithErrors = findings.filter((f) => f.approved && f.errors.length > 0);

    // Không có bước nào mang `validationJson` nghĩa là báo cáo chạy trước khi có
    // lớp ràng buộc. Nói thẳng thế, thay vì hiện "đã kiểm tra xong" cho một thứ
    // chưa hề được kiểm.
    const checked = disciplines.some((d) => d.validationJson);
    if (!checked) {
        return (
            <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">No consistency check on this report.</span>{' '}
                    It was generated before the constraint layer existed. Re-analyze to run the rules.
                </p>
            </div>
        );
    }

    if (!withFindings.length) {
        return (
            <div className="flex items-center gap-2.5 rounded-lg border border-success/30 bg-success/[0.04] px-4 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                <p className="text-sm">
                    <span className="font-semibold text-success">Consistency check passed.</span>{' '}
                    <span className="text-muted-foreground">
                        Every rule configured for D1–D8 is satisfied.
                    </span>
                </p>
            </div>
        );
    }

    return (
        <div className={cn(
            'rounded-lg border px-4 py-3',
            errorCount > 0 ? 'border-destructive/30 bg-destructive/[0.03]' : 'border-warning/30 bg-warning/[0.04]',
        )}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {errorCount > 0
                    ? <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                    : <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />}
                <span className="text-base font-semibold">
                    Consistency check — {errorCount} error{errorCount === 1 ? '' : 's'},{' '}
                    {warningCount} warning{warningCount === 1 ? '' : 's'}
                </span>
                <span className="text-sm text-muted-foreground">
                    Rules configured per discipline in the Training Center. These do not block closure —
                    approving a step is a human decision.
                </span>
            </div>

            {signedWithErrors.length > 0 && (
                <p className="mt-2 rounded border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-sm text-destructive">
                    <strong className="font-semibold">
                        {signedWithErrors.map((f) => f.code).join(', ')} approved with unresolved errors.
                    </strong>{' '}
                    A signature was placed on a step the rules flag as wrong — worth a second look before closing.
                </p>
            )}

            <ul className="mt-2.5 space-y-2.5">
                {withFindings.map((step) => (
                    <li key={step.code}>
                        <button
                            type="button"
                            onClick={() => onSelectStep?.(step.code)}
                            className="group flex w-full items-baseline gap-2 text-left cursor-pointer"
                        >
                            <span className="font-mono text-sm font-semibold text-foreground group-hover:underline">
                                {step.code}
                            </span>
                            <span className="truncate text-sm text-muted-foreground">{step.title}</span>
                            {step.approved && (
                                <span className="shrink-0 text-xs font-semibold text-success">approved</span>
                            )}
                        </button>
                        <ul className="mt-1 space-y-1 pl-6">
                            {[...step.errors, ...step.warnings].map((v) => (
                                <li
                                    key={`${step.code}-${v.ruleId}-${v.path}`}
                                    className={cn(
                                        'flex items-start gap-1.5 text-sm leading-snug',
                                        v.severity === 'error' ? 'text-destructive' : 'text-warning',
                                    )}
                                >
                                    {v.severity === 'error'
                                        ? <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                        : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                                    <span>
                                        {v.message}
                                        {v.path && v.path !== 'content' && (
                                            <span className="ml-1 font-mono text-xs text-muted-foreground">
                                                {v.path}
                                            </span>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default ReleaseCheckPanel;
