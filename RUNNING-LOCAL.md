# Chạy local

Mọi lệnh trong file này đã chạy thử thật, không phải chép từ tài liệu.

---

## 1. Chuẩn bị — làm một lần

```bash
# ở thư mục gốc 8d-copilot
npm install
npm install --prefix app/8D_hackathon_ui
```

Cần đăng nhập được registry nội bộ `@cnma` — cấu hình đã có sẵn trong `.npmrc`, không phải làm gì thêm.

Rồi tạo file cấu hình:

```bash
cp .env.example .env
```

Chưa cần điền gì cũng chạy được — xem mục 4.

---

## 2. Tạo database local

```bash
npm run deploy:sqlite
```

Sinh ra file `sqlite.db` ngay trong thư mục dự án. **Không cần cài database server nào** — SQLite chỉ là một file.

Lệnh này bắt buộc chạy một lần, vì trang cấu hình AI đọc bảng `AIModels`. Bảng không tồn tại thì trang mở ra báo lỗi.

Chạy lại lệnh này bất cứ lúc nào để xoá sạch và dựng lại từ đầu.

---

## 3. Chạy

```bash
npm run dev
```

Một lệnh, chạy cả hai:

| | Địa chỉ |
|---|---|
| Backend (CAP) | http://localhost:4004 |
| Giao diện (Vite) | http://localhost:5544 |
| **Trang cấu hình AI** | **http://localhost:5544/#/ai-settings** |

Muốn chạy riêng từng bên:

```bash
npm run dev:backend                        # chỉ backend
npm run dev --prefix app/8D_hackathon_ui   # chỉ UI
```

### Đăng nhập

Local dùng auth giả, tài khoản `admin` / `123`.

Vite đã tự chèn sẵn header đăng nhập vào mọi request nên **mở UI không bị hỏi mật khẩu**. Chỉ khi gọi thẳng backend bằng curl hay Postman mới cần:

```bash
curl -u admin:123 http://localhost:4004/api/cnma/AI_SRV/AIModels
```

---

## 4. Phần AI — bốn chế độ

### Chế độ A — chưa cấu hình gì (mặc định sau khi clone)

Chạy được ngay. Lúc khởi động sẽ thấy dòng này, **đây không phải lỗi**:

```
[ai/llmClient] Chưa cấu hình nhà cung cấp AI nào trong .env — hệ thống tự động chạy Mock Mode...
[ai/llmClient] Chat: mock-chat — Embedding: KHÔNG CÓ (tiêu chí ngữ nghĩa sẽ bị bỏ qua)
```

Trang cấu hình AI vẫn mở được, danh sách model rỗng. Bấm **Sync** sẽ hiện thông báo lỗi ngay trên màn hình chứ không làm sập gì.

Dùng chế độ này khi chỉ làm giao diện, không đụng tới AI.

### Chế độ B — `MOCK_LLM=true`, test AI mà không cần credential

Thêm vào `.env`:

```
MOCK_LLM=true
```

Mọi lời gọi model trả kết quả giả, **không hề gọi mạng**:

```
complete   → {"mock":true,"model":"deepseek-v4.1-flash","messageCount":1}
embed      → mảng rỗng (không có vector — tầng trên tự bỏ tiêu chí ngữ nghĩa)
batchEmbed → mảng rỗng theo đúng số lượng đầu vào
```

Chế độ này bị **chặn cứng khi `NODE_ENV=production`**, không sợ lỡ tay mang lên server.

Dùng khi viết logic gọi AI và muốn chạy nhanh, không tốn tiền, không cần mạng.

### Chế độ C — DeepSeek V4.1 Flash + Jina (khuyến nghị)

Điền vào `.env`:

```
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://opencode.ai/zen/go/v1
DEEPSEEK_MODEL=deepseek-v4.1-flash
JINA_API_KEY=jina-...
```

Khởi động lại, log phải hiện đúng hai dòng:

```
[ai/llmClient] Chat: deepseek — Embedding: openai-compatible-embedding
[ai/llmClient] Embedding: "jina-embeddings-v5-text-small" (1536 chiều, nguồn: EMBEDDING_MODEL)
```

Muốn chắc chắn trước khi mở app, chạy `npx tsx scripts/probe-ai.ts` — script kiểm tra JSON mode, tool calls, thinking và nhúng thử 2 câu.

> DeepSeek không có API embedding. Bỏ `JINA_API_KEY` thì app vẫn chạy, nhưng tiêu chí "Similar description" cho 0 điểm mọi case mà không báo lỗi — log lúc boot sẽ có dòng `[AI] Không có nhà cung cấp embedding`.

### Chế độ D — AI Core thật (đường cũ, vẫn dùng được)

Điền vào `.env`. Cách nhanh nhất là dán nguyên service key AI Core dạng JSON một dòng:

```
AICORE_SERVICE_KEY={"clientid":"...","clientsecret":"...","url":"...","serviceurls":{"AI_API_URL":"..."}}
AICORE_RESOURCE_GROUP=default
```

Hoặc điền rời:

```
AICORE_AUTH_URL=https://<subdomain>.authentication.<region>.hana.ondemand.com
AICORE_CLIENT_ID=...
AICORE_CLIENT_SECRET=...
AICORE_BASE_URL=https://api.ai.prod.<region>.aws.ml.hana.ondemand.com
AICORE_RESOURCE_GROUP=default
```

> ⚠️ Tên biến là **`AICORE_AUTH_URL`**, không phải `AICORE_TOKEN_URL`. Project procure ghi tên sau — đó là tên sai, CDK không đọc.

AI Core chỉ được chọn khi KHÔNG có `DEEPSEEK_API_KEY`, `GEMINI_API_KEY` hay `LOCAL_LLM_URL`. Khởi động lại và kiểm tra dòng `[ai-startup]`.

Vào trang cấu hình AI bấm **Sync** → danh mục model nạp về từ AI Core.

---

## 5. Dữ liệu mẫu

CAP tự nạp file **CSV** trong `db/data/` mỗi lần `npm run deploy:sqlite`. Tên file phải đúng dạng `<namespace>-<Entity>.csv`, ví dụ:

```
db/data/cnma.proresolve-SampleEntity.csv
```

**CAP không tự nạp file JSON.** Muốn dùng JSON mock thì có hai đường:

**Cách 1 — chuyển JSON sang CSV** khi seed. Đơn giản nhất, và giữ được cơ chế nạp tự động của CAP.

**Cách 2 — viết script seed riêng**, chạy sau khi deploy:

```ts
// scratch/seed.ts   →  chạy: node node_modules/tsx/dist/cli.mjs scratch/seed.ts
import cds from '@sap/cds';
import data from './mockdata.json';

(async () => {
  const db = await cds.connect.to('db');
  await db.run(INSERT.into('cnma.proresolve.SampleEntity').entries(data));
  console.log(`Đã nạp ${data.length} bản ghi`);
})();
```

Cách 2 hợp khi dữ liệu mock có cấu trúc lồng nhau, thứ CSV diễn đạt vụng.

---

## 6. Sự cố hay gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Trang AI báo lỗi khi tải | Chưa chạy `npm run deploy:sqlite` | Chạy lệnh đó |
| Danh sách model rỗng dù đã Sync | Chưa điền `.env`, hoặc credential sai | Xem dòng `[ai-startup]` trong log |
| Ô chọn model trống trơn | Registry của bundle UI chưa đăng ký | Kiểm tra `src/config/ai-registry.ts` có được gọi trong `main.tsx` |
| `403` khi bấm Sync trên môi trường deploy | Thiếu CSRF token | Phải dùng `services/ai-model-service.ts`, không dùng `createAiModelApi()` của CDK |
| Cổng 4004 hoặc 5544 bị chiếm | Còn tiến trình cũ | Tắt terminal cũ, hoặc kill process giữ cổng |
| `npm install` báo lỗi peer dependency | Thiếu cờ | `.npmrc` đã có `legacy-peer-deps=true`, kiểm tra file còn nguyên không |

---

## 7. Hai điều dễ quên nhất

**Registry AI phải đăng ký ở CẢ HAI phía.** Backend đăng ký ở `srv/server.ts`, giao diện đăng ký ở `src/config/ai-registry.ts`. Đây là hai tiến trình khác nhau, không thấy nhau. Thêm một activity mới mà chỉ sửa một bên thì bên kia không biết gì — ô chọn trống hoặc backend không tra được model.

**Đổi model embedding là làm hỏng mọi vector đã lưu.** Vector của hai model khác nhau không nằm chung một không gian, so sánh giữa chúng cho ra kết quả vô nghĩa — mà hệ thống vẫn chạy bình thường, không báo lỗi gì. Đổi thì phải nhúng lại toàn bộ kho.
