import axiosInstance from './core/axios-instance';

/**
 * Truy cap F4 (value help) cua CDK.
 *
 * -- Vi sao khong doc thang bang du lieu --
 * Ba ma `materialId`, `workCenterId`, `defectCode` se duoc dong bo tu S/4. Goi
 * thang vao `HistoricalCases` thi ngay do toi la phai sua form. Di qua
 * `getValueHelp` thi form chi biet mot khai niem duy nhat: "danh sach ten X, kem
 * quy tac dan gia tri". Nguon nam o mot DONG DU LIEU trong `ValueHelpList`, doi
 * tu 'reference' sang 'external' la xong.
 */

/** Moi F4 cua form ghi nhan loi dung chung mot objectType. */
export const DEFECT_OBJECT_TYPE = 'QualityNotification';

export const VALUE_HELP_IDS = {
    plant: 'PLANT',
    material: 'MATERIAL',
    workCenter: 'WORK_CENTER',
    defectCode: 'DEFECT_CODE',
    uom: 'UOM',
    /** Tầng cha của `defectCode` — cascade của catalog type 9. */
    defectCodeGroup: 'DEFECT_CODE_GROUP',
    /** Danh bạ Business Partner cho ô người và cho nhóm 8D ở D1. */
    partner: 'PARTNER',
    /** Đường A: lô kiểm tra thật đứng sau "found during inspection". */
    inspectionLot: 'INSPECTION_LOT',
    /** Danh mục nhiệm vụ chất lượng (catalog type 2) — mã của một việc trong D3/D5/D7. */
    taskCode: 'TASK_CODE',
    /** Tầng cha của `taskCode`. */
    taskCodeGroup: 'TASK_CODE_GROUP',
    /** Quản lý lô hàng (SAP MCHA/MCH1). Con của Material. */
    batch: 'BATCH',
    /** Danh mục phòng ban chịu trách nhiệm (SAP QMEL-ABTEI). */
    department: 'DEPARTMENT',
    /** Điều phối viên thông báo lỗi (SAP QMEL-PARNR). */
    coordinator: 'COORDINATOR',
    /** Đặc tính đo kiểm chuẩn (SAP QPMK Master Inspection Characteristics). */
    characteristic: 'INSPECTION_CHARACTERISTIC',
} as const;

export type ValueHelpId = (typeof VALUE_HELP_IDS)[keyof typeof VALUE_HELP_IDS];

/** Mot muc F4. Ngoai `key`/`text` con mang nguyen cac cot ma returnMapping can. */
export interface ValueHelpEntry {
    key: string;
    text: string;
    [column: string]: unknown;
}

/** "Chon xong thi dan cot nao vao o nao". */
export interface ReturnMappingRule {
    sourceColumn: string;
    targetField: string;
}

export interface ValueHelpResult {
    entries: ValueHelpEntry[];
    returnMapping: ReturnMappingRule[];
    config: { disableValidation: boolean };
}

const EMPTY: ValueHelpResult = { entries: [], returnMapping: [], config: { disableValidation: false } };

/**
 * Dung danh sach tham so cho cu phap goi ham cua OData v4.
 *
 * Chuoi phai duoc boc trong nhay don, va mot nhay don BEN TRONG gia tri duoc
 * thoat bang cach nhan doi no. Bo qua buoc do thi mot mo ta co dau nháy — hoan
 * toan hop le trong danh muc — lam vo cu phap URL va F4 chet ma khong ro vi sao.
 */
function odataArgs(params: Record<string, string>): string {
    return Object.entries(params)
        .map(([name, value]) => `${name}='${encodeURIComponent(value.replace(/'/g, "''"))}'`)
        .join(',');
}

/**
 * Doc mot danh sach F4.
 *
 * Handler cua CDK tra ve mot CHUOI JSON chu khong phai entity, vi so cot cua moi
 * danh sach mot khac. Bung o day mot lan de phan con lai cua app lam viec voi
 * object.
 */
export async function getValueHelp(
    valueHelpID: ValueHelpId,
    options: { filter?: string; dependsOnValue?: string } = {},
): Promise<ValueHelpResult> {
    // `getValueHelp` la CDS `function`, nen la GET voi cu phap goi ham cua OData
    // v4: ten(tham='gia tri'). Khong phai POST — day la phep doc, va mot phep doc
    // duoc khai bao la phep ghi thi cache lan CSRF deu hieu sai.
    const response = await axiosInstance.get(
        `api/cnma/VALUEHELP_SRV/getValueHelp(${odataArgs({
            objectType: DEFECT_OBJECT_TYPE,
            valueHelpID,
            filter: options.filter ?? '',
            dependsOnValue: options.dependsOnValue ?? '',
        })})`,
    );

    const raw = response.data?.value ?? response.data;
    if (!raw) return EMPTY;
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return {
            entries: dedupeByKey(Array.isArray(parsed?.entries) ? parsed.entries : []),
            returnMapping: Array.isArray(parsed?.returnMapping) ? parsed.returnMapping : [],
            config: parsed?.config ?? EMPTY.config,
        };
    } catch {
        // Danh sach hong khong duoc lam sap form: o nhap van go tay duoc.
        return EMPTY;
    }
}

/**
 * Gop cac dong cung mot ma.
 *
 * Nguon `reference` chay `SELECT.distinct` tren (keyColumn, textColumn), nen kho
 * case that — co ca `WC-MILL-07` lan `wc-mill-07`, va cung mot work center co
 * the mang hai cach viet mo ta — tra ve 14 dong cho 11 work center. Ham cham
 * diem chuan hoa bang `trim().toUpperCase()` truoc khi so, nen voi no chung la
 * MOT. Danh sach chon phai noi cung mot chuyen, khong thi nguoi dung phai doan
 * hai dong giong het nhau khac nhau cho nao.
 *
 * Giu dong dau tien: no cung la dong `sortBy` da xep len truoc.
 */
function dedupeByKey(entries: ValueHelpEntry[]): ValueHelpEntry[] {
    const seen = new Map<string, ValueHelpEntry>();
    for (const entry of entries) {
        const key = String(entry.key ?? '').trim().toUpperCase();
        if (!key || seen.has(key)) continue;
        seen.set(key, entry);
    }
    return [...seen.values()];
}

/**
 * Tim mot muc theo ma, KHONG phan biet hoa thuong.
 *
 * Ham cham diem tien le chuan hoa bang `trim().toUpperCase()` truoc khi so, nen
 * `wc-mill-07` va `WC-MILL-07` la mot voi no. Doi chieu chat hon o day se bao
 * "khong co trong danh muc" cho mot ma thuc ra khop hoan hao.
 */
export function findEntry(entries: ValueHelpEntry[], value: string): ValueHelpEntry | null {
    const needle = value.trim().toUpperCase();
    if (!needle) return null;
    return (
        entries.find(
            (e) =>
                String(e.key ?? '').trim().toUpperCase() === needle ||
                String(e.text ?? '').trim().toUpperCase() === needle,
        ) ?? null
    );
}

/**
 * "Gia tri nay nam NGOAI danh muc chua?" — phep thu duy nhat cho F4 cung.
 *
 * ── Vi sao mot ham chung ──
 * Hai noi can cau tra loi: o nhap (de to mau va giai thich) va nut Save (de chan).
 * Hai ban sao cua cung mot dieu kien se lech nhau — va lech theo huong te nhat:
 * o nhap khong bao gi, con nut Save thi chan, nguoi dung khong biet vi sao.
 *
 * ── Ba truong hop CO Y tra ve false ──
 *  - dang nap: trong luc cho mang thi moi ma deu "khong khop".
 *  - danh muc RONG: F4 chet vi backend hong khong duoc bien thanh "khong luu duoc
 *    gi ca". Danh muc khong nap duoc la su co ha tang, khong phai loi nguoi nhap.
 *  - o de trong: viec cua `required`, khong phai viec cua danh muc.
 */
export function isOutsideCatalogue(
    entries: ValueHelpEntry[],
    value: string,
    loading = false,
): boolean {
    if (loading || !entries.length) return false;
    if (!value.trim()) return false;
    return findEntry(entries, value) === null;
}

/**
 * Ap returnMapping cua mot muc da chon.
 *
 * Tra ve `{ targetField: value }` de phia goi tu quyet dinh set state nao — day
 * la lop dich duy nhat giua cau hinh F4 va cac o cua form.
 */
export function applyReturnMapping(
    entry: ValueHelpEntry,
    returnMapping: ReturnMappingRule[],
): Record<string, string> {
    const out: Record<string, string> = {};
    for (const rule of returnMapping) {
        const value = entry[rule.sourceColumn];
        if (value === null || value === undefined) continue;
        out[rule.targetField] = String(value);
    }
    return out;
}
