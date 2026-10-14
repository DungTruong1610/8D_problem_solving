# Tóm tắt triển khai GraphAI

**Ngày ghi nhận:** 29/09/2026
**Phạm vi:** Những thay đổi đã thực sự được đưa vào source code trong lượt triển khai này.

## Đã thêm

### Cache kết quả reranker

Trong `srv/src/domain/eightd/precedent/reranker.ts`, hàm `rerankCandidates` hiện lưu tạm kết quả rerank đã chuẩn hóa để tránh gọi model lại khi gặp đúng cùng một nội dung truy vấn.

- Tạo cache key SHA-256 từ system prompt, rubric/frame của bước D, nội dung query và ID/nội dung từng ứng viên. Thay đổi một trong các phần này sẽ tạo key khác, không lấy nhầm phán đoán cũ.
- Cache sống 15 phút, tối đa 256 mục. Khi vượt dung lượng, mục ít được dùng gần đây nhất bị loại trước (LRU).
- Chỉ cache kết quả có verdict hợp lệ cho **đủ tất cả ứng viên**. Output lỗi hoặc thiếu verdict không được lưu để lần sau có thể thử gọi model lại.
- Gộp các request đồng thời có cùng key thành một lần gọi model (single-flight).
- Trả bản sao của map và verdict; bên gọi không thể vô tình sửa object đang được lưu trong cache.
- Cache ở RAM của tiến trình backend: restart backend sẽ làm cache rỗng. Cache này không dùng chung giữa nhiều process và hiện không cần invalidate theo thao tác sửa kho vì key phụ thuộc nội dung ứng viên.

Cache dùng chung cho các nơi gọi `rerankCandidates`, bao gồm Graph reranker và scoring reranker. Tác dụng thấy rõ nhất là request lặp trong cùng tiến trình; lần gọi model đầu tiên vẫn có độ trễ như trước.

### Timeout reranker

- Cho phép truyền `timeoutMs` riêng qua tham số tùy chọn của `rerankCandidates`; các caller chưa truyền giá trị vẫn dùng timeout mặc định 45 giây.
- Kiểm tra giá trị timeout để cấu hình không hợp lệ không tạo timer gần như bằng 0.
- Dọn timer sau khi lời gọi kết thúc, tránh giữ timer không cần thiết.

### Kiểm thử mới

Tạo `srv/src/domain/eightd/precedent/__tests__/reranker-cache.test.ts`, kiểm tra cache hit cho nội dung giống nhau, sao chép an toàn, gộp request đồng thời và không tái sử dụng verdict khi query/frame/nội dung ứng viên đổi.

## Chưa được triển khai trong lượt này

- Chưa tạo local graph index/adjacency hoặc local-hybrid retriever chạy độc lập trên SQLite.
- Chưa thay đổi thuật toán tạo candidate, BM25/FTS, weighted RRF hay semantic retrieval của graph.
- Chưa bật LLM rerank mặc định cho D4/D5; cấu hình profile hiện tại vẫn quyết định bước nào gọi reranker.
- Chưa có bộ relevance judgments do người đánh giá gán nhãn để benchmark và quyết định promote engine.
- Chưa thêm dashboard/metric hit rate, p95 latency hoặc chi phí model.

Vì vậy, thay đổi hiện tại là **tối ưu cache cho tầng reranking**, chưa phải bản nâng cấp hoàn chỉnh của GraphAI local-hybrid.

## Kiểm tra đã chạy

- `npm run typecheck` — thành công.
- `npm test -- --runInBand srv/src/domain/eightd/precedent/__tests__/reranker-cache.test.ts srv/src/domain/eightd/precedent/__tests__/reranker.test.ts` — 2 suite, 15 test thành công.
- `npm run build` trong `app/8D_hackathon_ui` — build thành công. Vite còn cảnh báo bundle JS chính lớn hơn 500 kB và một font của `@cnma/react-ui` được resolve ở runtime.
- Khởi động backend local và frontend Vite; trang `http://127.0.0.1:5544/` và backend `/health` trả HTTP 200. Không cần AI key để build/mở giao diện; gọi model/embedding cần cấu hình key tương ứng.
