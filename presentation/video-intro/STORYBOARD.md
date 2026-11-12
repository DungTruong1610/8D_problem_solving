# 8D Copilot: storyboard video intro

> **AI4Biz submission status:** This is preparation/reference material, not a confirmed final submission. Slides and presentation must be in English; PDF ≤15 slides, demo video ≤2 minutes, final pitch ≤15 minutes plus 5-minute Q&A, with at least 3 presenting members. Any longer Vietnamese script is a rehearsal reference and must be adapted before submission.

> **Competition context:** [AI4Biz 2026 — LIKELION Vietnam](https://app.notion.com/p/likelion/AI-FOR-BUSINESS-INNOVATION-3f744860a4f480ab920ddb3911a25c21), team UIT_4Lovpe. Competition requirements and submission limits are maintained in that reference; technical examples below are not measured business outcomes unless explicitly documented.

> **Tài sản dựng video cục bộ:** Các đường dẫn `images/` bên dưới trỏ tới ảnh và tọa độ trong workspace. Chúng không được đưa lên GitHub trong commit chỉ gồm Markdown này. Dựng video cần bộ tài sản gốc và kiểm tra lại tổng thời lượng ≤2 phút.

17 cảnh chính và 1 cảnh tuỳ chọn, đi theo đúng thứ tự người dùng gặp trong app. Mỗi cảnh gồm:

- **Ảnh sạch**: ảnh nền để dựng video (1920×1080, chụp từ app thật).
- **Ảnh đánh số**: cùng ảnh đó, có khung đỏ và số tròn ở các box cần nói.
- **Chữ trên video**: tiêu đề cảnh và một câu phụ đề ngắn.
- **Bảng box**: mỗi số trong ảnh nối với một câu chú thích ngắn hiện cạnh box, và lời dẫn nếu có thuyết minh.

Toạ độ chính xác (pixel, ảnh 1920×1080) của từng box nằm trong `images/boxes.json` — `images/boxes.json`. Dùng file này để đặt khung highlight trong phần mềm dựng (Premiere, CapCut, After Effects) cho khớp từng điểm ảnh.

Từ cảnh 9 trở đi, mọi ảnh là cùng một case **8D-10048788**: vết rung trên trục rotor sau khi mài, 88 sản phẩm hỏng, cụm mài tròn số 4. Case này đã xong D1–D6 theo đúng thứ tự và đang làm D7.

## Mục lục

| # | Cảnh | Màn hình | Thời lượng gợi ý |
|---|---|---|---|
| 1 | Danh sách 8D | 8D Reports | 6 s |
| 2 | Tạo 8D từ lỗi đã ghi nhận | 8D Reports → Create 8D Report | 6 s |
| 3 | Nhập case bằng JSON | Create 8D Report → JSON | 6 s |
| 4 | Lịch sử kiểm tra | Master Data → Inspection History | 6 s |
| 5 | Mở 8D là một quyết định | Master Data → Defect Records | 6 s |
| 6 | Thư viện case đã đóng | Master Data → Closed Case Library | 5 s |
| 7 | AI vào cuộc ở đâu | AI Configuration | 6 s |
| 8 | Bộ máy tìm tiền lệ | AI Configuration | 6 s |
| 9 | AI biết dừng | Case → AI Stops | 7 s |
| 10 | Nhật ký kiểm toán | Case → Audit Log | 7 s |
| 11 | Tám bước, đúng thứ tự | Case → 8D Disciplines | 6 s |
| 12 | Người bấm, bước mới đi | Case → D7 | 6 s |
| 13 | Bản nháp của AI | Case → D5 | 6 s |
| 14 | D4: tìm nguyên nhân gốc | Case → D4 | 8 s |
| 15 | AI Referee, ý kiến thứ hai | Case → D4 → AI Referee | 8 s |
| 16 | Mỗi con số có nguồn | Case → Evidence | 6 s |
| 17 | Học từ case cũ, nhưng không đoán | Case → Evidence → Precedents | 6 s |
| 18 | Tổng quan case | Case → Case Overview | 5 s (tuỳ chọn) |

Tổng khoảng 1 phút 50 giây. Cảnh 18 là tuỳ chọn, cắt được nếu cần dưới 1 phút 45.

---

## Phần 1. Mở và tạo 8D

### Cảnh 1. Danh sách 8D

| Ảnh sạch | Ảnh đánh số |
|---|---|
| Ảnh cục bộ — `images/01-worklist.jpg` | Ảnh cục bộ — `images/01-worklist-marked.jpg` |

**Tiêu đề:** Mọi case 8D, case gấp nhất nằm trên cùng
**Phụ đề:** Xếp theo mức nghiêm trọng, cam kết với khách hàng, rồi tuổi case.

| Box | Chú thích trên video | Lời dẫn |
|---|---|---|
| 1 | Case gấp nhất | Case khiếu nại của khách hàng đã quá hạn 18 ngày, nên nằm đầu danh sách. |
| 2 | Lọc theo việc của bạn | Case của tôi, quá hạn, nghiêm trọng, chờ duyệt… Con số trên mỗi chip là số case. |
| 3 | Tiến độ x/8 bước | Đếm số bước đã có người duyệt, không phải số bước AI đã viết. |
| 4 | Bắt đầu một 8D mới | Mở hộp thoại tạo 8D. |

### Cảnh 2. Tạo 8D từ lỗi đã ghi nhận

| Ảnh sạch | Ảnh đánh số |
|---|---|
| Ảnh cục bộ — `images/02-create-pick.jpg` | Ảnh cục bộ — `images/02-create-pick-marked.jpg` |

**Tiêu đề:** Mỗi 8D bắt đầu từ một lỗi có thật
**Phụ đề:** Chọn lỗi đã ghi nhận. Mỗi lỗi chỉ được mở một 8D.

| Box | Chú thích trên video | Lời dẫn |
|---|---|---|
| 1 | Q1 khách hàng · Q2 nhà cung cấp · Q3 nội bộ | Lọc theo nguồn gốc lỗi. |
| 2 | Chỉ lỗi chưa có 8D | Lỗi đã có 8D không xuất hiện ở đây. |
| 3 | AI phân tích khoảng 3 phút | Bấm Create & Analyze là AI bóc tách dữ kiện và soạn D1–D8 ở nền. |

### Cảnh 3. Nhập case bằng JSON

| Ảnh sạch | Ảnh đánh số |
|---|---|
| Ảnh cục bộ — `images/03-create-json.jpg` | Ảnh cục bộ — `images/03-create-json-marked.jpg` |

**Tiêu đề:** Case từ hệ thống khác? Nhập JSON
**Phụ đề:** Tải file, chọn case mẫu, hoặc dán trực tiếp.

| Box | Chú thích trên video | Lời dẫn |
|---|---|---|
| 1 | Tải file .json | Trình duyệt kiểm tra trước, server kiểm tra lại. |
| 2 | Case mẫu một chạm | Chỉ có triệu chứng và bối cảnh: chưa có nguyên nhân, hành động hay đội. |
| 3 | Hoặc dán JSON | Case nhập theo đường này được ghi rõ "Imported as JSON". |

---

## Phần 2. Dữ liệu gốc

### Cảnh 4. Lịch sử kiểm tra

| Ảnh sạch | Ảnh đánh số |
|---|---|
| Ảnh cục bộ — `images/04-inspection-history.jpg` | Ảnh cục bộ — `images/04-inspection-history-marked.jpg` |

**Tiêu đề:** AI không đoán. AI đọc số đo.
**Phụ đề:** Bốn bộ dữ liệu, theo đúng chuỗi nghiệp vụ.

| Box | Chú thích trên video | Lời dẫn |
|---|---|---|
| 1 | Kiểm tra → Lỗi → Case đã đóng → Danh mục | Thứ tự các tab là thứ tự của chuỗi nghiệp vụ. |
| 2 | Mỗi dòng: một đặc tính, một lô, Đạt / Lỗi | Nền của phân tích Is / Is-Not ở D2: so lô hỏng với lô đạt. |
| 3 | Thêm tay hoặc nhập JSON | Nhập hàng loạt kết quả kiểm tra. |

### Cảnh 5. Mở 8D là một quyết định

| Ảnh sạch | Ảnh đánh số |
|---|---|
| Ảnh cục bộ — `images/05-defect-records.jpg` | Ảnh cục bộ — `images/05-defect-records-marked.jpg` |

**Tiêu đề:** Ghi nhận lỗi ≠ mở 8D
**Phụ đề:** Phần lớn lỗi được đóng ngay. Mở 8D là quyết định có chủ đích.

| Box | Chú thích trên video | Lời dẫn |
|---|---|---|
| 1 | Ghi nhận lỗi mới | Mã lỗi, vật tư, lô, máy đều chọn từ danh mục chuẩn. |
| 2 | Start 8D | Tạo 8D cho lỗi này và bắt đầu phân tích. |
| 3 | Open 8D | Lỗi đã có 8D thì nút đổi thành mở 8D đó. Mỗi lỗi tối đa một 8D. |

### Cảnh 6. Thư viện case đã đóng

| Ảnh sạch | Ảnh đánh số |
|---|---|
| Ảnh cục bộ — `images/06-closed-case-library.jpg` | Ảnh cục bộ — `images/06-closed-case-library-marked.jpg` |

**Tiêu đề:** Bộ nhớ của hệ thống
**Phụ đề:** Case đóng xong trở thành tiền lệ cho lần sau.

| Box | Chú thích trên video | Lời dẫn |
|---|---|---|
| 1 | Chỉ case đã hoàn tất | Case đang mở chưa có bài học đã được chứng minh, nên không nằm ở đây. |
| 2 | Nhập case cũ hàng loạt | Đưa kinh nghiệm từ hệ thống khác vào thư viện. |

---

## Phần 3. AI được cấu hình thế nào

### Cảnh 7. AI vào cuộc ở đâu

| Ảnh sạch | Ảnh đánh số |
|---|---|
| Ảnh cục bộ — `images/07-ai-chain.jpg` | Ảnh cục bộ — `images/07-ai-chain-marked.jpg` |

**Tiêu đề:** AI chỉ vào cuộc ở hai chỗ
**Phụ đề:** Còn lại là dữ liệu và quyết định của con người.

| Box | Chú thích trên video | Lời dẫn |
|---|---|---|
| 1 | Con người: kiểm tra, ghi lỗi, mở 8D | Không có AI ở ba bước đầu. |
| 2 | AI: tìm tiền lệ, soạn D1–D8 | Hai bước được tô đỏ là chỗ duy nhất AI làm việc. |
| 3 | Con người: duyệt và đóng | Case đóng xong quay lại làm tiền lệ. |

### Cảnh 8. Bộ máy tìm tiền lệ

| Ảnh sạch | Ảnh đánh số |
|---|---|
| Ảnh cục bộ — `images/08-retrieval-engine.jpg` | Ảnh cục bộ — `images/08-retrieval-engine-marked.jpg` |

**Tiêu đề:** Tìm case cũ qua mối nối thật
**Phụ đề:** Knowledge Graph: cùng vật tư, cùng máy, cùng mã lỗi.

| Box | Chú thích trên video | Lời dẫn |
|---|---|---|
| 1 | Knowledge Graph (mặc định) | Đi theo các mối nối đã xác minh, nên mọi đường bằng chứng kiểm chứng được. |
| 2 | Vector Search (dự phòng) | Cách cũ: so độ giống văn bản bằng embedding. |
| 3 | Tự chuyển khi Graph không có | Chạy được cả trên môi trường không có SAP HANA. |

---

## Phần 4. Làm việc trên một case

### Cảnh 9. AI biết dừng

| Ảnh sạch | Ảnh đánh số |
|---|---|
| Ảnh cục bộ — `images/09-ai-stops.jpg` | Ảnh cục bộ — `images/09-ai-stops-marked.jpg` |

**Tiêu đề:** Không chắc thì dừng, hỏi đúng người
**Phụ đề:** AI không vượt quyền con người.

| Box | Chú thích trên video | Lời dẫn |
|---|---|---|
| 1 | Vượt thẩm quyền | Đổi một tài liệu có kiểm soát (SOP) là việc AI không được tự làm. Lần dừng này chặn duyệt D7. |
| 2 | Câu hỏi cho chủ quy trình | Ai duyệt thay đổi này, và ở phiên bản nào? |
| 3 | Resolve | Người có quyền trả lời. Câu trả lời đi vào nhật ký kiểm toán. |

### Cảnh 10. Nhật ký kiểm toán

| Ảnh sạch | Ảnh đánh số |
|---|---|
| Ảnh cục bộ — `images/10-audit-log.jpg` | Ảnh cục bộ — `images/10-audit-log-marked.jpg` |

**Tiêu đề:** Mọi quyết định đều để lại dấu vết
**Phụ đề:** Ai, lúc nào, trên dữ liệu nào, vì sao.

| Box | Chú thích trên video | Lời dẫn |
|---|---|---|
| 1 | Ai làm, lúc nào | Approved D4, bởi admin, 14/10/2026 15:33. |
| 2 | Dữ liệu tại thời điểm duyệt | Nguyên nhân gốc, số đo, tiền lệ: đúng những gì người duyệt đã thấy. |
| 3 | Trước / sau | Draft → Approved, InProgress → Completed. |
| 4 | Lượt AI nào đã soạn | Truy được bản nháp đến từ mô hình nào, lúc nào. |

### Cảnh 11. Tám bước, đúng thứ tự

| Ảnh sạch | Ảnh đánh số |
|---|---|
| Ảnh cục bộ — `images/11-eight-disciplines.jpg` | Ảnh cục bộ — `images/11-eight-disciplines-marked.jpg` |

**Tiêu đề:** Tám bước, mở khoá theo thứ tự
**Phụ đề:** Bước trước xong, bước sau mới được bắt đầu.

| Box | Chú thích trên video | Lời dẫn |
|---|---|---|
| 1 | 6/8 bước hoàn tất | Thanh tiến độ của cả case. |
| 2 | D1–D6: đã duyệt | Từ lập đội, mô tả, khoanh vùng, tìm gốc, khắc phục đến triển khai. |
| 3 | D7: đang làm | Bước duy nhất đang mở để sửa. |
| 4 | D8: chưa bắt đầu | Chờ D7 xong. |

### Cảnh 12. Người bấm, bước mới đi

| Ảnh sạch | Ảnh đánh số |
|---|---|
| Ảnh cục bộ — `images/12-next-action.jpg` | Ảnh cục bộ — `images/12-next-action-marked.jpg` |

**Tiêu đề:** Không bước nào tự chạy
**Phụ đề:** Một nút luôn cho biết việc tiếp theo.

| Box | Chú thích trên video | Lời dẫn |
|---|---|---|
| 1 | Đang làm, được sửa | Mỗi bước bắt đầu ở chế độ chỉ đọc. Người bấm "Start the process" thì mới sửa được. |
| 2 | Approve | Mờ cho tới khi đủ điều kiện. Bấm sớm thì hệ thống liệt kê đúng những gì còn thiếu. |
| 3 | D7 trên thanh tám bước | Trạng thái trên thanh tiến độ khớp với nút. |

### Cảnh 13. Bản nháp của AI

| Ảnh sạch | Ảnh đánh số |
|---|---|
| Ảnh cục bộ — `images/13-ai-draft.jpg` | Ảnh cục bộ — `images/13-ai-draft-marked.jpg` |

**Tiêu đề:** AI soạn sẵn. Người chấp nhận.
**Phụ đề:** D5, hành động khắc phục, từ chính nguyên nhân gốc ở D4.

| Box | Chú thích trên video | Lời dẫn |
|---|---|---|
| 1 | AI đề xuất hành động | Mỗi đề xuất ghi rõ vai trò cần làm. Người bấm Accept thì mới thành việc. |
| 2 | Việc đã giao | Mỗi việc gắn với nguyên nhân gốc (Machine) và có trạng thái riêng. |

### Cảnh 14. D4: tìm nguyên nhân gốc

| Ảnh sạch | Ảnh đánh số |
|---|---|
| Ảnh cục bộ — `images/14-d4-root-cause.jpg` | Ảnh cục bộ — `images/14-d4-root-cause-marked.jpg` |

**Tiêu đề:** D4: tìm nguyên nhân gốc
**Phụ đề:** Loại trừ từng nhóm bằng số liệu, không bằng cảm tính.

| Box | Chú thích trên video | Lời dẫn |
|---|---|---|
| 1 | Xương cá 6M | Người, Máy, Phương pháp, Vật liệu, Đo lường, Môi trường. Năm nhóm bị loại kèm lý do. |
| 2 | Máy = nguyên nhân gốc | 100% lỗi nằm ở cụm đá mài WHEEL1. Cụm WHEEL2 đạt 100%. |
| 3 | 5-Why kết thúc ở gốc | Đá mài WHEEL1 mất cân bằng động, đảo trục khi gá. |
| 4 | AI Referee | Mở ý kiến thứ hai, độc lập. |

### Cảnh 15. AI Referee, ý kiến thứ hai

| Ảnh sạch | Ảnh đánh số |
|---|---|
| Ảnh cục bộ — `images/15-ai-referee.jpg` | Ảnh cục bộ — `images/15-ai-referee-marked.jpg` |

**Tiêu đề:** Ý kiến thứ hai, độc lập
**Phụ đề:** AI tự kết luận khi bị giấu đáp án của kỹ sư.

| Box | Chú thích trên video | Lời dẫn |
|---|---|---|
| 1 | Giả thuyết độc lập · 90% | AI không được xem chuỗi 5-Why và nguyên nhân kỹ sư đã ghi. |
| 2 | So với kết luận đã ghi | Lệch nhau thì hệ thống cảnh báo để kỹ sư xem lại. |
| 3 | Kết luận của AI: Máy | Cụm đá mài WHEEL1 mất cân bằng, gây rung khi mài. |
| 4 | Không quyết định thay ai | Ghi rõ: kiểm lại với bản ghi gốc. |

### Cảnh 16. Mỗi con số có nguồn

| Ảnh sạch | Ảnh đánh số |
|---|---|
| Ảnh cục bộ — `images/16-evidence.jpg` | Ảnh cục bộ — `images/16-evidence-marked.jpg` |

**Tiêu đề:** Mỗi con số đều có nguồn
**Phụ đề:** 17 trên 17 bản ghi AI trích dẫn đều mở được.

| Box | Chú thích trên video | Lời dẫn |
|---|---|---|
| 1 | Ba loại nguồn | Dữ kiện thật · bên ngoài / giả định · AI suy luận. |
| 2 | Không có dữ liệu thì gắn cờ | Bước nào chỉ là đề xuất thì ghi "Suggested by AI". |
| 3 | Số đo thật từ hệ thống QM | Độ nhám Ra 2,8 µm, giới hạn 0,8 µm. |

### Cảnh 17. Học từ case cũ, nhưng không đoán

| Ảnh sạch | Ảnh đánh số |
|---|---|
| Ảnh cục bộ — `images/17-precedents.jpg` | Ảnh cục bộ — `images/17-precedents-marked.jpg` |

**Tiêu đề:** Không đủ giống thì không đưa tiền lệ
**Phụ đề:** Thà nói "không có" còn hơn đưa một tiền lệ yếu.

| Box | Chú thích trên video | Lời dẫn |
|---|---|---|
| 1 | Bộ máy đã chạy | Luôn ghi rõ bộ máy nào đã tìm tiền lệ cho case này. |
| 2 | 22 case đã xét, không case nào đạt 3/16 điểm | Hệ thống nói thẳng là không có. |

### Cảnh 18. Tổng quan case (tuỳ chọn)

| Ảnh sạch | Ảnh đánh số |
|---|---|
| Ảnh cục bộ — `images/18-case-overview.jpg` | Ảnh cục bộ — `images/18-case-overview-marked.jpg` |

**Tiêu đề:** Cả case trong một trang
**Phụ đề:** Dữ kiện, cam kết và bản tóm tắt.

| Box | Chú thích trên video | Lời dẫn |
|---|---|---|
| 1 | Dữ kiện case | Nguồn gốc, vật tư, lô, mã lỗi, máy, số lượng. |
| 2 | Hai cam kết sửa được | Hạn hoàn tất và người điều phối. Lỗi nội bộ không có SLA nên hệ thống không tự đặt hạn. |
| 3 | Tóm tắt nội bộ do AI viết | Case khiếu nại có thêm một bản an toàn để gửi khách hàng. |

---

## Ghi chú khi dựng

- **Màu khung:** đỏ `#C00000` cho khung và số tròn, giống màu chủ đạo của app.
- **Nhịp:** nên hiện từng box theo đúng số thứ tự (1 → 2 → 3), mỗi box khoảng 1,5–2 giây, chú thích hiện cạnh box rồi mờ dần.
- **Ảnh sạch:** dùng làm nền cho hiệu ứng zoom vào box. Toạ độ trong `images/boxes.json` là pixel trên ảnh 1920×1080.
- **Dữ liệu trong ảnh:** lấy từ cơ sở dữ liệu demo local. Cảnh 10 cố ý lọc riêng bước D4, vì một số dòng nhật ký khác còn ghi chú thử nghiệm.
