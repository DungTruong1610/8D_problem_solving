# Truy hồi bằng Graph, Re-rank và Chain-of-Thought — đã làm gì, áp ở đâu, test thế nào

**Ngày:** 2026-09-03
**Nhánh:** `feat/graph-retrieval` (cắt từ `dev/Thien`, đã cherry-pick `feature/re-rank`)
**Trạng thái:** đã implement · **tắt mặc định** — nhánh này không đổi hành vi gì cho tới khi có người sửa một giá trị cấu hình
**Bản tiếng Anh:** `docs/GRAPH-RETRIEVAL-AND-RERANK.md` (hai bản cùng nội dung; sửa một bản thì sửa cả hai)
**Liên quan:** `docs/RERANK-PRECEDENT-RETRIEVAL.md` (Thanh — tầng 2 cho engine chấm điểm) · `docs/PRECEDENT-RETRIEVAL-REVIEW.md` (phát hiện R2/R3/R4) · `docs/superpowers/specs/2026-09-03-graph-retrieval-design.md` (thiết kế + phần hiệu chỉnh)

**Đọc cho ai:** người làm hoặc review phần truy hồi tiền lệ.

---

## 0. Tóm tắt một đoạn

Truy hồi tiền lệ giờ có **hai cách tìm** và **một cách đọc**. Tầng 1 là engine chấm điểm cũ hoặc
một tầng đi trên graph của SAP HANA, chọn bằng đúng một công tắc toàn cục. Tầng 2 — một lượt gọi
model đọc case đang mở **cùng** từng ứng viên — dùng chung cho cả hai, và giờ **lập luận trước khi
chấm**. Mọi thứ hội tụ về hợp đồng `PerStepPrecedents` không đổi, nên quay về engine cũ tốn một giá
trị cấu hình chứ không phải một lần revert.

---

## 1. Vì sao có việc này

Engine chấm điểm hỏi mọi bước D cùng một câu — *"case đóng nào trông giống case này"* — và cả tám
bước đều trỏ vào profile `default`. Một lượt shadow trên `8D-10048412` trả về **danh sách y hệt
nhau từ D1 tới D8**. Nhưng D1 cần biết *ai đã xử lý loại lỗi này*, còn D4 cần biết *chi tiết này
hỏng theo cơ chế nào*; hai câu đó xếp hạng kho theo hai thứ tự khác nhau.

Hai lỗi đã đo được, ghi trong `PRECEDENT-RETRIEVAL-REVIEW.md`, tái hiện đúng trên dữ liệu thật:

- **R3(a)** — `MIN_SHARED_KEYWORDS = 1`, nên *"Flange edge burr above limit"* khớp *"Chatter marks
  … on milled flange"* qua đúng một chữ `flange` và ăn điểm bằng một case khớp thật.
- **R3(b)** — `defectKeywords` chỉ tách từ `defectText`, tức văn bản của **danh mục** mã lỗi. Câu
  chữ của người vận hành ở `symptomShortText` chưa bao giờ được đem so, nên case `8D-10048880`
  (*"Bracket housing pocket depth varying unit to unit"*) ăn **+0** trước một case mô tả *"pocket
  depth reading shallow"*.

---

## 2. GraphDB

### 2.1 Nó là cái gì

Một property graph trên **SAP HANA Cloud Graph**, truy vấn bằng openCypher qua `OPENCYPHER_TABLE`.
**14 loại đỉnh, 18 loại cạnh — tất cả đều là view SQL trên những bảng đã có.** `HistoricalCases`
vẫn là nguồn sự thật duy nhất; không có bản sao dữ liệu thứ hai và không có gì phải đồng bộ. Cypher
trả về **khoá**, SQL join ngược lại lấy nội dung.

| Đỉnh | Cạnh |
|---|---|
| `Case8D`, `OpenDefect`, `WorkCenter`, `DefectCode`, `Material`, `MaterialFamily`, `Keyword`, `Person`, `JobFunction`, `Action`, `TaskCode`, `RootCause`, `Fmea`, `InspectionLot` | `OCCURRED_AT`, `HAS_DEFECT`, `ON_MATERIAL`, `IN_FAMILY`, `MENTIONS`, `STAFFED_BY`, `ACTS_AS`, `RESOLVED_BY`, `CODED_AS`, `CAUSED_BY`, `REFERENCES_FMEA`, `COVERS_WORKCENTER`, `COVERS_MATERIAL`, `LOT_OF_MATERIAL`, `LOT_AT`, `DEFECT_AT`, `DEFECT_ON_MATERIAL`, `DEFECT_HAS_CODE` |

Nhãn là `Case8D` chứ không phải `Case`: **`CASE` là từ khoá của openCypher** nên `MATCH (c:Case)`
không parse được, và thông báo lỗi của HANA (*"expecting identifier near Case"*) không hề nhắc tới
từ khoá. `Function` đổi thành `JobFunction` để phòng trước. Có một unit test kiểm mọi nhãn với danh
sách từ khoá dành riêng.

### 2.2 Hai loại đỉnh làm việc thật

**`Keyword` là một đỉnh**, nên "trùng từ khoá" từ một phép có/không trở thành `COUNT(DISTINCT)`.
Neo vào `8D-10048412`, graph xếp `8D-10049030` hạng nhất với **3** từ chung (`burr, edge, limit`)
và đẩy `8D-10049010` — dương tính giả đã ghi trong review doc, chỉ chung chữ `flange` — xuống nhóm
một từ. Engine cũ trả cùng điểm cho cả hai. Đó là R3(a), đóng.

Token lấy từ cột mới `HistoricalCases.searchKeywords`, tính lúc nạp kho bằng **chính** hàm
`tokenizeDefectText` mà lúc truy vấn dùng, trên **cả** `defectText` **và** `symptomShortText`. Tách
từ ngay trong view sẽ là **bản thứ hai** của hàm đó — hạ chữ hoa, loại stopword, lọc độ dài — và hai
bản sẽ lệch nhau âm thầm ngay lần đầu ai đó thêm một stopword. Đó là R3(b), đóng.

**`OpenDefect` + `InspectionLot`** cho D2 vế Is-Not: *cùng vật tư, cùng đặc tính, kiểm ở trạm khác,
đạt* là một **pattern**, không phải một trận anti-join.

### 2.3 Phương ngữ ép ra hình dạng nào

Đo trực tiếp trên chính instance đang bind, 2026-09-03:

| Chạy được | Không chạy được |
|---|---|
| nhãn `MATCH (c:Case8D)` | **mọi hàm tổng hợp** — `count`, `collect`, `count(DISTINCT)` |
| quan hệ **có tên** `-[e:TYPE]->` | quan hệ ẩn danh `-[:TYPE]->` |
| mẫu ngăn dấu phẩy (hình chữ V) | mũi tên ngược `<-[e]-`, chuỗi `(a)-[e1]->(b)-[e2]->(c)` |
| đường biến thiên `p = (a)-[*1..3]-(b)` | `WITH`, `OPTIONAL MATCH`, nhiều mệnh đề `MATCH` |
| `WHERE`, `AND`/`OR`, `IN [literal]`, `<>` | `IN [$a, $b]` với **tham số bind** |
| `RETURN DISTINCT`, `ORDER BY`, `LIMIT` | `SKIP`, `IS NOT NULL`, `NOT (mẫu)` |
| `PARAMETERS ('x' = ?)` — bind thật | |

Nên phân vai là **Cypher khớp mẫu, SQL tổng hợp**. Mọi hình chữ V viết bằng mẫu ngăn dấu phẩy; mọi
phép đếm nằm ở câu SQL bọc ngoài. Đây cũng chính là cách SAP thiết kế `OPENCYPHER_TABLE` — nó trả
về một bảng để SQL dùng tiếp.

Vì `IN [$a, $b]` bị từ chối với ô bind, danh sách từ khoá viết thành chuỗi `OR` của `= $kwN`
(`anchor.ts`). Xấu hơn một chút và an toàn hoàn toàn: ghép token thẳng vào chuỗi truy vấn là con
đường **duy nhất** trong module này mà dữ liệu từ payload SAP chạm vào văn bản câu truy vấn.

**Nói thẳng phần đánh đổi:** với phương ngữ này, Cypher **không thay** được SQL — nó **bổ sung**.
Thứ SQL ở đây không làm nổi là đường độ dài biến thiên, vì HANA Cloud không hỗ trợ recursive CTE.
Đó, cộng với việc quan hệ được khai báo tường minh một chỗ thay vì nằm rải trong các câu JOIN, là
thứ graph thật sự mua được.

### 2.4 Dữ liệu ép bỏ cái gì

`defectCodeGroup` **null trên cả 25 case lịch sử** (và là hằng số duy nhất `DEF-GENERIC` trên 25
open defect), còn mỗi case mang một mã lỗi **khác nhau** — 25 mã cho 25 case. Hop `IN_GROUP` sẽ
không khớp gì, và `HAS_DEFECT` gần như không nối được hai case nào.

Nên `DefectGroup` **không** có trong graph, và không truy vấn nào nối case qua mã lỗi. Tín hiệu
phân biệt thật trong bộ dữ liệu này là **Keyword, MaterialFamily** (MG-HOUSING phủ 9/25),
**WorkCenter** (21 distinct) và **RootCause** (6).

Đỉnh mã lỗi khoá theo mã đơn lẻ — đúng khi chỉ có một không gian mã. **Phải đổi thành khoá ghép khi
CHAIN-ALIGNMENT Phase 1.3 nạp nhóm mã**, vì mã lỗi SAP chỉ duy nhất **trong** nhóm của nó.

### 2.5 Áp ở đâu

Cả tám bước, khi `engine = 'graph'` — không bao giờ một phần. Xem §5.

Mỗi bước có bộ trọng số riêng, nên mỗi bước hỏi câu của chính nó:

| Bước | Câu hỏi | Trọng số bằng chứng |
|---|---|---|
| D1 | Ai đã xử lý loại này ở trạm này? | `workCenter 4`, `materialFamily 3`, `material 2`, `keywords 1` |
| D2 | Lỗi này xuất hiện ở đâu? | `defectCode 4`, `material 3`, `workCenter 2`, `keywords 2` |
| D3 | Lần trước chặn tạm bằng cách nào? | `keywords 2`, `materialFamily 2`, `workCenter 2`, `containment 2` |
| **D4** | Chi tiết này hỏng theo cơ chế nào? | `keywords 3` (trần 4), `materialFamily 1`, `workCenter 1`, ngưỡng 5 |
| D5 | Cách sửa nào gỡ được nguyên nhân đó? | `keywords 2`, `materialFamily 2`, `corrective 3` |
| D6 | Bằng chứng nào cho thấy đã hết? | `keywords 2`, `materialFamily 1`, `corrective 3` |
| D7 | Chỗ nào khác cùng rủi ro? | `materialFamily 4`, `material 2`, `preventive 3`, `keywords 1` — **không** có `workCenter` |
| D8 | Case tương đương nào đã đóng trọn? | `workCenter 2`, `materialFamily 2`, `keywords 1` |

D7 bỏ `workCenter` là **có chủ ý**: phòng ngừa là mở rộng ra **ngoài** trạm đã hỏng, nên thưởng
điểm cho việc cùng trạm là đi ngược mục đích của bước.

**Trọng số D4 đến từ một lượt shadow thật, không từ trực giác.** Với bộ 2/2/1/1 ban đầu, case chung
3 từ khoá **hoà 6–6** với case chỉ chung `flange` nhưng cùng trạm và cùng vật tư — tức R3 quay lại
qua cửa sau, ở đúng bước quan tâm tới cơ chế hỏng nhất. Giờ từ khoá nặng 3 với ngưỡng 5: ba từ
chung được 9, còn một từ chung cộng vị trí được 5. Cả hai vẫn hiện ra, nhưng đúng thứ tự.

---

## 3. Re-rank

Tầng 2 là **của Thanh** (`feature/re-rank`, đã cherry-pick vào nhánh này để chỉ tồn tại **một** bản
implement). Thiết kế của ông ấy ở `docs/RERANK-PRECEDENT-RETRIEVAL.md`; tài liệu này không chép lại.

### 3.1 Vì sao một reranker phục vụ cả hai engine

Hai engine khác nhau ở chỗ **TÌM**, không khác ở chỗ đọc hai đoạn văn rồi phán chúng có cùng cơ chế
hỏng hay không. Viết reranker thứ hai cho graph nghĩa là hai prompt, hai bộ chuẩn hoá output, hai
chỗ phải sửa khi model đổi hành vi — và không ai biết bản nào đang chạy. Nên tầng 1 khác nhau, tầng
2 dùng chung.

### 3.2 Gắn vào đâu

| Engine | Hàm | Kết quả gắn kiểu gì |
|---|---|---|
| chấm điểm | `applyRerank` | **Điền** vào dòng breakdown mức `none` mà `scoreCase` đã giữ chỗ sẵn |
| graph | `applyRerankToScored` | **Thêm** một mục bằng chứng — graph không biết trước case nào vào pool nên không có chỗ nào để giữ |

Cả hai dùng cùng công thức — `điểm = trọng số × (score / 100)`, làm tròn 1 chữ số, có sàn — nên một
lượt shadow so hai bên là so cùng một thang.

### 3.3 Nhận vào pool

Cả hai engine nhận ứng viên theo **khả năng đạt ngưỡng, không theo ngưỡng thật**: một case có điểm
tầng 1 cộng trọng số re-rank vẫn có thể chạm `minScore` thì được vào pool. Lọc theo `minScore`
trước sẽ loại oan **đúng** những case mà tầng 2 sinh ra để cứu. Ngưỡng thật áp lên điểm **cuối**.

Đây là lý do `scoreEvidence` được tách thành `accumulateEvidence` (cộng và sắp, không cắt) và
`finalizeScores` (ngưỡng và top-N) — re-rank chen vào giữa hai việc đó.

### 3.4 Áp ở đâu

**Chỉ D4 và D5**, trên cả hai engine, và **tắt mặc định**.

- Engine chấm điểm: profile `diagnosis` (D4) và `corrective` (D5), tiêu chí `matchType = 'rerank'`, disabled.
- Engine graph: `GraphStepParams.wRerank` null ở mọi bước; D4 và D5 đã seed sẵn `rerankFloor` và
  `rerankInstruction`, nên bật lên là **một con số**.

D1 xếp hạng **người** theo phép đếm, không phải theo độ liên quan văn bản. D3 liên quan theo cấu
trúc. D6/D8 gần như không lấy gì từ truy hồi.

---

## 4. Chain-of-Thought

### 4.1 Mỗi bước một khung

Schema trước đây **ghi cứng câu hỏi của D4** - `queryAnalysis` viết *"state what failure MECHANISM
the OPEN CASE shows"*. Bật re-rank cho D1 sẽ bảo model suy nghĩ về vật lý hỏng hóc trong khi D1 hỏi
về **người**. Nó sẽ trả lời trôi chảy và trả lời **sai câu**, mà output không hề lộ ra: vẫn đúng
schema, vẫn có điểm, vẫn có lý do nghe hợp lý.

**Tách thủ tục khỏi nội dung.** `SYSTEM_PROMPT` chỉ giữ thứ đúng ở mọi bước - lập luận trước, chấm
sau, không bịa id. Nội dung đến từ `RerankFrame` mà **bước đó sở hữu**:

| Mảnh | Làm gì |
|---|---|
| `queryFrame` | Xác lập gì về **case đang mở** trước khi nhìn ứng viên nào. Đây là **mốc** mà mọi điểm số được đo theo - và là thứ thật sự khác nhau giữa các bước. |
| `candidateFrame` | So theo chiều nào. |
| `rubric` | 0 và 100 nghĩa là gì **ở đây**. Thiếu nó thì model tự bịa một thang, và thang đó đổi giữa các lượt gọi. |

Cả tám bước đều có khung, dù trọng số vẫn là 0. Khung phải đúng **trước** khi ai đó bật một bước,
nếu không thứ họ đo không phải thứ họ tưởng.

| Bước | `queryFrame` xác lập gì |
|---|---|
| D1 | Vấn đề này đòi những **năng lực** nào - thiết bị, phép đo đang nghi ngờ, công đoạn hỏng, chức năng phải ký. Không nêu tên người. |
| D2 | **Biên** của vấn đề: chi tiết nào, trạm nào, đặc tính nào vượt spec, và vượt bao nhiêu. |
| D3 | Cái gì **đang bị phơi nhiễm** và phải chặn: trên đường, trong kho, đã tới khách. |
| D4 | **Cơ chế hỏng** vật lý: cái gì dịch, mòn, biến dạng hay trôi. |
| D5 | **Nguyên nhân gốc** đã tới, và cái gì phải thay đổi về mặt vật lý để nó thôi tái diễn. |
| D6 | Cái gì mới **đáng gọi là bằng chứng** đã hết: đặc tính nào, đo thế nào, trên dân số nào. |
| D7 | Rủi ro **với xa tới đâu**: họ vật tư nào, quy trình nào, mục FMEA nào phải đổi. |
| D8 | **Đóng trọn vẹn** trông thế nào, và cái gì thường còn để lại. |

`RERANK-PRECEDENT-RETRIEVAL.md` lập luận D1/D3/D6/D8 không đáng bật - xếp hạng người là phép **đếm**
chứ không phải độ liên quan văn bản - và lập luận đó vẫn đúng. Đó là lý do mọi trọng số đều bằng 0.

**Đo trên model thật.** Cùng case đang mở, cùng ứng viên (`8D-10048788`, chatter marks do bạc trục
mòn), ba khung:

| Khung | Điểm | Lập luận của chính model |
|---|---|---|
| D4 cơ chế hỏng | **10/100** | *"forced vibration from a failing machine component ... fundamentally different from the query's mechanism"* |
| D7 tầm với hệ thống | **100/100** | *"both are equipment degradation over time ... where the existing monitoring was insufficient"* |
| D1 năng lực | **20/100** | *"cylindrical grinding, not milling ... the required capabilities differ"* |

Chênh **10x** trên cùng một cặp, và mỗi phán quyết đều **đúng cho câu hỏi của nó**. Với khung chung,
cả ba sẽ chấm như D4, và D7 sẽ vứt đi đúng case mà bước phòng ngừa cần nhất.

Có test khoá lại rằng **không hai bước nào dùng chung một khung**, và mỗi khung phải nhắc tới chủ đề
của chính nó - cái sai này vô hình trong output, nên chỉ test mới bắt được.

### 4.2 Đã đổi gì

Schema re-rank giờ đòi lập luận **trước** con số:

```
queryAnalysis   FIRST: state what failure mechanism the OPEN CASE shows, from its
                evidence alone. Do not mention any candidate here. This is the
                reference every score is measured against.

rankings[]
  notificationId
  analysis      Reason BEFORE scoring: what mechanism this candidate shows, and where
                it agrees or differs from queryAnalysis. Name the evidence. Then the
                score must follow it.
  score         0-100
  reason        One short sentence summarising the analysis, for the audit trail.
```

Cả `queryAnalysis` lẫn `analysis` đều `required`.

System prompt nói rõ thứ tự:

```
Work in this order, and do not shortcut it:
1. queryAnalysis — read the open case ALONE and state the mechanism it shows. Mention no candidate.
2. For each candidate, write analysis FIRST: what mechanism it shows, and where it agrees or
   differs from queryAnalysis. Then let the score follow from what you just wrote.

A score that does not follow from its own analysis is the failure this stage exists to prevent.
```

### 4.3 Vì sao **thứ tự trường chính là cơ chế**

Model sinh theo thứ tự trường. `analysis` đứng trước `score` nghĩa là con số rơi xuống **sau khi**
lập luận đã nằm trong ngữ cảnh. Đảo lại thì lập luận chỉ còn là lời biện minh viết sau — **và nhìn
output thì hai đằng giống hệt nhau**, nên có một unit test khoá thứ tự đó lại thay vì tin vào review.

### 4.4 Vì sao dùng trường output chứ không dùng extended thinking

Một `thinkingBudget` hợp lệ (≥ 1024) khiến CDK gắn `thinking_budget`, sau đó `applyVendorCompat`
**xoá `temperature`** — Anthropic cấm temperature đi kèm extended thinking. Mất `temperature: 0` là
mất đúng tính tất định mà một tầng xếp hạng cần nhất.

Lập luận bằng trường output giữ được cả hai: model vẫn suy nghĩ ra chữ, mà vẫn temp 0. Guard sẵn có
`effectiveThinkingBudget` bỏ budget 256 (dưới ngưỡng) với model Claude nên `temperature` sống sót;
với Gemini thì budget có nghĩa thật và temperature không bị đụng. Test kiểm **có điều kiện** theo
model chứ không kiểm vô điều kiện — bản trước khẳng định budget luôn bị bỏ, và nó đỏ trên chính cấu
hình đang chạy.

### 4.5 Chi phí, đo được

| | |
|---|---|
| Một lượt re-rank, 10 ứng viên, có CoT | **23.9 s** |
| Timeout cũ (đặt khi chưa có CoT) | 20 s — **không bao giờ về kịp** |
| Timeout hiện tại | **45 s**, ghi đè bằng `RERANK_TIMEOUT_MS` |

Timeout cũ hỏng theo kiểu êm nhất: xếp hạng tầng 1 vẫn đứng, kết quả vẫn hợp lý, tầng 2 chưa từng
chạy. **Phải đo lại** sau mỗi lần đổi model hoặc đổi prompt.

### 4.6 Quan sát trên model thật

```
Re-rank: 10/10 ứng viên được chấm trong 23514ms
queryAnalysis: "The open case describes a failure mechanism where a cutting tool, used beyond
its designated service life, becomes worn. This wear degrades its cutting geometry, causing it
to plastically deform the w…"                                    (log cắt ở 200 ký tự)

D4   8D-10049030:  9 → 12.8
     8D-10049010:  5 →  7.6      ← dương tính giả KHÔNG bị đẩy lên trên
D5   17.3 s, chấm 10/10, không cộng điểm nào — mọi phán quyết dưới sàn 0.5
```

D5 không cộng gì là **khế ước hoạt động đúng**: model không thấy hành động khắc phục nào thật sự gỡ
được nguyên nhân này, và dưới sàn thì không cộng.

**Chưa nhìn tận mắt:** `analysis` của **từng ứng viên** từ một lượt gọi thật. Nó `required` trong
schema và đã được phủ bằng test provider giả, nhưng log chỉ in `queryAnalysis`. In ra bằng một
script ngắn khi `cf` đã đăng nhập.

---

## 5. Công tắc engine là toàn cục, không bao giờ theo bước

`mergeStepPrecedents` gộp kết quả tám bước thành **một danh sách được đánh số một lần**, giữ bản có
điểm cao nhất:

```ts
if (!seen || p.score > seen.score) best.set(p.notificationId, p);
```

Chạy lẫn lộn thì phép `>` đó đang so điểm graph (số bằng chứng có trọng số, không có trần cố định)
với điểm engine cũ (thang 0–16). `precedents#1` thôi không còn là case mạnh nhất, và **không lớp nào
bắt được**: `postProcess` chỉ kiểm trích dẫn khớp `^(team\.|precedents#)`, mà một trích dẫn sai vẫn
đúng cú pháp.

Nên `GraphRetrievalSettings` **không có cột `stepCode`**. Việc đối chiếu hai engine nằm ở
`scripts/shadow-retrieval.mjs`, **ngoài** luồng sinh báo cáo, nơi kết quả không thể rò vào output
cho người dùng.

---

## 6. Mọi thứ nằm ở đâu

### 6.1 File mới

| Đường dẫn | Vai trò |
|---|---|
| `srv/src/domain/eightd/graph/model.ts` | Nhãn, loại cạnh, tên workspace — một nguồn cho view, Cypher và test |
| `srv/src/domain/eightd/graph/anchor.ts` | `CaseContext` → giá trị neo + token; mệnh đề `OR` cho từ khoá |
| `srv/src/domain/eightd/graph/graphClient.ts` | Dựng `OPENCYPHER_TABLE`, bind tham số, kiểm workspace có hợp lệ không |
| `srv/src/domain/eightd/graph/probes.ts` | Mỗi hàm một loại bằng chứng; Cypher khớp mẫu, SQL đếm |
| `srv/src/domain/eightd/graph/stepProfiles.ts` | Tám bộ trọng số, chấm điểm thuần, `normalizeStepParams`, `applyRerankToScored` |
| `srv/src/domain/eightd/graph/hydrate.ts` | Khoá từ Cypher + nội dung từ bảng quan hệ → `Precedent` |
| `srv/src/domain/eightd/graph/settings.ts` | Công tắc engine, đọc/seed `GraphStepParams`, cache |
| `srv/src/domain/eightd/graph/engine.ts` | Chọn engine, gom bằng chứng một lần, chấm tám kiểu, chạy tầng 2 |
| `db/schema/graph-config.cds` | `GraphRetrievalSettings`, `GraphStepParams` |
| `db/src/*.hdbview` (32) + `GW_8D.hdbgraphworkspace` | Chính graph — là **view**, không phải bảng dữ liệu mới |
| `db/src/.hdiconfig`, `.hdinamespace` | Bắt buộc: bản CAP sinh nằm ở `db/src/gen` và **không map plugin nào** cho `hdbgraphworkspace` |
| `scripts/seed-graph-library.mjs` | Nạp 25 case JSON vào container graph |
| `scripts/shadow-retrieval.mjs` | Chạy một case qua **cả hai** engine rồi in bảng so sánh từng bước |
| `scripts/run-graph-tests.mjs` | Chạy bộ test chạm HANA với đúng biến môi trường |

### 6.2 File đã sửa

| Đường dẫn | Sửa gì |
|---|---|
| `db/schema/case-library.cds` | Cột mới `searchKeywords` |
| `srv/src/domain/eightd/precedent/librarySeeder.ts` | Ghi `searchKeywords`; coi dòng thiếu nó là chưa đủ để nạp lại |
| `srv/src/domain/eightd/precedent/reranker.ts` | Schema và prompt chain-of-thought; `analysis` trong verdict; timeout 20 s → 45 s |
| `srv/src/domain/eightd/eightDAnalyzer.ts` | Hai chỗ gọi: `findPrecedentsByStep` → `findPrecedents` |
| `srv/AiAdminService.cds` | Expose `GraphRetrievalSettings` và `GraphStepParams` |
| `srv/src/services/aiAdminService.ts` | Cảnh báo khi lưu một cấu hình mà engine đang chạy không đọc |
| `srv/server.ts` | Seed `GraphStepParams` lúc khởi động |

**Hợp đồng `PerStepPrecedents` / `Precedent` không đổi.** `eightDAnalyzer`, `prompts`,
`postProcess`, `buildRuntimeSources` và UI đều đọc hình dạng đó, nên quay về engine cũ là một thay
đổi cấu hình chứ không phải một lần revert.

---

## 7. Cấu hình

| Bảng | Có tác dụng khi | Sửa lúc chạy | Ràng buộc |
|---|---|---|---|
| `GraphRetrievalSettings` | luôn luôn | có | một dòng, `ID = 'GLOBAL'` |
| `GraphStepParams` | `engine = 'graph'` | có | `wKeywords` **và** `wRerank` phải `< minScore` |
| `ProfileCriteria`, `RetrievalProfiles`, `StepRetrievalBindings` | `engine = 'scoring'` | có | tiêu chí rerank theo profile |
| Câu Cypher | — | **không** — nằm trong code | có version, có test, không nhận chuỗi tự do từ DB |

### 7.1 Bất biến

`normalizeStepParams` **từ chối cả dòng** khi `wKeywords >= minScore` hoặc `wRerank >= minScore`,
log lý do, và dùng mặc định.

- `wKeywords >= minScore` nghĩa là **một** từ khoá chung tự nó đủ điểm làm tiền lệ — R3 quay lại
  qua đường cấu hình.
- `wRerank >= minScore` nghĩa là **một mình model quyết**, kể cả với case không chung một quan hệ
  nào trong graph — tức vứt bỏ đúng thứ đã chọn graph để có: mỗi kết quả phải có một đường đi.

Từ chối cả dòng **tốt hơn** kẹp con số lại: kẹp nghĩa là màn hình hiện một số còn hệ thống chạy một
số khác.

### 7.2 Bật lên

```sql
-- engine graph, cả tám bước
UPDATE GraphRetrievalSettings SET engine = 'graph' WHERE ID = 'GLOBAL';

-- tầng 2 cho D4 (minScore 5, nên wRerank phải ≤ 4)
UPDATE GraphStepParams SET wRerank = 4 WHERE stepCode = 'D4';
```

Cả hai có hiệu lực trong vòng cache cấu hình 30 giây. Lưu một cấu hình mà engine đang chạy không
đọc sẽ trả về thông báo chỉ sang bảng thật sự có tác dụng — đối xứng cả hai chiều, qua `req.info`
chứ không `req.reject`, vì cấu hình vẫn hợp lệ và có thể đang được chuẩn bị trước cho lần đổi engine.

---

## 8. Test thế nào

### 8.1 Offline — không cần credential, không cần mạng

```bash
npm run typecheck
npm test
```

**Kỳ vọng: 1126 pass, 22 skipped, 0 fail** trên 41 suite. 22 test skipped là nhóm chạm HANA; chúng
báo đúng chữ **skipped**, không bao giờ báo *passed*, vì cổng là `describe.skip` khai báo **tĩnh**
theo `GRAPH_INTEGRATION`. Cách "tự dò, không kết nối được thì lặng lẽ bỏ qua" sẽ cho ra một bộ test
xanh mà không chạy gì — tệ hơn không có test, vì nó **trông như** đã được phủ.

Phần offline phủ gì:

| Khu vực | Khoá lại điều gì |
|---|---|
| `graphClient.test.ts` | Giá trị đi vào ô bind, không bao giờ vào chuỗi truy vấn; không nhãn nào trùng từ khoá openCypher |
| `stepProfiles.test.ts` | Chấm điểm có trọng số; **một từ khoá chung không bao giờ tự nó đủ điểm** ở bất kỳ bước nào; tất định khi hoà; phép tách `accumulate`/`finalize`; chuẩn hoá cấu hình rerank và **cả hai** luật từ chối |
| `settings.test.ts` | Chuẩn hoá công tắc engine; giá trị lạ rơi về `scoring` |
| `rerankWiring.test.ts` | Toàn bộ chuỗi tầng 2 với provider giả: nội dung prompt, **thứ tự trường schema**, temperature 0, parse `analysis`, id bịa bị loại, và màn "cứu case" hai tầng trọn vẹn |
| `precedent/reranker.test.ts` | Phần chuẩn hoá và `applyRerank` của Thanh, cộng phần parse CoT |

### 8.2 Trên HANA thật

Điều kiện — container tách hẳn khỏi container dùng chung, nên **không có bước nào ở đây chạm vào**
`cnma_proresolve_db`:

```bash
npm run cf:cpea && npm run cf:sandbox   # đăng nhập, trỏ đúng sandbox
npm run deploy:graph                    # view + workspace + bảng cấu hình
npm run seed:graph                      # 25 case lịch sử
npm run test:graph                      # 79 pass
```

`deploy:graph` khoá cứng `--for graph`. Thiếu nó thì `cds deploy` ghi binding sau deploy vào
**`hybrid`** theo mặc định và **âm thầm** trỏ profile của cả team sang container này — đúng chuyện
đã xảy ra ở lần chạy đầu tiên.

Phần integration phủ gì:

- workspace deploy được và hợp lệ; kho có đủ 25 case
- **ràng buộc phương ngữ không phải Cypher chuẩn**: quan hệ phải có tên biến, và hình chữ V phải
  viết bằng mẫu ngăn dấu phẩy vì mũi tên ngược không parse
- đường `[*1..2]` — năng lực duy nhất SQL không thay được ở đây
- giá trị thù địch qua `PARAMETERS` trả về rỗng, tức nó ở lại làm dữ liệu
- chuỗi `OR` cho từ khoá, thứ chỉ tồn tại vì `IN [$a,$b]` bị từ chối
- **R3(a)**: `8D-10049030` chung ba từ, `8D-10049010` chung một từ
- **R3(b)**: `"pocket depth"` tìm ra `8D-10048880` — case hôm nay chấm **+0**
- D1 đếm số case mỗi người tham gia (`100001`, Quality Engineer, 3 case ở `WC-MILL-07`)
- D5 đi tới mã nhiệm vụ khắc phục qua `RootCause` (`TSK-3010`, 4 case)
- tám bước **không** cùng trả một danh sách
- cấu hình ghi vào DB có hiệu lực, và dòng vi phạm bị từ chối

### 8.3 Trên model thật

`npm run test:graph` **không gọi được model**: ts-jest chạy CJS còn provider của CDK nạp ESM động,
nên lượt gọi chết với `Unexpected token 'export'` và pipeline rơi về tầng 1. Rơi về là hành vi
**đúng**, nên test buộc phải chấp nhận — nghĩa là nó chứng minh *"bật re-rank không làm vỡ
pipeline"*, **không** chứng minh *"lượt gọi model chạy được"*.

Lượt gọi thật chạy bằng shadow script, dưới tsx/ESM đúng như production:

```bash
npm run shadow:graph                            # cả 25 case, hai engine
npm run shadow:graph -- 8D-10048412             # một case
npm run shadow:graph -- 8D-10048412 --rerank    # bật tầng 2 cho D4/D5
```

`--rerank` suy `wRerank` theo `minScore` của **từng bước** rồi trả lại nguyên trạng. Bản đầu đặt
cứng `wRerank = 4` và D5 (`minScore 4`) **từ chối** — nó in "đã bật re-rank" trong khi D5 chưa từng
chạy tầng 2.

Kỳ vọng khi có `--rerank`:

```
[shadow] re-rank BẬT: D5 wRerank=3, D4 wRerank=4
[precedent-rerank] Re-rank: 10/10 ứng viên được chấm trong ~24000ms · cơ chế model đọc ra: …
    D4   8D-10049030:12.8  8D-10049010:7.6      | scoring: 8D-10049010:9 …
```

### 8.4 Đọc một lượt shadow thế nào

Chạy đủ, 25 case × 8 bước = 200 ô:

| | |
|---|---|
| cả hai engine cùng tìm ra | 98 |
| chỉ graph tìm ra | 372 |
| chỉ engine cũ tìm ra | 78 |
| graph nói "không có" | 27 / 200 |
| engine cũ nói "không có" | 104 / 200 |

Đọc cẩn thận — **tìm ra nhiều hơn không tự nó là tốt hơn**; R4 cảnh báo đúng về chuyện đó. Hai điều
kết luận được chắc chắn:

- Engine cũ trả **danh sách y hệt nhau cho cả tám bước**, ở mọi case. Đó là khiếm khuyết mà cả đợt
  này sinh ra để sửa.
- Graph rộng tay hơn, nhưng **không gì lọt vào mà không có một quan hệ có tên vượt ngưỡng**, và mỗi
  kết quả mang theo đường đi đã biện minh cho nó. Ở chỗ quan trọng nó còn **sẵn sàng từ chối** hơn:
  nhiều case graph trả "không có" cho D4 trong khi engine cũ đưa ra hai case đúng điểm sàn 3.

Con số 372 **vẫn cần soi lại** `topN` và `minScore`. Nó chưa phải bằng chứng rằng mặc định đang đúng.

---

## 9. Hỏng chỗ nào thì mất gì

| Hỏng | Hành vi | Mất gì |
|---|---|---|
| Graph workspace chưa deploy | rơi về engine chấm điểm; log nói rõ điều kiện nào không đạt | không mất tiền lệ |
| Truy vấn graph ném lỗi | rơi về engine chấm điểm | không mất tiền lệ |
| Re-rank hết giờ hoặc parse hỏng | giữ nguyên xếp hạng tầng 1 | mất tầng 2, giữ tầng 1 |
| Phán quyết dưới sàn | không cộng điểm, không thêm mục bằng chứng | không gì cả — khế ước hoạt động đúng |
| Cấu hình vi phạm bất biến | từ chối cả dòng, dùng mặc định, log lý do | không mất, và **không âm thầm** |
| Cả hai engine hỏng | báo cáo viết không có tiền lệ, kèm lý do | không bịa tiền lệ |

"Không tìm thấy tiền lệ" và "engine không chạy" nhìn từ ngoài **giống hệt nhau**. Phân biệt được hai
thứ đó là việc của log.

---

## 10. Một cái bẫy của harness cần biết

`cds.connect.to('db')` **không nạp CDS model**. Server thật luôn có model vì `cds.serve` nạp nó;
một tiến trình jest hay một script thì không. Raw SQL vẫn chạy bình thường nên phần lớn mọi thứ vẫn
xanh — nhưng **CQN mất khả năng ánh xạ tên**, và `UPDATE(...).set({ topN: 1 })` **im lặng không ghi
gì**.

Nó đã cắn hai lần ở đây: mọi test cấu hình sẽ đọc lại đúng giá trị mặc định và **pass**, chứng minh
một điều không hề đúng (và nó đã kịp làm hỏng một dòng đã seed); rồi cờ `--rerank` của shadow script
in ra "đã bật" trong khi không ghi gì.

Mọi script hoặc test dùng CQN **phải nạp model trước**:

```ts
if (!cds.model) {
    cds.model = cds.linked(cds.compile.for.nodejs(await cds.load(cds.resolve('*'))));
}
```

---

## 11. Còn dở

- Embedding **chưa** được nối làm booster ở engine graph; `semanticUsed` báo `false` thay vì báo
  bừa. Khi `engine = 'graph'`, vector search chạy cho **không bước nào**.
- Truy vấn Is/Is-Not của D2 và non-recurrence của D6 đã kiểm là chạy được, nhưng **chưa** được nối
  vào input của hai bước đó — cả hai sinh dữ liệu nằm ngoài hợp đồng `Precedent`.
- `prompts.ts:137-139` vẫn hardcode công thức chấm điểm cũ (phát hiện R2).
- `mta.yaml` vẫn khai một HDI container; container graph chỉ được thêm khi nhánh này deploy lên CF,
  và thêm như một resource **thứ hai** bên cạnh cái đang có.
- Một banner trên màn hình Similarity sẽ tốt hơn thông báo sau-khi-lưu hiện tại. Backend đã expose
  đủ thứ màn hình cần để vẽ nó.
- `analysis` của từng ứng viên **chưa** được đọc từ một lượt gọi model thật (xem §4.6).
