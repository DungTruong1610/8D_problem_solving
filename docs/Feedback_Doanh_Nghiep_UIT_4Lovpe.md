# FEEDBACK TỪ DOANH NGHIỆP — SPRINT 1 (TRACK VNG)

> **Historical reference — not current competition rules.** Original dates, observations and results below belong to an earlier development stage. Current competition: [AI4Biz 2026 — LIKELION Vietnam](../AI4BIZ.md). These records are not a new verification run or an AI4Biz score.
## Đội thi: UIT_4Lovpe

---

### TỔNG QUAN ĐÁNH GIÁ
* **Xếp nhóm kỹ thuật**: Nhóm giữa
* **Tiềm năng thương mại thực tế**: **Cao**
* **Số kiểu dừng đạt chuẩn (Spec Stops)**: **1/3** kiểu dừng
* **Đánh giá năng lực thực thi**:
  * **Nó chạy (It runs - 40%)**: Partial Một phần
  * **Ranh giới con người (Human loop - 20%)**: Partial Một phần
  * **Khớp yêu cầu đề bài (Spec test - 20%)**: Gap Thiếu
  * **Phương pháp kiểm chứng (Method - 20%)**: Partial Một phần

---

### 1. BÀI TOÁN & GIẢI PHÁP CỦA ĐỘI (WHAT THEY BUILT)
Sự cố chất lượng trong sản xuất theo chuẩn công nghiệp 8D — từ lập đội, ngăn chặn tạm thời, phân tích nguyên nhân gốc, hành động khắc phục đến đóng ca — kèm thư viện tiền lệ xếp hạng lại các sự cố tương tự trong quá khứ.

---

### 2. GÓC NHÌN DOANH NGHIỆP & CHỖ ĐỨNG TRONG TỔ CHỨC THỰC TẾ
* **Định giá tiềm năng**: Mức **Cao**
* **Phân tích giá trị kinh doanh**:
Đây là bài toán giá trị cao nhất ở đây mà thể thức cuộc thi không nhìn thấy được. Báo cáo 8D là yêu cầu bắt buộc trong hợp đồng với khách hàng ngành ô tô và điện tử, Việt Nam có nền tảng nhà cung ứng khổng lồ phục vụ đúng nhóm khách đó, và kỹ sư thường xuyên phân tích lại nguyên nhân gốc mà ai đó đã làm xong từ hai năm trước. Tra cứu tiền lệ qua các sự cố cũ đáng tiền thật với một quản lý chất lượng. Vấn đề là không điều nào trong đó hiện ra trong tám phút. Hãy làm bản hướng dẫn từng bước, và pitch cho khán giả ngành sản xuất thay vì khán giả chung.

---

### 3. ĐIỂM SÁNG NỔI BẬT (STRENGTHS)
Đây là khối lượng kỹ thuật lớn nhất cuộc thi, hơn hẳn phần còn lại: hơn bốn mươi file kiểm thử, một động cơ đồ thị, xếp hạng tiền lệ theo ngữ nghĩa, và một cấu hình Docker chạy được. Bạn chọn lĩnh vực khó nhất ở đây và làm nó xứng đáng.

---

### 4. MỘT RÀO CẢN BẮT BUỘC PHẢI SỬA (CRITICAL FIX)
> *Điểm nghẽn kỹ thuật/nghiệp vụ lớn nhất cần giải quyết ngay:*

Yêu cầu trung tâm của đề bài gần như vắng mặt. Các chốt của bạn kiểm soát thứ tự bước, không phải kiểu dừng. Không có gì phân loại một lần dừng là nghi vấn dữ kiện, vi phạm quy định hay giới hạn thẩm quyền. Hãy biến quyết định đó thành một bước riêng, hiện rõ.

---

### 5. KẾ HOẠCH HÀNH ĐỘNG ƯU TIÊN CHO SPRINT 2 (ACTION ITEMS)
1. Thêm bước phân loại kiểu báo lên như một bước chính thức trong luồng 8D.
2. Làm một bản hướng dẫn từng bước bấm một lần là chạy — giám khảo có tám phút và không thể nắm 8D theo cách khác.
3. Giữ phương án tra cứu bằng văn bản khi dịch vụ vector không sẵn sàng.
4. Đo tỷ lệ báo lên sai.

---

### 6. ĐỐI CHIẾU TIÊU CHUẨN KỸ THUẬT ĐỀ BÀI (SPEC COMPLIANCE CHECKLIST)
| Tiêu chí đối chiếu | Kết quả đánh giá |
| :--- | :--- |
| **Tài liệu quy định (Policy doc)** | Partial / Một phần |
| **Bộ dữ liệu thử nội bộ (Test set)** | Partial / Một phần |
| **Ba kiểu dừng riêng biệt (Three stops)** | Partial / Một phần |
| **Câu hỏi báo lên cụ thể (Specific question)** | Yes / Đạt |
| **Không bao giờ đoán bừa (No confident guess)** | Yes / Đạt |
| **Không báo lên thừa (No over-escalation)** | Partial / Một phần |
| **Đường dẫn chạy trực tiếp (Live URL)** | No / Chưa |
| **Lệnh chạy kiểm chứng (Verify run)** | Yes / Đạt |
| **Kho mã nguồn sạch (Repo clean)** | No / Chưa |

* **Ghi chú đối chiếu**: Quy định và thẩm quyền tách đúng; thiếu kiểu dừng về dữ kiện. P0 — đã commit node_modules.
* **Nhận xét tổng kết kỹ thuật**: Khối lượng kỹ thuật lớn nhất cuộc thi — hơn bốn mươi file test, động cơ đồ thị, xếp hạng tiền lệ, sẵn Docker. Nhưng các chốt 8D kiểm soát thứ tự bước, không phải kiểu dừng. Yêu cầu cốt lõi của đề bài gần như vắng mặt, và độ phức tạp khiến nó vô hình trong cửa sổ tám phút.
