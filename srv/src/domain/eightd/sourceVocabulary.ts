/**
 * Kiểm tra `sources` bằng cách GIẢI đường dẫn trên chính `CaseContext`.
 *
 * ── Vì sao cần cái này ──
 * `sources` là trụ cột chống bịa: nó bắt model chỉ ra fact nào chống lưng cho
 * lời nó viết. Không kiểm thì model viết gì cũng được — kể cả đường dẫn không
 * tồn tại — và lớp phòng thủ trở thành trang trí.
 *
 * ── Vì sao giải đường dẫn thay vì liệt kê từ vựng ──
 * Bản đầu tiên liệt kê tay danh sách đường dẫn hợp lệ. Chạy thật với AI Core
 * thì nó báo sai 4 chỗ trên 4 case: model trích `product.batchId`,
 * `header.quantityExtent`, `header.status`, `origin` — đều là trường CÓ THẬT,
 * chỉ là danh sách tay của tôi quá thô nên không có. Model trích dẫn chính xác
 * hơn mức tôi cho phép, và bị phạt vì điều đó.
 *
 * Giải đường dẫn trực tiếp trên object thì vừa công bằng hơn (mọi trường thật
 * đều được chấp nhận, kể cả trường thêm sau này) vừa chặt hơn (chỉ số vượt biên
 * và tên bịa vẫn bị bắt) mà không phải bảo trì danh sách nào.
 */

import type { CaseContext } from './types';

/** Một đoạn đường dẫn: tên khoá, kèm chỉ số 1-based tuỳ chọn. */
interface Segment {
    key: string;
    index?: number;
}

function parsePath(path: string): Segment[] | null {
    const trimmed = String(path ?? '').trim();
    if (!trimmed) return null;

    const segments: Segment[] = [];
    for (const part of trimmed.split('.')) {
        const m = part.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:#(\d+))?$/);
        if (!m) return null;
        const seg: Segment = { key: m[1] };
        if (m[2] !== undefined) {
            const n = Number(m[2]);
            if (n < 1) return null; // quy ước đếm từ 1
            seg.index = n;
        }
        segments.push(seg);
    }
    return segments.length ? segments : null;
}

/**
 * Bước một đoạn. Trả `undefined` nghĩa là đường dẫn không giải được.
 *
 * Có một luật đặc biệt: khi đang đứng ở một MẢNG mà đoạn tiếp theo là chữ,
 * thử khớp theo trường `category`. Nhờ vậy `ishikawa.Machine` hoạt động —
 * đây là cách tự nhiên nhất để trỏ vào một dòng Ishikawa, và model dùng nó
 * mà không cần ai dạy.
 */
function step(current: unknown, seg: Segment): unknown {
    if (current == null) return undefined;

    let next: unknown;

    if (Array.isArray(current)) {
        const match = current.find(
            (row) => row && typeof row === 'object' && (row as any).category === seg.key,
        );
        next = match ?? undefined;
    } else if (typeof current === 'object') {
        if (!(seg.key in (current as object))) return undefined;
        next = (current as Record<string, unknown>)[seg.key];
    } else {
        return undefined;
    }

    if (seg.index === undefined) return next;

    if (!Array.isArray(next)) return undefined;
    // Chỉ số vượt biên là dấu hiệu bịa: 'fiveWhy#7' trên case có 3 bước.
    return seg.index <= next.length ? next[seg.index - 1] : undefined;
}

export interface SourceVocabulary {
    /** true nếu đường dẫn giải được trên case này. */
    has(path: string): boolean;
}

/**
 * @param context    Fact của case đang chạy
 * @param enrichment Output bước AI thứ nhất, để `enrichment.derivedFacts#N` giải được
 */
export function buildSourceVocabulary(
    context: CaseContext,
    enrichment?: unknown,
    independent?: unknown,
    precedents?: unknown,
): SourceVocabulary {
    const root: Record<string, unknown> = {
        ...context,
        // Bước sinh 8D nhận cả bốn object, nên `sources` được phép trỏ vào cả bốn.
        enrichment: enrichment ?? { derivedFacts: [], dataQualityNotes: [], unmapped: [] },
        independent: independent ?? null,
        // Không có tiền lệ thì để MẢNG RỖNG, không phải null: `precedents#1` khi
        // đó giải không ra và bị loại — đúng ý, vì model không được trích dẫn
        // một case tiền lệ không tồn tại.
        precedents: precedents ?? [],
    };

    return {
        has(path: string): boolean {
            const segments = parsePath(path);
            if (!segments) return false;

            let cursor: unknown = root;
            for (const seg of segments) {
                cursor = step(cursor, seg);
                if (cursor === undefined) return false;
            }
            // `null` là giá trị hợp lệ — trỏ vào 'fmea: null' là nói sự thật
            // rằng case không có FMEA, không phải bịa.
            return true;
        },
    };
}

export interface SourceCheck {
    known: string[];
    unknown: string[];
}

/** Tách `sources` thành phần giải được và phần không. */
export function checkSources(sources: string[], vocab: SourceVocabulary): SourceCheck {
    const known: string[] = [];
    const unknown: string[] = [];
    for (const s of sources) (vocab.has(s) ? known : unknown).push(s);
    return { known, unknown };
}
