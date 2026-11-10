# Kế hoạch AI4Biz 2026 — 8D Copilot

**Đội:** UIT_4Lovpe · **Đơn vị tổ chức:** LIKELION Vietnam · **Cập nhật:** 10/11/2026<br>
**Quy định tham chiếu:** [AI4BIZ.md](../AI4BIZ.md)

## Mục tiêu bài thi

Chứng minh 8D Copilot giải quyết một công việc có thật của kỹ sư chất lượng: tìm bằng chứng, tái sử dụng tiền lệ và chuẩn bị bản nháp báo cáo 8D có người duyệt. Lĩnh vực đề xuất là Manufacturing / Operations; AI4Biz không dùng Track OrganizationAI hay Challenge B của cuộc thi trước.

## Ưu tiên trước hạn nộp 13/11

| Ưu tiên | Việc cần làm | Đầu ra kiểm tra được |
|---|---|---|
| P0 | Chốt một phân khúc và người dùng | Nhà cung cấp linh kiện ô tô; QE là người dùng, Quality Manager là người duyệt; phân biệt giả thuyết với phản hồi đã có |
| P0 | Làm rõ vấn đề kinh doanh | Một tình huống xuyên suốt; nguồn cho số liệu; không trộn hạn phản hồi, thời gian soạn nháp và thời gian đóng 8D |
| P0 | Chuẩn bị PDF tiếng Anh, tối đa 15 slide | Có Problem, Users, Insight, Solution, AI, Demo, Feasibility, Business Value, Competitive Advantage |
| P0 | Quay video demo tối đa 2 phút | Một ca có tiền lệ; thấy nguồn đề xuất, điểm dừng và người duyệt; dữ liệu mẫu được ghi nhãn |
| P0 | Đo một tác vụ có phạm vi rõ | So sánh cùng dữ liệu và yêu cầu đầu ra; ghi thời gian thao tác, thời gian AI, công sửa, chi phí API và cấu hình |
| P0 | Rà tên đội và thành viên | Trần Hoàng Đức, Việt Dũng, Đình Duy, Trung Dũng; xác nhận họ tên đầy đủ trên hồ sơ đăng ký |
| P0 | Kiểm tra hồ sơ nộp | Thư mục `AI4Biz_UIT_4Lovpe_2026`; PDF mở được; quyền truy cập đúng; nộp trước 23:59 ngày 13/11/2026 |
| P1 | Chuẩn bị bằng chứng khả thi | Luồng MVP chạy được, cách tích hợp dữ liệu, chi phí ước tính có giả định, fallback khi provider lỗi |
| P1 | Thu thập phản hồi người dùng | Ghi đối tượng, tác vụ, ngày và nhận xét; không gọi dữ liệu demo là pilot doanh nghiệp |

## Lịch nội bộ

| Ngày | Mục tiêu |
|---|---|
| 10/11 | Thống nhất tài liệu, định vị, câu chuyện và nguồn bằng chứng |
| 11/11 | Thử luồng demo, đo tác vụ và dựng bản PDF tiếng Anh đầu tiên |
| 12/11 | Rà rubric, quay demo, sửa nội dung và diễn tập |
| 13/11 | Kiểm tra bản cuối và nộp trước 23:59; lưu xác nhận nộp |
| 14–15/11 | Chuẩn bị Q&A và phương án demo dự phòng trong thời gian chấm sơ khảo |
| 16/11 | Theo dõi kết quả; nếu vào chung kết, chốt người trình bày |
| 17–18/11 | Diễn tập bằng tiếng Anh với ít nhất 3 thành viên; trình bày ≤15 phút, video ≤2 phút, Q&A 5 phút |
| 19/11 | Chung kết theo lịch và địa điểm trong đề bài |

Đây là kế hoạch nội bộ, không phải các vòng sprint chính thức của AI4Biz. Nhóm tự phân công theo năng lực và xác nhận người phụ trách; tài liệu này không tự đổi vai trò các thành viên.

## Cách chứng minh giá trị

- Đo thời gian chuẩn bị **bản nháp đủ điều kiện để QE xem xét**, không tuyên bố hoàn tất xử lý sự cố.
- Với cùng bộ ca, ghi baseline thủ công, thời gian có hỗ trợ, số trường phải sửa và mức đầy đủ bằng chứng.
- Ghi rõ số ca, người thực hiện, cấu hình, dữ liệu mẫu/thực, số lần lặp và lỗi gặp phải. Báo cáo cả trường hợp không cải thiện.
- Ước tính chi phí theo số ca/tháng, token/API, hosting và thời gian người duyệt; mọi giả định phải hiện rõ.
- Chỉ trình bày tỷ lệ tiết kiệm đã có phép đo phù hợp. Nếu chưa đo, trình bày kế hoạch pilot và mục tiêu kiểm chứng.

## Phạm vi MVP và điều kiện demo

Giữ luồng nhập dữ liệu → truy xuất tiền lệ → soạn nháp → kiểm tra/stop → phê duyệt → audit. Dùng SQLite hoặc PostgreSQL theo cấu hình thực tế; tên model và retrieval engine phải khớp phiên chạy. Không mặc định HANA graph, semantic retrieval hoặc rerank đang bật chỉ vì thiết kế có hỗ trợ.

Harness bốn tình huống là bằng chứng kiểm thử nội bộ. Nó không thay thế đánh giá chất lượng LLM hay cho điểm AI4Biz. Trải nghiệm ít bước đăng nhập là mục tiêu demo của nhóm, không phải quy định “No Login” của cuộc thi.

## Rà theo rubric

Theo bảng tổng hợp của đề bài: Problem 25%, Idea & Creativity 30%, Feasibility 20%, Presentation 25%. Nguồn có chênh lệch 20/25 ở hai tiêu chí cuối; xem [ghi chú rubric](../AI4BIZ.md#3-rubric-và-điểm-chưa-thống-nhất-trong-nguồn).

Không đưa thêm nhiều tính năng trước hạn nộp nếu chưa giúp chứng minh vấn đề, giá trị hoặc khả năng vận hành. Kế hoạch kỹ thuật chi tiết nằm tại [docs_sprint2/plan.md](../docs_sprint2/plan.md).
