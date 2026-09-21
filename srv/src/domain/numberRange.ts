/**
 * Cấp số từ dải số — bản Node của NRIV (SAP).
 *
 * Xem `db/schema/number-ranges.cds` để biết vì sao bảng này tồn tại. File này
 * chỉ trả lời một câu: làm sao hai người bấm Lưu cùng lúc nhận hai số khác nhau.
 */

import cds from '@sap/cds';

// Lấy thẳng từ `cds.ql` chứ không dùng biến toàn cục `SELECT`/`UPDATE`. Hai cái
// đó chỉ tồn tại sau khi runtime của cds khởi động; test unit thì không khởi
// động nó, và một module domain không nên đòi hỏi điều kiện đó để nạp được.
//
// Và phải đọc LÚC GỌI, không phải lúc import: `cds.ql` cũng chưa có ở thời điểm
// nạp module, nên destructure ở đây làm mọi file import gián tiếp file này chết
// ngay dòng `import` — kể cả file chỉ cần `formatNumber` hay `numericPart`, vốn
// là hai hàm thuần không đụng gì tới database.
const ql = () => cds.ql as { SELECT: any; UPDATE: any };

const TABLE = 'cnma.proresolve.NumberRanges';

/** Bao nhiêu lần thử lại khi có người khác giành mất số. */
const MAX_ATTEMPTS = 12;

export interface NumberRangeRow {
    object: string;
    prefix: string | null;
    currentValue: number;
    width: number;
}

/** Ghép số thành mã: prefix + số đã đệm 0 cho đủ `width`. */
export function formatNumber(prefix: string | null, value: number, width: number): string {
    const digits = String(value).padStart(Math.max(1, Number(width) || 1), '0');
    return `${prefix ?? ''}${digits}`;
}

/**
 * Cấp một số mới cho `object`.
 *
 * ── Vì sao compare-and-swap chứ không phải `SET currentValue = currentValue + 1` ──
 * Câu lệnh cộng-dồn là nguyên tử ở tầng SQL, nhưng nó KHÔNG cho biết mình vừa
 * cộng ra số nào — phải SELECT lại, và giữa UPDATE với SELECT lại có người khác
 * chen vào. CAS thì đọc trước, ghi có điều kiện: `WHERE currentValue = <giá trị
 * vừa đọc>`. Ai ghi được 1 dòng là chủ của số đó; ai ghi được 0 dòng thì đọc lại
 * và thử tiếp. Không cần khoá bảng, và chạy y hệt trên SQLite lẫn HANA.
 *
 * ── Vì sao còn kiểm tra trùng ──
 * Dải số không phải nguồn duy nhất sinh ra mã: dữ liệu nhập từ ngoài mang số của
 * chính nó, và người dùng vẫn gõ tay được. Nên bộ đếm có thể tụt lại sau bảng
 * thật. `exists` để chỗ gọi khai cách kiểm tra, và vòng lặp nhảy qua những số đã
 * bị chiếm — thay vì trả về một mã sẽ vỡ ở ràng buộc unique.
 *
 * Phải chạy TRONG transaction của lệnh insert (`cds.tx(req)` khi gọi từ handler),
 * nếu không thì insert hỏng mà số đã bị đốt.
 */
export async function allocateNumber(
    tx: any,
    object: string,
    exists?: (code: string) => Promise<boolean>,
): Promise<string> {
    const { SELECT, UPDATE } = ql();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const row: NumberRangeRow | undefined = await tx.run(
            SELECT.one.from(TABLE).columns('object', 'prefix', 'currentValue', 'width').where({ object }),
        );
        if (!row) {
            throw new Error(
                `Number range object '${object}' is not defined. `
                + 'Add a row to cnma.proresolve.NumberRanges before creating records.',
            );
        }

        const current = Number(row.currentValue) || 0;
        const next = current + 1;

        const changed = await tx.run(
            UPDATE.entity(TABLE).set({ currentValue: next }).where({ object, currentValue: current }),
        );
        // Người khác đã lấy mất số này giữa lúc đọc và ghi. Đọc lại, không phải lỗi.
        if (!changed) continue;

        const code = formatNumber(row.prefix, next, row.width);
        if (exists && (await exists(code))) continue;
        return code;
    }

    throw new Error(
        `Could not allocate a number for '${object}' after ${MAX_ATTEMPTS} attempts — `
        + 'the range may be exhausted or heavily contended.',
    );
}

/**
 * Đưa bộ đếm lên ít nhất `value`.
 *
 * Dùng sau khi nhập dữ liệu mang mã của chính nó: nếu không kéo bộ đếm theo, số
 * cấp kế tiếp sẽ rơi vào giữa vùng đã bị chiếm và mọi lần lưu đều phải quay vòng
 * qua vòng lặp kiểm-tra-trùng ở trên. Không bao giờ hạ bộ đếm xuống — một số đã
 * cấp thì đã cấp, kể cả khi bản ghi mang nó bị xoá.
 */
export async function raiseNumberRange(tx: any, object: string, value: number): Promise<void> {
    const { SELECT, UPDATE } = ql();
    const row = await tx.run(SELECT.one.from(TABLE).columns('object', 'currentValue').where({ object }));
    if (!row) return;
    const current = Number(row.currentValue) || 0;
    if (value > current) {
        await tx.run(UPDATE.entity(TABLE).set({ currentValue: value }).where({ object, currentValue: current }));
    }
}

/** Phần số của một mã đã có, để `raiseNumberRange` biết cần kéo tới đâu. */
export function numericPart(code: string | null | undefined): number | null {
    const m = String(code ?? '').match(/(\d+)\s*$/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isSafeInteger(n) ? n : null;
}

/**
 * Xem trước số kế tiếp mà không làm tăng bộ đếm dải số.
 * Dùng để hiển thị trước mã số tự sinh trên giao diện form.
 */
export async function peekNextNumber(
    tx: any,
    object: string,
    exists?: (code: string) => Promise<boolean>,
): Promise<string> {
    const { SELECT } = ql();
    const row: NumberRangeRow | undefined = await tx.run(
        SELECT.one.from(TABLE).columns('object', 'prefix', 'currentValue', 'width').where({ object }),
    );

    let next = 1;
    let prefix: string | null = '';
    let width = 8;

    if (row) {
        next = (Number(row.currentValue) || 0) + 1;
        prefix = row.prefix;
        width = row.width;
    } else {
        if (object === 'DEFECT') {
            prefix = '8D-';
            next = 10049121;
            width = 8;
        } else if (object === 'INSPLOT') {
            prefix = '';
            next = 10000109;
            width = 10;
        }
    }

    let code = formatNumber(prefix, next, width);
    if (exists) {
        let attempts = 0;
        while (attempts < 100 && (await exists(code))) {
            next++;
            code = formatNumber(prefix, next, width);
            attempts++;
        }
    }
    return code;
}
