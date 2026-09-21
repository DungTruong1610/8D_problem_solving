/**
 * Giải một đường dẫn nguồn của 8D về đúng mẩu dữ liệu trong CaseContext.
 *
 * ── Vì sao nằm ở shared/ ──
 * Backend sinh ra các đường dẫn này và loại bỏ đường không giải được; frontend
 * phải giải LẠI đúng như thế để hiện bằng chứng khi người dùng bấm vào. Hai bản
 * cài đặt riêng sẽ lệch nhau lúc nào không biết, và triệu chứng là UI báo "không
 * tìm thấy" cho một đường dẫn backend coi là hợp lệ.
 *
 * Cú pháp (khai trong EIGHT_D_RULES ở srv/src/domain/eightd/prompts.ts):
 *   - dấu chấm cho field:            header.quantityExtent
 *   - #N cho phần tử mảng, ĐẾM TỪ 1: fiveWhy#2 · actions.containment#1
 *   - tên category tra mảng Ishikawa: ishikawa.Machine
 *   - cả nút cũng hợp lệ:            team · rootCause · gaps
 */

export interface ResolvedEvidence {
    /** Đường dẫn đã hỏi, nguyên văn. */
    path: string;
    found: boolean;
    /** Giá trị tìm được. Chỉ có nghĩa khi `found`. */
    value?: unknown;
    /** Vì sao không giải được — hiện thẳng cho người dùng, đừng nuốt. */
    reason?: string;
}

/** `#N` đếm từ 1 vì prompt nói vậy; lệch một đơn vị ở đây là trích dẫn sai bằng chứng. */
const INDEXED = /^(.+)#(\d+)$/;

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

/**
 * Tra một phần tử của mảng Ishikawa bằng TÊN CATEGORY.
 *
 * `ishikawa` là mảng 6 dòng, mỗi dòng có `category`. Prompt cho phép viết
 * `ishikawa.Machine`, nên đoạn sau dấu chấm không phải tên field mà là giá trị
 * cần tìm. Bỏ qua nhánh này thì mọi trích dẫn Ishikawa đều hiện "không tìm thấy".
 */
function lookupInArray(list: unknown[], key: string): unknown {
    const needle = key.trim().toLowerCase();
    return list.find((item) => {
        const row = asRecord(item);
        if (!row) return false;
        for (const field of ['category', 'code', 'key', 'name']) {
            const value = row[field];
            if (typeof value === 'string' && value.trim().toLowerCase() === needle) return true;
        }
        return false;
    });
}

export function resolveEvidencePath(root: unknown, path: string): ResolvedEvidence {
    const trimmed = (path ?? '').trim();
    if (!trimmed) return { path, found: false, reason: 'Empty path.' };

    let current: unknown = root;

    for (const rawSegment of trimmed.split('.')) {
        if (current == null) {
            return { path, found: false, reason: `"${rawSegment}" has no parent value.` };
        }

        const indexed = rawSegment.match(INDEXED);
        const name = indexed ? indexed[1] : rawSegment;

        if (name) {
            if (Array.isArray(current)) {
                const hit = lookupInArray(current, name);
                if (hit === undefined) {
                    return { path, found: false, reason: `No entry named "${name}" in this list.` };
                }
                current = hit;
            } else {
                const record = asRecord(current);
                if (!record || !(name in record)) {
                    return { path, found: false, reason: `"${name}" does not exist here.` };
                }
                current = record[name];
            }
        }

        if (indexed) {
            const position = Number(indexed[2]);
            if (!Array.isArray(current)) {
                return { path, found: false, reason: `"${name}" is not a list, so #${position} means nothing.` };
            }
            // Trích dẫn quá số phần tử thật là bịa — backend cũng loại, nên nói rõ
            // con số để người đọc thấy ngay sai ở đâu.
            if (position < 1 || position > current.length) {
                return {
                    path,
                    found: false,
                    reason: `#${position} is out of range — "${name}" has ${current.length} entr${current.length === 1 ? 'y' : 'ies'}.`,
                };
            }
            current = current[position - 1];
        }
    }

    if (current === undefined) return { path, found: false, reason: 'Resolved to nothing.' };
    return { path, found: true, value: current };
}

/** Giải nhiều đường dẫn một lượt, giữ nguyên thứ tự đầu vào. */
export function resolveEvidencePaths(root: unknown, paths: readonly string[]): ResolvedEvidence[] {
    return paths.map((p) => resolveEvidencePath(root, p));
}
