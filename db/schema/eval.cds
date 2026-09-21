namespace cnma.proresolve;

using { cuid, managed } from '@sap/cds/common';
using { cnma.proresolve.Reports } from './eight-d';

/**
 * Đánh giá pipeline 8D — một lượt chấm.
 *
 * ── Vì sao tính năng này tồn tại ──
 * Hôm nay hệ thống KHÔNG có logic chấm điểm báo cáo nào. Thứ gần nhất là một
 * checklist pass/fail chạy tay trong `scripts/run-analyze.ts`, không sinh ra con
 * số nào. Hệ quả: mỗi lần đổi prompt, đổi model, hay đổi một thiết lập truy hồi,
 * KHÔNG AI nói được pipeline tốt lên hay xấu đi.
 *
 * ── Ba con số, KHÔNG BAO GIỜ trộn ──
 * Luật cứng của cả tính năng:
 *
 *     complianceScore   tầng 1 — luật đúng/sai, thuần code, đối chiếu được bằng tay
 *     qualityScore      tầng 2 — ý kiến của judge, chỉ phủ những gì code không thấy
 *     agreementRate     tầng 3 — có đáp án thì mới đo, `aiAgreesWithRecord`
 *
 * Trộn một điểm tất định vào ý kiến của một model phá đúng cái thông tin đáng
 * giá: sau khi trộn, không còn biết điểm thấp là vì báo cáo phạm luật hay vì
 * model chấm khắt. Và nó phá luôn khế ước "tính lại được bằng tay".
 */
entity EvalRuns : cuid, managed {
        /** Người chạy tự đặt, ví dụ "Trước khi sửa prompt D4". */
        label           : String(120);

        /**
         * `analyze` chạy lại pipeline từ `sourcePayload` rồi chấm — hồi quy thật.
         * `grade-only` chấm lại báo cáo đã có trong DB — rẻ, dùng để dựng dữ liệu
         * hiệu chuẩn. `online` là một báo cáo lẻ được chấm ngay sau khi phân tích.
         */
        mode            : String(20);

        /** Tiền tố `notificationId`. Null = tất cả. `8D-1…` sạch, `8D-9…` bẩn. */
        datasetFilter   : String(60);
        status          : String(20);   // Running | Completed | Failed

        caseCount       : Integer;
        /** Đẩy thanh tiến độ, và là cách nhận ra một lượt chạy bị kẹt. */
        processedCount  : Integer;

        /**
         * Ảnh chụp cấu hình lúc chấm.
         *
         * ── Vì sao bắt buộc ──
         * Hai lượt chạy chỉ SO ĐƯỢC với nhau khi ảnh chụp của chúng khác nhau ở
         * đúng chỗ mình định đổi. Không có cột này thì "điểm tăng 8%" không phân
         * biệt được với "hôm nay ai đó cũng sửa thêm hai prompt khác".
         */
        configSnapshot  : LargeString;

        complianceScore : Decimal(5, 2);
        qualityScore    : Decimal(5, 2);
        agreementRate   : Decimal(5, 2);

        tokensUsed      : Integer;
        durationMs      : Integer;
        errorMessage    : String(1000);

        scores          : Composition of many EvalScores
                              on scores.run = $self;
}

/**
 * Điểm của MỘT pha trên MỘT case. Ba dòng cho mỗi case được chấm.
 *
 * ── Vì sao lưu theo pha chứ không một dòng mỗi case ──
 * Một con số cho cả báo cáo nói "7/13"; ba dòng theo pha nói "Frame ổn, Close
 * yếu" — tức nói được phải sửa bước nào. Gộp lại rồi phân tích sau là không làm
 * được: thông tin đã mất lúc gộp.
 */
entity EvalScores : cuid, managed {
        /** Null với chấm online — lúc đó không có lượt chạy nào. */
        run            : Association to EvalRuns;
        /** Null với `analyze` batch: chế độ đó KHÔNG lưu `Reports` mới. */
        report         : Association to Reports;

        notificationId : String(30);
        phase          : String(10);       // frame | cause | close

        qualityScore   : Decimal(5, 2);
        /**
         * Trần của pha này. KHÔNG cố định giữa các pha: pha Frame không có chiều
         * `actionability` nên trần thấp hơn. Lưu cùng điểm để tỉ lệ tính lại được
         * mà không phải biết thang.
         */
        maxScore       : Decimal(5, 2);

        /** `[{dimensionId, verdict, points, maxPoints, evidence, reason}]` — ma trận 6×3. */
        breakdownJson  : LargeString;

        // ── Tầng 1 cho phạm vi pha này — GIỮ RIÊNG khỏi điểm judge ────────────
        violationCount : Integer;
        repairCount    : Integer;
        /**
         * Số chiều judge không chấm được.
         *
         * Cao nghĩa là báo cáo quá mỏng để chấm — một vấn đề ở THƯỢNG NGUỒN, không
         * phải một điểm chất lượng thấp. Pha có quá nhiều abstain phải bị đánh dấu
         * chứ không phải được chấm điểm.
         */
        abstainCount   : Integer;
        judgeError     : String(500);
}

/**
 * Đề xuất đổi cấu hình do advisor sinh ra.
 *
 * Một điểm đánh giá mà không ai hành động được chỉ là một chỉ số làm đẹp báo cáo.
 * Bảng này là chỗ vòng lặp đóng lại: đo → chẩn → đề xuất → áp → đo lại.
 *
 * ── Chưa có writer ──
 * Advisor (bước 6-7 trong `plans/llm-as-judge-evaluation-plan.md`) CHƯA được
 * implement. Bảng khai trước vì hình dạng của nó là phần đã chốt trong plan, và
 * vì `EvalRuns.configSnapshot` chỉ có nghĩa khi có thứ tham chiếu vào nó.
 */
entity EvalSuggestions : cuid, managed {
        basedOnRun     : Association to EvalRuns;

        /** stepPrompt | constraint | profileCriterion | retrievalSetting | modelRouting */
        targetType     : String(30);
        targetKey      : String(80);       // "D5" | "diagnosis/rerank" | "activity:analyzeDefect"
        field          : String(60);

        /** Ảnh chụp lúc đề xuất — chứng minh nó đang phản ứng với giá trị nào. */
        currentValue   : LargeString;
        /**
         * Phải DÙNG ĐƯỢC NGAY. "Làm D5 cụ thể hơn" bị từ chối lúc parse;
         * "`minScore`: 3 → 2.5" thì nhận.
         */
        proposedValue  : LargeString;

        rationale      : String(1000);
        evidenceJson   : LargeString;
        expectedEffect : String(200);

        /**
         * Cái gì có thể XẤU ĐI. Bắt buộc.
         *
         * Mọi thay đổi cấu hình là một cuộc đánh đổi: hạ `minScore` làm hiện thêm
         * tiền lệ VÀ hiện thêm tiền lệ yếu. Một đề xuất không nêu được mặt xấu là
         * một đề xuất chưa nghĩ xong, nên nó bị từ chối.
         */
        risk           : String(500);
        confidence     : Decimal(3, 2);

        status         : String(20);       // open | applied | dismissed
        decidedBy      : String(120);
        decidedAt      : DateTime;
}
