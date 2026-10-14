# ĐÁNH GIÁ KỸ THUẬT SPRINT 1 — BAN GIÁM KHẢO HACKATHON

---

# Team UIT_4Lovpe (Dự án: 8D Incident Referee)

---

## 1. What the Team Built

Nhóm **UIT_4Lovpe** xây dựng **8D Incident & Quality Assurance Referee** — hệ thống trọng tài điều phối và thẩm định quy trình giải quyết sự cố kỹ thuật và quản lý chất lượng theo tiêu chuẩn công nghiệp 8D (Eight Disciplines of Problem Solving - chuẩn quốc tế ngành sản xuất & ô tô):
* **Quy Trình 8 Bước Khép Kín (Full 8D Discipline Cycle)**:
  * D1: Thành lập đội đặc nhiệm (Team Formation).
  * D2: Mô tả sự cố chi tiết theo ma trận IS / IS-NOT (`isIsNot.ts`).
  * D3: Hành động ngăn chặn tạm thời (Containment Action).
  * D4: Phân tích nguyên nhân gốc rễ (Root Cause Analysis).
  * D5: Lựa chọn hành động khắc phục vĩnh viễn (Corrective Action).
  * D6: Triển khai và xác thực giải pháp.
  * D7: Hành động phòng ngừa tái diễn trong toàn hệ thống.
  * D8: Đóng ca và ghi nhận công trạng.
* **Động Cơ Đồ Thị Sự Cố & Tiền Lệ (Graph Engine & Precedent Library)**: Tích hợp công nghệ đồ thị tri thức (`graph/engine.ts`) và thư viện tiền lệ sự cố tương tự (`precedent/findPrecedents.ts`) sử dụng reranker và scoring ngữ nghĩa để hỗ trợ kỹ sư tìm kiếm giải pháp đã từng xử lý thành công trong quá khứ.
* **Bộ Khung Tiêu Chuẩn Doanh Nghiệp Lớn (SAP Cloud Application Programming Model - CAP)**: Sử dụng các quy chuẩn thiết kế phần mềm doanh nghiệp cấp độ ERP (`.cdsrc.json`), sẵn sàng tích hợp vào dây chuyền sản xuất công nghiệp quy mô lớn.

---

## 2. Architecture

Kiến trúc chuẩn Enterprise SAP CAP / Node.js kết hợp Graph & Vector Search:

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Web Presentation / Quality Engineer Dashboard                                           │
│   ├── Giao diện quản lý phiếu sự cố 8D & Phân tích ma trận IS / IS-NOT                  │
│   ├── Bảng gợi ý tiền lệ tương tự (Precedent Recommendation & Semantic Scoring)         │
│   └── Bảng theo dõi tiến độ từng bước D1 -> D8 và nhật ký hành động                     │
└──────────────────────────┬──────────────────────────────────────────────────────────────┘
                           │ HTTP REST / OData Services (srv/)
                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ 8D Domain Engine & Application Services (srv/src/domain/eightd/)                        │
│   ├── eightDService.ts         (Hạt nhân điều phối toàn bộ vòng đời phiếu 8D)           │
│   ├── stepGraph.ts             (Máy trạng thái quản lý sự phụ thuộc giữa các bước D1-D8)│
│   ├── isIsNot.ts               (Động cơ phân tích ranh giới sự cố IS / IS-NOT)          │
│   └── postProcess.ts           (Xử lý hậu kỳ dữ liệu và kiểm tra tính hợp lệ nghiệp vụ) │
└──────────────────────────┬──────────────────────────────────────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌────────────────────────────────────────┐ ┌─────────────────────────────────────────────┐
│ Graph Engine & Precedent Library       │ │ Enterprise Persistence Layer                │
│   ├── graph/engine.ts (Đồ thị sự cố)   │ │   ├── eightDRepository.ts                   │
│   ├── precedent/reranker.ts (Rerank)   │ │   ├── precedent/pgvectorBridge.ts (Vectors) │
│   └── precedent/scoring.ts (Điểm tương │ │   └── JSON_ER_DATABASE.json (Database Schema│
│       đồng ngữ nghĩa)                  │ │       & Data Seeder)                        │
└────────────────────────────────────────┘ └─────────────────────────────────────────────┘
```

---

## 3. What Works Well (Concrete Strengths)

1. **Độ Sâu Về Tiêu Chuẩn Công Nghiệp Không Thể Đánh Bại (Verified)**:
   * Nhóm đã chọn một đề tài kỹ thuật sản xuất cực kỳ khó và triển khai đến nơi đến chốn. Quy trình 8D được mô hình hóa tỉ mỉ từ ma trận IS/IS-NOT, phân tích nguyên nhân gốc rễ (5-Why, Fishbone) đến liên kết tiền lệ lịch sử.
2. **Khối Lượng Kiểm Thử Tự Động Kỷ Lục (Verified)**:
   * Thư mục `srv/src/domain/eightd/__tests__/` sở hữu hơn 40 file test bao quát toàn bộ logic: từ đồ thị bước (`stepGraph.test.ts`), reranker ngữ nghĩa (`reranker.test.ts`), tính toán điểm tiền lệ (`scoring.test.ts`), đến xác thực schema bounded. Đây là kho test suite lớn và đồ sộ nhất trong 14 đội thi.
3. **Thuật Toán Tìm Kiếm & Rerank Tiền Lệ Sâu Sắc (Verified)**:
   * Hệ thống không chỉ tìm kiếm từ khóa đơn giản mà kết hợp: chấm điểm thuộc tính nguồn (`sourceFields.ts`), chấm điểm ngữ nghĩa (`semanticScoring.ts`) và bộ lọc reranker (`reranker.ts`) để chọn ra đúng ca sự cố tương tự nhất trong quá khứ.
4. **Chuẩn Bị Sẵn Đóng Gói Docker Compose (Verified)**:
   * Repo có sẵn file `docker-compose.yml` và tài liệu hướng dẫn chạy cục bộ chi tiết trong `RUNNING-LOCAL.md`.

---

## 4. Critical Problems

### Problem 1: Độ Phức Tạp Cực Kỳ Cao Đòi Hỏi Kiến Thức Chuyên Môn Sâu (High Cognitive Load)
* **Evidence (VERIFIED)**:
  * Quy trình 8D bao gồm hàng trăm trường dữ liệu kỹ thuật và thuật ngữ công nghiệp (FMEA, Containment, Root Cause, Is/Is-Not).
* **Why it matters**: Đối với ban giám khảo hoặc người dùng phổ thông không làm trong ngành sản xuất công nghiệp ô tô/linh kiện, việc nắm bắt và trải nghiệm hết luồng 8 bước trong vài phút thuyết trình demo là một thách thức rất lớn.
* **Impact**: Nguy cơ người xem bị "ngợp" trước khối lượng tính năng đồ sộ mà không thấy hết được giá trị cốt lõi của AI Referee.
* **Recommended fix**: Xây dựng một kịch bản "Quick Demo Tour" (1-Click Walkthrough) trên giao diện, tự động điền sẵn một ca sự cố lỗi sản xuất điển hình để giám khảo theo dõi từ D1 đến D8 chỉ trong 2 phút.
* **Priority**: **P1**

---

### Problem 2: Sự Cồng Kềnh Trong Quá Trình Build Và Khởi Động
* **Evidence (VERIFIED)**:
  * Cấu trúc dự án theo chuẩn SAP CAP với hàng ngàn dòng code TypeScript và cấu hình phức tạp khiến thời gian biên dịch (`npm run build`) và khởi động tương đối lâu.
* **Why it matters**: Nếu gặp sự cố cần restart nóng trong buổi thuyết trình, thời gian chờ khởi động lại có thể làm gián đoạn bài pitch.
* **Impact**: Giảm tính linh hoạt khi thao tác demo trực tiếp.
* **Recommended fix**: Tối ưu hóa script khởi động nhẹ cho chế độ demo bằng cách dùng build cache hoặc chạy sẵn container nền.
* **Priority**: **P2**

---

## 5. Crash / Failure Risks

| Failure Mode | Trigger | Impact | Severity | Fix |
| ------------ | ------- | ------ | -------- | --- |
| **Tràn thời gian xử lý đồ thị sự cố lớn** | Ca sự cố có đồ thị phụ thuộc sâu và hàng trăm ca tiền lệ cần rerank. | Độ trễ trả về kết quả tăng lên hơn 10 giây. | **Medium** | Bổ sung phân trang (Pagination) và giới hạn số lượng tiền lệ truy vấn tối đa. |
| **Xung đột máy trạng thái giữa các bước 8D** | Cố tình nhảy cóc bước (ví dụ: chuyển từ D2 sang D5 khi chưa xong D3/D4). | Động cơ State Machine ném lỗi vi phạm điều kiện tiên quyết. | **Low** | Vô hiệu hóa (disable) các nút bước tiếp theo trên giao diện cho đến khi bước trước hoàn tất. |
| **Lỗi kết nối bộ đệm pgvector** | Chạy kiểm thử tiền lệ mà chưa bật dịch vụ vector database. | Chức năng tìm kiếm tiền lệ trả về danh sách rỗng. | **Medium** | Tự động chuyển sang chế độ tìm kiếm văn bản truyền thống (Text Search fallback). |

---

## 6. Pipeline Analysis

```text
CURRENT PIPELINE (Enterprise 8D Problem Solving Cycle):
[Kỹ sư ghi nhận sự cố kỹ thuật sản xuất (D1 & D2)]
       │
       ▼
[isIsNot.ts: Bóc tách thuộc tính sự cố theo ma trận Cái gì bị / Cái gì không bị]
       │
       ▼
[Precedent Engine: Tìm kiếm các ca sự cố tương tự trong lịch sử qua pgvector]
       │
       ▼
[Reranker & Scoring: Chấm điểm và xếp hạng giải pháp tiền lệ phù hợp nhất]
       │
       ▼
[Kỹ sư áp dụng hành động ngăn chặn tạm thời D3 & Xác định nguyên nhân gốc D4]
       │
       ▼
[StepGraph Engine: Kiểm soát chặt chẽ điều kiện tiên quyết trước khi chuyển bước]
       │
       ▼
[Phê duyệt hành động khắc phục D5/D6 & Phòng ngừa D7 -> Đóng ca D8]
```

---

## 7. Code / Repository Issues

* Chất lượng mã nguồn TypeScript ở đẳng cấp cao nhất: phân tách module tuyệt đẹp, có tính bao gói và trừu tượng hóa chuẩn công nghiệp lớn.
* Hơn 40 file test được duy trì nghiêm túc và có cấu trúc mạch lạc.

---

## 8. Database / API / Integration Issues

* Thiết kế cơ sở dữ liệu rất chi tiết thể hiện qua file `JSON_ER_DATABASE.json`. Hỗ trợ tích hợp OData và REST API chuẩn.

---

## 9. Security Issues

* Có module phân quyền `identityService.ts` và kiểm soát quyền hạn theo vai trò trong quy trình chất lượng.

---

## 10. Deployment / DevOps Issues

* Có sẵn `docker-compose.yml` và hướng dẫn chạy cục bộ chi tiết trong `RUNNING-LOCAL.md`.

---

## 11. Testing Gaps

* Kiểm thử đơn vị và tích hợp đã cực kỳ toàn diện. Cần bổ sung kịch bản kiểm thử giao diện người dùng trọn gói (E2E Test) trên trình duyệt.

---

## 12. Recommended Improvements

| Priority | Thành phần | Hành động cụ thể | Lợi ích mang lại |
| -------- | ---------- | ---------------- | ---------------- |
| **P1** | **UX / Pitching** | Bổ sung nút "1-Click Demo Scenario" để tự động diễn giải trọn vẹn luồng 8D trong 2 phút. | Giúp ban giám khảo nhanh chóng hiểu được toàn bộ giá trị hệ thống. |
| **P2** | **Performance** | Tối ưu hóa bộ nhớ đệm (Cache) cho thuật toán Reranking tiền lệ. | Giúp việc tìm kiếm giải pháp tương tự phản hồi gần như tức thì. |
| **P2** | **DevOps** | Cung cấp sẵn file demo database SQLite chạy nhẹ không cần cài thêm service ngoài. | Giúp người chấm có thể mở và dùng thử ngay lập tức. |

---

## 13. Sprint 2 Action Plan

### P1 — Should Fix
1. Xây dựng kịch bản trình diễn mẫu (Guided Demo Walkthrough) trên giao diện để phục vụ buổi thuyết trình trước ban giám khảo.
2. Đảm bảo chế độ chạy fallback không phụ thuộc vào pgvector luôn sẵn sàng hoạt động.

### P2 — Improvement
1. Tối ưu hóa giao diện người dùng để làm nổi bật sự can thiệp của AI Referee trong việc phát hiện nguyên nhân gốc rễ.

---

## 14. Reviewer Conclusion

* **Current System State**: UIT_4Lovpe là dự án sở hữu độ phức tạp kỹ thuật và khối lượng mã nguồn đồ sộ nhất trong cuộc thi, tiếp cận chuẩn mực kiến trúc phần mềm doanh nghiệp cấp độ ERP (SAP CAP).
* **Most Important Strength**: Bộ kiểm thử tự động kỷ lục (>40 file test), mô hình hóa quy trình 8D công nghiệp sâu sắc, thuật toán tìm kiếm và xếp hạng tiền lệ sự cố rất bài bản.
* **Most Important Technical Risk**: Độ phức tạp nghiệp vụ quá cao khiến người xem dễ bị quá tải thông tin trong một buổi thuyết trình ngắn.
* **Most Important Next Action**: Đơn giản hóa hành trình trải nghiệm bằng một kịch bản demo 1-click trực quan để làm nổi bật ngay giá trị cốt lõi trước ban giám khảo.
