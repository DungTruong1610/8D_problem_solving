/**
 * Đóng gói case sạch vào artifact của srv để app tự nạp kho lúc khởi động.
 *
 * ── Vì sao cần bước này ──
 * Trên Cloud Foundry, HDI container không có credential cho ai bên ngoài, và
 * action `seedCaseLibrary` bị chặn bởi scope `admin` — token client_credentials
 * của chính app chỉ có `uaa.resource`. Nới scope đó ra chỉ để nạp dữ liệu demo
 * là đổi bảo mật lấy tiện lợi.
 *
 * Nên thay vì đẩy dữ liệu VÀO app, ta gói dữ liệu THEO app.
 *
 * ── Vì sao copy chứ không để sẵn trong srv/ ──
 * `mock-data/clean/` là nguồn duy nhất, sinh ra từ `generate.py`. Giữ một bản
 * thứ hai trong `srv/` là mời hai bản lệch nhau. Copy lúc build thì bản trong
 * `srv/` luôn là ảnh chụp của bản gốc, và nó nằm trong .gitignore.
 *
 * Chạy tự động trong `npm run build`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'mock-data', 'clean');
const DEST = path.join(ROOT, 'srv', 'data', 'case-library');

if (!fs.existsSync(SRC)) {
    console.error(`[bundle-library] Không thấy ${SRC} — bỏ qua.`);
    process.exit(0);
}

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });

const files = fs.readdirSync(SRC).filter((f) => f.startsWith('case-') && f.endsWith('.json')).sort();
for (const f of files) {
    // Ghi lại bằng JSON.stringify không xuống dòng: file gói theo app chỉ để máy
    // đọc, và nó chiếm chỗ trong mọi lần deploy.
    const raw = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
    fs.writeFileSync(path.join(DEST, f), JSON.stringify(raw), 'utf8');
}

const bytes = files.reduce((n, f) => n + fs.statSync(path.join(DEST, f)).size, 0);
console.log(`[bundle-library] Đã gói ${files.length} case (${Math.round(bytes / 1024)} KB) vào srv/data/case-library/`);

// ─────────────────────────────────────────────────────────────────────────────
// Sự vụ mẫu cho UI
//
// Trang 8D cần nạp được một sự vụ mới mà KHÔNG bắt người dùng đi tìm file trên
// máy — không ai demo được kiểu đó, và người thử app cũng chẳng có repo.
//
// Gói vào `public/` để bundle UI mang theo; approuter phục vụ chúng như tài
// nguyên tĩnh bình thường.
// ─────────────────────────────────────────────────────────────────────────────
const INCOMING = path.join(ROOT, 'mock-data', 'incoming');
const SAMPLES = path.join(ROOT, 'app', '8D_hackathon_ui', 'public', 'samples');

if (fs.existsSync(INCOMING)) {
    fs.rmSync(SAMPLES, { recursive: true, force: true });
    fs.mkdirSync(SAMPLES, { recursive: true });

    const issues = fs.readdirSync(INCOMING)
        .filter((f) => f.startsWith('issue-') && f.endsWith('.json'))
        .sort();

    const index = issues.map((f) => {
        const raw = JSON.parse(fs.readFileSync(path.join(INCOMING, f), 'utf8'));
        fs.writeFileSync(path.join(SAMPLES, f), JSON.stringify(raw), 'utf8');
        return {
            file: f,
            notificationId: raw.notificationId,
            origin: raw.origin,
            symptom: raw.symptomShortText,
            workCenter: raw.workCenter?.workCenterId ?? null,
            material: raw.material?.materialId ?? null,
            // Cho người dùng biết đây là sự vụ CHƯA điều tra gì — đó là điểm
            // khiến nó đáng thử, không phải một thiếu sót của dữ liệu mẫu.
            investigated: Boolean(
                raw.causesIshikawa?.length || raw.fiveWhyChain?.length
                || raw.actions?.length || raw.teamAssignments?.length,
            ),
        };
    });

    fs.writeFileSync(path.join(SAMPLES, 'index.json'), JSON.stringify(index, null, 2), 'utf8');
    console.log(`[bundle-library] Đã gói ${issues.length} sự vụ mẫu vào app/…/public/samples/`);
}
