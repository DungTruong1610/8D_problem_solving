using { cnma.proresolve as ns } from '../db/schema/schema';

/**
 * Service báo cáo 8D — backend cho trang 8D Reports.
 *
 * Hai entity để đọc, hai action để chạy pipeline AI. Không mở CREATE/UPDATE
 * trực tiếp trên Reports: một report chỉ được sinh ra qua `analyzeFromJson`,
 * cho phép ghi tay sẽ tạo ra bản ghi không có `sourcePayload` và không
 * reanalyze được.
 */
@path: '/api/cnma/EIGHTD_SRV'
@(requires: 'authenticated-user')
service EightDService {

    /**
     * Báo cáo 8D. Đọc kèm disciplines bằng `?$expand=disciplines`.
     *
     * Không mở CREATE/UPDATE có chủ đích: report chỉ được sinh qua
     * `analyzeFromJson`, và tầng repository ghi thẳng xuống db chứ không qua
     * service này. Mở ghi ở đây chỉ tạo đường tắt để lọt vào bản ghi thiếu
     * `sourcePayload`, tức là không bao giờ chạy lại được.
     *
     * DELETE thì mở cho admin: mỗi lần phân tích tạo một bản ghi mới, nên chạy
     * thử nhiều lần sẽ tích rác. Không có đường xoá thì cách duy nhất để dọn là
     * xoá luôn file sqlite. Composition sẽ xoá disciplines theo.
     */
    @restrict: [
        { grant: 'READ',   to: 'authenticated-user' },
        { grant: 'DELETE', to: ['admin', 'Admin'] }
    ]
    entity Reports as projection on ns.Reports;

    @readonly
    entity Disciplines as projection on ns.Disciplines;

    /**
     * Lỗi chất lượng đã ghi nhận (QMEL).
     *
     * Mở đủ CRUD, khác hẳn `Reports`: một lỗi LÀ một bản ghi người dùng nhập, có
     * thể sửa khi phát hiện gõ sai vật tư hay work center. Còn `Reports` là kết
     * quả của một lượt chạy AI, ghi tay vào đó chỉ tạo ra bản ghi không có
     * `sourcePayload` và không chạy lại được.
     *
     * `defectId` do server cấp từ dải `DEFECT` — xem phần annotate ở cuối file.
     * Con `characteristics` ghi kèm bằng deep insert qua chính entity này.
     */
    @restrict: [
        { grant: ['READ'], to: ['admin', 'Admin', 'Auditor', 'User', 'authenticated-user'] },
        { grant: ['CREATE', 'UPDATE', 'DELETE'], to: ['admin', 'Admin', 'User'] }
    ]
    entity Defects as projection on ns.Defects;

    @restrict: [
        { grant: ['READ', 'CREATE', 'UPDATE', 'DELETE'], to: ['admin', 'Admin', 'User', 'authenticated-user'] }
    ]
    entity InspectionLots as projection on ns.InspectionLots;

    @readonly
    entity FmeaRegister as projection on ns.FmeaRegister;

    /**
     * Bằng chứng hoàn thành task (PDF evidence).
     *
     * Cho phép READ, CREATE, DELETE (KHÔNG cho UPDATE metadata trực tiếp: muốn
     * đổi file đã nộp thì xoá rồi nộp lại để vết rõ ràng).
     */
    @restrict: [
        { grant: ['READ'], to: ['admin', 'Admin', 'Auditor', 'User', 'authenticated-user'] },
        { grant: ['CREATE', 'UPDATE', 'DELETE'], to: ['admin', 'Admin', 'User'] }
    ]
    entity TaskEvidences as projection on ns.TaskEvidences;

    /**
     * Chạy pipeline: validate dataset → map facts → AI parseData → AI analyzeDefect
     * → lưu. Trả về ID của report vừa tạo.
     *
     * Chạy Ở NỀN qua `cds.spawn`: action trả về reportID NGAY, trạng thái bản ghi
     * đi Analyzing -> Analyzed/Failed. Client theo dõi bằng cách poll `status`,
     * không chờ response. Một lượt phân tích mất khoảng 3 phút — chờ đồng bộ thì
     * mọi timeout HTTP trên đường đi đều cắt trước khi AI xong.
     *
     * Lỗi ở giữa chừng vẫn để lại một bản ghi Reports với status = Failed và
     * `errorMessage`, chứ không nuốt lỗi — có bản ghi thì còn debug được.
     *
     * @param payload  JSON Golden Dataset, nguyên văn
     * @param title    Nhãn tuỳ chọn cho lần chạy; bỏ trống thì lấy symptom_short_text
     */
    action analyzeFromJson(payload : LargeString, title : String) returns String;

    /**
     * Mở một báo cáo 8D TỪ một lỗi đã ghi nhận — đường đi bình thường trong SAP,
     * và là đường app này thiếu cho tới Phase 2.
     *
     * ── Vì sao là action chứ không phải "gọi analyzeFromJson với payload dựng ở
     * trình duyệt" ──
     * Ba luật phải đúng cùng lúc, và cả ba đều là luật của dữ liệu:
     *
     *   1. Một lỗi có TỐI ĐA một 8D (SAP: *"only possible to create one Problem
     *      Solution Process per Defect"*). Kiểm ở client thì hai tab mở song song
     *      vẫn lọt.
     *   2. `Reports.notificationId` phải kế thừa `Defects.defectId`, không phải
     *      một số mới. Một case, một số.
     *   3. Lỗi chuyển sang `In Process` khi 8D mở. Để client làm hai lệnh riêng
     *      thì lệnh thứ hai có thể không bao giờ chạy.
     *
     * Dựng payload ở server cũng đóng luôn đường sửa dữ liệu trên đường đi: client
     * chỉ gửi ID, nên không có cách nào phân tích một case khác với case đã ghi.
     *
     * ── Hai tham số cam kết ──
     * `dueDate` và `coordinator` là thứ CON NGƯỜI hứa lúc mở case, không phải thứ
     * suy ra được từ bản ghi lỗi. Quyết định Q12 cấm hệ thống tự bịa hạn cho case
     * nội bộ; nó không cấm một điều phối viên tự đặt hạn cho mình. Để trống thì
     * rơi về giá trị suy từ payload (SLA thật của case Q1, coordinator của lỗi) —
     * xem `commitments` trong `eightDRepository.createReport`.
     *
     * @param defectID    ID (UUID) của dòng trong `Defects`.
     * @param title       Nhãn tuỳ chọn cho lần chạy.
     * @param dueDate     Hạn hoàn tất cam kết, ISO `YYYY-MM-DD`. Tuỳ chọn.
     * @param coordinator Người điều phối case. Tuỳ chọn.
     * @returns           ID của report vừa tạo.
     */
    action startEightD(defectID : String, title : String, dueDate : String, coordinator : String) returns String;

    /**
     * Sửa hạn cam kết và người điều phối của một case ĐANG chạy.
     *
     * ── Vì sao phải sửa được sau khi tạo ──
     * Hai trường này được nhập ở popup mở 8D, tức trong vài giây trước khi phân
     * tích bắt đầu — đúng lúc người ta biết ít nhất về case. Một hạn chỉ đặt được
     * ở khoảnh khắc đó là một hạn không dùng được: hạn trượt, điều phối viên nghỉ,
     * và tuần sau không ai sửa nổi. Nên cùng hai trường, hai đường ghi.
     *
     * ── Vì sao là action hẹp chứ không phải mở UPDATE trên `Reports` ──
     * Cùng lý do như `saveDisciplineField`: mở UPDATE là mở cả 40 cột, trong đó có
     * `caseContext`, `sourcePayload` và mọi kết quả AI. Action này chạm đúng hai
     * cột và không chạm gì khác.
     *
     * Gửi chuỗi rỗng để XOÁ một trường — đây là màn hình sửa, khác `startEightD`
     * (ở đó "để trống" nghĩa là "lấy giá trị suy từ payload").
     *
     * @param reportID    ID của report.
     * @param dueDate     Hạn hoàn tất, ISO `YYYY-MM-DD`. Rỗng để xoá.
     * @param coordinator Người điều phối. Rỗng để xoá.
     * @returns           `reportID`.
     */
    action setCaseCommitments(reportID : String, dueDate : String, coordinator : String) returns String;

    action reanalyze(reportID : String) returns String;

    /**
     * Chạy lại các bước downstream (ví dụ D5..D8) dựa trên kết quả các bước trước đã sửa.
     *
     * @param reportID ID của report.
     * @param fromStep Mã bước bắt đầu chạy lại (mặc định là 'D5').
     */
    action reanalyzeDownstream(reportID : String, fromStep : String) returns String;

    /**
     * Lấy trước số kế tiếp sẽ được cấp cho một đối tượng ('DEFECT', 'INSPLOT').
     * Dùng để hiển thị mã tự động trên form trước khi lưu.
     */
    function peekNextNumber(object : String) returns String;

    // ── Kho case lịch sử ─────────────────────────────────────────────────────

    /**
     * Kho tiền lệ. Đọc / sửa / xoá được, nhưng KHÔNG TẠO được qua OData.
     *
     * ── Vì sao CREATE bị đóng ──
     * Một dòng ghi tay không có `defectKeywords`, `materialFamily`, `searchText`
     * hay `attributesJson` tính sẵn — nên nó nằm trong kho, hiện ra ở màn hình,
     * và lặng lẽ ăn 0 điểm ở mọi tiêu chí. Nhìn từ ngoài giống hệt "không có case
     * nào tương tự". Đó không phải thứ chặn được bằng lời nhắc trên UI: chừng nào
     * đường ghi còn mở thì sớm muộn cũng có người đi vào.
     *
     * Từ Phase 5 chỉ còn ĐÚNG HAI đường vào kho, cả hai đều tính đủ các cột trên
     * bằng cùng một hàm (`writeHistoricalCase`):
     *
     *   1. `seedCaseLibrary` — nạp hàng loạt dữ liệu cũ.        provenance=imported
     *   2. Duyệt D8 — case do chính app này đóng.               provenance=closed-in-app
     *
     * UPDATE vẫn mở để sửa lỗi chính tả trên một dòng đã có; handler
     * `before UPDATE` tính lại `defectKeywords` khi `defectText` đổi.
     */
    @restrict: [
        { grant: ['READ', 'UPDATE', 'DELETE'], to: ['admin', 'Admin', 'User', 'authenticated-user'] }
    ]
    entity HistoricalCases as projection on ns.HistoricalCases;

    @readonly
    entity HistoricalTeamMembers as projection on ns.HistoricalTeamMembers;

    /**
     * Hành động của case đã đóng, đọc được ĐỘC LẬP với case cha.
     *
     * ── Vì sao cần một projection tường minh ──
     * `HistoricalActions` là composition con của `HistoricalCases`, nên CAP đã tự
     * phơi nó ra trong service. Nhưng entity tự phơi chỉ tới được qua cha
     * (`HistoricalCases(ID)/actions`); gọi thẳng `/HistoricalActions` trả 405.
     * Màn hình Code Catalogues cần đếm mã nhiệm vụ trên TOÀN kho, và đi vòng qua
     * `$expand` của 25 case chỉ để lấy một cột là kéo về cả kho để đếm 78 dòng.
     *
     * `@readonly` chứ không mở ghi: hành động vào kho qua đúng hai đường đã khai
     * ở `HistoricalCases` ở trên (`seedCaseLibrary` và duyệt D8), và mã nhiệm vụ
     * là do LUẬT suy ra chứ không do ai gõ — một đường ghi ở đây là một nguồn mã
     * thứ hai.
     */
    @readonly
    entity HistoricalActions as projection on ns.HistoricalActions;

    /**
     * Case tiền lệ của một report, kèm điểm và diễn giải từng tiêu chí.
     *
     * Trả JSON `PrecedentResult`. Không có tiền lệ ⇒ `precedents` rỗng và
     * `reason` nói rõ vì sao — phân biệt được "kho chưa nạp" với "đã tìm nhưng
     * không đủ điểm", hai thứ nhìn ngoài UI giống hệt nhau.
     */
    function findPrecedents(reportID : String) returns String;

    /**
     * Ghi lai nhom 8D ma nguoi dung da chot cho D1.
     *
     * -- Vi sao mot action HEP thay vi mo UPDATE tren Disciplines --
     * `Disciplines` van `@readonly` co chu dich: `resultJson` la ket luan cua AI,
     * mo ghi tu do len no nghia la bat ky ai cung sua duoc nguyen nhan goc, chuoi
     * 5-Why hay trich dan nguon ma khong de lai dau vet - dung thu ma ca pipeline
     * nay duoc dung len de chong.
     *
     * Action nay chi ghi DUNG mot khoa: `team.assignedRoster`. `team.roster` do AI
     * de xuat khong bi dung toi, nen luon doi chieu duoc "AI de xuat ai" voi
     * "nguoi dung chot ai" - va do la thu chung minh con nguoi van quyet, khong
     * phai may.
     *
     * @param disciplineID ID cua dong D1 trong `Disciplines`.
     * @param roster       Mang JSON: [{ partnerId, partnerName, functionTitle, partnerRole }]
     */
    action saveTeamRoster(disciplineID : String, roster : LargeString) returns String;

    /**
     * Ghi mot o do NGUOI DUNG nhap tren mot buoc D.
     *
     * -- Vi sao khong mo UPDATE tren Disciplines --
     * `resultJson` la ket luan cua AI. Mo ghi tu do len no nghia la bat ky ai
     * cung sua duoc nguyen nhan goc, chuoi 5-Why hay trich dan nguon ma khong
     * de lai dau vet - dung thu ca pipeline nay duoc dung len de chong.
     *
     * Action nay chi ghi duoc nhung khoa nam trong danh sach cho phep o server
     * (`HUMAN_WRITABLE_FIELDS`). Moi khoa deu la khoa RIENG cua nguoi dung, tach
     * khoi ban AI viet - vi du `problem.statementOverride` khong dung toi
     * `problem.statement`, nen luon doi chieu duoc may viet gi va nguoi sua gi.
     *
     * @param disciplineID ID dong trong `Disciplines`.
     * @param fieldKey     Khoa trong `resultJson`, phai nam trong danh sach cho phep.
     * @param valueJson    Gia tri, ma hoa JSON (chuoi, so, mang... deu duoc).
     */
    action saveDisciplineField(disciplineID : String, fieldKey : String, valueJson : LargeString) returns String;

    /**
     * Ghi quyet dinh duyet cua ky su chat luong cho MOT buoc D.
     *
     * -- Vi sao can action rieng --
     * AI chi soan nhap. Khong buoc nao duoc coi la chot cho toi khi mot con nguoi
     * bam duyet, va D8 chi mo cong dong case khi D1-D7 deu Approved. Khong co
     * duong ghi nay thi ca hai luat do khong ton tai trong du lieu.
     *
     * Moi lan bam ghi hai cho: trang thai hien tai tren `Disciplines`, va mot dong
     * KHONG XOA DUOC trong `ReviewEvents`. Danh tinh nguoi bam lay tu `req.user`,
     * KHONG nhan tu client - chu ky ma client tu khai duoc thi khong phai chu ky.
     *
     * @param disciplineID ID dong trong `Disciplines`.
     * @param decision     'approve' | 'request-change' | 'reopen'.
     * @param note         Bat buoc voi 'request-change'. Tra lai ma khong noi sua
     *                     gi thi nguoi nhan khong lam gi duoc.
     * @returns            JSON { code, fromStatus, toStatus, reviewedBy, reviewedAt, gate }
     */
    action reviewDiscipline(disciplineID : String, decision : String, note : String) returns String;

    /**
     * Xác nhận (Confirm) hoặc hủy xác nhận một ô thông tin do AI parse ra trên một bước D.
     *
     * @param disciplineID ID dòng trong `Disciplines`.
     * @param fieldKey     Tên trường thông tin (ví dụ: 'problem.what', 'team.roster'...).
     * @param confirmed    true = xác nhận; false = hủy xác nhận.
     * @returns            JSON { confirmedFields: string[] }
     */
    action confirmDisciplineField(disciplineID : String, fieldKey : String, confirmed : Boolean) returns String;

    /**
     * Cập nhật trạng thái xử lý (workState) của một bước D ('NotStarted' | 'InProgress').
     *
     * Giá trị 'Completed' bị từ chối với mã lỗi 400 vì 'Completed' là trạng thái
     * dẫn xuất khi bước đã được Approved qua cổng duyệt.
     *
     * @param disciplineID ID dòng trong `Disciplines`.
     * @param workState    'NotStarted' | 'InProgress'.
     * @returns            JSON { workState: string }
     */
    action setDisciplineWorkState(disciplineID : String, workState : String) returns String;

    /** Vet duyet cua mot report, moi nhat truoc. Nguon cho panel audit tren UI. */
    function getReviewTrail(reportID : String) returns String;

    /**
     * Danh sách toàn bộ bằng chứng hoàn thành của một report (không kèm content).
     * Phục vụ hiển thị trên tab Evidence của panel lưu trữ.
     */
    @(requires: ['admin', 'Admin', 'Auditor', 'User', 'authenticated-user'])
    function listTaskEvidence(reportID : String) returns String;

    /**
     * Nạp case vào kho tiền lệ.
     *
     * Có mặt vì trên Cloud Foundry không chạy được script cục bộ đối với HDI
     * container. Thay thế theo `notificationId`, nên nạp lại cùng bộ dữ liệu là
     * an toàn.
     *
     * @param payload Mảng JSON các case, hoặc một case đơn lẻ.
     */
    @(requires: ['admin', 'Admin'])
    action seedCaseLibrary(payload : LargeString) returns String;

    /** Xoá sạch kho. Dùng khi muốn nạp lại từ đầu. */
    @(requires: ['admin', 'Admin'])
    action clearCaseLibrary() returns String;

    /**
     * Sinh vector cho các case trong kho — bước bắt buộc để tiêu chí ngữ nghĩa
     * hoạt động.
     *
     * Tách khỏi `seedCaseLibrary` vì nạp kho là thao tác DB thuần luôn chạy được,
     * còn nhúng thì phụ thuộc AI Core. Gộp chung thì một sự cố bên AI khiến kho
     * không nạp được, trong khi chấm điểm theo luật vốn không cần vector.
     *
     * @param force true = nhúng lại tất cả. Dùng khi đổi công thức ghép searchText
     *              hoặc đổi model nhúng — vector cũ khi đó không còn so được.
     */
    @(requires: ['admin', 'Admin'])
    action embedCaseLibrary(force : Boolean) returns String;
}

// ── Dải số: bắt buộc trong bản ghi, không bắt buộc trong yêu cầu ─────────────
//
// `lotId` vẫn là `@mandatory` ở tầng db — một dòng không mang số nghiệp vụ là
// dòng hỏng. Nhưng kể từ Phase 1.7 thì SERVER cấp số đó, trong chính transaction
// của lệnh insert (xem `srv/src/domain/numberRange.ts`), nên client gửi lên
// KHÔNG có số là đúng chứ không phải thiếu.
//
// Kiểm tra đầu vào tự sinh của CAP chạy trước mọi handler của ứng dụng — kể cả
// khi đăng ký bằng `srv.prepend` — nên nếu để `@mandatory` ở tầng service thì
// yêu cầu bị chặn trước khi tới chỗ cấp số, và ô "Assigned on save" không bao giờ
// lưu được. Hạ cờ ở ĐÚNG tầng phát sinh vấn đề, giữ nguyên ràng buộc ở tầng dưới:
// `@assert.unique` vẫn còn, và handler cấp số luôn điền một giá trị trước khi bản
// ghi đi tiếp.
//
// `HistoricalCases.notificationId` từng nằm ở đây vì cùng lý do. Không cần nữa:
// Phase 5 đóng hẳn CREATE trên entity đó, nên không còn yêu cầu OData nào tới
// được phép kiểm này — số vẫn do `seedLibrary` cấp, ở tầng domain.
annotate EightDService.InspectionLots with {
    lotId @mandatory: null;
}

// `Defects.defectId` cùng chuyện: bắt buộc trong bản ghi, do server cấp lúc lưu.
annotate EightDService.Defects with {
    defectId @mandatory: null;
}
