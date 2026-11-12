# Kế hoạch thực hiện AI4Biz — UIT_4Lovpe

**Cập nhật:** 10/11/2026 · **Cuộc thi:** AI4Biz 2026 · **Tổ chức:** LIKELION Vietnam<br>
**Nguồn quy định:** [Official AI4Biz challenge](https://app.notion.com/p/likelion/AI-FOR-BUSINESS-INNOVATION-3f744860a4f480ab920ddb3911a25c21)<br>
**Lịch và hồ sơ:** [Kế hoạch AI4Biz](../docs/HACKATHON-ACTION-PLAN.md)

## Mục tiêu và trạng thái

Đây là kế hoạch chuẩn bị bài thi trên nền 8D Copilot hiện có. Các mục dưới đây là việc cần kiểm chứng hoặc chuẩn bị, không phải tuyên bố đã triển khai hay đã có kết quả pilot.

## Backlog ưu tiên

| Mức | Hạng mục | Điều kiện hoàn thành |
|---|---|---|
| P0 | Business problem và người dùng | Nêu rõ QE của nhà cung cấp linh kiện, công việc chậm, hệ quả và nguồn bằng chứng |
| P0 | Demo một ca xuyên suốt | Dữ liệu nhập, tiền lệ, bản nháp, nguồn, người duyệt và audit đều quan sát được |
| P0 | Demo thiếu bằng chứng | Hệ thống dừng hoặc hỏi người phù hợp; không bịa tiền lệ hay kết luận nguyên nhân |
| P0 | Baseline và phép đo | Cùng đầu vào và yêu cầu đầu ra; tách thời gian AI, thời gian thao tác và thời gian sửa/duyệt |
| P0 | PDF tiếng Anh | Tối đa 15 slide, đúng tên đội/thành viên, vấn đề và giá trị kinh doanh rõ |
| P0 | Video và nộp bài | Video ≤2 phút; thư mục `AI4Biz_UIT_4Lovpe_2026`; nộp trước 23:59 13/11/2026 |
| P1 | Kiểm tra retrieval | Hiển thị engine thực tế và nguồn; đánh giá trường hợp có/không có tiền lệ; kiểm tra fallback |
| P1 | Kiểm tra AI Referee và stops | Phân biệt phản biện AI với luật dừng; lưu bằng chứng và quyết định người duyệt |
| P1 | Khả thi triển khai | Nêu dữ liệu cần có, tích hợp dự kiến, chi phí có giả định và giới hạn của MVP |
| P1 | Diễn tập chung kết | Ít nhất 3 thành viên nói tiếng Anh; pitch ≤15 phút; Q&A 5 phút |
| P2 | Pilot sau cuộc thi | Thu thập ca và phản hồi được phép dùng, đo thời gian/độ đầy đủ/công sửa trước khi mở rộng |

## Trình tự kiểm tra

1. Chốt dữ liệu demo được phép dùng và cấu hình SQLite/PostgreSQL, provider/model, retrieval engine.
2. Thử một ca đầy đủ và một ca thiếu bằng chứng trên MVP, lưu đầu vào và kết quả thực tế.
3. Chạy harness theo [runbook](../docs/SPRINT1-VERIFY-RUNBOOK.md); đánh giá AI drafting riêng vì harness không gọi LLM.
4. Kiểm tra người duyệt, điểm dừng, nguồn tiền lệ và audit; không dùng số điểm của cuộc thi cũ.
5. Đo tác vụ và công sửa, đưa kết quả có phạm vi vào PDF; số liệu chưa đo phải ghi là giả thuyết.
6. Kiểm tra tài sản xuất cuối: PDF, video, tên thành viên và quyền truy cập. Sửa Markdown không tự cập nhật HTML/PDF/DOCX.

## Tài liệu kỹ thuật và lịch sử

- [GraphAI](GraphAI.md), [Stage 2](GraphAI_Stage2.md), [Implementation summary](GraphAI_Implementation_Summary.md): giữ thiết kế và trạng thái từng tài liệu; kế hoạch không đồng nghĩa tính năng đã chạy.
- [Bản chất AI và DB](BAN_CHAT_LOGIC_AI_VA_DB.md): tài liệu giải thích nội bộ.
- [Kế hoạch Sprint 2 cũ](../docs/archive/SPRINT2-PLAN-2026-10.md): giữ backlog chi tiết và quyết định giai đoạn trước; các mốc tháng 9–10, rubric và định dạng nộp ở đó không áp dụng cho AI4Biz.
