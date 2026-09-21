import {
    isCustomerComplaint,
    reviewStatusOf,
    type Discipline8D,
    type Report8D,
} from '@/services/eightd-service';

/**
 * Cái mà một kỹ sư chất lượng hỏi khi mở worklist.
 *
 * ── Vì sao module này tồn tại ──
 * Bảng cũ trả lời "case này LÀ gì": mã, vật tư, triệu chứng, trạng thái. Đó là
 * mô tả, không phải việc. Người mở danh sách lúc 8 giờ sáng hỏi ba câu khác:
 * cái nào đến lượt tôi, cái nào đang trễ, và bước kế tiếp của nó là bước nào.
 *
 * Gần như mọi thứ ở đây suy ra được từ dữ liệu đã có — không cần gọi AI. Ngoại
 * lệ là hạn phản hồi khách và chủ sở hữu case: chúng nằm trong JSON, và JSON thì
 * không sắp xếp cũng không lọc được qua OData, nên Phase 3.1 đã kéo chúng thành
 * ba cột thật (`slaResponseDue`, `coordinator`, `teamLeader`). Module này chỉ đọc.
 *
 * Suy ra ở MỘT chỗ để bảng và trang chi tiết không bao giờ nói hai con số khác nhau.
 */

export const STEP_ORDER = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'] as const;

/** Nhãn ngắn, cùng bộ với `case-stepper` ở trang chi tiết. */
export const STEP_SHORT_LABEL: Record<string, string> = {
    D1: 'Team',
    D2: 'Problem',
    D3: 'Containment',
    D4: 'Root Cause',
    D5: 'Corrective',
    D6: 'Implement',
    D7: 'Preventive',
    // Phải khớp `case-stepper.tsx` — xem lý do đổi tên ở đó.
    D8: 'Team Recognition',
};

/**
 * Đồng hồ 8D, tính bằng ngày kể từ lúc phát hiện lỗi.
 *
 * ── Vì sao hai mốc chứ không phải một ──
 * Chuẩn 8D tách rất rõ hai nghĩa vụ. Chặn (D3) phải xong trong vòng vài ngày vì
 * nó bảo vệ khách hàng khi chưa ai biết nguyên nhân. Đóng case thì có cả tháng.
 * Một ngưỡng duy nhất sẽ hoặc bỏ sót case chặn muộn, hoặc kêu inh ỏi về case
 * đang chạy đúng nhịp.
 *
 * Con số ở đây là mặc định của ngành, không phải cấu hình của nhà máy này —
 * để một chỗ, sửa một chỗ khi có SLA thật.
 */
export const CONTAINMENT_SLA_DAYS = 3;
export const CLOSURE_SLA_DAYS = 60;

const MS_PER_DAY = 86_400_000;

function toTime(raw: string | null | undefined): number | null {
    if (!raw) return null;
    const t = new Date(raw).getTime();
    return Number.isNaN(t) ? null : t;
}

/**
 * Số ngày case 8D đã mở, tính từ lúc mở 8D và DỪNG khi case đóng.
 *
 * ── Vì sao `createdAt` chứ không `foundDate` ──
 * Bản đầu của hàm này lấy `foundDate ?? createdAt`, với lý do rằng `createdAt`
 * làm mọi case tồn đọng trông như vừa mới mở. Lý do đó đúng, nhưng nó trả lời
 * một câu hỏi KHÁC. "Case 8D này đã chạy bao lâu" là câu hỏi về case 8D, và case
 * 8D bắt đầu lúc nó được mở. Độ trễ giữa lúc phát hiện lỗi và lúc mở 8D là một
 * con số riêng, có ý nghĩa riêng, và giờ là một cột riêng — `responseLagDays`.
 *
 * Gộp hai thứ vào một cột thì không cột nào đọc được: một case mở muộn ba tuần
 * và một case chạy chậm ba tuần hiện ra cùng một con số, dù cần hai hành động
 * hoàn toàn khác nhau.
 *
 * ── Vì sao dừng khi đóng ──
 * Một case đóng cách đây nửa năm mà vẫn đếm tiếp thì sớm muộn nó leo lên đầu mọi
 * danh sách "lâu nhất" — và không ai làm được gì với nó.
 */
export function daysOpen(
    report: Pick<Report8D, 'createdAt' | 'completionDate' | 'modifiedAt'>,
    closed = false,
): number | null {
    const started = toTime(report.createdAt);
    if (started === null) return null;
    const stoppedAt = closed
        ? toTime(report.completionDate) ?? toTime(report.modifiedAt) ?? Date.now()
        : Date.now();
    return Math.max(0, Math.floor((stoppedAt - started) / MS_PER_DAY));
}

/**
 * Độ trễ phản hồi: bao nhiêu ngày trôi qua giữa lúc PHÁT HIỆN lỗi và lúc mở 8D.
 *
 * Đây là con số mà chú thích cũ của `ageInDays` lo lắng, tách ra đứng riêng. Nó
 * đo hiệu quả của khâu tiếp nhận, không đo tiến độ của case — nên nó là một cột
 * tuỳ chọn, không phải cột mặc định.
 *
 * Null khi thiếu một trong hai mốc. Số âm bị kẹp về 0: 8D mở TRƯỚC ngày phát
 * hiện là dữ liệu sai, và một độ trễ âm hiện trên bảng thì trông như một tính năng.
 */
export function responseLagDays(report: Pick<Report8D, 'foundDate' | 'createdAt'>): number | null {
    const found = toTime(report.foundDate);
    const opened = toTime(report.createdAt);
    if (found === null || opened === null) return null;
    return Math.max(0, Math.floor((opened - found) / MS_PER_DAY));
}

/**
 * Số ngày CÒN LẠI tới hạn phản hồi khách. Âm = đã quá hạn bấy nhiêu ngày.
 *
 * Null ở case Q2/Q3: chúng không có hạn (quyết định Q12), và null ở đây là thứ
 * giữ cho chip "Overdue" không bắt nhầm mọi case nội bộ.
 */
export function daysUntilDue(slaResponseDue: string | null | undefined): number | null {
    const due = toTime(slaResponseDue);
    if (due === null) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((due - today.getTime()) / MS_PER_DAY);
}

/**
 * Đọc một số có thể đang là chuỗi.
 *
 * `copqEur` khai là Decimal, và HANA trả nó qua OData dưới dạng CHUỖI
 * (`"8600.00"`) để không mất chữ số. So sánh `"8600.00" >= 10000` thì JS tự ép
 * kiểu và vẫn ra đúng — cho tới ngày ai đó đổi phép so sánh thành `Math.max`
 * hay cộng dồn, và im lặng ra kết quả nối chuỗi. Ép một lần ở đây rẻ hơn nhớ
 * cái bẫy đó ở mọi chỗ dùng.
 */
export function toNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export type CasePriority = 'critical' | 'high' | 'medium' | 'low';

export const PRIORITY_LABEL: Record<CasePriority, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
};

export interface CaseWorkload {
    /** Bước đầu tiên chưa được ký. Null khi cả tám đã ký. */
    currentStep: string | null;
    currentStepLabel: string | null;
    /**
     * Bước đang CÓ NGƯỜI LÀM, nếu có.
     *
     * Khác `currentStep`: bước kế tiếp cần làm và bước đang có người làm không
     * nhất thiết là một. Ai đó có thể đang làm D5 trong khi D3 còn chưa ai nhận —
     * và nếu bảng chỉ hiện một trong hai thì người thứ hai sẽ nhận trùng việc.
     */
    inProgressStep: string | null;
    approved: number;
    total: number;
    /** Bước bị trả lại kèm lý do — việc gấp hơn cả bước kế tiếp. */
    changeRequested: string[];
    /** Số ngày case 8D đã chạy, dừng khi đóng. */
    ageDays: number | null;
    /** Ngày phát hiện lỗi → ngày mở 8D. Cột tuỳ chọn, không phải `ageDays`. */
    responseLagDays: number | null;
    /** Hạn phản hồi khách (Q1). Null ở Q2/Q3 — đó là câu trả lời, không phải lỗ hổng. */
    dueDate: string | null;
    /** Ngày còn lại tới hạn; âm = quá hạn. Null khi không có hạn. */
    daysUntilDue: number | null;
    /** Quá hạn phản hồi khách — mốc DUY NHẤT đến từ cam kết thật với khách. */
    slaOverdue: boolean;
    /** Chặn (D3) chưa ký mà đồng hồ đã quá hạn. */
    containmentOverdue: boolean;
    closureOverdue: boolean;
    overdue: boolean;
    /**
     * Ai đang giữ case: trưởng nhóm 8D, hoặc người điều phối khi D1 chưa chốt.
     *
     * `ownerIsFallback` để bảng làm mờ tên dự phòng. Hiện hai thứ giống hệt nhau
     * là nói dối rằng ai đó đã nhận case, trong khi mới chỉ có người tiếp nhận.
     */
    owner: string | null;
    ownerIsFallback: boolean;
    customer: boolean;
    /** Mức nghiêm trọng của mã lỗi (FECLAS): Critical | Major | Minor. */
    defectClass: string | null;
    priority: CasePriority;
    /** Vì sao ra mức ưu tiên đó — hiện trong tooltip, không bắt ai đoán. */
    priorityReason: string;
    /** Còn việc cho người dùng: đã phân tích xong nhưng chưa ký đủ. */
    needsReview: boolean;
    closed: boolean;
}

function orderedDisciplines(disciplines: Discipline8D[]): Discipline8D[] {
    const byCode = new Map(disciplines.map((d) => [d.code, d]));
    return STEP_ORDER.map((code) => byCode.get(code)).filter((d): d is Discipline8D => Boolean(d));
}

/**
 * Mọi thứ worklist cần biết về một case, tính một lần.
 *
 * Trả về cả những trường mà bảng hiện tại chưa dùng (`closureOverdue`,
 * `priorityReason`) vì chúng là cùng một phép suy luận — tách ra tính lại ở nơi
 * khác là cách hai màn hình bắt đầu bất đồng.
 */
/**
 * Severity do MÃ LỖI quyết định, tra từ danh mục F4.
 *
 * `Reports.defectClass` CÓ tồn tại (Phase 3.1 thêm vào) nhưng rỗng ở gần hết dữ
 * liệu hiện có, vì nó chỉ được ghi trên đường ghi nhận lỗi. Dù cột có đầy đủ thì
 * tra từ mã vẫn đúng bản chất hơn: severity là thuộc tính của MÃ, không phải của
 * một lần xảy ra lỗi — hai người ghi cùng một mã phải ra cùng một mức.
 *
 * Tên trong code vẫn là `defectClass` vì đó là tên cột và tên trường của SAP;
 * tên hiện ra cho người đọc là **Severity** (S7). Đừng đổi một trong hai mà
 * không đổi cái kia.
 */
export type DefectClassLookup = (defectCode: string | null | undefined) => string | null;

export function getCaseWorkload(report: Report8D, defectClassOf?: DefectClassLookup): CaseWorkload {
    const disciplines = orderedDisciplines(report.disciplines ?? []);
    const total = STEP_ORDER.length;

    const approved = disciplines.filter((d) => reviewStatusOf(d) === 'Approved').length;
    const changeRequested = disciplines
        .filter((d) => reviewStatusOf(d) === 'ChangeRequested')
        .map((d) => d.code);

    // Bước kế tiếp = bước đầu tiên chưa Approved theo THỨ TỰ D1..D8.
    //
    // Không lấy "bước đang mở gần nhất" hay bước có sửa đổi mới nhất: 8D là một
    // chuỗi có thứ tự, và câu hỏi "làm gì tiếp" chỉ có một đáp án đúng — bước
    // sớm nhất còn nợ chữ ký. Report chưa phân tích thì chưa có dòng discipline
    // nào, và câu trả lời đúng vẫn là D1.
    const firstOpen = disciplines.find((d) => reviewStatusOf(d) !== 'Approved');
    const currentStep = disciplines.length === 0
        ? 'D1'
        : firstOpen?.code ?? null;

    const closed = report.status === 'Closed' || approved === total;
    const ageDays = daysOpen(report, closed);

    const d3Approved = disciplines.some((d) => d.code === 'D3' && reviewStatusOf(d) === 'Approved');
    const containmentOverdue = !closed
        && !d3Approved
        && ageDays !== null
        && ageDays > CONTAINMENT_SLA_DAYS;
    const closureOverdue = !closed && ageDays !== null && ageDays > CLOSURE_SLA_DAYS;

    // Hạn phản hồi khách là mốc DUY NHẤT ở đây đến từ một cam kết thật, không
    // phải từ một hằng số mặc định của ngành. Nên nó được tính riêng và hiện
    // riêng, chứ không gộp vào hai đồng hồ nội bộ ở trên.
    const dueDate = report.slaResponseDue ?? null;
    const dueIn = daysUntilDue(dueDate);
    const slaOverdue = !closed && dueIn !== null && dueIn < 0;

    const customer = isCustomerComplaint(report.origin);
    // `Reports.defectClass` gần như luôn null ở dữ liệu hiện có, nên ưu tiên nó
    // rồi tra danh mục theo mã lỗi. Ngược lại — tra trước, đọc cột sau — sẽ bỏ
    // qua giá trị mà người dùng đã tự sửa trên chính case này.
    const defectClass = (report.defectClass?.trim() || null)
        ?? defectClassOf?.(report.defectCode)
        ?? null;
    const { priority, priorityReason } = ratePriority({
        customer,
        copqEur: toNumber(report.copqEur),
        defectClass,
        containmentOverdue,
        closureOverdue,
        slaOverdue,
        dueIn,
        closed,
    });

    // Chủ sở hữu: trưởng nhóm 8D nếu D1 đã chốt, còn không thì người điều phối —
    // và bảng phải BIẾT đó là bản dự phòng để làm mờ. "Chưa ai nhận" và "đã có
    // người nhận" là hai trạng thái khác nhau của cùng một case.
    const teamLeader = report.teamLeader?.trim() || null;
    const coordinator = report.coordinator?.trim() || null;
    const owner = teamLeader ?? coordinator;

    // Bước đang dở = bước sớm nhất còn ở `Draft` — đã có nội dung nhưng chưa ai ký.
    //
    // Ở đây từng viết `=== 'InProcess'`. `reviewStatusOf` chỉ trả về `Draft` |
    // `Approved` | `ChangeRequested`, nên phép so sánh đó không bao giờ đúng và
    // chip lọc "In process" luôn rỗng — một bộ lọc chết mà nhìn từ ngoài giống
    // hệt "không có case nào đang làm dở".
    //
    // `ChangeRequested` cố ý KHÔNG tính vào đây: nó đã có chip riêng, gộp vào thì
    // hai chip chồng lên nhau. Case đã đóng cũng không, vì "đang dở" và "đã ký
    // xong" không thể cùng đúng.
    const inProgressStep = closed
        ? null
        : disciplines.find((d) => reviewStatusOf(d) === 'Draft')?.code ?? null;

    return {
        currentStep,
        currentStepLabel: currentStep ? (STEP_SHORT_LABEL[currentStep] ?? currentStep) : null,
        inProgressStep,
        approved,
        total,
        changeRequested,
        ageDays,
        responseLagDays: responseLagDays(report),
        dueDate,
        daysUntilDue: dueIn,
        slaOverdue,
        containmentOverdue,
        closureOverdue,
        overdue: containmentOverdue || closureOverdue || slaOverdue,
        owner,
        ownerIsFallback: teamLeader === null && coordinator !== null,
        customer,
        defectClass,
        priority,
        priorityReason,
        needsReview: report.status === 'Analyzed' && approved < total,
        closed,
    };
}

/**
 * Mức ưu tiên, bằng LUẬT chứ không bằng model.
 *
 * ── Vì sao không hỏi AI ──
 * Xếp hạng việc phải làm là thứ người dùng sẽ cãi lại, và họ có quyền. Một luật
 * bốn dòng thì cãi được: chỉ ra dòng nào đã bắn. Một điểm số do model chấm thì
 * không, và lần đầu nó xếp nhầm một khiếu nại khách hàng xuống Low là lần cuối
 * cột này được ai đó tin.
 *
 * Đầu vào đều là fact đã ghi: đơn khiếu nại hay lỗi nội bộ, chi phí, và đồng hồ.
 */
function ratePriority(input: {
    customer: boolean;
    copqEur: number | null;
    /** Critical | Major | Minor, suy ra từ mã lỗi. Null khi mã không có trong danh mục. */
    defectClass: string | null;
    containmentOverdue: boolean;
    closureOverdue: boolean;
    /** Quá hạn phản hồi khách — nặng hơn hai đồng hồ nội bộ, vì đây là cam kết. */
    slaOverdue: boolean;
    dueIn: number | null;
    closed: boolean;
}): { priority: CasePriority; priorityReason: string } {
    if (input.closed) return { priority: 'low', priorityReason: 'All eight disciplines signed off.' };

    const reasons: string[] = [];
    if (input.customer) reasons.push('customer complaint');
    if (input.slaOverdue) {
        // Nêu số ngày, không chỉ nêu "quá hạn": một ngày và bốn mươi ngày đòi hai
        // phản ứng khác nhau, và tooltip là chỗ duy nhất nói được sự khác biệt đó.
        // Không nói "customer response": hạn này giờ có hai nguồn — SLA thật của
        // case Q1, và ngày do người mở case tự cam kết (kể cả case nội bộ). Gọi
        // tên một nguồn là nói sai về nguồn kia.
        reasons.push(`${Math.abs(input.dueIn ?? 0)} day(s) past the committed due date`);
    }
    if (input.containmentOverdue) reasons.push(`containment open past ${CONTAINMENT_SLA_DAYS} days`);
    if (input.closureOverdue) reasons.push(`open past ${CLOSURE_SLA_DAYS} days`);
    if ((input.copqEur ?? 0) >= 10_000) reasons.push('cost of poor quality above €10,000');
    // "severity", không phải "defect class": S7 của kế hoạch chốt một tên cho một
    // khái niệm, và tên hiện ra ở UI là Severity. Chuỗi này đi thẳng vào tooltip
    // của cột Severity, nên nó là đúng chỗ người đọc gặp cái tên sai.
    if (input.defectClass) reasons.push(`${input.defectClass.toLowerCase()} severity`);

    // Defect class 'Critical' tự nó đủ để lên Critical: nó nói lỗi này có thể tới
    // tay khách hàng dưới dạng hỏng chức năng, và đó là mức cao nhất bất kể tuổi
    // case hay chi phí đã ghi.
    if (input.defectClass === 'Critical') {
        return { priority: 'critical', priorityReason: reasons.join(' · ') };
    }
    // Quá hạn cam kết là Critical không cần điều kiện kèm: hạn đó là một lời hứa
    // ĐÃ GHI RA — của khách hay của chính đội cũng vậy — chứ không phải một ngưỡng
    // mặc định do app tự chọn.
    if (input.slaOverdue) {
        return { priority: 'critical', priorityReason: reasons.join(' · ') };
    }
    if (input.customer && (input.containmentOverdue || input.closureOverdue)) {
        return { priority: 'critical', priorityReason: reasons.join(' · ') };
    }
    if (input.customer || input.containmentOverdue || input.defectClass === 'Major'
        || (input.copqEur ?? 0) >= 10_000) {
        return { priority: 'high', priorityReason: reasons.join(' · ') };
    }
    if (input.closureOverdue || (input.copqEur ?? 0) > 0) {
        return { priority: 'medium', priorityReason: reasons.join(' · ') || 'internal defect with recorded cost' };
    }
    return { priority: 'low', priorityReason: 'internal defect, inside both clocks' };
}

export type WorklistFilter =
    | 'all'
    | 'mine'
    | 'overdue'
    | 'critical'
    | 'awaitingApproval'
    | 'changeRequested'
    | 'inProcess'
    | 'customer'
    | 'closed';

/**
 * ── Vì sao "Awaiting approval" chứ không "Awaiting MY approval" ──
 * Kế hoạch viết chip thứ tư là "Awaiting my approval". Mô hình dữ liệu hiện tại
 * không có trường người duyệt: một bước ở `Draft` đang chờ MỘT ai đó ký, không
 * chờ một người cụ thể. Thu hẹp thành "của tôi" sẽ tạo ra một chip luôn rỗng —
 * đúng con bug vừa sửa ở `inProgressStep`, chỉ khác chỗ nó nằm.
 *
 * Nên chip này lọc "còn chữ ký nào chưa ký", và ai muốn thu hẹp về mình thì bấm
 * kèm "My cases". Đổi lại chữ "my" thành một hành vi có thật.
 */
export const WORKLIST_FILTER_LABEL: Record<WorklistFilter, string> = {
    all: 'All cases',
    mine: 'My cases',
    overdue: 'Overdue',
    critical: 'Critical',
    awaitingApproval: 'Awaiting approval',
    changeRequested: 'Changes requested',
    inProcess: 'In process',
    customer: 'Customer complaints',
    closed: 'Signed off',
};

/**
 * Tôi có phải người đang giữ case này không.
 *
 * ── Vì sao so nhiều danh tính chứ không một ──
 * `teamLeader` là TÊN người ('Heli Weber', từ danh bạ Business Partner), còn
 * người đăng nhập được biết qua display name, email và ID. Ba thứ đó không nhất
 * thiết viết giống nhau, và so đúng một cặp sẽ cho một chip im lặng không khớp
 * gì — kiểu hỏng tệ nhất, vì nó trông y hệt "bạn không có case nào".
 *
 * So cả phần trước @ của email: 'quyen.tran@…' và 'Quyen Tran' là cùng một người
 * ở hai hệ thống, và đó là cách ghép duy nhất có sẵn khi chưa có SSO thật.
 */
export function isMyCase(work: CaseWorkload, identities: string[]): boolean {
    if (!work.owner || !identities.length) return false;
    const owner = work.owner.trim().toLowerCase();
    if (!owner) return false;
    return identities.some((raw) => {
        const id = raw.trim().toLowerCase();
        if (!id) return false;
        if (id === owner) return true;
        const localPart = id.split('@')[0];
        // Dấu chấm/gạch dưới trong tài khoản đứng thay khoảng trắng trong tên thật.
        return localPart.replace(/[._-]+/g, ' ') === owner;
    });
}

export function matchesFilter(
    work: CaseWorkload,
    filter: WorklistFilter,
    identities: string[] = [],
): boolean {
    switch (filter) {
        case 'mine': return isMyCase(work, identities) && !work.closed;
        case 'overdue': return work.overdue;
        case 'critical': return work.priority === 'critical';
        case 'awaitingApproval': return work.needsReview;
        case 'changeRequested': return work.changeRequested.length > 0;
        case 'inProcess': return work.inProgressStep !== null;
        case 'customer': return work.customer && !work.closed;
        case 'closed': return work.closed;
        default: return true;
    }
}

/**
 * Thứ tự mặc định: việc gấp nhất lên đầu.
 *
 * Bảng cũ sắp theo `createdAt desc` — trả lời "cái nào MỚI nhất", một câu không
 * ai hỏi. Case gấp nhất thường là case cũ nhất, nên sắp theo ngày tạo là đẩy
 * đúng thứ cần làm xuống dưới cùng.
 */
const PRIORITY_RANK: Record<CasePriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function compareByUrgency(
    a: { work: CaseWorkload; status?: string; createdAt?: string },
    b: { work: CaseWorkload; status?: string; createdAt?: string },
): number {
    if (a.work.closed !== b.work.closed) return a.work.closed ? 1 : -1;

    // 1. Case đang chạy phân tích AI (Analyzing) luôn ưu tiên lên ĐẦU BẢNG:
    // Người dùng vừa Start 8D thì phải nhìn thấy ngay trên worklist kèm spinner.
    const aAnalyzing = a.status === 'Analyzing';
    const bAnalyzing = b.status === 'Analyzing';
    if (aAnalyzing && !bAnalyzing) return -1;
    if (!aAnalyzing && bAnalyzing) return 1;

    // 2. Case vừa phân tích xong từ AI (Analyzed) ưu tiên trước các case chưa duyệt/tồn đọng cùng nhóm
    const aAnalyzed = a.status === 'Analyzed';
    const bAnalyzed = b.status === 'Analyzed';
    if (aAnalyzed && !bAnalyzed && b.work.priority === 'low') return -1;
    if (!aAnalyzed && bAnalyzed && a.work.priority === 'low') return 1;

    const rank = PRIORITY_RANK[a.work.priority] - PRIORITY_RANK[b.work.priority];
    if (rank !== 0) return rank;

    // Trong cùng một mức ưu tiên, hạn thật thắng tuổi case: một case đến hạn ngày
    // mai gấp hơn một case đã mở lâu hơn nhưng chưa hứa gì với ai. Case không có
    // hạn xếp sau case có hạn — không phải vì nó kém quan trọng, mà vì không có
    // gì để so, và đoán một hạn cho nó là đúng thứ quyết định Q12 cấm.
    const aDue = a.work.daysUntilDue;
    const bDue = b.work.daysUntilDue;
    if (aDue !== null && bDue !== null && aDue !== bDue) return aDue - bDue;
    if (aDue !== null && bDue === null) return -1;
    if (aDue === null && bDue !== null) return 1;

    if (aAnalyzed && !bAnalyzed) return -1;
    if (!aAnalyzed && bAnalyzed) return 1;

    // Case mới tạo trong ngày (ageDays === 0) ưu tiên lên trước case cũ cùng nhóm priority
    const aAge = a.work.ageDays ?? 0;
    const bAge = b.work.ageDays ?? 0;
    if (aAge === 0 && bAge > 0) return -1;
    if (bAge === 0 && aAge > 0) return 1;

    if (bAge !== aAge) return bAge - aAge;

    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bCreated - aCreated;
}
