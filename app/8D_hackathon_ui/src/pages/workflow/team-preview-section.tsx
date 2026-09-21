import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@cnma/react-ui';
import { Users } from 'lucide-react';
import type { RetrievalConfigState } from '@/hooks/use-retrieval-config';

/**
 * Giải thích bước gợi ý nhóm 8D.
 *
 * Không có ô cấu hình nào ở đây có chủ đích: danh sách người là HỆ QUẢ của trọng
 * số ở bước 4 và ngưỡng ở bước 5. Thêm một chỗ chỉnh riêng cho D1 sẽ tạo ra hai
 * định nghĩa "case nào giống nhau", và chúng sẽ lệch nhau.
 */
export function TeamPreviewSection({ cfg }: { cfg: RetrievalConfigState }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    How the team is derived
                </CardTitle>
                <CardDescription>
                    Open any 8D report to see the result — the suggestion appears on the report page,
                    next to the cases it came from.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                <ol className="space-y-2 text-muted-foreground">
                    <li className="flex gap-2">
                        <span className="font-mono text-sm font-semibold text-foreground">1</span>
                        Take the cases that scored at least{' '}
                        <span className="font-mono text-foreground">{cfg.settings?.minScore ?? '—'}</span>{' '}
                        out of <span className="font-mono text-foreground">{cfg.maxScore}</span>.
                    </li>
                    <li className="flex gap-2">
                        <span className="font-mono text-sm font-semibold text-foreground">2</span>
                        Group their teams by function — that gives the roles this kind of defect has
                        needed before.
                    </li>
                    <li className="flex gap-2">
                        <span className="font-mono text-sm font-semibold text-foreground">3</span>
                        Group them by person and rank by how many matching cases each one worked.
                    </li>
                    <li className="flex gap-2">
                        <span className="font-mono text-sm font-semibold text-foreground">4</span>
                        Hand that exact list to the model, which writes the justification and proposes a
                        lead — but may not add a name to it.
                    </li>
                </ol>

                <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                    Nothing to configure here on purpose. The list is a consequence of the weights in
                    step 4 and the threshold in step 5. A second place to tune it would create a second
                    definition of &quot;similar case&quot;, and the two would drift apart.
                </p>
            </CardContent>
        </Card>
    );
}
