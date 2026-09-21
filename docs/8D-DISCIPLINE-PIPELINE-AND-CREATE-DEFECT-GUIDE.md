# 📘 Hướng Dẫn Toàn Diện: Pipeline Cấu Hình 8D Từng Bước & Phân Hệ Create Defect

> **Tài liệu Kỹ thuật & Hướng dẫn Vận hành**
> **Dự án**: CNMA Proresolve (`8d-copilot`)
> **Phiên bản cập nhật**: Kiến trúc Pipeline 5 Tab Hợp Nhất & Giao Diện Create Defect

---

## 🌟 PHẦN 1: TỔNG QUAN CÁC ĐIỂM CẢI TIẾN MỚI

Hệ thống đã được nâng cấp toàn diện nhằm chuyển đổi từ một công cụ thử nghiệm AI đơn lẻ sang một **Nền tảng Copilot Quản lý Chất lượng Doanh nghiệp (Enterprise 8D Copilot)**. Ba cải tiến cốt lõi bao gồm:

1. **Merge `Object Schema` trực tiếp vào trong từng bước D (`StepObjectSchemaEditor`)**:

   - Trước đây, cấu hình tìm kiếm tương đồng (Similarity Search) nằm phân tán ở một trang bên ngoài, khiến người dùng khó hình dung bước D hiện tại đang lấy dữ liệu lịch sử như thế nào.
   - Hiện tại, mỗi bước D (D1 $\rightarrow$ D8) sở hữu trực tiếp tab `Object Schema` với **3 bảng điều khiển (3-panel workbench)**:
     - **Panel trái**: Toàn bộ từ điển trường dữ liệu SAP được quét từ các case thực tế.
     - **Panel giữa**: Các trường dữ liệu bước D dùng để so sánh, phương thức so khớp (`exact`, `keyword`, `family`, `cosine`), trọng số (Weight) và sàn ngưỡng điểm (`minScore`, `minSimilarity`).
     - **Panel phải (`StepScorePanel`)**: Thử nghiệm và chấm điểm trực tiếp 2 case thực tế từ kho dữ liệu lịch sử để kiểm chứng ngay lập tức: *"Bước D này có nhìn thấy case đó hay không?"*.
2. **Chuẩn hóa Pipeline Cấu hình 5 Bước Tuần Tự Cho Từng Bước D**:

   - Luồng cấu hình đi theo chu trình khép kín:
     $$
     \text{Object Schema} \longrightarrow \text{Data Schema} \longrightarrow \text{Prompt Guide} \longrightarrow \text{Form Editor} \longrightarrow \text{Constraints}
     $$
   - Đảm bảo tính nhất quán: **Nguồn tri thức quá khứ $\rightarrow$ Cấu trúc đầu vào hiện tại $\rightarrow$ Chỉ dẫn suy luận AI $\rightarrow$ Trình bày giao diện đầu ra $\rightarrow$ Lưới an toàn kiểm duyệt.**
3. **Bổ sung Phân Hệ `Create Defect` (Giao Diện Tạo Sự Cố Trực Quan)**:

   - Thay thế việc người dùng phải chuẩn bị và dán thủ công chuỗi JSON thô phức tạp.
   - Cung cấp giao diện biểu mẫu trực quan (Visual Form), hỗ trợ nạp nhanh các mẫu sự vụ kinh điển (1-Click Presets: Q3 Flange Burr, Q1 Coolant Leakage, Q3 Weld Porosity) và chuyển đổi linh hoạt sang JSON Editor.
   - Tự động chuyển tiếp dữ liệu sự cố thành Golden Dataset và kích hoạt trực tiếp pipeline AI `analyzeFromJson`.

---

## 🧭 PHẦN 2: CƠ CHẾ HOẠT ĐỘNG CỦA 5 TAB CẤU HÌNH TRONG MỖI BƯỚC D

Mỗi bước D trong quy trình 8D đều có 5 tab cấu hình tương ứng. Dưới đây là ý nghĩa và tác động của từng tab:

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    5 TABS CẤU HÌNH CHO MỖI BƯỚC D (D1 - D8)                               │
├───────────────────┬───────────────────┬───────────────────┬───────────────────┬───────────────────────────┤
│ 1. Object Schema  │ 2. Data Schema    │ 3. Prompt Guide   │ 4. Form Editor    │ 5. Constraints            │
│ (Precedent Rules) │ (Input Context)   │ (AI Reasoning)    │ (UI Layout)       │ (Quality Guardrails)      │
└───────────────────┴───────────────────┴───────────────────┴───────────────────┴───────────────────────────┘
```

| Tab Cấu Hình             | User Thiết Lập Điều Gì?                                                                                                                                                                                                                                          | Tác Động Lên Output Khi Thực Thi Process                                                                                                                                                                                |
| :------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Object Schema** | Kéo thả trường dữ liệu SAP (Work Center, Defect Code, Material Group, Ishikawa...); chọn kiểu so khớp (`exact`, `keyword`, `family`, `cosine`); gán trọng số điểm; đặt ngưỡng lọc `minScore`.                                            | Quyết định**3 case tiền lệ lịch sử (`precedents#N`) nào** được nạp vào bộ nhớ AI cho bước này. Nếu đặt trọng số sai, AI sẽ tham khảo các sự cố không liên quan.                        |
| **2. Data Schema**   | Định nghĩa cấu trúc JSON đầu vào (`inputSchemaJson`): Các trường thông tin bắt buộc/tùy chọn mà bước này cần đọc từ sự cố hiện tại (`x-source: sap_qm`, `ai_enrichment`, `vector_search`).                                        | Đảm bảo AI**nhận đủ dữ liệu đầu vào sạch** để phân tích. Giúp LLM biết chính xác dữ liệu nào có sẵn và dữ liệu nào bị thiếu để tránh bịa đặt.                                     |
| **3. Prompt Guide**  | Soạn thảo`systemPrompt` (vai trò, nguyên tắc làm việc) và `userTemplate` / `combinedPrompt` (hướng dẫn phương pháp luận, tích hợp các biến động `{{caseContext}}`, `{{precedents}}`).                                                  | Quyết định**phong cách hành văn, lập luận kỹ thuật, phương pháp suy luận** (ví dụ: áp dụng 5W2H, Ishikawa 6M, cách ly 24h, phân bổ vai trò nhân sự).                                           |
| **4. Form Editor**   | Kéo thả nhóm trường (`groups`), căn chỉnh độ rộng cột (33%, 50%, 100%), chọn widget hiển thị (`textarea`, `input`, `tag-selector`, `checkbox`, `multiSelect`).                                                                              | Quyết định**kết quả AI trả về sẽ hiển thị thành giao diện Form như thế nào** trên trang chi tiết Báo cáo 8D để người dùng đọc và chỉnh sửa trực tiếp.                                   |
| **5. Constraints**   | Thiết lập các quy tắc hậu kiểm duyệt (`rules`): Bắt buộc trích dẫn nguồn (`citationRequired`), khớp mẫu dẫn chứng (`sourcePattern`), cờ dữ liệu thực tế (`dataBackedWhenInputPresent`), công bố đối chiếu (`requiredDisclosure`). | Đóng vai trò là**lưới an toàn chống ảo giác (Anti-hallucination)**. Nếu kết luận của AI không có dẫn chứng hoặc vi phạm luật, hệ thống sẽ cảnh báo Warning hoặc chặn Error ngay lập tức. |

---

## 🔍 PHẦN 3: CHI TIẾT CHUYÊN SÂU TỪNG BƯỚC 8D (D1 ĐẾN D8)

---

### 👥 D1: Establish the Team (Thành lập Đội ngũ Giải quyết Sự cố)

#### 1. Mục đích nghiệp vụ & Trách nhiệm AI

* **Mục đích**: Thành lập nhóm chuyên trách liên phòng ban (Cross-functional Team) gồm Trưởng nhóm (Team Leader), Điều phối viên (Champion/Sponsor), và các thành viên kỹ thuật/chất lượng phù hợp nhất với loại sự cố.
* **AI Copilot**:
  * Nếu dữ liệu sự cố đã có danh sách nhân sự chính thức từ SAP QM $\rightarrow$ AI trích xuất và giải thích tính phù hợp của cơ cấu này.
  * Nếu chưa có nhân sự $\rightarrow$ AI đối chiếu với các case tiền lệ (`precedents#N`) có cùng *Work Center* hoặc *Họ vật tư* để **đề xuất đích danh các kỹ sư từng xử lý thành công sự cố tương tự**.

#### 2. Chi tiết 5 Tab Cấu Hình D1

* **1. Object Schema**:
  * *Trọng số chính*: `workCenter` (+4 điểm, `exact`), `materialFamily` (+3 điểm, `family` hoặc `keyword`).
  * *Nguyên do*: Tìm người đã quen thuộc với dây chuyền/máy móc đó và am hiểu chủng loại vật tư đó.
* **2. Data Schema (`inputSchemaJson`)**:
  * `teamMembers`: Danh sách nhân sự chính thức từ SAP QM (`x-source: sap_qm`).
  * `teamSize`: Số lượng nhân sự hiện tại (`x-source: ai_enrichment`).
  * `precedentTeams`: Danh sách đội ngũ từ các case tiền lệ tương tự (`x-source: vector_search`).
* **3. Prompt Guide (`combinedPrompt`)**:
  ```text
  Extract the official team leader and members with their functions.
  Explain why the skill mix is appropriate for this problem.
  When official team data is missing, recommend people only from matching precedent cases and cite precedents#N.
  When neither current team data nor precedents exist, state that manual assignment is required.
  ```
* **4. Form Editor (`formSchemaJson`)**:
  * Group `team`:
    * `content` (D1 team recommendation - `textarea`, 100% width, min 20 ký tự).
    * `sources` (Evidence sources - `tag-selector`, 100% width).
    * `confidence` (Độ tin cậy - `input`, 50% width).
    * `dataBacked` (Dữ liệu thực chứng minh - `checkbox`, 50% width).
* **5. Constraints (`constraintsJson`)**:
  * `D1_GROUNDING`: `type: sourcePattern`, pattern `^(team\.|precedents#)`, mức độ `error`. Bắt buộc tên nhân sự phải xuất phát từ dữ liệu SAP hoặc case tiền lệ được trích dẫn.
  * `D1_DATA_BACKED`: `type: dataBackedWhenInputPresent`, mức độ `warning`. Nếu cả dữ liệu SAP lẫn case tiền lệ đều không có nhân sự, cờ `dataBacked` bắt buộc phải chuyển sang `false`.

#### 3. Thay đổi trong Output khi thực thi

* **Khi có tiền lệ**: AI đề xuất danh sách nhân sự rõ ràng: *"Đề xuất Kỹ sư Nguyễn Văn A (QC Leader) và Kỹ sư Trần B (CNC Specialist) từ case tiền lệ #8D-10048992 do cùng vận hành máy CNC Milling Line 7"*.
* **Bảo vệ Human-in-the-loop**: Kết quả đề xuất lưu tại `team.roster`, người dùng duyệt và chốt danh sách thực tế tại `team.assignedRoster` (lưu vết qua action `saveTeamRoster`).

---

### 📝 D2: Describe the Problem (Mô tả Sự cố & Phân tích 5W2H / Is-IsNot)

#### 1. Mục đích nghiệp vụ & Trách nhiệm AI

* **Mục đích**: Mô tả sự cố một cách định lượng, chính xác, không suy đoán cảm tính. Xác định ranh giới sự cố qua bảng phân tích **5W2H** (What, Where, When, Who, Why, How, How many) và so sánh **Is / Is-Not**.
* **AI Copilot**:
  * Trích xuất các số liệu đo lường thực tế so với giới hạn tiêu chuẩn (Measured vs Spec).
  * Định lượng phạm vi ảnh hưởng (Extent of affected batches/units).
  * Phân định rõ: Cái gì BỊ LỖI (Is) và Cái gì KHÔNG BỊ LỖI dù ở cùng điều kiện (Is-Not).

#### 2. Chi tiết 5 Tab Cấu Hình D2

* **1. Object Schema**:
  * *Trọng số chính*: `defectCode` (+4 điểm, `exact`), `material` (+3 điểm, `exact`), `semantic` (Cosine $\ge 0.70$).
  * *Nguyên do*: Cần tìm đúng các case mô tả cùng hiện tượng hư hỏng và cùng mã sản phẩm.
* **2. Data Schema (`inputSchemaJson`)**:
  * `header`: Thông tin thông báo sự cố SAP (`notificationId`, `origin`, `foundDate`).
  * `product`: Thông tin sản phẩm, mã vật tư, số lô (`batchId`).
  * `defect`: Mã lỗi và diễn giải mô tả hiện trường (`defectCode`, `defectText`).
  * `inspections`: Mảng kết quả đo lường (Thông số, giá trị thực đo, giá trị tiêu chuẩn).
  * `isIsNot`: Dữ liệu phân tích Is/Is-Not.
  * `derivedFacts`: Các số liệu định lượng suy ra từ AI Enrichment.
* **3. Prompt Guide (`combinedPrompt`)**:
  ```text
  Describe the problem with verified 5W2H facts.
  Quantify measured-versus-specification differences when values exist.
  Use Is/Is-Not boundaries and cite every factual statement.
  Do not invent missing measurements or locations.
  ```
* **4. Form Editor (`formSchemaJson`)**:
  * Group `problem`:
    * `summary` (Problem summary - `textarea`, 100% width).
    * `content` (5W2H and Is/Is-Not analysis - `textarea`, 100% width, min 50 ký tự).
    * `sources` (`tag-selector`, 100% width).
    * `confidence` (`input`, 50% width) & `dataBacked` (`checkbox`, 50% width).
* **5. Constraints (`constraintsJson`)**:
  * `D2_CITATIONS`: `type: citationRequired`, mức độ `error`. Mọi thông số đo lường (ví dụ `0.26mm > max 0.10mm`) bắt buộc phải có nguồn trích dẫn từ bảng `inspections`.
  * `D2_SOURCES`: `type: sourcePattern`, pattern `^(header|product|defect|inspections|isIsNot|derivedFacts)`.

#### 3. Thay đổi trong Output khi thực thi

* AI sinh ra đoạn văn mô tả chuẩn ISO/IATF 16949: nêu rõ kích thước bavia đo được, vị trí phát hiện, số lượng lô bị chặn, và bảng so sánh ranh giới Is/Is-Not chi tiết.

---

### 🛡️ D3: Interim Containment Actions (Hành động Khoanh vùng Tạm thời)

#### 1. Mục đích nghiệp vụ & Trách nhiệm AI

* **Mục đích**: Đưa ra các biện pháp khẩn cấp (trong vòng 24h) để cô lập sự cố, bảo vệ khách hàng và chặn không cho sản phẩm lỗi tiếp tục lọt ra thị trường.
* **AI Copilot**:
  * Rà soát các hành động tạm thời đã được ghi nhận trong SAP QM.
  * Nếu chưa có hành động nào được ghi nhận $\rightarrow$ tự động trích xuất các hành động khoanh vùng hiệu quả nhất từ các case tiền lệ (`precedents#N`) để đề xuất (ví dụ: Dừng chuyền, phong tỏa tồn kho 100%, bổ sung kiểm tra Sorting 100%).

#### 2. Chi tiết 5 Tab Cấu Hình D3

* **1. Object Schema**:
  * *Trọng số chính*: `defectCode` (+4, `exact`), `keyword` (+2, trùng từ khóa mô tả), `workCenter` (+3).
* **2. Data Schema (`inputSchemaJson`)**:
  * `actions`: Các hành động tức thời đang có trong SAP QM (`actions.containment`).
  * `customer`: Tác động tới khách hàng & hàng đang trên đường vận chuyển.
  * `precedents`: Các hành động khoanh vùng thành công trong quá khứ.
* **3. Prompt Guide (`combinedPrompt`)**:
  ```text
  List immediate containment actions with owner and status when recorded.
  Explain how each action protects the customer or process.
  If no current action exists, present precedent actions only as proposals and cite precedents#N.
  Clearly distinguish recorded actions from recommendations.
  ```
* **4. Form Editor (`formSchemaJson`)**:
  * Group `containment`: `summary`, `content`, `actionItems` (`multiSelect` - danh sách hành động đề xuất), `sources`, `confidence`, `dataBacked`.
* **5. Constraints (`constraintsJson`)**:
  * `D3_SOURCES`: `type: sourcePattern`, pattern `^(actions\.containment|customer|precedents#)`. Phân biệt rõ giữa hành động *đã thực tế triển khai* và hành động *mới chỉ đề xuất từ tiền lệ*.

#### 3. Thay đổi trong Output khi thực thi

* Tạo danh sách checklist các hành động cách ly tức thì kèm người phụ trách, thời hạn và đánh giá rủi ro tồn dư (Residual exposure).

---

### 🔬 D4: Root Cause Analysis (Phân tích Nguyên nhân Gốc)

#### 1. Mục đích nghiệp vụ & Trách nhiệm AI ⭐ (Bước Quan Trọng Nhất)

* **Mục đích**: Tìm ra nguyên nhân cốt lõi gây ra lỗi (Occurrence Root Cause) và nguyên nhân hệ thống không phát hiện được lỗi (Escape/Detection Root Cause) bằng chuỗi **5-Why** và biểu đồ xương cá **Ishikawa 6M** (Man, Machine, Material, Method, Measurement, Milieu).
* **AI Copilot**:
  * Thực hiện **Chẩn đoán Mù (Blind Diagnosis)**: AI tự phân tích facts thô mà không nhìn thấy kết luận có sẵn để đảm bảo tính khách quan.
  * So sánh đối chiếu chuỗi 5-Why với kết quả Chẩn đoán mù để xác nhận tính logic.
  * Chỉ định danh mục Ishikawa được xác nhận và lý giải vì sao loại trừ 5 danh mục còn lại.

#### 2. Chi tiết 5 Tab Cấu Hình D4

* **1. Object Schema**:
  * *Trọng số chính*: `semantic` (Cosine Vector Similarity $\ge 0.72$, trọng số cao nhất), `defectCode` (+3), `ishikawaCategory` (+3).
  * *Nguyên do*: Hai lỗi khác nhau về mã nhưng có thể chung một cơ chế vật lý/hóa học hỏng hóc $\rightarrow$ Tìm kiếm ngữ nghĩa (Semantic) là yếu tố quyết định.
* **2. Data Schema (`inputSchemaJson`)**:
  * `fiveWhy`: Chuỗi 5 câu hỏi Tại sao.
  * `ishikawa`: Danh sách các yếu tố Ishikawa 6M đã điều tra.
  * `rootCause`: Nguyên nhân gốc ghi nhận trên hệ thống.
  * `independent`: Kết quả Chẩn đoán độc lập (Blind Diagnosis từ AI Enrichment).
  * `precedents`: Nguyên nhân gốc từ các case tương đồng trong quá khứ.
* **3. Prompt Guide (`combinedPrompt`)**:
  ```text
  Walk the recorded 5-Why chain and evaluate Ishikawa 6M evidence.
  State the confirmed root cause only when supported by evidence.
  Include an Independent verification section that reports agreement or disagreement with the blind diagnosis.
  Treat precedent root causes as hypotheses, never as facts for this case.
  ```
* **4. Form Editor (`formSchemaJson`)**:
  * Group `root-cause`: `summary`, `content` (5-Why, Ishikawa & Independent verification, max 2500 ký tự), `sources`, `confidence`, `dataBacked`.
* **5. Constraints (`constraintsJson`)**:
  * `D4_DISCLOSURE`: `type: requiredDisclosure`, pattern `independent verification`, mức độ `error`. Bắt buộc D4 phải có mục đối chiếu xác nhận đồng thuận hay bất đồng thuận với kết quả chẩn đoán mù độc lập.
  * `D4_SOURCES`: `type: sourcePattern`, pattern `^(fiveWhy|ishikawa|rootCause|independent|precedents#)`.

#### 3. Thay đổi trong Output khi thực thi

* Trình bày chuỗi 5-Why mạch lạc từng nấc, chứng minh nguyên nhân gốc bằng số liệu thực tế, chỉ rõ yếu tố Ishikawa kích hoạt và minh bạch hóa mức độ tin cậy thông qua phần kiểm chứng độc lập.

---

### 🔧 D5: Permanent Corrective Actions (Hành động Khắc phục Vĩnh viễn)

#### 1. Mục đích & Vai trò AI

* **Mục đích**: Đưa ra các giải pháp triệt để nhằm loại bỏ hoàn toàn nguyên nhân gốc đã xác định ở D4.
* **AI Copilot**: Ánh xạ từng hành động khắc phục trực tiếp vào từng mắt xích của chuỗi 5-Why; cảnh báo nếu có mắt xích nguyên nhân nào chưa có biện pháp xử lý che chắn.

#### 2. Cấu hình & Tác động Output

* **Data Schema**: Đọc mảng `actions` (`x-source: sap_qm`) và kết quả nguyên nhân từ D4.
* **Prompt Guide**: Yêu cầu AI chỉ rõ hành động nào khắc phục nguyên nhân phát sinh (Occurrence) và hành động nào khắc phục nguyên nhân thoát lỗi (Escape).
* **Output**: Bảng danh mục hành động khắc phục dài hạn kèm đánh giá khả năng loại trừ nguyên nhân gốc.

---

### 📈 D6: Verify Effectiveness (Xác minh & Đánh giá Hiệu quả)

#### 1. Mục đích & Vai trò AI

* **Mục đích**: Thiết lập kế hoạch đo lường và theo dõi thực tế để chứng minh các hành động ở D5 đã thực sự giải quyết được vấn đề và không gây ra tác dụng phụ.
* **AI Copilot**: Xây dựng kế hoạch xác minh định lượng (Metrics, cỡ mẫu kiểm tra Sample Size, thời gian theo dõi Run-at-rate, tiêu chí chấp nhận Acceptance Criteria).

#### 2. Cấu hình & Tác động Output

* **Data Schema**: Đọc các thông số kỹ thuật tiêu chuẩn từ `inspections`.
* **Prompt Guide**: Soạn thảo ma trận kiểm tra thực nghiệm (Statistical Process Control / Cpk / Ppk).
* **Output**: Bản kế hoạch kiểm định hiệu quả chi tiết (Ai đo, đo bao nhiêu mẫu, đo trong bao lâu và ai ký duyệt nghiệm thu).

---

### 🔄 D7: Prevent Recurrence (Hành động Phòng ngừa Tái diễn & Cập nhật FMEA)

#### 1. Mục đích & Vai trò AI

* **Mục đích**: Chuẩn hóa quy trình, cập nhật tài liệu kỹ thuật, cập nhật hồ sơ FMEA (Failure Mode and Effects Analysis), Control Plan và chia sẻ bài học kinh nghiệm cho các dây chuyền/sản phẩm tương tự.
* **AI Copilot**: Trích xuất các tài liệu cần cập nhật (SOP, Work Instructions, FMEA RPN score) và đề xuất cập nhật hệ thống quản trị chất lượng.

#### 2. Cấu hình & Tác động Output

* **Data Schema**: Liên kết FMEA (`fmea`, `x-source: sap_qm`).
* **Prompt Guide**: Đề xuất cải tiến hệ thống ở mức quản trị (Systemic prevention) chứ không chỉ dừng lại ở thao tác công nhân.
* **Output**: Danh sách mã tài liệu SOP/FMEA cần sửa đổi và đề xuất hành động phòng ngừa trên diện rộng.

---

### 🏆 D8: Closure and Team Recognition (Tổng kết & Tuyên dương Đội ngũ)

#### 1. Mục đích & Vai trò AI

* **Mục đích**: Đánh giá điều kiện đóng sự cố (Closure Gate), tổng kết bài học kinh nghiệm (Lessons Learned) và ghi nhận đóng góp của từng thành viên trong đội ngũ 8D.
* **AI Copilot**: Tổng kết toàn bộ tiến trình D1–D7, nêu rõ bài học thành công/thất bại và soạn thảo nội dung tuyên dương đích danh các cá nhân tham gia.

#### 2. Cấu hình & Tác động Output

* **Data Schema**: Đọc `lessonsLearned` và danh sách thành viên `teamMembers`.
* **Prompt Guide**: Rà soát các tiêu chí nghiệm thu trước khi đóng case và viết thư cảm ơn/tuyên dương chuyên nghiệp.
* **Output**: Biên bản nghiệm thu đóng case 8D hoàn chỉnh và bản tóm tắt bài học kinh nghiệm lưu vào cơ sở tri thức công ty.

---

## 🚀 PHẦN 4: PHÂN HỆ `CREATE DEFECT` & LUỒNG KÍCH HOẠT QUY TRÌNH 8D

Trang [`Create Defect`](file:///d:/GitHub/8d-copilot/app/cnma_proresolve_ui/src/pages/create-defect/index.tsx) cung cấp trải nghiệm khởi tạo sự cố hoàn chỉnh:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                GIAO DIỆN TẠO SỰ CỐ (CREATE DEFECT)                               │
├────────────────────────────────┬─────────────────────────────────────────────────────────────────┤
│ [1-Click Presets]              │ [Biểu mẫu Nhập liệu Nghiệp vụ (Visual Form)]                     │
│ ✦ Q3 Internal - Flange Burr    │  ├── 1. Thông tin Thông báo (Notification ID, Origin, Status)   │
│ ✦ Q1 Customer - Coolant Leak   │  ├── 2. Mô tả Sự cố (Symptom Text, Defect Code, Defect Text)    │
│ ✦ Q3 Internal - Weld Porosity  │  ├── 3. Vật tư & Dây chuyền (Material, Batch, Work Center)      │
│                                │  ├── 4. Kết quả Đo lường Kiểm tra (Characteristic, Meas, Spec)  │
│                                │  └── 5. Khách hàng & SLA (Complaint Ref, Contact, Due Date)     │
└────────────────────────────────┴─────────────────────────────────────────────────────────────────┘
                                                 │
                                                 ▼ (Nhấn "Start 8D Analysis")
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ BACKEND AI PIPELINE (EightDService.analyzeFromJson)                                              │
│  1. validateDataset   ──> Chặn sớm dữ liệu lỗi schema                                            │
│  2. mapCase           ──> Chuẩn hóa facts thành CaseContext                                      │
│  3. enrichContext     ──> AI Enrichment & Tính toán số liệu đo                                   │
│  4. diagnoseIndep...  ──> AI Blind Diagnosis (Chẩn đoán độc lập khách quan)                     │
│  5. findPrecedents    ──> Chấm điểm tìm 3 case tiền lệ theo Object Schema từng D                 │
│  6. generateReport    ──> Sinh toàn bộ nội dung D1-D8 theo Prompt Guide & Data Schema            │
│  7. postProcess       ──> Kiểm tra các luật trong Constraints (Citations, Evidence grounding)   │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 8D REPORT DETAIL VIEW: Hiển thị kết quả trực quan theo đúng Form Editor Layout đã cấu hình       │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 TỔNG KẾT

Việc hợp nhất **Object Schema vào từng bước D**, chuẩn hóa **Pipeline 5 Tab**, và bổ sung **Create Defect Form** đã tạo nên một chu trình khép kín hoàn chỉnh:

* **Người quản trị (Admin/Lead Engineer)**: Dễ dàng cấu hình và kiểm chứng độ chính xác của AI ở từng bước D một cách trực quan.
* **Người dùng tác nghiệp (Quality Engineers)**: Chỉ cần nhập thông tin sự cố qua Form thân thiện, hệ thống AI sẽ tự động phân tích đa tầng, đối chiếu tiền lệ lịch sử và sinh ra bản Báo cáo 8D đạt chuẩn chất lượng quốc tế chỉ trong vòng 30 giây.
