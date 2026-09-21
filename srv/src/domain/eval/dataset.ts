/**
 * Bộ dữ liệu vàng — những gì nó CHỨA, và vì sao điều đó đổi cách chấm.
 *
 * ── Vì sao file này tồn tại ──
 * Một thang chấm chung sẽ cho ra một con số cho mọi case như nhau. Bộ dữ liệu này
 * thì không đồng nhất: nó có 25 cặp sạch/bẩn cùng mô tả MỘT sự thật, bốn case
 * không ai đánh dấu nguyên nhân gốc, và hai case mà kỹ sư ghi SAI — AI lệch với
 * họ và AI đúng.
 *
 * Chấm cả ba nhóm bằng cùng một phép đo sẽ cho ra những con số nghe hợp lý mà
 * dẫn tới kết luận sai. Nặng nhất là `agreementRate`: tối đa hoá nó trên hai case
 * mập mờ nghĩa là dạy pipeline nhường một kỹ sư đang sai.
 *
 * Xem `mock-data/README.md` — file này là bản mã hoá của tài liệu đó.
 */

/**
 * Ghép cặp bằng bảy chữ số cuối: `8D-1`0048412 ↔ `8D-9`0048412.
 *
 * Chữ số thứ ba mang nghĩa: `1` = bản chỉn chu dựng ngược từ báo cáo đã hoàn
 * thành, `9` = cùng sự thật đó ghi lại như dữ liệu SAP thật — tiếng Đức viết tắt,
 * dấu phẩy thập phân, số đo nằm trong câu, Ishikawa chỉ 2–3 nhánh.
 */
const CLEAN_PREFIX = '8D-1';
const DIRTY_PREFIX = '8D-9';

export type CaseVariant = 'clean' | 'dirty' | 'unknown';

export function variantOf(notificationId: string): CaseVariant {
    if (notificationId.startsWith(CLEAN_PREFIX)) return 'clean';
    if (notificationId.startsWith(DIRTY_PREFIX)) return 'dirty';
    return 'unknown';
}

/** `8D-10048412` → `8D-90048412`, và ngược lại. Null khi mã không thuộc cặp nào. */
export function twinOf(notificationId: string): string | null {
    const variant = variantOf(notificationId);
    if (variant === 'unknown') return null;
    const tail = notificationId.slice(CLEAN_PREFIX.length);
    return `${variant === 'clean' ? DIRTY_PREFIX : CLEAN_PREFIX}${tail}`;
}

/**
 * Bốn case kỹ sư điều tra xong nhưng KHÔNG kết luận nguyên nhân gốc.
 *
 * ── Vì sao phải biết trước ──
 * Không có gì để đối chiếu, nên `agreementRate` trên các case này là **không đo
 * được**, không phải 0%. Báo 0% ở đây trông như "AI sai hết" trong khi thật ra là
 * "không ai ghi đáp án".
 *
 * Đây cũng là nhóm case đáng giá nhất: AI trở thành người DUY NHẤT đưa ra kết
 * luận, nên `grounding` và `gap-honesty` là hai chiều phải nhìn — nếu AI bịa một
 * nguyên nhân ở đây thì không có kỹ sư nào phản biện nó.
 */
export const UNMARKED_ROOT_CAUSE: readonly string[] = Object.freeze([
    '8D-90048577', '8D-90048603', '8D-90048857', '8D-90048903',
]);

/**
 * Hai case kỹ sư ghi SAI, và AI lệch với họ — đúng.
 *
 *   8D-…48880  kỹ sư ghi Man; dòng Man không có số liệu nào, dòng Machine có bộ
 *              đổi dao lệch 0,9mm so với giới hạn 0,2mm, và Is/Is-Not cho thấy
 *              lỗi xuất hiện ở cả ba ca — mâu thuẫn với việc đổ lỗi một người.
 *              AI chọn Machine.
 *   8D-…48903  kỹ sư ghi Method; gloss meter R&R 31% (trên ngưỡng MSA 30%) và
 *              cùng panel đó đo ở lab lại đạt. AI chọn Measurement.
 *
 * ── Vì sao chúng PHẢI bị loại khỏi agreementRate ──
 * Trên hai case này, `aiAgreesWithRecord = false` là câu trả lời ĐÚNG. Gộp chúng
 * vào tỉ lệ trùng khớp nghĩa là trừng phạt pipeline vì đã đúng — và tối ưu theo
 * con số đó sẽ dạy nó nhường một kỹ sư đang sai. Đó là một chỉ số phản tác dụng
 * theo nghĩa chặt: cải thiện nó làm sản phẩm xấu đi.
 *
 * Chúng được báo cáo RIÊNG, dưới tên đúng của nó: bất đồng có căn cứ.
 */
export const CONTESTED_ROOT_CAUSE: ReadonlyArray<{
    tail: string;
    recorded: string;
    aiExpected: string;
    why: string;
}> = Object.freeze([
    {
        tail: '0048880',
        recorded: 'Man',
        aiExpected: 'Machine',
        why: 'Dòng Man không có số liệu; bộ đổi dao lệch 0,9mm so với giới hạn 0,2mm; lỗi xuất hiện ở cả ba ca.',
    },
    {
        tail: '0048903',
        recorded: 'Method',
        aiExpected: 'Measurement',
        why: 'Gloss meter R&R 31% vượt ngưỡng MSA 30%; cùng panel đo ở lab lại đạt.',
    },
]);

/** Case này có nằm trong nhóm bất đồng có căn cứ hay không (cả bản sạch và bẩn). */
export function contestedEntry(notificationId: string) {
    const tail = notificationId.slice(CLEAN_PREFIX.length);
    return CONTESTED_ROOT_CAUSE.find((c) => c.tail === tail) ?? null;
}

/**
 * `agreementRate` có nghĩa với case này hay không.
 *
 * Ba nhóm, và chỉ nhóm đầu được vào tỉ lệ:
 *   measurable   có đáp án, và đáp án đó không bị tranh chấp
 *   contested    kỹ sư ghi sai — bất đồng là ĐÚNG, báo riêng
 *   unmarked     không ai ghi đáp án — không đo được
 *
 * ── Thứ tự xét KHÔNG tuỳ tiện: `unmarked` phải đứng trước `contested` ──
 * `8D-…48903` nằm ở CẢ HAI danh sách, và đó không phải trùng lặp: bản SẠCH có
 * kỹ sư ghi `Method` (sai — gloss meter R&R 31% vượt ngưỡng MSA), còn bản BẨN thì
 * không ai kịp đánh dấu gì. Cùng một sự thật, hai cách ghi lại, hai tình trạng
 * khác nhau.
 *
 * Không ai ghi đáp án thì KHÔNG CÓ GÌ để tranh chấp — nên `unmarked` thắng. Đảo
 * thứ tự lại sẽ đưa `8D-90048903` vào nhóm "bất đồng có căn cứ" và khẳng định AI
 * lệch với một bản ghi không tồn tại.
 */
export type AgreementEligibility = 'measurable' | 'contested' | 'unmarked';

export function agreementEligibility(notificationId: string): AgreementEligibility {
    if (UNMARKED_ROOT_CAUSE.includes(notificationId)) return 'unmarked';
    if (contestedEntry(notificationId)) return 'contested';
    return 'measurable';
}

/**
 * Chia một danh sách mã case thành cặp sạch/bẩn.
 *
 * Case lẻ (chỉ có một nửa của cặp) đi vào `unpaired` chứ không bị bỏ: một cặp
 * thiếu nửa là dấu hiệu bộ dữ liệu bị nạp thiếu, và im lặng bỏ nó đi sẽ làm phép
 * đo độ bền chạy trên ít cặp hơn tưởng mà không báo gì.
 */
export function pairUp(notificationIds: readonly string[]): {
    pairs: Array<{ clean: string; dirty: string }>;
    unpaired: string[];
} {
    const present = new Set(notificationIds);
    const pairs: Array<{ clean: string; dirty: string }> = [];
    const paired = new Set<string>();

    for (const id of notificationIds) {
        if (variantOf(id) !== 'clean' || paired.has(id)) continue;
        const twin = twinOf(id);
        if (twin && present.has(twin)) {
            pairs.push({ clean: id, dirty: twin });
            paired.add(id);
            paired.add(twin);
        }
    }

    return {
        pairs,
        unpaired: notificationIds.filter((id) => !paired.has(id)),
    };
}
