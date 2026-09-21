namespace cnma.proresolve;

using { cuid, managed } from '@sap/cds/common';

/**
 * Lỗi chất lượng đã ghi nhận — SAP QM Quality Notification (QMEL).
 *
 * ── Vì sao phải tách khỏi `Reports` ──
 * Trước Phase 2, ghi nhận một lỗi và mở một báo cáo 8D là CÙNG MỘT thao tác: popup
 * "Record Defect" dựng payload rồi gọi thẳng `analyzeFromJson`. Hệ quả:
 *
 *   1. Không có chỗ nào ghi một lỗi mà CHƯA cần 8D. Mà phần lớn lỗi là loại đó —
 *      8D chỉ mở cho những lỗi đủ nghiêm trọng hoặc lặp lại.
 *   2. Muốn ghi nhận thì phải chấp nhận chạy AI. Ba phút, và một bản ghi báo cáo.
 *   3. Đường vào duy nhất là gõ lại từ đầu. Trong SAP thì đường bình thường là
 *      "mở 8D TỪ một lỗi đã có" — và đó chính là đường app này không có.
 *
 * Nên cùng một dữ kiện bị nhập hai lần: một lần lúc phát hiện, một lần lúc mở 8D.
 * Hai bản, và không có gì bắt chúng phải khớp nhau.
 *
 * ── Vì sao KHÔNG dùng `HistoricalCases` cho việc này ──
 * Tab "Historical Defects" cũ ghi thẳng vào kho tiền lệ. Nhưng kho đó được đọc với
 * `closedOnly: true` — nó là tập bài học ĐÃ CHỨNG MINH. Ghi một lỗi còn đang mở,
 * chưa có kết luận, vào đúng cái kho mà AI học từ đó, là dạy nó bằng câu hỏi.
 *
 *   Defects          lỗi lúc phát hiện        Open · In Process · Completed
 *   HistoricalCases  bài học sau khi đóng     Completed · Closed
 *
 * Phase 5 nối hai đầu: đóng 8D ở D8 thì case được ghi vào kho.
 */

/**
 * Vòng đời của một lỗi.
 *
 *   Open        đã ghi nhận, chưa ai xử lý. Đây là tập mà "Start an 8D" chọn từ.
 *   In Process  đã mở 8D (hoặc đang được xử lý bằng cách khác).
 *   Completed   đã xử lý xong.
 *
 * Cùng bộ giá trị với `Reports.sapStatus` có chủ đích: `precedentRepository`
 * coi `Completed` / `Closed` là "đã đóng", và một lỗi phải nói cùng thứ ngôn ngữ
 * với case sinh ra từ nó thì hai màn hình mới lọc được bằng cùng một luật.
 */
type DefectStatus : String(20) enum {
    Open;
    InProcess  @title: 'In Process';
    Completed;
}

entity Defects : cuid, managed {

    /**
     * Số notification (QMNUM). Do server cấp từ dải `DEFECT` (xem
     * `srv/src/domain/numberRange.ts`), hoặc mang theo từ dữ liệu nhập.
     *
     * Đây là số mà `Reports.notificationId` kế thừa khi mở 8D từ lỗi này. Một số,
     * hai bảng — không phải hai số cần đối chiếu.
     */
    defectId          : String(30)  @mandatory  @assert.unique;

    /** 'Q3 - Internal Defect' | 'Q1 - Customer Complaint' | 'Q2 - Supplier Defect' (QMART). */
    origin            : String(30);
    status            : DefectStatus default #Open;

    /** QMTXT — dòng duy nhất con người đọc để nhận ra lỗi này là lỗi nào. */
    symptomShortText  : String(255);
    foundDate         : Date;
    completionDate    : Date;

    /** RKMNG / MGEIN — lượng bị giữ. Số, vì báo cáo chất lượng cộng cột này. */
    defectQuantity    : Decimal(13, 3);
    defectQuantityUom : String(3);

    /** Khoá của HỆ THỐNG KHÁC: phiếu khiếu nại, phiếu giao hàng, ticket. */
    referenceNumber   : String(60);

    // ── Vật tư và nơi phát sinh ──────────────────────────────────────────────
    /** WERKS: CHAR(4) số trần ('1000'), không phải 'PL-1000'. */
    plant             : String(4);
    materialId        : String(30);
    materialDesc      : String(255);
    /** MATKL. Tiêu chí "cùng họ vật tư" khi tìm tiền lệ đọc cột này. */
    materialGroup     : String(30);
    batchId           : String(30);
    workCenterId      : String(30);
    workCenterDesc    : String(255);

    // ── Phân loại lỗi ────────────────────────────────────────────────────────
    /** Nhóm mã lỗi (catalog type 9). Luôn đi cùng `defectCode` — mã chỉ duy nhất TRONG nhóm. */
    defectCodeGroup   : String(30);
    defectCode        : String(30);
    defectText        : String(255);
    /** FECLAS. UI gọi là "Severity". */
    defectClass       : String(20);

    // ── Bối cảnh phát hiện ───────────────────────────────────────────────────
    /** 'during-inspection' | 'outside-inspection'. Quyết định có lô kiểm tra hay không. */
    entryMode         : String(30);
    inspectionLotId   : String(30);

    // ── Trách nhiệm ──────────────────────────────────────────────────────────
    reportedBy        : String(120);
    coordinator       : String(120);
    department        : String(120);

    // ── Khách hàng (chỉ có nghĩa với Q1) ─────────────────────────────────────
    // Case Q3/Q2 để trống ba ô này. Chuỗi sentinel 'N/A - ...' được dựng lúc build
    // payload chứ không lưu ở đây: một cột chứa 'N/A' không lọc được, không đếm
    // được, và trông y hệt dữ liệu thật trong mọi bản export.
    complaintReference   : String(60);
    customerPlantContact : String(120);
    slaResponseDue       : String(30);

    characteristics   : Composition of many DefectCharacteristics
                            on characteristics.defect = $self;
}

/**
 * Một dòng kết quả đo của lỗi (QAMR).
 *
 * ── Vì sao là bảng con chứ không phải JSON trong một cột ──
 * Đây là thứ D2 đem ra so sánh để dựng Is / Is-Not, và `resolveOutOfSpec` quyết
 * định dựa trên giới hạn dạng SỐ. Nhét vào một cột LargeString nghĩa là mỗi lần
 * muốn so lại phải parse, và parse hỏng thì kết luận vượt spec âm thầm về null.
 */
entity DefectCharacteristics : cuid, managed {
    defect          : Association to Defects;

    /** Thứ tự hiển thị. 1-based, liên tục — số nhảy cách trông như mất một dòng. */
    lineNo          : Integer;
    characteristic  : String(120)  @mandatory;
    measuredValue   : String(60);

    /**
     * Giới hạn dạng SỐ, đơn vị đứng riêng. `null` một vế = spec một phía; cả hai
     * null = dòng này chưa khai giới hạn, và khi đó `valuation` phải gánh.
     */
    specLowerLimit  : Decimal(15, 4);
    specUpperLimit  : Decimal(15, 4);
    specUom         : String(20);

    /** Phán quyết của người kiểm: 'Accepted' | 'Rejected'. Rỗng = CHƯA quyết, không phải đạt. */
    valuation       : String(20);
    equipment       : String(50);
}
