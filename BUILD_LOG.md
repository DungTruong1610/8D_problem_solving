# NHẬT KÝ PHÁT TRIỂN (BUILD LOG) — 8D COPILOT
**Đội thi:** UIT_4Lovpe | **Hệ thống:** 8D Incident & Quality Assurance Referee | **Quy chuẩn:** Báo cáo 1 trang A4

---

### 1. Công cụ AI sử dụng & Phương thức áp dụng
* **Công cụ phát triển (Dev Tooling):** Cursor & Antigravity (Claude 3.5 Sonnet) hỗ trợ scaffold kiến trúc Backend SAP Cloud Application Programming (CAP), sinh OData handlers và hơn 40 tệp kiểm thử tự động (`__tests__/`).
* **Lõi vận hành (Runtime AI):**
  * *DeepSeek-V3 (API chính) & Google Gemini (dự phòng):* Trích xuất thông số đo kiểm, suy luận logic 8 bước (D1–D8), dựng cây 6M Ishikawa và chuỗi 5-Why.
  * *Jina Embeddings v3:* Vector hóa triệu chứng lỗi để tìm kiếm tiền lệ lịch sử (Precedent Retrieval).
  * *Mock LLM:* Kiểm thử nội bộ phục vụ CI/CD tự động không phụ thuộc mạng bên ngoài.
* **Phương thức áp dụng:**
  * *In-Context Learning có ràng buộc (Constrained Schema):* Ép cấu trúc đầu ra bằng JSON Schema nghiêm ngặt (`schema dictionary`), ràng buộc với Master Data nhà máy (vật tư `MAT-10247`, tổ máy `WC-MILL-07`, danh bạ nhân sự).
  * *Hybrid RAG & AI Referee:* Kết hợp tìm kiếm vector cosine với lọc thuộc tính 6M (`reranker.ts`). AI vận hành cơ chế **Chẩn đoán mù (Blind Diagnosis)** dựa trên số liệu đo kiểm thực tế (First-Principles) để đối chứng và phản biện thiên kiến con người.

---

### 2. Những điểm công cụ mang lại hiệu quả thực tế
* **Tiết kiệm 85–90% thời gian:** Rút ngắn thời gian thu thập dữ liệu và dựng khung phân tích sơ bộ từ 2–4 giờ thủ công xuống còn **15–30 giây**, kích hoạt biện pháp khoanh vùng (D3) ngay trong ca sản xuất.
* **Xử lý xuất sắc dữ liệu thô bị bẩn (`mock-data/dirty/`):** Tự động chuẩn hóa số đo, dung sai, đơn vị từ các thông báo lỗi SAP QM tiếng Đức viết tắt mà regex truyền thống không xử lý được.
* **Phản biện khách quan định kiến con người (Case `TC-02`):** Bác bỏ nhận định cảm tính của kỹ sư (đổ lỗi công nhân - Man) khi phân tích số liệu áp lực thủy lực đồ gá F1 chỉ ra nguyên nhân gốc là thiết bị (Machine).
* **Tốc độ triển khai thần tốc:** Hoàn thiện toàn bộ hệ thống Enterprise full-stack, tích hợp Verify Harness 90s và tài liệu kiểm định chỉ trong vòng 1 tuần.

---

### 3. Những điểm gây phát sinh chi phí & thời gian ngoài dự kiến
* **Ảo giác thực thể dữ liệu gốc (Entity Hallucination):** LLM ban đầu tự suy diễn mã vật tư lạ (`BAT-9000`) và tên nhân sự ảo. Đội ngũ mất 2 ngày xây dựng bộ kiểm định `datasetValidator.ts` và seed danh bạ nhân sự thực tế.
* **Độ trễ và Timeout khi gọi chuỗi tuần tự:** Gọi LLM liên tục qua 8 bước mất 40–90 giây, gây lỗi timeout (10s) trên Vercel Serverless. Nhóm phải chia pipeline thành 4 chặng độc lập, bổ sung bộ nhớ đệm cache reranker (`8311bf4`).
* **Phân mảnh nhà cung cấp dịch vụ:** DeepSeek không có endpoint embedding native, buộc tích hợp thêm Jina API, làm tăng độ phức tạp trong quản lý khóa xác thực, xử lý lỗi mạng kép và cân bằng hạn mức truy cập.

---

### 4. Quyết định cắt giảm tính năng & Lý do đánh đổi
* **Cắt giảm Cụm Đồ thị Độc lập (Neo4j / pgvector) chuyển sang In-Process SQLite Graph + Vector Search:**
  * *Lý do:* Cụm Neo4j/pgvector tiêu tốn trên 2GB RAM, dễ làm sập môi trường Cloud (Render/Vercel) trong thời gian chấm thi. Chuyển sang SQLite in-process kết hợp vector hóa nội bộ giúp hệ thống khởi động tức thì, độ trễ truy vấn giảm xuống **< 200ms**, đáp ứng 100% mục tiêu nghiệp vụ với chi phí vận hành bằng 0.
* **Cắt giảm cơ chế Tự động phê duyệt & Đóng ca (Full Auto-Approval):**
  * *Lý do:* Tuân thủ nghiêm ngặt tiêu chuẩn an toàn công nghiệp ô tô (IATF 16949 / VDA 6.3) và tiêu chí *Human-in-the-loop*. Quyết định cách ly lô hàng (D3) hay kết luận trách nhiệm pháp lý bắt buộc phải do Kỹ sư trưởng ký duyệt. Hệ thống đã đưa vào các điểm dừng bắt buộc (**Stop Conditions**) và nhật ký kiểm toán (**Audit Trail**), định vị AI thuần túy ở vai trò Trợ lý (Copilot) & Trọng tài phản biện (Referee).
