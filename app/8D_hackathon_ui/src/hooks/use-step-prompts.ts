import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getStepPrompts, type StepPrompt } from '@/services/retrieval-service';

/**
 * Nạp cấu hình của cả tám discipline một lần.
 *
 * Trang Workflow hiện D1–D4 thành bốn bước riêng. Mỗi bước tự gọi API thì một
 * lần mở trang là bốn lượt gọi cho cùng một bảng — nạp một lần ở trên rồi phát
 * xuống, và số đếm giữa các bước không thể lệch nhau.
 */

export interface StepPromptsState {
    prompts: StepPrompt[];
    byCode: Record<string, StepPrompt>;
    loading: boolean;
    reload: () => Promise<void>;
}

export function useStepPrompts(): StepPromptsState {
    const [prompts, setPrompts] = useState<StepPrompt[]>([]);
    const [loading, setLoading] = useState(true);

    async function reload() {
        const rows = await getStepPrompts();
        setPrompts(rows);
    }

    useEffect(() => {
        reload()
            .catch((e: unknown) => {
                toast.error(
                    `Could not load discipline configuration: ${e instanceof Error ? e.message : 'unknown error'}`,
                );
            })
            .finally(() => setLoading(false));
        // Nạp một lần khi mở trang; sửa cấu hình diễn ra ở trang editor riêng.
    }, []);

    const byCode = Object.fromEntries(prompts.map((p) => [p.stepCode, p]));

    return { prompts, byCode, loading, reload };
}
