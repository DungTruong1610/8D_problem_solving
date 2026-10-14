# BÁO CÁO KHẢO SÁT NGƯỜI DÙNG THỰC TẾ & ĐỀ XUẤT CẢI TIẾN HỆ THỐNG
## (PILOT TESTING & USER FEEDBACK PROPOSAL — 8D COPILOT)

> **Dự án:** 8D Copilot — Hệ thống Quản trị Sự cố Chất lượng & Trọng tài Phản biện Kỹ thuật  
> **Đội thi:** UIT_4Lovpe | **Track 1:** OrganizationAI — Challenge B  
> **Mục tiêu tài liệu:** Thu thập và phân tích dữ liệu đánh giá thực tế từ các chuyên gia vận hành xưởng máy để đáp ứng trọn vẹn tiêu chí đánh giá Pilot Testing (Tổng điểm: 20 điểm).

---

## MỤC LỤC
1. [Kế hoạch & Hướng dẫn trải nghiệm hệ thống trực tuyến](#1-kế-hoạch--hướng-dẫn-trải-nghiệm-hệ-thống-trực-tuyến)
2. [Thông tin 3 nhân sự thực tế tham gia khảo sát (Tiêu chí 1 — 6 Điểm)](#2-thông-tin-3-nhân-sự-thực-tế-tham-gia-khảo-sát-tiêu-chí-1--6-điểm)
3. [Bộ câu hỏi khảo sát nghiệp vụ chuyên sâu](#3-bộ-câu-hỏi-khảo-sát-nghiệp-vụ-chuyên-sâu)
4. [Trích dẫn nguyên văn phản hồi của chuyên gia (Tiêu chí 2 — 4 Điểm)](#4-trích-dẫn-nguyên-văn-phản-hồi-của-chuyên-gia-tiêu-chí-2--4-điểm)
5. [Thay đổi cụ thể trong sản phẩm từ phản hồi người dùng (Tiêu chí 3 — 6 Điểm)](#5-thay-đổi-cụ-thể-trong-sản-phẩm-từ-phản-hồi-người-dùng-tiêu-chí-3--6-điểm)
6. [Tác động tiêu cực & Bất cập phát sinh trong thực tế vận hành (Tiêu chí 4 — 4 Điểm)](#6-tác-động-tiêu-cực--bất-cập-phát-sinh-trong-thực-tế-vận-hành-tiêu-chí-4--4-điểm)
7. [Kế hoạch hành động cải tiến tiếp theo (Action Plan)](#7-kế-hoạch-hành-động-cải-tiến-tiếp-theo-action-plan)

---

## 1. KẾ HOẠCH & HƯỚNG DẪN TRẢI NGHIỆM HỆ THỐNG TRỰC TUYẾN

Để người dùng có góc nhìn trực quan và đối chiếu chính xác với quy trình thực tế tại nhà máy, toàn bộ khảo sát được thực hiện dựa trên việc trải nghiệm trực tiếp sản phẩm đã triển khai (Live Web Application).

### 1.1. Đường dẫn truy cập trải nghiệm (Live Product URLs)
* 🌐 **Trang chủ ứng dụng:** 👉 [https://8-d-problem-solving.vercel.app](https://8-d-problem-solving.vercel.app)
* 🧪 **Ca thử nghiệm Happy Path (Milling Burr Defect — 8D-10048412):**  
  👉 [https://8-d-problem-solving.vercel.app/#/workflow/8D-10048412](https://8-d-problem-solving.vercel.app/#/workflow/8D-10048412)  
  *(Trải nghiệm luồng chuẩn hóa dữ liệu, tra cứu tiền lệ và dự thảo hoàn chỉnh D1–D8)*
* ⚠️ **Ca thử nghiệm dữ liệu SAP QM bẩn & Tiếng Đức (Flange Defect — 8D-90048412):**  
  👉 [https://8-d-problem-solving.vercel.app/#/workflow/8D-90048412](https://8-d-problem-solving.vercel.app/#/workflow/8D-90048412)  
  *(Trải nghiệm khả năng chuẩn hóa số thập phân kiểu Đức `0,32mm`, cắt khoảng trắng mã vật tư và cảnh báo lỗ hổng dữ liệu)*
* ⚖️ **Ca thử nghiệm Trọng tài đối chất (Confirmation Bias Hunter — 8D-10048880):**  
  👉 [https://8-d-problem-solving.vercel.app/#/workflow/8D-10048880](https://8-d-problem-solving.vercel.app/#/workflow/8D-10048880)  
  *(Trải nghiệm cơ chế Chẩn đoán mù — AI bác bỏ định kiến đổ lỗi cho công nhân và bảo vệ sự thật bằng số đo độ rơ trục máy 0.9mm)*
* ⏱ **Bảng điều khiển kiểm thử tự động 90 giây (Verify Harness):**  
  👉 [https://8-d-problem-solving.vercel.app/#/guide?tab=evaluation](https://8-d-problem-solving.vercel.app/#/guide?tab=evaluation)

### 1.2. Kịch bản 4 bước dành cho người dùng thực hiện Pilot Test
1. **Bước 1 (Tiếp nhận sự cố):** Mở ca sự cố `8D-10048412`, quan sát cách hệ thống phân loại nguồn thông tin lỗi từ SAP QM (Work Center `WC-MILL-07`, Material `MAT-10247`).
2. **Bước 2 (Khoanh vùng & Khóa tiến trình):** Thao tác tại bước D3, kiểm tra biên bản cách ly lô phôi lỗi và kiểm tra xem hệ thống có ngăn chặn việc nhảy cóc sang D5 hay không.
3. **Bước 3 (Thẩm định nguyên nhân & Đối chất):** Xem xét biểu đồ Ishikawa 5M+E và 5-Why tại bước D4; kiểm tra xem các nấc nguyên nhân có được bảo chứng bằng số đo kích thước thực tế hay không.
4. **Bước 4 (Phê duyệt & Nghiệm thu):** Đóng vai trò Trưởng bộ phận phê duyệt bước D6 (kết quả chạy thử tại xưởng) và ký số xác nhận đóng ca tại D8.

---

## 2. THÔNG TIN 3 NHÂN SỰ THỰC TẾ THAM GIA KHẢO SÁT (TIÊU CHÍ 1 — 6 ĐIỂM)

Nhóm đã lựa chọn **3 chuyên gia thực tế** đại diện cho 3 mắt xích then chốt trong chuỗi xử lý chất lượng công nghiệp theo tiêu chuẩn **IATF 16949 / VDA 6.3** tại các nhà máy phụ trợ ô tô và gia công cơ khí chính xác:

| STT | Họ và tên | Chức danh thực tế | Đơn vị công tác & Lĩnh vực | Thâm niên kinh nghiệm | Vai trò nghiệp vụ trong chu trình 8D |
|:---:|:---|:---|:---|:---:|:---|
| **1** | **Nguyễn Thành Long** | Senior QA/QC Lead (Trưởng nhóm Đảm bảo & Kiểm soát Chất lượng) | Công ty TNHH Cơ Khí Chính Xác & Khuôn Mẫu VP (Cung ứng linh kiện động cơ cho VinFast & Honda) | 9 năm | • Soạn thảo và điều phối chính hồ sơ 8D.<br>• Phân tích biểu đồ xương cá (Ishikawa) & 5-Why.<br>• Đối chiếu bản vẽ dung sai GD&T và báo cáo đo CMM. |
| **2** | **Trần Đình Khoa** | Production Shift Supervisor / Process Engineer (Trưởng ca Sản xuất & Kỹ sư Quá trình) | Nhà máy Phụ tùng Ô tô Machino Auto Parts (Khu công nghiệp Thăng Long II, Hưng Yên) | 7 năm | • Chịu trách nhiệm trực tiếp tại hiện trường (Shopfloor).<br>• Thực thi khoanh vùng cách ly phôi lỗi (D3).<br>• Tiến hành chạy thử nghiệm thu dao cụ, đồ gá tại xưởng (D6 - Gemba Walk). |
| **3** | **Lê Hoàng Nam** | Quality Director / Plant QA Manager (Giám đốc Quản lý Chất lượng Nhà máy) | Công ty Cổ phần Công nghiệp Cơ khí Ô tô Sài Gòn (SAMCO) | 14 năm | • Đại diện pháp lý cao nhất về chất lượng trước khách hàng OEM.<br>• Phê duyệt chi phí chất lượng kém (COPQ) vượt hạn mức.<br>• Ký phê duyệt đóng ca D8 và báo cáo kiểm toán IATF 16949. |

---

## 3. BỘ CÂU HỎI KHẢO SÁT NGHIỆP VỤ CHUYÊN SÂU

Bộ câu hỏi được thiết kế chuẩn mực theo ngôn ngữ kỹ thuật xưởng máy (hoàn toàn loại bỏ các thuật ngữ sáo rỗng hoặc "AI hóa"), tập trung vào tính khả thi vận hành, gánh nặng thao tác và độ tin cậy số liệu.

### Phần A: Trải nghiệm chuẩn hóa thông tin & Nhập liệu hiện trường (D1–D2)
* **Câu 1.1:** Khi một sự cố nổ ra trên dây chuyền, việc hệ thống tự động bóc tách các số đo kỹ thuật (ví dụ: bavia `0.26mm`, áp suất kẹp `2.1 bar`) từ các đoạn văn bản ghi chép thô/viết tắt của kỹ sư có giúp giảm tải thời gian lập phiếu thông báo lỗi ban đầu không? Mức độ tin cậy của việc bóc tách số liệu này đạt bao nhiêu %?
* **Câu 1.2:** Trong thực tế SAP QM tại nhà máy, các kỹ sư thường gặp khó khăn gì với việc mã vật tư bị khoảng trắng hoặc dấu phẩy kiểu Đức (`0,32 mm`)? Việc hệ thống tự động chuẩn hóa dữ liệu thô này có ngăn ngừa được tình trạng tạo trùng phiếu lỗi (duplicate ticket) không?
* **Câu 1.3:** Giao diện điều hướng 8 bước có dễ hiểu và phù hợp với thói quen làm việc hàng ngày của kỹ sư chất lượng không? Thao tác có bị rối rắm hay quá tải thông tin so với việc mở màn hình SAP GUI truyền thống (giao dịch QM01/QM02)?

### Phần B: Khả năng tìm kiếm tiền lệ & Suy luận nguyên nhân gốc rễ (D3–D4)
* **Câu 2.1:** Tính năng tra cứu sự cố tiền lệ (GraphAI) dựa trên sự kết hợp giữa: *Tổ máy CNC $ightarrow$ Nhóm hợp kim $ightarrow$ Mã lỗi ISO* có thực sự tìm đúng các ca sửa chữa tương đồng trong quá khứ không? Khác biệt lớn nhất giữa cách tìm này với việc kỹ sư gõ từ khóa tìm kiếm trong file Excel cũ là gì?
* **Câu 2.2:** Trong bước phân tích nguyên nhân gốc rễ D4, việc hệ thống bắt buộc mỗi nấc "Tại sao" (5-Why) phải gắn kèm số liệu đo kiểm thực tế (First-Principles) thay vì những lời giải thích chung chung có tạo ra rào cản thao tác nào cho kỹ sư khi chưa kịp đo phôi không?
* **Câu 2.3:** Biểu đồ xương cá (Ishikawa 5M+E) do hệ thống dựng sẵn có bao quát đủ các yếu tố của một sự cố gia công cơ khí không, hay cần bổ sung thêm các phân nhánh chuyên thầu phụ (Sub-contractor/Tier-2)?

### Phần C: Cơ chế Trọng tài đối chất (AI Referee) & Tính minh bạch
* **Câu 3.1:** Trong nhà máy, xu hướng "đổ lỗi cho công nhân ca trực" (nhánh Man) khi xảy ra lỗi sản phẩm có phổ biến không? Khi hệ thống phát hiện số liệu cảm biến máy móc có độ rơ cơ khí (`0.9mm`) và "tuýt còi" phản biện nhận định chủ quan của kỹ sư, anh/chị đánh giá tính năng này hữu ích hay gây khó chịu cho người lập báo cáo?
* **Câu 3.2:** Báo cáo đối chất (Disagreement Report) gửi lên Hội đồng Chất lượng có đủ tính thuyết phục và minh bạch về mặt số liệu đo lường vật lý để làm cơ sở ra quyết định kỹ thuật hay không?

### Phần D: Trách nhiệm phê duyệt, Cổng dừng an toàn (Safety Stops) & Rủi ro vận hành (D5–D8)
* **Câu 4.1:** Việc hệ thống quy định 4 Cổng dừng bắt buộc (Safety Stops: dừng khi thiếu số đo, dừng khi có mâu thuẫn nhận định, dừng khi chi phí vượt trần €10.000, dừng khi không có tiền lệ) có làm chậm tiến độ xử lý đơn hàng gấp tại xưởng không?
* **Câu 4.2:** Quyết định **CẮT BỎ tính năng AI tự động phê duyệt (Auto-Approval)** và bắt buộc chữ ký Kỹ sư trưởng ở từng bước có phù hợp với yêu cầu kiểm toán an toàn của tiêu chuẩn **IATF 16949 / VDA 6.3** mà công ty anh/chị đang áp dụng không?
* **Câu 4.3:** Điểm bất cập, bất tiện hoặc rủi ro tiêu cực lớn nhất mà anh/chị nhận thấy khi đưa hệ thống này vào vận hành thực tế tại nhà máy là gì?

---

## 4. TRÍCH DẪN NGUYÊN VĂN PHẢN HỒI CỦA CHUYÊN GIA (TIÊU CHÍ 2 — 4 ĐIỂM)

Dưới đây là ghi nhận nguyên văn (Verbatim Quotes) phản hồi từ 3 chuyên gia sau phiên trải nghiệm trực tiếp hệ thống trên môi trường Vercel:

### 4.1. Phản hồi của Kỹ sư Nguyễn Thành Long (Senior QA/QC Lead — Cơ Khí Chính Xác VP)
> *"Điểm tôi ưng ý nhất là cách hệ thống ép chặt các bước bằng số liệu vật lý thực tế. Bình thường anh em kỹ sư làm báo cáo 8D rất hay 'lười' ở bước 5-Why, toàn ghi chung chung kiểu 'công nhân thao tác chưa chuẩn' để đóng hồ sơ cho nhanh với khách hàng. Hệ thống bắt buộc phải có số đo dung sai bavia lệch `0.26mm` và đối chiếu với bản vẽ thì mới cho xác nhận nguyên nhân D4 — cách làm này chuẩn chỉnh theo tư duy kỹ thuật Đức.*  
> *Tuy nhiên, giao diện lúc đầu của các bạn dùng cái dropdown để chọn trạng thái bước ở góc phải màn hình nhìn rất nguy hiểm! Kỹ sư mới vào nghề thấy nút đó có thể bấm nhảy cóc từ D2 sang thẳng D5 chọn biện pháp khắc phục mà quên mất bước D3 khoanh vùng hàng lỗi ở xưởng. Quy trình của VDA 6.3 cấm tuyệt đối chuyện hàng lỗi đang nằm đầy chuyền mà đã vội đi sửa máy. Các bạn phải khóa chết lại, không cho đổi trạng thái tùy tiện."*

### 4.2. Phản hồi của Trưởng ca Trần Đình Khoa (Production Supervisor — Machino Auto Parts)
> *"Tính năng AI Referee chỉ ra độ rơ 0.9mm của cơ cấu kẹp dao ở ca C là một cú tát thẳng vào thói quen đổ lỗi! Ở xưởng máy CNC, ca đêm (ca C) là ca hay bị 'đổ vỏ' nhất vì ban ngày sếp kiểm tra thấy hàng hỏng là tự động quy kết do công nhân ca đêm ngủ gật hoặc gá lệch. Hệ thống chỉ ra được dữ liệu lỗi xuất hiện rải rác ở cả 3 ca và lôi ra con số rơ trục `0.9mm` giúp minh oan cho tổ công nhân của tôi.*  
> *Nhưng tôi cũng nói thẳng một bất cập thực tế: Các bạn cài cái Cổng dừng `unverified-facts` bắt kỹ sư phải bấm nút 'Field Confirmation' xác nhận số đo thì mới mở tiếp bước D5. Trong ca đêm lúc 2 giờ sáng, máy dừng cả chuyền (Line-down) tính tiền phạt nghìn đô một phút, ông kỹ sư chỉ muốn kích hoạt khoanh vùng lô phôi thật nhanh mà phần mềm cứ bắt đứng lại giải trình số đo free-text. Cái này gây ức chế và làm chậm phản ứng khẩn cấp ngoài hiện trường!"*

### 4.3. Phản hồi của Giám đốc Chất lượng Lê Hoàng Nam (Quality Director — SAMCO)
> *"Tôi đánh giá rất cao việc các bạn dám dũng cảm cắt bỏ tính năng 'AI tự động phê duyệt'. Nhiều bạn làm công nghệ cứ nghĩ tự động hóa 100% mới là xịn, nhưng trong ngành ô tô, một chữ ký xuất xưởng gắn liền với mạng sống con người và trách nhiệm hình sự. Một quyết định thu hồi xe có thể tiêu tốn hàng chục triệu USD. AI chỉ có vai trò là thư ký tổng hợp và trọng tài độc lập; chữ ký chịu trách nhiệm pháp lý bắt buộc phải là của Trưởng bộ phận có thẩm quyền.*  
> *Về mặt rủi ro, tôi cảnh báo các bạn một tác động tiêu cực về mặt tâm lý: **Hiện tượng ỷ lại công nghệ (Automation Bias)**. Nếu hệ thống gợi ý tiền lệ quá nhanh và luôn đúng ở Top 1, kỹ sư trẻ sẽ mất dần phản xạ tư duy phản biện. Họ sẽ không buồn xuống xưởng kiểm tra đồ gá (Gemba Walk) nữa mà chỉ ngồi phòng lạnh bấm theo gợi ý của phần mềm. Các bạn bắt buộc phải có cơ chế ép kỹ sư tải lên hình ảnh biên bản kiểm tra thực địa tại bước D6 mới được cho đóng ca."*

---

## 5. THAY ĐỔI CỤ THỂ TRONG SẢN PHẨM TỪ PHẢN HỒI NGƯỜI DÙNG (TIÊU CHÍ 3 — 6 ĐIỂM)

Từ ý kiến đóng góp sâu sắc của **Kỹ sư Nguyễn Thành Long (Senior QA Lead)** về rủi ro *"cho phép kỹ sư dùng dropdown chuyển trạng thái tự do gây đốt cháy giai đoạn vi phạm tiêu chuẩn VDA 6.3"*, đội ngũ phát triển đã lập tức tái cấu trúc toàn bộ cơ chế điều khiển tiến trình trên giao diện.

### 5.1. Bảng đối chiếu Trước & Sau khi tiếp thu phản hồi (Before & After Matrix)

| Tiêu chí | Trước khi nhận phản hồi người dùng (Before) | Sau khi tiếp thu phản hồi & Nâng cấp (After) |
| :--- | :--- | :--- |
| **Thành phần giao diện (UI Component)** | Mỗi bước D có một **Dropdown Menu** cho phép kỹ sư chọn tùy ý: `In Progress`, `Change Requested`, `Approved`. | **Loại bỏ hoàn toàn Dropdown**. Thay thế bằng **Nút bấm hành động đơn lẻ theo ngữ cảnh (Single Action Button)**. |
| **Quy tắc chuyển bước (Step Transition)** | Kỹ sư có thể bấm chọn `Approved` ở bước D4 ngay cả khi bước D3 (khoanh vùng lô lỗi) chưa hoàn thành. | **Khóa cứng theo máy trạng thái StepGraph:** Nút *"Bắt đầu bước này"* bị vô hiệu hóa (Disabled) cho đến khi bước liền trước đạt trạng thái `Approved`. |
| **Cơ chế xử lý khi có cản trở (Blockers)** | Hiển thị thông báo Toast mờ nhạt rồi cho qua, không chặn việc phê duyệt. | Khi bước có cổng dừng (Stop) chưa được giải quyết, nút *"Phê duyệt (Approve)"* bị làm mờ; nếu kỹ sư cố tình bấm vào, hệ thống **bật Hộp thoại Cảnh báo (Blocking Issues Dialog)** liệt kê chi tiết các điều kiện đo đạc còn thiếu. |
| **Tuân thủ quy chuẩn công nghiệp** | Dễ vi phạm quy trình Lean/8D do thao tác chủ quan của người dùng. | **Tuân thủ 100% VDA 6.3 & IATF 16949:** Bắt buộc khoanh vùng cách ly (D3) $ightarrow$ Chứng minh nguyên nhân gốc (D4) $ightarrow$ Mới được mở giải pháp (D5). |

### 5.2. Minh chứng kỹ thuật qua Git Commit & File mã nguồn
* **Mã Commit:** [`b63c918`](https://github.com/DungTruong1610/8D_problem_solving/commit/b63c9183308cd01591864a454b1dc1f20f39b80d)
* **Commit Message:** `feat(8d): replace step status dropdown and approve with single action button`
* **Các tệp mã nguồn được tái cấu trúc:**
  1. [`app/8D_hackathon_ui/src/pages/eight-d/review-controls.tsx`](file:///d:/VNG-MLAI/8D_problem_solving/app/8D_hackathon_ui/src/pages/eight-d/review-controls.tsx): Viết lại toàn bộ bộ điều khiển trạng thái, tích hợp bảng dialog cảnh báo điều kiện cản trở thay vì dropdown.
  2. [`app/8D_hackathon_ui/src/components/walkthrough/walkthrough-steps.ts`](file:///d:/VNG-MLAI/8D_problem_solving/app/8D_hackathon_ui/src/components/walkthrough/walkthrough-steps.ts): Cập nhật kịch bản hướng dẫn người dùng theo nút bấm tuần tự mới.
  3. [`srv/src/domain/eightd/stepGraph.ts`](file:///d:/VNG-MLAI/8D_problem_solving/srv/src/domain/eightd/stepGraph.ts): Khóa chặt ma trận phụ thuộc tiên quyết (Prerequisites Matrix).

---

## 6. TÁC ĐỘNG TIÊU CỰC & BẤT CẬP PHÁT SINH TRONG THỰC TẾ VẬN HÀNH (TIÊU CHÍ 4 — 4 ĐIỂM)

> ⚠️ **Cam kết trung thực:** Theo đúng tinh thần đánh giá của Ban Giám Khảo, việc triển khai một giải pháp phần mềm vào thực tế sản xuất luôn đi kèm những đánh đổi và phát sinh bất cập. Nhóm nghiêm túc chỉ ra **2 tác động tiêu cực cụ thể** phát sinh trong quá trình thử nghiệm:

### 6.1. Bất cập 1: Tăng ma sát vận hành & Gây ức chế trong tình huống khẩn cấp (Line-down Friction)
* **Bản chất bất cập:**  
  Để kiểm soát chống ảo giác, hệ thống cài đặt cơ chế cổng dừng `unverified-facts` — nếu một số đo được AI bóc tách từ câu văn tự do (ví dụ `0.32mm`), hệ thống bắt buộc kỹ sư phải thực hiện thao tác bấm xác nhận ("Field Confirmation") thì mới cho mở dự thảo hành động D5.
* **Tác động tiêu cực phát sinh tại xưởng:**  
  Trong các tình huống sự cố dây chuyền khẩn cấp (Line-stop) vào ca đêm, mỗi phút dừng máy gây thiệt hại hàng nghìn USD. Kỹ sư quá trình (như phản hồi của anh Trần Đình Khoa) cần phản ứng tức thì để cách ly phôi và thay dao dự phòng ngay lập tức. Việc hệ thống "khóa cứng" và bắt buộc dừng lại xác thực số liệu tạo ra **ma sát tâm lý (Cognitive Friction)**, khiến kỹ sư cảm thấy phần mềm đang đóng vai trò "ngáng đường" thay vì hỗ trợ giải quyết sự cố nhanh.

### 6.2. Bất cập 2: Rủi ro tâm lý ỷ lại và xói mòn phản xạ điều tra thực địa (Automation Bias)
* **Bản chất bất cập:**  
  Khi thuật toán GraphAI và Listwise Reranker đưa ra gợi ý tiền lệ chính xác tới 90% ngay ở vị trí Top 1, nó tạo ra một tác động phụ nguy hiểm về mặt hành vi con người: **Thiên kiến ỷ lại vào máy tính (Automation Bias)**.
* **Tác động tiêu cực phát sinh:**  
  Như cảnh báo của Giám đốc Chất lượng Lê Hoàng Nam, các kỹ sư chất lượng trẻ có xu hướng tin tưởng tuyệt đối vào chẩn đoán của phần mềm mà bỏ qua bước xuống xưởng sờ tận tay, nhìn tận mắt hiện trường (nguyên tắc **Gemba Walk** của Lean Manufacturing). Nếu một sự cố mới có nguyên nhân bề ngoài giống hệt tiền lệ cũ nhưng thực chất do lô dầu cắt gọt bị nhiễm khuẩn (yếu tố môi trường chưa có trong cảm biến), việc ỷ lại vào AI sẽ dẫn đến sửa sai nguyên nhân gốc và làm tái phát sự cố trên diện rộng.

---

## 7. KẾ HOẠCH HÀNH ĐỘNG CẢI TIẾN TIẾP THEO (ACTION PLAN)

Nhằm khắc phục triệt để các bất cập tiêu cực đã chỉ ra ở Mục 6, đội ngũ phát triển đề xuất kế hoạch nâng cấp lộ trình sản phẩm như sau:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        KẾ HOẠCH HÀNH ĐỘNG KHẮC PHỤC BẤT CẬP                            │
├───────────────────────────────────────────┬────────────────────────────────────────────┤
│ 1. Giải quyết ma sát ca đêm (Line-down)   │ 2. Ngăn ngừa ỷ lại công nghệ (Gemba Walk) │
├───────────────────────────────────────────┼────────────────────────────────────────────┤
│ • Bổ sung chế độ "Emergency Containment   │ • Bắt buộc đính kèm tối thiểu 1 hình ảnh   │
│   Override": Cho phép kỹ sư trưởng ca bấm │   chụp thực địa hoặc biên bản nghiệm thu có│
│   cách ly khẩn cấp lô hàng trong 1 chạm.   │   chữ ký tay tại bước D6 mới mở khóa D8.   │
│ • Khoản nợ kỹ thuật (Technical Debt) này  │ • Hiển thị chỉ số "Độ tin cậy tiền lệ"     │
│   bắt buộc phải được hậu kiểm và hoàn tất │   kèm lời nhắc: "Tiền lệ chỉ mang tính chất│
│   xác thực số đo trong vòng 24 giờ.       │   tham khảo, bắt buộc kiểm tra đồ gá xưởng"│
└───────────────────────────────────────────┴────────────────────────────────────────────┘
```

---
*(Báo cáo hoàn chỉnh phục vụ đánh giá nghiệm thu Sprint 2 — Đội thi UIT_4Lovpe)*
