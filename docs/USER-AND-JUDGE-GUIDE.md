# 📖 Cẩm Nang Vận Hành & Hướng Dẫn Đánh Giá 8D Problem Solving Copilot

> **MLAI Hackathon 2026**  
> **Track 1:** OrganizationAI  
> **Challenge B:** The Whole Workflow (Autonomous 8D Copilot)  
> **Cơ sở dữ liệu:** PostgreSQL 16 + pgvector (`localhost:5432` qua Docker, độc lập không phụ thuộc SAP HANA)

---

## 🧭 Mục Lục
1. [Giới Thiệu & Tính Năng WalkMe Tour](#1-giới-thiệu--tính-năng-walkme-tour)
2. [Công Dụng Từng Màn Hình & Kịch Bản Thao Tác Chuẩn](#2-công-dụng-từng-màn-hình--kịch-bản-thao-tác-chuẩn)
3. [Hướng Dẫn Cấu Hình Hệ Thống Trên Web (`/#/workflow`)](#3-hướng-dẫn-cấu-hình-hệ-thống-trên-web-workflow)
4. [Cấu Trúc JSON Chuẩn Để Tự Tạo Test Case (Schema Playground)](#4-cấu-trúc-json-chuẩn-để-tự-tạo-test-case-schema-playground)
   - [Từ điển các trường dữ liệu (Schema Dictionary)](#từ-điển-các-trường-dữ-liệu-schema-dictionary)
   - [File JSON Template mẫu chuẩn](#file-json-template-mẫu-chuẩn)
   - [Bí kíp tạo 4 loại Test Case (4-Quadrant Strategy)](#bí-kíp-tạo-4-loại-test-case-4-quadrant-strategy)
5. [Trung Tâm Đánh Giá Sprint 1 & Verify Sandbox](#5-trung-tâm-đánh-giá-sprint-1--verify-sandbox)
   - [Barem điểm & Tiêu chí đánh giá Sprint 1](#barem-điểm--tiêu-chí-đánh-giá-sprint-1)
   - [Cách chạy Verify Harness 90 Giây (1-Click Run)](#cách-chạy-verify-harness-90-giây-1-click-run)
   - [Thử nghiệm Test Case ẩn của Ban Giám Khảo](#thử-nghiệm-test-case-ẩn-của-ban-giám-khảo)
6. [Bảng Tra Cứu Lệnh Dòng Lệnh Nhanh (CLI Reference)](#6-bảng-tra-cứu-lệnh-dòng-lệnh-nhanh-cli-reference)

---

## 1. Giới Thiệu & Tính Năng WalkMe Tour

**8D Problem Solving Copilot** là giải pháp trợ lý AI chuyên sâu cho ngành cơ khí chính xác và sản xuất ô tô, tự động hóa toàn bộ quy trình giải quyết sự cố chất lượng theo chuẩn quốc tế **8D (Eight Disciplines - Ford/AIAG/VDA)**.

### 🚀 Tính năng WalkMe Tour (Trải nghiệm 5 phút dắt tay chỉ việc):
Trên giao diện Web (`/#/guide`), bạn chỉ cần bấm nút **"🚀 Bắt Đầu WalkMe Tour"**, hệ thống sẽ mở trình hướng dẫn tương tác dẫn dắt qua 5 trạm nghiệp vụ thực tế:
* **Trạm 1:** Khám phá danh sách sự cố tại `/#/8d` (Cách lọc và mở sự cố mẫu `8D-10048412`).
* **Trạm 2:** Khám phá không gian giải quyết sự cố `/#/8d/:id` (Xem AI gợi ý 8 bước và tra cứu tiền lệ lịch sử).
* **Trạm 3:** Chẩn đoán mù & Bằng chứng vật lý (Kiểm tra sensor đối chứng, lật ngược thiên kiến đổ lỗi con người).
* **Trạm 4:** Cấu hình AI Workflow tại `/#/workflow` (Cách đổi Model AI, sửa Prompt và chỉnh thanh trượt trọng số).
* **Trạm 5:** Tạo Test Case JSON & Chạy Verify 90 Giây (Tải mẫu JSON, kiểm tra hợp lệ và bấm chạy kiểm thử).

---

## 2. Công Dụng Từng Màn Hình & Kịch Bản Thao Tác Chuẩn

Tình huống mẫu xuyên suốt: *Sự cố bavia mép bích phay CNC Line 7 (`WC-MILL-07`, `MAT-10247`)*.

### 1. Trang Danh Sách Hồ Sơ 8D (`/#/8d`)
* **Mục đích:** Bảng điều khiển trung tâm quản lý vòng đời của toàn bộ các thông báo chất lượng.
* **Đối tượng:** Kỹ sư chất lượng (QE), Trưởng chuyền, Quản lý nhà máy.
* **3 Bước thao tác chuẩn:**
  1. Lọc danh sách theo trạng thái (*Open*, *In Progress*, *Completed*) hoặc SLA xử lý.
  2. Bấm vào dòng sự cố để mở không gian làm việc chi tiết.
  3. Hoặc bấm nút *"Create Defect"* ở góc phải để nhập nhanh một sự cố mới.

### 2. Không Gian Giải Quyết Sự Cố 8 Bước (`/#/8d/:id`)
* **Mục đích:** Không gian làm việc chi tiết thực hiện chuẩn phương pháp luận D1 $\to$ D8.
* **Tính năng độc quyền:**
  * **Precedent Panel:** AI tự động quét vector database để gợi ý các vụ án tương tự trong lịch sử kèm % khớp.
  * **Physical Evidence:** Đối chiếu số liệu cảm biến thực tế với lời khai để loại bỏ thiên kiến xác nhận.
* **3 Bước thao tác chuẩn:**
  1. Xem các ca tiền lệ tương đồng trong lịch sử tại thanh bên phải.
  2. Duyệt qua từng bước D1 $\to$ D8, bấm vào các gợi ý do AI đề xuất để chỉnh sửa hoặc chấp thuận.
  3. Bấm *"Approve Step"* để khóa bước hiện tại và mở khóa bước kế tiếp.

### 3. Quản Lý Dữ Liệu Gốc Master Data (`/#/master-data`)
* **Mục đích:** Tra cứu danh mục công nghiệp của nhà máy: Dây chuyền (Work Centers), Vật tư (Materials), Chuyên gia (SMEs), Bảng mã lỗi (Defect Catalogue).
* **Ứng dụng:** Tra cứu mã chuẩn SAP (`WC-MILL-07`, `MAT-10247`) khi soạn test case mới hoặc gán đội D1.

### 4. Cấu Hình AI Workflow (`/#/workflow`)
* **Mục đích:** Trung tâm điều khiển toàn bộ trí thông minh AI của hệ thống. Tinh chỉnh câu lệnh Prompt cho từng bước D1-D8, chọn nhà cung cấp mô hình LLM và cài đặt trọng số tìm kiếm tiền lệ.

---

## 3. Hướng Dẫn Cấu Hình Hệ Thống Trên Web (`/#/workflow`)

Người dùng có thể tinh chỉnh toàn bộ hệ thống ngay trên giao diện web qua 3 trụ cột chính:

### 1. Đổi Mô Hình AI (LLM Provider)
* **DeepSeek V4.1 Flash (Khuyến nghị):** Tốc độ phản hồi cực nhanh, suy luận logic 5-Why sắc bén, chi phí tối ưu.
* **Gemini 2.5 Flash:** Khả năng trích xuất thực thể và hiểu ngôn ngữ kỹ thuật đa ngôn ngữ rất tốt.
* **Local Mock Mode (Free / Zero-Cost):** Chạy độc lập hoàn toàn trong máy, không cần kết nối mạng hay API key.

### 2. Quản Lý Prompt D1 - D8
Mỗi bước D1-D8 có System Prompt & User Prompt độc lập. Khi chỉnh sửa, bạn có thể sử dụng các biến nội suy:
* `{{symptomShortText}}`: Mô tả hiện tượng lỗi ban đầu.
* `{{material}}`: Thông tin mã & nhóm linh kiện.
* `{{workCenter}}`: Dây chuyền/máy sản xuất.
* `{{inspections}}`: Bảng số đo dung sai kỹ thuật.
* `{{precedents}}`: Danh sách hồ sơ tiền lệ tương đồng.

### 3. Tinh Chỉnh Bộ Máy Tìm Kiếm Tiền Lệ (Retrieval Engine)
* **Scoring Weights:** Kéo thanh trượt để điều chỉnh mức độ ưu tiên: Ưu tiên trùng máy (Work Center: 40%), trùng linh kiện (Material: 35%), hay trùng triệu chứng (25%).
* **Ngưỡng An Toàn Cutoff 60% (Rule 3.b):** Nếu điểm tương đồng vector dưới 0.60, hệ thống tự động kích hoạt chế độ **Safe Refusal** để ngăn chặn AI sinh ảo giác.

---

## 4. Cấu Trúc JSON Chuẩn Để Tự Tạo Test Case (Schema Playground)

### Từ điển các trường dữ liệu (Schema Dictionary):

| Tên Trường (Field) | Bắt Buộc? | Kiểu Dữ Liệu | Ý Nghĩa Trong 8D | Ví Dụ Mẫu |
|---|---|---|---|---|
| `notificationId` | **Bắt buộc** | string | Mã hồ sơ sự cố định danh | `"8D-10049001"` |
| `symptomShortText` | **Bắt buộc** | string | Mô tả hiện tượng lỗi (dùng tính vector) | `"Rough edge felt on bracket flange after milling"` |
| `material.materialId` | **Bắt buộc** | string | Mã linh kiện/vật tư bị lỗi | `"MAT-10247"` |
| `workCenter.workCenterId` | **Bắt buộc** | string | Mã dây chuyền/máy sản xuất | `"WC-MILL-07"` |
| `origin` | Tùy chọn | string | Nguồn phát hiện: Q1 (Khách), Q3 (Nội bộ) | `"Q3 - Internal Defect"` |
| `inspections` | **Khuyên dùng** | array | Bảng số đo thực tế vs dung sai quy định | `[{"measuredValue": "0.26mm", "specValue": "max 0.10mm"}]` |
| `causesIshikawa` | Tùy chọn | array | Nhận định xương cá ban đầu của kỹ sư | `[{"category": "Machine", "cause": "..."}]` |

### File JSON Template mẫu chuẩn:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$testCaseId": "TC-CUSTOM-01",
  "$title": "Custom Manufacturing Defect Test Case",
  "notificationId": "8D-10049999",
  "origin": "Q3 - Internal Defect",
  "symptomShortText": "Bavia mep bich vuot qua gioi han cho phep sau khi phay",
  "status": "In Process",
  "foundDate": "2026-09-22",
  "material": {
    "materialId": "MAT-10247",
    "description": "Bracket Housing X240",
    "materialGroup": "MG-HOUSING"
  },
  "workCenter": {
    "workCenterId": "WC-MILL-07",
    "description": "CNC Milling Line 7"
  },
  "inspections": [
    {
      "characteristic": "Burr height at flange edge",
      "measuredValue": "0.26mm",
      "specValue": "max 0.10mm"
    }
  ]
}
```
*(Trên Web UI, bạn có thể bấm nút **"Tải .json về"** để lưu file `test-case-template-8D.json` trực tiếp về máy).*

### Bí kíp tạo 4 loại Test Case (4-Quadrant Strategy):
1. **Happy Path (TC-01):** Dùng mã máy `WC-MILL-07`, mã vật tư `MAT-10247`, số đo bavia `0.26mm`. Hệ thống sẽ khớp 100% với case tiền lệ `8D-10048412`.
2. **Dirty Data (TC-02):** Dùng chuỗi tiếng Đức `"Grat an Flanschkante"`, số thập phân phẩy `"0,32 mm"`, ID thừa khoảng trắng `" MAT-10247 "`. Hệ thống sẽ chuẩn hóa tự động và báo cáo các trường thiếu.
3. **Bias Hunter (TC-03):** Nhập nhận định kỹ sư đổ lỗi cho `Man`, nhưng trong `inspections` ghi nhận độ rơ dao lệch `0.9mm` (trần 0.2mm) trên cả 3 ca. AI sẽ phản biện và kết luận do `Machine`.
4. **Safe Refusal (TC-04):** Dùng công nghệ hàn laser mới `WC-WELD-11`, linh kiện `MAT-12800`. Độ tương đồng < 60% sẽ kích hoạt từ chối an toàn và chuyển giao chuyên gia hàn.

---

## 5. Trung Tâm Đánh Giá Sprint 1 & Verify Sandbox

### Barem điểm & Tiêu chí đánh giá Sprint 1:
* **Tiêu Chí 2 (12 Điểm):** Bộ 4 test case chiến lược chạy tự động trong < 90s (Thực tế: **~0.8s**, PASS 4/4).
* **Tiêu Chí 3 (8 Điểm):** Two-Tier Defense xử lý hợp lý hoặc từ chối hợp lý cả 2 test case của Giám Khảo.
* **Quy Định Bắt Buộc 3.b:** Chặn đứng ảo giác khi độ tương đồng < 60%, tự động soạn 3 câu hỏi chuyển giao SME.

### Cách chạy Verify Harness 90 Giây (1-Click Run):
* **Trên Web:** Vào `/#/guide` $\to$ cuộn xuống mục **"4. Đánh Giá Sprint 1"** $\to$ bấm **"Chạy Kiểm Thử 90 Giây"**.
* **Qua Terminal:**
  ```bash
  npm run verify:sprint1
  ```

### Thử nghiệm Test Case ẩn của Ban Giám Khảo:
* **Trên Web:** Dán JSON bất kỳ của BTC vào ô **Two-Tier Defense Sandbox** và bấm **"Kiểm Tra Quyết Định Phòng Thủ"**.
* **Qua Terminal:**
  ```bash
  npm run verify:sprint1 -- --judge-input <file.json>
  ```

---

## 6. Bảng Tra Cứu Lệnh Dòng Lệnh Nhanh (CLI Reference)

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
*Tài liệu được biên soạn và bảo chứng bởi Đội ngũ Kỹ thuật Autonomous 8D Copilot — MLAI Hackathon 2026.*
