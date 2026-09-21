/**
 * Đường THÀNH CÔNG của tầng 2, chứng minh tất định bằng một provider giả.
 *
 * ── Vì sao cần file này khi đã có integration test ──
 * Integration test bật re-rank thật trên HANA, và nó ĐÃ xanh trong khi lượt gọi
 * model hỏng (`Unexpected token 'export'` — provider của CDK nạp ESM động, thứ
 * ts-jest chạy ở chế độ CJS không làm được). Test đó chỉ chứng minh "bật lên thì
 * không vỡ", vì nó cố ý bỏ qua trường hợp model hỏng — model hỏng là hành vi hợp
 * lệ, nên không được để nó làm test đỏ.
 *
 * Nghĩa là không có gì chứng minh đường thành công. Đây là chỗ chứng minh:
 * provider được thay bằng một bản trả đúng khuôn, nên toàn bộ chuỗi prompt →
 * parse → chấm điểm chạy thật, tất định, không cần AI Core và không cần DB.
 *
 * Lượt gọi model THẬT được chứng minh ở `npm run shadow:graph -- --rerank`, nơi
 * code chạy dưới tsx/ESM đúng như production.
 */

import { setLlmProvider } from '@cnma/sap-aicore-integrate/llm';
import { frameFromInstruction, rerankCandidates } from '../../precedent/reranker';
import {
    DEFAULT_STEP_PROFILES,
    accumulateEvidence,
    applyRerankToScored,
    finalizeScores,
} from '../stepProfiles';
import type { EvidenceHit } from '../probes';

/** Prompt mà provider giả nhìn thấy — dùng để kiểm hợp đồng CoT. */
let lastUserPrompt = '';
let lastSystemPrompt = '';
let lastConfig: Record<string, unknown> = {};

function installProvider(reply: unknown): void {
    setLlmProvider({
        name: 'test-rerank',
        async complete(messages: any[], config: any) {
            lastSystemPrompt = String(messages.find((m) => m.role === 'system')?.content ?? '');
            lastUserPrompt = String(messages.find((m) => m.role === 'user')?.content ?? '');
            lastConfig = config ?? {};
            return { content: JSON.stringify(reply), finishReason: 'stop' };
        },
        async completeWithTools() { throw new Error('không dùng ở đây'); },
        async embed() { return []; },
        async batchEmbed(texts: string[]) { return texts.map(() => []); },
    } as any);
}

const FRAME = DEFAULT_STEP_PROFILES.D4.rerank!;

const CANDIDATES = [
    { notificationId: '8D-10049030', symptomShortText: 'Burr height 0.22mm on die station 4', searchText: 'burr edge cracks' },
    { notificationId: '8D-10049010', symptomShortText: 'Surface roughness from chatter', searchText: 'chatter flange waviness' },
];

const GOOD_REPLY = {
    queryAnalysis: 'The open case shows a burr formed by a worn cutting edge on a thin flange.',
    rankings: [
        {
            notificationId: '8D-10049030',
            analysis: 'Also a burr from edge condition on a stamped part — same formation mechanism.',
            score: 88,
            reason: 'same burr-formation mechanism',
        },
        {
            notificationId: '8D-10049010',
            analysis: 'Chatter is a vibration mechanism, unrelated to edge wear despite the shared flange.',
            score: 22,
            reason: 'vibration, not edge wear',
        },
    ],
};

describe('rerankCandidates — hợp đồng chain-of-thought', () => {
    beforeEach(() => { installProvider(GOOD_REPLY); });

    it('gửi instruction, case đang mở và toàn bộ ứng viên trong MỘT lượt gọi', async () => {
        await rerankCandidates(frameFromInstruction('Same physical failure mechanism?'),
            'Burr on a milled flange edge', CANDIDATES);

        expect(lastUserPrompt).toContain('Same physical failure mechanism?');
        expect(lastUserPrompt).toContain('Burr on a milled flange edge');
        for (const c of CANDIDATES) expect(lastUserPrompt).toContain(c.notificationId);
    });

    /**
     * Cả điểm cốt lõi của CoT nằm ở THỨ TỰ: model sinh JSON theo thứ tự trường,
     * nên `analysis` phải đứng trước `score`. Đảo lại thì lập luận chỉ còn là lời
     * biện minh viết sau cho một con số đã trót chọn — và nhìn output thì hai
     * đằng giống hệt nhau, nên chỉ có chỗ này bắt được.
     */
    it('schema đặt lập luận TRƯỚC điểm số', async () => {
        await rerankCandidates(FRAME, 'y', CANDIDATES);

        const schema = lastConfig.responseSchema as any;
        const item = schema.properties.rankings.items.properties;
        const order = Object.keys(item);
        expect(order.indexOf('analysis')).toBeLessThan(order.indexOf('score'));
        expect(Object.keys(schema.properties).indexOf('queryAnalysis')).toBe(0);
        expect(schema.required).toContain('queryAnalysis');
    });

    it('system prompt bắt buộc lập luận trước, chấm sau', () => {
        return rerankCandidates(FRAME, 'y', CANDIDATES).then(() => {
            expect(lastSystemPrompt).toMatch(/queryAnalysis/);
            expect(lastSystemPrompt).toMatch(/analysis FIRST/);
        });
    });

    /**
     * Bất biến thật sự của tầng này là `temperature: 0` — xếp hạng phải tất định.
     *
     * Thinking budget 256 chỉ bị bỏ KHI model là Claude: `effectiveThinkingBudget`
     * strip mọi budget dưới ngưỡng 1024, vì nếu để lọt thì CDK gắn
     * `thinking_budget` rồi `applyVendorCompat` xoá `temperature` — và tầng này
     * mất tính tất định mà không có gì báo. Với Gemini, budget 256 có nghĩa thật
     * và temperature không bị đụng, nên nó được phép đi qua.
     *
     * Kiểm đúng điều đó thay vì kiểm vô điều kiện: bản trước của test này khẳng
     * định budget luôn bị bỏ, và nó đỏ trên chính cấu hình đang chạy.
     */
    it('giữ temperature 0; budget dưới ngưỡng chỉ bị bỏ khi model là Claude', async () => {
        await rerankCandidates(FRAME, 'y', CANDIDATES);

        expect(lastConfig.temperature).toBe(0);

        const isClaude = /claude|anthropic/i.test(String(lastConfig.model ?? ''));
        if (isClaude) expect(lastConfig.thinkingBudget).toBeUndefined();
        else expect(lastConfig.thinkingBudget).toBe(256);
    });

    it('đọc được cả điểm, lý do và lập luận', async () => {
        const verdicts = await rerankCandidates(FRAME, 'y', CANDIDATES);

        expect(verdicts.get('8D-10049030')).toEqual({
            score: 88,
            reason: 'same burr-formation mechanism',
            analysis: 'Also a burr from edge condition on a stamped part — same formation mechanism.',
        });
        expect(verdicts.get('8D-10049010')!.score).toBe(22);
    });

    it('model bịa thêm case ⇒ bị bỏ, không lọt vào kết quả', async () => {
        installProvider({
            queryAnalysis: 'q',
            rankings: [
                ...GOOD_REPLY.rankings,
                { notificationId: '8D-KHONG-CO-THAT', analysis: 'a', score: 99, reason: 'r' },
            ],
        });
        const verdicts = await rerankCandidates(FRAME, 'y', CANDIDATES);
        expect(verdicts.has('8D-KHONG-CO-THAT')).toBe(false);
        expect(verdicts.size).toBe(2);
    });
});

describe('hai tầng chạy trọn — graph rồi re-rank', () => {
    const profile = { ...DEFAULT_STEP_PROFILES.D4, rerank: { ...DEFAULT_STEP_PROFILES.D4.rerank!, weight: 4 } };

    const hits: EvidenceHit[] = [
        // Chỉ chung ĐÚNG một từ khoá → 3 điểm, dưới ngưỡng 5 của D4.
        { notificationId: '8D-10049030', kind: 'keywords', detail: 'flange', count: 1 },
        { notificationId: '8D-10049010', kind: 'keywords', detail: 'flange', count: 1 },
    ];

    beforeEach(() => { installProvider(GOOD_REPLY); });

    /**
     * Đây là lý do tầng 2 tồn tại, diễn ra trọn vẹn trong một test.
     *
     * Cả hai case đều chỉ chung một chữ `flange` nên tầng 1 cho cả hai 3 điểm —
     * dưới ngưỡng 5, tức là KHÔNG case nào được hiện. Model đọc hai đoạn văn và
     * tách chúng ra: 88/100 cho case cùng cơ chế tạo ba-via, 22/100 cho case rung
     * chatter. Chỉ case đầu vượt lên, và nó vượt nhờ đúng thứ tầng 1 không thấy.
     */
    it('cứu đúng case mà tầng 1 bỏ sót, và KHÔNG cứu case chỉ trùng chữ', async () => {
        const stage1 = accumulateEvidence(hits, profile);
        expect(finalizeScores(stage1, profile)).toEqual([]);   // tầng 1: không ai qua

        const verdicts = await rerankCandidates(profile.rerank!, 'burr on flange edge', CANDIDATES);
        const final = finalizeScores(applyRerankToScored(stage1, profile.rerank!, verdicts), profile);

        expect(final.map((c) => c.notificationId)).toEqual(['8D-10049030']);
        expect(final[0].score).toBe(6.5);                      // 3 + 4×0.88 = 6.52 → 6.5
        expect(final[0].evidence.find((e) => e.kind === 'rerank')!.detail)
            .toBe('88/100 — same burr-formation mechanism');
    });

    it('re-rank hỏng ⇒ kết quả y hệt lúc chưa có tầng 2', async () => {
        const stage1 = accumulateEvidence(hits, profile);
        expect(finalizeScores(applyRerankToScored(stage1, profile.rerank!, null), profile))
            .toEqual(finalizeScores(stage1, profile));
    });
});
