import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Spinner } from '@cnma/react-ui';
import { Check, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { eightDService, type Report8D } from '@/services/eightd-service';
import { ValueHelpInput } from '@/components/ui/ValueHelpInput';
import { useValueHelp } from '@/hooks/use-value-help';
import { VALUE_HELP_IDS } from '@/services/value-help-service';

/**
 * Hạn hoàn tất và người điều phối của một case — SỬA ĐƯỢC.
 *
 * ── Vì sao hai trường này phải sửa được, còn phần còn lại của thẻ thì không ──
 * Mọi ô khác trong thẻ tổng quan là DỮ KIỆN: vật tư, lô, mã lỗi, ngày phát hiện.
 * Sửa chúng ở đây là để bản ghi lỗi và báo cáo 8D nói hai điều khác nhau.
 *
 * Hai ô này thì ngược lại — chúng là CAM KẾT của con người, và cam kết thì thay
 * đổi. Chúng được nhập ở popup mở 8D, tức trong vài giây trước khi phân tích chạy,
 * đúng lúc người ta biết ít nhất về case. Một hạn chỉ đặt được ở khoảnh khắc đó là
 * một hạn không dùng được: hạn trượt, điều phối viên nghỉ, và tuần sau không ai
 * sửa nổi.
 *
 * ── Vì sao có nhịp "bấm bút chì rồi mới sửa" ──
 * Hạn của case là thứ tô đỏ cả một dòng ở danh sách công việc. Một ô ngày luôn mở
 * ngay giữa thẻ tổng quan là một ô sẽ bị đổi do vô ý — và không có gì báo, vì đổi
 * ngày là một thao tác hợp lệ.
 */

const DUE_DESCRIPTION_CUSTOMER = 'Customer response commitment on this complaint.';
const DUE_DESCRIPTION_INTERNAL = 'Internal defects carry no SLA. Set a date only if the team commits to one.';

export function CaseCommitments({
    report,
    customerFacing,
}: {
    report: Report8D;
    customerFacing: boolean;
}) {
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState(false);
    const [dueDate, setDueDate] = useState(report.slaResponseDue ?? '');
    const [coordinator, setCoordinator] = useState(report.coordinator ?? '');

    // Chỉ nạp danh mục đối tác khi người dùng thật sự bắt đầu sửa. Trang chi tiết
    // đã nặng sẵn; một lượt gọi cho ô mà đa số lần xem không ai chạm tới là lượt
    // gọi thừa.
    const partnerVh = useValueHelp(VALUE_HELP_IDS.partner, { enabled: editing });

    // Poll 3 giây làm `report` đổi tham chiếu liên tục. Chỉ đồng bộ lại state khi
    // KHÔNG sửa — nếu không thì mỗi nhịp poll sẽ xoá chữ người dùng đang gõ.
    useEffect(() => {
        if (editing) return;
        setDueDate(report.slaResponseDue ?? '');
        setCoordinator(report.coordinator ?? '');
    }, [editing, report.slaResponseDue, report.coordinator]);

    const save = useMutation({
        mutationFn: () => eightDService.setCaseCommitments(report.ID, { dueDate, coordinator }),
        onSuccess: () => {
            setEditing(false);
            toast.success('Case commitments updated');
            queryClient.invalidateQueries({ queryKey: ['8d'] });
        },
        onError: (e: any) => {
            toast.error(
                e?.response?.data?.error?.message ?? e?.message ?? 'Could not save the commitments.',
            );
        },
    });

    const dueHint = customerFacing ? DUE_DESCRIPTION_CUSTOMER : DUE_DESCRIPTION_INTERNAL;

    if (!editing) {
        return (
            <>
                <div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            Due date
                        </span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Edit due date and coordinator"
                            title="Edit due date and coordinator"
                            onClick={() => setEditing(true)}
                            className="h-5 w-5 text-muted-foreground hover:text-foreground"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <div className="mt-0.5 text-sm font-medium">{report.slaResponseDue ?? '—'}</div>
                    <div className="text-sm leading-relaxed text-muted-foreground">{dueHint}</div>
                </div>

                <div>
                    <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Coordinator
                    </div>
                    <div className="mt-0.5 text-sm font-medium">{report.coordinator ?? '—'}</div>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="min-w-0">
                <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Due date</div>
                <Input
                    type="date"
                    value={dueDate}
                    disabled={save.isPending}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mt-1 h-9 text-sm"
                />
                {/* Ô trống ở đây nghĩa là XOÁ hạn, không phải "giữ nguyên" — nói ra
                    vì hai nghĩa đó khác nhau và người dùng không đoán được. */}
                <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Clear the field to remove the date.
                </div>
            </div>

            <div className="min-w-0">
                <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Coordinator</div>
                <div className="mt-1">
                    <ValueHelpInput
                        value={coordinator}
                        onChange={setCoordinator}
                        // Ô giữ TÊN, `entry.key` là mã đối tác — xem chú thích cùng
                        // nội dung ở `analyze-dialog.tsx`.
                        onPick={(entry) => setCoordinator(String(entry.partnerName ?? entry.text ?? entry.key ?? '').trim())}
                        entries={partnerVh.entries}
                        loading={partnerVh.loading}
                        quiet
                        placeholder="e.g. Minh Dinh"
                    />
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                    <Button
                        type="button"
                        size="sm"
                        disabled={save.isPending}
                        onClick={() => save.mutate()}
                        className="h-8 px-2.5 text-sm font-medium"
                    >
                        {save.isPending ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                        Save
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={save.isPending}
                        onClick={() => {
                            setDueDate(report.slaResponseDue ?? '');
                            setCoordinator(report.coordinator ?? '');
                            setEditing(false);
                        }}
                        className="h-8 px-2.5 text-sm font-medium"
                    >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                    </Button>
                </div>
            </div>
        </>
    );
}

export default CaseCommitments;
