# 🚀 8D Copilot — UIT 4Love

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

Mở file `.env` vừa tạo và cấu hình API Key AI (chọn 1 trong 2 cách):

#### 👉 Cách A: Dùng Google Gemini (Khuyên dùng - Nhanh, Thông minh, Miễn phí)
1. Lấy API Key miễn phí tại: [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Điền vào file `.env`:
   ```env
   GEMINI_API_KEY=AIzaSyYourActualApiKeyHere
   GEMINI_MODEL=gemini-2.5-flash
   ```

#### 👉 Cách B: Chế độ chạy thử không cần mạng (Mock AI)
Nếu bạn chưa có API Key ngay hoặc chỉ muốn kiểm tra giao diện:
```env
MOCK_LLM=true
```

---

### 4. Khởi tạo Database & Nạp dữ liệu mẫu (Chỉ cần chạy 1 lần)

Hệ thống sử dụng cơ sở dữ liệu SQLite cục bộ (lưu trong file `db.sqlite`, **không cần cài database server**):

```bash
# Tạo bảng và nạp toàn bộ danh mục mã lỗi, vật tư và kho ca bệnh lịch sử
npm run deploy:sqlite
npm run seed:sqlite
```

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

## 💡 Hướng dẫn kiểm tra tính năng phân tích 8D AI

Sau khi mở web [http://localhost:5544](http://localhost:5544):

1. **Bước 1**: Nhấn vào menu **"Defects"** (Danh sách sự cố).
2. **Bước 2**: Bấm vào một ca lỗi bất kỳ (ví dụ: `DEF-10048651`) ➔ Nhấn nút **"Start 8D"** để khởi tạo quy trình 8 bước.
3. **Bước 3**: Nhấn nút **"Analyze with AI"**:
   - AI sẽ tự động đọc dữ liệu đo kiểm thực tế, truy xuất tiền lệ tương đồng từ kho dữ liệu.
   - Tự động điền và phân tích toàn diện 8 bước:
     - **D1**: Đề xuất đội ngũ xử lý sự cố.
     - **D2**: Mô tả vấn đề, ma trận Is / Is-Not.
     - **D3**: Hành động ngăn chặn tạm thời (Containment Actions).
     - **D4**: Phân tích nguyên nhân gốc rễ (Root Cause), cây 6M Ishikawa và 5-Why.
     - **D5**: Hành động khắc phục vĩnh viễn (Corrective Actions).
     - **D6**: Xác thực hiệu quả biện pháp khắc phục.
     - **D7**: Biện pháp ngăn ngừa tái diễn (FMEA & Preventive Actions).
     - **D8**: Đóng hồ sơ, đúc kết bài học kinh nghiệm (Lessons Learned).

---

## 🛠️ Xử lý sự cố thường gặp (Troubleshooting)

| Vấn đề | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Báo lỗi `Cannot find table ...` | Chưa tạo database SQLite | Chạy lệnh: `npm run deploy:sqlite && npm run seed:sqlite` |
| Cổng 4008 hoặc 5544 bị báo đang được sử dụng | Còn tiến trình cũ đang chạy ngầm | Đóng terminal cũ, hoặc khởi động lại bằng lệnh `npm run dev:all` |
| Bấm "Analyze with AI" báo lỗi API | Chưa cấu hình hoặc sai API Key | Kiểm tra lại `GEMINI_API_KEY` trong file `.env` hoặc bật `MOCK_LLM=true` để test thử |
| `npm install` báo lỗi peer dependencies | Thiếu cờ bỏ qua xung đột phiên bản | Chạy `npm install --legacy-peer-deps` |

---

## 📁 Cấu trúc thư mục dự án

```text
├── app/
│   └── 8D_hackathon_ui/       # Mã nguồn giao diện người dùng React (Vite, TailwindCSS, Shadcn/UI)
├── srv/                       # Mã nguồn Backend CAP (Express, AI Services, OData Handlers)
│   ├── server.ts              # Custom Bootstrap Server
│   └── src/
│       ├── core/ai/           # Logic kết nối các nhà cung cấp AI (Gemini, Claude, Mock)
│       └── domain/eightd/     # Logic nghiệp vụ 8D, AI Prompts, Precedent Search
├── packages/                  # Các thư viện nội bộ (.tgz)
├── scripts/                   # Các script seed database, test AI và migration
├── .env.example               # File mẫu cấu hình biến môi trường
├── vercel.json                # Cấu hình sẵn sàng triển khai Frontend lên Vercel
└── package.json               # Quản lý script và dependencies của dự án
```
