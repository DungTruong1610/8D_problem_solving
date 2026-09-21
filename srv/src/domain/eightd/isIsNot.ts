/**
 * Tính toán Is / Is-Not tất định từ lịch sử kiểm tra lô (SAP QM QALS/QAMR).
 *
 * ── Quy tắc nghiệp vụ (R2.2.3) ──
 * 1. Gom các lô kiểm tra theo thiết bị/đồ gá (equipment).
 * 2. Tính tỷ lệ không đạt (nonConforming rate) của từng nhóm (yêu cầu mỗi nhóm >= minGroupSize lô).
 * 3. So sánh nhóm có tỷ lệ lỗi cao nhất (IS) với nhóm có tỷ lệ lỗi thấp nhất (IS NOT).
 * 4. Nếu độ tương phản (contrast) >= minContrast (mặc định 25%), xác định đây là manh mối chính.
 * 5. Nếu không đủ điều kiện so sánh (không có đặc tính đo, thiếu dữ liệu lô, không đủ 2 nhóm thiết bị,
 *    hoặc độ tương phản không đáng kể), trả về applicable = false kèm lý do rõ ràng.
 */

import type { HistoricalInspectionLot } from './types';

export interface IsIsNotResult {
    applicable: boolean;
    reason?: string;
    is?: string[];
    isNot?: string[];
    isIsNotBasis?: string;
    lotIds?: string[];
}

export const DEFAULT_MIN_GROUP_SIZE = 2;
export const DEFAULT_MIN_CONTRAST = 0.25;

export function computeIsIsNot(
    lots?: HistoricalInspectionLot[],
    characteristic?: string,
    minGroupSize = DEFAULT_MIN_GROUP_SIZE,
    minContrast = DEFAULT_MIN_CONTRAST,
): IsIsNotResult {
    if (!characteristic || !characteristic.trim()) {
        return {
            applicable: false,
            reason: 'Not applicable — this defect has no measurable characteristic.',
        };
    }

    if (!lots || lots.length === 0) {
        return {
            applicable: false,
            reason: 'Cannot compare — there is no measurement history for this part.',
        };
    }

    // Lọc các lô thuộc đúng đặc tính đang kiểm tra
    const matchingLots = lots.filter(
        (l) => l.characteristic && l.characteristic.trim().toLowerCase() === characteristic.trim().toLowerCase(),
    );

    if (matchingLots.length === 0) {
        return {
            applicable: false,
            reason: `Cannot compare — no historical inspection lots found for characteristic "${characteristic}".`,
        };
    }

    // Gom nhóm theo equipment
    const groups = new Map<string, { total: number; nonConforming: number; lots: HistoricalInspectionLot[] }>();
    for (const lot of matchingLots) {
        const eq = (lot.equipment || 'Unknown').trim();
        if (!groups.has(eq)) {
            groups.set(eq, { total: 0, nonConforming: 0, lots: [] });
        }
        const g = groups.get(eq)!;
        g.total += 1;
        if (!lot.conforming) g.nonConforming += 1;
        g.lots.push(lot);
    }

    // Lọc nhóm đủ số lượng tối thiểu
    const qualifying = Array.from(groups.entries())
        .filter(([_, g]) => g.total >= minGroupSize)
        .map(([eq, g]) => ({
            equipment: eq,
            total: g.total,
            nonConforming: g.nonConforming,
            rate: g.nonConforming / g.total,
            lots: g.lots,
        }));

    if (qualifying.length < 2) {
        return {
            applicable: false,
            reason: 'Cannot compare — insufficient inspection lots across different equipment groups.',
        };
    }

    // Sắp xếp theo tỷ lệ lỗi giảm dần
    qualifying.sort((a, b) => b.rate - a.rate);
    const worst = qualifying[0];
    const best = qualifying[qualifying.length - 1];
    const contrast = worst.rate - best.rate;

    if (contrast < minContrast) {
        return {
            applicable: false,
            reason: `No significant contrast across equipment groups (contrast ${(contrast * 100).toFixed(0)}% < ${(minContrast * 100).toFixed(0)}%).`,
        };
    }

    const worstLots = worst.lots.map((l) => l.lotId).join(', ');
    const bestLots = best.lots.map((l) => l.lotId).join(', ');
    const worstPercent = (worst.rate * 100).toFixed(0);
    const bestPercent = (best.rate * 100).toFixed(0);

    return {
        applicable: true,
        is: [`Defect occurs on ${worst.equipment} (${worstPercent}% non-conforming, lots: ${worstLots})`],
        isNot: [`Defect does not occur on ${best.equipment} (${bestPercent}% non-conforming, lots: ${bestLots})`],
        isIsNotBasis: [
            `- **Lead Isolation:** The contrast between **${worst.equipment}** (${worstPercent}% non-conforming) and **${best.equipment}** (${bestPercent}% non-conforming) isolates **${worst.equipment}** as the primary lead.`,
            `- **Baseline Consistency:** Both equipment groups process the same material and inspect characteristic **${characteristic}**, confirming equipment/fixture is the sole distinguishing factor.`,
            `- **Inspected Batches:** Evaluated ${worst.lots.length} lots from ${worst.equipment} (lots: ${worstLots}) against ${best.lots.length} lots from ${best.equipment} (lots: ${bestLots}).`,
        ].join('\n'),
        lotIds: [...worst.lots.map((l) => l.lotId), ...best.lots.map((l) => l.lotId)],
    };
}
