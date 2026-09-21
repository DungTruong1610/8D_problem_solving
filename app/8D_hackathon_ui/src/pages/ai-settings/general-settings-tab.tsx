import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@cnma/react-ui';
import { AiModelSelection, AiAgentConfigJson } from '@cnma/sap-aicore-integrate/react';
import { aiModelApi, getGlobalAiConfig, updateGlobalAiConfig } from '@/services/ai-model-service';

/**
 * Tab "General Settings" — chọn model cho từng bước xử lý.
 *
 * Hai component của CDK bên dưới đều điều khiển bằng react-hook-form: chúng đọc
 * và ghi field `aiAgentConfig` qua `useFormContext`. Vì vậy trang phải bọc chúng
 * trong `FormProvider`, và tự lo việc nạp / lưu.
 *
 *   AiModelSelection  — mỗi activity đã đăng ký một dòng chọn model
 *   AiAgentConfigJson — chỉnh trực tiếp JSON, cho khoá mà form chưa có ô riêng
 *
 * Danh sách activity lấy từ registry của CDK, đăng ký ở src/config/ai-registry.ts.
 */

interface AiConfigForm {
    aiAgentConfig: string;
}

/** Cấu hình rỗng: chỉ đặt model mặc định, chưa ghi đè activity nào. */
const EMPTY_CONFIG = JSON.stringify({ model: 'gemini-2.5-pro' }, null, 2);

export function GeneralSettingsTab() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const form = useForm<AiConfigForm>({ defaultValues: { aiAgentConfig: EMPTY_CONFIG } });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const raw = await getGlobalAiConfig();
                if (cancelled) return;
                // Server trả '{}' khi chưa có gì — hiện mặc định để admin thấy
                // model nào đang chạy, thay vì một object rỗng chẳng nói gì.
                const pretty =
                    raw && raw !== '{}' ? JSON.stringify(JSON.parse(raw), null, 2) : EMPTY_CONFIG;
                form.reset({ aiAgentConfig: pretty });
            } catch (e: any) {
                if (!cancelled) toast.error(`Could not load configuration: ${e.message}`);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
        // form.reset ổn định giữa các lần render — cố ý chỉ chạy một lần.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onSubmit = async (values: AiConfigForm) => {
        setSaving(true);
        try {
            const saved = await updateGlobalAiConfig(values.aiAgentConfig);
            form.reset({ aiAgentConfig: JSON.stringify(JSON.parse(saved), null, 2) });
            toast.success('AI configuration saved');
        } catch (e: any) {
            // Server từ chối JSON hỏng bằng 400 — hiện đúng thông báo của nó.
            const message = e?.response?.data?.error?.message ?? e.message;
            toast.error(`Save failed: ${message}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
                Loading configuration…
            </div>
        );
    }

    return (
        <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="w-full min-w-0 space-y-4">
                <Card className="p-1">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold">Model per processing step</CardTitle>
                        <CardDescription className="text-sm">
                            Each step can run on a different model. Leave a step empty to inherit
                            the default on the first row. With nothing configured, everything runs
                            on <span className="font-mono">gemini-2.5-pro</span>.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <AiModelSelection api={aiModelApi} />
                    </CardContent>
                </Card>

                <Card className="p-1">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold">Raw configuration (JSON)</CardTitle>
                        <CardDescription className="text-sm">
                            For keys that have no dedicated field above — for example{' '}
                            <span className="font-mono">maxIterations</span> or{' '}
                            <span className="font-mono">&lt;activity&gt;ThinkingBudget</span>.
                            Editing here and editing above change the same data.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <AiAgentConfigJson rows={6} />
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-2 pt-1">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => form.reset()}
                        className="h-9 text-sm"
                    >
                        Discard
                    </Button>
                    <Button type="submit" size="sm" disabled={saving} className="h-9 text-sm font-semibold">
                        {saving ? 'Saving…' : 'Save configuration'}
                    </Button>
                </div>
            </form>
        </FormProvider>
    );
}
