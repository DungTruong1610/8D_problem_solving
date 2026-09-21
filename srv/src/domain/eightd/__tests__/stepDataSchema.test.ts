/**
 * Ràng buộc `discipline.data` bằng response schema thay vì chỉ bằng prompt.
 *
 * Cấu hình trong các test dưới đây lấy nguyên từ StepPrompts đang chạy, chọn
 * đúng hai trường mà gemini-2.5-flash trả sai khi `data` chỉ được khai là
 * `{ type: 'object' }` rỗng:
 *
 *   - `team.selectionMethod`  → trả chuỗi ngoài danh sách enum
 *   - `rootCause.fiveWhy`     → bỏ trắng dù required + minItems 1
 *
 * Prompt CÓ liệt kê cả hai ràng buộc. Prompt chỉ là lời khuyên; schema mới là
 * thứ model bị chặn lúc sinh token.
 */

import { buildStepDataSchema, normalizeStepConfig } from '../runtimeConfig';
import { DISCIPLINE_ITEM_PROPERTIES, buildSingleDisciplineSchema } from '../schemas';
import { DEFAULT_STEP_PROMPTS } from '../precedent/defaults';

const config = (fields: unknown[]) =>
    normalizeStepConfig('D1', { formSchemaJson: JSON.stringify({ version: 1, fields }) });

const SELECTION_METHOD = {
    key: 'team.selectionMethod',
    label: 'Selection method',
    widget: 'status',
    dataType: 'string',
    constraints: {
        required: true,
        enum: ['Current case team', 'Precedent recommendation', 'Hybrid', 'Roles only - assignment required'],
    },
};

const FIVE_WHY = {
    key: 'rootCause.fiveWhy',
    label: '5-Why chain',
    widget: 'why-chain',
    dataType: 'array',
    constraints: { required: true, minItems: 1 },
    items: {
        type: 'object',
        properties: {
            step: { type: 'integer' },
            why: { type: 'string' },
            answer: { type: 'string' },
            evidence: { type: 'string' },
        },
    },
};

describe('buildStepDataSchema', () => {
    it('đưa danh sách enum vào schema, không để nó chỉ nằm trong prompt', () => {
        const schema = buildStepDataSchema(config([SELECTION_METHOD])) as any;
        expect(schema.properties.team.properties.selectionMethod.enum)
            .toEqual(SELECTION_METHOD.constraints.enum);
    });

    it('lồng đúng theo đường dẫn có dấu chấm', () => {
        const schema = buildStepDataSchema(config([SELECTION_METHOD])) as any;
        expect(schema.type).toBe('object');
        expect(schema.properties.team.type).toBe('object');
    });

    it('đánh dấu bắt buộc ở cả nhánh cha — nếu không model bỏ cả nhánh là lách được', () => {
        const schema = buildStepDataSchema(config([SELECTION_METHOD])) as any;
        expect(schema.required).toContain('team');
        expect(schema.properties.team.required).toContain('selectionMethod');
    });

    it('giữ required item-level của row — chốt chặn row 5-Why có why mà không có answer', () => {
        // Không có `required` trong items thì một row {step, why} thiếu answer
        // vẫn hợp lệ theo schema — đúng kiểu khuyết mà Haiku hay trả.
        const fiveWhyStrict = {
            ...FIVE_WHY,
            items: { ...FIVE_WHY.items, required: ['step', 'why', 'answer', 'evidence'] },
        };
        const schema = buildStepDataSchema(config([fiveWhyStrict])) as any;
        expect(schema.properties.rootCause.properties.fiveWhy.items.required)
            .toEqual(['step', 'why', 'answer', 'evidence']);
    });

    it('cấu hình D4 mặc định khai required item-level cho fiveWhy lẫn ishikawaBoard', () => {
        const d4 = DEFAULT_STEP_PROMPTS.find((p) => p.stepCode === 'D4')!;
        const schema = buildStepDataSchema(normalizeStepConfig('D4', d4)) as any;
        const root = schema.properties.rootCause.properties;
        expect(root.fiveWhy.items.required).toEqual(['step', 'why', 'answer', 'evidence']);
        expect(root.ishikawaBoard.items.required).toEqual(['category', 'finding', 'isRootCause', 'source']);
        expect(root.ishikawaBoard.minItems).toBe(6);
        expect(schema.required).toContain('rootCause');
    });

    it('giữ minItems và kiểu phần tử của mảng đối tượng', () => {
        const schema = buildStepDataSchema(config([FIVE_WHY])) as any;
        const fiveWhy = schema.properties.rootCause.properties.fiveWhy;
        expect(fiveWhy.type).toBe('array');
        expect(fiveWhy.minItems).toBe(1);
        expect(fiveWhy.items.properties.step.type).toBe('integer');
        expect(fiveWhy.items.properties.evidence.type).toBe('string');
    });

    it('bỏ qua mảng không mô tả nổi phần tử thay vì sinh object rỗng', () => {
        // Đúng tình trạng của `rootCause.ishikawaBoard` trong cấu hình hiện tại:
        // `items.properties` rỗng. Object không có properties khiến structured
        // output hoặc bị từ chối, hoặc sinh ra thứ tuỳ hứng.
        const schema = buildStepDataSchema(config([
            { key: 'rootCause.board', label: 'Board', widget: 'ishikawa-grid', dataType: 'array', items: { type: 'object', properties: {} } },
            FIVE_WHY,
        ])) as any;
        expect(schema.properties.rootCause.properties.board).toBeUndefined();
        expect(schema.properties.rootCause.properties.fiveWhy).toBeDefined();
    });

    it('trả undefined khi bước không có form — bên gọi quay về envelope phẳng', () => {
        expect(buildStepDataSchema(normalizeStepConfig('D5', {}))).toBeUndefined();
        expect(buildStepDataSchema(undefined)).toBeUndefined();
    });

    it('trả undefined khi không trường nào mô tả được, chứ không phải object rỗng', () => {
        const schema = buildStepDataSchema(config([
            { key: 'a.b', label: 'B', widget: 'ishikawa-grid', dataType: 'array', items: { type: 'object', properties: {} } },
        ]));
        expect(schema).toBeUndefined();
    });

    it('đổi date thành string — JSON Schema không có kiểu date', () => {
        const schema = buildStepDataSchema(config([
            { key: 'closure.signedOn', label: 'Signed on', widget: 'input', dataType: 'date' },
        ])) as any;
        expect(schema.properties.closure.properties.signedOn.type).toBe('string');
    });
});

describe('buildSingleDisciplineSchema', () => {
    it('gắn schema data vào và bắt buộc nó', () => {
        const dataSchema = buildStepDataSchema(config([SELECTION_METHOD]));
        const schema = buildSingleDisciplineSchema(dataSchema) as any;
        expect(schema.properties.data).toBe(dataSchema);
        expect(schema.required).toContain('data');
    });

    it('không có schema data thì không bắt buộc data — bước chưa cấu hình form vẫn chạy', () => {
        const schema = buildSingleDisciplineSchema(undefined) as any;
        expect(schema.required).not.toContain('data');
        expect(schema.properties.data).toEqual({ type: 'object' });
    });

    it('luôn giữ nguyên các trường narrative bắt buộc', () => {
        for (const schema of [buildSingleDisciplineSchema(undefined), buildSingleDisciplineSchema({ type: 'object' })]) {
            expect((schema as any).required).toEqual(expect.arrayContaining(['code', 'summary', 'content', 'sources']));
        }
    });
});

/**
 * Chặn chạy loạn.
 *
 * Quan sát thật: trên case không có dữ liệu điều tra nào, D4 trả về
 * `rootCause.evidenceGaps` với 10 phần tử và `content` dài 6.621 ký tự — model
 * lấp chỗ trống thay vì nói ngắn gọn là không có dữ liệu. Mảng không trần cộng
 * hạn mức token rộng là lời mời lặp.
 */
describe('buildStepDataSchema — chốt chặn chạy loạn', () => {
    it('mảng không khai maxItems vẫn được cấp trần mặc định', () => {
        const schema = buildStepDataSchema(config([
            { key: 'rootCause.evidenceGaps', label: 'Evidence gaps', widget: 'warning-list', dataType: 'array', items: { type: 'string' } },
        ])) as any;
        // Con số cụ thể do `schemaBounded.test.ts` chốt qua trần token tổng; ở đây
        // chỉ cần khẳng định mảng KHÔNG được để không trần.
        expect(schema.properties.rootCause.properties.evidenceGaps.maxItems).toEqual(expect.any(Number));
    });

    it('maxItems khai trong cấu hình thắng trần mặc định', () => {
        const schema = buildStepDataSchema(config([
            { key: 'a.b', label: 'B', widget: 'warning-list', dataType: 'array', items: { type: 'string' }, constraints: { maxItems: 3 } },
        ])) as any;
        expect(schema.properties.a.properties.b.maxItems).toBe(3);
    });

    it('mang maxLength của chuỗi vào schema — trước đây bị bỏ rơi', () => {
        const schema = buildStepDataSchema(config([
            { key: 'rootCause.statement', label: 'Root cause', widget: 'ai-draft', dataType: 'string', constraints: { required: true, minLength: 30, maxLength: 800 } },
        ])) as any;
        const statement = schema.properties.rootCause.properties.statement;
        expect(statement.maxLength).toBe(800);
        expect(statement.minLength).toBe(30);
    });

    it('minItems và maxItems cùng tồn tại được', () => {
        const schema = buildStepDataSchema(config([FIVE_WHY])) as any;
        const fiveWhy = schema.properties.rootCause.properties.fiveWhy;
        expect(fiveWhy.minItems).toBe(1);
        expect(fiveWhy.maxItems).toEqual(expect.any(Number));
        expect(fiveWhy.maxItems).toBeGreaterThan(fiveWhy.minItems);
    });
});

/**
 * Vỏ discipline phải có trần, không chỉ `data`.
 *
 * Quan sát thật: một lượt gọi `max_tokens=32000` sinh ra ĐÚNG 32.000 token rồi
 * chết vì `finishReason=length`. Dùng sạch trần không phải thiếu chỗ — đó là
 * sinh loạn. `buildStepDataSchema` chỉ chặn mảng bên trong `data`; hai mảng
 * chuỗi ở vỏ (`sources`, `actionItems`) khi đó vẫn không có trần, nên model chỉ
 * cần lặp ở đó là chạy tới hết ngân sách.
 */
describe('DISCIPLINE_ITEM_PROPERTIES — vỏ không được để hở', () => {
    it('mọi mảng ở vỏ đều có maxItems', () => {
        for (const [name, spec] of Object.entries(DISCIPLINE_ITEM_PROPERTIES)) {
            const s = spec as Record<string, unknown>;
            if (s.type !== 'array') continue;
            expect([name, s.maxItems]).toEqual([name, expect.any(Number)]);
        }
    });

    it('mọi chuỗi văn xuôi ở vỏ đều có maxLength', () => {
        for (const name of ['title', 'summary', 'content'] as const) {
            const s = DISCIPLINE_ITEM_PROPERTIES[name] as Record<string, unknown>;
            expect([name, s.maxLength]).toEqual([name, expect.any(Number)]);
        }
    });

    it('phần tử của mảng chuỗi cũng bị chặn — một phần tử dài vô hạn cũng đủ làm loạn', () => {
        for (const name of ['sources', 'actionItems'] as const) {
            const s = DISCIPLINE_ITEM_PROPERTIES[name] as { items?: Record<string, unknown> };
            expect([name, s.items?.maxLength]).toEqual([name, expect.any(Number)]);
        }
    });

    it('summary chặt hơn content — nó là một câu, không phải đoạn văn', () => {
        const summary = DISCIPLINE_ITEM_PROPERTIES.summary as { maxLength: number };
        const content = DISCIPLINE_ITEM_PROPERTIES.content as { maxLength: number };
        expect(summary.maxLength).toBeLessThan(content.maxLength);
    });

    it('trần ở vỏ đi vào cả schema từng bước lẫn schema gộp', () => {
        const single = buildSingleDisciplineSchema(undefined) as any;
        expect(single.properties.sources.maxItems).toBe(15);
        const withData = buildSingleDisciplineSchema({ type: 'object' }) as any;
        expect(withData.properties.actionItems.maxItems).toEqual(expect.any(Number));
    });
});
