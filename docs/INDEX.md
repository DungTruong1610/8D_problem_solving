# Danh mục tài liệu — 8D Copilot / AI4Biz

**Đội:** UIT_4Lovpe · **Cuộc thi:** AI4Biz 2026 · **Tổ chức:** LIKELION Vietnam<br>
**Cập nhật:** 10/11/2026

## Thứ tự tham chiếu

1. [Đề bài chính thức](https://app.notion.com/p/likelion/AI-FOR-BUSINESS-INNOVATION-3f744860a4f480ab920ddb3911a25c21) quyết định thể lệ cuộc thi.
2. [AI4BIZ.md](../AI4BIZ.md) thống nhất tên cuộc thi, đơn vị tổ chức, thành viên, lịch, định dạng và ghi chú rubric.
3. Yêu cầu sản phẩm quy định hành vi cần có; mã nguồn, cấu hình và kiểm tra thực tế xác định hành vi đang chạy. Kế hoạch không phải bằng chứng triển khai.
4. Nhật ký và tài liệu lưu trữ chỉ phản ánh giai đoạn được ghi; không dùng làm kết quả kiểm thử hiện tại.

## Tài liệu hiện hành

| Tài liệu | Vai trò |
|---|---|
| [README](../README.md) | Giới thiệu, liên kết và khởi động |
| [Chạy local](../RUNNING-LOCAL.md) | Cài đặt và vận hành |
| [Kế hoạch AI4Biz](HACKATHON-ACTION-PLAN.md) | Lịch chuẩn bị, hồ sơ và giá trị kinh doanh |
| [Kế hoạch thực hiện](../docs_sprint2/plan.md) | Ưu tiên và điều kiện hoàn thành |
| [User & Judge Guide](USER-AND-JUDGE-GUIDE.md) | Thử MVP và hiểu luồng người dùng |
| [Internal verification runbook](SPRINT1-VERIFY-RUNBOOK.md) | Harness nội bộ; không phải điểm AI4Biz |
| [AI Requirements](<AI Requirements - 8D Copilot POC.md>) | Yêu cầu POC và dữ liệu đầu vào |
| [Nghiệp vụ và hạ tầng AI](TAI_LIEU_NGHIEP_VU_VA_HA_TANG_AI_8D.md) | Bối cảnh nghiệp vụ và kiến trúc |
| [E2E guide](8D-COPILOT-E2E-GUIDE.md) | Luồng nghiệp vụ và kiểm tra đầu cuối |
| [Discipline pipeline](8D-DISCIPLINE-PIPELINE-AND-CREATE-DEFECT-GUIDE.md) | Cấu hình từng bước và tạo lỗi |
| [Testing matrix](8D-TESTING-PLAN-AND-VALIDATION-MATRIX.md) | Kịch bản kiểm chứng |
| [Graph retrieval & rerank](GRAPH-RETRIEVAL-AND-RERANK.vi.md) | Thiết kế retrieval; đối chiếu engine thực tế khi demo |
| [Rerank specification](RERANK-PRECEDENT-RETRIEVAL.md) | Xếp hạng lại tiền lệ D4/D5 |
| [Danh mục phát triển](../docs_sprint2/README.md) | Thiết kế, build log và nghiên cứu kỹ thuật |

## Tài liệu sinh tự động và lịch sử

- [8D step prompts](8d-step-prompts.md) là snapshot sinh từ cấu hình; cập nhật bằng `npm run export:prompts`, không sửa tay để đổi tên cuộc thi.
- [Archive](archive/README.md) lưu các quyết định, kế hoạch và kết quả cũ. Ngày lịch sử được giữ nguyên.
- [Đề bài cuộc thi trước](archive/Challenge_Brief_OrganizationAI_VN.docx.md) chỉ để truy nguyên, không áp dụng cho AI4Biz.
- [Kế hoạch Sprint 2 cũ](archive/SPRINT2-PLAN-2026-10.md) giữ nội dung kỹ thuật chi tiết, không dùng lịch hoặc rubric của nó cho bài nộp mới.
- Tài liệu nghiên cứu và kịch bản trong `presentation/` là tài liệu chuẩn bị. Bản HTML/PDF/DOCX/video phải được xuất và rà riêng trước khi nộp.
- `graphify-out/` là dữ liệu phân tích cục bộ; graph đã tạo trước đợt chuẩn hóa có thể còn nhãn cũ. Dùng Markdown nguồn hiện hành khi hai bên khác nhau.

## Quy ước ghi bằng chứng

Gắn nhãn dữ liệu mẫu, giả thuyết, mục tiêu, kết quả đo hoặc kết quả lịch sử. Tách thời gian soạn nháp khỏi thời gian xử lý/đóng ca. Không ghi một thiết kế, model hoặc tích hợp là đang chạy nếu chưa kiểm tra cấu hình thực tế. Khi thay yêu cầu, ghi ngày và phạm vi; không sửa kết quả kiểm thử cũ thành kết quả mới.
