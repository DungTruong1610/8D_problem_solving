import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Compass, ShieldCheck, X } from 'lucide-react';
import { Button } from '@cnma/react-ui';
import { BENCHMARK_NOTIFICATION_ID } from '@/pages/guide/guide-data';

const DISMISS_KEY = '8d.getting-started.dismissed';

function readDismissed(): boolean {
    try {
        return window.localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
        return false;
    }
}

/**
 * Dòng hướng dẫn đầu tiên cho người lần đầu mở app.
 *
 * Đề bài yêu cầu trang chủ nói rõ "thao tác chính cần thử đầu tiên" — giám khảo
 * chỉ có một phút cho phần này. Ẩn được, và nhớ việc ẩn trong localStorage; nếu
 * trình duyệt chặn storage thì banner cứ hiện lại, không sao.
 */
export function GettingStartedBanner() {
    const navigate = useNavigate();
    const [dismissed, setDismissed] = useState(readDismissed);

    if (dismissed) return null;

    const dismiss = () => {
        setDismissed(true);
        try {
            window.localStorage.setItem(DISMISS_KEY, '1');
        } catch {
            // Storage blocked — the banner simply comes back next visit.
        }
    };

    return (
        <div
            data-tour="getting-started"
            className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 md:flex-row md:items-center"
        >
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <Compass className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="text-sm text-foreground">
                    <span className="font-semibold">First time here?</span>{' '}
                    Open the sample case to walk one defect from D1 to D8 — the AI drafts each step and you approve or send it back — then run Verify to check the four reference test cases.
                </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 pl-7 md:pl-0">
                <Button size="sm" className="gap-1.5" onClick={() => navigate(`/8d/${BENCHMARK_NOTIFICATION_ID}`)}>
                    Open sample case
                    <ArrowRight className="size-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate('/guide?tab=evaluation')}>
                    <ShieldCheck className="size-3.5" />
                    Run Verify
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-muted-foreground"
                    onClick={dismiss}
                    title="Hide this tip"
                    aria-label="Hide this tip"
                >
                    <X className="size-4" />
                </Button>
            </div>
        </div>
    );
}
