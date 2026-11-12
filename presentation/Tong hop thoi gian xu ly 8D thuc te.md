# Tổng hợp thời gian xử lý 8D thực tế

> **AI4Biz submission status:** This is preparation/reference material, not a confirmed final submission. Slides and presentation must be in English; PDF ≤15 slides, demo video ≤2 minutes, final pitch ≤15 minutes plus 5-minute Q&A, with at least 3 presenting members. Any longer Vietnamese script is a rehearsal reference and must be adapted before submission.

> **Competition context:** [AI4Biz 2026 — LIKELION Vietnam](https://app.notion.com/p/likelion/AI-FOR-BUSINESS-INNOVATION-3f744860a4f480ab920ddb3911a25c21), team UIT_4Lovpe. Competition requirements and submission limits are maintained in that reference; technical examples below are not measured business outcomes unless explicitly documented.

*Ngày tổng hợp: 15/10/2026.*

**Tài liệu gộp từ hai báo cáo:**
- [8D cycle time by industry.md](<8D Process Cycle Time Research.md>), do Claude soạn;
- "8D Process Cycle Time Research.md", file tải về.

**Cách làm:** mọi con số về thời gian đều đã được mở lại nguồn gốc để kiểm tra. Số nào không kiểm tra được thì chuyển sang mục 5, không dùng trong kết luận.

**Trọng tâm:** một quy trình 8D/CAPA **thực tế** mất bao lâu, theo dữ liệu công bố công khai bên ngoài doanh nghiệp.

---

## 0. Câu trả lời ngắn

- **Không có con số trung bình đo được cho riêng 8D** trên quy mô toàn ngành, ở bất kỳ ngành nào.
- **Có một bộ dữ liệu đo thật trên nhiều công ty**, nhưng là của CAPA trong ngành thiết bị y tế: MDIC 2023, 19 cơ sở của 8 tập đoàn (Medtronic, Abbott, Stryker, Edwards, Baxter, Alcon, Illumina, Celonova).
  - Ở trạng thái ban đầu, một CAPA mất **trung bình 379 ngày** từ lúc khởi tạo đến khi đóng.
  - **65,6% số CAPA đã đóng mất hơn 180 ngày.**
  - Luồng nhanh mất khoảng 64 ngày, nhưng đây là số đo trong 2 năm thí điểm và chỉ tính CAPA đã đóng.
- **Với 8D trong ô tô/chế tạo, chỉ có vài ca đơn lẻ được công bố kèm ngày tháng cụ thể:**
  - khoảng **126 ngày** từ lúc bắt đầu xử lý đến lúc đánh giá xong hiệu lực (Indonesia, 2020);
  - một báo cáo 8D mất **71 ngày** so với hạn 60 ngày (Bồ Đào Nha, ví dụ do tác giả nêu);
  - hạn hành động khắc phục được **lên kế hoạch** khoảng 3–4 tuần sau khiếu nại; bài không công bố ngày đóng (Fisker, 2023).
- **Hạn định của khách hàng ngắn hơn nhiều:**
  - ngăn chặn (D3) trong 24 giờ đến 3 ngày (riêng bán dẫn: 5 ngày làm việc sau phân tích lỗi ban đầu);
  - nguyên nhân gốc và hành động khắc phục (D4–D5) trong 5 ngày làm việc đến 30 ngày (bán dẫn khoảng 36 ngày làm việc vì phải chờ phân tích lỗi);
  - đóng hồ sơ (D8) trong 13–20 ngày làm việc, hoặc 30–90 ngày.
- **Thực tế thường vượt hạn:**
  - Tại một nhà máy ô tô ở Bồ Đào Nha, 80% số lần kiểm tra mốc hạn bị trễ.
  - Trong một thư cảnh báo, FDA ghi nhận cuộc điều tra một khiếu nại vẫn chưa xong sau khoảng 7 tháng.

### Phân loại dùng trong tài liệu
| Nhãn | Ý nghĩa |
|---|---|
| **MEASURED** | Đo từ hồ sơ thực của doanh nghiệp, hiệp hội hoặc cơ quan quản lý |
| **KPHĐ** | Khắc phục – phòng ngừa, tức hành động khắc phục (CA/CAPA) |
| **DEADLINE** | Hạn định đọc trực tiếp trong tài liệu gốc của tổ chức ban hành. *(thứ cấp)* = chỉ đọc qua nguồn trích dẫn lại |
| **ESTIMATE** | Ước tính hoặc dự phóng |
| **VENDOR CLAIM** | Tuyên bố tiếp thị, không có dữ liệu kiểm chứng |

> Báo cáo gốc tải về có kèm trích dẫn nguyên văn. Bản tổng hợp này thay trích dẫn bằng **vị trí chính xác trong nguồn** (trang, mục, bảng) và diễn giải, để người đọc tự đối chiếu.

---

## 1. THỜI GIAN XỬ LÝ THỰC TẾ ĐÃ ĐO ĐƯỢC (MEASURED) — trọng tâm

### 1.1 Bảng tổng hợp

| # | Ngành / bối cảnh | Kết quả đo được | Bước 8D/CAPA | Năm, cỡ mẫu | Vị trí trong nguồn | Nguồn |
|---|---|---|---|---|---|---|
| M1 | **Thiết bị y tế, nhiều công ty** (MDIC; dữ liệu từ 19 cơ sở của 8 tập đoàn; FDA tham gia nhóm công tác) | **Ban đầu: tổng chu kỳ trung bình 379 ngày** = khởi tạo 43 ngày + triển khai **221 ngày** + đóng/kiểm tra hiệu lực **131 ngày** | Toàn vòng đời CAPA (≈ D0–D8) | 2022–23; n = 673 CAPA | Hình 7, trang 18. Lời văn: triển khai mất hơn 220 ngày, đóng mất hơn 1 năm | [MDIC Make CAPA Cool v16](https://mdic.org/wp-content/uploads/2023/05/2022-MDIC-Make-CAPA-Cool-Whitepaper_v16.pdf) |
| M2 | như trên | **Phân bố thời gian của CAPA đã đóng, trạng thái ban đầu (n = 302):** ≤30 ngày: 28 (9,3%); 31–60: 12; 61–90: 17; 91–120: 16; 121–150: 14; 151–180: 17; **>180 ngày: 198 (65,6%)**. Suy ra 90,7% / 86,8% / 81,1% số CAPA đóng sau hơn 30 / 60 / 90 ngày | như trên | n = 302 | Hình 6, trang 18 | như trên |
| M3 | như trên, **thí điểm luồng nhanh** (fast-track, rủi ro thấp) | **Khoảng 64 ngày** (≈ 2 tháng); triển khai **47 ngày** (dưới 50 ngày) | Toàn vòng đời | n = 711 | Hình 7 và lời văn trang 18 (triển khai dưới 50 ngày, đóng chỉ mất 2 tháng) | như trên |
| M4 | như trên, **thí điểm CAPA bên ngoài** (rủi ro cao/phải báo cáo) | **270 ngày**; khởi tạo 13, triển khai 167, đóng 100 (cùng thứ tự cột với dòng ban đầu, khớp lời văn của MDIC) | Toàn vòng đời | n = 187 | Hình 7, trang 18 | như trên |
| M5 | như trên, toàn bộ thí điểm (n = 553) | ≤30 ngày: 217 (39,2%); **>180 ngày: 21 (3,8%)**. MDIC viết **khoảng 60% đóng trong 60 ngày**. Cơ sở lớn (>1.000 nhân sự) khoảng 60% đóng trong 60 ngày; cơ sở vừa (100–1.000) chỉ khoảng 15% | Toàn vòng đời | n = 553; cơ sở lớn n = 431, vừa n = 67. **Chỉ tính CAPA đã đóng trong 2 năm thí điểm**, nên thời gian có xu hướng bị đánh giá thấp | Hình 6 và Hình 9, trang 18–19 | như trên |
| M6 | như trên | **Tỷ lệ CAPA lặp lại: 16% (ban đầu) → 0,4% (thí điểm)** | Tái diễn sau khi đóng | — | Trang 19–20 | như trên |
| M7 | **Ô tô, Bồ Đào Nha** (hệ thống đa phương tiện xe hơi) | **151/189 lần kiểm tra mốc hạn bị trễ (80%)**. Tác giả nêu ví dụ một báo cáo 8D mất **71 ngày** so với hạn 60 ngày | D1, D2–D3, D4–D5, D1–D8 | Nghiên cứu 2009; 189 lần kiểm tra mốc (không nêu số báo cáo) | POMS 2010, mục 3.2 (trang 10) | [Riesenberger & Sousa, POMS](https://pomsmeetings.org/confpapers/015/015-0345.pdf) |
| M8 | như trên | Năm 2008 có 984 khiếu nại, trong đó **543 là khiếu nại lặp lại (55%)**. Sau khi đưa 8D lên SAP (nhắc hạn tự động, ký số), mẫu kiểm tra sau đó **không còn lần trễ nào** | Tái diễn; tuân thủ hạn | 984 khiếu nại | Mục 3.1 và 3.5 | như trên, và [IAENG WCE 2010](https://www.iaeng.org/publication/WCE2010/WCE2010_pp2225-2230.pdf) |
| M9 | **Ô tô, Romania** (sơn tĩnh điện thanh nóc xe, 229 chi tiết lỗi) | Ngày in trong bài: sản xuất 18/09/19 → phát hiện 30/09/2019 → xong phân tích nguyên nhân 20/10 → các hạng mục D8 ngày 04/11/2019. **Không dùng làm số đo:** bài được nhận 20/06/2019 và chấp nhận 15/08/2019, *trước* các ngày của ca này; kế hoạch hành động lại ghi tuần W46–W49. Ngày tháng chỉ mang tính minh họa | D1–D8, một ca | 2019; 1 ca (dữ liệu không nhất quán) | Bảng 2, 5, 6, 8, 9 | [Banica & Belu 2019, Univ. Pitesti](https://automotive.upit.ro/2019/2019_5_.pdf) |
| M10 | **Ô tô, Indonesia** (dây đai an toàn, dây chuyền SB3) | Bắt đầu 27/03/2020, đánh giá đến cuối 07/2020: **khoảng 4 tháng (~126 ngày)** để lỗi giảm từ 60 về 0 chiếc/tháng | D1–D8 kèm theo dõi hiệu lực | 2020; 1 ca | Phần phương pháp, trang 2–3 | [Rusman & Hetharia 2025, Operations Excellence 17(1)](https://publikasi.mercubuana.ac.id/index.php/oe/article/view/20205) |
| M11 | **Ô tô** (khóa dây đai, khách hàng Fisker) | Khiếu nại 16/05/2023 → nhà máy nhận mẫu lỗi 24/05 (**8 ngày**) → hạn hành động khắc phục **tuần 23–24/2023 (≈ 3–4 tuần sau khiếu nại)**. Bài **không nêu ngày đóng** | D1–D6 | 2023; 1 ca | Mục D2 và D5–D6 (trang 10–22) | [Processes 13(10):3121, 2025](https://www.mdpi.com/2227-9717/13/10/3121) |
| M12 | **Ô tô** (thí điểm AI/IoT) | Bước D1 và D3 rút từ vài giờ xuống **dưới 1 phút**. Không có thời gian toàn chu kỳ | Chỉ D1, D3 | 2025; 1 ca | Mục mô tả D1/D3 | [Oancea et al., Appl. Sci. 15(20):11262](https://www.mdpi.com/2076-3417/15/20/11262) |
| M13 | **Thiết bị y tế, Mỹ** (thư cảnh báo FDA, Envoy Medical) | Khiếu nại nhận 25/11/2024. Đến khi kết thúc thanh tra 02/07/2025, điều tra **vẫn chưa xong sau khoảng 7 tháng (~219 ngày)** | D1–D4 | 2025; 1 hồ sơ | Thư CMS #718762, ngày 11/11/2025 | [FDA – Envoy Medical](https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/envoy-medical-inc-718762-11112025) |
| M14 | **Dược phẩm**, một cơ sở đa quốc gia bị EMA thanh tra | Chỉ **65% CAPA đóng trong 30 ngày**; tăng lên 92% đúng hạn sau 6 tháng | Đóng CAPA | Không nêu n (thứ cấp) | Clinplex, dẫn lại Quality Executive Partners | [Clinplex](https://clinplex.com/resources/deviation-investigation-cost-capa-closure-benchmarks) |

### 1.2 Đọc bảng trên thế nào
- **Bộ dữ liệu lớn duy nhất là CAPA thiết bị y tế (MDIC).** Một CAPA ở đây thường bao gồm thẩm định lại quy trình hoặc thiết kế, nên dài hơn 8D của ngành ô tô nhiều.
  - 379 ngày là **mức trước cải tiến** của các công ty tham gia.
  - Luồng nhanh cho vấn đề rủi ro thấp chỉ mất khoảng 64 ngày.
- **Số liệu thí điểm của MDIC** (M3–M6) chỉ tính các CAPA đã đóng trong 2 năm thí điểm. Hồ sơ còn mở lúc kết thúc thí điểm không được tính, nên thời gian 64 ngày, tỷ lệ 3,8% quá 180 ngày và tỷ lệ lặp lại 0,4% có thể thấp hơn thực tế dài hạn.
- **Các ca 8D ô tô có ngày tháng dùng được** (M7, M10, M11) cho thấy 8D thực tế kéo dài **từ vài tuần đến khoảng 4 tháng**. Ca M9 không dùng được vì ngày tháng không nhất quán. Vài ca là quá ít để coi là trung bình ngành.
- Rusman & Hetharia dẫn lại Sharma et al. (2020): dự án 8D thường kéo dài tới khoảng 3 tháng. Đây là nguồn **thứ cấp**, không phải số đo.

---

## 2. HẠN ĐỊNH CỦA KHÁCH HÀNG VÀ TIÊU CHUẨN (DEADLINE)

### 2.1 Đã đọc trực tiếp trong tài liệu gốc

| Tổ chức (ngành) | Ngăn chặn D1–D3 | Nguyên nhân / KPHĐ D4–D5(6) | Hoàn tất / đóng D8 | Đơn vị | Nguồn |
|---|---|---|---|---|---|
| **Volkswagen** – Formel Q konkret ấn bản 6, 10/2021 (ô tô; đã có ấn bản 7, 03/2025, nhưng chưa đọc) | Báo cáo 8D chậm nhất ngày làm việc kế tiếp; kết quả phân tích ban đầu trong **3 ngày làm việc** | Cập nhật biện pháp dài hạn tối đa **10 ngày làm việc** | Hoàn tất 8D chậm nhất **20 ngày làm việc**. Nếu trễ mà không thỏa thuận trước, khiếu nại bị đóng sau 4 tuần, nhà cung cấp chịu chi phí | ngày làm việc | Mục 4.4.1.1 [bản PDF](http://www.navistarsupplier.com/Documents/IntegratedSupplierQuality/Formel%20Q%20Konkret.pdf) |
| **Schaeffler** – P 170508 Anlage 3, bản B, 2022-03 (ô tô) | **24 giờ** | D1–D5 trong **5 ngày làm việc** | Sau khi xác minh hiệu lực, không ấn định số ngày. Lỗi nghiêm trọng hoặc lặp lại phải dùng "8D-Report Plus" | giờ / ngày làm việc | [Schaeffler](https://www.schaeffler.de/remotemedien/media/_shared_media_rwd/01_company_1/suppliers_4/quality_1/p170508/p170508_a3_schaeffler_complaint_process_de.pdf) |
| **MAHLE** – quy tắc 1-5-20 (ô tô) | 1 ngày (24 giờ) | 5 ngày làm việc | **20 ngày làm việc** | ngày làm việc | [MAHLE](https://www.mahle.com/media/global/purchasing/supplier-portal/8d-e-learning/manual_8d-process_en-ex.pdf) |
| **KSR International** – Sổ tay nhà cung cấp, 07/2023 (ô tô) | 24 giờ (1 ngày làm việc) | — | Hành động khắc phục: **14 ngày làm việc** | ngày làm việc | [KSR](https://ksrint.com/wp-content/uploads/2023/07/GLB-SD-F-45_Supplier-Handbook.pdf) |
| **Novares** – 2018 (ô tô) | Kế hoạch ngăn chặn trong 24 giờ | Kế hoạch KPHĐ (8D) trong **10 ngày** | — | ngày | [Novares](https://www.novaresteam.com/wp-content/uploads/2018/10/Global_Supplier_Quality_Requirements_Manual.pdf) |
| **Stellantis** – CSR IATF v1, 06/2025 (ô tô) | Bắt buộc 8D qua hệ thống Amadeus/SQP hoặc NCT&GIM | Số ngày cụ thể nằm trong GSQN.001, **không công khai** | — | — | [Stellantis CSR](https://www.iatfglobaloversight.org/wp/wp-content/uploads/2025/06/STELLANTIS-CSR-for-use-with-IATF16949-v1.pdf) |
| **IATF Rules ấn bản 5** – SI 11/2023 (lỗi đánh giá) | Lỗi nặng: khắc phục tạm thời và nguyên nhân gốc trong **20 ngày lịch** | KPHĐ hệ thống và xác minh hiệu lực trong **60 ngày lịch** | Tổ chức chứng nhận quyết định trong tối đa **90 ngày lịch** | ngày lịch | Mục 5.11.1–5.11.3 [IATF SI](https://www.iatfglobaloversight.org/wp/wp-content/uploads/2023/11/IATF-Rules-5th-Edition-Sanctioned-Interpretations-Nov-2023.pdf) |
| **IATF Rules ấn bản 6** (2025) | Lỗi nặng: **15 ngày lịch** | 60 ngày lịch | — | ngày lịch | *(thứ cấp)* [LRQA](https://www.lrqa.com/en-us/latest-news/understanding-iatf-16949-6th-edition/) |
| **AS13000** (động cơ hàng không) | D0 trong **2 ngày** | D5 không quá **30 ngày**, trừ khi có thỏa thuận khác | — | ngày | *(thứ cấp)* [Scrimshire](https://www.linkedin.com/pulse/8-d-problem-solving-process-dr-david-scrimshire) |
| **Barnes Aerospace** – 10/2023 (hàng không, theo AS13000) | Kết quả ngăn chặn trong **24 giờ** | Kế hoạch KPHĐ trong **30 ngày** | — | ngày | [Barnes](https://barnesaero.com/wp-content/uploads/2023/10/Supplier-Quality-Requirements_Lansing.pdf) |
| **Lockheed Martin / Derco** – QA100-102, 02/2021 (quốc phòng) | Báo lỗi ảnh hưởng an toàn bay trong **24 giờ**; lỗi khác trong **5 ngày làm việc** | — | — | giờ / ngày làm việc | [Derco](https://www.lockheedmartin.com/content/dam/lockheed-martin/rms/documents/derco-aerospace/QA100-102SupplierQualityManual-REV-02-24-21.pdf) |
| **Oshkosh** – OSK-P3000 (quốc phòng, xe chuyên dụng) | 24 giờ | D4 trong 15 ngày; D6 trong 30 ngày | D8 trong **45 ngày lịch** | ngày lịch | [Oshkosh](https://osn.oshkoshcorp.com/-/media/OSN/supplier-resources/Training/SQ-Core-Tools/8D-Corrective-Action/8D-Corrective-Action-Procedure.pdf) |
| **Silicon Labs** (bán dẫn) | Ngăn chặn 8D trong **5 ngày làm việc** (sau phân tích lỗi ban đầu, mất 7 ngày làm việc) | Phân tích lỗi cuối cùng **22 ngày làm việc**; nguyên nhân gốc và kế hoạch KPHĐ **14 ngày làm việc** sau đó | Cộng dồn khoảng 36 ngày làm việc trước D6 *(tự cộng)* | ngày làm việc | [Silicon Labs FAQ](https://www.silabs.com/about-us/quality/quality-faq) |
| **Creation Technologies** – 09/2022 (điện tử/EMS) | 3 ngày làm việc | 10 ngày làm việc | Phản hồi SCAR trong **30 ngày lịch** | ngày làm việc / ngày lịch | [Creation](https://www.creationtech.com/wp-content/uploads/2022/09/8D-Supplier-Training-9-22-22.pdf) |
| **Keysight** (thiết bị đo điện tử) | — | Phản hồi SCAR trong **14 ngày** | — | ngày | [Keysight](https://about.keysight.com/en/supplier/KeysightRCCA_Guideline.pdf) |
| **SEW-EURODRIVE** – 2019 (truyền động công nghiệp) | 3 ngày làm việc | — | D4–D8 trong **10 ngày làm việc tiếp theo** (tổng 13 ngày làm việc) | ngày làm việc | [SEW](https://media.sew-eurodrive.com/sew_de/media/nocms_media/lieferantenhandbuecher_1/8d-process-specification.pdf) |
| **BSH** – 2021 (thiết bị gia dụng, theo Bosch Booklet 16) | D3: 2 ngày | D4: 14 ngày; D5: 60 ngày | Phản ứng đầy đủ **90 ngày** theo hợp đồng | ngày | [BSH](https://media3.bsh-group.com/Documents/25319795_Overview_ProblemSolving_with_8D_EN-v1.pdf) |
| **DeLaval** – 07/2026 (thiết bị nông nghiệp) | D3: 1 ngày | D4: 7 ngày; D5–6: 7 ngày | D7: 14 ngày | ngày | [DeLaval](https://www.delaval.com/globalassets/global/suppliers/8d_info-for-suppliers_2026_07.pdf) |

**Ngành y tế và dược:**
- Luật yêu cầu phải có CAPA (21 CFR 820.100, nay chuyển sang QMSR/ISO 13485 §8.5.2; 21 CFR 211.192), nhưng **không quy định hạn đóng** và không bắt buộc dùng mẫu 8D.
- Sau khi nhận Form 483, doanh nghiệp được khuyến nghị phản hồi trong **15 ngày làm việc** ([JMDR 2023](https://uhra.herts.ac.uk/id/eprint/14816/1/JMDRFeb2023-CAPAviolations-edited-v1_1_.pdf)).

### 2.2 Có trong báo cáo tải về nhưng chưa đọc được tài liệu gốc (chỉ tham khảo)
| Tổ chức | Hạn định theo báo cáo tải về | Vì sao chưa xác minh |
|---|---|---|
| Ford (CSR) | 24 giờ D0–D3; 48 giờ báo FCSD; **8D đầy đủ trong 15 ngày lịch** | Nguồn là blog qmslearning.com; CSR gốc chỉ có trên cổng nhà cung cấp |
| GM (GM 1927 / QSB) | 24 giờ D3; 7 ngày D4; 14 ngày D5–D6; mục tiêu đóng 30 ngày, tối đa 40 ngày | Bản trên Scribd, không tải được |
| Continental (QPR) | 24 giờ; D1–D3 trong 2 ngày làm việc | Bản trên Scribd, không tải được |
| Grupo Segura (02/2026) | dưới 24 giờ D3; 3 ngày D5–6; 10 ngày D8 | Máy chủ fsegura.com không kết nối được |
| Safran | S0/D0 trong 2 ngày | Đường dẫn tải trả về trang HTML |
| Xdpigo (cáp điện tử) | Ngăn chặn 48 giờ; xem xét RMA 30 ngày | Trang tiếp thị |

---

## 2.3 Ngành nào bắt buộc 8D (tóm tắt)

| Ngành | Có bắt buộc 8D không | Căn cứ đã xác minh | Quy mô |
|---|---|---|---|
| Ô tô | Phải có quy trình giải quyết vấn đề (IATF 16949 §10.2.3). Mẫu 8D do khách hàng yêu cầu: Stellantis, VW, Schaeffler, MAHLE, KSR, Novares | Mục 2.1 | 104.216 cơ sở IATF (Việt Nam 942) |
| Hàng không (chuỗi cung ứng động cơ) | Có: AS13000 khi khách hàng yêu cầu | AS13000 *(thứ cấp)*, Barnes | Không có số liệu công khai |
| Điện tử / bán dẫn | Theo yêu cầu khách hàng (SCAR, 8D). Báo cáo tải về nêu JESD671 và AEC-Q100 Rev J, **chưa xác minh** | Silicon Labs, Creation, Keysight | Không có số liệu riêng |
| Thiết bị y tế, dược | Phải có CAPA (21 CFR 820.100 / QMSR; 211.192). **Không** bắt buộc mẫu 8D, **không** có hạn đóng | FDA, JMDR | ISO 13485: 43.957 cơ sở |
| Quốc phòng, gia dụng, đường sắt, thiết bị công nghiệp, gia công theo hợp đồng | Theo hợp đồng / yêu cầu khách hàng | Oshkosh, Derco, BSH, SEW, DeLaval | Không có số liệu |

---

## 3. QUY MÔ ÁP DỤNG VÀ DỮ LIỆU KIỂM TOÁN (MEASURED)

| Chỉ số | Giá trị | Nguồn |
|---|---|---|
| Số cơ sở có chứng nhận IATF 16949 (ô tô) | **104.216** cơ sở tính đến 20/12/2025. Trung Quốc 61.537; Ấn Độ 7.718; Hàn Quốc 5.334; Mỹ 3.693; Đức 2.700; **Việt Nam 942** | [IATF Global Oversight, phân bố 2025-11](https://www.iatfglobaloversight.org/wp/wp-content/uploads/2025/12/2025-11_GlobalCertDistribution.pdf) |
| Lỗi nặng phổ biến nhất trong đánh giá IATF (12 tháng lũy kế đến 08/2026) | **10.2.3 Giải quyết vấn đề: 12,10%** (hạng 1); 10.2.1 Sự không phù hợp & hành động khắc phục: 5,60% (hạng 2) | [IATF Top Ten Major NC 2026-08](https://www.iatfglobaloversight.org/wp/wp-content/uploads/2026/09/2026-08_TopTenMajorNC-12MonthMD-EN.pdf) |
| Số chứng chỉ ISO 13485 (thiết bị y tế) | 31.215 chứng chỉ / 43.957 cơ sở (ISO Survey 2024) | [Infographic GlobalSTD](https://www.globalstd.com/wp-content/uploads/2025/10/Infografia-ISO-Survey-2024_EN.pdf) |
| Lỗi CAPA trong quan sát Form 483 của FDA về thiết bị y tế | 820.100 chiếm **13,8% / 13,1% / 12,9%** quan sát (năm tài chính FY2023 / FY2024 / FY2025); luôn đứng hạng 1. Chỉ tính các 483 lập bằng công cụ điện tử | Tự tổng hợp từ [file FDA](https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/inspection-references/inspection-observations) |
| Lỗi điều tra sai lệch trong quan sát Form 483 về dược phẩm | 211.192 chiếm **8,2% / 7,0% / 8,3%**; hạng 2 | như trên |
| Thư cảnh báo FDA liên quan CAPA (thiết bị y tế, 2013–2019) | 355 thư, 407 vi phạm | [Anderson & Tan, JMDR 2023](https://uhra.herts.ac.uk/id/eprint/14816/1/JMDRFeb2023-CAPAviolations-edited-v1_1_.pdf) |

---

## 4. Ba câu hỏi phụ

**(a) Tỷ lệ trễ hạn, mở quá 30 / 60 / 90 ngày**
- **MDIC** (thiết bị y tế, nhiều công ty):
  - Trạng thái ban đầu: **90,7% / 86,8% / 81,1%** số CAPA đã đóng mất hơn 30 / 60 / 90 ngày; **65,6% mất hơn 180 ngày**.
  - Sau thí điểm (chỉ tính CAPA đã đóng): **3,8%** mất hơn 180 ngày; khoảng 60% đóng trong 60 ngày.
- **Ô tô, Bồ Đào Nha:** 80% số lần kiểm tra mốc hạn bị trễ.
- **Dược, một cơ sở:** 35% CAPA không đóng được trong 30 ngày.

**(b) Tỷ lệ tái diễn sau khi đóng**
- **MDIC:** CAPA lặp lại **16% → 0,4%** sau thí điểm.
- **Ô tô, Bồ Đào Nha:** 55% khiếu nại năm 2008 là khiếu nại lặp lại. Đây là lặp lại khiếu nại, không hẳn là tái diễn sau khi đã đóng 8D.
- Ngoài hai nguồn trên, **không có số liệu tái diễn cấp ngành**.

**(c) Thời gian dồn vào đâu**
- **Theo MDIC (số đo thật):**
  - Phần lớn thời gian nằm ở **triển khai hành động khắc phục: 221/379 ngày (58%)** và **đóng/kiểm tra hiệu lực: 131 ngày**.
  - **Khởi tạo** mất 43 ngày, chủ yếu là chờ hội đồng phân loại.
- **Theo ca Bồ Đào Nha:** chậm trễ chủ yếu do chờ đợi và thủ tục:
  - phân tích phòng lab không được theo dõi;
  - 3 chữ ký giấy;
  - không có cảnh báo hạn;
  - dữ liệu nằm ở các hệ thống rời rạc.
- **Theo thí điểm AI** (M12): D1 và D3 có thể rút xuống vài phút. Phần thời gian còn lại nằm ở D4–D7.

---

## 5. Những con số trong báo cáo tải về đã bị SỬA hoặc LOẠI

| Nội dung trong báo cáo tải về | Kết quả kiểm tra | Xử lý |
|---|---|---|
| MDIC: "CAPA bên ngoài 167 ngày; luồng nhanh 270 ngày"; "ban đầu: triển khai 131, đóng 221"; "dự phóng: triển khai 37, đóng 84" | Đọc sai biểu đồ. Lời văn trang 18 của MDIC nói triển khai ban đầu hơn 220 ngày, luồng nhanh triển khai dưới 50 ngày và đóng trong khoảng 2 tháng. Hình 8: dự phóng gồm triển khai 84, đóng 37 | **Đã sửa** (M1, M3, M4). Con số dự phóng 130 ngày giữ ở mức ESTIMATE |
| MDIC thí điểm: "31–60 ngày: 75 CAPA; 61–90: 110" | Biểu đồ không đọc rõ được thứ tự. Đọc theo cách này thì chỉ 52,8% đóng trong 60 ngày, mâu thuẫn với câu "khoảng 60%" của MDIC | Chỉ giữ ≤30 ngày, >180 ngày và câu "khoảng 60%" |
| "8D giảm từ 63 xuống 41 ngày" (gán cho bài ResearchGate 337834285 / Banica & Belu 2019) | Đã đọc toàn văn Banica & Belu 2019: **không có** con số này | **Loại** |
| "Ấn Độ 2026: 63 → 39 ngày, lập nhóm từ 1,8 ngày xuống 38 phút" (ResearchGate 408051737) | ResearchGate chặn truy cập; không tìm thấy bài ở nơi khác | **Chưa xác minh**, không dùng |
| "Ca thanh kim loại sơn: 12 ngày" | Đúng: sản xuất 18/09 → phát hiện 30/09/2019. Nhưng đó là thời gian **phát hiện lỗi**, không phải thời gian 8D | Giữ, ghi rõ phạm vi (M9) |
| "Dây đai an toàn ~120 ngày" | Đúng khoảng: 27/03 đến cuối 07/2020 (~126 ngày) | Giữ (M10) |
| "Noah Medical: CAPA treo ~24 tháng (~726 ngày)" | Thư FDA không nói CAPA 23-005 còn mở; CAPA 24-028 do công ty mở trong thư phản hồi | **Loại** con số 726 ngày |
| "Medline: 3 quý (~270 ngày)" | Lấy từ blog tổng hợp, chưa đọc thư gốc | Không dùng |
| "Formly.ai: trung bình 116 ngày (60–128)" | Trang ghi rõ đây là **danh sách CAPA ví dụ** (Example List), không phải dữ liệu thật | **Loại** |
| "Elevate-CAPA: trung vị 13 tháng" | Chính báo cáo tải về gọi đây là dữ liệu mẫu; máy chủ không truy cập được | **Loại** |
| "IATF: tối đa 90 ngày để đóng lỗi đánh giá" | 90 ngày là hạn để **tổ chức chứng nhận** ra quyết định. Doanh nghiệp phải nộp trong 20/60 ngày (ấn bản 5) hoặc 15/60 ngày (ấn bản 6) | **Đã sửa** |
| "VW: hoàn tất 8D trong 10 ngày làm việc" | 10 ngày làm việc là để cập nhật biện pháp dài hạn. **Hoàn tất 8D: 20 ngày làm việc** (ấn bản 6) | **Đã sửa** |
| "Silicon Labs áp dụng JESD671" | Trang FAQ chỉ nêu thời hạn, không nhắc JESD671 | Bỏ liên hệ này |
| "LNS Research: từ hơn 60 ngày xuống 15–20 ngày" | Thực chất là trang nghiên cứu thị trường dẫn lại Pyraman (nhà cung cấp phần mềm) | Chuyển sang VENDOR CLAIM |
| Báo cáo gốc của tôi: "93.713 cơ sở IATF" | Đã lỗi thời. Số chính thức: 104.216 (20/12/2025) | **Đã sửa** |

---

## 6. Tuyên bố của nhà cung cấp phần mềm (VENDOR CLAIM, không dùng trong kết luận)
- Jodoo: đóng 8D từ 18 xuống 11 ngày.
- iFactory: CAPA nhà máy biogas từ 34 xuống 8 ngày; NCR giấy 40–90 ngày so với số hóa 8–20 ngày.
- Oxmaint: từ 47 xuống 15 ngày.
- eLeap: từ 45 xuống 30 hoặc 18 ngày.
- ERPDrive: phản hồi 8D từ 5 ngày xuống dưới 8 giờ.
- Pyraman (qua Dimension Market Research): từ hơn 60 ngày xuống 15–20 ngày.

Các nguồn ước tính thực hành khác cũng thuộc loại ESTIMATE: Chartered Semi 60–90 ngày; QMS Learning 30–60 ngày; các mẫu 8D trên Scribd.

---

## 7. Kết luận (chỉ dùng số MEASURED và DEADLINE)
1. **Không có con số trung bình đo được cho riêng 8D** ở quy mô ngành. Bộ dữ liệu nhiều công ty duy nhất là CAPA thiết bị y tế (MDIC, 19 cơ sở / 8 tập đoàn): **trung bình 379 ngày**, 65,6% số CAPA đã đóng mất hơn 180 ngày. Trong 2 năm thí điểm, luồng nhanh cho rủi ro thấp đo được khoảng 64 ngày (chỉ tính CAPA đã đóng).
2. **Các ca 8D ô tô có ngày tháng công khai:** khoảng **126 ngày** (Indonesia 2020); một báo cáo **71 ngày** so với hạn 60 ngày (Bồ Đào Nha); hạn hành động khắc phục **lên kế hoạch** khoảng 3–4 tuần sau khiếu nại, không công bố ngày đóng (Fisker 2023).
3. **Hạn định khách hàng đặt ra:**
   - ngăn chặn trong **24 giờ – 3 ngày** (bán dẫn: 5 ngày làm việc sau phân tích lỗi ban đầu);
   - nguyên nhân gốc và hành động khắc phục trong **5 ngày làm việc – 30 ngày** (bán dẫn khoảng 36 ngày làm việc);
   - hoàn tất 8D trong **13–20 ngày làm việc** (SEW, MAHLE, VW) hoặc **30–90 ngày lịch** (AS13000, Barnes, Oshkosh, BSH).
4. **Thực tế thường vượt hạn:**
   - Ô tô, Bồ Đào Nha: 80% số lần kiểm tra mốc hạn bị trễ; 55% khiếu nại là lặp lại.
   - FDA: một cuộc điều tra khiếu nại chưa xong sau khoảng 7 tháng.
   - IATF: "Giải quyết vấn đề" (10.2.3) là lỗi nặng số 1, chiếm 12,10% (08/2026), trên 104.216 cơ sở.
5. **Về Việt Nam:** có 942 cơ sở IATF 16949 (20/12/2025) chịu yêu cầu 8D từ khách hàng. **Chưa có nghiên cứu công khai nào đo thời gian 8D tại Việt Nam**, Trung Quốc hay Đức.

---

## 8. Nguồn (truy cập 15/10/2026)
1. MDIC (2023). *CAPA Process Improvement – #makeCAPAcool Program*, whitepaper v16, 02/05/2023. Thí điểm 2 năm; 19 cơ sở của 8 tập đoàn (Bảng 2, trang 15). https://mdic.org/wp-content/uploads/2023/05/2022-MDIC-Make-CAPA-Cool-Whitepaper_v16.pdf
2. Riesenberger, C. & Sousa, S.D. (2010). POMS 21st Conf. https://pomsmeetings.org/confpapers/015/015-0345.pdf ; WCE 2010 (IAENG). https://www.iaeng.org/publication/WCE2010/WCE2010_pp2225-2230.pdf
3. Banica, C.-F. & Belu, N. (2019). *Application of 8D methodology – an effective problem solving tool in automotive industry.* Scientific Bulletin Univ. Pitesti, Automotive series. https://automotive.upit.ro/2019/2019_5_.pdf
4. Rusman, K. & Hetharia, D. (2025). *Quality improvement through 8D methodology: an automotive industry case study.* Operations Excellence 17(1):1–11. https://publikasi.mercubuana.ac.id/index.php/oe/article/view/20205
5. *Processes* 13(10):3121 (2025), ca khóa dây đai Fisker. https://www.mdpi.com/2227-9717/13/10/3121
6. Oancea, A.-V. et al. (2025). *Applied Sciences* 15(20):11262. https://www.mdpi.com/2076-3417/15/20/11262
7. US FDA, thư cảnh báo Envoy Medical (CMS #718762, 11/11/2025) và Noah Medical (CMS #702414, 09/04/2025). https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/envoy-medical-inc-718762-11112025 ; https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/noah-medical-corporation-702414-04092025
8. US FDA, Inspection Observations FY2023–FY2025. https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/inspection-references/inspection-observations
9. Anderson, R. & Tan, C. (2023). JMDR. https://uhra.herts.ac.uk/id/eprint/14816/1/JMDRFeb2023-CAPAviolations-edited-v1_1_.pdf
10. IATF Global Oversight: phân bố chứng nhận 2025-11; Top Ten Major NC 2026-08; Rules ấn bản 5 SI 11/2023. https://www.iatfglobaloversight.org/wp/wp-content/uploads/2025/12/2025-11_GlobalCertDistribution.pdf ; https://www.iatfglobaloversight.org/wp/wp-content/uploads/2026/09/2026-08_TopTenMajorNC-12MonthMD-EN.pdf ; https://www.iatfglobaloversight.org/wp/wp-content/uploads/2023/11/IATF-Rules-5th-Edition-Sanctioned-Interpretations-Nov-2023.pdf
11. Volkswagen, Formel Q konkret ấn bản 6 (10/2021). http://www.navistarsupplier.com/Documents/IntegratedSupplierQuality/Formel%20Q%20Konkret.pdf
12. Schaeffler, P 170508 Anlage 3 (2022-03). https://www.schaeffler.de/remotemedien/media/_shared_media_rwd/01_company_1/suppliers_4/quality_1/p170508/p170508_a3_schaeffler_complaint_process_de.pdf
13. MAHLE, SQA 8D manual. https://www.mahle.com/media/global/purchasing/supplier-portal/8d-e-learning/manual_8d-process_en-ex.pdf
14. KSR International, Supplier Handbook GLB-SD-F-45 (07/2023). https://ksrint.com/wp-content/uploads/2023/07/GLB-SD-F-45_Supplier-Handbook.pdf
15. Novares, Global Supplier Quality Requirements Manual (2018). https://www.novaresteam.com/wp-content/uploads/2018/10/Global_Supplier_Quality_Requirements_Manual.pdf
16. Stellantis, CSR for IATF 16949 v1 (06/2025). https://www.iatfglobaloversight.org/wp/wp-content/uploads/2025/06/STELLANTIS-CSR-for-use-with-IATF16949-v1.pdf
17. Barnes Aerospace, Supplier Quality Requirements – Lansing (10/2023). https://barnesaero.com/wp-content/uploads/2023/10/Supplier-Quality-Requirements_Lansing.pdf
18. Lockheed Martin / Derco Aerospace, QA100-102 (02/2021). https://www.lockheedmartin.com/content/dam/lockheed-martin/rms/documents/derco-aerospace/QA100-102SupplierQualityManual-REV-02-24-21.pdf
19. Oshkosh, OSK-P3000. https://osn.oshkoshcorp.com/-/media/OSN/supplier-resources/Training/SQ-Core-Tools/8D-Corrective-Action/8D-Corrective-Action-Procedure.pdf
20. Silicon Labs, Quality FAQ. https://www.silabs.com/about-us/quality/quality-faq
21. Creation Technologies (09/2022). https://www.creationtech.com/wp-content/uploads/2022/09/8D-Supplier-Training-9-22-22.pdf ; Keysight RCCA Guideline. https://about.keysight.com/en/supplier/KeysightRCCA_Guideline.pdf
22. SEW-EURODRIVE (2019). https://media.sew-eurodrive.com/sew_de/media/nocms_media/lieferantenhandbuecher_1/8d-process-specification.pdf ; BSH (2021). https://media3.bsh-group.com/Documents/25319795_Overview_ProblemSolving_with_8D_EN-v1.pdf ; DeLaval (07/2026). https://www.delaval.com/globalassets/global/suppliers/8d_info-for-suppliers_2026_07.pdf
23. AS13000 *(thứ cấp)*: https://www.linkedin.com/pulse/8-d-problem-solving-process-dr-david-scrimshire ; IATF ấn bản 6 *(thứ cấp)*: https://www.lrqa.com/en-us/latest-news/understanding-iatf-16949-6th-edition/
24. Clinplex. https://clinplex.com/resources/deviation-investigation-cost-capa-closure-benchmarks ; ISO Survey 2024 (GlobalSTD). https://www.globalstd.com/wp-content/uploads/2025/10/Infografia-ISO-Survey-2024_EN.pdf
25. Formly/Dovetail, danh sách CAPA ví dụ (đã loại). https://docs.withdovetail.com/tasks/list-capa
