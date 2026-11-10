# Kịch bản demo AI4Biz: bản quay ≤2 phút và bản luyện chi tiết

> **AI4Biz submission status:** This is preparation/reference material, not a confirmed final submission. Slides and presentation must be in English; PDF ≤15 slides, demo video ≤2 minutes, final pitch ≤15 minutes plus 5-minute Q&A, with at least 3 presenting members. Any longer Vietnamese script is a rehearsal reference and must be adapted before submission.

> **Competition context:** [AI4Biz 2026 — LIKELION Vietnam](../AI4BIZ.md), team UIT_4Lovpe. Competition requirements and submission limits are maintained in that reference; technical examples below are not measured business outcomes unless explicitly documented.

## Bản quay AI4Biz — tiếng Anh, mục tiêu 1:50

| Thời gian | Màn hình / thao tác | Lời dẫn tiếng Anh |
|---|---|---|
| 0:00–0:15 | Case và số đo | “This is a sample machining defect. The engineer needs to connect the inspection results, previous cases and proposed actions.” |
| 0:15–0:35 | Tiền lệ và nguồn | “The copilot retrieves relevant previous cases. The engineer can inspect the source before using a suggestion.” |
| 0:35–1:00 | Bản nháp D4 | “AI prepares a draft explanation from the available evidence. A draft is not a confirmed root cause.” |
| 1:00–1:20 | AI Stops | “When evidence is missing or conflicting, the workflow asks for human review instead of treating the suggestion as approved.” |
| 1:20–1:40 | Phê duyệt và audit | “The engineer reviews the evidence and records a decision. The audit trail shows who approved or returned the step.” |
| 1:40–1:50 | Tổng kết | “Our goal is to reduce preparation effort while keeping quality decisions accountable. Business savings still require a measured pilot.” |

Chỉ quay chức năng thực sự hoạt động trên phiên demo. Nếu dùng bản ghi có cắt thời gian chờ AI, ghi rõ đã tua/cắt; không dùng video 1:50 làm số đo latency. Kiểm tra file xuất cuối ≤2 phút và không chứa dữ liệu nhạy cảm. Đoạn video nằm trong tổng thời gian pitch ≤15 phút.

## Bản luyện chi tiết trước đây — khoảng 3 phút

Bản tiếng Việt dưới đây giúp người demo hiểu các bước; không dùng nguyên bản làm video nộp AI4Biz.

**Chuẩn bị:** mở sẵn case định demo (case DEF-0489 · WC-MILL-07, vết gờ ở mép bích sau khi phay), rồi bấm **Present Tour** ở thanh bên trái.

- **▶** là bấm **Next** hoặc phím →.
- Tour có 11 bước, mỗi bước khoảng 15 giây.
- Số liệu in đậm lấy từ màn hình của case. Nếu case khác thì đọc theo số trên màn hình.

| Bước | Màn hình | Thời gian |
|---|---|---|
| 1–3 | Case, tiến độ, nút hành động | 0:40 |
| 4 | D1 · Đội | 0:20 |
| 5–7 | D4 · Nguyên nhân gốc | 0:50 |
| 8 | D7 · Bảo trì phòng ngừa | 0:25 |
| 9–11 | AI Stops, nhật ký, chốt | 0:45 |
| | **Tổng** | **≈ 3:00** |

---

## 1 · Case

> Đây là một lỗi trong dữ liệu mẫu: gờ ở mép bích vượt giới hạn sau khi phay. Khi case được mở, AI đã soạn sẵn cả tám bước từ hồ sơ lỗi, số đo kiểm tra và kho case cũ.

▶

## 2 · Tiến độ D1–D8

> Nhưng nhìn cột bên trái: tất cả vẫn là **Not started**, **0/8**. AI soạn xong không có nghĩa là xong. Chỉ bước nào người duyệt mới được tính.

▶

## 3 · Nút hành động

> Mỗi bước chỉ có một nút. Bản nháp khoá cho tới khi kỹ sư bấm **Start the process**, rồi **Approve** để ký. Không bước nào tự chạy.

▶

## 4 · D1 · Đội xử lý

> Ở D1, AI đề xuất đội và nói rõ vì sao: người này **đã làm 5 case tương tự**, lấy từ kho case đã đóng. Kỹ sư bấm nhận từng người.

▶

## 5 · D4 · Ishikawa

> Sang D4, nguyên nhân gốc. Sáu nhánh 6M, nhánh **Machine** được đánh dấu, và nó có số đo đi kèm: dao vát gờ chạy **11.800 chu kỳ**, trong khi giới hạn thay dao là **8.000**. Nhánh nào không có bằng chứng thì để **Not assessed**, không điền cho đủ.

▶

## 6 · 5-Why

> Chuỗi 5 câu "tại sao" đi sâu dần. Ở câu cuối, dữ liệu chưa đủ để chọn giữa ba khả năng, nên AI ghi thẳng: **chưa có bằng chứng**, thay vì đoán một cái.

▶

## 7 · AI Referee

> Và một AI thứ hai làm trọng tài bịt mắt: nó chỉ xem số đo, không xem kết luận của kỹ sư. Nếu hai bên lệch nhau, case dừng ở D4.

▶

## 8 · D7 · Bảo trì phòng ngừa

> Tính năng mới ở D7: từ nguyên nhân gốc đã duyệt, bộ luật (không gọi AI) đề xuất **bảo trì phòng ngừa** cho loại lỗi **DEF-0489 tại WC-MILL-07**. Kỹ sư duyệt thì đề xuất đó thành lịch sử bảo trì của loại lỗi này.

▶

## 9 · AI Stops

> Đây là chỗ AI tự dừng. Ví dụ: số đo ghi bằng chữ **"gemessen 0,32mm"**, AI không tự quyết đó là 0,32 mm, nên dừng ở D4 và hỏi kỹ sư chất lượng. Đổi tài liệu **FMEA** ở D7 vượt thẩm quyền của AI, nên hỏi chủ quy trình. Mỗi lần dừng chặn duyệt bước đó cho tới khi có người trả lời.

▶

## 10 · Audit Log

> Mọi quyết định đều vào nhật ký: ai duyệt, lúc nào, vì sao.

▶

## 11 · Chốt

> Tóm lại: **AI soạn, có nguồn, biết dừng. Con người duyệt.**

▶ Finish.

---

## Nếu có sự cố

- **Một bước bị bỏ qua** (ví dụ case chưa có AI Referee): tour tự sang bước sau, cứ nói tiếp.
- **Tour mở nhầm case:** bấm **Skip tour**, mở đúng case, rồi bấm lại **Present Tour**.
- **Không có AI Stops:** nói "case này AI đi được hết, không cần dừng" rồi bấm tiếp.
