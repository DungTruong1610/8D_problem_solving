import { useEffect, useState } from 'react';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Textarea,
} from '@cnma/react-ui';

/** Giới hạn của cột `note` trong `ReviewEvents` — backend chặn cùng con số. */
export const REASON_MAX = 500;

/**
 * Hộp thoại bắt buộc nhập lý do trước một quyết định của người.
 *
 * Dùng cho Trả về sửa, Mở lại một bước đã duyệt, và Gỡ một lần AI dừng. Nút xác
 * nhận chỉ bật khi đã có chữ — backend cũng chặn ghi chú rỗng, ở đây chỉ để
 * người dùng không phải bấm rồi mới biết.
 */
export function ReasonDialog({
    open,
    onOpenChange,
    title,
    description,
    placeholder,
    confirmLabel,
    busy,
    onConfirm,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    placeholder: string;
    confirmLabel: string;
    busy?: boolean;
    onConfirm: (reason: string) => void;
}) {
    const [reason, setReason] = useState('');

    // Mỗi lần mở là một quyết định mới — không mang chữ của lần trước sang.
    useEffect(() => {
        if (open) setReason('');
    }, [open]);

    const trimmed = reason.trim();
    const tooLong = trimmed.length > REASON_MAX;

    return (
        <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="space-y-1.5">
                    <Textarea
                        autoFocus
                        rows={5}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={placeholder}
                        aria-label="Reason"
                    />
                    <p className={tooLong ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                        {tooLong
                            ? `${trimmed.length} / ${REASON_MAX} characters — please shorten it.`
                            : 'Required. This reason is stored in the audit log.'}
                    </p>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={() => onConfirm(trimmed)} disabled={busy || !trimmed || tooLong}>
                        {busy ? 'Saving…' : confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
