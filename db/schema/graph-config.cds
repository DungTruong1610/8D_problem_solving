namespace cnma.proresolve;

using { managed } from '@sap/cds/common';

/**
 * Công tắc chọn engine truy hồi, và các tham số admin chỉnh được.
 *
 * ── Vì sao đúng MỘT dòng, và vì sao công tắc là TOÀN CỤC ──
 * Cách hiển nhiên để giảm rủi ro là bật dần từng bước: D4 chạy graph, bảy bước
 * còn lại giữ engine cũ. Cách đó sai, và sai một cách âm thầm.
 *
 * `mergeStepPrecedents` gộp kết quả tám bước thành MỘT danh sách được đánh số
 * MỘT LẦN, giữ lại bản có điểm cao nhất bằng một phép so sánh `>`. Chạy lẫn lộn
 * thì phép so sánh đó đang đặt điểm graph (số bằng chứng có trọng số, không có
 * trần cố định) cạnh điểm của engine cũ (thang 0–16) — hai thang đo khác nhau.
 * Hậu quả: `precedents#1` thôi không còn là case mạnh nhất, và không lớp nào bắt
 * được, vì `postProcess` chỉ kiểm trích dẫn có khớp `^(team\.|precedents#)` hay
 * không, mà một trích dẫn sai vẫn đúng cú pháp.
 *
 * Nên bảng này không có cột `stepCode`. Muốn đối chiếu hai engine thì dùng
 * `npm run shadow:graph` — nó chạy cùng một case qua cả hai rồi in bảng so sánh,
 * ngoài luồng sinh báo cáo, nơi kết quả không thể rò vào output cho người dùng.
 */
entity GraphRetrievalSettings : managed {
    key ID              : String(10) default 'GLOBAL';

        /**
         * `scoring` = engine chấm điểm cũ · `graph` = truy hồi bằng graph.
         *
         * Mặc định `graph` — truy hồi tiền lệ qua SAP HANA Graph Engine.
         */
        engine          : String(10) default 'graph';

        /**
         * Trần số từ khoá của case đang mở được đem đi truy vấn.
         *
         * Mỗi từ khoá thành một ô bind, nên đây cũng là trần số tham số. Có trần
         * vì một payload bất thường không được phép sinh ra câu truy vấn dài vô
         * hạn — nó sẽ hỏng ở tầng DB kèm một thông báo chẳng liên quan gì tới
         * nguyên nhân thật.
         */
        maxKeywords     : Integer    default 30;

        /**
         * Bật/tắt việc rơi về engine cũ khi graph không dùng được.
         *
         * Để `true` ở mọi môi trường thật. Chỉ tắt khi đang ĐO graph: rơi về âm
         * thầm là đúng cho người dùng nhưng lại giấu mất sự cố khỏi người đang thử.
         */
        fallbackEnabled : Boolean    default true;
}

/**
 * Trọng số và ngưỡng của TỪNG bước D — tám dòng, D1…D8.
 *
 * ── Vì sao là bảng chứ không phải hằng số trong code ──
 * Đây là nửa còn lại của quyết định *"Cypher trong code, admin chỉnh tham số"*.
 * Câu Cypher ở lại trong TypeScript vì nó cần version, cần test, và vì Cypher tự
 * do lấy từ DB là một bề mặt tấn công. Nhưng CON SỐ thì là dữ liệu: chỉnh trọng
 * số D4 không được phép đòi một lần deploy.
 *
 * ── Vì sao đây KHÔNG mâu thuẫn với công tắc engine toàn cục ──
 * Hai thứ khác hẳn nhau. Công tắc quyết định bước D được trả lời bằng phép đo
 * NÀO — trộn hai phép đo trong một báo cáo làm hỏng đánh số `precedents#N`.
 * Bảng này chỉ chỉnh phép đo graph khi nó đã được chọn, nên cả tám bước vẫn nằm
 * trên cùng một thang, và `mergeStepPrecedents` vẫn so được điểm với nhau.
 *
 * ── Vì sao mỗi bước một dòng chứ không phải profile dùng chung ──
 * `RetrievalProfiles` của engine cũ cho nhiều bước trỏ chung một profile, với lý
 * do "sửa một lần, cả ba bước đổi theo". Lý do đó không còn đúng ở đây: tám bước
 * này hỏi tám câu thật sự khác nhau — D7 cố tình KHÔNG cân work center, D4 cân
 * từ khoá gấp ba mọi thứ khác — nên không có hai bước nào chia sẻ được cùng một
 * bộ số. Một tầng gián tiếp không ai dùng chỉ là một tầng phải đọc qua.
 *
 * Bảng rỗng hoặc thiếu dòng ⇒ rơi về `DEFAULT_STEP_PROFILES` trong
 * `srv/src/domain/eightd/graph/stepProfiles.ts`. Nhờ vậy deploy bảng này KHÔNG
 * đổi hành vi cho tới khi có người thật sự sửa một con số.
 */
entity GraphStepParams : managed {
    /** D1 … D8. */
    key stepCode        : String(4);

        label           : String(100);
        /** Bước này hỏi gì. Hiện trên UI để người chỉnh biết mình đang chỉnh cái gì. */
        question        : String(500);

        // ── Trọng số theo loại bằng chứng ────────────────────────────────────
        //
        // Null = bước này KHÔNG cân loại đó, và null khác 0 ở chỗ nhìn thấy được:
        // loại không được cân thì không bao giờ xuất hiện trong đường bằng chứng.
        // D7 để `workCenter` null là có chủ ý — phòng ngừa là mở rộng ra NGOÀI
        // trạm đã hỏng, nên thưởng điểm cho việc cùng trạm là đi ngược mục đích.
        wWorkCenter     : Integer;
        wMaterial       : Integer;
        wMaterialFamily : Integer;
        wDefectCode     : Integer;
        /** Nhân với SỐ từ khoá chung, tới `keywordCap`. Đây là chỗ chữa R3. */
        wKeywords       : Integer;
        wContainment    : Integer;
        wCorrective     : Integer;
        wPreventive     : Integer;

        /**
         * Trần số từ khoá được tính điểm.
         *
         * Không có trần thì một mô tả dài dòng trùng tám chữ vặt sẽ vượt mọi tín
         * hiệu khác chỉ nhờ độ dài. Có trần thì "trùng nhiều" vẫn thắng "trùng
         * một" mà không biến độ dài mô tả thành thước đo.
         */
        keywordCap      : Integer;

        /**
         * Dưới ngưỡng ⇒ KHÔNG có tiền lệ, và nói thẳng ra như vậy.
         *
         * ── Ràng buộc phải giữ khi chỉnh ──
         * `wKeywords` phải NHỎ HƠN `minScore`. Nếu không thì MỘT từ khoá chung tự
         * nó đủ điểm, và đó chính xác là lỗi R3: hai case chỉ chung chữ `flange`
         * được đối xử như một case khớp thật. `normalizeStepParams` từ chối cấu
         * hình vi phạm và rơi về mặc định, thay vì mở lại lỗi đã đóng.
         */
        minScore        : Integer;
        topN            : Integer;

        // ── Tầng 2: re-rank bằng model ───────────────────────────────────────
        //
        // Dùng CHUNG `srv/src/domain/eightd/precedent/reranker.ts` với engine chấm
        // điểm. Hai engine khác nhau ở chỗ TÌM, không ở chỗ đọc hai đoạn văn xem
        // chúng có cùng cơ chế hỏng hay không — nên tầng 2 chỉ nên có một bản.

        /**
         * Điểm tối đa re-rank cộng vào. Null hoặc 0 ⇒ bước này KHÔNG re-rank.
         *
         * Tắt mặc định vì nó tốn một lượt gọi model mỗi lần tìm, và vì không ai
         * nên bật một tầng mới trước khi đối chiếu nó — `npm run shadow:graph`.
         *
         * Ràng buộc: phải NHỎ HƠN `minScore`, cùng luật với `wKeywords`. Bằng hoặc
         * lớn hơn nghĩa là chỉ cần model thích một case là case đó thành tiền lệ,
         * kể cả khi nó không chung một quan hệ nào trong graph — tức là vứt bỏ
         * đúng thứ đã chọn graph để có: mỗi kết quả phải có một đường đi giải
         * thích được.
         */
        wRerank           : Integer;

        /** Sàn trên thang 0–1 của điểm model (0.5 = dưới 50/100 thì 0 điểm). */
        rerankFloor       : Decimal(3, 2);

        // ── Khung chain-of-thought của bước này ──────────────────────────
        //
        // Ba mảnh, không phải một câu, vì lập luận phải bắt đầu từ đúng chỗ.
        // `rerankQueryFrame` là MỐC mà mọi điểm số được đo theo, và mốc đó khác
        // hẳn nhau giữa các bước: D4 xác lập cơ chế hỏng, D3 xác lập cái đang bị
        // phơi nhiễm, D7 xác lập tầm với hệ thống. Dùng chung một khung nghĩa là
        // bảy bước suy nghĩ theo câu hỏi của bước thứ tám — model vẫn trả lời
        // trôi chảy, chỉ là trả lời sai câu, và output không hề lộ ra điều đó.
        //
        // Ô nào trống thì rơi về mặc định CỦA BƯỚC ĐÓ trong `graph/stepProfiles.ts`.

        /** Model phải xác lập gì về case đang mở, TRƯỚC khi nhìn ứng viên nào. */
        rerankQueryFrame     : String(1000);
        /** So chiều nào giữa ứng viên và mốc vừa xác lập. */
        rerankCandidateFrame : String(1000);
        /** 0 và 100 nghĩa là gì ở bước này. Thiếu thì model tự bịa thang. */
        rerankRubric         : String(1000);

        /**
         * Loại hành động bước này quan tâm: Containment | Corrective | Preventive.
         *
         * Trống ⇒ bước không dò hành động. Không lọc thì D3 (chặn tạm) ăn điểm từ
         * hành động phòng ngừa của case khác — một câu trả lời trông hợp lý cho
         * một câu hỏi không ai đặt ra.
         */
        actionType      : String(20);

        enabled         : Boolean    default true;
        sortOrder       : Integer;
}
