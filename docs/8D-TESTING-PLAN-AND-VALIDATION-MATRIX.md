# 🧪 Kế Hoạch Kiểm Thử Toàn Diện & Ma Trận Validation: 8D Copilot

> **Tài liệu Kế Hoạch & Kịch Bản Kiểm Thử Chuyên Sâu (End-to-End Test Plan & Validation Matrix)**
> **Dự án**: CNMA Proresolve (`8d-copilot`)
> **Phạm vi kiểm thử**: Phân hệ `Create Defect`, `Object Schema` nhúng trong từng D, Pipeline 5 Tab cấu hình (D1 $\rightarrow$ D8), và Bộ lọc chống ảo giác (Constraints).

---

## 📋 MỤC LỤC

1. [Mục tiêu &amp; Chiến lược Kiểm thử](#1-mục-tiêu--chiến-lược-kiểm-thử)
2. [Chi tiết Kiểm thử Phân hệ Create Defect](#2-chi-tiết-kiểm-thử-phân-hệ-create-defect)
3. [Chi tiết Kiểm thử Object Schema &amp; Test Score Panel](#3-chi-tiết-kiểm-thử-object-schema--test-score-panel)
4. [Chi tiết Kiểm thử Pipeline 5 Tab Từng Bước (D1 - D8)](#4-chi-tiết-kiểm-thử-pipeline-5-tab-từng-bước-d1---d8)
5. [5 Kịch Bản Kiểm Thử Thực Tế (Bao gồm Edge Cases Khó Nhất)](#5-5-kịch-bản-kiểm-thử-thực-tế-bao-gồm-edge-cases-khó-nhất)
6. [Ma Trận Kiểm Thử Tự Động &amp; Lệnh Thực Thi (Automated Test Matrix)](#6-ma-trận-kiểm-thử-tự-động--lệnh-thực-thi)
7. [Checklist Thực Hiện Kiểm Thử Toàn Diện (Actionable Checklist)](#7-checklist-thực-hiện-kiểm-thử-toàn-diện)

---

## 1. 🎯 MỤC TIÊU & CHIẾN LƯỢC KIỂM THỬ

### 1.1. Mục Tiêu Cốt Lõi

* **Tính Đúng đắn (Correctness)**: Đảm bảo dữ liệu đầu vào (SAP facts, thông số kiểm tra, tiền lệ lịch sử) được ánh xạ chính xác $100\%$ vào ngữ cảnh của AI, không bị méo mó.
* **Tính Toàn vẹn (Integrity & Non-Hallucination)**: Đảm bảo AI không bao giờ bịa đặt nhân sự, số đo, hoặc nguyên nhân gốc khi không có căn cứ chứng minh.
* **Độ Ổn định Xử lý Dữ liệu Thực tế (Robustness on Dirty Data)**: Xử lý mượt mà dữ liệu SAP bẩn (ngày định dạng Đức `DD.MM.YYYY`, dấu phẩy thập phân `0,26`, số đo nằm trong câu văn thô).
* **Kiểm chứng Cấu hình Linh hoạt (Configurability Verification)**: Mọi thay đổi tại 5 Tab (`Object Schema`, `Data Schema`, `Prompt Guide`, `Form Editor`, `Constraints`) phải phản ánh trực tiếp và tức thì lên Output khi thực thi.

---

## 2. 📝 CHI TIẾT KIỂM THỬ PHÂN HỆ CREATE DEFECT

Trang kiểm thử: [`/create-defect`](file:///d:/GitHub/8d-copilot/app/cnma_proresolve_ui/src/pages/create-defect/index.tsx)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CREATE DEFECT TEST FLOW                                        │
│  [1-Click Presets] ──> [Visual Form] <──> [JSON Editor] ──> [Start 8D Analysis] ──> [Report UI]   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```


| ID              | Chức năng kiểm thử                       | Thao tác / Đầu vào (Input)                                                                                                                                                     | Kết quả kỳ vọng (Expected Output)                                                                                                                                     |
| :-------------- | :------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **CD-01** | **1-Click Presets**                    | Bấm lần lượt 3 thẻ mẫu:1. *Q3 Internal - Flange Burr*2. *Q1 Customer - Coolant Leakage*3. *Q3 Internal - Weld Porosity*                                                | Toàn bộ các trường trong form (Notification ID, Origin, Material, Work Center, Inspections, Customer Ref) tự động điền đúng mẫu tương ứng ngay lập tức. |
| **CD-02** | **Dynamic Inspection Rows**            | Bấm nút`+ Add inspection`, điền thông số đo: `Characteristic: Độ nhám bề mặt RaMeasured: 1.8 um``Spec: max 0.8 um`. Bấm icon thùng rác để xóa 1 dòng.     | Thêm mới hàng kiểm tra thành công, giá trị hiển thị đúng; khi xóa hàng thì cập nhật lại mảng dữ liệu mà không gây lỗi crash UI.                  |
| **CD-03** | **Form $\leftrightarrow$ JSON Sync** | Nhập dữ liệu trên Visual Form$\rightarrow$ Chuyển sang tab `JSON Editor` $\rightarrow$ Sửa một giá trị trong JSON $\rightarrow$ Chuyển ngược lại Visual Form. | Dữ liệu được đồng bộ 2 chiều hoàn hảo. Nếu JSON sai cú pháp, hiển thị thông báo lỗi màu đỏ và vô hiệu hóa nút submit.                          |
| **CD-04** | **Validation Form Bắt buộc**         | Bỏ trống`symptomShortText` hoặc `materialId`, bấm `Start 8D Analysis`.                                                                                                   | Nút submit hiển thị thông báo yêu cầu điền đầy đủ các trường bắt buộc; không gửi request rác lên server.                                            |
| **CD-05** | **Khởi chạy Pipeline Thực tế**     | Điền thông tin hợp lệ, bấm`Start 8D Analysis`.                                                                                                                             | Xuất hiện hiệu ứng loading Spinner với dòng trạng thái xử lý; sau 20-35 giây nhận được ID report, tự động điều hướng sang`/eight-d/:id`.          |

---

## 3. 🔍 CHI TIẾT KIỂM THỬ OBJECT SCHEMA & TEST SCORE PANEL

Trang kiểm thử: Tab `Object Schema` của từng bước D trong *Training Center* hoặc [`/object-schema`](file:///d:/GitHub/8d-copilot/app/cnma_proresolve_ui/src/pages/object-schema/index.tsx).

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 OBJECT SCHEMA 3-PANEL TEST FLOW                                  │
│  [Panel 1: Source Fields] ──(Drag & Drop)──> [Panel 2: Profile Config] ──> [Panel 3: Score Test]│
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

| ID              | Chức năng kiểm thử                                          | Thao tác / Đầu vào (Input)                                                                   | Kết quả kỳ vọng (Expected Output)                                                                                                                                                                                                                        |
| :-------------- | :-------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OS-01** | **Kéo thả trường dữ liệu (Drag & Drop)**            | Kéo trường`workCenterDesc` từ Panel 1 thả vào Panel 2 của Profile.                      | Trường mới xuất hiện trong danh sách tiêu chí của Profile, tự động sinh`criterionKey` duy nhất, mặc định `weight = 1`.                                                                                                                   |
| **OS-02** | **Xóa trường tiêu chí**                              | Kéo 1 trường từ Panel 2 thả ngược lại Panel 1 (hoặc bấm nút Remove).                  | Trường biến mất khỏi Profile; nếu chưa lưu, xuất hiện badge cam`Unsaved changes`.                                                                                                                                                                |
| **OS-03** | **Cấu hình Trọng số & Sàn Cosine**                   | Chọn`matchType = cosine`, chỉnh `weight = 4`, `minSimilarity = 0.70`.                    | Trọng số tối đa`maxScore` của Profile tự động tăng tương ứng; nếu cosine thực tế $< 0.70$ thì tiêu chí này nhận $0$ điểm.                                                                                                        |
| **OS-04** | **Chấm điểm Thử nghiệm 2 Case (`StepScorePanel`)** | Tại Panel 3, chọn Case A =`8D-10048412`, Case B = `8D-10048577`. Bấm `Score this pair`. | Hiển thị điểm số chi tiết dạng phân số (ví dụ:`8/11`), bảng breakdown từng tiêu chí (exact/fallback/none, điểm đạt được). Hiển thị rõ: `✓ D1 would see this case` (nếu điểm $\ge minScore$) hoặc `✗ Below threshold`. |
| **OS-05** | **Nhúng Vector Embeddings Thiếu**                       | Nếu kho dữ liệu có case chưa nhúng vector, bấm`Embed missing cases`.                    | Hiển thị Toast thông báo số lượng case nhúng thành công; số lượng`embedded/total` cập nhật đủ $100\%$.                                                                                                                                  |

---

## 4. ⚙️ CHI TIẾT KIỂM THỬ PIPELINE 5 TAB TỪNG BƯỚC (D1 - D8)

Trang kiểm thử: [`/ai-settings/step-prompts`](file:///d:/GitHub/8d-copilot/app/cnma_proresolve_ui/src/pages/ai-settings/step-prompts-tab.tsx) hoặc [`Workflow Discipline Editor`](file:///d:/GitHub/8d-copilot/app/cnma_proresolve_ui/src/pages/workflow/discipline-section.tsx).

```
  [1. Object Schema] ──> [2. Data Schema] ──> [3. Prompt Guide] ──> [4. Form Editor] ──> [5. Constraints]
```

### 👥 D1: Establish the Team

* **Data Schema Test**: Thêm trường `externalConsultant` (kiểu `string`). Kiểm tra JSON Schema sinh ra có hợp lệ không.
* **Prompt Guide Test**: Sửa prompt: *"Khi không có nhân sự, chỉ đề xuất tối đa 2 người từ case tiền lệ có cùng Work Center"*.
* **Form Editor Test**: Đổi widget của trường `confidence` từ `input` sang `slider`. Kéo thả trường `sources` lên đầu.
* **Constraints Test**: Đặt rule `D1_GROUNDING` với pattern `^(team\.|precedents#)`.
  * *Thử nghiệm vi phạm*: Cố tình ép prompt tạo ra tên *"Kỹ sư John Doe"* không có trong case $\rightarrow$ **Expected Output**: Kết quả D1 bị gắn cờ `Error: Team names must come from current team or cited precedent`.

---

### 📝 D2: Describe the Problem

* **Data Schema Test**: Đảm bảo mảng `inspections` nhận đúng cấu trúc `characteristic`, `measuredValue`, `specValue`.
* **Prompt Guide Test**: Hướng dẫn AI bắt buộc phải viết rõ câu so sánh: *"Giá trị đo được [X] vượt quá giới hạn cho phép [Y]"*.
* **Constraints Test (`D2_CITATIONS`)**: Bật rule `citationRequired` mức độ `error`.
  * *Thử nghiệm*: Dữ liệu có đo lường `0.26mm` nhưng AI viết `0.26mm` mà không gắn thẻ nguồn `[inspections]` $\rightarrow$ **Expected Output**: Hệ thống chặn và báo lỗi thiếu trích dẫn nguồn thực tế.

---

### 🛡️ D3: Interim Containment Actions

* **Prompt Guide Test**: Đặt nguyên tắc: *"Nếu là lỗi khách hàng (Q1), bắt buộc phải có hành động kiểm tra hàng đang lưu kho và hàng đang trên đường vận chuyển"*.
* **Constraints Test (`D3_SOURCES`)**: Kiểm tra pattern `^(actions\.containment|customer|precedents#)`. Hành động đề xuất từ tiền lệ phải ghi rõ `(Đề xuất từ precedent #8D-10048992)` chứ không được mạo danh là hành động nhà máy đã làm.

---

### 🔬 D4: Root Cause Analysis (Trọng Tâm)

* **Object Schema Test**: Thiết lập Profile D4 với trọng số Vector Cosine $\ge 0.72$ (trọng số 5 điểm). Kiểm chứng AI tìm ra đúng case có cùng cơ chế nứt/bavia dù mã lỗi SAP khác nhau.
* **Blind Diagnosis Verification**: Đảm bảo AI thực hiện chẩn đoán độc lập (Blind Diagnosis) trước khi nhìn vào kết luận cũ.
* **Constraints Test (`D4_DISCLOSURE`)**: Rule `requiredDisclosure` bắt buộc phải có cụm từ `independent verification`.
  * *Expected Output*: D4 xuất bản mục đối chiếu: *"Chẩn đoán độc lập đồng thuận với kết quả 5-Why ở nhánh Method/Tool Wear"*.

---

### 🔧 D5, 📈 D6, 🔄 D7, 🏆 D8

* **D5 (Corrective)**: Kiểm tra bảng ánh xạ từng hành động khắc phục tương ứng với từng nấc của chuỗi 5-Why ở D4.
* **D6 (Verification)**: Kiểm tra kế hoạch nghiệm thu có đủ 4 yếu tố: Đại lượng đo, Cỡ mẫu ($N$), Thời gian theo dõi, và Tiêu chuẩn Pass/Fail.
* **D7 (Prevent Recurrence)**: Kiểm tra việc chỉ định cập nhật tài liệu FMEA / SOP / Control Plan.
* **D8 (Closure & Recognition)**: Kiểm tra việc tự động lấy đúng tên các kỹ sư từ D1 để đưa vào thư cảm ơn/tuyên dương ở D8.

---

## 5. 🧪 5 KỊCH BẢN KIỂM THỬ THỰC TẾ (BAO GỒM EDGE CASES KHÓ NHẤT)

---

### 🟢 KỊCH BẢN 1: Clean Golden Dataset (Tiêu Chuẩn Chuẩn Mực)

* **File nguồn**: [`mock-data/clean/case-8D-10048412.json`](file:///d:/GitHub/8d-copilot/mock-data/clean/case-8D-10048412.json)
* **Đặc điểm Input**: Dữ liệu SAP hoàn hảo, ngày chuẩn ISO `2026-08-20`, số đo tách cột `0.26` / `0.10`, đầy đủ 6 nhánh Ishikawa, chuỗi 5-Why hoàn chỉnh 5 bước.
* **Quy trình thử nghiệm**:
  1. Vào `/create-defect`, chọn preset `Q3 Internal Defect - Flange Burr`.
  2. Bấm `Start 8D Analysis`.
* **Kết quả kỳ vọng (Expected Output)**:
  * Thời gian hoàn thành: $20 - 30$ giây.
  * Trạng thái Report: `Completed`.
  * D1: Nhận diện đủ Leader và Specialist từ dữ liệu hiện tại.
  * D2: Có bảng 5W2H định lượng, trích dẫn chính xác `Burr height at flange edge: 0.26mm (max 0.10mm)`.
  * D4: Chuỗi 5-Why 5 bước sắc bén, chỉ định nhánh `Machine/Tooling`, điểm tin cậy $\ge 90\%$.
  * Constraints: $0$ Warning, $0$ Error.

---

### 🔴 KỊCH BẢN 2: Dirty SAP QM Real-world Data (Dữ Liệu SAP Bẩn Thực Tế)

* **File nguồn**: [`mock-data/dirty/case-8D-90048412.json`](file:///d:/GitHub/8d-copilot/mock-data/dirty/case-8D-90048412.json)
* **Đặc điểm Input (Edge Cases)**:
  * Ngày định dạng Đức: `20.08.2026`.
  * Dấu phẩy thập phân kiểu Châu Âu: `0,26 mm` (nằm lẫn trong chuỗi mô tả tự do).
  * Chuỗi 5-Why bị cụt (chỉ có 2 câu hỏi Why).
  * Chỉ điều tra 2 nhánh Ishikawa thay vì 6 nhánh.
  * Cờ Root Cause đánh dấu là chữ thường `'x'` thay vì `'Y'`.
* **Quy trình thử nghiệm**:
  1. Vào `/create-defect` $\rightarrow$ Chuyển sang `JSON Editor`.
  2. Dán toàn bộ nội dung file `mock-data/dirty/case-8D-90048412.json`.
  3. Bấm `Start 8D Analysis`.
* **Kết quả kỳ vọng (Expected Output)**:
  * `datasetValidator` **KHÔNG được chặn** (vẫn cho đi tiếp vào AI Pipeline).
  * AI Mapper chuẩn hóa thành công: Ngày chuyển về ISO `2026-08-20`, số đo trích xuất thành số thực `0.26`.
  * Tại D4: AI phát hiện chuỗi 5-Why bị thiếu, tự động bổ sung lập luận logic và cảnh báo: *"Dữ liệu ghi nhận ban đầu có 5-Why chưa hoàn chỉnh; AI đã tái cấu trúc dựa trên bằng chứng vật lý"*.
  * Constraints: Gắn cờ `Info` hoặc `Warning` về dữ liệu mỏng nhưng không gây `Error Crash`.

---

### 🟡 KỊCH BẢN 3: Zero Precedents & No Team Assigned (Không Có Tiền Lệ & Khuyết Nhân Sự)

* **Đặc điểm Input (Edge Case Cực Hạn)**:
  * Một sản phẩm hoàn toàn mới (`Material: MAT-NEW-9999`) trên một Work Center mới (`WC-NEW-01`).
  * Danh mục lỗi chưa từng có trong kho dữ liệu lịch sử.
  * Hoàn toàn không có dữ liệu nhân sự ban đầu.
* **Quy trình thử nghiệm**:
  1. Vào `/create-defect`, nhập mã lỗi mới lạ `DEF-UNKNOWN-999`, không nhập danh sách team.
  2. Bấm `Start 8D Analysis`.
* **Kết quả kỳ vọng (Expected Output)**:
  * Điểm tìm kiếm tiền lệ $< minScore$ (ví dụ: $0/11$ điểm) $\rightarrow$ Hệ thống báo rõ: `No matching precedent cases above threshold 3`.
  * **Tại D1**: AI **tuyệt đối không được tự bịa ra tên người lạ**. AI phải xuất ra thông báo: *"Chưa có nhân sự ghi nhận và không tìm thấy case tiền lệ tương tự. Yêu cầu Quản lý Chất lượng phân công thủ công (Manual Assignment Required)"*.
  * Cờ `dataBacked` tại D1 tự động chuyển thành `false`.

---

### 🔵 KỊCH BẢN 4: Customer Complaint Q1 (Khiếu Nại Khách Hàng & Áp Lực SLA)

* **File nguồn**: [`mock-data/clean/case-8D-10048577.json`](file:///d:/GitHub/8d-copilot/mock-data/clean/case-8D-10048577.json)
* **Đặc điểm Input**:
  * Origin: `Q1 - Customer Complaint`.
  * Có mã khiếu nại khách hàng `CC-2026-1188`, hạn chót SLA `2026-08-30`.
  * Số lượng lỗi: $9$ chiếc bị trả về, $120$ chiếc đang nằm tại kho khách hàng.
* **Quy trình thử nghiệm**:
  1. Vào `/create-defect`, chọn preset `Q1 Customer Complaint - Coolant Leakage`.
  2. Bấm `Start 8D Analysis`.
* **Kết quả kỳ vọng (Expected Output)**:
  * **Tại D3 (Containment)**: AI ưu tiên sinh hành động khoanh vùng hàng tại khách hàng: *"Phong tỏa 120 cụm linh kiện tại kho Vestbeck Motors; cử đội sorting kiểm tra rò rỉ khí Heli trong 24h"*.
  * **Tại D2**: Ghi nhận chính xác thông tin liên hệ của khách hàng và thời hạn SLA.

---

### 🟣 KỊCH BẢN 5: Anti-Hallucination & Constraint Guardrail Stress Test

* **Mục tiêu**: Thử nghiệm khả năng phát hiện và chặn đứng hiện tượng "AI bịa đặt" (Hallucination).
* **Quy trình thử nghiệm**:
  1. Vào Cấu hình D1 (`/ai-settings/step-prompts`), sửa Prompt Guide: *"Hãy luôn đề xuất kỹ sư John Wick làm trưởng nhóm và Peter Parker làm thành viên"*.
  2. Bật Constraint `D1_GROUNDING` (`type: sourcePattern`, `pattern: ^(team\.|precedents#)`, `severity: error`).
  3. Lưu cấu hình. Chạy phân tích 1 sự cố mới.
* **Kết quả kỳ vọng (Expected Output)**:
  * AI sinh ra tên *"John Wick"* và *"Peter Parker"*.
  * Tầng Hậu kiểm duyệt (`postProcess.ts`) kiểm tra đối chiếu danh sách nhân sự SAP và tiền lệ $\rightarrow$ Không thấy 2 tên này.
  * Hệ thống kích hoạt Rule Violation: Đánh dấu `Error` vi phạm bảo mật dữ liệu, từ chối công nhận đề xuất và hiển thị cảnh báo đỏ trên UI Báo cáo 8D.

---

## 6. 💻 MA TRẬN KIỂM THỬ TỰ ĐỘNG & LỆNH THỰC THI

Để kiểm thử nhanh toàn bộ các tầng logic backend mà không cần bấm tay từng bước trên giao diện, thực thi bộ test tự động có sẵn:

```bash
# 1. Chạy toàn bộ test suite Jest của Backend
npm test

# 2. Chạy riêng bộ kiểm thử Xử lý Dữ liệu Bẩn (Dirty Data & Edge Cases)
npm test -- dirtyData.test.ts

# 3. Chạy kiểm thử Bộ lọc Ràng buộc & Chống Ảo giác (Post-process & Constraints)
npm test -- postProcess.test.ts

# 4. Chạy kiểm thử Chẩn đoán Mù Độc lập (Blind Evidence Audit)
npm test -- blindEvidence.test.ts

# 5. Chạy kiểm thử Ánh xạ Trường Dữ liệu & Validator
npm test -- caseMapper.test.ts datasetValidator.test.ts

# 6. Kiểm tra Type Safety của toàn bộ dự án
npm run typecheck
```

---

## 7. ✅ CHECKLIST THỰC HIỆN KIỂM THỬ TOÀN DIỆN (ACTIONABLE CHECKLIST)

### A. Kiểm Thử Phân Hệ Create Defect

- [ ] Test 1-Click Preset: `Q3 Flange Burr` nạp đúng $100\%$ trường.
- [ ] Test 1-Click Preset: `Q1 Coolant Leakage` nạp đúng thông tin khách hàng/SLA.
- [ ] Test 1-Click Preset: `Q3 Weld Porosity` nạp đúng thông số siêu âm.
- [ ] Test Thêm / Bớt dòng kiểm tra đo lường (`inspections`) động.
- [ ] Test Chuyển đổi 2 chiều giữa Visual Form và JSON Editor không bị mất dữ liệu.
- [ ] Test Nút `Start 8D Analysis` kích hoạt thành công pipeline và chuyển trang mượt mà.

### B. Kiểm Thử Object Schema Trong Từng D

- [ ] Test Kéo - Thả trường dữ liệu từ Panel 1 sang Panel 2.
- [ ] Test Xóa trường dữ liệu khỏi Profile.
- [ ] Test Chỉnh sửa Trọng số (Weight) và Sàn Cosine (`minSimilarity`).
- [ ] Test Nút `Score this pair` trên Panel 3 cho ra điểm số và phân tích chính xác.
- [ ] Test Nút `Embed missing cases` tạo vector thành công cho kho case.
- [ ] Test Nút `Save Schema` và nút `Discard` hoàn tác thay đổi.

### C. Kiểm Thử Pipeline 5 Tab (D1 $\rightarrow$ D8)

- [ ] **D1**: Test đề xuất nhân sự từ case tiền lệ khi dữ liệu trống; test tính năng gán nhóm `saveTeamRoster`.
- [ ] **D2**: Test xuất bản 5W2H và Is/Is-Not; test bắt buộc trích dẫn số đo thực tế.
- [ ] **D3**: Test tạo checklist khoanh vùng 24h và phân biệt giữa hành động thực tế vs đề xuất.
- [ ] **D4**: Test phân tích 5-Why, biểu đồ Ishikawa và bắt buộc đối chiếu với kết quả Chẩn đoán Mù.
- [ ] **D5**: Test liên kết hành động khắc phục dài hạn vào chuỗi nguyên nhân D4.
- [ ] **D6**: Test kế hoạch nghiệm thu định lượng (Cỡ mẫu, Thời gian, Tiêu chuẩn).
- [ ] **D7**: Test liên kết cập nhật hồ sơ FMEA và SOP.
- [ ] **D8**: Test tổng kết bài học kinh nghiệm và lấy đúng danh sách nhân sự D1 để tuyên dương.

### D. Kiểm Thử Edge Cases & Lưới An Toàn

- [ ] Test Case dữ liệu bẩn (Định dạng ngày Đức `DD.MM.YYYY`, dấu phẩy thập phân `0,26`).
- [ ] Test Case không có tiền lệ phù hợp (Điểm $< minScore$) $\rightarrow$ AI không bịa đặt.
- [ ] Test Rule `citationRequired` bắt lỗi khi thiếu nguồn trích dẫn.
- [ ] Test Rule `sourcePattern` chặn đứng tên nhân sự ảo giác.
