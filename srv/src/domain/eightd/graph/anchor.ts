/**
 * `CaseContext` → những giá trị mà câu Cypher neo vào.
 *
 * ── Vì sao neo bằng GIÁ TRỊ, không bằng một đỉnh của case đang mở ──
 * Case đang phân tích chưa nằm trong graph, và không nên nằm: graph dựng trên
 * `HistoricalCases`, còn case đang mở là một `Reports` chưa đóng. Thêm nó vào
 * nghĩa là mỗi lần phân tích phải ghi một dòng rồi dọn đi — một tác dụng phụ
 * lên dữ liệu chỉ để phục vụ một câu truy vấn đọc.
 *
 * Nên các truy vấn bắt đầu từ những đỉnh mà case đang mở TRỎ TỚI: work center
 * của nó, vật tư của nó, các từ khoá của nó. Cách này không cần ghi gì cả, và
 * nó cũng đúng về mặt ngữ nghĩa — câu hỏi thật sự là *"những case nào chạm vào
 * cùng các đỉnh này"*.
 *
 * Hàm ở đây là HÀM THUẦN: không DB, không AI. Test được bằng một object thường.
 */

import { tokenizeDefectText } from '../precedent/scoring';
import type { CaseContext } from '../types';

/**
 * Số từ khoá tối đa đem đi truy vấn.
 *
 * Mỗi token thành một tham số bind, nên đây cũng là trần số tham số. 30 là rộng
 * rãi: mô tả lỗi dài nhất trong kho hiện cho 12 token sau khi loại stopword.
 * Có trần vì một payload bất thường không được phép sinh ra một câu truy vấn dài
 * vô hạn — nó sẽ hỏng ở tầng DB với một thông báo chẳng liên quan gì tới nguyên nhân.
 */
export const MAX_ANCHOR_KEYWORDS = 30;

export interface GraphAnchor {
    /** Case đang mở. Luôn bị loại khỏi kết quả — nó tự khớp tuyệt đối. */
    notificationId: string;
    workCenterId: string | null;
    defectCode: string | null;
    materialId: string | null;
    materialFamily: string | null;
    /**
     * Token của mô tả lỗi VÀ câu chữ người vận hành, tách bằng CHÍNH hàm đã dùng
     * lúc nạp kho. Hai cách tách khác nhau ở hai đầu là lỗi âm thầm kinh điển:
     * không bao giờ khớp mà cũng không bao giờ báo.
     */
    keywords: string[];
}

function trimmedOrNull(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text ? text : null;
}

export function buildAnchor(context: CaseContext): GraphAnchor {
    return {
        notificationId: context.notificationId,
        workCenterId: trimmedOrNull(context.product.workCenterId),
        defectCode: trimmedOrNull(context.product.defectCode),
        materialId: trimmedOrNull(context.product.materialId),
        materialFamily: trimmedOrNull(context.product.materialGroup),
        keywords: tokenizeDefectText(
            `${context.product.defectText ?? ''} ${context.header.symptomShortText ?? ''}`,
        )
            .split(' ')
            .filter(Boolean)
            .slice(0, MAX_ANCHOR_KEYWORDS),
    };
}

/**
 * `['burr','edge']` → `(k.BIZ_KEY = $kw0 OR k.BIZ_KEY = $kw1)`, kèm tham số.
 *
 * ── Vì sao chuỗi OR chứ không `IN [...]` ──
 * `IN [...]` là cách tự nhiên, và nó CHẠY với literal. Nhưng với ô bind thì
 * không: `IN [$kw0, $kw1]` bị HANA từ chối, trong khi `= $kw0 OR = $kw1` chạy —
 * đã đo trên chính instance đang dùng. Nghĩa là lựa chọn thật sự là giữa chuỗi
 * OR và việc ghép token thẳng vào văn bản truy vấn. Ghép thẳng là con đường duy
 * nhất trong toàn bộ module này mà dữ liệu từ payload SAP chạm vào câu truy vấn,
 * nên nó không được phép tồn tại. Chuỗi OR xấu hơn một chút và an toàn hoàn toàn.
 *
 * Trả `null` khi không có từ khoá nào — người gọi phải xử lý, vì một mệnh đề
 * rỗng ghép vào WHERE sẽ thành `() AND …`, một lỗi cú pháp giữa chuỗi đã ghép.
 */
export function keywordPredicate(
    keywords: readonly string[],
    variable = 'k',
): { predicate: string; params: Record<string, string> } | null {
    if (!keywords.length) return null;

    const params: Record<string, string> = {};
    const terms = keywords.map((token, i) => {
        const name = `kw${i}`;
        params[name] = token;
        return `${variable}.BIZ_KEY = $${name}`;
    });
    return { predicate: `(${terms.join(' OR ')})`, params };
}
