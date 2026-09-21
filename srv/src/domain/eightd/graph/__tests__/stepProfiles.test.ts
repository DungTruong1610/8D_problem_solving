import {
    DEFAULT_STEP_PROFILES,
    STEP_CODES,
    explainEvidence,
    scoreEvidence,
    normalizeStepParams,
    accumulateEvidence,
    applyRerankToScored,
    finalizeScores,
    type GraphStepProfile,
} from '../stepProfiles';
import type { EvidenceHit } from '../probes';

const hit = (
    notificationId: string,
    kind: EvidenceHit['kind'],
    detail: string,
    count = 1,
): EvidenceHit => ({ notificationId, kind, detail, count });

describe('scoreEvidence', () => {
    const profile: GraphStepProfile = {
        label: 'test', question: 'test',
        weights: { keywords: 2, materialFamily: 2, workCenter: 1 },
        keywordCap: 4, minScore: 4, topN: 3,
    };

    it('cộng điểm theo trọng số của từng loại bằng chứng', () => {
        const [result] = scoreEvidence(
            [hit('A', 'materialFamily', 'MG-HOUSING'), hit('A', 'workCenter', 'WC-MILL-07')],
            { ...profile, minScore: 0 },
        );
        expect(result.score).toBe(3);
    });

    it('nhân điểm từ khoá theo SỐ từ chung, tới trần', () => {
        const three = scoreEvidence([hit('A', 'keywords', 'burr, edge, limit', 3)], { ...profile, minScore: 0 });
        const one = scoreEvidence([hit('B', 'keywords', 'flange', 1)], { ...profile, minScore: 0 });
        expect(three[0].score).toBe(6);
        expect(one[0].score).toBe(2);
    });

    it('chặn ở trần để mô tả dài không tự nó thắng', () => {
        const [result] = scoreEvidence([hit('A', 'keywords', 'a, b, c, d, e, f', 6)], { ...profile, minScore: 0 });
        expect(result.score).toBe(8); // 2 × min(6, cap 4)
    });

    /**
     * Chính là dương tính giả trong PRECEDENT-RETRIEVAL-REVIEW.md: hai case chỉ
     * chung chữ `flange` từng ăn +2 y hệt một case khớp thật. Ở đây một từ chung
     * không bao giờ tự nó qua ngưỡng.
     */
    it('một từ khoá chung KHÔNG bao giờ tự nó đủ điểm làm tiền lệ', () => {
        expect(scoreEvidence([hit('B', 'keywords', 'flange', 1)], profile)).toEqual([]);
    });

    it('xếp case khớp nhiều từ trên case khớp một từ', () => {
        const result = scoreEvidence([
            hit('8D-10049010', 'keywords', 'flange', 1),
            hit('8D-10049010', 'workCenter', 'WC-MILL-07'),
            hit('8D-10049030', 'keywords', 'burr, edge, limit', 3),
        ], profile);
        expect(result.map((r) => r.notificationId)).toEqual(['8D-10049030']);
    });

    it('bỏ qua loại bằng chứng mà bước này không cân', () => {
        const [result] = scoreEvidence([
            hit('A', 'materialFamily', 'MG-HOUSING'),
            hit('A', 'defectCode', 'DEF-0489'),
            hit('A', 'workCenter', 'WC-MILL-07'),
        ], { ...profile, minScore: 0 });
        expect(result.score).toBe(3);
        expect(result.evidence.map((e) => e.kind)).not.toContain('defectCode');
    });

    it('đặt bằng chứng nặng nhất lên đầu', () => {
        const [result] = scoreEvidence([
            hit('A', 'workCenter', 'WC-MILL-07'),
            hit('A', 'keywords', 'burr, edge', 2),
        ], profile);
        expect(result.evidence[0].kind).toBe('keywords');
    });

    it('tất định khi điểm bằng nhau — sắp theo mã case', () => {
        const hits = [hit('8D-2', 'materialFamily', 'F', 1), hit('8D-1', 'materialFamily', 'F', 1)];
        const forward = scoreEvidence(hits, { ...profile, minScore: 0 });
        const reversed = scoreEvidence([...hits].reverse(), { ...profile, minScore: 0 });
        expect(forward.map((r) => r.notificationId)).toEqual(['8D-1', '8D-2']);
        expect(reversed.map((r) => r.notificationId)).toEqual(forward.map((r) => r.notificationId));
    });

    it('cắt đúng topN', () => {
        const hits = ['A', 'B', 'C', 'D'].map((id) => hit(id, 'keywords', 'x, y', 2));
        expect(scoreEvidence(hits, { ...profile, topN: 2 })).toHaveLength(2);
    });
});

describe('DEFAULT_STEP_PROFILES', () => {
    it('khai đủ tám bước', () => {
        expect(Object.keys(DEFAULT_STEP_PROFILES).sort()).toEqual([...STEP_CODES].sort());
    });

    /**
     * Luật bất biến của cả đợt này. Nếu một bước nào đó đặt trọng số từ khoá đủ
     * cao để một từ chung qua ngưỡng, R3 quay lại — âm thầm, ở đúng một bước.
     */
    it('không bước nào để MỘT từ khoá chung tự nó qua ngưỡng', () => {
        for (const [code, profile] of Object.entries(DEFAULT_STEP_PROFILES)) {
            const single = scoreEvidence([hit('X', 'keywords', 'flange', 1)], profile);
            expect(`${code}:${single.length}`).toBe(`${code}:0`);
        }
    });

    it('D4 cân từ khoá nặng hơn work center — đó là câu hỏi của nó', () => {
        const d4 = DEFAULT_STEP_PROFILES.D4;
        expect((d4.weights.keywords ?? 0) * d4.keywordCap).toBeGreaterThan(d4.weights.workCenter ?? 0);
    });

    it('D7 không thưởng điểm cho cùng work center — phòng ngừa là mở rộng ra ngoài trạm đó', () => {
        expect(DEFAULT_STEP_PROFILES.D7.weights.workCenter).toBeUndefined();
    });
});

describe('explainEvidence', () => {
    it('viết một dòng người đọc hiểu, dẫn được về đúng bằng chứng', () => {
        const [scored] = scoreEvidence([
            hit('A', 'keywords', 'burr, edge, limit', 3),
            hit('A', 'materialFamily', 'MG-HOUSING'),
        ], DEFAULT_STEP_PROFILES.D4);
        // 3 từ × trọng số 3 = 9, cộng 1 cho cùng họ vật tư.
        expect(explainEvidence(scored)).toBe(
            '10 điểm — 3 từ khoá chung (burr, edge, limit), cùng họ vật tư MG-HOUSING',
        );
    });
});

describe('normalizeStepParams', () => {
    const row = {
        label: 'Root Cause Analysis', question: 'Cơ chế hỏng?',
        wKeywords: 3, wMaterialFamily: 1, wWorkCenter: 1,
        keywordCap: 4, minScore: 5, topN: 3, actionType: null, enabled: true,
    };

    it('không có dòng cấu hình ⇒ dùng mặc định, không phải lỗi', () => {
        for (const empty of [null, undefined, 'x', 42]) {
            expect(normalizeStepParams('D4', empty)).toEqual({
                profile: DEFAULT_STEP_PROFILES.D4, violation: null,
            });
        }
    });

    it('dòng bị tắt ⇒ dùng mặc định', () => {
        expect(normalizeStepParams('D4', { ...row, enabled: false }).profile)
            .toEqual(DEFAULT_STEP_PROFILES.D4);
    });

    it('đọc trọng số, trần, ngưỡng và topN từ dòng cấu hình', () => {
        const { profile, violation } = normalizeStepParams('D4', row);
        expect(violation).toBeNull();
        expect(profile.weights).toEqual({ keywords: 3, materialFamily: 1, workCenter: 1 });
        expect(profile.keywordCap).toBe(4);
        expect(profile.minScore).toBe(5);
        expect(profile.topN).toBe(3);
        expect(profile.actionType).toBeUndefined();
    });

    it('trọng số null hoặc 0 ⇒ bước KHÔNG cân loại đó', () => {
        const { profile } = normalizeStepParams('D4', { ...row, wWorkCenter: 0, wMaterial: null });
        expect(profile.weights.workCenter).toBeUndefined();
        expect(profile.weights.material).toBeUndefined();
    });

    it('chỉ nhận đúng ba loại hành động', () => {
        expect(normalizeStepParams('D3', { ...row, actionType: 'Containment' }).profile.actionType)
            .toBe('Containment');
        expect(normalizeStepParams('D3', { ...row, actionType: 'containment' }).profile.actionType)
            .toBeUndefined();
        expect(normalizeStepParams('D3', { ...row, actionType: 'Anything' }).profile.actionType)
            .toBeUndefined();
    });

    /**
     * Đây là lý do tồn tại của hàm này. Không có phép kiểm này, một admin gõ
     * wKeywords=5 với minScore=4 sẽ mở lại R3 — một từ khoá chung tự nó đủ điểm —
     * qua đường cấu hình, ở đúng một bước, và không có gì báo.
     */
    it('TỪ CHỐI cấu hình để một từ khoá chung tự nó qua ngưỡng', () => {
        const { profile, violation } = normalizeStepParams('D4', { ...row, wKeywords: 5, minScore: 4 });
        expect(profile).toEqual(DEFAULT_STEP_PROFILES.D4);
        expect(violation).toMatch(/R3/);
        expect(violation).toMatch(/wKeywords=5/);
    });

    it('từ chối cả trường hợp bằng nhau, không chỉ lớn hơn', () => {
        expect(normalizeStepParams('D4', { ...row, wKeywords: 5, minScore: 5 }).violation)
            .toMatch(/R3/);
    });

    it('cấu hình đã từ chối vẫn giữ được bất biến khi đem đi chấm điểm', () => {
        const { profile } = normalizeStepParams('D4', { ...row, wKeywords: 9, minScore: 2 });
        const single = scoreEvidence(
            [{ notificationId: 'X', kind: 'keywords', detail: 'flange', count: 1 }],
            profile,
        );
        expect(single).toEqual([]);
    });

    it('từ chối dòng không có trọng số nào — bước đó sẽ không bao giờ tìm được gì', () => {
        const { profile, violation } = normalizeStepParams('D4', {
            ...row, wKeywords: 0, wMaterialFamily: 0, wWorkCenter: 0,
        });
        expect(profile).toEqual(DEFAULT_STEP_PROFILES.D4);
        expect(violation).toMatch(/không có trọng số/);
    });

    it('số không dùng được rơi về mặc định của chính bước đó', () => {
        const { profile } = normalizeStepParams('D4', { ...row, keywordCap: -1, topN: 'ba' });
        expect(profile.keywordCap).toBe(DEFAULT_STEP_PROFILES.D4.keywordCap);
        expect(profile.topN).toBe(DEFAULT_STEP_PROFILES.D4.topN);
    });
});

describe('accumulateEvidence / finalizeScores — tách ra để re-rank chen vào giữa', () => {
    const profile: GraphStepProfile = {
        label: 't', question: 't',
        weights: { keywords: 3, materialFamily: 1 },
        keywordCap: 4, minScore: 5, topN: 2,
    };

    /**
     * Đây là lý do việc tách tồn tại: case dưới ngưỡng ở tầng 1 vẫn phải sống tới
     * tầng 2, vì nó chính là loại case re-rank sinh ra để cứu — chung ít từ khoá
     * nhưng cùng cơ chế hỏng.
     */
    it('accumulate GIỮ case dưới ngưỡng; finalize mới là chỗ cắt', () => {
        const hits = [hit('weak', 'keywords', 'flange', 1)];
        expect(accumulateEvidence(hits, profile).map((c) => c.notificationId)).toEqual(['weak']);
        expect(finalizeScores(accumulateEvidence(hits, profile), profile)).toEqual([]);
    });

    it('scoreEvidence vẫn là accumulate rồi finalize — hành vi cũ nguyên vẹn', () => {
        const hits = [hit('A', 'keywords', 'a, b', 2), hit('B', 'keywords', 'x', 1)];
        expect(scoreEvidence(hits, profile))
            .toEqual(finalizeScores(accumulateEvidence(hits, profile), profile));
    });
});

describe('applyRerankToScored', () => {
    const rerank = { ...DEFAULT_STEP_PROFILES.D4.rerank!, weight: 4, floor: 0.5 };
    const base = () => accumulateEvidence(
        [hit('8D-2', 'keywords', 'flange', 1)],
        { label: 't', question: 't', weights: { keywords: 3 }, keywordCap: 4, minScore: 5, topN: 3 },
    );

    it('đạt sàn: cộng weight × score/100 và thêm một mục bằng chứng đọc được', () => {
        const [out] = applyRerankToScored(base(), rerank, new Map([
            ['8D-2', { score: 80, reason: 'same clamp slip' }],
        ]));
        expect(out.score).toBe(6.2);                        // 3 + 4×0.8
        const entry = out.evidence.find((e) => e.kind === 'rerank')!;
        expect(entry.points).toBe(3.2);
        expect(entry.detail).toBe('80/100 — same clamp slip');
    });

    /**
     * Điểm re-rank dùng CÙNG công thức với `applyRerank` của engine chấm điểm.
     * Hai engine phải cho cùng một con số trên cùng một phán quyết, nếu không thì
     * so kết quả hai bên bằng shadow run là so hai thang đo khác nhau.
     */
    it('cùng công thức weight × score/100 với engine chấm điểm', () => {
        const [out] = applyRerankToScored(base(), { ...rerank, weight: 3 }, new Map([
            ['8D-2', { score: 80, reason: 'r' }],
        ]));
        expect(out.evidence.find((e) => e.kind === 'rerank')!.points).toBe(2.4);
    });

    it('dưới sàn: không cộng điểm và KHÔNG thêm mục — đường bằng chứng chỉ nói thứ ăn điểm', () => {
        const [out] = applyRerankToScored(base(), rerank, new Map([
            ['8D-2', { score: 30, reason: 'weak' }],
        ]));
        expect(out.score).toBe(3);
        expect(out.evidence.some((e) => e.kind === 'rerank')).toBe(false);
    });

    it('model bỏ sót case ⇒ giữ nguyên tầng 1', () => {
        const [out] = applyRerankToScored(base(), rerank, new Map());
        expect(out.score).toBe(3);
    });

    it('cả lượt re-rank hỏng (null) ⇒ giữ nguyên xếp hạng tầng 1', () => {
        expect(applyRerankToScored(base(), rerank, null)).toEqual(base());
    });
});

describe('normalizeStepParams — cấu hình re-rank', () => {
    const row = {
        wKeywords: 3, wMaterialFamily: 1, keywordCap: 4, minScore: 5, topN: 3, enabled: true,
    };

    it('trọng số 0 hoặc null ⇒ bước KHÔNG re-rank', () => {
        expect(normalizeStepParams('D4', { ...row, wRerank: 0 }).profile.rerank).toBeUndefined();
        expect(normalizeStepParams('D4', { ...row, wRerank: null }).profile.rerank).toBeUndefined();
    });

    it('bật bằng đúng một con số; sàn và câu hỏi rơi về mặc định của bước', () => {
        const { profile } = normalizeStepParams('D4', { ...row, wRerank: 3 });
        expect(profile.rerank!.weight).toBe(3);
        expect(profile.rerank!.floor).toBe(DEFAULT_STEP_PROFILES.D4.rerank!.floor);
        expect(profile.rerank!.queryFrame).toBe(DEFAULT_STEP_PROFILES.D4.rerank!.queryFrame);
        expect(profile.rerank!.rubric).toBe(DEFAULT_STEP_PROFILES.D4.rerank!.rubric);
    });

    it('sàn ngoài [0,1] rơi về mặc định thay vì tạo ra một ngưỡng vô nghĩa', () => {
        for (const rerankFloor of [-1, 1.5, 'nửa', null]) {
            expect(normalizeStepParams('D4', { ...row, wRerank: 3, rerankFloor }).profile.rerank!.floor)
                .toBe(DEFAULT_STEP_PROFILES.D4.rerank!.floor);
        }
        expect(normalizeStepParams('D4', { ...row, wRerank: 3, rerankFloor: 0.7 }).profile.rerank!.floor)
            .toBe(0.7);
    });

    /**
     * Cùng bất biến với `wKeywords`, và cùng lý do: không tín hiệu đơn lẻ nào
     * được phép tự mình biến một case thành tiền lệ. Với re-rank, để lọt nghĩa là
     * model thích case nào thì case đó vào, kể cả khi nó không chung một quan hệ
     * nào trong graph — tức là vứt bỏ đúng thứ đã chọn graph để có.
     */
    it('TỪ CHỐI cấu hình để riêng re-rank tự nó qua ngưỡng', () => {
        const { profile, violation } = normalizeStepParams('D4', { ...row, wRerank: 5, minScore: 5 });
        expect(profile).toEqual(DEFAULT_STEP_PROFILES.D4);
        expect(violation).toMatch(/wRerank=5/);
        expect(violation).toMatch(/graph/);
    });
});

describe('khung chain-of-thought của tám bước', () => {
    it('mọi bước đều có đủ ba mảnh khung, và TẮT mặc định', () => {
        for (const code of STEP_CODES) {
            const rerank = DEFAULT_STEP_PROFILES[code].rerank;
            expect(`${code}:defined`).toBe(`${code}:${rerank ? 'defined' : 'missing'}`);
            expect(rerank!.weight).toBe(0);
            for (const part of ['queryFrame', 'candidateFrame', 'rubric'] as const) {
                expect(`${code}.${part}`).toBe(
                    rerank![part].trim().length > 40 ? `${code}.${part}` : `${code}.${part} QUÁ NGẮN`,
                );
            }
        }
    });

    /**
     * Bất biến chính của việc tách khung ra theo bước.
     *
     * `queryFrame` là MỐC mà mọi điểm số của bước đó được đo theo. Hai bước dùng
     * chung một mốc nghĩa là một trong hai đang suy nghĩ theo câu hỏi của bước
     * kia — model vẫn trả lời trôi chảy, vẫn đúng schema, vẫn có điểm và có lý do
     * nghe hợp lý. Không có gì trong output lộ ra điều đó, nên chỉ chỗ này bắt được.
     */
    it('không bước nào dùng lại khung của bước khác', () => {
        for (const part of ['queryFrame', 'candidateFrame', 'rubric'] as const) {
            const values = STEP_CODES.map((c) => DEFAULT_STEP_PROFILES[c].rerank![part]);
            expect(`${part}:${new Set(values).size}`).toBe(`${part}:${STEP_CODES.length}`);
        }
    });

    /**
     * Mỗi khung phải nói về đúng chủ đề của bước nó. Kiểm bằng một từ khoá neo —
     * thô, nhưng đủ để bắt trường hợp ai đó copy khung D4 sang D1 rồi quên sửa.
     */
    it('khung nói đúng chủ đề của bước', () => {
        const anchor: Record<string, RegExp> = {
            D1: /capabilit|team/i,
            D2: /boundary|specification/i,
            D3: /exposed|containment/i,
            D4: /mechanism/i,
            D5: /root cause|remove/i,
            D6: /proof|verif/i,
            D7: /reach|FMEA/i,
            D8: /closure|closed/i,
        };
        for (const code of STEP_CODES) {
            const r = DEFAULT_STEP_PROFILES[code].rerank!;
            const text = `${r.queryFrame} ${r.candidateFrame} ${r.rubric}`;
            expect(`${code}:${anchor[code].test(text)}`).toBe(`${code}:true`);
        }
    });
});
