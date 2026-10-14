# GraphAI Stage 2 — Lộ trình nâng cấp retrieval 8D local

**Mục tiêu:** tiếp tục hoàn thiện truy hồi tiền lệ 8D thành pipeline local chạy trên dữ liệu nhóm tự seed, có chất lượng đo được, giải thích được và có giới hạn độ trễ/chi phí.
**Không phụ thuộc:** SAP HANA Cloud, graph database riêng hoặc dịch vụ managed retrieval.
**Trạng thái:** đề xuất kỹ thuật để triển khai tiếp; chưa phải mô tả những phần đã code.

## 1. Có cần chỉnh logic hiện tại không?

**Có.** Source đã có nền tảng hữu ích: scoring theo field, keyword, embedding cosine, profile theo bước D, listwise reranker có kiểm tra output và fallback. Tuy nhiên, các phần này chưa tạo thành pipeline local-hybrid thống nhất.

### Hiện trạng đã xác nhận trong source

1. srv/src/domain/eightd/graph/engine.ts chỉ chạy graph probes khi isGraphAvailable() xác nhận DB là HANA. Với SQLite local, findPrecedents() chuyển sang findPrecedentsByStep() của scoring engine. Vì vậy, chọn graph không đồng nghĩa graph engine đang chạy trên dữ liệu local.
2. Graph HANA hiện truy hồi theo quan hệ/field/keyphrase và cộng điểm; pipeline chưa kết hợp riêng thứ hạng từ structural, lexical BM25 và semantic retrieval bằng rank fusion.
3. Scoring engine có cosine embedding, nhưng embedding provider có thể không được cấu hình. Log hiện đã báo semantic channel bị bỏ qua trong trường hợp đó. Cần coi đây là trạng thái skipped, không hiểu nhầm thành “semantic đã tìm nhưng không thấy kết quả”.
4. Default rerank của graph profile bằng 0; profile rerank D4/D5 của scoring cũng được seed ở trạng thái tắt. Model không tự rerank nếu quản trị viên chưa bật cấu hình.
5. Cache reranker vừa được thêm chỉ lưu verdict trong RAM của một process. Cache không tồn tại sau restart; hiện chưa có metric hit-rate hoặc dashboard.
6. srv/src/domain/eval/ chủ yếu đánh giá chất lượng nội dung báo cáo 8D, chưa phải gold benchmark đo relevance của tiền lệ theo query và bước D. Chưa thể dùng evaluator hiện tại để kết luận retrieval tốt hơn.
7. Hợp đồng Precedent/PerStepPrecedents và cách đánh số citation được nhiều bước pipeline sử dụng. Cần giữ hợp đồng này khi đổi retriever để tránh model trích dẫn sai ID.

## 2. Nguyên tắc thiết kế Stage 2

- Một đầu vào, một engine được ghi rõ; không trộn điểm graph và scoring trên các thang khác nhau.
- Retrieval trả về tiền lệ có bằng chứng truy vết được. Similarity không đồng nghĩa cùng nguyên nhân hay hành động phù hợp.
- Lọc cứng điều kiện nghiệp vụ trước khi xếp hạng: loại chính case đang mở, chỉ dùng case đã đóng, không đưa case thiếu/không hợp lệ vào tập đề xuất.
- Chạy được trên SQLite và dữ liệu seed hiện có. Dùng CAP repository để đọc dữ liệu; không viết SQL phụ thuộc HANA vào domain retrieval.
- Ưu tiên exact scan/in-memory index cho kho hiện tại. Chỉ thêm ANN, graph DB hoặc hạ tầng phân tán khi benchmark chứng minh cần.
- Dùng model ở bước có giá trị rõ ràng (ưu tiên D4/D5), với pool nhỏ, timeout, output validation và fallback.
- Không đổi engine mặc định trước khi so sánh trên holdout có nhãn do người đánh giá tạo.

## 3. Kiến trúc đích

    CaseContext + D-step
            |
            v
    1. Build D-specific query frame + normalize fields
            |
            +-- 2a. Structural/local graph channel
            |       material, family, work center, defect, action type,
            |       case-feature adjacency maps
            +-- 2b. Lexical channel
            |       SQLite FTS5/BM25 when available; deterministic local
            |       inverted-index fallback; exact IDs stay separate
            +-- 2c. Semantic channel (optional)
                    stored vectors + query vector, same model only
                            |
                            v
    3. Eligibility filters -> dedupe candidates
                            |
                            v
    4. Weighted Reciprocal Rank Fusion per D-step
                            |
                            v
    5. D-specific evidence floor / abstain rule
                            |
                D4/D5 only when enabled and useful
                            v
    6. Listwise rerank 8-12 candidates, max 2 concurrent calls
                            |
                            v
    7. Reapply hard filters -> top-N -> batch hydrate
                            |
                            v
    8. Existing Precedent contract + provenance + RetrievalTrace

### 3.1 Structural/local graph channel

Thêm snapshot index trong RAM, dựng từ các bảng quan hệ hiện có:

- nodeToCaseIds: loại feature và giá trị chuẩn hóa -> tập notification ID.
- caseToFeatures: notification ID -> work center, material, material family, defect code, keywords.
- actionTypeToCaseIds: action type -> các case đã đóng có action tương ứng.
- caseToActions: notification ID -> action đã ghi nhận, giữ loại/status/text cần cho D3/D5/D7.
- Mọi tập ID được sắp xếp ổn định để tie-break deterministic.

Dựng snapshot theo batch qua repository, không query DB cho từng candidate. Rebuild sau seed/closed-case write-back và gắn libraryVersion hoặc generation number cho snapshot. Không dùng một bản index cũ sau khi kho case vừa được cập nhật.

Dữ liệu nguồn đã có ở HistoricalCases, HistoricalActions và HistoricalTeamMembers; không tạo graph database mới.

### 3.2 Lexical channel

- Dùng searchText hiện được tạo từ symptom, investigation, cause và action.
- Ưu tiên FTS5/BM25 nếu SQLite runtime hỗ trợ ổn định. Kiểm tra capability lúc khởi động; nếu không có thì dùng inverted index/token overlap deterministic trong TypeScript.
- Chuẩn hóa chữ hoa/thường, khoảng trắng, dấu câu; giữ mã vật tư/mã lỗi chính xác ở nhánh exact.
- Duy trì synonym/alias map có version và review được, ví dụ thuật ngữ viết tắt trong bộ dữ liệu nhóm.
- Token phổ biến không được phép tự tạo tiền lệ; lexical-only candidate phải qua evidence floor theo D-step.

Không bắt buộc cài extension để app chạy. FTS5 là tối ưu có kiểm tra capability, không phải phụ thuộc bắt buộc.

### 3.3 Semantic channel

- Tái sử dụng trường embedding, embeddingModel, searchText và cơ chế embed hiện có.
- Embed query tối đa một lần cho một analysis; dùng chung cho các D-step cần semantic.
- So cosine chỉ khi model/version và chiều vector tương thích. Nếu thiếu key, provider timeout hoặc vector lỗi: đánh dấu channel là skipped/error, tiếp tục structural + lexical.
- Không cho một vector similarity đơn lẻ vượt hard filter hoặc evidence floor.
- Re-embed kho chỉ khi searchTextHash hoặc embeddingModel thay đổi. Có chế độ batch/retry, log số success/failure và không xóa vector cũ trước khi bản mới hợp lệ.
- Kho hiện tại nhỏ: exact cosine scan trên snapshot là baseline. Chưa thêm HNSW/ANN.

### 3.4 Weighted Reciprocal Rank Fusion

Mỗi channel trả danh sách ID có thứ tự riêng. Hợp nhất bằng rank, không cộng trực tiếp cosine, điểm keyword và điểm graph vốn khác thang đo:

    RRF(case) = sum_channel weight[channel, D] / (k + rank_channel(case))

- Bắt đầu với k = 60, đánh giá sensitivity trên dev set.
- Channel không có kết quả thì không đóng góp điểm.
- Tie-break cuối cùng theo notification ID để output deterministic.
- Trọng số là tham số thử nghiệm; không tuyên bố tối ưu trước khi chạy dev set. Khởi điểm nên ưu tiên structured cho D1/D2, action evidence cho D3/D5/D7, lexical + semantic cho D4; hiệu chỉnh trên dev, giữ holdout kín.
- Lưu rank/score theo từng channel trong RetrievalTrace, không chỉ trả RRF tổng.

## 4. Query và luật nghiệp vụ theo bước D

| Bước | Nội dung truy vấn chính | Ưu tiên retrieval | Guardrail cần giữ |
|---|---|---|---|
| D1 | Đội/người có năng lực xử lý tình huống tương tự | work center, material family, lịch sử team/capability | Không xếp team chỉ vì symptom text giống |
| D2 | Ranh giới lỗi, vị trí, vật tư, characteristic/defect | defect code, material, exact attributes, lexical | Không biến hai mã lỗi khác nhau thành cùng lỗi chỉ vì semantic gần |
| D3 | Chặn rủi ro đang phơi nhiễm | action type Containment, exposure/stock/customer context, lexical | Không lấy Corrective/Preventive thay cho containment |
| D4 | Cơ chế vật lý gây hỏng | investigation, root cause, defect text, lexical + semantic | Cùng từ/mã/trạm không đủ kết luận cùng failure mechanism |
| D5 | Hành động khắc phục có loại bỏ nguyên nhân không | root cause ↔ Corrective action, action text, lexical + semantic | Sorting/screening không được coi là loại bỏ nguyên nhân nếu chỉ kiểm soát đầu ra |
| D6 | Bằng chứng xác minh hiệu lực | verification/evidence fields nếu có; nếu thiếu thì khai rõ | Không bịa số liệu, thời gian theo dõi hoặc mẫu xác minh |
| D7 | Phòng ngừa trên phạm vi hệ thống | Preventive action, material family, FMEA/process scope | Cùng work center không được làm hẹp tìm kiếm systemic |
| D8 | Tính đầy đủ khi đóng hồ sơ | closure evidence, lessons learned, open items | Không suy luận “đóng đầy đủ” chỉ từ SAP status |

Tạo buildRetrievalQuery(context, stepCode) thuần, trả các field riêng và danh sách dữ kiện thiếu. Không yêu cầu model bịa bổ sung dữ kiện cho query.

## 5. Reranker và cache

### Đã có

- rerankCandidates có validation ID/score, timeout, cache kết quả hoàn chỉnh 15 phút, tối đa 256 mục LRU và single-flight cho request đồng thời cùng nội dung.
- Cache key hiện content-addressed theo prompt/frame, query và toàn bộ nội dung ứng viên.
- Test cache và test reranker nằm trong srv/src/domain/eightd/precedent/__tests/.

### Stage 2 cần làm tiếp

1. Chỉ đưa 8–12 ứng viên sau fusion vào listwise rerank; tăng pool chỉ khi candidate Recall@K cho thấy gold case bị bỏ sót.
2. Chỉ thử D4 và D5 trước. D3/D7 chỉ bật nếu nhãn cho thấy rerank tăng chất lượng đủ bù latency/cost.
3. Chạy D4/D5 đồng thời sau khi hoàn tất DB reads; đặt một deadline tổng 45 giây cho hai kết quả, fallback về thứ hạng fusion nếu hết hạn hoặc provider lỗi.
4. Bật bằng feature flag/config opt-in; không đổi mặc định trước promotion gate.
5. Cache hiện tại ở RAM tiến trình. Nếu vận hành nhiều tenant/process, xác nhận namespace và partition cache theo tenant/config/model trước khi dùng chung. Không ghi raw query, case text, API key hoặc verdict nhạy cảm vào log.
6. Theo dõi hit/miss, số model calls, p50/p95 latency; không log nội dung case để đo cache.
7. Khi model, system prompt, rubric, candidate text hoặc cách tạo query đổi, cache key phải đổi hoặc version tăng.

Rerank là bước chỉnh thứ tự trong candidate pool; nó không thể tìm gold case mà các channel không đưa vào pool.

## 6. Kết quả, confidence và giải thích

Giữ Precedent/PerStepPrecedents và cách đánh số citation hiện có. Bổ sung trace tùy chọn, backward-compatible:

    interface RetrievalTrace {
      engine: 'local-hybrid' | 'legacy-scoring' | 'fallback';
      channels: Array<{
        name: 'structural' | 'lexical' | 'semantic' | 'rerank';
        status: 'ok' | 'skipped' | 'error';
        elapsedMs: number;
        candidateCount: number;
      }>;
      libraryVersion: string;
      fusionVersion: string;
      rerankCache: 'hit' | 'miss' | 'in-flight' | 'skipped';
    }

Mỗi precedent phải có evidence kiểm tra được: field/action nào khớp, channel rank nào đóng góp, vì sao hữu ích cho bước D và dữ kiện nào còn khác. Không diễn giải RRF score thành xác suất nếu chưa calibration.

Abstain/no-precedent là kết quả hợp lệ. Không hạ ngưỡng để UI luôn có gợi ý. Nếu không qua evidence floor, trả danh sách rỗng cùng reason rõ ràng.

## 7. Gold evaluation — điều kiện trước khi đổi default

Tạo bộ dữ liệu riêng cho retrieval, không dùng điểm evaluator nội dung báo cáo để thay nhãn relevance:

    {
      "queryId": "Q-001",
      "notificationId": "OPEN-CASE",
      "stepCode": "D4",
      "judgments": [
        { "precedentId": "8D-1001", "relevance": 3, "rationale": "same physical mechanism" },
        { "precedentId": "8D-1002", "relevance": 0, "rationale": "same part, unrelated cause" }
      ],
      "noPrecedentExpected": false
    }

Thang relevance: 0 = không liên quan; 1 = liên quan yếu; 2 = tham khảo một phần; 3 = chuyển giao trực tiếp cho câu hỏi của bước D đó. Nhãn phải gắn theo query + step, không chỉ theo cặp case.

### Quy trình gán nhãn

- Tạo 25–40 query-step đại diện, bao gồm case dễ, case khó, case không nên có tiền lệ và case thiếu dữ liệu.
- Tự gán nhãn và lưu rationale ngắn. Nếu có người am hiểu nghiệp vụ, nhờ review chéo các nhãn khó; nếu chưa có người review, đánh dấu nhãn còn bất định thay vì coi là ground truth chắc chắn.
- Chia dev/holdout trước khi chỉnh trọng số. Không dùng holdout để tune threshold.
- Bắt đầu với 15–20 query cho dev và ít nhất 10 query cho holdout; tăng số lượng nếu kết quả biến động lớn.
- Không tự động xem cùng defect code/work center là gold relevance.

### Metrics cần báo cáo

- Candidate Recall@20 và Recall@50: channel union có giữ lại tiền lệ đúng không.
- Recall@5/10, Precision@3, MRR@10 và nDCG@5 theo từng D và tổng.
- False-positive rate trên query được gán noPrecedentExpected; hard-filter violations phải bằng 0.
- p50/p95 retrieval latency, warm/cold index build time, DB round trips, embedding calls, rerank calls, cache hit rate.
- So sánh trên cùng query/labels: legacy scoring → structural local → structural+lexical → +semantic → +RRF → +D4/D5 rerank.

### Promotion gate

Chỉ promote local-hybrid khi holdout thỏa tất cả:

1. Không vi phạm closed-only/self-exclusion/hard filters.
2. Candidate Recall@20 không thấp hơn legacy baseline.
3. Precision@3 không giảm; nDCG@5 hoặc MRR@10 tăng vượt nhiễu đo được.
4. False-positive rate của no-precedent không tăng.
5. Latency p95 và API call budget nằm trong giới hạn đã chốt trước benchmark.
6. Mọi kết quả có engine/version/channel trace; rollback về legacy chỉ bằng config.

Nếu lượng nhãn chưa đủ để chứng minh cải thiện, giữ local-hybrid ở shadow/opt-in và báo rõ chưa kết luận.

## 8. Kế hoạch 3 tuần cá nhân

Thực hiện theo thứ tự dưới đây; mỗi tuần chốt được một mốc chạy được trước khi mở rộng tiếp. Các nhãn nghiệp vụ có thể được review chéo khi có người hỗ trợ, nhưng các đầu việc code và tích hợp đi theo một luồng cá nhân.

### Tuần 1 — hiểu baseline và khóa cách đo

- Xác nhận runtime thực tế là SQLite, engine đang dùng và các profile/cấu hình rerank.
- Tạo 25–40 query-step và relevance judgments; tách dev/holdout trước khi chỉnh ranking.
- Chạy baseline legacy scoring; ghi metrics chất lượng, latency, số query DB, số lần gọi embedding/rerank và các ví dụ sai cụ thể.
- Chốt interface PrecedentRetriever và query frame theo D; giữ nguyên Precedent/PerStepPrecedents và citation contract.

**Bàn giao tuần 1:** bộ nhãn có rationale, baseline report, interface/query contract và test hard filters. Chưa tune nếu chưa có đủ nhãn đại diện.

### Tuần 2 — local index và các kênh candidate

- Implement localGraphIndex.ts: batch load, exact feature maps, closed-only/self exclusion, snapshot version/invalidation.
- Implement retrieval evaluator metrics và chạy baseline trên dev; giữ holdout không dùng để tuning.
- Implement lexical index cùng semantic exact-scan adapter; đo latency/count riêng từng channel.
- Thêm engine opt-in, trace và fallback; giao diện phải báo engine thực sự chạy, không gắn nhãn graph cho lượt đã fallback scoring.

**Bàn giao tuần 2:** structural + lexical local chạy end-to-end; semantic có thể skip khi thiếu key; output citation không đổi; bằng chứng deterministic. Chạy lại regression và so sánh candidate Recall@K.

### Tuần 3 — fusion, rerank chọn lọc và đánh giá promotion

- Implement weighted RRF, per-step evidence floor, deterministic tie-break và RetrievalTrace.
- Chạy ablation theo thứ tự: legacy → structural → +lexical → +semantic → +RRF; sau đó mới thử D4/D5 rerank.
- Đo cache hit/miss, latency warm/cold, API call count, p50/p95 và kiểm tra timeout/fallback giữ fusion order.
- Chạy holdout sau khi chốt cấu hình; rà hard filters, no-precedent false positives và citation.
- Chỉ đổi default nếu qua promotion gate. Nếu không qua, để local-hybrid opt-in, ghi lỗi ranking còn lại và chọn vòng cải tiến tiếp theo.

**Bàn giao tuần 3:** report holdout theo từng D, đề xuất promote/không promote có căn cứ, hướng dẫn cấu hình và rollback.

### Thứ tự triển khai trong code

1. srv/src/domain/eightd/graph/retriever.ts — interface và engine selection.
2. srv/src/domain/eightd/graph/retrievalQuery.ts — frame theo D.
3. srv/src/domain/eightd/graph/localGraphIndex.ts — local projection/adjacency.
4. srv/src/domain/eightd/graph/lexicalRetriever.ts — FTS5 capability + TypeScript fallback.
5. srv/src/domain/eightd/graph/semanticRetriever.ts — compatible embedding exact scan.
6. srv/src/domain/eightd/graph/rankFusion.ts — weighted RRF thuần, có unit tests.
7. srv/src/domain/eightd/graph/localHybridEngine.ts — orchestration/floors/trace.
8. srv/src/domain/eightd/precedent/precedentRepository.ts + local hydrator — batch reads, top-N only.
9. srv/src/domain/eightd/graph/settings.ts, db/schema/graph-config.cds, toggle/admin UI — opt-in, engine name rõ.
10. srv/src/domain/eval/retrieval/ và scripts/eval-retrieval.mjs — gold labels, metrics và ablation report.

Tên file là đề xuất; trước khi thêm cần kiểm tra naming convention và tránh tạo abstraction trùng chức năng repository hiện có.

## 9. Definition of Done

- SQLite local path chạy local-hybrid thật, không âm thầm gọi HANA graph rồi fallback.
- Thiếu DeepSeek/Jina key không làm lỗi toàn bộ retrieval; channel tương ứng hiện trạng skipped và vẫn có fallback.
- D4/D5 rerank chạy trên pool bounded, có cache, timeout tổng, model error giữ fusion order.
- Self-case, case chưa đóng và action sai loại không xuất hiện ở kết quả.
- Kết quả giữ đúng citation ID và có channel provenance.
- Có unit tests cho normalization, index, RRF, filters, abstain, cache và failure fallback; integration test trên SQLite seed.
- Có retrieval benchmark và báo cáo holdout thật; không tuyên bố “chính xác nhất/tối ưu nhất” nếu chưa có số liệu.
- Engine cũ vẫn khôi phục được bằng setting, và default chỉ đổi sau khi qua promotion gate.

## 10. Những việc không ưu tiên

- Thay SQLite bằng SAP HANA/graph cloud hoặc tự dựng Neo4j.
- HNSW/ANN khi kho nhỏ và exact scan chưa được đo là bottleneck.
- GraphRAG/agent tự viết truy vấn hoặc để LLM tự quyết định hard filters.
- Rerank cả tám bước/mọi candidate; tăng token budget để bù query frame kém.
- Tuning trọng số trên holdout hoặc dùng LLM judge làm gold truth duy nhất.

**Khuyến nghị thực tế:** bước kế tiếp nên bắt đầu bằng gold retrieval labels + baseline đo được và local adapter cho SQLite. Khi biết lỗi ranking nằm ở channel nào mới chỉnh trọng số hoặc bật reranker; không nên bật thêm model trước khi candidate recall được xác nhận.
