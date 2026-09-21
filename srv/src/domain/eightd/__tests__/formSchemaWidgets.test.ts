/**
 * Khoá đường nối giữa schema mặc định, renderer và Form Editor.
 *
 * ── Vì sao bộ test này tồn tại ──
 * Một widget phải có mặt ở BA chỗ mới thật sự dùng được:
 *   1. khai trong form schema của bước (defaults.ts)
 *   2. có nhánh render trong schema-discipline-card.tsx
 *   3. có trong danh sách chọn của LayoutConfigPanel.tsx
 *
 * Thiếu (2) thì ô hiện ra trống. Thiếu (3) thì nó chạy đúng nhưng admin không
 * chọn được — "cấu hình được ở Form Editor" thành lời nói suông. Cả hai kiểu
 * hỏng đều IM LẶNG, nên phải có test bắt.
 *
 * Test đọc thẳng file frontend dưới dạng văn bản. Xấu, nhưng đó là cách duy nhất
 * kiểm được ràng buộc xuyên hai gói mà không phải dựng thêm hạ tầng test cho FE.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_STEP_PROMPTS } from '../precedent/defaults';

const UI = join(__dirname, '../../../../../app/8D_hackathon_ui/src');
const renderer = readFileSync(join(UI, 'pages/eight-d/schema-discipline-card.tsx'), 'utf8');
const editor = readFileSync(join(UI, 'pages/ai-settings/step-prompt-editor/layout/LayoutConfigPanel.tsx'), 'utf8');

/** Widget do renderer xử lý bằng nhánh riêng, hoặc bằng đường mặc định theo kiểu dữ liệu. */
const RENDERED_BY_FALLBACK = new Set([
    // Không có nhánh `field.widget === ...`; renderer suy ra từ chính giá trị
    // (mảng chuỗi -> chip, mảng object -> bảng, boolean -> badge...).
    'text', 'input', 'select', 'comboBox', 'searchHelp', 'multiSelect',
    'date-picker', 'checkbox', 'tag-selector', 'table',
    'positive-list', 'negative-list',
]);

function widgetsInDefaults(): { step: string; key: string; widget: string }[] {
    const out: { step: string; key: string; widget: string }[] = [];
    for (const step of DEFAULT_STEP_PROMPTS) {
        if (!step.formSchemaJson) continue;
        const schema = JSON.parse(step.formSchemaJson) as { fields?: { key: string; widget: string }[] };
        for (const f of schema.fields ?? []) out.push({ step: step.stepCode, key: f.key, widget: f.widget });
    }
    return out;
}

describe('widget dùng trong schema mặc định', () => {
    const used = widgetsInDefaults();

    it('có field để kiểm — nếu rỗng thì test này vô nghĩa', () => {
        expect(used.length).toBeGreaterThan(20);
    });

    it('mỗi widget đều chọn được trên Form Editor', () => {
        const missing = [...new Set(used.map((u) => u.widget))]
            .filter((w) => !editor.includes(`'${w}'`));
        expect(missing).toEqual([]);
    });

    it('mỗi widget đều có đường render', () => {
        const missing = [...new Set(used.map((u) => u.widget))]
            .filter((w) => !RENDERED_BY_FALLBACK.has(w) && !renderer.includes(`'${w}'`));
        expect(missing).toEqual([]);
    });

    it('layout group không trỏ tới field không tồn tại', () => {
        // Group trỏ trượt thì cả cụm biến mất khỏi màn hình mà không báo gì.
        for (const step of DEFAULT_STEP_PROMPTS) {
            if (!step.formSchemaJson) continue;
            const schema = JSON.parse(step.formSchemaJson) as {
                fields?: { key: string }[];
                groups?: { id: string; fieldKeys?: string[] }[];
            };
            const keys = new Set((schema.fields ?? []).map((f) => f.key));
            for (const group of schema.groups ?? []) {
                const orphans = (group.fieldKeys ?? []).filter((k) => !keys.has(k));
                expect({ step: step.stepCode, group: group.id, orphans }).toEqual({
                    step: step.stepCode, group: group.id, orphans: [],
                });
            }
        }
    });
});

describe('widget đặc trưng của D2/D3/D4 phải đúng loại', () => {
    const byStepKey = new Map(widgetsInDefaults().map((u) => [`${u.step}:${u.key}`, u.widget]));

    it.each([
        ['D1:team.suggestionStatus', 'callout'],
        ['D2:problem.what', 'w2h-cell'],
        ['D2:problem.extent', 'w2h-cell'],
        ['D2:problem.is', 'is-box'],
        ['D2:problem.isNot', 'isnot-box'],
        ['D2:problem.isIsNotStatus', 'callout'],
        // `table` làm mọi dòng như nhau, đúng thứ hai bước này KHÔNG được phép.
        ['D3:containment.actions', 'action-cards'],
        ['D4:rootCause.fiveWhy', 'why-chain'],
        ['D4:rootCause.ishikawaBoard', 'ishikawa-grid'],
        ['D5:corrective.actions', 'action-cards'],
        ['D7:preventive.actions', 'action-cards'],
        ['D7:preventive.fmea', 'fmea-link'],
        ['D8:closure.gate', 'closure-gate'],
    ])('%s dùng %s', (stepKey, widget) => {
        expect(byStepKey.get(stepKey)).toBe(widget);
    });
});

describe('cả 8 bước đều có schema cấu hình được', () => {
    it('không bước nào còn thiếu formSchema', () => {
        // Bước thiếu formSchema roi ve bang card markdown, va Form Editor khong
        // co gi de cau hinh — dung tinh trang cua D5-D8 truoc thay doi nay.
        const missing = DEFAULT_STEP_PROMPTS
            .filter((s) => !s.formSchemaJson)
            .map((s) => s.stepCode);
        expect(missing).toEqual([]);
    });

    it('mỗi bước có ít nhất một nhóm layout và một field', () => {
        for (const step of DEFAULT_STEP_PROMPTS) {
            const schema = JSON.parse(step.formSchemaJson ?? '{}');
            expect({ step: step.stepCode, fields: (schema.fields ?? []).length > 0, groups: (schema.groups ?? []).length > 0 })
                .toEqual({ step: step.stepCode, fields: true, groups: true });
        }
    });

    it('mỗi bước đều trích dẫn được nguồn', () => {
        // `sources` la co che chong bia. Bo sot o mot buoc nghia la buoc do khong
        // phai chung minh gi ca.
        for (const step of DEFAULT_STEP_PROMPTS) {
            const schema = JSON.parse(step.formSchemaJson ?? '{}');
            const keys = (schema.fields ?? []).map((f: any) => f.key);
            expect({ step: step.stepCode, hasSources: keys.includes('sources') })
                .toEqual({ step: step.stepCode, hasSources: true });
        }
    });
});
