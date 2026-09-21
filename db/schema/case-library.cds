namespace cnma.proresolve;

using { cuid, managed } from '@sap/cds/common';

/**
 * Kho case 8D lịch sử — nguồn duy nhất để tìm tiền lệ.
 *
 * ── Vì sao tách khỏi `Reports` ──
 * `Reports` là MỘT DÒNG MỖI LẦN CHẠY phân tích: chạy lại cùng một case ba lần thì
 * có ba dòng. Kho tiền lệ cần đúng một dòng mỗi case, và phải sống độc lập với
 * việc ai đó có bấm phân tích hay không. Trộn hai thứ lại thì mỗi lần chạy thử
 * lại làm lệch phép đếm tần suất của D1.
 *
 * ── Vì sao phẳng, không join master data ──
 * Chấm điểm so ba khoá: work center, defect code, material. Cả ba phải nằm ngay
 * trên dòng để lọc bằng index. Dựng bảng Material/WorkCenter riêng chỉ để join
 * lại đúng một dòng là trả giá bằng mọi câu truy vấn mà không được gì.
 */
@assert.unique: { notification: [notificationId] }
entity HistoricalCases : cuid, managed {

    /** Khoá nghiệp vụ. Mọi trích dẫn tiền lệ đều dùng mã này. */
    notificationId    : String(30)  @mandatory;

    // ── Header ───────────────────────────────────────────────────────────────
    origin            : String(30);
    symptomShortText  : String(255);
    /** In Process | Completed | Closed. Chỉ case đã đóng mới được làm tiền lệ. */
    sapStatus         : String(30);
    foundDate         : Date;
    completionDate    : Date;
    quantityExtent    : String(60);

    // ── Ba khoá chấm điểm ────────────────────────────────────────────────────
    workCenterId      : String(30);
    workCenterDesc    : String(255);
    /**
     * Nhóm mã lỗi (catalog type 9). Lưu ở đây để tiêu chí "cùng nhóm mã lỗi" có
     * cái mà so — nhưng CHƯA có trọng số nào: tiêu chí đó thuộc luồng AI
     * (RET-07), không thuộc đợt này. Cột được nạp trước, để khi luồng kia bật
     * tiêu chí lên thì không phải nạp lại toàn bộ kho.
     *
     * Null ở case cũ nhập từ workbook — workbook không khai nhóm.
     */
    defectCodeGroup   : String(30);
    defectCode        : String(30);
    defectText        : String(255);
    materialId        : String(30);
    materialDesc      : String(255);

    /**
     * Nhóm vật tư (MATKL của SAP) — dùng cho tiêu chí "cùng họ vật tư: +1".
     *
     * Suy ra LÚC NẠP, không tính lại mỗi lần chấm: chấm điểm phải là phép so
     * sánh thuần. Null khi nguồn không khai nhóm — khi đó tiêu chí này không
     * bao giờ ăn điểm, thay vì đoán bừa một họ.
     */
    materialFamily    : String(30);

    /**
     * Token đã chuẩn hoá của `defectText`, phân tách bằng khoảng trắng.
     *
     * Cũng tính sẵn lúc nạp vì lý do trên. Tiêu chí "trùng từ khoá mô tả lỗi"
     * so hai chuỗi này chứ không so `defectText` thô — nếu không thì mỗi lần
     * chấm lại phải tách từ, bỏ dấu, hạ chữ hoa cho cả kho.
     */
    defectKeywords    : String(500);

    /**
     * Token của `defectText` **và** `symptomShortText` gộp lại — nguồn của đỉnh
     * `Keyword` trong graph.
     *
     * ── Vì sao không dùng lại `defectKeywords` ──
     * Cột kia chỉ tách từ `defectText`, tức là văn bản của DANH MỤC mã lỗi. Câu
     * chữ của người vận hành nằm ở `symptomShortText` và chưa bao giờ được đọc.
     * Hậu quả đo được: case `8D-10048880` mang tiêu đề *"Bracket housing pocket
     * depth varying unit to unit"* ăn 0 điểm trước một case mô tả *"pocket depth
     * reading shallow"* — cụm từ khớp rõ nhất trong cả phép thử vô hình với engine,
     * vì nó nằm ở đúng cái trường không ai so. Đây là phát hiện R3(b) trong
     * `docs/PRECEDENT-RETRIEVAL-REVIEW.md`.
     *
     * ── Vì sao là cột chứ không tách trong SQL của view ──
     * View graph chỉ được phép cắt chuỗi theo khoảng trắng. Nếu nó tự hạ chữ hoa,
     * tự loại stopword, tự lọc độ dài thì đó là BẢN THỨ HAI của
     * `tokenizeDefectText` — và hai bản sẽ lệch nhau ngay lần đầu ai đó thêm một
     * stopword, một cách âm thầm: không bao giờ khớp mà cũng không bao giờ báo lỗi.
     * Cột này được tính bằng CHÍNH hàm đó lúc nạp kho, nên view chỉ còn việc
     * `SUBSTR_REGEXPR('[^ ]+' …)`.
     *
     * Dài 1000 vì nó gộp hai nguồn; `defectKeywords` 500 chỉ gánh một.
     */
    searchKeywords    : String(1000);

    /**
     * Dòng này vào kho bằng đường nào.
     *
     *   closed-in-app  case do chính app này đóng ở D8
     *   imported       nạp hàng loạt từ dữ liệu cũ (workbook, export SAP)
     *
     * ── Vì sao phải phân biệt ──
     * Khi ai đó hỏi "sao AI lại gợi ý cái này", điều đầu tiên muốn biết là tiền lệ
     * đó có phải một case thật đã đóng hay chỉ là một dòng di trú. Hai thứ đó không
     * đáng tin ngang nhau: case đóng trong app có vết duyệt của con người trên từng
     * bước D, dòng import thì chỉ có những gì file cũ ghi lại.
     *
     * Chỉ có ĐÚNG hai đường vào kho, và cả hai đều điền cột này. Không có đường
     * thứ ba: `HistoricalCases` không mở CREATE trên service nữa.
     */
    provenance        : String(20);

    /**
     * ID của lượt chạy 8D đã sinh ra dòng này. Null với dòng import.
     *
     * `notificationId` không thay được cột này: một case có thể được phân tích lại
     * nhiều lần, nên có nhiều `Reports` cùng mang một số. Cột này chỉ đúng một lượt
     * — chính lượt mà con người đã duyệt xong và bấm đóng.
     */
    sourceReportID    : String(36);

    // ── Bối cảnh hiển thị trong panel tiền lệ ────────────────────────────────
    batchId           : String(30);
    rootCauseCategory : String(30);
    copqEur           : Decimal(15, 2);
    fmeaId            : String(30);

    /** JSON gốc của case, giữ nguyên vẹn — dựng lại chi tiết mà không cần bảng phụ. */
    sourcePayload     : LargeString;

    /**
     * `sourcePayload` đã làm phẳng thành map `đường dẫn → giá trị`, tính lúc nạp.
     *
     * ── Vì sao cần cột này khi đã có `sourcePayload` ──
     * Admin kéo một field bất kỳ của SAP vào profile chấm điểm — kể cả field
     * không có cột riêng ở trên, ví dụ `causesIshikawa[].category`. Chấm điểm
     * phải đọc được nó mà KHÔNG phải parse lại cả cây JSON cho từng ứng viên,
     * từng tiêu chí, từng lần chấm.
     *
     * ── Vì sao không thêm cột thật cho mỗi field ──
     * Payload SAP có ~50 leaf field và còn đổi. Mỗi field mới một cột nghĩa là
     * mỗi lần SAP thêm trường là một lần migration schema — trong khi giá trị
     * của tính năng này nằm ở chỗ admin tự cấu hình được mà không cần deploy.
     *
     * Đánh đổi đã biết: field trong map này KHÔNG lọc trước được bằng SQL, chỉ
     * chấm trong TS. Chấp nhận được vì `fetchCandidates` vốn đã quét toàn bộ kho
     * mỗi khi tiêu chí ngữ nghĩa bật — xem `nonFilterableReach`.
     */
    attributesJson    : LargeString;

    // ── Tìm theo ngữ nghĩa ───────────────────────────────────────────────────

    /**
     * Đoạn văn được đem đi nhúng. Ghép lúc nạp kho, xem `buildSearchText`.
     *
     * Lưu lại chứ không ghép lại mỗi lần vì hai lý do: nó là thứ giải thích được
     * *vì sao* hai case gần nhau, và khi đổi công thức ghép thì so hai cột này
     * biết ngay case nào cần nhúng lại.
     */
    searchText        : LargeString;

    /**
     * Vector 1536 chiều, lưu dạng mảng JSON.
     *
     * ── Vì sao JSON chứ không `cds.Vector` / REAL_VECTOR ──
     * REAL_VECTOR + COSINE_SIMILARITY chỉ có trên HANA. SQLite không có, nên
     * chọn nó là mất khả năng chạy và TEST toàn bộ phần tìm kiếm ở local — trong
     * khi kiến trúc ở đây vốn đã là "lọc bằng SQL rồi chấm trong TS", tức là
     * cosine chạy trên vài chục dòng chứ không phải cả kho.
     *
     * Khi nào đổi sang REAL_VECTOR: khi tập ứng viên sau lọc vượt vài nghìn dòng.
     * Lúc đó thêm cột vector song song và chuyển phép cosine xuống SQL; cột này
     * vẫn giữ để đối chiếu.
     */
    embedding         : LargeString;

    /**
     * Model đã sinh ra vector. BẮT BUỘC kiểm trước khi so.
     *
     * Vector của hai model khác nhau KHÔNG so sánh được — kết quả trông vẫn chạy
     * nhưng sai hoàn toàn. Đây là cái bẫy số ① trong `8d-vector-search-design.md`.
     */
    embeddingModel    : String(100);
    embeddedAt        : Timestamp;

    // `case` là từ khoá CDS nên association phải mang tên khác.
    team              : Composition of many HistoricalTeamMembers
                            on team.historicalCase = $self;
    actions           : Composition of many HistoricalActions
                            on actions.historicalCase = $self;
}

/**
 * Ai đã ở trong nhóm 8D của case nào — đây chính là thứ D1 đọc.
 *
 * D1 gom nhóm bảng này theo `functionTitle` để ra vai trò gợi ý, và theo
 * `partnerId` để ra danh sách người xếp theo số lần tham gia.
 */
entity HistoricalTeamMembers : cuid {
    historicalCase : Association to HistoricalCases;

    partnerId     : String(30)  @mandatory;
    partnerName   : String(100);
    /** Quality Engineer, Production Engineer, … — gom nhóm theo cột này ra "vai trò". */
    functionTitle : String(100);
    /** 8D Team Leader | 8D Team Member. */
    partnerRole   : String(50);

    /** Auto-fill khi người dùng chọn partner. Rule-based, không phải AI sinh. */
    email         : String(120);
    phone         : String(40);
}

/**
 * Hành động của case lịch sử.
 *
 * D1 chưa dùng. Nạp luôn vì D3/D5/D7 sẽ đọc chính bảng này ("hành động ngăn chặn
 * mà case tiền lệ điểm cao nhất đã làm") — nạp sau nghĩa là chạy lại cả job.
 */
entity HistoricalActions : cuid {
    historicalCase : Association to HistoricalCases;

    lineNo     : Integer;
    /** Containment | Corrective | Preventive — đã chuẩn hoá qua `classifyAction`. */
    actionType : String(30);
    actionText : String(1000);
    status     : String(30);

    /**
     * ── Quality Task của SAP, năm trường ──
     * Câu văn ở `actionText` đọc được nhưng không TRA được. Năm cột dưới đây là
     * thứ biến "lần trước gặp lỗi này chúng ta đã làm gì" từ một lần đọc lại văn
     * xuôi thành một phép đếm — và là điều kiện cho tiêu chí "case được sửa bằng
     * cùng một cách", thứ hôm nay không tính được.
     *
     * `taskCode` suy ra bằng luật (`classifyTaskCode`), KHÔNG bằng AI: một mã
     * sai trông y hệt một mã đúng và sẽ được đếm như nhau. Không nhận ra thì để
     * null — ô trống đếm được, mã sai thì không.
     *
     * Ba cột còn lại null trên case NHẬP TỪ dataset, vì nguồn không mang chúng —
     * cùng thái độ đã áp cho `HistoricalTeamMembers.email`/`phone`. Case đóng
     * TRONG app thì có đủ, do người dùng đã điền trên màn hình D3/D5/D7.
     */
    taskCode        : String(20);
    taskCodeGroup   : String(20);
    /** SAP Task Processor. Bằng `assignee` của task trên màn hình. */
    taskProcessor   : String(120);
    /** SAP Time Effort, tính theo ngày. Bằng `durationDays` của task. */
    timeEffort      : Decimal(5, 1);
    plannedEndDate  : Date;
}
