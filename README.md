# 🚀 8D Copilot — UIT_4Lovpe

Hệ thống quản lý sự cố chất lượng và tự động hóa quy trình **8D (Eight Disciplines of Problem Solving)** kết hợp trợ lý AI thông minh:
- 🔍 **Tự động phân tích nguyên nhân gốc rễ**: Dựng sơ đồ 6M Ishikawa & chuỗi 5-Why từ dữ liệu đo kiểm thực tế.
- 📚 **Đối chuẩn tiền lệ lịch sử**: Tìm kiếm các ca lỗi tương đồng trong kho tri thức để tái sử dụng kinh nghiệm giải quyết.
- 🛡️ **Đề xuất hành động khắc phục**: Tự động gợi ý các biện pháp khoanh vùng (D3 Containment), khắc phục triệt để (D5 Corrective) và phòng ngừa tái diễn (D7 Preventive).

---

## 📋 Yêu cầu hệ thống (Prerequisites)

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt:
- **Node.js**: Phiên bản `v18` hoặc `v20+` (khuyên dùng Node.js LTS v20 hoặc v22).
  - Kiểm tra bằng lệnh: `node -v`
- **npm**: Phiên bản `v9+` (đi kèm sẵn với Node.js).
  - Kiểm tra bằng lệnh: `npm -v`
- **Git**: Đã cài đặt Git để clone mã nguồn.
- *(Không bắt buộc)*: Không cần cài đặt Docker hay bất kỳ phần mềm Database server nào (hệ thống có sẵn SQLite tích hợp chạy ngay).

---

## ⚡ Hướng dẫn cài đặt và chạy ứng dụng từ A đến Z

### 1. Clone mã nguồn về máy

Mở terminal (PowerShell, Command Prompt hoặc Git Bash) và chạy lệnh:

```bash
# Clone repository (nhánh main)
git clone https://github.com/DungTruong1610/8D_problem_solving.git

# Di chuyển vào thư mục dự án
cd 8D_problem_solving
```

---

### 2. Cài đặt các gói thư viện (Dependencies)

Cài đặt đầy đủ các thư viện cho cả phần **Backend** và **Frontend**:

```bash
# 1. Cài đặt thư viện Backend (tại thư mục gốc)
npm install

# 2. Cài đặt thư viện Frontend
npm install --prefix app/8D_hackathon_ui
```

---

### 3. Cấu hình biến môi trường (`.env`)

Tạo file `.env` từ file mẫu có sẵn:

```bash
# Trên Windows (PowerShell):
copy .env.example .env

# Hoặc trên Linux / macOS / Git Bash:
cp .env.example .env
```

Mở file `.env` vừa tạo và cấu hình AI:

#### 👉 Cách A: DeepSeek V4.1 Flash (khuyên dùng)
1. Lấy API Key: [OpenCode](https://opencode.ai/auth) (gói Go/Zen) hoặc [DeepSeek Platform](https://platform.deepseek.com).
2. Lấy thêm key embedding miễn phí tại [Jina AI](https://jina.ai/embeddings/) — DeepSeek không có API embedding, thiếu key này thì tìm kiếm ngữ nghĩa sẽ bị bỏ qua (không báo lỗi).
3. Điền vào file `.env`:
   ```env
   DEEPSEEK_API_KEY=sk-your-key
   DEEPSEEK_BASE_URL=https://opencode.ai/zen/go/v1
   DEEPSEEK_MODEL=deepseek-v4.1-flash
   JINA_API_KEY=jina-your-key
   ```

#### 👉 Cách B: Google Gemini (vẫn dùng được)
```env
GEMINI_API_KEY=AIzaSyYourActualApiKeyHere
GEMINI_MODEL=gemini-2.5-flash
```

#### 👉 Cách C: Chế độ chạy thử không cần mạng (Mock AI)
Nếu bạn chưa có API Key ngay hoặc chỉ muốn kiểm tra giao diện:
```env
MOCK_LLM=true
```

Kiểm tra nhanh cấu hình AI trước khi chạy app:
```bash
npx tsx scripts/probe-ai.ts
```
Script sẽ in ra provider đang dùng, chạy thử JSON/tool/thinking, và nhúng thử 2 câu để xác nhận key embedding hoạt động.

---

### 4. Khởi tạo Database & Sử dụng Dữ liệu mẫu (Sample Database)

Hệ thống sử dụng cơ sở dữ liệu SQLite cục bộ (lưu trong file `db.sqlite` ngay tại thư mục gốc, **hoàn toàn không cần cài đặt thêm MySQL, PostgreSQL hay Docker**).

Bạn có thể lựa chọn 1 trong 2 cách sau:

#### 👉 Cách 1: Tự động khởi tạo và nạp toàn bộ dữ liệu mẫu từ mã nguồn (Khuyên dùng)
Nếu bạn vừa mới clone dự án về, chỉ cần chạy 1 dòng lệnh duy nhất để tạo database và nạp sẵn toàn bộ kho dữ liệu:

```bash
npm run deploy:sqlite && npm run seed:sqlite
```

> **Lệnh trên sẽ tự động nạp sẵn vào `db.sqlite`:**
> - 📚 **25 ca bệnh sự cố 8D hoàn chỉnh** từ `mock-data/clean/` (bao gồm đầy đủ dữ liệu từ D1 → D8, sơ đồ 6M Ishikawa, chuỗi 5-Why, hành động khoanh vùng D3, hành động khắc phục D5 và phòng ngừa D7).
> - ⚠️ **15 ca lỗi kiểm thử mẫu** được phân loại rõ ràng theo 3 nhóm chuẩn công nghiệp:
>   - **Q1 — Customer Complaint**: Lỗi từ khiếu nại khách hàng.
>   - **Q2 — Supplier Defect**: Lỗi linh kiện/phôi nhập từ nhà cung cấp.
>   - **Q3 — Internal Defect**: Lỗi phát hiện tại các công đoạn nội bộ nhà máy (phay, tiện, mài, lắp ráp).
> - 👥 **Danh bạ 21 nhân sự chuyên gia mẫu** (chức danh, email, số điện thoại) phục vụ phân công đội ngũ D1.
> - 📊 **Bộ đặc tính đo kiểm, dung sai kỹ thuật, mã lỗi và danh mục vật tư chuẩn**.

#### 👉 Cách 2: Sử dụng trực tiếp file `db.sqlite` có sẵn
Nếu bạn được đồng đội gửi sẵn file `db.sqlite` hoặc tải về từ bản sao lưu:
1. Copy file `db.sqlite` đặt trực tiếp vào thư mục gốc của dự án (`8D_problem_solving/db.sqlite`).
2. **Không cần chạy lệnh deploy hay seed nào nữa**, chuyển thẳng sang **Bước 5** bên dưới để khởi động app!

> 💡 **Mẹo: Muốn Reset hoặc khôi phục lại dữ liệu mẫu ban đầu?**  
> Bất kỳ lúc nào trong quá trình test mà dữ liệu bị thay đổi, bạn chỉ cần chạy lại lệnh:  
> `npm run deploy:sqlite && npm run seed:sqlite`  
> Database sẽ tự động được làm mới và đưa về trạng thái dữ liệu mẫu chuẩn ban đầu.

---

### 5. Khởi động ứng dụng (Run Application)

Chạy cả Backend và Frontend cùng lúc bằng **1 lệnh duy nhất**:

```bash
npm run dev
```

*(Hoặc nếu bạn thích mở 2 cửa sổ terminal riêng biệt):*
- **Terminal 1 (Backend - Cổng 4008)**:
  ```bash
  npm run dev:backend
  ```
- **Terminal 2 (Frontend - Cổng 5544)**:
  ```bash
  npm run dev --prefix app/8D_hackathon_ui
  ```

---

### 6. Mở và trải nghiệm ứng dụng

Mở trình duyệt web và truy cập địa chỉ:
👉 **[http://localhost:5544](http://localhost:5544)**

- **Địa chỉ Backend API**: [http://localhost:4008](http://localhost:4008)
- **Tài khoản đăng nhập**: Hệ thống chạy local đã tự động đăng nhập sẵn với quyền **Local Developer (Admin)**, bạn không cần nhập mật khẩu.

---

## 💡 Hướng dẫn kiểm tra tính năng trên giao diện

Sau khi mở web [http://localhost:5544](http://localhost:5544), bạn sẽ thấy bảng danh sách **8D Reports** với 27+ hồ sơ mẫu sẵn có:

### 👉 Cách 1: Tạo và phân tích một hồ sơ 8D mới từ danh mục lỗi kiểm thử
1. **Bước 1**: Nhấn nút **"Create 8D Report"** màu vàng ở góc trên bên phải bảng báo cáo.
2. **Bước 2**: Hộp thoại sẽ hiển thị danh mục các lỗi kiểm thử có sẵn, được lọc theo các tab:
   - **All**: Tất cả các lỗi sẵn sàng xử lý.
   - **Q1 Customer**: Khiếu nại từ khách hàng (ví dụ: bavia, bong tróc sơn, rò rỉ đúc...).
   - **Q2 Supplier**: Lỗi từ nhà cung cấp linh kiện (ví dụ: phôi rỗ khí, phôi thép nứt mép, trục rèn bị đảo...).
   - **Q3 Internal**: Lỗi phát hiện nội bộ chuyền sản xuất (ví dụ: cháy mài, tuôn ren siết ốc, sai lệch kích thước tiện/phay...).
3. **Bước 3**: Nhấp chọn một lỗi bất kỳ để xem trước chi tiết thông số đo kiểm thực tế ở panel bên phải.
4. **Bước 4**: Nhấn **"Create & Analyze"**:
   - Hệ thống tự động tạo hồ sơ 8D và kích hoạt AI phân tích toàn diện.
   - AI sẽ tự động đọc dữ liệu đo kiểm thực tế, tìm kiếm ca bệnh tương đồng từ kho tiền lệ và điền tự động 8 bước (D1 → D8), dựng cây nguyên nhân gốc rễ 6M Ishikawa và chuỗi 5-Why.

### 👉 Cách 2: Trải nghiệm các hồ sơ 8D mẫu đã có sẵn
1. Bấm trực tiếp vào bất kỳ dòng nào trong bảng danh sách **8D Reports** (ví dụ các ca có trạng thái *Signed off*, *In process*, hoặc *Awaiting approval*).
2. Xem chi tiết từng bước quy trình chất lượng:
   - **D1 Team**: Đội ngũ xử lý với các nhân sự chuyên môn được gợi ý.
   - **D2 Problem**: Mô tả sự cố chi tiết và ma trận phân định *Is / Is-Not*.
   - **D3 Containment**: Các biện pháp khoanh vùng và cách ly lô hàng lỗi.
   - **D4 Root Cause**: Sơ đồ xương cá 6M Ishikawa tương tác trực quan, chuỗi 5-Why tìm nguyên nhân gốc, và panel **Precedent Cases** đối chuẩn các ca tương đồng trong lịch sử.
   - **D5 Corrective Actions**: Hành động khắc phục triệt để.
   - **D6 Verification**: Bằng chứng nghiệm thu hiệu quả.
   - **D7 Prevention**: Cập nhật FMEA và biện pháp ngăn ngừa tái diễn.
   - **D8 Closure**: Đóng hồ sơ và ghi nhận bài học kinh nghiệm.

---

## 🛠️ Xử lý sự cố thường gặp (Troubleshooting)

| Vấn đề | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Báo lỗi `Cannot find table ...` | Chưa tạo database SQLite | Chạy lệnh: `npm run deploy:sqlite && npm run seed:sqlite` |
| Cổng 4008 hoặc 5544 bị báo đang được sử dụng | Còn tiến trình cũ đang chạy ngầm | Đóng terminal cũ, hoặc khởi động lại bằng lệnh `npm run dev:all` |
| Bấm "Analyze with AI" báo lỗi API | Chưa cấu hình hoặc sai API Key | Kiểm tra `DEEPSEEK_API_KEY` trong `.env` (hoặc `GEMINI_API_KEY`), chạy `npx tsx scripts/probe-ai.ts` để xem provider nào đang chạy, hoặc bật `MOCK_LLM=true` để test thử |
| Tìm tiền lệ không bao giờ khớp theo ngữ nghĩa | Chưa có nhà cung cấp embedding | Thêm `JINA_API_KEY` vào `.env` (DeepSeek không có API embedding). Log khởi động sẽ báo `Embedding: KHÔNG CÓ` nếu thiếu |
| `npm install` báo lỗi peer dependencies | Thiếu cờ bỏ qua xung đột phiên bản | Chạy `npm install --legacy-peer-deps` |

---

## 📁 Cấu trúc thư mục dự án

```text
├── app/
│   └── 8D_hackathon_ui/       # Mã nguồn giao diện người dùng React (Vite, TailwindCSS, Shadcn/UI)
├── srv/                       # Mã nguồn Backend CAP (Express, AI Services, OData Handlers)
│   ├── server.ts              # Custom Bootstrap Server
│   └── src/
│       ├── core/ai/           # Logic kết nối các nhà cung cấp AI (DeepSeek, Gemini, LLM local, Mock)
│       └── domain/eightd/     # Logic nghiệp vụ 8D, AI Prompts, Precedent Search
├── packages/                  # Các thư viện nội bộ (.tgz)
├── scripts/                   # Các script seed database, test AI và migration
├── .env.example               # File mẫu cấu hình biến môi trường
├── vercel.json                # Cấu hình sẵn sàng triển khai Frontend lên Vercel
└── package.json               # Quản lý script và dependencies của dự án
```
