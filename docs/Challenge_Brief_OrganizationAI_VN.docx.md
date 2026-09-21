# **ĐỀ BÀI THỬ THÁCH**

**Bảng 1 \- OrganizationAI**

*MLAI Hackathon 2026 · Mạng lưới AI khu vực phía Nam (Mạng lưới AI) · HCMUT × HUTECH*

&nbsp;

## **1\. Bối cảnh**

***“Xây dựng hệ thống AI thực hiện công việc thực tế và đảm bảo trách nhiệm giải trình.”***

Nghiên cứu về ứng dụng AI trong tổ chức chỉ ra rằng: AI đang định hình lại cách thức các tổ chức được xây dựng, vận hành và mở rộng quy mô. AI không thay thế con người mà tiếp nhận một phần các công việc đang được xử lý thủ công \- bao gồm việc đôn đốc tiến độ, điều phối quy trình, kiểm tra dữ liệu và liên tục đánh giá để phân loại các trường hợp cần con người xử lý trực tiếp.

Các nghiên cứu trên cũng khẳng định sự chuyển dịch này chỉ thành công khi thỏa mãn ba điều kiện cốt lõi. Nếu thiếu bất kỳ điều kiện nào, sản phẩm sẽ chỉ dừng lại ở mức mô hình thử nghiệm mà không thể đưa vào sử dụng thực tế trong tổ chức. Ba điều kiện này là yêu cầu phát triển trọng tâm của cuộc thi và là căn cứ chấm điểm tại Mục 4\.

**Đủ tính tự chủ để xử lý công việc thực tế.** Các mô hình tác tử (agent) hiện nay chủ yếu dừng lại ở việc trả lời câu hỏi; trong khi đó, các tổ chức cần những hệ thống có khả năng tự đảm nhiệm trọn vẹn quy trình. Điều này đòi hỏi hệ thống phải thực thi liên tiếp nhiều bước phụ thuộc mà không cần nhắc lệnh lại, xử lý thỏa đáng khi gặp lỗi thay vì tiếp tục suy đoán sai lệch, và xác định chính xác các trường hợp không được tự ý xử lý đơn lẻ. Một tác tử chuyển tiếp mọi trường hợp cho con người sẽ không có tính tự chủ; ngược lại, tác tử không chuyển tiếp bất kỳ trường hợp nào cũng không đáp ứng yêu cầu.

**Đủ tính minh bạch để con người duy trì trách nhiệm giải trình.** Nhân sự quản lý cần chịu trách nhiệm về các hành động của hệ thống. Điều này chỉ khả thi khi người dùng có thể tra cứu hệ thống đã thực hiện thao tác gì, vào thời điểm nào, dựa trên dữ liệu đầu vào nào và lý do tương ứng; có quyền dừng hoặc hoàn tác hành động; đồng thời nhận được giải thích có thể ứng dụng vào thực tế thay vì chỉ là điểm số độ tin cậy. Đây là yếu tố phân biệt giữa một công cụ có thể đưa vào vận hành thực tế và một công cụ bị bộ phận pháp chế từ chối.

**Đánh giá khách quan tác động đến người sử dụng.** Đây là điều kiện thường bị bỏ qua nhiều nhất, nhưng lại là điểm được các nghiên cứu nhấn mạnh rõ nét nhất. AI không làm giảm khối lượng công việc tổng thể mà có xu hướng dồn nhiều công việc hơn vào cùng một khoảng thời gian \- *gia tăng cường độ làm việc*. Mọi công cụ mới đều đòi hỏi *chi phí thời gian làm quen ban đầu* trước khi mang lại hiệu quả thực tế. Người dùng có nguy cơ rơi vào *sự ỷ lại về mặt nhận thức*, tức chấp nhận kết quả từ hệ thống mà thiếu phản biện. Đồng thời có thể hình thành *sự suy giảm tương tác phối hợp*, khi công cụ dần làm giảm các trao đổi trực tiếp cần thiết giữa các đồng nghiệp. Bài thi chỉ khẳng định việc tăng tốc độ xử lý đơn thuần sẽ không được đánh giá cao; bài thi nhận diện được các tác động thực tế này thông qua kiểm thử người dùng và báo cáo minh bạch sẽ đạt điểm tối ưu.

Ba đề bài kỹ thuật tại Mục 2 giải quyết vấn đề từ ba góc độ khác nhau: **A** \- Tác tử xử lý công việc thường quy và xác định chính xác thời điểm dừng để chuyển tiếp cho con người; **B** \- Tái cấu trúc toàn bộ quy trình thay vì chỉ tăng tốc độ một bước đơn lẻ; **C** \- Nâng cao chất lượng ra quyết định nhóm thông qua việc làm rõ các bất đồng thực chất. Đội thi chọn đúng một đề bài.

Yêu cầu kỹ thuật mở, thời hạn nghiêm ngặt và tiêu chí cốt lõi duy nhất: **phần mềm phải vận hành thực tế.** Cuộc thi không có hạng mục chỉ dành riêng cho ý tưởng và không chấm điểm cho các kế hoạch phát triển chưa được triển khai.

**Tổng quan:** Thời gian phát triển: 72 giờ (Sprint 1\) · Khởi động: 19/09 · Demo Day: 17/10 · Quy mô đội thi: 1–4 sinh viên · Số đề bài trong bảng: 3 đề bài (A, B, C) \- chọn đúng một đề bài.

## **2\. Thử thách**

***“Xây dựng hệ thống AI thực thi công việc thực tế trong tổ chức, đảm bảo con người có thể theo dõi tiến trình xử lý, điều chỉnh và can thiệp dừng hệ thống khi cần thiết.”***

**Lĩnh vực trọng tâm:** quy trình làm việc, điều phối công việc, hỗ trợ ra quyết định, tính tự chủ. Chọn **một trong ba đề bài** dưới đây và xây dựng sản phẩm phần mềm vận hành thực tế đáp ứng các yêu cầu đặt ra. Các đề bài mang tính định hướng thay vì danh mục kiểm tra cơ học \- các đội thi có sự phân tích và giải quyết vấn đề linh hoạt, phù hợp sẽ được đánh giá cao hơn việc thực hiện rập khuôn từng mục.

**Cấu trúc mỗi đề bài:** Mỗi đề bài bao gồm **Yêu cầu tối thiểu (Sprint 1\)** \- các tính năng bắt buộc phải vận hành trong vòng 72 giờ để đủ điều kiện xét duyệt; **Yêu cầu nâng cao (Sprint 2\)** \- dành cho các đội vào Chung kết, yêu cầu triển khai thử nghiệm với người dùng thực tế và đo lường kết quả trước/sau; và **Phương thức đánh giá của Ban giám khảo** \- quy trình kiểm thử trực tiếp mà Ban giám khảo sẽ thực hiện trên sản phẩm. Quy trình kiểm thử được công bố trước để các đội định hướng thiết kế sản phẩm đạt chuẩn.

**Về dữ liệu:** Các đội thi tự chuẩn bị dữ liệu. Dữ liệu tổng hợp hoặc tự sinh được chấp nhận và khuyến khích, với điều kiện đội thi phải công bố rõ phần nào là dữ liệu thực tế và phần nào là dữ liệu giả lập (thể hiện trực tiếp tại Slide 4 của bài nộp). Yêu cầu quan trọng: hệ thống phải có khả năng tiếp nhận dữ liệu đầu vào mới, do Ban giám khảo sẽ kiểm thử trên bộ dữ liệu độc lập. Bài thi chỉ hoạt động trên bộ dữ liệu cố định (hard-coded) sẽ bị trừ điểm ở tiêu chí Khả năng vận hành.

**Lưu ý về thời lượng đánh giá 8 phút:** Tại vòng Sơ loại, mỗi giám khảo có 8 phút để đánh giá một bài thi trong tổng số nhiều bài tham gia. Giám khảo sẽ không cài đặt phần mềm và không đọc mã nguồn trực tiếp. Hai sản phẩm bắt buộc phục vụ mục đích này là: **đường dẫn trực tuyến (live URL)** và **bộ công cụ kiểm thử tự động (Verify harness)** (Mục 3). Đội thi thiếu các thành phần này sẽ bị mất điểm đánh giá tương ứng.

### **A. Bộ điều phối chuyển tiếp (The Escalation Referee)**

*Tác tử có năng lực xác định chính xác thời điểm cần dừng tự động hóa để xin ý kiến con người.*

#### **Yêu cầu tối thiểu (Sprint 1\)**

* Chọn một quy trình thường quy cụ thể (thanh toán hoàn ứng, phê duyệt nghỉ phép, phân loại yêu cầu hỗ trợ...) và xây dựng tài liệu quy định rõ ràng cho quy trình đó. Tự động xử lý các trường hợp thường quy.

* Xây dựng bộ dữ liệu kiểm thử tối thiểu 15 trường hợp, bao gồm các trường hợp không rõ ràng, trường hợp ngoài quy định và trường hợp vượt thẩm quyền xử lý.

* Phân loại mức độ không chắc chắn thành 3 nhóm: chưa xác định được thông tin thực tế, nằm ngoài phạm vi quy định, hoặc vượt thẩm quyền cần con người phê duyệt.

* Khi chuyển tiếp, tạo câu hỏi cụ thể, rõ ràng để người xử lý có thể trả lời trực tiếp \- không dùng các yêu cầu chung chung như yêu cầu xem xét lại.

* Không chuyển tiếp quá mức: các trường hợp thường quy phải được xử lý tự động hoàn toàn. Tác tử chuyển tiếp mọi trường hợp sẽ không đáp ứng yêu cầu xử lý công việc.

* Tuyệt đối không đưa ra kết quả khẳng định đối với dữ liệu đầu vào đã bị gắn cờ nghi vấn.

* **Cung cấp 5 trường hợp kiểm thử chuyển tiếp** \- gồm 3 trường hợp thường quy và 2 trường hợp cần chuyển tiếp \- có thể chạy trực tiếp từ bộ công cụ Verify bằng một thao tác, hiển thị rõ trường hợp nào được chuyển tiếp, trường hợp nào được xử lý tự động và câu hỏi cụ thể tương ứng cho từng trường hợp.

#### **Yêu cầu nâng cao (Sprint 2\)**

* Tự động điều chỉnh ngưỡng chuyển tiếp dựa trên phản hồi của người dùng trong quá trình vận hành.

* Báo cáo độ chính xác bằng số liệu cụ thể trên tập kiểm thử độc lập: tỷ lệ trường hợp cần chuyển tiếp nhưng bị bỏ sót, và tỷ lệ trường hợp đơn giản bị chuyển tiếp không cần thiết.

* Thử nghiệm với ít nhất 3 nhân sự trực tiếp xử lý loại quy trình này trong thực tế, đồng thời chỉ ra ít nhất một điểm cải tiến trong hệ thống xuất phát từ phản hồi của họ.

#### **Phương thức đánh giá của Ban giám khảo**

**Vòng Sơ loại \- Kiểm tra nhanh 90 giây:** Giám khảo chọn Verify → Escalation. Bộ công cụ kiểm thử tự động thực thi 5 trường hợp và hiển thị bảng kết quả. Sau đó, giám khảo nhập một trường hợp không rõ ràng mới dựa trên tài liệu quy định của đội thi.

**ĐẠT:** 2 trường hợp được chuyển tiếp, 3 trường hợp được xử lý tự động, và trường hợp mới được xử lý hợp lý. **KHÔNG ĐẠ**T: hệ thống chuyển tiếp tất cả hoặc không chuyển tiếp trường hợp nào.

**Vòng Chung kết \- Kiểm thử toàn diện (20 điểm):** Ban giám khảo đưa ra 5 trường hợp mới dựa trên tài liệu quy định của đội thi, trong đó có khoảng 2 trường hợp cần chuyển tiếp.

| Bài kiểm tra | Thao tác của Giám khảo và Thang điểm | Điểm |
| :---- | :---- | :---- |
| Phát hiện đúng trường hợp cần chuyển tiếp | Giám khảo thực thi 5 trường hợp riêng. 8 điểm: chuyển tiếp đúng cả 2 trường hợp và phân loại chính xác. 4 điểm: phát hiện đúng 1 trong 2 trường hợp. 0 điểm: không phát hiện được trường hợp nào. | 8 |
| Không can thiệp các trường hợp đơn giản | 3 trường hợp thường quy phải được xử lý tự động hoàn toàn. 6 điểm: không có trường hợp chuyển tiếp sai. 3 điểm: có 1 trường hợp chuyển tiếp sai. 0 điểm: từ 2 trường hợp chuyển tiếp sai trở lên. | 6 |
| Chất lượng câu hỏi chuyển tiếp | Giám khảo đánh giá nội dung câu hỏi do hệ thống tạo ra. 6 điểm: câu hỏi cụ thể, người xử lý có thể quyết định ngay trong một câu trả lời mà không cần tra cứu lại hồ sơ gốc. 3 điểm: câu hỏi cụ thể nhưng vẫn cần tra cứu thêm. 0 điểm: câu hỏi chung chung, dạng yêu cầu xem xét lại. | 6 |

***Ví dụ:** Tác tử hỗ trợ thủ quỹ câu lạc bộ xử lý hồ sơ hoàn ứng. Phần lớn hồ sơ hợp lệ được xử lý tự động. Khi hóa đơn bị mờ, tác tử hỏi rõ: số tiền là 450.000₫ hay 480.000₫? Với hóa đơn chi tiền đồ uống có cồn, tác tử thông báo: khoản chi này có thể ngoài quy định của câu lạc bộ, bạn có xác nhận phê duyệt không? Với hóa đơn trên năm triệu đồng, tác tử nêu rõ: khoản này cần chữ ký của Chủ tịch câu lạc bộ phê duyệt. Ba yêu cầu xử lý, ba phương thức chuyển tiếp khác nhau.*

### **B. Tái cấu trúc toàn bộ quy trình (The Whole Workflow)**

*Lựa chọn một quy trình làm việc hoàn chỉnh tại trường đại học, tổ chức sinh viên hoặc doanh nghiệp nhỏ và tái thiết kế toàn bộ quy trình.*

#### **Yêu cầu tối thiểu (Sprint 1\)**

* Chọn một quy trình hoàn chỉnh từ đầu đến cuối. Gợi ý: đặt phòng/không gian làm việc, thanh toán hoàn ứng, đăng ký sự kiện, mượn trả thiết bị, cấp giấy xác nhận sinh viên, phê duyệt nội dung truyền thông.

* **Lập sơ đồ quy trình hiện tại kèm số liệu đo lường thời gian thực tế \-** từ thời điểm bắt đầu đến khi kết thúc hoàn toàn, bao gồm thời gian chờ, thời gian đôn đốc/theo dõi và các bước bàn giao. Nêu rõ phương pháp đo lường. Sơ đồ đối chiếu trước và sau cải tiến là sản phẩm bắt buộc.

* Xây dựng bản thử nghiệm vận hành của quy trình tái cấu trúc \- thay đổi cấu trúc luồng công việc thay vì chỉ chèn AI vào một bước hiện có.

* Thể hiện rõ điểm con người đưa ra quyết định nằm ở đâu trong quy trình mới và lý do bố trí tại vị trí đó. Nội dung này phải nhất quán với Slide 2\.

* Cung cấp ít nhất hai trường hợp thực tế để giám khảo thực thi toàn bộ quy trình, bao gồm một trường hợp ngoại lệ (ví dụ: phòng đã kín lịch, hóa đơn bị thiếu chứng từ).

#### **Yêu cầu nâng cao (Sprint 2\)**

* Thử nghiệm với ít nhất 3 nhân sự cụ thể trực tiếp thực hiện công việc này trong thực tế, ghi nhận trung thực ý kiến phản hồi của họ.

* Báo cáo cả các yếu tố được tối ưu hóa và các điểm phát sinh khó khăn/bất cập mới, nêu rõ phương pháp đánh giá.

* Chỉ ra một thay đổi cụ thể trong sản phẩm bắt nguồn từ phản hồi của người dùng, thể hiện qua lịch sử commit hoặc đối chiếu trước/sau.

#### **Phương thức đánh giá của Ban giám khảo**

**Vòng Sơ loại \- Kiểm tra nhanh 90 giây:** Giám khảo truy cập đường dẫn trực tuyến và thực hiện một trường hợp thực tế từ đầu đến cuối theo hướng dẫn ngắn gọn trên trang chủ. Sơ đồ đối chiếu trước/sau được mở song song để kiểm tra.

**ĐẠT:** Quy trình hoàn thành trọn vẹn và điểm quyết định của con người xuất hiện đúng như mô tả ở Slide 2\. **KHÔNG ĐẠT:** Hệ thống bị gián đoạn, hoặc không có điểm quyết định của con người.

**Vòng Chung kết \- Kiểm thử toàn diện (20 điểm):** Giám khảo đóng vai trò người dùng để trải nghiệm toàn bộ quy trình mới, bao gồm một trường hợp ngoại lệ, sau đó đối chiếu kết quả thực tế với sơ đồ quy trình trước/sau của đội thi.

| Bài kiểm tra | Thao tác của Giám khảo và Thang điểm | Điểm |
| :---- | :---- | :---- |
| Đối chiếu trước và sau cải tiến | Giám khảo so sánh hai sơ đồ quy trình. 7 điểm: sơ đồ hiện trạng có số liệu đo lường thời gian thực tế bao gồm thời gian chờ, sơ đồ mới thay đổi trình tự hoặc loại bỏ/thêm bước thay vì chỉ tăng tốc độ cơ học. 4 điểm: các bước xử lý nhanh hơn nhưng chuỗi quy trình giữ nguyên. 0 điểm: không có sơ đồ hiện trạng, hoặc số liệu thời gian chỉ là ước tính cảm tính. | 7 |
| Thực thi một trường hợp hoàn chỉnh | 7 điểm: hoàn thành quy trình từ đầu đến cuối, bao gồm điểm quyết định của con người và nhánh xử lý ngoại lệ. 3 điểm: hoàn thành nhưng cần can thiệp thủ công hỗ trợ. 0 điểm: chỉ vận hành được từng bước rời rạc. | 7 |
| Phân tích các điểm bất cập phát sinh | Giám khảo phỏng vấn về các vấn đề hoặc gánh nặng mới phát sinh khi áp dụng hệ thống. 6 điểm: câu trả lời cụ thể từ người dùng thực tế \- khối lượng công việc mới phát sinh, kỹ năng bị mai một, hoặc tương tác giao tiếp bị giảm sút. 3 điểm: nêu lo ngại chung chung. 0 điểm: trả lời không có bất cập nào. | 6 |

***Ví dụ:** Quy trình đặt phòng tại trường đại học hiện nay: điền biểu mẫu, gửi email cho phòng ban phụ trách, chờ phản hồi hai ngày, nhận thông báo phòng đã kín lịch và phải bắt đầu lại từ đầu. Việc tái thiết kế không chỉ là tích hợp thêm chatbot vào biểu mẫu, mà là đánh giá lại toàn bộ chuỗi quy trình để loại bỏ sự cần thiết của việc gửi email trao đổi qua lại.*

### **C. Lớp điều phối cộng tác (The Coordination Layer)**

*Nâng cao hiệu quả phối hợp làm việc nhóm giữa các nhân sự thay vì thay thế vị trí của họ.*

#### **Yêu cầu tối thiểu (Sprint 1\)**

* Giải quyết một vấn đề tắc nghẽn phối hợp thực tế: sự cô lập thông tin giữa các bộ phận, quyết định bị đình trệ, hoặc bất đồng ngầm chưa được tháo gỡ.

* Xây dựng bộ dữ liệu hội thoại mô phỏng (chuỗi trao đổi email hoặc tin nhắn giữa hai nhóm) có cài cắm một điểm bất đồng ngầm làm chuẩn đối chiếu (ground truth) \- hệ thống phải phát hiện được điểm này. Cần công bố rõ đây là dữ liệu tổng hợp.

* **Phân biệt rõ giữa bất đồng quan điểm thực chất và sự khác biệt về thuật ngữ diễn đạt \-** việc hai người dùng từ ngữ khác nhau để cùng chỉ một khái niệm không phải là mâu thuẫn, và việc hệ thống nhận định đó là mâu thuẫn được coi là lỗi xử lý.

* Phân tích và suy luận dựa trên kiến thức, niềm tin và mong muốn thực sự của các bên tham gia \- không chỉ dừng lại ở câu chữ bề mặt được viết ra.

* **Cung cấp giao diện dán văn bản trực tiếp (paste-in) trên đường dẫn trực tuyến** để giám khảo có thể kiểm thử văn bản mới mà không cần cài đặt hoặc tạo tài khoản.

* Hoạt động mà không đòi hỏi mọi người phải thay đổi thói quen làm việc: đọc dữ liệu từ các kênh giao tiếp sẵn có, không bắt buộc cả nhóm phải cài đặt ứng dụng mới.

#### **Yêu cầu nâng cao (Sprint 2\)**

* Vận hành trên chuỗi hội thoại thực tế (đã ẩn danh và có sự đồng thuận của các bên) và nhận được xác nhận từ những người tham gia \- tối thiểu một người đại diện cho mỗi bên xác nhận rằng hệ thống đã chỉ ra chính xác điểm bất đồng thực chất của họ.

* Cung cấp bằng chứng thực tế về mức độ tương tác trực tiếp giữa các thành viên trong nhóm \- chứng minh hệ thống không làm suy giảm các trao đổi trực tiếp cần thiết giữa con người với nhau.

#### **Phương thức đánh giá của Ban giám khảo**

**Vòng Sơ loại \- Kiểm tra nhanh 90 giây:** Giám khảo dán hai văn bản thể hiện quan điểm do Ban giám khảo chuẩn bị vào ô nhập liệu và xem kết quả phân tích. Văn bản chứa một điểm bất đồng thực chất và hai điểm mà hai bên có cùng quan điểm nhưng sử dụng cách diễn đạt khác nhau.

**ĐẠT:** Hệ thống chỉ ra đúng bất đồng thực chất và nhận diện được ít nhất một trong hai điểm tương đồng bị khác biệt về từ ngữ. **KHÔNG ĐẠT:** Hệ thống chỉ tóm tắt lại hoặc thiên vị một bên.

**Vòng Chung kết \- Kiểm thử toàn diện (20 điểm): Ban giám khảo cung cấp các chuỗi hội thoại dài hơn, chứa điểm bất đồng khác được lồng ghép phức tạp hơn.**

| Bài kiểm tra | Thao tác của Giám khảo và Thang điểm | Điểm |
| :---- | :---- | :---- |
| Kiểm thử trực tiếp trên dữ liệu mới | 7 điểm: phân biệt chính xác bất đồng thực chất với các trường hợp chỉ khác biệt về từ ngữ diễn đạt. 3 điểm: tóm tắt chính xác quan điểm hai bên nhưng không phân tích được cấu trúc mâu thuẫn. 0 điểm: thiên vị một phía hoặc chỉ thuật lại nguyên văn văn bản. | 7 |
| Xác nhận từ người dùng thực tế | Giám khảo kiểm tra xác nhận từ những nhân sự trực tiếp tham gia hội thoại. 8 điểm: tối thiểu một đại diện từ mỗi bên xác nhận bằng đánh giá riêng của họ. 4 điểm: chỉ có một bên xác nhận. 0 điểm: không có xác nhận từ người dùng \- đội thi tự chấm điểm bài làm của mình. | 8 |
| Mức độ không làm gián đoạn thói quen | Giám khảo đánh giá yêu cầu thao tác đối với người tham gia. 5 điểm: không thay đổi thói quen \- hệ thống tiếp nhận trực tiếp nội dung họ trao đổi trên nền tảng sẵn có. 0 điểm: bắt buộc mọi người phải chuyển sang sử dụng công cụ mới. | 5 |

***Ví dụ:** Hai nhóm trong một tổ chức sinh viên tranh luận về ngân sách sự kiện suốt ba tuần. Công cụ phân tích nội dung trao đổi của hai bên và nhận thấy tổng ngân sách đã đạt được sự đồng thuận \- điểm bất đồng thực sự là thẩm quyền quản lý quỹ dự phòng phát sinh. Trước đó, chưa bên nào đề cập trực tiếp vấn đề này.*

## **3\. Sản phẩm nộp**

Mỗi đội thi nộp đầy đủ **6 hạng mục** dưới đây. Kho mã nguồn cuối cùng, 5 slide thuyết trình và video demo được chốt hạn vào ngày 15/10.

**a. Đường dẫn trực tuyến (Live URL).** Đã triển khai vận hành, truy cập công khai, không yêu cầu tạo tài khoản, không cần cài đặt. Giám khảo chỉ có 8 phút và sẽ không dành 5 phút để tải kho mã nguồn về máy. Có thể dùng dịch vụ lưu trữ miễn phí. Tại trang chủ, cung cấp một dòng hướng dẫn ngắn gọn cho người truy cập về thao tác chính cần thử nghiệm đầu tiên. Đối với bài thi có phần cứng: nộp video kèm cam kết chạy demo trực tiếp.

**b. Bộ công cụ kiểm thử tự động (Verify harness) và 4 trường hợp kiểm thử.** Một lệnh hoặc một nút bấm duy nhất để chạy tuần tự toàn bộ 4 trường hợp kiểm thử và in bảng kết quả đạt/không đạt (pass/fail) kèm dấu thời gian \- cùng với bài kiểm tra nhanh 90 giây cho đề bài đã chọn. Đây là thành phần quan trọng nhất phục vụ việc chấm thi: giúp giám khảo hoàn thành việc đánh giá trong 90 giây thay vì phải thao tác thủ công trong 6 phút. Cung cấp 4 trường hợp kiểm thử dưới dạng bảng (dữ liệu đầu vào, hành vi kỳ vọng, cách thực thi); bắt buộc có ít nhất một trường hợp mà hành vi xử lý đúng là từ chối hoặc chuyển tiếp. Đính kèm tài liệu hướng dẫn vận hành (runbook) \- liệt kê chi tiết mọi lệnh thực thi từ khi clone mã nguồn sạch đến khi hệ thống chạy \- phục vụ vòng Chung kết và việc tái lập kết quả sau này.

**c. Kho mã nguồn công khai (Public repository).** Lưu trữ đầy đủ lịch sử commit trong suốt thời gian diễn ra sprint. Các hành động gộp commit (squash) hoặc ghi đè lịch sử (force-push) sẽ bị tính là không hợp lệ \- lịch sử commit là bằng chứng đánh giá quá trình phát triển.

**d. Video demo, thời lượng tối đa 3 phút.** Khuyến khích sử dụng bản quay màn hình mộc không qua chỉnh sửa. Thể hiện hệ thống đang vận hành thực tế, bao gồm cả các điểm chưa hoàn thiện.

**e. Bộ 5 slide thuyết trình, theo đúng cấu trúc cố định dưới đây.** Không bổ sung thêm slide.

| Slide | Nội dung |
| :---- | :---- |
| 1 | Vấn đề hiện trạng \- quy trình làm việc hoặc khoảng trống tồn tại trong thực tế. |
| 2 | Đầu vào → Xử lý → Đầu ra \- và làm rõ vị trí con người giữ vai trò đưa ra quyết định. |
| 3 | Tác động thực tế: đối chiếu trước và sau triển khai \- cùng phương pháp đo lường cụ thể. |
| 4 | Kiến trúc hệ thống \- mô hình triển khai; phân định rõ thành phần thực tế và thành phần giả lập. |
| 5 | Giới hạn và rủi ro \- các trường hợp hệ thống gặp lỗi, hạn chế tồn tại và định hướng xử lý tiếp theo. |

**Lưu ý:** Slide 3 và Slide 5 chiếm trọng số lớn trong đánh giá của Hội đồng giám khảo. **Nội dung về phương pháp đo lường là bắt buộc** \- các khẳng định về hiệu quả mà không có phương pháp chứng minh sẽ không được công nhận.

**f. Nhật ký phát triển (Build log), độ dài 1 trang.** Nêu rõ các công cụ AI đã sử dụng và phương thức áp dụng, những điểm công cụ mang lại hiệu quả, những điểm gây phát sinh chi phí/thời gian, cùng tính năng lớn nhất đã quyết định cắt giảm và lý do tương ứng.

## **4\. Tiêu chí chấm điểm**

Mỗi đội thi được chấm trên thang điểm **100 điểm**. Đề bài lựa chọn quyết định 20 điểm cuối cùng: mỗi đề bài có bài kiểm thử xác thực riêng được công bố tại Mục 2 để các đội nắm rõ trước khi phát triển.

| STT | Tiêu chí | Điểm tối đa | Yêu cầu để đạt điểm cao |
| :---- | :---- | :---- | :---- |
| 1 | Khả năng vận hành \- Đường dẫn trực tuyến | 10 điểm | Giám khảo truy cập URL và thực hiện thao tác chính theo hướng dẫn trên trang chủ. Hoạt động tốt, không cần tài khoản, không cần cài đặt \= 10 điểm. Hoạt động sau một bước thao tác chưa rõ ràng \= 6 điểm. Liên kết lỗi hoặc giám khảo không thể xác định thao tác cần làm \= 0 điểm. |
| 2 | Khả năng vận hành \- Chạy kiểm thử tự động (Verify) | 12 điểm | Một thao tác bấm chạy toàn bộ 4 trường hợp và in bảng kết quả kèm dấu thời gian. Đạt cả 4 trường hợp \= 12 điểm. Đạt 3 trường hợp \= 8 điểm. Đạt 2 trường hợp \= 4 điểm. Dưới 2 trường hợp hoặc không có bộ công cụ tự động khiến giám khảo phải chạy thủ công \= 0 điểm. |
| 3 | Khả năng vận hành \- Dữ liệu đầu vào mới của Giám khảo | 8 điểm | Hai dữ liệu đầu vào do giám khảo đưa ra mà đội thi chưa từng thấy trước đó. Xử lý hợp lý hoặc từ chối hợp lý cả hai \= 8 điểm. Xử lý đúng 1 dữ liệu \= 4 điểm. Không xử lý được hoặc đưa ra kết quả sai nhưng khẳng định đúng \= 0 điểm. |
| 4 | Khả năng vận hành \- 5 slide thuyết trình & Video demo | 10 điểm | Đầy đủ 5 slide theo đúng cấu trúc quy định, video dưới 3 phút, nêu rõ ràng các giới hạn của hệ thống. Thiếu Slide 3 hoặc Slide 5 bị trừ 50% số điểm mục này. |
| 5 | Người dùng thực tế và Tổ chức thực tế | 20 điểm | 3 nhân sự cụ thể kèm chức danh thực tế đang phụ trách công việc này (6 điểm); trích dẫn nguyên văn phản hồi của họ (4 điểm); 1 thay đổi cụ thể trong sản phẩm xuất phát từ phản hồi người dùng, thể hiện qua commit hoặc đối chiếu trước/sau (6 điểm); 1 tác động tiêu cực/bất cập phát sinh được chỉ ra cụ thể (4 điểm). Nếu trả lời không có bất cập nào sẽ nhận 0 điểm cho phần này. |
| 6 | Vai trò con người (Human-in-the-loop) & Nhật ký kiểm toán | 20 điểm | Điểm phân định quyền quyết định ở Slide 2 khớp với hệ thống vận hành thực tế (6 điểm); giám khảo chọn một hành động bất kỳ và nhật ký kiểm toán truy xuất rõ hệ thống đã làm gì, thời điểm nào, trên dữ liệu nào và lý do tương ứng (6 điểm); tính năng can thiệp dừng và ghi đè hoạt động hiệu quả (4 điểm); hệ thống giải thích được một quyết định cho người không có chuyên môn kỹ thuật hiểu (4 điểm). |
| 7 | Kiểm thử xác thực theo từng Đề bài | 20 điểm | Tại vòng Sơ loại, bài kiểm tra 90 giây của đề bài được chấm theo các mức 20 / 10 / 0 điểm. Tại vòng Chung kết, 20 điểm này được chấm lại dựa trên bài kiểm thử toàn diện 3 phần. Cả hai nội dung đều được công bố tại Mục 2\. |
| Tổng cộng |  | 100 điểm | Khả năng vận hành (40) \+ Người dùng thực tế (20) \+ Vai trò con người (20) \+ Xác thực đề bài (20). |

**Nguyên tắc bắt buộc về vận hành: Nếu hệ thống không thể vận hành, bài thi sẽ không được chấm điểm.** Sản phẩm mà giám khảo không thể thực thi sẽ mất 30 trong số 40 điểm của 4 tiêu chí đầu tiên và không đủ điều kiện vào vòng Chung kết. Cuộc thi không có hạng mục dành riêng cho ý tưởng. Đường dẫn trực tuyến và bộ công cụ kiểm thử tự động là một phần bắt buộc của sản phẩm: một hệ thống dù được xây dựng tốt đến đâu nhưng người ngoài không thể truy cập và kiểm tra trong 8 phút đều bị coi là chưa hoàn thiện.

### **Quy trình đánh giá**

Mỗi bài thi được hai giám khảo chấm độc lập, do đó tổng khối lượng công việc của Hội đồng chấm thi tương đương gấp đôi số lượng bài thi tham gia. Thời lượng 8 phút cho mỗi phiên đánh giá giúp đảm bảo tiến độ bất kể số lượng đội tham gia. Quy trình được phân chia thành ba giai đoạn rõ ràng.

**Giai đoạn 0 \- Kiểm tra mức độ tuân thủ (Compliance check).** Thời lượng 3 phút mỗi bài, do tình nguyện viên Ban tổ chức thực hiện, không phải giám khảo. Danh mục kiểm tra dạng đạt/không đạt, không đòi hỏi chuyên môn sâu: đường dẫn trực tuyến có hoạt động; Verify có xuất kết quả; kho mã nguồn có công khai và đầy đủ lịch sử; có đủ 4 trường hợp kiểm thử với ít nhất 1 trường hợp từ chối; có các sản phẩm theo đề bài; có 3 người dùng thực tế cụ thể; có 1 cải tiến từ phản hồi; có 5 slide; có video demo và nhật ký phát triển. Bài thi không đạt bất kỳ mục nào trong 3 mục đầu tiên sẽ bị dừng ngay và không được chuyển đến giám khảo. Bước này giúp xác nhận trước các tiêu chí dựa trên hồ sơ, để trọn vẹn 8 phút của giám khảo tập trung vào đánh giá chuyên môn thực tế.

**Giai đoạn 1 \- Vòng Sơ loại, thời lượng 8 phút.** Hai giám khảo chấm độc lập và bất đồng bộ \- không tổ chức họp trực tuyến với đội thi.

| Thời gian | Nội dung thực hiện |
| :---- | :---- |
| 0:00–1:00 | Giám khảo truy cập đường dẫn trực tuyến và thực hiện thao tác chính theo hướng dẫn ngắn gọn trên trang chủ, không cần tạo tài khoản. |
| 1:00–3:00 | Một thao tác bấm vào nút Verify. Bộ công cụ kiểm thử tự động thực thi cả 4 trường hợp và in bảng kết quả đạt/không đạt kèm dấu thời gian thực. Giám khảo kiểm tra bảng kết quả tổng hợp thay vì chạy từng trường hợp thủ công. |
| 3:00–5:00 | Kiểm thử với 2 dữ liệu đầu vào do Ban giám khảo chuẩn bị mà đội thi chưa từng thấy. Trong đó có 1 dữ liệu được thiết kế nhằm kiểm tra khả năng xử lý khi gặp tình huống bất thường. |
| 5:00–6:30 | Thực hiện bài kiểm tra nhanh 90 giây được quy định theo từng đề bài tại Mục 2\. Chấm theo các mức điểm 20 / 10 / 0\. |
| 6:30–7:30 | Giám khảo chọn một hành động hệ thống đã thực hiện và tra cứu nhật ký kiểm toán để xem thao tác đã làm, thời gian, dữ liệu đầu vào và lý do \- sau đó thử thực hiện thao tác dừng hoặc hoàn tác. |
| 7:30–8:00 | Cho điểm theo thang điểm chuẩn, không viết nhận xét dài dòng. Nếu điểm số giữa hai giám khảo chênh lệch trên 15 điểm, bài thi sẽ được chuyển sang giám khảo thứ ba đánh giá lại. |

**Giai đoạn 2 \- Vòng Chung kết, thời lượng 20 phút.** Chỉ dành cho các đội lọt vào danh sách rút gọn để có đủ thời gian đánh giá chuyên sâu. Thang điểm 100 điểm mới hoàn toàn: Trình diễn sản phẩm trực tiếp (45 điểm), Chiều sâu trả lời phỏng vấn phản biện (35 điểm), và Bài kiểm thử xác thực 3 phần theo đề bài tại Mục 2 được thực thi trực tiếp (20 điểm). Vòng Sơ loại đánh giá tính xác thực của sản phẩm. Vòng Chung kết đánh giá chất lượng và chiều sâu của giải pháp.

**Tính minh bạch và giới hạn tin cậy của bộ công cụ Verify.** Đội thi tự xây dựng bộ công cụ Verify, nên tại vòng Sơ loại kết quả được ghi nhận dựa trên dữ liệu hiển thị trực tiếp kèm dấu thời gian. Ba yếu tố đảm bảo tính trung thực: Giám khảo cung cấp hai dữ liệu đầu vào mới; bộ công cụ nằm trong kho mã nguồn công khai kèm toàn bộ lịch sử commit; và tại vòng Chung kết, giám khảo sẽ tự tay thực hiện toàn bộ bài kiểm thử với dữ liệu đầu vào và điều kiện ban đầu do giám khảo chủ động lựa chọn. Bộ công cụ kiểm thử hiển thị kết quả sai lệch so với thực tế có thể qua được vòng Sơ loại nhưng sản phẩm chắc chắn sẽ không đạt tại vòng Chung kết.

**Hội đồng giám khảo:** Một giám khảo kỹ thuật (giảng viên chuyên ngành AI/Khoa học máy tính hoặc kỹ sư doanh nghiệp), một giám khảo chuyên môn (chuyên gia quản trị hoặc tâm lý học tổ chức), và một chuyên gia thực tế đã từng triển khai và vận hành các hệ thống tương tự.

## **5\. Hình thức & Lịch trình**

Cuộc thi diễn ra từ ngày khởi động 19/09 đến Demo Day ngày 17/10. Việc gộp toàn bộ một tháng thành một giai đoạn duy nhất dễ dẫn đến việc làm slide thuyết trình nhưng thiếu sản phẩm chạy thực tế và dồn việc vào tuần cuối. Do đó, cuộc thi được chia thành hai sprint rõ ràng.

| Giai đoạn | Thời gian | Nội dung |
| :---- | :---- | :---- |
| Khởi động & Hội thảo | 19/09 | Công bố đồng thời cả 3 đề bài. Tổ chức hội thảo chuyên ngành và hướng dẫn công cụ (tooling clinic). Các đội lựa chọn đề bài. |
| Sprint 1 \- Phát triển vòng loại | 19/09 → 22/09 (72 giờ) | Thời hạn nghiêm ngặt. Mỗi đội hoàn thiện đường dẫn trực tuyến, bộ công cụ kiểm thử Verify và 4 trường hợp kiểm thử. Kho mã nguồn được khóa và ghi nhận mã băm (hash) tại thời điểm hết hạn. |
| Vòng Sơ loại | 23/09 → 27/09 | Ban tổ chức kiểm tra tuân thủ, sau đó hai giám khảo chấm độc lập 8 phút mỗi bài thi. Công bố danh sách các đội vào Chung kết. |
| Sprint 2 \- Phát triển chuyên sâu | 28/09 → 15/10 | Dành riêng cho các đội vào Chung kết. Cung cấp quyền truy cập OpenAI Codex, credit API và cố vấn đồng hành. Giám khảo gửi mỗi đội một bài toán thách thức bằng văn bản từ kết quả sơ loại \- thường là yêu cầu chứng minh hệ thống vận hành tốt trên tập dữ liệu độc lập do Ban giám khảo chỉ định. |
| Khóa bài nộp | 15/10 | Chốt toàn bộ kho mã nguồn cuối cùng, gói dữ liệu kiểm thử xác thực, 5 slide và video demo. |
| Demo Day | 17/10 | Trình diễn trực tiếp sản phẩm, trả lời câu hỏi phản biện của Hội đồng giám khảo, chạy kiểm thử xác thực đề bài trực tiếp và trao giải. |

**Sự khác biệt giữa yêu cầu của Sprint 1 và Sprint 2:** Trong 72 giờ, đội thi chưa thể thử nghiệm với 3 người dùng thực tế hay đo lường đầy đủ quy trình trước và sau. Sprint 1 yêu cầu sản phẩm vận hành thực tế, đường dẫn trực tuyến, bộ công cụ Verify, các trường hợp kiểm thử và phương pháp đo lường dự kiến \- cách thức đội thi *sẽ* thực hiện đo lường. Sprint 2 là giai đoạn thu thập dữ liệu chứng minh thực tế. Vòng Sơ loại chấm điểm phương pháp; vòng Chung kết chấm điểm bằng chứng thực tế.

Sprint 1 phản ánh trung thực tốc độ và khả năng triển khai thực tế. Sprint 2 là giai đoạn hoàn thiện giải pháp để đáp ứng việc kiểm thử trực tiếp của Ban giám khảo. Các đội không lọt vào Chung kết vẫn hoàn thành một sản phẩm có thể vận hành, kho mã nguồn công khai và giấy chứng nhận từ cuộc thi.

## **6\. Quy định cuộc thi**

**Đối tượng tham gia:** Sinh viên đang theo học tại các cơ sở đào tạo thành viên thuộc Mạng lưới AI. Đội thi từ 1 đến 4 thành viên.&nbsp;

**Công cụ \- Cho phép và khuyến khích:** Mọi trợ lý lập trình AI, mọi mô hình ngôn ngữ lớn, mọi framework, thư viện mã nguồn mở, nền tảng no-code/low-code và tư vấn từ người hướng dẫn. Các đội vào Chung kết được cấp quyền truy cập OpenAI Codex trong Sprint 2\.

**Công cụ \- Yêu cầu bắt buộc:** Toàn bộ công việc phát triển cốt lõi phải diễn ra trong các khung thời gian của sprint. Mã nguồn khung có sẵn từ trước chỉ được chấp nhận nếu đã được công khai trước ngày 19/09, được công bố minh bạch trong tệp README và chỉ chiếm tỷ trọng nhỏ trong bài thi.

**Công cụ \- Không được phép:** Nhân sự không phải sinh viên tham gia viết mã nguồn; bài thi đã được phát triển phần lớn trước thời điểm khởi động; sản phẩm mà đội thi không thể giải thích hoặc chỉnh sửa trực tiếp; sử dụng dữ liệu cá nhân khi chưa có sự đồng ý; tạo lập hồ sơ mô phỏng cá nhân có thật mà không có sự cho phép.

**Bằng chứng thực tế:** Bằng chứng thử nghiệm người dùng phải nêu rõ danh tính và vị trí công tác thực tế của từng cá nhân. Ý kiến xác nhận phải do chính những người tham gia đưa ra bằng văn bản của họ. Hành vi làm giả nhật ký dữ liệu, tự tạo người dùng ảo hoặc làm giả ý kiến xác nhận sẽ bị truất quyền thi đấu trực tiếp, không áp dụng hình thức trừ điểm. Đội thi có thể được yêu cầu tái lập trực tiếp bất kỳ kết quả nào đã công bố.

**Dữ liệu và bảo mật thông tin:** Sử dụng dữ liệu thực tế của tổ chức phải có văn bản cho phép và phải được ẩn danh trước khi nộp bài. Dữ liệu nhạy cảm của các tổ chức cần được thay thế bằng dữ liệu tổng hợp. Đội thi mô phỏng thông tin của các cá nhân cụ thể phải có văn bản đồng thuận.

**Quyền sở hữu:** Đội thi giữ toàn quyền sở hữu trí tuệ đối với sản phẩm của mình. Việc nộp bài thi đồng nghĩa với việc cấp quyền cho Ban tổ chức giới thiệu và trưng bày sản phẩm. Khuyến khích (không bắt buộc) phát hành dưới các giấy phép mã nguồn mở.

## **7\. Cơ cấu giải thưởng**

**Giải thưởng theo bảng:** Bảng thi này có một giải Quán quân (được trao trên sân khấu với danh hiệu *Quán quân OrganizationAI*) và hai giải Khuyến khích (Honorable Mentions). Các giải thưởng đã đi kèm trong gói tài trợ.

**Giải thưởng phụ chuyên đề** (mỗi đội nhận tối đa hai giải thưởng):

* **Giải Bộ công cụ kiểm thử tối ưu nhất (Cleanest Verify Harness):** Dành cho sản phẩm cho phép người ngoài truy cập và kiểm tra nhanh nhất, thuận tiện nhất ngay lần đầu tiên.

* **Giải Kỹ thuật triển khai nhanh (Rapid Engineering Award):** Dành cho đội thi có kỹ năng ứng dụng AI hỗ trợ lập trình hiệu quả nhất, đánh giá qua nhật ký phát triển và lịch sử commit.

* **Giải Nhà phát triển độc lập xuất sắc (Solo Builder Award):** Dành cho bài thi xuất sắc nhất do một cá nhân tự phát triển.

* **Giải Thiết kế tương tác người \- máy xuất sắc (Human-in-the-Loop Award):** Dành cho giải pháp thiết kế ranh giới phân định tối ưu nhất giữa quyền quyết định của hệ thống và quyền quyết định của con người.

* **Giải Đánh giá tác động trung thực nhất (Honest Measurement Award):** Dành cho bài thi có phương pháp đo lường tác động chặt chẽ, khách quan và có tính tự phản biện cao nhất đối với kết quả thu được.

* **Giải Thiết kế sản phẩm xuất sắc nhất (Best Design):** Đánh giá về tính tiện dụng và độ hoàn thiện trải nghiệm người dùng.

* **Giải Dự án liên ngành xuất sắc nhất (Cross-Discipline Award):** Dành cho bài thi xuất sắc nhất từ đội thi có sự kết hợp giữa các thành viên khối kỹ thuật và khối ngoài kỹ thuật.

## **8\. Hỗ trợ & Tài nguyên**

Trong suốt thời gian diễn ra cuộc thi, các đội thi nhận được các hỗ trợ bao gồm:

* **Các buổi hội thảo chuyên ngành và hướng dẫn công cụ** tại buổi khởi động ngày 19/09, bao gồm chuyên đề hướng dẫn xây dựng bộ công cụ kiểm thử Verify và thiết kế các trường hợp kiểm thử \- hai nội dung mà phần lớn các đội chưa từng thực hiện trước đây.

* **Cố vấn chuyên môn** \- các chuyên gia công nghệ, chuyên gia dữ liệu và giảng viên thuộc Mạng lưới AI; các đội vào Chung kết được bố trí cố vấn đồng hành chuyên sâu trong Sprint 2\.

* **Quyền truy cập OpenAI Codex và credit API** cho các đội vào Chung kết trong suốt Sprint 2\.

* **Bài toán thách thức bằng văn bản** từ Ban giám khảo sau vòng Sơ loại, giúp mỗi đội vào Chung kết nắm rõ những nội dung cần tiếp tục hoàn thiện và chứng minh.

**Thông tin liên hệ:** Ban tổ chức \- qttho@hcmut.edu.vn · Ban tổ chức đăng cai- vd.bay@hutech.edu.vn.

*Chương trình thuộc khuôn khổ MLAI Hackathon 2026, do Mạng lưới Trung tâm đào tạo xuất sắc và Tài năng công nghệ 4.0 về Trí tuệ Nhân tạo khu vực phía Nam (Mạng lưới AI) tổ chức, chủ trì bởi Trường Đại học Bách khoa \- ĐHQG-HCM (HCMUT), với HCMUT và Trường Đại học Công nghệ TP.HCM (HUTECH) là các đơn vị đồng tổ chức.*