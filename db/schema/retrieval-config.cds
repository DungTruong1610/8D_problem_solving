namespace cnma.proresolve;

using { cuid, managed } from '@sap/cds/common';
using { cnma.proresolve.Reports } from './eight-d';

/**
 * Tiêu chí chấm điểm tương đồng — sửa trên UI, không phải sửa code.
 *
 * ── Vì sao mỗi tiêu chí có một mức dự phòng ──
 * Requirement định nghĩa ba tiêu chí, trong đó hai cái có mức thấp hơn khi không
 * khớp chính xác:
 *
 *     work center trùng                          +4
 *     defect code trùng  +4  · hoặc trùng từ khoá mô tả  +2
 *     material trùng     +3  · hoặc cùng họ vật tư       +1
 *     ─────────────────────────────────────────────────────
 *     tối đa                                             11
 *
 * Mô hình hoá thành năm dòng độc lập sẽ sai: một case trùng cả defect code lẫn
 * từ khoá sẽ ăn 4+2 = 6, phá trần 11 và phá luôn ví dụ 7/11 trong requirement.
 * Nên mỗi tiêu chí là MỘT dòng có hai mức, và mức dự phòng chỉ được xét khi mức
 * chính trượt.
 *
 * ── Vì sao là bảng chứ không phải hằng số ──
 * Trọng số là dữ liệu. Chỉnh trên UI phải có hiệu lực ngay, không cần deploy lại.
 * Danh sách dạng bảng cũng là chỗ chừa cho vector sau này: thêm một dòng
 * `semantic` với `matchType = 'cosine'` là xong, không phải thiết kế lại.
 */
entity SimilarityCriteria : managed {

    /** workCenter | defectCode | material — mã ổn định, code tra theo cột này. */
    key criterionKey   : String(40);

        label          : String(100);
        description    : String(500);

        /**
         * Bảng/nguồn dữ liệu tiêu chí này đọc. Hiện trên UI để admin biết tắt
         * một tiêu chí thì mất đi nguồn nào.
         */
        sourceTable    : String(60);
        /** Cột trên HistoricalCases dùng để so ở mức chính. */
        sourceField    : String(60);
        /** exact | keyword | family — hiện tại chỉ dùng exact ở mức chính. */
        matchType      : String(20)  default 'exact';
        weight         : Integer;

        // ── Mức dự phòng, chỉ xét khi mức chính trượt ────────────────────────
        /** Null = tiêu chí này không có mức dự phòng. */
        fallbackField  : String(60);
        /** keyword = trùng từ khoá · family = cùng nhóm vật tư. */
        fallbackMatch  : String(20);
        fallbackWeight : Integer;

        /**
         * Ngưỡng riêng cho tiêu chí ngữ nghĩa (`matchType = 'cosine'`).
         *
         * Cosine giữa hai case bất kỳ hiếm khi bằng 0 — hai đoạn văn kỹ thuật
         * tiếng Anh luôn giống nhau ở mức nền. Đo thực tế trên bộ dữ liệu này:
         * cùng chủ đề ≈ 0.72, khác hẳn chủ đề ≈ 0.29. Không đặt sàn thì mọi case
         * đều được cộng một ít điểm và thứ hạng bị nhiễu nền chi phối.
         *
         * Dưới sàn ⇒ 0 điểm. Null với các tiêu chí không phải cosine.
         */
        minSimilarity  : Decimal(3, 2);

        /** Tắt ⇒ tiêu chí không tính điểm VÀ không tính vào điểm tối đa. */
        enabled        : Boolean     default true;
        sortOrder      : Integer;
}

/**
 * Ngưỡng và số lượng tiền lệ. Đúng một dòng, khoá cố định 'GLOBAL'.
 *
 * Không có cột "loại chính case đang xử lý": đó là luật đúng/sai chứ không phải
 * sở thích. Case hiện tại luôn tự khớp 11/11 và luôn phải bị loại — để admin tắt
 * được chỉ tạo ra một cách tự bắn vào chân.
 */
entity RetrievalSettings : managed {
    key ID         : String(10)  default 'GLOBAL';

        /** Dưới ngưỡng ⇒ báo "không có tiền lệ", KHÔNG trả đại kết quả top đầu. */
        minScore   : Integer     default 3;
        /** N tiền lệ lấy ra. */
        topN       : Integer     default 3;
        /** Chỉ case Completed/Closed mới được làm tiền lệ. */
        closedOnly : Boolean     default true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile chấm điểm — một bộ trọng số cho MỘT nhóm bước D
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Một bộ tiêu chí + ngưỡng, đặt tên được, gán được cho từng bước D.
 *
 * ── Vì sao không dùng chung một bộ trọng số cho cả 8 bước ──
 * Tám bước 8D hỏi tám câu khác nhau, nên "case nào giống case này" cũng có tám
 * nghĩa khác nhau:
 *
 *     D1 cần NGƯỜI đã làm loại lỗi này    ⇒ work center và họ vật tư nặng ký
 *     D3 cần HÀNH ĐỘNG chặn cùng kiểu lỗi ⇒ defect code nặng ký
 *     D4 cần CÙNG CƠ CHẾ HỎNG             ⇒ ngữ nghĩa nặng ký, mã lỗi nhẹ đi
 *                                            (cùng cơ chế thường khác mã lỗi)
 *
 * Một bộ trọng số duy nhất buộc cả tám bước dùng chung một thoả hiệp, và thoả
 * hiệp đó không tối ưu cho bước nào. Chỉnh nó cho D4 tốt lên là làm D1 xấu đi —
 * chính xác cái vòng luẩn quẩn đã đẩy tới thiết kế này.
 *
 * ── Vì sao là profile có tên, không phải "mỗi bước một bộ" ──
 * Tám bộ độc lập nghĩa là sửa một nguyên tắc chung phải sửa tám chỗ. Thực tế
 * D3/D5/D7 (hành động) dùng chung một định nghĩa tương đồng, D2/D4 (chẩn đoán)
 * dùng chung một định nghĩa khác. Profile có tên cho phép ba bước trỏ vào MỘT
 * bộ — sửa một lần, cả ba bước đổi theo.
 */
entity RetrievalProfiles : managed {

    /** default | actions | diagnosis … — mã ổn định, binding tra theo cột này. */
    key profileKey  : String(40);

        label       : String(100);
        description : String(500);

        /**
         * Ngưỡng riêng của profile. Decimal chứ không Integer: tiêu chí ngữ nghĩa
         * cho điểm liên tục (trọng số × cosine), nên một profile thiên về ngữ
         * nghĩa cần đặt ngưỡng ở 3.5 chứ không phải làm tròn về 3 hay 4.
         */
        minScore    : Decimal(5, 2) default 3;
        topN        : Integer       default 3;
        closedOnly  : Boolean       default true;

        /** Profile hệ thống không xoá được — luôn còn một bộ để mọi bước rơi về. */
        isSystem    : Boolean       default false;
        sortOrder   : Integer       default 100;

        criteria    : Composition of many ProfileCriteria
                          on criteria.profile = $self;
}

/**
 * Một tiêu chí chấm điểm bên trong một profile.
 *
 * Cùng hình dạng với `SimilarityCriteria` — cố ý, để `scoring.ts` chấm được cả
 * hai bằng đúng một hàm. Khác đúng một chỗ: `sourceField` ở đây nhận CẢ đường
 * dẫn trong payload SAP (`causesIshikawa[].category`) chứ không chỉ tên cột trên
 * `HistoricalCases`. Xem `sourceFields.ts` để biết đường dẫn được phân giải ra sao.
 */
entity ProfileCriteria : managed {

    key profile        : Association to RetrievalProfiles;
    /** Khoá trong phạm vi profile. Hai profile được phép dùng lại cùng một khoá. */
    key criterionKey   : String(40);

        label          : String(100);
        description    : String(500);
        sourceTable    : String(60);

        /**
         * Cột trên `HistoricalCases`, HOẶC đường dẫn trong payload SAP đã làm
         * phẳng. Cột có index thì lọc được bằng SQL; đường dẫn thì chỉ chấm được
         * trong TS — `sourceFields.ts` phân biệt hai loại và UI hiện rõ.
         */
        sourceField    : String(200);
        /** exact | keyword | family | cosine — đúng những nhánh có trong `scoring.ts`. */
        matchType      : String(20)  default 'exact';
        weight         : Integer;

        fallbackField  : String(200);
        fallbackMatch  : String(20);
        fallbackWeight : Integer;

        /** Sàn cosine, chỉ dùng với `matchType = 'cosine'`. Xem `SimilarityCriteria`. */
        minSimilarity  : Decimal(3, 2);

        enabled        : Boolean     default true;
        sortOrder      : Integer;
}

/**
 * Bước D nào chạy profile nào. Đúng tám dòng, D1…D8.
 *
 * ── Vì sao là bảng riêng chứ không phải cột trên `StepPrompts` ──
 * `StepPrompts` nói bước D *viết* thế nào; bảng này nói bước D *tìm* thế nào.
 * Hai vòng đời khác nhau: reset prompt về mặc định là chuyện thường, và nó không
 * được phép kéo theo việc mất cấu hình tìm kiếm.
 *
 * Thiếu dòng hoặc profile đã bị xoá ⇒ rơi về profile `default`. Không bao giờ để
 * một bước không có profile: như thế là bước đó im lặng mất hết tiền lệ.
 */
entity StepRetrievalBindings : managed {
    /** D1 … D8. */
    key stepCode  : String(4);

        label     : String(100);
        profile   : Association to RetrievalProfiles;
        sortOrder : Integer;
}

/**
 * Prompt cho từng bước D — sửa trên UI.
 *
 * Trống hoặc tắt ⇒ code rơi về hằng số trong `srv/src/domain/eightd/prompts.ts`.
 * Nhờ vậy cài đặt bảng này KHÔNG đổi hành vi cho tới khi có người thật sự sửa
 * prompt, và luôn có đường quay về bản chạy được.
 */
entity StepPrompts : managed {
    /** D1 … D8. */
    key stepCode     : String(4);

        label        : String(100);
        description  : String(500);

        /** Vai trò và luật. Trống ⇒ dùng hằng số trong code. */
        systemPrompt : LargeString;
        /**
         * Khung nội dung gửi kèm. Placeholder `{{caseContext}}`, `{{precedents}}`,
         * `{{candidates}}` được thay lúc chạy. Trống ⇒ dùng khung mặc định.
         */
        userTemplate : LargeString;

        /** Four-tab configuration used by the enriched step prompt editor. */
        inputSchemaJson : LargeString;
        combinedPrompt  : LargeString;
        formSchemaJson  : LargeString;
        constraintsJson : LargeString;

        enabled      : Boolean   default true;
        /** Tăng mỗi lần lưu — để biết prompt nào đã sinh ra kết quả nào. */
        version      : Integer   default 1;
}

/**
 * Vết mỗi lần AI đề xuất và người dùng xử lý đề xuất đó.
 *
 * Requirement mục 3 bắt buộc có: *"Every AI action (draft shown, suggestion
 * accepted/rejected) is logged"*. Ghi cả `shown` chứ không chỉ `accepted` —
 * tỉ lệ bị từ chối mới là con số nói lên chất lượng gợi ý.
 */
entity SuggestionAudit : cuid, managed {
    report   : Association to Reports;
    /** D1 … D8. */
    stepCode : String(4);
    /** shown | accepted | rejected | edited */
    action   : String(20);
    /** JSON của đề xuất tại thời điểm đó. */
    payload  : LargeString;
    /** Người thao tác. `createdBy` của `managed` giữ user kỹ thuật. */
    actor    : String(120);
}
