# UX đề xuất: làm nổi bật AI Referee trong phân tích nguyên nhân gốc rễ

## Mục tiêu

Giúp kỹ sư hoặc giám khảo nhận ra trong vài giây rằng AI đã **tự phân tích bằng chứng độc lập**, kết luận của AI **giống hay khác** đánh giá đang có, và người dùng cần làm gì tiếp theo.

AI Referee hỗ trợ phát hiện và đặt câu hỏi. Kỹ sư vẫn là người đánh giá bằng chứng, chỉnh sửa nguyên nhân và phê duyệt kết luận. Giao diện không nên mô tả bất đồng là bằng chứng AI đúng hoặc con người sai.

## Hiện trạng và phần đã triển khai

- Thẻ `AI Referee` hiện được hiển thị trực tiếp trong D4, phía trên kết luận nguyên nhân đang lưu. Badge chỉ có tooltip trước đây đã được gỡ bỏ.
- Thẻ nêu kết luận đang lưu cạnh kết luận AI, trạng thái đồng thuận/bất đồng/không có dữ liệu đối chiếu, độ tin cậy do AI tự đánh giá, bằng chứng AI trích dẫn, khoảng trống dữ liệu và trạng thái kiểm tra mù.
- Phần lập luận chi tiết có thể mở để xem 5-Why AI, nhánh đã loại trừ, giả thuyết kế tiếp, dữ liệu đầu vào/đã loại khỏi đầu vào và tiền lệ liên quan.
- Dữ liệu `aiFinding`, trạng thái và tiền lệ được truyền từ report trang chi tiết xuống D4. Widget không tự gọi lại report để dựng thẻ AI Referee.
- Nút **Use AI wording as D4 draft** chỉ điền vào trình sửa chưa lưu. Kỹ sư vẫn chủ động lưu; D4 review vẫn nằm riêng bên dưới nội dung D4.

## Nguyên tắc thiết kế

1. **Nêu hành động trước, giải thích sau.** Mở D4 là thấy ngay AI Referee đã kiểm tra gì và kết quả chính là gì.
2. **Cho thấy tính độc lập.** Nói rõ AI nhận bằng chứng nào và không được xem kết luận nào.
3. **Dẫn kết luận về bằng chứng.** Mỗi nhận định quan trọng cần kèm phép đo, giới hạn, ghi nhận điều tra hoặc nguồn tương ứng khi dữ liệu có sẵn.
4. **Giữ quyền quyết định cho kỹ sư.** Không tự đánh dấu nguyên nhân gốc rễ là đã xác nhận; không tự phê duyệt D4.
5. **Không dùng màu làm tín hiệu duy nhất.** Trạng thái luôn có nhãn và biểu tượng đi cùng màu.

## Đề xuất bố cục D4

Đặt một thẻ **AI Referee — Kiểm tra độc lập** ngay đầu nội dung D4, phía trên kết luận hiện tại. Phần tóm tắt luôn mở; phần lập luận chi tiết có thể thu gọn. Không yêu cầu rê chuột để hiểu kết quả.

```text
┌──────────────────────────────────────────────────────────┐
│ AI REFEREE · KIỂM TRA ĐỘC LẬP              [Bất đồng]    │
│ AI không được xem kết luận nguyên nhân đang lưu.          │
│                                                          │
│ Đang lưu:       Man — nghi ngờ thao tác của người vận hành│
│ AI suy luận độc lập: Machine                              │
│ Độ tin cậy AI:  82% · còn thiếu nhật ký bảo trì           │
│                                                          │
│ Bằng chứng nổi bật                                        │
│ • Độ rơ đo được 0,9 mm; giới hạn cho phép 0,2 mm          │
│ • Xuất hiện qua 3 ca, không chỉ một người vận hành        │
│                                                          │
│ [Xem lập luận và nguồn]                                   │
│ [Xem lập luận và đầu vào] [Dùng làm bản nháp D4]           │
└──────────────────────────────────────────────────────────┘
```

Ví dụ trên chỉ dùng khi các giá trị và nguồn thật sự có trong hồ sơ. Với dữ liệu khác, thẻ lấy nội dung từ chính kết quả phân tích; không gắn sẵn một kết luận mẫu vào giao diện.

### Thứ tự thông tin trong thẻ

| Vị trí | Nội dung | Hành vi |
|---|---|---|
| 1 | Tên “AI Referee · Kiểm tra độc lập” và trạng thái | Hiển thị ngay khi có kết quả phân tích hợp lệ |
| 2 | Kết luận hiện đang lưu so với kết luận AI | Đặt cạnh nhau, dùng nhãn trung tính và câu kết luận ngắn |
| 3 | Một đến ba bằng chứng nổi bật | Cho thấy dữ kiện, giới hạn/đối chứng và nguồn nếu có |
| 4 | Tín hiệu về độ tin cậy và khoảng trống bằng chứng | Gắn nhãn rõ là đánh giá của AI; không thay thế bằng chứng |
| 5 | “Xem lập luận và nguồn” | Mở phần 5-Why, nhánh bị loại trừ, phương án kế tiếp và bằng chứng còn thiếu |
| 6 | Hành động của kỹ sư | Kết luận hiện tại được giữ nguyên theo mặc định; có thể chỉnh sửa hoặc dùng kết luận AI làm bản nháp D4 |

## Trạng thái cần thể hiện

| Trạng thái | Nhãn đề xuất | Nội dung cần nhấn mạnh |
|---|---|---|
| AI và nguyên nhân đang lưu giống nhau | **AI độc lập củng cố kết luận hiện tại** | Nêu hai kết luận khớp nhau; giải thích AI không được xem đáp án trước khi phân tích |
| AI và nguyên nhân đang lưu khác nhau | **AI Referee phát hiện bất đồng** | Đặt hai kết luận cạnh nhau; nói rõ đây là tín hiệu cần xem xét, không phải phán quyết |
| Chưa có nguyên nhân để so sánh | **AI đưa ra giả thuyết độc lập** | Không dùng nhãn “bất đồng”; cho biết chưa có kết luận ghi nhận để đối chiếu |
| Có tiền lệ liên quan | **Có hồ sơ tham chiếu** | Hiển thị mã hồ sơ, mức tương đồng và điểm giống/khác; ghi rõ tiền lệ là tham khảo, không phải bằng chứng cho case hiện tại |
| Thiếu dữ liệu hoặc AI nêu khoảng trống | **Cần thêm bằng chứng** | Đưa khoảng trống lên tóm tắt và nêu câu hỏi cụ thể cần người phụ trách xác minh |
| Kiểm tra phát hiện rò rỉ đáp án | **Tính độc lập chưa được đảm bảo** | Ưu tiên cảnh báo này; không quảng bá kết quả như một đánh giá mù hợp lệ |
| Phân tích chưa chạy hoặc dữ liệu lỗi | **Chưa có kết quả kiểm tra độc lập** | Giải thích trạng thái; không hiển thị nhãn “AI Referee đã kiểm tra” hoặc suy đoán kết luận |

“Bất đồng” chỉ áp dụng khi có hai kết luận thực sự để so sánh. Nếu không có nguyên nhân đang lưu, nếu phân tích chưa hoàn tất, hoặc nếu phép kiểm tra độc lập không hợp lệ, phải hiển thị trạng thái tương ứng.

## Phần lập luận và nguồn

Khi người dùng chọn **Xem lập luận và nguồn**, mở rộng ngay dưới phần tóm tắt:

1. **AI đã nhận gì:** phép đo, kiểm tra Is/Is-Not, phát hiện theo từng nhánh Ishikawa, hành động containment và dữ liệu bối cảnh được đưa vào phân tích.
2. **AI không được xem gì:** chuỗi 5-Why đã ghi, cờ đánh dấu nguyên nhân gốc rễ, hành động khắc phục/phòng ngừa, liên kết FMEA và bài học kinh nghiệm.
3. **Chuỗi 5-Why AI tự dựng:** mỗi bước có câu hỏi, câu trả lời và bằng chứng hỗ trợ.
4. **Các nhánh đã loại trừ:** lý do ngắn gọn theo từng nhánh; làm nổi bật dữ kiện đối chứng thay vì chỉ tô mờ các nhánh còn lại.
5. **Khả năng kế tiếp:** nhánh đứng thứ hai và dữ kiện nào có thể làm thay đổi kết luận, nếu AI có trả về.
6. **Bằng chứng còn thiếu:** liệt kê yêu cầu kiểm tra tiếp theo; cho phép sao chép hoặc biến thành câu hỏi điều tra cho SME.

Chỉ gắn liên kết đến bản ghi nguồn khi hệ thống có mã hoặc định danh nguồn thật. Nếu kết quả hiện chỉ chứa lời giải thích dạng văn bản, ghi “AI trích từ ghi chú điều tra đã nhập” thay vì tạo liên kết giả.

## Hành động và kiểm soát của con người

- **Giữ nguyên kết luận:** đây là hành vi mặc định; xem thẻ AI Referee không sửa nội dung D4 và không đánh dấu D4 đã phê duyệt. Không cần thêm nút no-op.
- **Dùng làm bản nháp D4:** chép kết luận AI vào vùng chỉnh sửa; người dùng vẫn phải lưu và phê duyệt.
- **Chỉnh sửa D4:** mở trình chỉnh sửa hiện có. Nếu thay đổi kết luận làm ảnh hưởng D5–D8, hiển thị xác nhận nêu rõ những bước sẽ được phân tích lại.
- Không đặt nút “Accept AI” như một hành động phê duyệt cuối cùng. Dùng “Dùng làm bản nháp” để nói rõ AI không tự quyết định.
- Nếu có bất đồng, đặt hành động xem bằng chứng trước hành động cập nhật kết luận.

## Nội dung giao diện mẫu

Ưu tiên ngôn ngữ cụ thể, tránh các từ như “AI xác minh đúng”, “đã chứng minh” hoặc “AI đã sửa lỗi” khi chưa có người phê duyệt.

| Dùng | Tránh |
|---|---|
| “AI Referee suy luận độc lập: Machine” | “AI xác nhận nguyên nhân đúng là Machine” |
| “Kết luận AI khác với nguyên nhân đang lưu” | “AI phát hiện kỹ sư sai” |
| “AI không được xem chuỗi 5-Why đang lưu” | “AI hoàn toàn khách quan” |
| “Độ tin cậy do AI tự đánh giá: 82%” | Chỉ hiển thị “82% chính xác” |
| “Thiếu nhật ký bảo trì để kiểm tra giả thuyết này” | “Không có vấn đề” khi không tìm thấy dữ liệu |

Giao diện sản phẩm hiện dùng tiếng Anh. Nên giữ tiếng Anh đồng nhất trong ứng dụng, đồng thời chuẩn bị bản dịch tiếng Việt nếu ngôn ngữ giao diện được bật. Ví dụ: **“AI Referee found a disagreement” / “AI Referee phát hiện kết luận khác biệt”**.

## Gợi ý triển khai theo ưu tiên

### P0 — Làm cho đóng góp của AI dễ thấy

- Render `ReasoningPanel` trong D4, phía trên widget kết luận nguyên nhân gốc rễ.
- Thay badge phụ thuộc tooltip bằng trạng thái tóm tắt hiển thị trực tiếp; giữ tooltip chỉ cho giải thích phụ.
- Dùng dữ liệu `report.aiFinding` đã có ở trang chi tiết, tránh component badge tự gọi lại report.
- Hiển thị trạng thái rò rỉ bằng chứng trước trạng thái đồng thuận/bất đồng.

### P1 — Tăng độ tin cậy và khả năng hành động

- Tách rõ “nguyên nhân đang lưu”, “kết luận AI độc lập” và “kết luận kỹ sư đã phê duyệt”. Không gán nhãn “Quality engineer” nếu nguồn thực tế chỉ là dữ liệu ghi nhận.
- Chỉ hiển thị phần trăm tin cậy khi dữ liệu thật sự có; không tự đặt giá trị mặc định.
- Đưa khoảng trống bằng chứng và nhánh đứng thứ hai vào khu vực dễ thấy.
- Thêm liên kết nguồn có thể kiểm tra khi dữ liệu nguồn cung cấp định danh.

### P2 — Hoàn thiện khả năng tiếp cận

- Hỗ trợ bàn phím để mở/đóng lập luận và thao tác các lựa chọn.
- Giữ tương phản tốt; dùng nhãn và biểu tượng bên cạnh màu trạng thái.
- Trên màn hình nhỏ, xếp hai kết luận thành hai khối nối tiếp thay vì thu nhỏ bảng đối chiếu.
- Đặt focus hợp lý khi mở phần bằng chứng hoặc hộp thoại cập nhật D4.

## Tiêu chí nghiệm thu UX

- Người lần đầu mở D4 có thể nhận ra AI đã phân tích độc lập mà không cần rê chuột.
- Trong 5 giây, người dùng xác định được kết luận đang lưu, kết luận AI, và hai kết luận giống hay khác nhau.
- Từ kết luận AI, người dùng mở được 5-Why và lý do loại trừ từng nhánh.
- Bất đồng không được trình bày như kết luận cuối cùng; nội dung D4 được giữ nguyên cho đến khi người dùng sửa hoặc dùng kết luận AI làm bản nháp.
- Trường hợp không có kết luận để đối chiếu, thiếu bằng chứng, kết quả chưa có, hoặc phép kiểm tra mù bị ảnh hưởng đều có trạng thái riêng.
- Không có kết luận AI nào tự động được đánh dấu là đã xác nhận hoặc phê duyệt.

## Kịch bản đánh giá nhanh với BTC

1. Mở một case có nguyên nhân đang lưu khác với kết luận độc lập của AI.
2. Hỏi giám khảo kết luận nào đang lưu, AI đưa ra kết luận nào và vì sao AI đáng được xem xét.
3. Mở bằng chứng hỗ trợ và lý do AI loại trừ nhánh con người nghi ngờ.
4. Chọn **Dùng làm bản nháp D4**; xác nhận D5–D8 được cảnh báo trước khi phân tích lại.
5. Mở một case thiếu nguyên nhân ghi nhận hoặc có khoảng trống dữ liệu để chứng minh AI biết nói “chưa đủ bằng chứng”.

Kịch bản này làm nổi bật đồng thời năng lực suy luận, khả năng giải thích và quyền can thiệp của con người.
