# 🚀 HACKATHON ACTION PLAN: 8D COPILOT (CNMA PRORESOLVE)

**Cuộc thi:** MLAI Hackathon 2026 — Bảng 1: OrganizationAI
**Đơn vị chủ trì:** HCMUT × HUTECH × VNG
**Mục tiêu tài liệu:** Định hướng chiến lược, phân tích bài toán, làm rõ các điểm nghẽn kỹ thuật trong mã nguồn hiện tại và phân công nhiệm vụ cụ thể để đưa dự án ra thi đấu bên ngoài công ty với **chi phí 0 đồng**.

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

Hệ thống tiếp nhận hồ sơ sự cố chất lượng (chuẩn QM `QMEL`) dưới dạng JSON sâu (gồm mã lỗi, vật tư, lô hàng, trạm máy, kết quả đo kiểm, chi phí chất lượng COPQ):

1. **Enrich Context:** Tự động bóc tách thông số kỹ thuật, phát hiện lỗ hổng dữ liệu.
2. **Blind Diagnosis (Chẩn đoán mù độc lập — Điểm nhấn sáng tạo):** Hệ thống **cắt bỏ toàn bộ nhận định của kỹ sư** (chuỗi 5-Why, Ishikawa), yêu cầu AI tự tư duy độc lập để tìm nguyên nhân gốc. Sau đó so sánh xem nhận định của AI và Kỹ sư có đồng thuận hay không $\rightarrow$ Giúp kỹ sư tránh thiên kiến xác nhận (Confirmation Bias).
3. **Precedent Search (Tìm kiếm tiền lệ có trọng số):** Tra cứu kho dữ liệu sự cố quá khứ để tìm giải pháp đã từng thành công. Nếu điểm tương đồng $< 3$ điểm, hệ thống từ chối bịa đặt và báo *"Không tìm thấy tiền lệ"*.
4. **Drafting D1–D8 & Phân tách báo cáo:** Tự động dự thảo từng bước kèm trích dẫn chứng từ nguồn (Citation), sinh song song 2 bản tóm tắt:
   - **Internal Summary:** Dành cho nội bộ (chứa thông tin thiết bị, người vận hành).
   - **Customer Summary:** Gửi khách hàng (tự động loại bỏ thông tin nhạy cảm).

---

## 3. CÁC ĐIỂM NGHẼN (PAIN POINTS) TRONG SOURCE CODE HIỆN TẠI

Source code ban đầu được phát triển cho môi trường nội bộ doanh nghiệp trên nền tảng Cloud đóng kín, dẫn đến các rào cản nghiêm trọng khi mang ra thi đấu bên ngoài:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      HIỆN TRẠNG PHỤ THUỘC NỘI BỘ (CẦN GỠ BỎ)                     │
├───────────────────────┬─────────────────────────────────────────────────────────┤
│ Thành phần            │ Vấn đề khi mang ra Hackathon                            │
├───────────────────────┼─────────────────────────────────────────────────────────┤
│ 1. Cloud Cockpit      │ Hạ tầng cloud nội bộ, yêu cầu tài khoản doanh nghiệp.   │
│ 2. Enterprise DB      │ CSDL trả phí đắt đỏ, không thể cấp quyền ngoài.         │
│ 3. AI Gateway cũ      │ Tiêu tốn credit công ty, cấu hình binding phức tạp.     │
│ 4. Enterprise Auth    │ Bắt đăng nhập tài khoản riêng ➔ Vi phạm luật "No Login". │
│ 5. Gói `@cnma/*`      │ Lưu trên Azure Artifacts riêng ➔ Người ngoài clone repo  │
│                       │ về sẽ bị lỗi E401/npm install thất bại.                 │
└───────────────────────┴─────────────────────────────────────────────────────────┘
```

👉 **Mục tiêu Rework Backend:**
Decouple (tách rời) toàn bộ các phụ thuộc vào hạ tầng cloud nội bộ đóng kín. Chuyển đổi thành một hệ thống **độc lập (Standalone), 100% mã nguồn mở/miễn phí**, người ngoài clone về có thể chạy ngay bằng 1 lệnh mà không cần tài khoản nội bộ hay tốn bất kỳ chi phí nào.

---

## 4. DANH SÁCH DỊCH VỤ THAY THẾ (CAM KẾT 100% MIỄN PHÍ — ZERO COST)

Chúng ta **tuyệt đối không dùng công nghệ trả phí**. Bảng kiến trúc thay thế tối ưu:

| Thành phần             | Công nghệ cũ (Nội bộ)      | Công nghệ mới (Hackathon)                    | Chi phí      | Lý do lựa chọn                                                                                                                                                            |
| :----------------------- | :------------------------- | :---------------------------------------------- | :------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend Host**  | Private App Repo           | **Vercel** (Hobby Plan)                   | **0đ** | Deploy trong 1 phút từ GitHub, CDN toàn cầu siêu nhanh, uptime 99.9%.                                                                                                   |
| **Backend Host**   | Cloud Foundry              | **Render.com** hoặc **Railway**    | **0đ** | Chạy Node.js persistent server.**Không dùng Vercel cho Backend** vì Vercel Serverless bị timeout 10–15s (trong khi AI reasoning chạy 20–40s sẽ bị lỗi 504). |
| **Database**       | Enterprise Cloud DB        | **SQLite (`db.sqlite`)**                | **0đ** | Đóng gói sẵn file`db.sqlite` kèm source code. Chạy in-memory, query siêu tốc, 0 cấu hình, không tốn tiền server DB.                                           |
| **Authentication** | Enterprise Auth (OAuth2)   | **Public Access (Mock Auth)**             | **0đ** | Bỏ cơ chế login, cho phép giám khảo vào thẳng URL theo đúng tiêu chuẩn đề bài (10 điểm vận hành).                                                         |
| **AI LLM Gateway** | Enterprise AI Gateway      | **Google Gemini API** (`@google/genai`) | **0đ** | Gói Free Tier miễn phí 15 RPM, hỗ trợ suy luận Thinking Budget, tốc độ cực nhanh.                                                                                  |
| **Vector Search**  | Cloud Vector Engine        | **In-memory Cosine Similarity**           | **0đ** | Tính khoảng cách vector trực tiếp bằng TypeScript trong RAM của Node.js (tốc độ < 10ms cho vài trăm case).                                                       |

---

## 5. PHƯƠNG ÁN REWORK PHẦN AI ENGINE & ĐÁNH GIÁ HIỆU QUẢ

### 5.1. Bản chất của các Gateway AI doanh nghiệp và cơ hội của chúng ta

Các Gateway AI doanh nghiệp thực chất **không tự tạo model riêng**; nó chỉ là cổng proxy bọc ngoài các model của Google (Gemini) và OpenAI (GPT-4o).
Do đó, khi gọi trực tiếp vào Google Gemini API, chúng ta **vẫn dùng chính xác những "bộ não" AI đó**, không hề bị giảm chất lượng!

### 5.2. Rework code phần AI như thế nào?

May mắn là kiến trúc codebase hiện tại ở file `srv/src/core/ai/llmClient.ts` đã được thiết kế sẵn mẫu **Provider Pattern** với hàm `setLlmProvider(...)`:

```typescript
// Chỉ cần viết 1 file adapter mới: standaloneLlmProvider.ts (~60 dòng code)
import { GoogleGenAI } from '@google/genai';

export function initStandaloneAI() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  setLlmProvider({
    name: 'gemini-standalone',
    async complete(messages, config) {
      // Gọi gemini-2.5-flash hoặc gemini-2.5-pro kèm thinkingBudget
    },
    async completeWithTools(messages, tools, config) { ... },
    async embed(text) {
      // Gọi text-embedding-004 của Google
    },
    async batchEmbed(texts) { ... }
  });
}
```

* **Các bước triển khai:**
  1. Thêm gói thư viện chuẩn: `npm install @google/genai dotenv`.
  2. Tạo adapter `standaloneLlmProvider.ts` cắm vào `setLlmProvider` khi khởi động server.
  3. Gỡ bỏ việc import các package phụ thuộc gateway nội bộ.
  4. Đưa `GEMINI_API_KEY` vào file `.env`.

### 5.3. Có đạt hiệu quả 100% như bây giờ không?

**ĐẠT 100%, THẬM CHÍ CÒN TỐT HƠN VÀ ỔN ĐỊNH HƠN:**

1. **Giữ nguyên 100% Logic nghiệp vụ:** Toàn bộ prompt kỹ thuật D1–D8, Chain-of-thought, bảng so sánh Blind Diagnosis, phân tích Is/Is-Not đều giữ nguyên vẹn.
2. **Thinking Budget được bảo toàn:** Gemini 2.5 Flash và Pro hỗ trợ nguyên bản cơ chế Extended Thinking (suy luận sâu), y hệt cấu hình hiện tại.
3. **Tốc độ nhanh gấp đôi:** Gọi trực tiếp Google API bỏ qua 2 tầng trung gian của BTP, giúp thời gian phản hồi giảm từ ~40s xuống ~15–20s.
4. **Không lo sập do hết Quota công ty:** Hoàn toàn chủ động với API key độc lập, đồng thời sẵn sàng cắm OpenAI Credit do BTC tài trợ ở Sprint 2.

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

Chúng ta đang sở hữu một sản phẩm có **chiều sâu kỹ thuật và giá trị thực tế hàng đầu cuộc thi**. Việc tách rời khỏi hạ tầng cloud nội bộ trước đây để chuyển sang kiến trúc Standalone mã nguồn mở + SQLite + Gemini API miễn phí là bước đi bắt buộc và đúng đắn nhất: vừa bảo vệ tuyệt đối dữ liệu doanh nghiệp, vừa tối ưu hóa 100% cho tiêu chí chấm thi của Ban tổ chức.

Cả team cùng bám sát kế hoạch này để triển khai Sprint 1! 🚀
