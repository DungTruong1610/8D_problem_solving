# 🚀 HACKATHON ACTION PLAN: 8D COPILOT (CNMA PRORESOLVE)

**Cuộc thi:** MLAI Hackathon 2026 — Bảng 1: OrganizationAI
**Đơn vị chủ trì:** HCMUT × HUTECH × VNG
**Mục tiêu tài liệu:** Định hướng chiến lược, phân tích bài toán, làm rõ các điểm nghẽn kỹ thuật trong mã nguồn hiện tại và phân công nhiệm vụ cụ thể để đưa dự án ra thi đấu bên ngoài công ty với **chi phí 0 đồng**.

> [!NOTE]
> **Cập nhật 21/09/2026:** Tài liệu này là kế hoạch chiến lược ban đầu và vẫn đúng về định hướng. Riêng phần **cổng AI đã thay đổi**: thay vì Google Gemini, bản deploy dùng **DeepSeek V4.1 Flash** cho chat và **Jina AI** cho vector embedding (DeepSeek không có API embedding). Chi tiết cấu hình mới nhất nằm ở [KE_HOACH_CHUYEN_DOI_CONG_NGHE_FREE.md](file:///d:/GitHub/8D_Hackathon/docs/KE_HOACH_CHUYEN_DOI_CONG_NGHE_FREE.md), Hạng Mục 4.

---

## 1. PHÂN TÍCH ĐỀ BÀI CỦA BAN TỔ CHỨC & LỰA CHỌN CHIẾN LƯỢC

### 1.1. Tinh thần cốt lõi của đề bài

Đề bài Bảng 1 (*OrganizationAI*) không tìm kiếm các chatbot trả lời chung chung, mà yêu cầu:

> *"Xây dựng hệ thống AI thực hiện công việc thực tế trong tổ chức và đảm bảo trách nhiệm giải trình (accountability), minh bạch, con người giữ quyền quyết định (Human-in-the-loop) và đo lường được tác động thực tế."*

### 1.2. Lựa chọn: Đề bài B — Tái cấu trúc toàn bộ quy trình (The Whole Workflow)

Ban tổ chức cho chọn 1 trong 3 đề bài (A, B, C). Chúng ta chọn **Đề bài B** vì đây là thế mạnh tự nhiên và toàn diện nhất của dự án:

* **Tại sao 8D là đề tài "vũ khí đặc biệt" (Unfair Advantage)?**
  - Đa số các đội sinh viên sẽ chọn các bài toán đơn giản như: *chatbot phòng đào tạo, xin nghỉ phép, mượn trả thiết bị trường học, đặt phòng họp...*
  - Dự án của chúng ta giải quyết bài toán **Sự cố chất lượng nhà máy sản xuất (Defect Management)** theo quy trình chuẩn công nghiệp quốc tế **8D (8 Disciplines)** — chuẩn bắt buộc trong ngành ô tô, cơ khí, điện tử (ISO/IATF 16949).
  - Ban giám khảo có chuyên gia quản trị tổ chức và chuyên gia triển khai thực tế trong doanh nghiệp $\rightarrow$ Đề tài 8D có **tính ứng dụng và chiều sâu thực tế vượt trội**.
* **Đáp ứng trọn vẹn tiêu chí Đề bài B:**
  - **Sơ đồ Trước/Sau (Before vs After):** Đo lường cụ thể thời gian xử lý sự cố giảm từ **48–72 giờ xuống còn 30–45 phút**.
  - **Tái cấu trúc luồng công việc:** Không phải gắn chatbot vào form, mà là một pipeline tự động phân tích $\rightarrow$ đối chiếu dữ liệu đối sánh (Is/Is-Not) $\rightarrow$ chẩn đoán mù độc lập $\rightarrow$ tra cứu tiền lệ tương đồng $\rightarrow$ soạn thảo dự thảo D1–D8.
  - **Human-in-the-loop rõ ràng:** Kỹ sư chất lượng (QE) và Quản lý chất lượng giữ quyền rà soát, phản biện và ký duyệt tại từng chốt chặn.

---

## 2. BÀI TOÁN 8D & HỆ THỐNG PRORESOLVE ĐANG GIẢI QUYẾT NHƯ THẾ NÀO?

### 2.1. 8D là gì?

8D (Eight Disciplines) là phương pháp giải quyết sự cố chất lượng gồm 8 bước tiêu chuẩn:

* **D1:** Thành lập đội ngũ chuyên trách
* **D2:** Mô tả vấn đề (Hiện tượng, phân tích đối sánh Is / Is-Not)
* **D3:** Hành động ngăn chặn tạm thời (Containment)
* **D4:** Xác định nguyên nhân gốc rễ (5-Why, Ishikawa/Fishbone)
* **D5:** Chọn lựa giải pháp khắc phục vĩnh viễn
* **D6:** Thực thi và thẩm định giải pháp
* **D7:** Phòng ngừa tái diễn (Cập nhật quy trình, FMEA)
* **D8:** Đóng case và ghi nhận công sức đội ngũ

### 2.2. Proresolve (8D Copilot) giải quyết thế nào?

Hệ thống tiếp nhận hồ sơ sự cố chất lượng (chuẩn SAP QM `QMEL`) dưới dạng JSON sâu (gồm mã lỗi, vật tư, lô hàng, trạm máy, kết quả đo kiểm, chi phí chất lượng COPQ):

1. **Enrich Context:** Tự động bóc tách thông số kỹ thuật, phát hiện lỗ hổng dữ liệu.
2. **Blind Diagnosis (Chẩn đoán mù độc lập — Điểm nhấn sáng tạo):** Hệ thống **cắt bỏ toàn bộ nhận định của kỹ sư** (chuỗi 5-Why, Ishikawa), yêu cầu AI tự tư duy độc lập để tìm nguyên nhân gốc. Sau đó so sánh xem nhận định của AI và Kỹ sư có đồng thuận hay không $\rightarrow$ Giúp kỹ sư tránh thiên kiến xác nhận (Confirmation Bias).
3. **Precedent Search (Tìm kiếm tiền lệ có trọng số):** Tra cứu kho dữ liệu sự cố quá khứ để tìm giải pháp đã từng thành công. Nếu điểm tương đồng $< 3$ điểm, hệ thống từ chối bịa đặt và báo *"Không tìm thấy tiền lệ"*.
4. **Drafting D1–D8 & Phân tách báo cáo:** Tự động dự thảo từng bước kèm trích dẫn chứng từ nguồn (Citation), sinh song song 2 bản tóm tắt:
   - **Internal Summary:** Dành cho nội bộ (chứa thông tin thiết bị, người vận hành).
   - **Customer Summary:** Gửi khách hàng (tự động loại bỏ thông tin nhạy cảm).

---

## 3. CÁC ĐIỂM NGHẼN (PAIN POINTS) TRONG SOURCE CODE HIỆN TẠI

Source code hiện tại được phát triển cho môi trường nội bộ doanh nghiệp trên nền tảng **SAP BTP**, dẫn đến các rào cản nghiêm trọng khi mang ra thi đấu bên ngoài:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      HIỆN TRẠNG PHỤ THUỘC NỘI BỘ (CẦN GỠ BỎ)                     │
├───────────────────────┬─────────────────────────────────────────────────────────┤
│ Thành phần            │ Vấn đề khi mang ra Hackathon                            │
├───────────────────────┼─────────────────────────────────────────────────────────┤
│ 1. SAP BTP Cockpit    │ Hạ tầng cloud nội bộ, yêu cầu tài khoản doanh nghiệp.   │
│ 2. SAP HANA Cloud     │ CSDL trả phí đắt đỏ của SAP, không thể cấp quyền ngoài. │
│ 3. SAP AI Core        │ Tiêu tốn BTP credit công ty, cấu hình binding phức tạp. │
│ 4. SAP XSUAA Auth     │ Bắt đăng nhập SAP ID ➔ Vi phạm luật "No Login" của BTC.  │
│ 5. Gói `@cnma/*`      │ Lưu trên Azure Artifacts riêng ➔ Người ngoài clone repo  │
│                       │ về sẽ bị lỗi E401/npm install thất bại.                 │
└───────────────────────┴─────────────────────────────────────────────────────────┘
```

👉 **Mục tiêu Rework Backend:**
Decouple (tách rời) toàn bộ các phụ thuộc vào SAP BTP và tài nguyên công ty. Chuyển đổi thành một hệ thống **độc lập (Standalone), 100% mã nguồn mở/miễn phí**, người ngoài clone về có thể chạy ngay bằng 1 lệnh mà không cần tài khoản nội bộ hay tốn bất kỳ chi phí nào.

---

## 4. DANH SÁCH DỊCH VỤ THAY THẾ (CAM KẾT 100% MIỄN PHÍ — ZERO COST)

Chúng ta **tuyệt đối không dùng công nghệ trả phí**. Bảng kiến trúc thay thế tối ưu:

| Thành phần             | Công nghệ cũ (Nội bộ) | Công nghệ mới (Hackathon)                    | Chi phí      | Lý do lựa chọn                                                                                                                                                            |
| :----------------------- | :------------------------- | :---------------------------------------------- | :------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend Host**  | BTP HTML5 App Repo         | **Vercel** (Hobby Plan)                   | **0đ** | Deploy trong 1 phút từ GitHub, CDN toàn cầu siêu nhanh, uptime 99.9%.                                                                                                   |
| **Backend Host**   | BTP Cloud Foundry          | **Render.com** hoặc **Railway**    | **0đ** | Chạy Node.js persistent server.**Không dùng Vercel cho Backend** vì Vercel Serverless bị timeout 10–15s (trong khi AI reasoning chạy 20–40s sẽ bị lỗi 504). |
| **Database**       | SAP HANA Cloud             | **SQLite (`db.sqlite`)**                | **0đ** | Đóng gói sẵn file`db.sqlite` kèm source code. Chạy in-memory, query siêu tốc, 0 cấu hình, không tốn tiền server DB.                                           |
| **Authentication** | SAP XSUAA (OAuth2)         | **Public Access (Mock Auth)**             | **0đ** | Bỏ cơ chế login, cho phép giám khảo vào thẳng URL theo đúng tiêu chuẩn đề bài (10 điểm vận hành).                                                         |
| **AI LLM Gateway** | SAP AI Core (GenAI Hub)    | **DeepSeek V4.1 Flash** (chuẩn OpenAI) | Trả theo token | Bỏ 2 tầng proxy BTP, hỗ trợ thinking mode / tool calls / JSON output. Chạy được qua OpenCode Go, OpenCode Zen hoặc DeepSeek Platform — xem Hạng Mục 4 của kế hoạch chuyển đổi. |
| **Vector Embedding** | HANA Vector + embedding của AI Core | **Jina AI Embeddings** (`jina-embeddings-v5-text-small`) | **0đ** (free tier) | DeepSeek không có API embedding; Jina là nguồn vector thay thế, endpoint chuẩn OpenAI. |
| **Vector Search**  | HANA Vector Engine         | **In-memory Cosine Similarity**           | **0đ** | Tính khoảng cách vector trực tiếp bằng TypeScript trong RAM của Node.js (tốc độ < 10ms cho vài trăm case).                                                       |

---

## 5. PHƯƠNG ÁN REWORK PHẦN AI ENGINE & ĐÁNH GIÁ HIỆU QUẢ

### 5.1. Bản chất của SAP AI Core và cơ hội của chúng ta

SAP AI Core thực chất **không tự tạo model riêng**; nó chỉ là cổng proxy bọc ngoài model của nhiều nhà cung cấp (Google, Anthropic, OpenAI…).
Do đó, khi bỏ SAP AI Core để gọi trực tiếp nhà cung cấp model, chúng ta **vẫn dùng chính xác những "bộ não" AI đó**, không hề bị giảm chất lượng!

### 5.2. Rework code phần AI như thế nào?

Kiến trúc codebase hiện tại ở file `srv/src/core/ai/llmClient.ts` đã được thiết kế sẵn mẫu **Provider Pattern** với hàm `setLlmProvider(...)`. Bản deploy hiện tại đã có sẵn ba provider:

```typescript
// srv/src/core/ai/providerFactory.ts — chọn provider theo biến môi trường
ensureLlmProvider()
  ├── chat      : DeepSeek  →  Gemini  →  LLM local  →  SAP AI Core (mặc định của CDK)
  └── embedding : Jina / EMBEDDING_*  →  Gemini  →  (không có)
```

* `deepseekProvider.ts` — chat qua endpoint chuẩn OpenAI (`/chat/completions`), hỗ trợ JSON output, tool calls và thinking mode.
* `openAiEmbeddingProvider.ts` — vector nhúng qua Jina AI (hoặc mọi API `EMBEDDING_*` chuẩn OpenAI).
* `compositeLlmProvider.ts` — ghép hai nửa khi chat và embedding khác nhà cung cấp.

**Các bước triển khai thực tế:**

1. Không cần cài SDK mới — DeepSeek và Jina đều nói HTTP chuẩn OpenAI.
2. Điền `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`, `JINA_API_KEY` vào `.env`.
3. Chạy `npx tsx scripts/probe-ai.ts` để xác nhận trước khi deploy.

### 5.3. Có đạt hiệu quả 100% như bây giờ không?

**ĐẠT 100%, THẬM CHÍ CÒN TỐT HƠN VÀ ỔN ĐỊNH HƠN:**

1. **Giữ nguyên 100% Logic nghiệp vụ:** Toàn bộ prompt kỹ thuật D1–D8, Chain-of-thought, bảng so sánh Blind Diagnosis, phân tích Is/Is-Not đều giữ nguyên vẹn.
2. **Thinking Budget được bảo toàn:** DeepSeek V4.1 Flash hỗ trợ thinking mode (`reasoning_effort: low/high/max`), ánh xạ từ `thinkingBudget` của app; mặc định tắt để giữ tốc độ cho pipeline 8 bước.
3. **Tốc độ nhanh hơn:** Gọi trực tiếp nhà cung cấp, bỏ qua 2 tầng trung gian của BTP.
4. **Không lo sập do hết Quota công ty:** Hoàn toàn chủ động với API key độc lập.
5. **Một điểm cần lưu ý:** DeepSeek không có API embedding, nên vector ngữ nghĩa phải đi qua Jina AI — thiếu key embedding thì app vẫn chạy nhưng tiêu chí "Similar description" im lặng cho 0 điểm.

---

## 6. PHÂN CÔNG NHIỆM VỤ SPRINT 1 (72H) CHO CẢ TEAM

Mục tiêu Sprint 1: Hoàn tất 6 hạng mục bắt buộc của BTC (Live URL, Verify Harness, Public Repo, 5 Slide, Video 3 phút, Build log).

| Thành viên                           | Trách nhiệm chính                         | Chi tiết đầu việc                                                                                                                                                                                                                                                                                                     |
| :------------------------------------- | :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Member 1 (Backend Lead)**      | Rework AI Adapter & 11471Decouple BTP        | - Viết`standaloneLlmProvider.ts` gọi Gemini API.- Cấu hình DB profile dùng SQLite (`db.sqlite`) mặc định.- Gỡ bỏ các dependency `@cnma/*` nội bộ để repo sạch, `npm install` chạy mượt.                                                                                                        |
| **Member 2 (Test & QA Lead)**    | Xây dựng bộ**Verify Harness (90s)** | - Tạo module/nút bấm**Verify** trên UI theo đúng tiêu chí Mục 3.b đề bài.- Chạy 4 test case mẫu (1 case Pass, 1 case Flag do chẩn đoán lệch, 1 case thiếu dữ liệu trả về N/A, 1 case không tiền lệ trả về Reject).- In bảng kết quả Pass/Fail kèm timestamp thực.                  |
| **Member 3 (Frontend & DevOps)** | Triển khai Live URL                         | - Deploy Frontend React lên Vercel.- Deploy Backend Node.js lên Render.com (hoặc Railway).- Thiết lập banner hướng dẫn trên trang chủ:*"Chọn case 8D-10048651 và bấm Start Analysis"* (đảm bảo giám khảo test trong 60s không cần hỏi ai).                                                         |
| **Member 4 (Product & Slide)**   | 5 Slide chuẩn & Đo lường thực tế       | - Soạn đúng 5 slide theo format bắt buộc tại Mục 3.e đề bài.- Vẽ sơ đồ Before/After (thời gian xử lý từ 72h ➔ 35 phút).- Thu thập phát biểu thực tế từ 3 nhân sự (QE, QA Manager, Maintenance) và làm rõ 1 điểm bất cập mới (sự ỷ lại nhận thức).- Quay video demo mộc 3 phút. |

---

## 7. KẾT LUẬN

Chúng ta đang sở hữu một sản phẩm có **chiều sâu kỹ thuật và giá trị thực tế hàng đầu cuộc thi**. Việc tách rời khỏi hạ tầng SAP BTP nội bộ để chuyển sang kiến trúc Standalone mã nguồn mở + SQLite + Gemini API miễn phí là bước đi bắt buộc và đúng đắn nhất: vừa bảo vệ tuyệt đối dữ liệu doanh nghiệp, vừa tối ưu hóa 100% cho tiêu chí chấm thi của Ban tổ chức.

Cả team cùng bám sát kế hoạch này để triển khai Sprint 1! 🚀
