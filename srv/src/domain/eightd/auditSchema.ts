/**
 * Thêm cột mới của `ReviewEvents` vào một file SQLite ĐÃ CÓ dữ liệu.
 *
 * ── Vì sao cần ──
 * `cds deploy` dựng bảng từ đầu — đúng cho bản build trên Render (DB mới mỗi
 * lần deploy), nhưng với `db.sqlite` local đang chứa case thật thì deploy lại
 * nghĩa là mất dữ liệu. CAP không tự thêm cột vào bảng SQLite có sẵn, nên server
 * sẽ ghi vào cột không tồn tại và mọi lần duyệt đều lỗi.
 *
 * Chỉ `ALTER TABLE ... ADD COLUMN` cho cột còn thiếu: idempotent, không đụng tới
 * hàng cũ (cột mới là null), chạy mỗi lần khởi động mà không tốn gì khi đã đủ.
 */

import cds from '@sap/cds';

export const REVIEW_EVENTS_TABLE = 'cnma_proresolve_ReviewEvents';

/** Cột mới và kiểu SQLite tương ứng với khai báo CDS (`String(n)` → NVARCHAR, `LargeString` → NCLOB). */
export const REVIEW_EVENT_COLUMNS: readonly (readonly [string, string])[] = [
    ['eventType', 'NVARCHAR(32)'],
    ['subjectId', 'NVARCHAR(64)'],
    ['reason', 'NVARCHAR(500)'],
    ['inputSnapshotJson', 'NCLOB'],
    ['beforeAfterJson', 'NCLOB'],
    ['traceId', 'NVARCHAR(64)'],
];

/** Cột nào còn thiếu, so không phân biệt hoa thường (SQLite cũng vậy). */
export function missingColumns(existing: readonly string[]): (readonly [string, string])[] {
    const have = new Set(existing.map((c) => c.toLowerCase()));
    return REVIEW_EVENT_COLUMNS.filter(([name]) => !have.has(name.toLowerCase()));
}

export async function ensureReviewEventColumns(): Promise<string[]> {
    if (cds.env.requires?.db?.kind !== 'sqlite') return [];
    const db: any = await cds.connect.to('db');
    const info: any[] = await db.run(`PRAGMA table_info(${REVIEW_EVENTS_TABLE})`);
    // Bảng chưa có (DB mới tinh chưa deploy) — không phải việc của migration này.
    if (!Array.isArray(info) || info.length === 0) return [];

    const added: string[] = [];
    for (const [name, type] of missingColumns(info.map((c) => String(c.name)))) {
        await db.run(`ALTER TABLE ${REVIEW_EVENTS_TABLE} ADD COLUMN ${name} ${type}`);
        added.push(name);
    }
    if (added.length) {
        cds.log('audit-schema').info(`Added ${added.join(', ')} to ${REVIEW_EVENTS_TABLE} (existing rows kept, new columns null).`);
    }
    return added;
}
