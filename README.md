# 🚀 8D Copilot — UIT_4Lovpe

Hệ thống quản lý sự cố chất lượng và tự động hóa quy trình **8D (Eight Disciplines of Problem Solving)** kết hợp trợ lý AI thông minh:
- 🔍 **Tự động phân tích nguyên nhân gốc rễ**: Dựng sơ đồ 6M Ishikawa & chuỗi 5-Why từ dữ liệu đo kiểm thực tế.
- 📚 **Đối chuẩn tiền lệ lịch sử**: Tìm kiếm các ca lỗi tương đồng trong kho tri thức để tái sử dụng kinh nghiệm giải quyết.
- 🛡️ **Đề xuất hành động khắc phục**: Tự động gợi ý các biện pháp khoanh vùng (D3 Containment), khắc phục triệt để (D5 Corrective) và phòng ngừa tái diễn (D7 Preventive).

---

## 🔗 Liên kết quan trọng (Quick Links)

| Hạng mục | Đường dẫn truy cập | Ghi chú |
| :--- | :--- | :--- |
| 🌐 **Trải nghiệm trực tuyến (Live Web)** | 👉 **[https://8-d-problem-solving.vercel.app](https://8-d-problem-solving.vercel.app)** | Vận hành thật 100% trên Vercel, không cần tài khoản, không cần cài đặt |
| 🎬 **Video Demo sản phẩm (3 phút)** | 👉 **[https://drive.google.com/drive/folders/1EMNPvJtuusw9Dh1NjabfNLnO5E_v8n-h](https://8-d-problem-solving.vercel.app)** | Video demo web |
| 📦 **Kho mã nguồn (GitHub Repo)** | 👉 **[DungTruong1610/8D_problem_solving](https://github.com/DungTruong1610/8D_problem_solving)** | Nhánh `main`, đầy đủ commit history minh bạch |
| 📊 **Slide thuyết trình** | 👉 **[Slide](https://drive.google.com/file/d/1L1WfLCbpMJxRpsIr45puTv2WzfOvzjfL/view?usp=sharing)** | Slide chuẩn format BTC |
| 🧪 **Bộ 25 Testcase mẫu (Golden Dataset)** | 👉 **[Xem chi tiết 25 Testcase bên dưới](#-danh-mục-25-test-case-mẫu-golden-dataset--benchmark-suites)** | Thư mục `mock-data/clean` & `mock-data/dirty`, nạp sẵn trên Web |

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

Bạn có thể lựa chọn trải nghiệm ứng dụng theo 2 cách:

- 🌐 **Cách 1: Trải nghiệm trực tuyến (Khuyên dùng cho BGK - Không cần cài đặt)**:
  - 👉 **Link Website**: **[https://8-d-problem-solving.vercel.app](https://8-d-problem-solving.vercel.app)**
  - 🎬 **Link Video Demo (3 phút)**: **[Xem Video Demo tại đây](YOUR_VIDEO_LINK_HERE)** *(Thay link video thực tế)*

- 💻 **Cách 2: Chạy cục bộ trên máy cá nhân (Localhost)**:
  - Mở trình duyệt web và truy cập địa chỉ: 👉 **[http://localhost:5544](http://localhost:5544)**
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

## 🧪 Danh mục 25 Test Case Mẫu (Golden Dataset & Benchmark Suites)

Hệ thống được trang bị bộ dữ liệu chuẩn công nghiệp **25 Test Case thực tế** từ dây chuyền sản xuất cơ khí chính xác, ô tô, điện tử và đúc áp lực (được lưu tại thư mục [`mock-data/`](mock-data/)). 

### 🎯 Điểm đặc biệt của Bộ Test Case: Đối chứng "Sạch vs Bẩn" (Clean vs Dirty)
Bộ dữ liệu gồm 2 cặp đối chứng $1:1$ (tổng cộng 50 file JSON):
1. **`mock-data/clean/` (25 ca)**: Dữ liệu đã chuẩn hóa hoàn chỉnh (Golden Dataset) có đầy đủ 6 nhánh Ishikawa, chuỗi 5-Why, hành động D3/D5/D7 và thông số đo kiểm (Ground Truth).
2. **`mock-data/dirty/` (25 ca tương ứng)**: Dữ liệu ghi nhận thô thực tế từ hệ thống của nhà máy để kiểm chứng:
   - Khả năng **chẩn đoán mù (Blind Diagnosis)** của AI dựa trên nguyên lý đo kiểm vật lý (First-Principles) mà không bị phụ thuộc vào cờ có sẵn.
   - Năng lực **phản biện nhận định chủ quan của con người** (ví dụ: công nhân đổ lỗi cho [Man], nhưng dữ liệu máy chỉ ra hao mòn đồ gá [Machine]).

---

### 📊 Bảng tổng hợp 25 Test Case Mẫu

| STT | Mã Hồ Sơ | Nguồn Gốc | Linh Kiện & Bộ Phận | Mô Tả Hiện Tượng Sự Cố | Nhóm 6M (Ground Truth) |
| :---: | :--- | :--- | :--- | :--- | :---: |
| 1 | `8D-10048412` | Q3 Internal | Bracket Housing X240 | Flange edge burr above limit after milling | ⚙️ **Machine** |
| 2 | `8D-10048420` | Q3 Internal | Sprocket Hub H22 | Raised metal ridge at bore mouth | ⚙️ **Machine** |
| 3 | `8D-10048577` | Q1 Customer | Pump Housing P90 | Porosity at sealing flange face | 🧱 **Material** |
| 4 | `8D-10048603` | Q3 Internal | Drive Shaft S150 | Shaft diameter below lower tolerance | 📐 **Method** |
| 5 | `8D-10048651` | Q1 Customer | Housing Cover C80 | Coating layer peeling after salt spray test | ⚙️ **Machine** |
| 6 | `8D-10048702` | Q3 Internal | Gearbox End Cap G45 | Bolt torque below specification | 👷 **Man** |
| 7 | `8D-10048745` | Q1 Customer | Sensor Mount Bracket S22 | Adhesive bond failure under thermal shock | 🌡️ **Environment** |
| 8 | `8D-10048788` | Q3 Internal | Rotor Shaft R60 | Chatter marks on ground surface | ⚙️ **Machine** |
| 9 | `8D-10048811` | Q1 Customer | Manifold Block M12 | Port thread depth insufficient | 📐 **Method** |
| 10 | `8D-10048834` | Q3 Internal | Spring Retainer SR8 | Retainer cracking during forming | 🧱 **Material** |
| 11 | `8D-10048857` | Q1 Customer | Bearing Cap BC14 | Bore position out of true position | ⚙️ **Machine** |
| 12 | `8D-10048880` | Q3 Internal | Bracket Housing X240 | Pocket depth inconsistent across units | 👷 **Man** |
| 13 | `8D-10048903` | Q1 Customer | Trim Panel T18 | Paint gloss out of specification | 📐 **Method** |
| 14 | `8D-10049010` | Q3 Internal | Bracket Housing X240 | Chatter marks and surface waviness on milled flange | ⚙️ **Machine** |
| 15 | `8D-10049020` | Q1 Customer | Bushing Sleeve B45 | Outer diameter taper out of tolerance on CNC lathe | 📏 **Measurement** |
| 16 | `8D-10049030` | Q3 Internal | Stamping Bracket SB-12 | Excessive burr and edge micro-cracks on stamped sheet | ⚙️ **Machine** |
| 17 | `8D-10049040` | Q1 Customer | Electronic Enclosure EE-50 | Sink mark and internal void on cosmetic injection molded surface | 📐 **Method** |
| 18 | `8D-10049050` | Q3 Internal | Control Board PCBA-900 | Solder bridging short circuit on fine-pitch QFN package | 🧱 **Material** |
| 19 | `8D-10049060` | Q3 Internal | Pump Motor Assembly PMA-30 | Stripped plastic thread boss during automated screwdriving | 👷 **Man** |
| 20 | `8D-10049070` | Q1 Customer | Bezel Frame BF-10 | Pitting corrosion and dark discoloration on anodized aluminum bezel | 🌡️ **Environment** |
| 21 | `8D-10049080` | Q3 Internal | Drive Shaft S150 | Insufficient case depth after induction hardening | ⚙️ **Machine** |
| 22 | `8D-10049090` | Q1 Customer | Exhaust Flange EF-80 | Internal porosity in robotic fiber laser welded lap joint | 📐 **Method** |
| 23 | `8D-10049100` | Q3 Internal | Pump Housing P90 | Hydraulic pressure test leak due to O-ring seal extrusion | 🧱 **Material** |
| 24 | `8D-10049110` | Q3 Internal | Guide Rail GR-200 | Grinding burn and micro-cracks on precision linear guideway | 📐 **Method** |
| 25 | `8D-10049120` | Q3 Internal | Bracket Housing X240 | Coordinate Measuring Machine false rejection on bolt circle true position | 📏 **Measurement** |

---

### 🔍 3 Kênh để Ban Giám Khảo (BGK) kiểm chứng 25 Test Case

1. **Trực tiếp trên Giao diện Web (Live Web & Localhost)**:
   - **Tạo hồ sơ mới từ kho defect**: Bấm nút **"Create 8D Report"** (góc trên bên phải màn hình danh sách) $\rightarrow$ Duyệt chọn bất kỳ sự cố nào theo các tab `All`, `Q1 Customer`, `Q2 Supplier`, `Q3 Internal` $\rightarrow$ Xem thông số đo kiểm thực tế $\rightarrow$ Bấm **"Create & Analyze"** để AI thực hiện phân tích tự động.
   - **Xem các hồ sơ đã giải quyết sẵn**: Trên Dashboard chính, nhấp chọn các hồ sơ có trạng thái *Signed off* hoặc *In process* để kiểm tra kết quả phân tích D1 $\rightarrow$ D8, cây Ishikawa 6M trực quan và bảng đối chuẩn tiền lệ **Precedent Cases**.

2. **Duyệt file dữ liệu gốc trong mã nguồn (Raw JSON Datasets)**:
   - Thư mục dữ liệu chuẩn hóa: [`mock-data/clean/`](mock-data/clean/) (25 ca từ `case-8D-10048412.json` đến `case-8D-10049120.json`).
   - Thư mục dữ liệu thô SAP QM: [`mock-data/dirty/`](mock-data/dirty/) (25 ca tương ứng từ `case-8D-90048412.json` đến `case-8D-90049120.json`).
   - Tài liệu giải trình kỹ thuật bộ dữ liệu: [`mock-data/README.md`](mock-data/README.md).



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
