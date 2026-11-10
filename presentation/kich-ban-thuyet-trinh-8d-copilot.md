# Kịch bản chuẩn bị AI4Biz: 8D Copilot

> **AI4Biz submission status:** This is preparation/reference material, not a confirmed final submission. Slides and presentation must be in English; PDF ≤15 slides, demo video ≤2 minutes, final pitch ≤15 minutes plus 5-minute Q&A, with at least 3 presenting members. Any longer Vietnamese script is a rehearsal reference and must be adapted before submission.

> **Competition context:** [AI4Biz 2026 — LIKELION Vietnam](../AI4BIZ.md), team UIT_4Lovpe. Competition requirements and submission limits are maintained in that reference; technical examples below are not measured business outcomes unless explicitly documented.

## Phân công trình bày AI4Biz

Bản tiếng Việt bên dưới dùng để luyện ý; lời trình bày và slide nộp AI4Biz phải bằng tiếng Anh. Số slide mô tả cấu trúc kịch bản, không xác nhận bản HTML hiện có đã khớp hoặc đã được xuất PDF. Khi đổi bố cục, cập nhật bảng phân công này theo deck cuối.

| Người trình bày | Phạm vi | Thời lượng dự kiến |
|---|---|---|
| Thành viên A | Slide 1–5: đội, vấn đề, người dùng và quy trình; video ≤2 phút | 4:30 |
| Thành viên B | Slide 6–9: giải pháp, vai trò AI, demo và giá trị | 3:00 |
| Thành viên C | Slide 10–13: dữ liệu, kiểm soát, tính khả thi và kết thúc | 3:00 |
| Cả ba | Dự phòng chuyển phần / lỗi video | 1:00 |
| **Tổng pitch** | **Ít nhất 3 thành viên trực tiếp trình bày** | **11:30 dự kiến, tối đa 15:00** |

Nhóm tự gán A/B/C cho thành viên; danh sách không đổi ngoài Trần Hoàng Đức thay thành viên đã cập nhật. Chuẩn bị Q&A tiếng Anh 5 phút riêng. Các mốc dưới đây là thời gian diễn tập, cần bấm giờ thực tế.

## English opening and handoffs

**Opening — Speaker A:** “Good morning to the AI4Biz judges and the LIKELION Vietnam organizers. We are UIT_4Lovpe from the University of Information Technology, VNU-HCM. Our team members are Trần Hoàng Đức, Việt Dũng, Đình Duy and Trung Dũng. 8D Copilot helps quality engineers retrieve previous cases and prepare evidence-linked 8D drafts. Engineers remain responsible for verification, approval and incident closure.”

**A → B:** “We have shown the quality engineer's workflow and the information they need. My teammate will now show how our prototype supports that work.”

**B → C:** “The prototype supports drafting and evidence retrieval. My teammate will explain its data requirements, review controls and deployment limits.”

**Closing — Speaker C:** “Our next step is a measured pilot: compare the same reporting task with and without the copilot, including review time and corrections. Our demo illustrates the workflow; it does not prove that a production incident is resolved in minutes. Thank you. We welcome your questions.”

## Bản luyện ý tiếng Việt

Các số 3 phút, thời gian tái diễn và số liệu trên màn hình phải được gắn đúng nhãn: phép đo demo cụ thể, dữ liệu mẫu hoặc số liệu nghiên cứu có nguồn. Không trình bày là kết quả pilot doanh nghiệp nếu chưa có bằng chứng. Trước khi xuất bài nộp, chuyển toàn bộ lời thoại cần sử dụng sang tiếng Anh và đối chiếu deck thực tế.

## Cách dùng

- Mỗi slide có **Ý chính**: câu duy nhất cần nhớ. Quên hết thì nói câu này là đủ.
- **Lời nói** là gợi ý. Không cần thuộc từng chữ, chỉ dùng con số đã kiểm tra nguồn và phạm vi.
- **▶** nghĩa là bấm chuột hoặc phím →.
- Video đã nói 8D là gì, hạn 20 ngày và thực tế trễ hạn. Các slide sau **không nhắc lại số liệu đó**, chỉ nói phần video chưa có.

## Thời lượng tham khảo của bản luyện cũ

Bảng này mô tả kịch bản trước; dùng bảng phân công AI4Biz ở trên để diễn tập và bố trí ít nhất 3 người.

| Slide          | Nội dung                                        | Thời gian        |
| -------------- | ------------------------------------------------ | ----------------- |
| 1–2           | Mở đầu, thành viên                          | 0:35              |
| 3              | **Video** (không nói)                    | **1:30**    |
| **4–5** | **Ai phải làm 8D, tám bước**          | **2:25**    |
| 6              | AI cắt thời gian ở đâu                      | 1:00              |
| 7–9           | Sản phẩm, kỹ thuật, khó khăn               | 1:15              |
| 10–11         | Thành viên C: dữ liệu, ba lớp chặn | 1:30              |
| 12             | Lịch sử bảo trì (tính năng mới)        | 0:30              |
| 13             | Kết thúc                              | 0:20              |
|                | **Tổng phần nội dung trước đây**                  | **≈ 7:35** |
|                | **Cả bài**                               | **≈ 9:05** |

---

## Slide 1 · Mở đầu · 0:20

> Lời đầu tiên cho em được gửi lời chào tới ban tổ chức LIKELION Vietnam và ban giám khảo AI4Biz. Chúng em giới thiệu **8D Copilot**: trợ lý AI giúp nhà cung cấp linh kiện ô tô soạn báo cáo 8D. AI soạn nháp đủ tám bước trong **khoảng 3 phút trong kịch bản demo; cần đo lại trên phiên chạy trình bày**, còn kỹ sư vẫn là người quyết định.

---

## Slide 2 · Thành viên · 0:15

> Chúng em là đội **UIT_4Lovpe**, Trường Đại học Công nghệ Thông tin, ĐHQG TP.HCM: Trần Hoàng Đức, Việt Dũng, Đình Duy và Trung Dũng.
>
> Trước hết, mời ban giám khảo xem video do nhóm em làm để giới thiệu về bài toán.

---

## Slide 3 · Video · 1:30 · không nói

▶ Bấm sang slide, video tự phát. **Đứng yên, không nói chen.**

Video đi qua: 8D là gì, hơn 104 nghìn cơ sở IATF (Việt Nam 942), hạn 20 ngày làm việc, 80% lần kiểm tra hạn bị trễ, demo nhanh sản phẩm, và kết bằng câu hỏi: *vấn đề nằm ở kỹ sư, hay ở trang giấy trắng?*

Hết video thì ▶ sang slide 4.

---

## Slide 4 · Ai phải làm 8D · 1:15

> Video vừa hỏi: vấn đề nằm ở kỹ sư, hay ở trang giấy trắng? Để trả lời, xin nói rõ lại bài toán 8D.
>
> Ngành ô tô có **ba tác nhân**: nhà sản xuất linh kiện như Bosch, Denso; nhà lắp ráp xe như Volkswagen, Ford, Toyota, **VinFast**; và người mua, từ người dùng cá nhân tới các đội xe như Hertz, Uber.
>
> Khi nhà lắp ráp phát hiện một linh kiện **lỗi,** họ **yêu cầu nhà sản xuất linh kiện nộp báo cáo 8D**. 8D Copilot làm việc cho chính nhà sản xuất đó.
>
> ▶ Một bản 8D trả lời **năm câu hỏi**: lỗi gì, đã chặn hàng lỗi chưa, **vì sao xảy ra**, sửa thế nào, và làm sao để không lặp lại. Câu thứ ba là câu khó nhất.

---

## Slide 5 · Tám bước của 8D · 1:10

nhìn slide nói về 8 bước 8D nhanh chóng

---

## Slide 6 · AI cắt thời gian ở đâu · 1:00

> Ghép tám bước vào thời gian thật, một bản 8D đi qua **bốn giai đoạn**: chặn lỗi, tìm nguyên nhân và giải pháp, thực thi và chứng minh hiệu lực, rồi duyệt ký. Có bản 8D mất **71 ngày**, dù hạn là 60.
>
> Giai đoạn hai, tìm nguyên nhân và giải pháp, thường kéo dài **10 đến 20 ngày**.
>
> ▶ Đây chính là trang giấy trắng: kỹ sư lục file cũ trên nhiều máy, hỏi người làm lâu năm. Với 8D Copilot, case tiền lệ đã nằm sẵn trên hệ thống: AI tìm case cùng vật tư, máy, mã lỗi và soạn nháp có nguồn trong **khoảng 3 phút trong kịch bản demo; cần đo lại trên phiên chạy trình bày**. Kỹ sư vẫn là người duyệt.
>
> Bên ngoài cũng có số đo: một thí điểm AI ở nhà máy ô tô rút bước D1, D3 từ **vài giờ xuống dưới 1 phút**.

---

## Slide 7 · Màn hình sản phẩm · 0:20

> Video vừa lướt qua sản phẩm; đây là bố cục. ▶ Tab chính, ▶ tám bước bên trái, ▶ trạng thái và nút duyệt, ▶ bản nháp của AI. Không bước nào tự chạy, kỹ sư duyệt từng bước.

---

## Slide 8 · AI chạy ở đâu · 0:25

> Một lần phân tích có bốn chặng: bóc tách dữ liệu, tìm tiền lệ, soạn D1 đến D8, và một AI thứ hai phản biện. ▶ Hệ thống viết bằng React và SAP CAP, mô hình DeepSeek hoặc Gemini. Một lần chạy mất **khoảng 3 phút trong kịch bản demo; cần đo lại trên phiên chạy trình bày**.

---

## Slide 9 · Khó khăn · 0:30 · chuyển phần

> Đưa AI vào 8D có năm chỗ khó: ▶ AI có thể bịa, ▶ thiên kiến đổ lỗi cho người, ▶ lấy nhầm case cũ, ▶ không biết lúc nào nên dừng, ▶ và dữ liệu nhà máy rất bẩn.

## Slide 10 · Dữ liệu · 0:45

> AI chỉ đáng tin khi dữ liệu có khung. Chúng em chia dữ liệu thành **ba nhóm**.
>
> ▶ **Nhóm 1, danh mục gốc:** mã máy, mã vật tư, mã lỗi, lô hàng. Các mã này **chọn từ danh mục, không gõ tay**, nên AI luôn bám vào một khung cố định.
>
> ▶ **Nhóm 2, hiện trường:** phiếu lỗi hôm nay, số đo kiểm tra, lịch sử lô, FMEA và các case đã đóng. Mọi bảng **nối về một mã phiếu lỗi**.
>
> ▶ **Nhóm 3, hồ sơ 8D:** tám bước D1 đến D8, bằng chứng từng việc, ai duyệt, lúc nào. **Mọi lần duyệt đều để lại vết.**
>
> ▶ Bản demo chạy trên **một file SQLite** cho gọn, không cần cài database server; khi chạy thật thì dùng **PostgreSQL**.

---

## Slide 11 · Ba lớp chặn · 0:45

> Trên khung dữ liệu đó là **ba lớp chặn**, ứng với các chỗ khó vừa nêu.
>
> **GraphAI** chặn việc lấy nhầm case cũ: tìm tiền lệ theo **quan hệ thật**, cùng máy, cùng vật tư, cùng mã lỗi, chứ không theo câu chữ. "Máy phay bị xước" và "máy tiện bị xước" nghe giống nhau nhưng là hai lỗi khác. Không đủ giống thì không đưa.
>
> **AI Referee** chặn thiên kiến "do người": một AI thứ hai bị **giấu kết luận của kỹ sư**, chỉ xem số đo. Kỹ sư nói "do người", số đo nói "do máy" thì hệ thống **dừng ở D4** và hỏi bằng chứng.
>
> **AI Stop** chặn AI làm quá phần mình: **tám luật dừng, chia ba loại**. Dữ kiện chưa xác minh, như số đo chỉ là một câu văn, thì hỏi kỹ sư. Không có tiền lệ đủ giống thì hỏi chuyên gia. Việc vượt thẩm quyền, như chi phí từ **10.000 €** hay đổi SOP, FMEA, thì cần Quality Manager hoặc chủ quy trình. Dừng bằng luật, câu trả lời vào nhật ký.
>
> *Thành viên C tiếp tục slide 12–13.*

---

## Slide 12 · Lịch sử bảo trì · 0:30

> Tính năng mới: mỗi **nguyên nhân gốc đã duyệt** thành **một việc phòng ngừa**, lưu lại thành lịch sử bảo trì theo loại lỗi. Bộ luật chọn biện pháp, **không gọi AI**, kỹ sư duyệt.
>
> ▶ Biện pháp đi theo nguyên nhân. ▶ Ví dụ DEF-0377: lỗi quay lại sau **4 ngày**, sau biện pháp là **113 ngày** (dữ liệu mẫu). ▶ Không có số đo thì để trống, hỏi người.

---

## Slide 13 · Kết thúc · 0:20

> Quay lại câu hỏi của video: hạn 8D trễ **không phải vì kỹ sư**, mà vì họ phải bắt đầu từ trang giấy trắng. 8D Copilot lấp trang giấy đó: **AI soạn, con người duyệt, mọi kết luận đều có nguồn.**
>
> Mời ban giám khảo thử trực tiếp tại địa chỉ trên màn hình. Cảm ơn ban giám khảo.

---

## Nếu bị hỏi "8D là gì" một lần nữa

Trả lời trong một câu:

> 8D là phương pháp giải quyết vấn đề theo tám bước, thường được khách hàng yêu cầu khi xử lý sự cố chất lượng: ngăn chặn, tìm và xác minh nguyên nhân, khắc phục, rồi kiểm tra hiệu lực phòng ngừa.

## Nếu video không phát

Nếu video không phát, chuyển sang ảnh dự phòng và nói bằng tiếng Anh: “This demonstration uses sample data. A quality engineer needs to connect the defect, inspection evidence and previous cases before approving an action. Our copilot prepares a draft and highlights evidence that still needs review.” Sau đó tiếp tục phần giải pháp; không dùng số liệu không có nguồn để lấp thời gian.
