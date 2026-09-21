/**
 * Không nút nào trong response schema được phép không có trần.
 *
 * ── Vì sao cần một test đi soi toàn bộ cây ──
 * Đúng lỗi này đã tái diễn ba lần, mỗi lần ở một tầng khác nhau, và lần nào
 * triệu chứng cũng giống hệt: model sinh ĐÚNG BẰNG `max_tokens` rồi chết vì
 * `finishReason=length`.
 *
 *   lần 1  mảng trong `data` không có `maxItems`      → 10 phần tử evidenceGaps
 *   lần 2  `sources`/`actionItems` ở vỏ không có trần → 32.000 token
 *   lần 3  chuỗi BÊN TRONG phần tử mảng không có trần → 32.000 token, bước D4
 *
 * Lần nào cũng sửa đúng chỗ vừa phát hiện rồi tin là xong. Chặn từng chỗ không
 * bao giờ đủ, vì chỗ hở tiếp theo luôn nằm ở tầng chưa ai nhìn tới. Test này
 * duyệt CẢ CÂY nên một trường mới thiếu trần sẽ đỏ ngay, thay vì chờ tới lúc
 * một lượt phân tích thật chết giữa demo.
 *
 * Dùng sạch trần token không phải là "thiếu chỗ" — nâng trần chỉ đổi lấy nhiều
 * token rác hơn.
 */

import { DEFAULT_STEP_PROMPTS } from '../precedent/defaults';
import { buildStepDataSchema, normalizeStepConfig } from '../runtimeConfig';
import { DISCIPLINE_ITEM_PROPERTIES, buildSingleDisciplineSchema } from '../schemas';
import { DISCIPLINE_CODES, type DisciplineCode } from '../types';

interface Node {
    type?: string;
    properties?: Record<string, Node>;
    items?: Node;
    maxItems?: number;
    maxLength?: number;
    enum?: unknown[];
}

/** Mọi đường dẫn trong cây mà model có thể sinh dài tuỳ ý. */
function findUnbounded(node: Node | undefined, path = ''): string[] {
    if (!node || typeof node !== 'object') return [];

    if (node.type === 'object') {
        const entries = Object.entries(node.properties ?? {});
        // Object không khai properties là nút hoàn toàn không bị ràng buộc:
        // bộ giải mã không có gì để bám nên model tự do sinh tới hết ngân sách.
        if (!entries.length) return [`${path} (object không có properties)`];
        return entries.flatMap(([key, child]) => findUnbounded(child, `${path}.${key}`));
    }

    if (node.type === 'array') {
        return [
            ...(node.maxItems === undefined ? [`${path} (array không có maxItems)`] : []),
            ...findUnbounded(node.items, `${path}[]`),
        ];
    }

    // `enum` tự nó đã là trần — tập giá trị hữu hạn.
    if (node.type === 'string' && node.maxLength === undefined && !node.enum?.length) {
        return [`${path} (string không có maxLength)`];
    }

    return [];
}

/** Trần ký tự mà schema cho phép, tính theo trường hợp xấu nhất. */
function worstCaseChars(node: Node | undefined): number {
    if (!node || typeof node !== 'object') return 0;
    if (node.type === 'object') {
        return Object.values(node.properties ?? {})
            .reduce((sum, child) => sum + worstCaseChars(child) + 20, 0);
    }
    if (node.type === 'array') return (node.maxItems ?? 0) * (worstCaseChars(node.items) + 4);
    if (node.type === 'string') return node.enum?.length ? 40 : (node.maxLength ?? 0);
    return 12;
}

function schemaFor(code: DisciplineCode): Node {
    const seed = DEFAULT_STEP_PROMPTS.find((p) => p.stepCode === code);
    const config = normalizeStepConfig(code, {
        inputSchemaJson: seed?.inputSchemaJson,
        formSchemaJson: seed?.formSchemaJson,
    });
    return buildSingleDisciplineSchema(buildStepDataSchema(config)) as Node;
}

describe('response schema của từng bước phải bị chặn hoàn toàn', () => {
    it.each([...DISCIPLINE_CODES])('%s không có nút nào sinh dài tuỳ ý', (code) => {
        expect(findUnbounded(schemaFor(code), code)).toEqual([]);
    });

    it.each([...DISCIPLINE_CODES])('%s có trần trường hợp xấu nhất nằm dưới ngân sách token', (code) => {
        // ~3 ký tự một token cho JSON. Ngân sách `stepAnalyze` là 32.000 token,
        // nên trần lý thuyết phải nằm dưới đó — nếu không, một lượt chạy dài bất
        // thường vẫn có thể chạm `finishReason=length` dù không nút nào hở.
        const tokens = worstCaseChars(schemaFor(code)) / 3;
        expect(tokens).toBeLessThan(32_000);
    });

    it('vỏ dùng khi bước chưa cấu hình form cũng phải kín', () => {
        // Nhánh này chạy khi Form Editor trống, và `data` khi đó là `{type:'object'}`
        // trần trụi — nút không ràng buộc duy nhất còn được phép tồn tại, vì
        // không có gì để mô tả nó. Các trường còn lại thì không được hở.
        const bare = buildSingleDisciplineSchema(undefined) as Node;
        expect(findUnbounded(bare)).toEqual(['.data (object không có properties)']);
    });
});

/**
 * Trường có cấu trúc phải TỰ MÔ TẢ được.
 *
 * Quan sát thật trên gemini-2.5-flash: `fiveWhy.items` khai đúng bốn trường
 * `step/why/answer/evidence` nhưng KHÔNG một dòng mô tả nào. Model không biết
 * cái nào chứa gì, nên nhồi cả câu hỏi + câu trả lời + bằng chứng vào riêng ô
 * `why`, kèm hậu tố tự bịa "(Independent Diagnosis Step 1 of 3.)", lặp bốn lần,
 * và để `answer` trống.
 *
 * Vòng lặp đó chính là thứ đốt sạch ngân sách token: cùng một lỗi, khi thì ra
 * "cả đống chữ", khi thì chết vì `finishReason=length`, tuỳ lần lấy mẫu nào
 * chạm tường trước.
 *
 * `maxLength` chặn được thiệt hại, còn mô tả mới ngăn được vòng lặp bắt đầu.
 */
describe('phần tử mảng phải nói rõ từng trường chứa gì', () => {
    it.each([...DISCIPLINE_CODES])('%s: mọi trường của phần tử object đều có description', (code) => {
        const missing: string[] = [];
        (function walk(node: Node | undefined, path: string, insideItems: boolean) {
            if (!node || typeof node !== 'object') return;
            if (node.type === 'array') return walk(node.items, `${path}[]`, true);
            if (node.type === 'object') {
                for (const [key, child] of Object.entries(node.properties ?? {})) {
                    // Chỉ soi bên trong phần tử mảng: trường đơn lẻ đã có `label`
                    // làm description, còn trường của phần tử thì không.
                    if (insideItems && !(child as { description?: string }).description
                        && !(child as { enum?: unknown[] }).enum?.length) {
                        missing.push(`${path}.${key}`);
                    }
                    walk(child, `${path}.${key}`, insideItems);
                }
            }
        })(schemaFor(code), code, false);

        expect(missing).toEqual([]);
    });
});

/**
 * Trần độ dài là LƯỚI AN TOÀN, không phải mục tiêu.
 *
 * Đã đi qua cả hai cực và cả hai đều sai:
 *
 *   trần 6.000 cho `content`  model đọc trần như độ dài mong đợi rồi viết cho đầy
 *   trần 900 cho `content`    câu bị cắt giữa chừng, và cắt ký tự không làm nội
 *                             dung đúng trọng tâm hơn — chỉ làm nó cụt
 *
 * Nên trần phải đủ rộng để một câu trả lời viết tốt không bao giờ chạm tới,
 * nhưng vẫn hữu hạn để vòng lặp thoái hoá không đốt hết ngân sách token. Việc
 * nói đúng trọng tâm do mục STYLE trong prompt lo, không phải do `maxLength`.
 */
describe('trần độ dài đủ rộng nhưng vẫn hữu hạn', () => {
    it('content có trần, và trần đó không phải chỗ để model nhắm tới', () => {
        const content = DISCIPLINE_ITEM_PROPERTIES.content as { maxLength?: number };
        expect(content.maxLength).toEqual(expect.any(Number));
        // Hữu hạn để chặn sinh loạn; rộng để không cắt giữa câu.
        expect(content.maxLength!).toBeGreaterThanOrEqual(1_200);
        expect(content.maxLength!).toBeLessThanOrEqual(3_000);
    });

    it('mô tả content trỏ về luật STYLE chứ không tự đặt ra một giới hạn khác', () => {
        // Hai chỗ cùng nói về độ dài là hai chỗ sẽ lệch nhau. Schema giữ trần,
        // prompt giữ ý nghĩa.
        const content = DISCIPLINE_ITEM_PROPERTIES.content as { description?: string };
        expect(content.description).toMatch(/STYLE/);
    });

    it('summary chặt hơn content — nó là một câu, không phải bài viết', () => {
        const summary = DISCIPLINE_ITEM_PROPERTIES.summary as { maxLength: number };
        const content = DISCIPLINE_ITEM_PROPERTIES.content as { maxLength: number };
        expect(summary.maxLength).toBeLessThan(content.maxLength);
    });
});
