/**
 * Đổi một đường dẫn bằng chứng thành hai thứ người đọc cần: NÓ LÀ GÌ, và NÓ TỪ
 * ĐÂU RA.
 *
 * ── Vì sao không để lộ tên đường dẫn ──
 * `precedents#1`, `independent`, `isIsNot` là từ vựng của prompt, không phải của
 * người duyệt 8D. Hiện nguyên văn ra màn hình thì người đọc phải học hệ thống
 * trước khi đọc được bằng chứng — mà bằng chứng tồn tại chính là để họ KHỎI phải
 * tin vào hệ thống. Đường dẫn thật vẫn giữ, nhưng nằm trong phần chi tiết khi mở
 * ra, chỗ nó là thông tin kỹ thuật chứ không phải nhãn.
 *
 * ── Vì sao nguồn lấy từ bản ghi trước, rồi mới suy từ đường dẫn ──
 * Dataset đã ghi sẵn hệ thống gốc cho từng dòng: `'SAP: EQUI/AFIH (PM)'`,
 * `'ASSUMED: MES/IoT'`, `'Backfilled from case record'`. Đó là sự thật do dữ liệu
 * mang theo. Suy từ đường dẫn chỉ là đường lùi cho nhánh KHÔNG có trường
 * `source` — và khi phải suy, ta chỉ nói được tới mức "phần nào của SAP QM".
 *
 * ── Vì sao `ASSUMED:` phải hiện khác `SAP:` ──
 * `SAP:` nghĩa là có một bản ghi trong hệ thống chống lưng. `ASSUMED:` nghĩa là
 * KHÔNG có — dòng đó được giả định từ MES/IoT/HR, những hệ nằm ngoài SAP và
 * không nối vào đây. Hiển thị chúng giống nhau là để người đọc tin rằng một giả
 * định đã được xác minh.
 */

export type SourceKind = 'sap' | 'external' | 'derived';

export interface EvidenceSource {
    /** Nhãn hiện trên màn hình, ví dụ `SAP EQUI/AFIH (PM)`. */
    label: string;
    kind: SourceKind;
    /** Câu giải thích đầy đủ, dùng cho tooltip. */
    detail: string;
}

/** Đọc hệ thống gốc do CHÍNH bản ghi khai. Null khi bản ghi không khai. */
function sourceFromRecord(value: unknown): string | null {
    const rec = value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
    if (!rec) return null;

    for (const field of ['source', 'evidenceCitation']) {
        const raw = rec[field];
        if (typeof raw === 'string' && raw.trim()) return raw.trim();
    }
    return null;
}

/** Tên đối tượng SAP xuất hiện trong một câu trích dẫn viết tự do. */
const SAP_OBJECTS = /QALS|QAMR|EQUI|AFIH|PLPO|DRAW|QMEL|QMFE|inspection lot|notification/i;

function classify(raw: string): EvidenceSource {
    const trimmed = raw.trim();

    if (/GW_8D/i.test(trimmed) || /SAP HANA.*GW_8D/i.test(trimmed)) {
        return {
            label: 'supported by Knowledge Graph',
            kind: 'sap',
            detail: 'Retrieved via Knowledge Graph Workspace (GW_8D).',
        };
    }

    if (/^ASSUMED\s*:/i.test(trimmed)) {
        const system = trimmed.replace(/^ASSUMED\s*:\s*/i, '');
        return {
            label: `Assumed · ${system}`,
            kind: 'external',
            detail: `Assumed from ${system}, an external system that is not connected here. `
                + 'No primary record backs this line.',
        };
    }

    if (/^SAP\s*:/i.test(trimmed)) {
        const module = trimmed.replace(/^SAP\s*:\s*/i, '');
        return { label: module, kind: 'sap', detail: `Read from ${module}.` };
    }

    /*
     * Trích dẫn 5-Why viết theo lối văn xuôi — 'Inspection lot QALS/QAMR' — chứ
     * không mang tiền tố `SAP:`. Bỏ qua nhánh này thì một bằng chứng CÓ bản ghi
     * hệ thống chống lưng lại bị gắn nhãn 'suy ra', tức nói giảm đúng thứ đáng tin
     * nhất trong danh sách.
     */
    if (SAP_OBJECTS.test(trimmed)) {
        return { label: trimmed, kind: 'sap', detail: `Read from record — ${trimmed}.` };
    }

    if (/backfilled/i.test(trimmed)) {
        return {
            label: 'This 8D case',
            kind: 'derived',
            detail: 'Taken from the 8D case record itself, not from a separate system.',
        };
    }

    // Chuỗi lạ vẫn hiện nguyên văn: bịa ra một phân loại cho nó tệ hơn nhiều so
    // với việc thừa nhận đây là thứ dataset ghi mà ta chưa có luật đọc.
    return { label: trimmed, kind: 'derived', detail: `Recorded source: ${trimmed}` };
}

const SAP_NOTIFICATION: EvidenceSource = {
    label: 'QM notification',
    kind: 'sap',
    detail: 'Quality notification in QM system.',
};

const THIS_CASE: EvidenceSource = {
    label: 'This 8D case',
    kind: 'derived',
    detail: 'Recorded on this 8D case, not held in a separate system.',
};

/**
 * Tên tiếng Anh thường cho từng nhánh, kèm nguồn dự phòng.
 *
 * Thứ tự có ý nghĩa: mục đầu tiên khớp sẽ thắng, nên nhánh hẹp phải đứng trên
 * nhánh rộng.
 */
const BY_PREFIX: Array<{ test: RegExp; title: string; source: EvidenceSource }> = [
    { test: /^header\./, title: 'Notification detail', source: SAP_NOTIFICATION },
    {
        test: /^product\./,
        title: 'Part and machine',
        source: { label: 'Master data', kind: 'sap', detail: 'Material and work centre master data.' },
    },
    {
        test: /^inspections/,
        title: 'Measurement taken',
        source: { label: 'QALS/QAMR', kind: 'sap', detail: 'Inspection lot and characteristic results in QM.' },
    },
    {
        test: /^historicalInspectionLots/,
        title: 'Earlier measurement',
        source: { label: 'QALS', kind: 'sap', detail: 'Past inspection lots for the same part and machine.' },
    },
    { test: /^actions/, title: 'Action on the notification', source: SAP_NOTIFICATION },
    {
        test: /^team/,
        title: 'Team member',
        source: { label: 'Partner roles', kind: 'sap', detail: 'Partner assigned on the notification.' },
    },
    {
        test: /^fmea/,
        title: 'Linked FMEA',
        source: { label: 'DMS', kind: 'sap', detail: 'FMEA document linked to this case.' },
    },
    {
        test: /^isIsNot/,
        title: 'Where the problem does and does not happen',
        source: {
            label: 'Worked out from measurements',
            kind: 'derived',
            detail: 'Computed from inspection history; not stored in a source system.',
        },
    },
    { test: /^fiveWhy/, title: 'Why-step on record', source: THIS_CASE },
    { test: /^ishikawa/, title: 'Cause branch on record', source: THIS_CASE },
    { test: /^rootCause/, title: 'Root cause on record', source: THIS_CASE },
    {
        test: /^precedents/,
        title: 'Similar case solved before',
        source: {
            label: 'supported by Knowledge Graph',
            kind: 'sap',
            detail: 'Retrieved from past 8D cases via Knowledge Graph.',
        },
    },
    {
        test: /^independent/,
        title: "AI's own conclusion",
        source: {
            label: 'AI, answer withheld',
            kind: 'derived',
            detail: "The AI's diagnosis, reached after the recorded answer was cut from its input.",
        },
    },
    {
        test: /^enrichment/,
        title: 'Figure worked out during analysis',
        source: {
            label: 'Worked out during analysis',
            kind: 'derived',
            detail: 'Derived while analysing; not kept with the report.',
        },
    },
    {
        test: /^(copqEur|lessonsLearned|customer|gaps|responsibility)/,
        title: 'Case closure detail',
        source: THIS_CASE,
    },
];

/** `symptomShortText` → `Symptom short text`. */
function humanize(segment: string): string {
    const spaced = segment
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .trim();
    return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase() : segment;
}

/**
 * Phần đuôi phân biệt hai dòng cùng nhánh.
 *
 * Chỉ số phải lấy từ BẤT KỲ đoạn nào, không chỉ đoạn cuối: `precedents#1.team`
 * và `precedents#4.team` cùng kết thúc bằng `team`, nên bỏ chỉ số đi là ba dòng
 * khác nhau hiện ra y hệt nhau — đúng lỗi đã thấy trên màn hình.
 */
function titleSuffix(path: string): string {
    const parts: string[] = [];

    path.split('.').forEach((segment, i) => {
        const m = segment.match(/^(.+?)(?:#(\d+))?$/);
        if (!m) return;
        const [, name, index] = m;

        // Đoạn đầu chính là tên nhánh, đã nằm trong tiêu đề — chỉ lấy chỉ số của nó.
        if (i > 0) {
            // Ishikawa tra bằng TÊN CATEGORY (`ishikawa.Machine`) nên đoạn này là
            // giá trị dữ liệu; giữ nguyên hoa thường thay vì "chuẩn hoá" nó đi.
            parts.push(/^[A-Z]/.test(name) ? name : humanize(name));
        }
        if (index) parts.push(`#${index}`);
    });

    return parts.length ? ` · ${parts.join(' ')}` : '';
}

export interface EvidenceMeta {
    title: string;
    source: EvidenceSource;
}

export function describeEvidence(path: string, value: unknown): EvidenceMeta {
    const entry = BY_PREFIX.find((e) => e.test.test(path));

    const recorded = sourceFromRecord(value);
    const source = recorded ? classify(recorded) : entry?.source ?? {
        label: 'Case snapshot',
        kind: 'derived' as const,
        detail: 'Captured with the case at the time of analysis.',
    };

    return { title: (entry?.title ?? 'Case detail') + titleSuffix(path), source };
}

/**
 * Một dòng giá trị đọc được, đặt ngay cạnh tiêu đề.
 *
 * Bản ghi thật thường là object nhiều trường; ở dòng tóm tắt chỉ lấy những trường
 * nói lên nội dung. Nối hết mọi trường lại sẽ dài hơn cả cái bảng mà nó định thay.
 */
const SUMMARY_FIELDS = [
    'characteristic', 'measuredValue', 'specValue',
    'question', 'answer',
    'category', 'description', 'finding', 'metricValue',
    'actionText', 'actionType', 'status',
    'partnerName', 'functionTitle', 'partnerRole',
    'notificationId', 'symptomShortText',
    'rootCauseCategory', 'rootCauseStatement',
    'fmeaId', 'is', 'isNot',
];

export function summarizeValue(value: unknown): string {
    if (value === null || value === undefined) return 'No value recorded';
    if (typeof value === 'string') return value.trim() || 'No value recorded';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    if (Array.isArray(value)) {
        if (value.length === 0) return 'Nothing recorded';
        if (value.length === 1) return summarizeValue(value[0]);
        return `${value.length} entries`;
    }

    const rec = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const field of SUMMARY_FIELDS) {
        const v = rec[field];
        if (v === null || v === undefined || v === '' || typeof v === 'object') continue;
        parts.push(String(v));
        if (parts.length === 3) break;
    }
    if (parts.length) return parts.join(' · ');

    const first = Object.values(rec).find((v) => v !== null && v !== '' && typeof v !== 'object');
    if (first !== undefined) return String(first);

    /*
     * Vài nhánh là object BỌC object — `independent` gói kết luận trong `.finding`
     * và `.verdict`, nên ở tầng ngoài không có lấy một giá trị vô hướng nào. Dừng
     * lại ở đó thì dòng hiện chữ "Record", tức là đúng cái không nói gì.
     */
    for (const nested of Object.values(rec)) {
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
            const inner = summarizeValue(nested);
            if (inner !== 'Record') return inner;
        }
    }
    return 'Record';
}
