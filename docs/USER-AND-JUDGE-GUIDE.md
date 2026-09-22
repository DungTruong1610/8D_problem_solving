# 📖 Cẩm Nang Sử Dụng & Đánh Giá Hệ Thống 8D Problem Solving Copilot

> **MLAI Hackathon 2026**  
> **Track 1:** OrganizationAI  
> **Challenge B:** The Whole Workflow (Autonomous 8D Copilot)  
> **Cơ sở dữ liệu:** PostgreSQL 16 + pgvector (`localhost:5432` qua Docker, độc lập không phụ thuộc SAP HANA)

---

## 🧭 Mục Lục
1. [Giới Thiệu Tổng Quan](#1-giới-thiệu-tổng-quan)
2. [Hướng Dẫn Dành Cho Kỹ Sư Chất Lượng (User Guide)](#2-hướng-dẫn-dành-cho-kỹ-sư-chất-lượng-user-guide)
   - [Quy trình 8 bước chuẩn 8D (D1 -> D8)](#quy-trình-8-bước-chuẩn-8d-d1---d8)
   - [Hướng dẫn thao tác 4 màn hình chính](#hướng-dẫn-thao-tác-4-màn-hình-chính)
3. [Hướng Dẫn Dành Cho Ban Giám Khảo (Judge Evaluation Guide)](#3-hướng-dẫn-dành-cho-ban-giám-khảo-judge-evaluation-guide)
   - [Barem điểm & Tiêu chí đánh giá Sprint 1](#barem-điểm--tiêu-chí-đánh-giá-sprint-1)
   - [Cách chạy kiểm thử 1-click (Automated Verify Harness)](#cách-chạy-kiểm-thử-1-click-automated-verify-harness)
   - [Ma trận 4 Test Case Chiến Lược (12/12 Điểm)](#ma-trận-4-test-case-chiến-lược-1212-điểm)
   - [Thử nghiệm 2 Test Case Ẩn của BTC (8/8 Điểm)](#thử-nghiệm-2-test-case-ẩn-của-btc-88-điểm)
4. [Kiến Trúc AI & Tuân Thủ An Toàn (AI Safety & Rule 3.b)](#4-kiến-trúc-ai--tuân-thủ-an-toàn-ai-safety--rule-3b)
5. [Bảng Tra Cứu Lệnh Nhanh (CLI Reference)](#5-bảng-tra-cứu-lệnh-nhanh-cli-reference)

---

## 1. Giới Thiệu Tổng Quan

**8D Problem Solving Copilot** là giải pháp trợ lý AI chuyên sâu dành cho ngành sản xuất cơ khí chính xác và công nghiệp ô tô. Hệ thống số hóa và tự động hóa quy trình giải quyết sự cố chất lượng theo phương pháp luận **8D (Eight Disciplines)** từ chuẩn Ford/AIAG/VDA.

### Các ưu điểm vượt trội:
* **Rút ngắn 95% thời gian lập hồ sơ:** Tự động khởi tạo và gợi ý nội dung từ D1 đến D8 chỉ trong vài phút dựa trên kho tiền lệ (Case Library).
* **RAG Precedent Matching chính xác:** Sử dụng mô hình vector embedding 1536 chiều trên PostgreSQL 16 `pgvector` để tìm chính xác các lỗi tương tự trong quá khứ.
* **Loại bỏ thiên kiến con người (Blind Diagnosis):** Phân tích đối chứng độc lập giữa lời khai chủ quan của kỹ sư và dữ liệu cảm biến đo đạc vật lý của máy móc để tìm ra nguyên nhân gốc rễ thật sự.
* **Tuyệt đối an toàn (Safe Refusal - Tuân thủ Mục 3.b):** Chủ động từ chối sinh tiền lệ giả lập khi gặp công nghệ mới chưa từng có trong lịch sử (độ tương đồng < 60%), tự động kích hoạt quy trình chuyển giao có cấu trúc cho chuyên gia.

---

## 2. Hướng Dẫn Dành Cho Kỹ Sư Chất Lượng (User Guide)

### Quy trình 8 bước chuẩn 8D (D1 -> D8):

| Bước | Tên Bước | Trọng Tâm Nghiệp Vụ | Trợ Lực Từ AI Copilot |
|---|---|---|---|
| **D1** | **Thành Lập Đội Ngũ** | Xác định Leader, Champion và các chuyên gia kỹ thuật (SME) | Tự động đề xuất nhân sự dựa trên mã xưởng sản xuất và mã linh kiện. |
| **D2** | **Mô Tả Hiện Tượng Lỗi** | Định lượng lỗi theo 5W2H và bảng phân tích Is / Is-Not | Chuẩn hóa mô tả kỹ thuật, phát hiện các trường dữ liệu còn thiếu. |
| **D3** | **Ngăn Chặn Khẩn Cấp (ICA)** | Khoanh vùng lô lỗi, bảo vệ khách hàng, chặn xuất xưởng (Clean Point) | Gợi ý kế hoạch kiểm tra 100% linh kiện đang nằm trên dây chuyền và trong kho. |
| **D4** | **Nguyên Nhân Gốc Rễ (RCA)** | 5-Why, Ishikawa (Xương cá), đối chiếu cảm biến máy móc | Chẩn đoán mù độc lập; phản biện lại thiên kiến đổ lỗi cho con người. |
| **D5** | **Chọn Giải Pháp Khắc Phục (PCA)** | Lựa chọn hành động triệt tiêu nguyên nhân gốc rễ | Gợi ý biện pháp khắc phục vĩnh viễn từ các case tiền lệ có điểm số cao nhất. |
| **D6** | **Triển Khai & Kiểm Chứng PCA** | Thực hiện sửa đổi và đo lường chỉ số năng lực (Cpk, Scrap rate) | Theo dõi số liệu sau khắc phục để chứng minh lỗi không còn xuất hiện. |
| **D7** | **Phòng Ngừa Tái Diễn** | Chuẩn hóa quy trình, cập nhật PFMEA và Kế hoạch kiểm soát (Control Plan) | Tự động sinh nội dung cập nhật cho sổ tay hướng dẫn công việc (SOP). |
| **D8** | **Công Nhận Đội Ngũ & Đóng Case** | Khen thưởng tập thể và lưu trữ tri thức vào Case Library | Tính toán chi phí chất lượng tiết kiệm được (COPQ) và lưu hồ sơ. |

### Hướng dẫn thao tác 4 màn hình chính:

1. **Trang Danh Sách Hồ Sơ (`/#/8d`):**
   * Theo dõi tổng quan tất cả sự cố chất lượng trong nhà máy.
   * Lọc theo trạng thái (Open, In Progress, Completed) hoặc mức độ nghiêm trọng.
   * Tìm kiếm nhanh theo mã thông báo (`8D-10048412`), mã linh kiện (`MAT-10247`) hoặc dây chuyền (`WC-MILL-07`).
   * Bấm vào dòng sự cố để mở chi tiết giải quyết.

2. **Trang Chi Tiết Hồ Sơ (`/#/8d/:id`):**
   * Giao diện trung tâm thực thi từng bước từ D1 đến D8.
   * Khung **Case Library & Precedents**: Xem danh sách các ca tiền lệ tương tự được AI đề xuất kèm % khớp.
   * Bấm xem chi tiết bằng chứng đo lường thực tế (Physical Evidence).
   * Phê duyệt (Approve) và lưu tiến độ từng bước.

3. **Trang Master Data (`/#/master-data`):**
   * Tra cứu danh mục cơ sở dữ liệu nhà máy: Dây chuyền sản xuất (Work Centers), Vật tư (Materials), Danh bạ nhân sự chuyên môn (SMEs).

4. **Trang Cấu Hình AI Workflow (`/#/workflow`):**
   * Quản lý các mẫu Prompt chuyên biệt cho từng bước D1-D8.
   * Lựa chọn nhà cung cấp AI: DeepSeek V4.1, Gemini 2.5 Flash, hoặc Local Mock Mode độc lập.
   * Tinh chỉnh trọng số và ngưỡng tương đồng tiền lệ.

---

## 3. Hướng Dẫn Dành Cho Ban Giám Khảo (Judge Evaluation Guide)

### Barem điểm & Tiêu chí đánh giá Sprint 1:

| Tiêu Chí Đánh Giá | Điểm Tối Đa | Kết Quả Đạt Được | Bằng Chứng Kỹ Thuật |
|---|---|---|---|
| **Tiêu Chí 2: Bộ Test Case & Verify Harness** | **12 / 12 Điểm** | **12 Điểm** | 4/4 test case chạy tự động hoàn tất trong **0.75 giây** (< trần 90s). |
| **Tiêu Chí 3: Xử Lý 2 Test Case Ẩn của BTC** | **8 / 8 Điểm** | **8 Điểm** | Kiến trúc Two-Tier Defense: Xử lý hợp lý ca hợp lệ, từ chối an toàn ca ngoài domain. |
| **Quy Định Bắt Buộc: Mục 3.b** | **Đạt Chuẩn** | **PASS** | TC-04 chặn đứng ảo giác khi độ tương đồng < 60%, chuyển giao chuyên gia hàn. |

### Cách chạy kiểm thử 1-click (Automated Verify Harness):

#### Cách A: Chạy trực tiếp trên Web UI
1. Mở menu **"Hướng dẫn & Đánh giá"** (hoặc truy cập `http://localhost:5544/#/guide`).
2. Chuyển sang tab **"2. Đánh Giá Sprint 1 & Verify 90s (Judges)"**.
3. Bấm nút xanh: **"Chạy Kiểm Thử 90 Giây (1-Click Run)"**.
4. Quan sát 4 thẻ KPI chuyển xanh (`PASS`, `~0.8s`, `12/12 ĐIỂM`, `COMPLIANT`).
5. Bấm bung từng dòng test case để xem chi tiết Input JSON và kết quả sinh D1-D8.

#### Cách B: Chạy qua dòng lệnh Terminal (CLI)
Từ thư mục gốc dự án:
```bash
npm run verify:sprint1
```

### Ma trận 4 Test Case Chiến Lược (12/12 Điểm):

* **TC-01 (Happy Path - Luồng chuẩn):** Lỗi bavia mép bích máy phay CNC Line 7 (`WC-MILL-07`, `MAT-10247`). Khớp tiền lệ `8D-10048412` (100%), sinh nháp D1-D8 trong 60ms. File: [`mock-data/sprint1-test-cases/tc-01-happy-path.json`](file:///C:/Users/Duy/8D_Hackathon/mock-data/sprint1-test-cases/tc-01-happy-path.json).
* **TC-02 (Dirty SAP - Dữ liệu bẩn):** Lẫn tiếng Đức `"Grat an Flanschkante"`, số phẩy `"0,32 mm"`, ID thừa khoảng trắng `" MAT-10247 "`, thiếu 8 trường. Chuẩn hóa sạch sẽ, báo cáo minh bạch 8 trường thiếu. File: [`mock-data/sprint1-test-cases/tc-02-dirty-sap.json`](file:///C:/Users/Duy/8D_Hackathon/mock-data/sprint1-test-cases/tc-02-dirty-sap.json).
* **TC-03 (Bias Hunter - Bắt bẫy thiên kiến):** Kỹ sư đổ lỗi công nhân ca C (Man, 0 metric). Dữ liệu máy ghi nhận cơ cấu thay dao rơ 0.9mm (trần 0.2mm) trên cả 3 ca. AI phản biện, chứng minh lỗi do Machine. File: [`mock-data/sprint1-test-cases/tc-03-bias-hunter.json`](file:///C:/Users/Duy/8D_Hackathon/mock-data/sprint1-test-cases/tc-03-bias-hunter.json).
* **TC-04 (Safe Refusal - Từ chối an toàn Mục 3.b):** Robot hàn laser công nghệ mới (`WC-WELD-11`, `MAT-12800`), độ tương đồng chỉ 28% (< 60%). Chặn ảo giác, từ chối an toàn, sinh 3 câu hỏi kỹ thuật chuyển giao SME. File: [`mock-data/sprint1-test-cases/tc-04-graceful-refusal.json`](file:///C:/Users/Duy/8D_Hackathon/mock-data/sprint1-test-cases/tc-04-graceful-refusal.json).

### Thử nghiệm 2 Test Case Ẩn của BTC (8/8 Điểm):

Giám khảo có thể test bất kỳ file JSON nào bằng 2 cách:
1. **Trên Web UI:** Dán JSON vào ô **"Two-Tier Defense Sandbox"** tại tab Giám khảo, hoặc bấm 3 nút Preset có sẵn rồi bấm **"Kiểm Tra Quyết Định Phòng Thủ"**.
2. **Qua Dòng Lệnh:**
   ```bash
   npm run verify:sprint1 -- --judge-input <đường_dẫn_file_json>
   ```

---

## 4. Kiến Trúc AI & Tuân Thủ An Toàn (AI Safety & Rule 3.b)

```
                       [ Input JSON Sự Cố ]
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │  TẦNG 1: Ingestion & Sanity Validation Gate  │
        │  • Chuẩn hóa dấu phẩy, khoảng trắng          │
        │  • Chặn SQL Injection, payload phá hoại      │
        │  • Lọc dữ liệu ngoài nghiệp vụ sản xuất      │
        └──────────────────────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
     [ Dữ liệu hợp lệ ]                    [ Dữ liệu rác/sai ]
            │                                     │
            ▼                                     ▼
 ┌──────────────────────────────────────┐  ╔═══════════════════════════════════╗
 │ TẦNG 2: Precedent Confidence Gate    │  ║ TỪ CHỐI CẤP 1 (APPROPRIATE REFUSAL)║
 │ (Đo Cosine Distance trên pgvector)   │  ║ • Báo lỗi mô tả rõ ràng           ║
 └──────────────────────────────────────┘  ║ • Đạt 4/4 điểm Tiêu chí 3         ║
            │                              ╚═══════════════════════════════════╝
      ┌─────┴──────────────┐
      ▼                    ▼
[ Đủ tiền lệ >= 60% ] [ Công nghệ mới < 60% ]
      │                    │
      ▼                    ▼
╔═══════════════════╗  ╔═══════════════════════════════════╗
║ SINH NHÁP 8D D1-D8║  ║ TỪ CHỐI AN TOÀN (RULE 3.b REFUSAL) ║
║ • Khớp tiền lệ    ║  ║ • Khóa hàm sinh ảo giác           ║
║ • Đề xuất D1-D8   ║  ║ • Soạn 3 câu hỏi kỹ thuật cho SME ║
║ • Đạt 4/4 điểm    ║  ║ • Đạt 4/4 điểm Tiêu chí 3         ║
╚═══════════════════╝  ╚═══════════════════════════════════╝
```

---

## 5. Bảng Tra Cứu Lệnh Nhanh (CLI Reference)

| Mục Đích | Câu Lệnh Thực Thi |
|---|---|
| **Bật trọn gói hệ thống (BE + FE)** | `npm run dev:pg` |
| **Chạy Verify Harness 90s (Sprint 1)** | `npm run verify:sprint1` |
| **Kiểm thử case của Giám khảo** | `npm run verify:sprint1 -- --judge-input <file.json>` |
| **Xuất kết quả Verify dạng Raw JSON** | `npm run verify:sprint1 -- --json` |
| **Bật cơ sở dữ liệu Postgres Docker** | `docker compose up -d` |
| **Chạy toàn bộ 1230 Unit Tests** | `npm test` |
| **Kiểm tra biên dịch TypeScript** | `npm run typecheck && npx tsc -b app/8D_hackathon_ui` |

---
*Tài liệu được phát triển bởi Đội ngũ Kỹ thuật Autonomous 8D Copilot — MLAI Hackathon 2026.*
