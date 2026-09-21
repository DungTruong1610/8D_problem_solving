/**
 * Script gạt công tắc giữa 2 engine truy hồi: 'graph' và 'scoring'.
 * 
 * Cách dùng:
 *   node scripts/toggle-graph-engine.mjs graph      # Bật GraphDB (OpenCypher)
 *   node scripts/toggle-graph-engine.mjs scoring    # Bật Scoring (Vector Search cũ)
 *   node scripts/toggle-graph-engine.mjs status     # Xem trạng thái hiện tại
 */
import cds from '@sap/cds';

const target = process.argv[2]?.toLowerCase() || 'status';

if (!['graph', 'scoring', 'status'].includes(target)) {
    console.error('Lựa chọn không hợp lệ! Hãy dùng: node scripts/toggle-graph-engine.mjs <graph|scoring|status>');
    process.exit(1);
}

const TABLE = 'cnma.proresolve.GraphRetrievalSettings';

try {
    const db = await cds.connect.to('db');

    if (target === 'status') {
        const rows = await db.run(SELECT.from(TABLE).where({ ID: 'GLOBAL' }));
        const current = rows[0]?.engine || 'graph (chưa khởi tạo/mặc định)';
        console.log(`\n📌 Engine hiện tại: [${current}]`);
        console.log(`- fallbackEnabled: ${rows[0]?.fallbackEnabled ?? true}`);
        console.log(`- maxKeywords: ${rows[0]?.maxKeywords ?? 30}\n`);
    } else {
        const rows = await db.run(SELECT.from(TABLE).where({ ID: 'GLOBAL' }));
        if (rows.length === 0) {
            await db.run(INSERT.into(TABLE).entries({ ID: 'GLOBAL', engine: target, fallbackEnabled: true }));
        } else {
            await db.run(UPDATE(TABLE).set({ engine: target }).where({ ID: 'GLOBAL' }));
        }
        console.log(`\n✅ Đã gạt công tắc engine sang: [${target.toUpperCase()}] thành công!`);
        console.log(`(Lưu ý: Bộ nhớ cache backend sẽ áp dụng giá trị mới trong vòng tối đa 30 giây).\n`);
    }
} catch (e) {
    console.error(`❌ Lỗi khi cập nhật engine: ${e.message}`);
    process.exit(1);
}
