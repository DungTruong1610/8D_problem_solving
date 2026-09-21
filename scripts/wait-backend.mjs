/**
 * Chặn Vite khởi động cho tới khi backend mở cổng.
 *
 * `concurrently` phóng BE và FE cùng lúc, nhưng BE hybrid cần ~7-10s để resolve
 * binding CF và nối HANA. Vite thì lên trong dưới 1 giây — browser (thường đang
 * mở sẵn tab) lập tức bắn API vào cổng chưa có ai nghe, và console ngập
 * ECONNREFUSED cho tới khi BE lên. Không có gì hỏng, nhưng nhìn y hệt như hỏng.
 *
 * Poll /health (route express thuần, không cần auth) tối đa 120s. Quá hạn thì
 * VẪN cho Vite chạy — proxy tự hồi khi BE lên, và chặn hẳn FE vì BE trục trặc
 * thì tệ hơn là ồn console.
 */
const url = process.env.BACKEND_HEALTH_URL ?? 'http://127.0.0.1:4008/health';
const deadlineMs = 120_000;
const start = Date.now();

console.log(`[wait-backend] chờ backend tại ${url} ...`);
while (Date.now() - start < deadlineMs) {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
        if (res.ok) {
            console.log(`[wait-backend] backend sẵn sàng sau ${((Date.now() - start) / 1000).toFixed(1)}s.`);
            process.exit(0);
        }
    } catch {
        // chưa lên — thử lại
    }
    await new Promise((r) => setTimeout(r, 1_000));
}
console.warn(`[wait-backend] backend chưa lên sau ${deadlineMs / 1000}s — vẫn khởi động Vite (proxy sẽ tự hồi).`);
process.exit(0);
