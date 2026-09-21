import type { GraphStepParams } from '@/services/retrieval-service';

/**
 * Chặn tại chỗ nhập những cấu hình mà backend sẽ từ chối.
 *
 * ── Vì sao client kiểm lại một luật đã có ở server ──
 * Đây KHÔNG phải nguồn sự thật. `normalizeStepParams` ở server mới là nơi phán
 * quyết, và màn hình luôn hiển thị phán quyết đó lấy về từ `graphStepDiagnostics`
 * sau mỗi lần lưu. Chỗ này chỉ để người gõ biết ngay lúc gõ, thay vì lưu xong
 * mới phát hiện dòng của mình bị vứt.
 *
 * Hệ quả của việc nhầm hai vai: nếu bản sao này lệch khỏi server, triệu chứng là
 * màn hình cho lưu một dòng rồi báo lại "đã bị từ chối" — khó chịu, nhưng vẫn
 * ĐÚNG. Nếu nó được coi là nguồn sự thật thì triệu chứng là màn hình nói cấu
 * hình đang chạy trong khi không, tức đúng cái sai mà cả màn hình này sinh ra để
 * chữa. Nên mọi nhãn "đang chạy" phải đến từ server, không từ file này.
 */

export const WEIGHT_FIELDS = [
    { key: 'wWorkCenter', label: 'Work centre' },
    { key: 'wMaterial', label: 'Material' },
    { key: 'wMaterialFamily', label: 'Material family' },
    { key: 'wDefectCode', label: 'Defect code' },
    { key: 'wKeywords', label: 'Keywords (per word)' },
    { key: 'wContainment', label: 'Containment action' },
    { key: 'wCorrective', label: 'Corrective action' },
    { key: 'wPreventive', label: 'Preventive action' },
] as const satisfies ReadonlyArray<{ key: keyof GraphStepParams; label: string }>;

export const ACTION_TYPES = ['Containment', 'Corrective', 'Preventive'] as const;

export interface FieldIssue {
    field: string;
    message: string;
}

function num(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Những vi phạm khiến backend vứt cả dòng và dùng mặc định.
 *
 * Trả về danh sách rỗng nghĩa là dòng sẽ được nhận — không phải nghĩa là con số
 * hay. Đây là kiểm tính hợp lệ, không phải kiểm chất lượng.
 */
export function validateStepParams(draft: GraphStepParams): FieldIssue[] {
    const issues: FieldIssue[] = [];
    const minScore = num(draft.minScore);

    const weights = WEIGHT_FIELDS
        .map(({ key }) => num(draft[key] as number | null))
        .filter((w): w is number => w !== null && w > 0);

    if (!weights.length) {
        issues.push({
            field: 'weights',
            message: 'No weight above zero — this step could never find a precedent.',
        });
    }

    if (minScore === null || minScore <= 0) {
        issues.push({ field: 'minScore', message: 'Minimum score must be a positive number.' });
    }

    // Một từ khoá chung tự nó đủ điểm làm tiền lệ chính là lỗi R3 đã đóng: hai
    // case chỉ chung chữ "flange" bị đối xử như một case khớp thật.
    const keywords = num(draft.wKeywords);
    if (minScore !== null && keywords !== null && keywords >= minScore) {
        issues.push({
            field: 'wKeywords',
            message: `Keyword weight (${keywords}) must be below the minimum score (${minScore}) — `
                + 'otherwise a single shared keyword is enough to make any case a precedent.',
        });
    }

    // Cùng luật, cùng lý do: không tín hiệu đơn lẻ nào được tự mình quyết.
    const rerank = num(draft.wRerank);
    if (minScore !== null && rerank !== null && rerank > 0 && rerank >= minScore) {
        issues.push({
            field: 'wRerank',
            message: `Re-rank weight (${rerank}) must be below the minimum score (${minScore}) — `
                + 'otherwise the model alone decides, even for a case sharing no relation in the graph.',
        });
    }

    const floor = num(draft.rerankFloor);
    if (floor !== null && (floor < 0 || floor > 1)) {
        issues.push({ field: 'rerankFloor', message: 'Re-rank floor must be between 0 and 1.' });
    }

    const topN = num(draft.topN);
    if (topN !== null && topN <= 0) {
        issues.push({ field: 'topN', message: 'Top N must be a positive number.' });
    }

    return issues;
}

export function issueFor(issues: FieldIssue[], field: string): string | null {
    return issues.find((i) => i.field === field)?.message ?? null;
}

/**
 * Ô trống phải về `null`, KHÔNG về `0`.
 *
 * Với trọng số, `null` nghĩa là bước không cân loại đó và nó sẽ không xuất hiện
 * trong đường bằng chứng; `0` cũng không cộng điểm nhưng vẫn là một lựa chọn đã
 * khai. Với `rerankFloor` thì khác biệt còn nặng hơn: trống ⇒ rơi về sàn mặc
 * định của bước, còn `0` nghĩa là KHÔNG CÓ SÀN — mọi phán quyết của model đều
 * được tính, ngược hẳn ý định của người vừa xoá ô.
 */
export function parseNumberInput(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
}
