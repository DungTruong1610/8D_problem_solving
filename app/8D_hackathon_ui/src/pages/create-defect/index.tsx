import { useState, useMemo, useRef, useEffect, useCallback, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { fillPlaceholderOnTab } from '@/hooks/use-placeholder-autofill';
import { useUserInfo } from '@/hooks/use-user-info';
import { useValueHelp, useValueHelpSync } from '@/hooks/use-value-help';
import { ValueHelpInput } from '@/components/ui/ValueHelpInput';
import {
    applyReturnMapping,
    isOutsideCatalogue,
    VALUE_HELP_IDS,
    type ValueHelpEntry,
    type ReturnMappingRule,
} from '@/services/value-help-service';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Spinner,
    Textarea,
} from '@cnma/react-ui';
import {
    AlertCircle,
    Box,
    Check,
    Code2,
    Copy,
    Factory,
    FileJson,
    FileText,
    Plus,
    ShieldAlert,
    Sparkles,
    Trash2,
    TriangleAlert,
    Upload,
    UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { queryClient } from '@/query-client';
import { defectsService, type DefectItem } from '@/services/defect-service';
import { useNextNumber } from '@/services/master-data-service';

export const ORIGIN_CUSTOMER = 'Q1 - Customer Complaint';

/**
 * Ba nguồn gốc mà form ghi nhận được — gương của `ORIGIN_*` phía server.
 *
 * `allowsLot` là luật, không phải trang trí: lô kiểm tra là đối tượng của nhà
 * máy MÌNH. Khiếu nại khách hàng đến sau khi hàng đã rời cổng, nên nó không có
 * lô nào cả — gắn một số lô vào đó là dựng một mắt xích không tồn tại. Server
 * cũng bỏ nó ở `caseMapper`; ở đây chỉ là để người dùng không phải gõ vào một ô
 * rồi mới biết nó bị vứt.
 */
const ORIGINS = [
    { value: 'Q3 - Internal Defect', label: 'Q3 - Internal Defect (Shop Floor)', allowsLot: true },
    { value: 'Q2 - Supplier Defect', label: 'Q2 - Supplier Defect (Incoming)', allowsLot: true },
    { value: ORIGIN_CUSTOMER, label: 'Q1 - Customer Complaint (Field Return)', allowsLot: false },
] as const;

/*
 * Không còn `generateRandomId()`.
 *
 * Nó sinh `8D-` + 8 chữ số NGẪU NHIÊN — cùng đúng dải mà kho case thật đang
 * dùng (8D-10049001, 8D-10048577, ...). Không có gì kiểm tra trùng, nên hai case
 * khác nhau mang cùng một mã là chuyện có thể xảy ra, và mã đó là thứ mọi trích
 * dẫn tiền lệ dựa vào. Số cũng xuất hiện ngay khi mở form, tức là nhìn như đã
 * được cấp trong khi chưa có gì được lưu.
 *
 * Giờ để trống thì SERVER cấp, trong transaction của lần lưu (xem
 * `srv/src/domain/numberRange.ts`). Ô vẫn gõ được: dữ liệu từ SAP mang số của
 * chính nó, và SAP cũng cho phép cả hai kiểu.
 */

/** Một dòng của lưới kết quả kiểm tra, ở dạng người dùng đang gõ. */
interface InspectionFormRow {
    /**
     * Khoá của dòng ĐÃ có trong DB. Rỗng nghĩa là dòng mới người dùng vừa thêm.
     *
     * ── Vì sao phải mang theo ──
     * `DefectCharacteristics` là `cuid, managed`. CAP cập nhật composition bằng
     * cách khớp KHOÁ: gửi kèm khoá thì nó UPDATE đúng dòng đó; không gửi thì nó
     * hiểu là "mấy dòng cũ biến mất, đây là mấy dòng mới" — xoá rồi chèn lại.
     *
     * Nội dung sống sót, nên nhìn từ màn hình không thấy gì sai. Thứ mất là
     * `createdAt`/`createdBy`: sửa một lỗi CHÍNH TẢ ở ô mô tả cũng làm mọi dòng
     * đo khai sinh lại vào đúng giây đó. Với một app QM thì "số này đo lúc nào,
     * ai nhập" chính là câu mà một cuộc audit sẽ hỏi.
     *
     * KHÔNG đi vào payload SAP — mục `inspections` ở `builtPayloadObject` liệt kê
     * tường minh từng trường, và khoá này là của ProResolve chứ không phải của SAP.
     */
    ID?: string;
    characteristic: string;
    measuredValue: string;
    specLowerLimit: string;
    specUpperLimit: string;
    specUom: string;
    /** '' | 'Accepted' | 'Rejected'. Rỗng nghĩa là CHƯA phán quyết, không phải đạt. */
    valuation: string;
    equipment: string;
}

const EMPTY_INSPECTION: InspectionFormRow = {
    characteristic: '', measuredValue: '',
    specLowerLimit: '', specUpperLimit: '', specUom: '',
    valuation: '', equipment: '',
};

export interface CreateDefectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /**
     * Gọi khi bản ghi LỖI đã được lưu — không phải khi một 8D được mở.
     *
     * ── Vì sao đổi ──
     * Bản trước gọi thẳng `analyzeFromJson`, tức là ghi nhận lỗi và mở 8D là MỘT
     * thao tác. Nó gộp hai quyết định độc lập: phần lớn lỗi được ghi nhận rồi
     * đóng lại mà không cần 8D, và một 8D tự động cho mọi lỗi là 8D không ai
     * quyết định mở. Nay form chỉ lưu lỗi; mở 8D là hành động riêng, có chủ ý.
     */
    onCreated?: (defect: DefectItem) => void;
    /**
     * Bản ghi đang được SỬA. Bỏ trống là chế độ ghi mới.
     *
     * ── Vì sao là cùng một hộp thoại chứ không phải một form sửa riêng ──
     * Cùng lý do đã viết ở đầu `DefectsTab.tsx`: form này mang tám ô F4, quy tắc
     * ép `entryMode` theo nguồn gốc, sentinel 'N/A' cho case không hướng khách
     * hàng, và lưới kết quả đo. Một form sửa riêng là bản sao thứ hai của toàn bộ
     * luật đó — và bản sao sẽ lệch, im lặng, ở đúng chỗ khó thấy nhất.
     *
     * Chỉ truyền bản ĐẦY ĐỦ (đã `$expand=characteristics`). Truyền bản danh sách
     * thì lưới kết quả đo sẽ trống, và bấm Save sẽ XOÁ số liệu đo thật.
     */
    defect?: DefectItem | null;
}

export function CreateDefectDialog({ open, onOpenChange, onCreated, defect }: CreateDefectDialogProps) {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showJsonPreview, setShowJsonPreview] = useState(false);
    const [showJsonImport, setShowJsonImport] = useState(false);
    const [importJsonText, setImportJsonText] = useState('');
    const [importError, setImportError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const isLocal = typeof window !== 'undefined' && (
        (import.meta as any).env?.DEV ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
    );

    const { userInfo } = useUserInfo();
    const currentUserName = isLocal ? 'admin' : (userInfo?.displayName || userInfo?.name || 'admin');

    const [notificationId, setNotificationId] = useState('');
    const [origin, setOrigin] = useState('Q3 - Internal Defect');
    const [symptomShortText, setSymptomShortText] = useState('');
    const [status] = useState('Open');
    const [foundDate, setFoundDate] = useState(() => new Date().toISOString().split('T')[0]);
    // Lượng ảnh hưởng: SỐ + đơn vị, không phải một câu.
    //
    // Bản trước là một ô văn bản duy nhất, và người dùng gõ vào đó '128 units
    // affected', 'approx. 2 pallets', 'whole lot'. Không cái nào cộng được, lọc
    // được, hay so được giữa hai case — trong khi đây chính là con số mà mọi báo
    // cáo chất lượng hỏi đầu tiên. Đơn vị đi qua F4 `UOM` để 'PC' và 'pcs' không
    // thành hai đơn vị khác nhau.
    const [defectQuantity, setDefectQuantity] = useState('');
    const [defectQuantityUom, setDefectQuantityUom] = useState('');
    // Số tham chiếu của một hệ thống KHÁC: phiếu khiếu nại của khách, phiếu giao
    // hàng của NCC, số ticket. Cố ý để tự do — ta không sở hữu danh mục đó, nên
    // không có gì để F4 vào. Đây là sợi dây duy nhất nối case này ra ngoài.
    const [referenceNumber, setReferenceNumber] = useState('');

    const [plant, setPlant] = useState('');
    const [materialId, setMaterialId] = useState('');
    const [materialDesc, setMaterialDesc] = useState('');
    const [materialGroup, setMaterialGroup] = useState('');
    const [batchId, setBatchId] = useState('');

    const [workCenterId, setWorkCenterId] = useState('');
    const [workCenterDesc, setWorkCenterDesc] = useState('');

    const [defectCodeGroup, setDefectCodeGroup] = useState('');
    const [defectCode, setDefectCode] = useState('');
    const [defectText, setDefectText] = useState('');
    // Thuật ngữ trên giao diện là "Severity", tên cột là `defectClass` (FECLAS của
    // SAP). Một nhãn cho người dùng, một tên trong schema — cố ý, không phải sót.
    const [defectClass, setDefectClass] = useState('');

    const [entryMode, setEntryMode] = useState<'during-inspection' | 'outside-inspection'>('during-inspection');
    const [inspectionLotId, setInspectionLotId] = useState('');

    /**
     * Một dòng kết quả kiểm tra.
     *
     * `specLowerLimit` / `specUpperLimit` / `specUom` thay cho ô `specValue` cũ —
     * xem `InspectionRow` phía server để biết vì sao. `valuation` là bước ③ của
     * SAP: phán quyết Accepted / Rejected của người kiểm, thứ trước nay không có
     * chỗ nào để ghi. Giữ chuỗi ở state (ô nhập trả về chuỗi); server ép sang số.
     */
    const [inspections, setInspections] = useState<InspectionFormRow[]>([
        { ...EMPTY_INSPECTION },
    ]);

    const [reportedBy, setReportedBy] = useState('');
    const [coordinator, setCoordinator] = useState('');
    const [department, setDepartment] = useState('');

    const [complaintReference, setComplaintReference] = useState('');
    const [customerPlantContact, setCustomerPlantContact] = useState('');
    const [slaResponseDue, setSlaResponseDue] = useState('');

    const isEditing = Boolean(defect?.ID);
    const nextDefectIdQuery = useNextNumber('DEFECT', open && !isEditing);

    const resetForm = useCallback(() => {
        setNotificationId('');
        setOrigin('Q3 - Internal Defect');
        setSymptomShortText('');
        setFoundDate(new Date().toISOString().split('T')[0]);
        setDefectQuantity('');
        setDefectQuantityUom('');
        setReferenceNumber('');
        setPlant('');
        setMaterialId('');
        setMaterialDesc('');
        setMaterialGroup('');
        setBatchId('');
        setWorkCenterId('');
        setWorkCenterDesc('');
        setDefectCodeGroup('');
        setDefectCode('');
        setDefectText('');
        setDefectClass('');
        setEntryMode('during-inspection');
        setInspectionLotId('');
        setInspections([{ ...EMPTY_INSPECTION }]);
        setReportedBy(currentUserName || '');
        setCoordinator('');
        setDepartment('');
        setComplaintReference('');
        setCustomerPlantContact('');
        setSlaResponseDue('');
        setError(null);
        setBusy(false);
        setShowJsonPreview(false);
        setShowJsonImport(false);
        setImportJsonText('');
        setImportError(null);
        setCopied(false);
    }, [currentUserName]);

    // Refetch the freshest defect peek number on open in create mode
    useEffect(() => {
        if (open && !isEditing) {
            void nextDefectIdQuery.refetch();
        }
    }, [open, isEditing]);

    const displayedNotificationId = isEditing
        ? notificationId
        : (notificationId || nextDefectIdQuery.data || 'Allocating ID...');

    /**
     * Đổ bản ghi đang sửa vào form, MỘT LẦN mỗi lần mở.
     *
     * ── Vì sao phụ thuộc vào `defect?.ID` chứ không phải `defect` ──
     * `DefectsTab` giữ bản ghi trong state của react-query; mỗi lượt refetch trả
     * về một object mới với nội dung y hệt. Phụ thuộc vào object là mỗi lượt
     * refetch xoá sạch những gì người dùng đang gõ dở — im lặng, và chỉ xảy ra khi
     * mạng chậm hơn tay.
     *
     * Sentinel 'N/A - ...' của case không hướng khách hàng KHÔNG đổ vào ô: đó là
     * thứ payload mang, không phải thứ người dùng gõ. Hiện nó ra rồi lưu lại là
     * biến một chỗ trống có chủ đích thành một chuỗi rác do người nhập.
     */
    useEffect(() => {
        if (!open) {
            if (!defect) resetForm();
            return;
        }
        if (!defect) {
            resetForm();
            return;
        }

        setNotificationId(defect.defectId ?? '');
        setOrigin(defect.origin ?? 'Q3 - Internal Defect');
        setSymptomShortText(defect.symptomShortText ?? '');
        setFoundDate(defect.foundDate ?? new Date().toISOString().split('T')[0]);
        setDefectQuantity(defect.defectQuantity != null ? String(defect.defectQuantity) : '');
        setDefectQuantityUom(defect.defectQuantityUom ?? '');
        setReferenceNumber(defect.referenceNumber ?? '');

        setPlant(defect.plant ?? '');
        setMaterialId(defect.materialId ?? '');
        setMaterialDesc(defect.materialDesc ?? '');
        setMaterialGroup(defect.materialGroup ?? '');
        setBatchId(defect.batchId ?? '');

        setWorkCenterId(defect.workCenterId ?? '');
        setWorkCenterDesc(defect.workCenterDesc ?? '');

        setDefectCodeGroup(defect.defectCodeGroup ?? '');
        setDefectCode(defect.defectCode ?? '');
        setDefectText(defect.defectText ?? '');
        setDefectClass(defect.defectClass ?? '');

        setEntryMode(defect.entryMode === 'during-inspection' ? 'during-inspection' : 'outside-inspection');
        setInspectionLotId(defect.inspectionLotId ?? '');

        setInspections(
            defect.characteristics?.length
                ? [...defect.characteristics]
                    .sort((a, b) => (a.lineNo ?? 0) - (b.lineNo ?? 0))
                    .map((c) => ({
                        // Giữ khoá để lần lưu sau là UPDATE tại chỗ, không phải
                        // xoá-chèn-lại. Xem `InspectionFormRow.ID`.
                        ID: c.ID,
                        characteristic: c.characteristic ?? '',
                        measuredValue: c.measuredValue ?? '',
                        specLowerLimit: c.specLowerLimit != null ? String(c.specLowerLimit) : '',
                        specUpperLimit: c.specUpperLimit != null ? String(c.specUpperLimit) : '',
                        specUom: c.specUom ?? '',
                        valuation: c.valuation ?? '',
                        equipment: c.equipment ?? '',
                    }))
                : [{ ...EMPTY_INSPECTION }],
        );

        setReportedBy(defect.reportedBy ?? '');
        setCoordinator(defect.coordinator ?? '');
        setDepartment(defect.department ?? '');

        const na = (v: string | null | undefined) =>
            (v && !v.startsWith('N/A') ? v : '');
        setComplaintReference(na(defect.complaintReference));
        setCustomerPlantContact(na(defect.customerPlantContact));
        setSlaResponseDue(na(defect.slaResponseDue));

        setError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, defect?.ID]);

    /**
     * Case này có lô kiểm tra được không? Gương của `originAllowsInspectionLot`
     * phía server. Nguồn gốc lạ (dữ liệu cũ, file import) mặc định là CÓ — luật ở
     * đây là một lệnh cấm hẹp cho Q1, không phải một danh sách trắng.
     */
    const originAllowsLot = ORIGINS.find((o) => o.value === origin)?.allowsLot ?? true;

    /**
     * Đổi nguồn gốc sang Q1 thì dọn luôn lô kiểm tra đang gõ dở.
     *
     * Không chỉ để cho gọn: ô bị ẩn nhưng state thì không, và một số lô còn sót
     * trong state là một số sẽ đi theo payload. Ép `outside-inspection` cùng lúc
     * cho khớp với thứ server sẽ ghi lại, để phần xem trước JSON không nói dối.
     */
    const changeOrigin = useCallback((next: string) => {
        setOrigin(next);
        if (ORIGINS.find((o) => o.value === next)?.allowsLot === false) {
            setInspectionLotId('');
            setEntryMode('outside-inspection');
        }
    }, []);

    useEffect(() => {
        if (!reportedBy && currentUserName) {
            setReportedBy(currentUserName);
        }
    }, [currentUserName, reportedBy]);

    // ── Bảy danh mục F4 ─────────────────────────────────────────────────────────
    //
    // Mọi ô mã đi qua `ValueHelpList` chứ không đọc thẳng bảng dữ liệu. Ngày S/4
    // được nối, mỗi danh mục chuyển sang nguồn thật bằng cách sửa `sourceType` của
    // MỘT DÒNG trong bảng đó — không dòng code nào ở đây phải đổi.
    const plantVh = useValueHelp(VALUE_HELP_IDS.plant);
    const materialVh = useValueHelp(VALUE_HELP_IDS.material);
    const workCenterVh = useValueHelp(VALUE_HELP_IDS.workCenter);
    const codeGroupVh = useValueHelp(VALUE_HELP_IDS.defectCodeGroup);
    const partnerVh = useValueHelp(VALUE_HELP_IDS.partner);
    // Catalog type 9 của SAP là hai tầng: nhóm quyết định mã nào chọn được. Chưa
    // chọn nhóm thì `dependsOnValue` rỗng và danh sách trả về đủ cả 25 mã — người
    // dùng không bị bắt phải biết nhóm trước mới tra được mã.
    const defectCodeVh = useValueHelp(VALUE_HELP_IDS.defectCode, { dependsOnValue: defectCodeGroup });
    const uomVh = useValueHelp(VALUE_HELP_IDS.uom);
    // Lô kiểm tra lọc theo VẬT TƯ: một nhà máy có hàng nghìn lô, một vật tư có
    // vài. Chưa chọn vật tư thì `dependsOnValue` rỗng và danh sách trả về mọi lô —
    // vẫn tra được, chỉ là dài. Chỉ nạp ở Đường A: Đường B không có lô nào.
    const inspectionLotVh = useValueHelp(VALUE_HELP_IDS.inspectionLot, {
        dependsOnValue: materialId,
        enabled: entryMode === 'during-inspection',
    });
    // Lô hàng (Batch ID): lọc theo VẬT TƯ (materialId)
    const batchVh = useValueHelp(VALUE_HELP_IDS.batch, {
        dependsOnValue: materialId,
        enabled: Boolean(materialId.trim()),
    });
    const departmentVh = useValueHelp(VALUE_HELP_IDS.department);
    const coordinatorVh = useValueHelp(VALUE_HELP_IDS.coordinator);
    // Đặc tính đo kiểm chuẩn (Master Inspection Characteristics): lọc theo VẬT TƯ (materialId)
    const characteristicVh = useValueHelp(VALUE_HELP_IDS.characteristic, {
        dependsOnValue: materialId,
    });

    /**
     * Dán các ô phụ thuộc sau khi chọn một mục F4.
     *
     * `returnMapping` do DỮ LIỆU quyết định, không phải code: thêm một cột vào
     * mapping của `MATERIAL` là ô tương ứng tự được điền. Bảng dưới đây chỉ dịch
     * `targetField` sang setter — thiếu tên nào thì bỏ qua chứ không nổ, vì mapping
     * có thể mang cột mà form này chưa dùng tới.
     */
    const applyPick = useCallback((entry: ValueHelpEntry, mapping: ReturnMappingRule[]) => {
        const setters: Record<string, (v: string) => void> = {
            materialDesc: setMaterialDesc,
            materialGroup: setMaterialGroup,
            workCenterDesc: setWorkCenterDesc,
            defectText: setDefectText,
            defectClass: setDefectClass,
            defectCodeGroup: setDefectCodeGroup,
            batchId: setBatchId,
            coordinator: setCoordinator,
            department: setDepartment,
        };
        for (const [field, value] of Object.entries(applyReturnMapping(entry, mapping))) {
            setters[field]?.(value);
        }
    }, []);

    /**
     * Giữ các ô mô tả khớp với mã, DÙ mã vào ô bằng đường nào.
     *
     * `onPick` chỉ bắn khi người dùng chọn từ danh sách. Mã còn vào ô bằng ba
     * đường khác — gõ đủ mã, dán, nạp từ JSON — và ba đường đó trước đây để lại
     * mô tả của mã CŨ nằm cạnh mã MỚI. Ba hook dưới đây đóng cả ba đường, và
     * cũng là chỗ dọn ô chỉ đọc khi mã bị xoá trắng.
     *
     * Chỉ ba danh mục này cần: chúng là ba danh mục DUY NHẤT có ô mô tả đi kèm
     * trên màn hình. Coordinator và Department tự trả về chính giá trị của mình,
     * không suy ra ô nào khác.
     */
    useValueHelpSync({
        value: materialId,
        state: materialVh,
        setters: { materialDesc: setMaterialDesc, materialGroup: setMaterialGroup },
        // Nhóm vật tư là thuộc tính của MÃ và ô của nó chỉ đọc. Mã không tra được
        // nữa mà vẫn để nguyên nhóm cũ là để lại một lời khẳng định sai.
        derivedReadOnly: ['materialGroup'],
        // Lô hàng lọc theo vật tư: đổi vật tư thì lô cũ thuộc về vật tư khác.
        onEntryChange: () => setBatchId(''),
    });

    useValueHelpSync({
        value: workCenterId,
        state: workCenterVh,
        setters: { workCenterDesc: setWorkCenterDesc },
        derivedReadOnly: ['workCenterDesc'],
    });

    useValueHelpSync({
        value: defectCode,
        state: defectCodeVh,
        setters: {
            defectText: setDefectText,
            defectClass: setDefectClass,
            defectCodeGroup: setDefectCodeGroup,
        },
        // Mức nghiêm trọng suy ra từ mã, người dùng không gõ được. Mô tả thì sửa
        // được nên không nằm ở đây — nó chỉ bị ghi đè khi chuyển hẳn sang mã khác.
        derivedReadOnly: ['defectClass'],
    });

    /**
     * Chọn một lô kiểm tra — ĐÂY là toàn bộ Đường A.
     *
     * Lô mang theo vật tư, nhà máy, work center, thiết bị và một dòng kết quả.
     * Không dán chúng sang thì "Found during inspection" chỉ là một giá trị
     * dropdown, và người vận hành gõ lại đúng những gì hệ thống đã giữ.
     *
     * ── Ghi vào dòng kết quả nào ──
     * Dòng ĐẦU nếu nó còn trống, ngược lại thêm một dòng mới. Đè lên dữ liệu người
     * dùng vừa gõ là cách nhanh nhất để mất một số đo mà không ai nhận ra.
     *
     * ── Vì sao KHÔNG dán giới hạn spec ──
     * Bảng lô không giữ giới hạn (xem `InspectionLots`), nên hai ô đó vẫn phải
     * nhập tay. Nhưng `valuation` thì có — nó là cột `conforming` — và một dòng có
     * valuation là một dòng kết luận được mà không cần giới hạn nào.
     */
    const applyLotPick = useCallback((entry: ValueHelpEntry, mapping: ReturnMappingRule[]) => {
        const mapped = applyReturnMapping(entry, mapping);
        if (mapped.materialId && mapped.materialId !== materialId) {
            setBatchId('');
        }
        const headerSetters: Record<string, (v: string) => void> = {
            materialId: setMaterialId,
            plant: setPlant,
            workCenterId: setWorkCenterId,
        };
        for (const [field, value] of Object.entries(mapped)) {
            if (value) headerSetters[field]?.(value);
        }

        // `conforming` về đây dưới dạng chuỗi 'true'/'false' (hoặc '1'/'0' tuỳ
        // driver). Chỉ dịch khi nhận ra được — một giá trị lạ thành 'Accepted' là
        // biến chuyện không biết thành lời khẳng định đạt.
        const conforming = String(mapped.lotConforming ?? '').toLowerCase();
        const valuation = ['true', '1', 'x', 'yes'].includes(conforming) ? 'Accepted'
            : ['false', '0', 'no'].includes(conforming) ? 'Rejected'
            : '';

        const lotRow: InspectionFormRow = {
            ...EMPTY_INSPECTION,
            characteristic: String(mapped.lotCharacteristic ?? ''),
            measuredValue: String(mapped.lotMeasuredValue ?? ''),
            specUom: String(mapped.lotUom ?? ''),
            valuation,
            equipment: String(mapped.lotEquipment ?? ''),
        };

        setInspections((prev) => {
            const isBlank = (r: InspectionFormRow) =>
                !r.characteristic.trim() && !r.measuredValue.trim() && !r.equipment.trim();
            if (prev.length && isBlank(prev[0])) {
                return [lotRow, ...prev.slice(1)];
            }
            return [...prev, lotRow];
        });
    }, []);

    /**
     * Những dòng kết quả KHÔNG kết luận được.
     *
     * Gương của `resolveOutOfSpec` phía server: có valuation là xong; không thì
     * cần ít nhất một giới hạn để so số đo vào. Dòng trống hoàn toàn không tính —
     * lưới luôn để sẵn một dòng rỗng, và bắt lỗi nó là bắt lỗi trạng thái ban đầu.
     */
    const unjudgedRows = useMemo(
        () => inspections
            .filter((r) =>
                (r.characteristic.trim() || r.measuredValue.trim())
                && !r.valuation.trim()
                && !r.specLowerLimit.trim()
                && !r.specUpperLimit.trim())
            .map((r) => r.characteristic.trim() || '(unnamed row)'),
        [inspections],
    );

    const reportedByOptions = useMemo(() => {
        const list: { value: string; label: string }[] = [];
        if (currentUserName) {
            list.push({
                value: currentUserName,
                label: isLocal ? 'admin' : `${currentUserName}${userInfo.isAdmin ? ' (Admin)' : ''}`,
            });
        }
        for (const entry of partnerVh.entries) {
            const name = String(entry.partnerName ?? entry.text ?? '').trim();
            if (!name || name === currentUserName) continue;
            const cleanId = String(entry.key ?? '').replace(/^BP-/i, '');
            const title = entry.functionTitle ? ` (${String(entry.functionTitle)})` : '';
            list.push({ value: name, label: `${cleanId} — ${name}${title}` });
        }
        return list;
    }, [currentUserName, partnerVh.entries, isLocal, userInfo.isAdmin]);

    /**
     * Những ô đang giữ giá trị NGOÀI danh mục. F4 cứng (Q3) ⇒ chặn Save.
     *
     * ── Vì sao tính ở đây chứ không để từng ô tự chặn ──
     * Một ô không biết gì về nút Save, và nút Save không đọc được trạng thái của
     * bảy ô. Gom về một chỗ thì thông báo nói được ĐÍCH DANH ô nào sai, thay vì
     * một nút xám không giải thích.
     *
     * ── Đây cũng là lưới chắn cho đường nhập JSON ──
     * `applyJsonPayload` ghi thẳng vào state, không đi qua ô chọn nào. Một payload
     * mang mã lỗi không có trong catalogue vì thế lọt được vào form — và bị chặn ở
     * đây, kèm tên ô, thay vì đi tiếp thành một case không tra ngược được.
     */
    const catalogueBlockers = useMemo(() => {
        const checks: Array<[string, boolean]> = [
            ['Plant', isOutsideCatalogue(plantVh.entries, plant, plantVh.loading)],
            ['Material ID', isOutsideCatalogue(materialVh.entries, materialId, materialVh.loading)],
            ['Batch ID', isOutsideCatalogue(batchVh.entries, batchId, batchVh.loading)],
            ['Work Center ID', isOutsideCatalogue(workCenterVh.entries, workCenterId, workCenterVh.loading)],
            ['Defect Code Group', isOutsideCatalogue(codeGroupVh.entries, defectCodeGroup, codeGroupVh.loading)],
            ['Defect Code', isOutsideCatalogue(defectCodeVh.entries, defectCode, defectCodeVh.loading)],
            ['Notification Coordinator', isOutsideCatalogue(coordinatorVh.entries, coordinator, coordinatorVh.loading)],
            ['Responsible Department', isOutsideCatalogue(departmentVh.entries, department, departmentVh.loading)],
        ];
        return checks.filter(([, bad]) => bad).map(([label]) => label);
    }, [
        plant, plantVh.entries, plantVh.loading,
        materialId, materialVh.entries, materialVh.loading,
        batchId, batchVh.entries, batchVh.loading,
        workCenterId, workCenterVh.entries, workCenterVh.loading,
        defectCodeGroup, codeGroupVh.entries, codeGroupVh.loading,
        defectCode, defectCodeVh.entries, defectCodeVh.loading,
        coordinator, coordinatorVh.entries, coordinatorVh.loading,
        department, departmentVh.entries, departmentVh.loading,
    ]);

    /**
     * Ô bắt buộc theo nguồn gốc.
     *
     * Case Q1 phải có mã khiếu nại. Trước đây ô trống được lấp bằng
     * 'CC-2026-PENDING' — case vẫn lưu được, trông vẫn đầy đủ, và sợi dây duy nhất
     * nối về hồ sơ bên phía khách hàng thì không tồn tại. Bỏ giá trị bịa đi thì
     * phải có chỗ nói ra điều đó, nếu không ô trống lại lặng lẽ đi tiếp.
     *
     * Câu đầy đủ chứ không phải tên ô: khác với `catalogueBlockers`, ở đây lý do
     * mới là thứ người dùng cần, không phải "ô nào".
     */
    const requiredBlockers = useMemo(() => {
        const list: string[] = [];
        if (origin === ORIGIN_CUSTOMER && !complaintReference.trim()) {
            list.push(
                'A customer complaint (Q1) needs its Complaint Reference — it is the only link back to '
                + "the customer's own record.",
            );
        }
        return list;
    }, [origin, complaintReference]);

    /** Mọi lý do khiến Save bị chặn, đã thành câu, theo đúng thứ tự hiển thị. */
    const saveBlockers = useMemo(() => {
        const list = [...requiredBlockers];
        if (catalogueBlockers.length) {
            list.push(
                `${catalogueBlockers.join(', ')} ${catalogueBlockers.length > 1 ? 'hold values' : 'holds a value'} `
                + 'outside the catalogue. Pick from the list, or add it in Master Data first.',
            );
        }
        return list;
    }, [requiredBlockers, catalogueBlockers]);

    // Inspection row controls
    const addInspection = () => {
        setInspections([...inspections, { ...EMPTY_INSPECTION }]);
    };

    const updateInspection = (
        index: number,
        field: keyof InspectionFormRow,
        value: string,
    ) => {
        const updated = [...inspections];
        updated[index] = { ...updated[index], [field]: value };
        setInspections(updated);
    };

    /**
     * Tự động điền dung sai thiết kế, đơn vị và thiết bị đo chuẩn khi chọn MIC từ F4.
     */
    const handlePickCharacteristic = useCallback((index: number, entry: ValueHelpEntry) => {
        setInspections((prev) => {
            const updated = [...prev];
            const current = updated[index] ?? { ...EMPTY_INSPECTION };
            const charText = String(entry.text || entry.key || '');
            const specLower = entry.specLowerLimit !== undefined && entry.specLowerLimit !== null
                ? String(entry.specLowerLimit) : current.specLowerLimit;
            const specUpper = entry.specUpperLimit !== undefined && entry.specUpperLimit !== null
                ? String(entry.specUpperLimit) : current.specUpperLimit;
            const uom = entry.specUom ? String(entry.specUom) : current.specUom;
            const equipment = (entry.defaultEquipment && !current.equipment)
                ? String(entry.defaultEquipment) : current.equipment;

            updated[index] = {
                ...current,
                characteristic: charText,
                specLowerLimit: specLower,
                specUpperLimit: specUpper,
                specUom: uom,
                equipment,
            };
            return updated;
        });
    }, []);

    const removeInspection = (index: number) => {
        if (inspections.length <= 1) return;
        setInspections(inspections.filter((_, i) => i !== index));
    };

    const applyJsonPayload = (rawJson: string, sourceName?: string) => {
        setImportError(null);
        if (!rawJson.trim()) {
            setImportError('Please provide a valid JSON payload.');
            return false;
        }

        try {
            const parsed = JSON.parse(rawJson);
            const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
            const note = Array.isArray(data.notifications) ? data.notifications[0] : (data.notification || data);
            const mat = Array.isArray(data.materials) ? data.materials[0] : (data.material || {});
            const batch = Array.isArray(data.batches) ? data.batches[0] : (data.batch || {});
            const defect = Array.isArray(data.defect_catalog) ? data.defect_catalog[0] : (data.defect || {});
            const workCenter = Array.isArray(data.work_centers) ? data.work_centers[0] : (data.workCenter || {});
            const custRef = Array.isArray(data.customer_reference) ? data.customer_reference[0] : (data.customerReference || data.customer || {});
            const rawInspections = Array.isArray(data.inspections) ? data.inspections : (Array.isArray(parsed.inspections) ? parsed.inspections : []);

            // Populate fields
            const nextNotifId = note.notification_id || note.notificationId || parsed.notificationId;
            if (nextNotifId) setNotificationId(String(nextNotifId).trim());

            const nextOrigin = note.origin || parsed.origin;
            if (nextOrigin) {
                const oStr = String(nextOrigin).trim();
                if (oStr.toLowerCase().includes('customer') || oStr.startsWith('Q1')) {
                    setOrigin('Q1 - Customer Complaint');
                } else if (oStr.toLowerCase().includes('supplier') || oStr.startsWith('Q2')) {
                    setOrigin('Q2 - Supplier Defect');
                } else {
                    setOrigin('Q3 - Internal Defect');
                }
            }

            const nextSymptom = note.symptom_short_text || note.symptomShortText || parsed.symptomShortText || defect.defect_text || defect.defectText;
            if (nextSymptom) setSymptomShortText(String(nextSymptom).trim().slice(0, 255));

            const nextFoundDate = note.found_date || note.foundDate || parsed.foundDate;
            if (nextFoundDate) {
                const d = String(nextFoundDate).trim();
                if (/^\d{4}-\d{2}-\d{2}$/.test(d)) setFoundDate(d);
            }

            // Lượng ảnh hưởng: chỉ nhận khi payload mang SỐ. Một payload cũ chỉ có
            // '128 units affected' để lại hai ô trống — cố ý. Bóc số ra khỏi câu đó
            // thì cũng phải đoán 'units' là đơn vị nào, và đoán sai là ghi một
            // lượng sai vào hồ sơ mà không ai thấy chỗ đoán.
            const nextQty = note.defect_quantity ?? note.defectQuantity ?? parsed.defectQuantity;
            if (nextQty !== undefined && nextQty !== null && String(nextQty).trim() !== '') {
                setDefectQuantity(String(nextQty).trim());
            }
            const nextQtyUom = note.defect_quantity_uom || note.defectQuantityUom || parsed.defectQuantityUom;
            if (nextQtyUom) setDefectQuantityUom(String(nextQtyUom).trim().toUpperCase());

            // Material
            const nextMatId = mat.material_id || mat.materialId || note.material_id || note.materialId || parsed.materialId;
            if (nextMatId) setMaterialId(String(nextMatId).trim());

            const nextMatDesc = mat.description || mat.materialDesc || parsed.materialDesc;
            if (nextMatDesc) setMaterialDesc(String(nextMatDesc).trim());

            const nextMatGroup = mat.material_group || mat.materialGroup || note.material_group || parsed.materialGroup;
            if (nextMatGroup) setMaterialGroup(String(nextMatGroup).trim());

            // Batch
            const nextBatchId = batch.batch_id || batch.batchId || note.batch_id || parsed.batchId;
            if (nextBatchId) setBatchId(String(nextBatchId).trim());

            // Work Center
            const nextWcId = workCenter.work_center_id || workCenter.workCenterId || note.work_center_id || parsed.workCenterId;
            if (nextWcId) setWorkCenterId(String(nextWcId).trim());

            const nextWcDesc = workCenter.description || workCenter.workCenterDesc || parsed.workCenterDesc;
            if (nextWcDesc) setWorkCenterDesc(String(nextWcDesc).trim());

            // Defect
            const nextDefectCode = defect.defect_code || defect.defectCode || note.defect_code || parsed.defectCode;
            if (nextDefectCode) setDefectCode(String(nextDefectCode).trim());

            const nextDefectText = defect.defect_text || defect.defectText || parsed.defectText;
            if (nextDefectText) setDefectText(String(nextDefectText).trim());

            const nextCodeGroup = defect.code_group || defect.codeGroup || defect.defect_code_group
                || defect.defectCodeGroup || parsed.defectCodeGroup;
            if (nextCodeGroup) setDefectCodeGroup(String(nextCodeGroup).trim());

            const nextDefectClass = defect.defect_class || defect.defectClass || defect.severity || parsed.defectClass;
            if (nextDefectClass) setDefectClass(String(nextDefectClass).trim());

            const nextPlant = note.plant || note.plant_id || note.plantId || mat.plant || parsed.plant;
            if (nextPlant) setPlant(String(nextPlant).trim());

            const nextEntryMode = note.entry_mode || note.entryMode || parsed.entryMode;
            if (nextEntryMode) {
                setEntryMode(String(nextEntryMode).includes('outside') ? 'outside-inspection' : 'during-inspection');
            }

            const nextLotId = note.inspection_lot_id || note.inspectionLotId || parsed.inspectionLotId;
            if (nextLotId) setInspectionLotId(String(nextLotId).trim());

            // Số tham chiếu ngoài cũng nhận từ `complaint_reference` của khối khách
            // hàng: workbook cũ chỉ có một chỗ để ghi số phiếu khiếu nại, và đó
            // chính là số tham chiếu ngoài của case Q1.
            const nextRefNo = note.reference_number || note.referenceNumber || parsed.referenceNumber
                || custRef.complaint_reference || custRef.complaintReference;
            if (nextRefNo && !String(nextRefNo).startsWith('N/A')) {
                setReferenceNumber(String(nextRefNo).trim());
            }

            // Inspections
            if (rawInspections.length > 0) {
                const mappedInspections: InspectionFormRow[] = rawInspections.map((ins: any) => ({
                    characteristic: String(ins.characteristic ?? '').trim(),
                    measuredValue: String(ins.measured_value ?? ins.measuredValue ?? '').trim(),
                    // Payload cũ mang `specValue` dạng câu ('max 0.10mm'). Nó KHÔNG
                    // được nhét vào ô giới hạn: hai ô đó là số, và đổ một câu vào
                    // đấy chỉ tạo ra một dòng không lưu được. Để trống, kèm cảnh báo
                    // ở lưới, để người nhập điền lại — đó là toàn bộ điểm của 1.4.
                    specLowerLimit: String(ins.spec_lower_limit ?? ins.specLowerLimit ?? '').trim(),
                    specUpperLimit: String(ins.spec_upper_limit ?? ins.specUpperLimit ?? '').trim(),
                    specUom: String(ins.spec_uom ?? ins.specUom ?? ins.unit ?? '').trim(),
                    valuation: ['Accepted', 'Rejected'].includes(String(ins.valuation ?? '').trim())
                        ? String(ins.valuation).trim()
                        : '',
                    equipment: String(ins.equipment ?? ins.fixture ?? ins.equipment_id ?? '').trim(),
                })).filter((i: InspectionFormRow) =>
                    i.characteristic || i.measuredValue || i.specUpperLimit || i.specLowerLimit || i.equipment);

                if (mappedInspections.length > 0) {
                    setInspections(mappedInspections);
                }
            }

            // Responsibility
            const resp = data.responsibility || data.header || note || {};
            const nextReportedBy = resp.reported_by || resp.reportedBy || data.reported_by || data.reportedBy;
            if (nextReportedBy) setReportedBy(String(nextReportedBy).trim());

            const nextCoord = resp.coordinator || resp.notification_coordinator || resp.notificationCoordinator || data.coordinator;
            if (nextCoord) setCoordinator(String(nextCoord).trim());

            const nextDept = resp.department || resp.responsible_department || resp.responsibleDepartment || data.department;
            if (nextDept) setDepartment(String(nextDept).trim());

            // Customer Reference
            const nextCompRef = custRef.complaint_reference || custRef.complaintReference;
            if (nextCompRef && !String(nextCompRef).startsWith('N/A')) {
                setComplaintReference(String(nextCompRef).trim());
            }

            const nextContact = custRef.customer_plant_contact || custRef.customerPlantContact;
            if (nextContact && !String(nextContact).startsWith('N/A')) {
                setCustomerPlantContact(String(nextContact).trim());
            }

            const nextSla = custRef.sla_response_due || custRef.slaResponseDue;
            if (nextSla && !String(nextSla).startsWith('N/A')) {
                setSlaResponseDue(String(nextSla).trim());
            }

            setShowJsonImport(false);
            setImportJsonText('');
            toast.success(
                sourceName
                    ? `Loaded JSON file: ${sourceName}`
                    : 'JSON payload parsed & applied to form!',
                { description: 'All matching fields have been populated.' },
            );
            return true;
        } catch (err: any) {
            const errorMsg = `Invalid JSON syntax: ${err.message}`;
            setImportError(errorMsg);
            toast.error(errorMsg);
            return false;
        }
    };

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            applyJsonPayload(text, file.name);
        } catch (err: any) {
            toast.error(`Could not read file: ${err.message}`);
        } finally {
            // Reset input value so selecting the same file again triggers change
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

function cleanInput(val?: string | null): string {
    if (!val) return '';
    let cleaned = val.trim();
    // Bỏ placeholder dính vào do browser autofill/tab:
    // VD: "Characteristic (e.g. Flange burr height)" -> "Flange burr height"
    // VD: "Equipment / Fixture (e.g. WC-MILL-07-F1)" -> "WC-MILL-07-F1"
    // VD: "Measured (0.32 mm)" -> "0.32 mm"
    // VD: "Spec (max 0.10 mm)" -> "max 0.10 mm"
    const egMatch = cleaned.match(/e\.g\.\s*([^)]+)/i);
    if (
        cleaned.startsWith('Characteristic')
        || cleaned.startsWith('Equipment')
        || cleaned.startsWith('Spec')
        || cleaned.startsWith('Measured')
    ) {
        if (egMatch && egMatch[1]) {
            cleaned = egMatch[1].trim();
        }
    }
    // Bỏ "(links to QM inspection history)" hoặc "(links to ...)"
    cleaned = cleaned.replace(/\(links to [^)]+\)/gi, '').trim();
    // Bỏ tiền tố "e.g. " nếu bị dính
    cleaned = cleaned.replace(/^e\.g\.\s*/i, '').trim();
    return cleaned;
}

/**
 * Ô số → số, hoặc `null`.
 *
 * `null` chứ không 0: ô để trống nghĩa là CHƯA ĐO, còn 0 là một số đo hợp lệ
 * (khe hở 0 mm, 0 lỗi). Gộp hai thứ đó lại là mất đúng cái phân biệt mà D2 cần.
 * Nhận dấu phẩy thập phân vì bàn phím châu Âu gõ ra nó.
 */
function numberOrNull(val?: string | null): number | null {
    const s = String(val ?? '').replace(',', '.').trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

    // Dynamic JSON payload construction
    const builtPayloadObject = useMemo(() => {
        const isQ1 = origin === ORIGIN_CUSTOMER;
        const lotAllowed = ORIGINS.find((o) => o.value === origin)?.allowsLot ?? true;
        // Ép lại ở đây chứ không tin state: đường nạp sẵn từ JSON đặt origin và
        // entryMode ở hai chỗ khác nhau, nên state có thể lệch trong một nhịp.
        const effectiveEntryMode = lotAllowed ? entryMode : 'outside-inspection';
        return {
            // Null, không phải '8D-DEMO-001'. Số giả đó vượt qua mọi kiểm tra và
            // nằm lại trong sổ y như một số thật.
            notificationId: cleanInput(notificationId) || null,
            origin,
            symptomShortText: cleanInput(symptomShortText),
            status,
            foundDate: foundDate || null,
            completionDate: null,
            // `quantityExtent` không còn được gõ tay: server ghép nó từ số + đơn
            // vị. Vẫn gửi khoá này (là null) để hợp đồng payload không đổi hình.
            quantityExtent: null,
            defectQuantity: numberOrNull(defectQuantity),
            defectQuantityUom: cleanInput(defectQuantityUom) || null,
            entryMode: effectiveEntryMode,
            inspectionLotId: effectiveEntryMode === 'during-inspection' ? (cleanInput(inspectionLotId) || null) : null,
            // Số của HỆ THỐNG KHÁC (phiếu khiếu nại, phiếu giao hàng, ticket). Null
            // khi trống chứ không đặt giá trị thay — một số tham chiếu bịa ra thì
            // vô dụng hơn hẳn một ô để trống, vì nó trông như tra được.
            referenceNumber: cleanInput(referenceNumber) || null,
            plant: cleanInput(plant) || null,
            teamSize: null,
            material: {
                materialId: cleanInput(materialId) || null,
                description: cleanInput(materialDesc) || null,
                materialGroup: cleanInput(materialGroup) || null,
                plant: cleanInput(plant) || null,
            },
            batch: {
                batchId: cleanInput(batchId) || null,
                materialId: cleanInput(materialId) || null,
            },
            defect: {
                // Nhóm đi cùng mã, luôn luôn: mã lỗi chỉ duy nhất trong một nhóm.
                defectCodeGroup: cleanInput(defectCodeGroup) || null,
                defectCode: cleanInput(defectCode) || null,
                defectText: cleanInput(defectText) || null,
                defectClass: cleanInput(defectClass) || null,
            },
            workCenter: {
                workCenterId: cleanInput(workCenterId) || null,
                description: cleanInput(workCenterDesc) || null,
            },
            inspections: inspections
                .filter((i) => cleanInput(i.characteristic))
                .map((i) => ({
                    characteristic: cleanInput(i.characteristic),
                    measuredValue: cleanInput(i.measuredValue),
                    specLowerLimit: numberOrNull(i.specLowerLimit),
                    specUpperLimit: numberOrNull(i.specUpperLimit),
                    specUom: cleanInput(i.specUom) || null,
                    valuation: i.valuation || null,
                    equipment: cleanInput(i.equipment) || null,
                })),
            responsibility: {
                reportedBy: cleanInput(reportedBy) || currentUserName || null,
                coordinator: cleanInput(coordinator) || null,
                department: cleanInput(department) || null,
            },
            causesIshikawa: [],
            fiveWhyChain: [],
            actions: [],
            teamAssignments: [],
            isIsNot: null,
            fmeaLink: null,
            costCopq: null,
            lessonsLearned: null,
            /*
              Ô trống thì gửi null, KHÔNG gửi giá trị bịa.
              Bản trước điền 'CC-2026-PENDING' và 'Customer Quality' khi người dùng
              để trống. Cả hai đều trông như dữ liệu thật: chúng đi vào hồ sơ, vào
              ngữ cảnh của model, vào bản in gửi cho khách — và không ai còn phân
              biệt được đâu là mã khiếu nại có thật, đâu là chỗ trống được che lại.
              Một lỗi kiểm tra khó chịu hơn nhưng trung thực hơn nhiều.

              Chuỗi 'N/A - ...' cho case không hướng khách hàng thì KHÁC: đó là
              sentinel có chủ đích, `isDeliberateNA` phía server nhận ra nó và hạ cờ
              `applicable`. Nó nói "không áp dụng", không phải "chưa biết".
            */
            customerReference: {
                complaintReference: isQ1
                    ? complaintReference.trim() || null
                    : `N/A - ${origin.startsWith('Q2') ? 'supplier defect' : 'internal defect'}, no customer reference`,
                customerPlantContact: isQ1 ? customerPlantContact.trim() || null : 'N/A',
                slaResponseDue: isQ1 ? slaResponseDue.trim() || null : 'N/A',
            },
        };
    }, [
        notificationId,
        origin,
        symptomShortText,
        status,
        foundDate,
        defectQuantity,
        defectQuantityUom,
        entryMode,
        inspectionLotId,
        referenceNumber,
        plant,
        materialId,
        materialDesc,
        materialGroup,
        batchId,
        workCenterId,
        workCenterDesc,
        defectCodeGroup,
        defectCode,
        defectText,
        defectClass,
        inspections,
        reportedBy,
        coordinator,
        department,
        currentUserName,
        complaintReference,
        customerPlantContact,
        slaResponseDue,
    ]);

    const payloadJsonString = useMemo(
        () => JSON.stringify(builtPayloadObject, null, 2),
        [builtPayloadObject],
    );

    /**
     * Cùng dữ liệu, hình dạng của bảng `Defects`.
     *
     * ── Vì sao dẫn xuất từ `builtPayloadObject` chứ không đọc lại state ──
     * Payload là chỗ đã gom đủ mọi quy tắc: ép `entryMode` theo nguồn gốc, bỏ số
     * lô cho case Q1, sentinel 'N/A' cho ba ô khách hàng, `cleanInput` trên từng
     * ô. Đọc state lần thứ hai là chép lại cả bộ quy tắc đó — và bản chép sẽ lệch
     * ngay lần sửa kế tiếp, im lặng, vì cả hai đều cho ra dữ liệu trông hợp lệ.
     *
     * Khối JSON xem trước vẫn hiện `builtPayloadObject`: đó là thứ pipeline 8D sẽ
     * nhận nếu case này được mở 8D, và người dùng đang mô phỏng SAP muốn thấy
     * đúng hình dạng đó.
     *
     * `defectId` chỉ gửi khi người dùng gõ đè. Để trống thì server cấp số từ dải
     * `DEFECT` — trình duyệt không được tự đặt số cho một sổ có tính pháp lý.
     */
    const defectRecord = useMemo(() => {
        const p = builtPayloadObject;

        /*
          Khoá của các dòng đo, ghép lại theo THỨ TỰ.

          `p.inspections` sinh ra từ đúng một phép lọc trên `inspections`
          (`filter(i => cleanInput(i.characteristic))`), giữ nguyên thứ tự, nên
          dòng thứ n của hai mảng là cùng một dòng. Lặp lại phép lọc ở đây thay
          vì nhét `ID` vào payload: payload là hình dạng SAP, và khoá này là của
          ProResolve.

          Cặp đôi này phải sửa cùng nhau — nếu ai đó đổi điều kiện lọc ở trên mà
          quên ở đây, khoá sẽ gán lệch dòng.
        */
        const keptRows = inspections.filter((i) => cleanInput(i.characteristic));

        return {
            ...(p.notificationId ? { defectId: p.notificationId } : {}),
            origin: p.origin,
            // Lỗi vừa ghi nhận luôn là `Open`. `p.status` là trạng thái của CASE
            // ('In Process') — một thứ khác, và chỉ đúng khi 8D đã mở.
            status: 'Open',
            symptomShortText: p.symptomShortText ? p.symptomShortText.slice(0, 255) : null,
            foundDate: p.foundDate,
            defectQuantity: p.defectQuantity,
            defectQuantityUom: p.defectQuantityUom,
            referenceNumber: p.referenceNumber,
            plant: p.plant,
            materialId: p.material.materialId,
            materialDesc: p.material.description,
            materialGroup: p.material.materialGroup,
            batchId: p.batch.batchId,
            workCenterId: p.workCenter.workCenterId,
            workCenterDesc: p.workCenter.description,
            defectCodeGroup: p.defect.defectCodeGroup,
            defectCode: p.defect.defectCode,
            defectText: p.defect.defectText,
            defectClass: p.defect.defectClass,
            entryMode: p.entryMode,
            inspectionLotId: p.inspectionLotId,
            reportedBy: p.responsibility.reportedBy,
            coordinator: p.responsibility.coordinator,
            department: p.responsibility.department,
            complaintReference: p.customerReference.complaintReference,
            customerPlantContact: p.customerReference.customerPlantContact,
            slaResponseDue: p.customerReference.slaResponseDue,
            // Deep insert: CAP ghi bảng con trong CÙNG transaction. Ghi hai lượt
            // thì một lỗi giữa chừng để lại một bản ghi lỗi không có kết quả đo —
            // và D2 sẽ phán "không có bằng chứng ngoài dung sai" trên một lỗi vốn
            // có đủ số liệu.
            // Dòng đã có khoá thì gửi kèm khoá — CAP UPDATE tại chỗ và giữ
            // `createdAt`/`createdBy`. Dòng mới không có khoá, CAP tự cấp.
            // Xem `InspectionFormRow.ID` để biết vì sao điều đó quan trọng.
            characteristics: p.inspections.map((i, idx) => ({
                ...(keptRows[idx]?.ID ? { ID: keptRows[idx].ID } : {}),
                lineNo: idx + 1,
                ...i,
            })),
        };
    }, [builtPayloadObject, inspections]);

    // Copy JSON to clipboard
    const copyJson = () => {
        navigator.clipboard.writeText(payloadJsonString);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('JSON payload copied to clipboard');
    };

    // Form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!symptomShortText.trim()) {
            setError('Please enter a Symptom Description for the defect.');
            return;
        }
        // Nút Save đã bị vô hiệu hoá khi có ô sai, nhưng Enter trong một ô nhập vẫn
        // submit được form. Chặn lại ở đây chứ không tin vào `disabled`.
        if (saveBlockers.length) {
            setError(saveBlockers.join(' '));
            return;
        }

        setBusy(true);
        setError(null);

        try {
            let saved: DefectItem;
            if (isEditing && defect) {
                /*
                 * Sửa: giữ nguyên `defectId` và `status`.
                 *
                 * `defectRecord` ép `status: 'Open'` cho mọi bản ghi mới. Gửi cả
                 * cụm đó khi SỬA sẽ kéo một lỗi đang `In Process` ngược về `Open`
                 * — và một lỗi đã có 8D mở trên nó bỗng trông như chưa ai đụng tới.
                 * `defectId` thì đến từ dải số của server, trình duyệt không được
                 * đặt lại.
                 */
                const { status: _ignoredStatus, defectId: _ignoredId, ...editable } = defectRecord as Record<string, unknown>;
                saved = await defectsService.update(defect.ID, editable as Partial<DefectItem>);
                toast.success(`Defect ${defect.defectId} updated`);
            } else {
                saved = await defectsService.create(defectRecord as Partial<DefectItem>);
                toast.success(`Defect ${saved.defectId} recorded`, {
                    description: 'Start the 8D process from the Defects list when this one needs it.',
                });
            }
            void queryClient.invalidateQueries({ queryKey: ['number-range'] });
            resetForm();
            onOpenChange(false);
            if (onCreated) {
                onCreated(saved);
            } else {
                navigate('/master-data');
            }
        } catch (err: any) {
            const msg =
                err?.response?.data?.error?.message ??
                err?.message ??
                'Failed to record the defect.';
            setError(msg);
            setBusy(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                if (!busy) {
                    if (!v && !defect) {
                        resetForm();
                    }
                    onOpenChange(v);
                }
            }}
        >
            <DialogContent className="w-[95vw] sm:max-w-5xl md:max-w-6xl lg:max-w-7xl max-h-[90vh] overflow-y-auto p-6">
                <DialogHeader className="pb-3 border-b border-border">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="bg-primary/10 text-primary text-sm font-mono px-2.5 py-0.5 rounded font-semibold border border-primary/20">
                                    QM Simulation
                                </span>
                                <Badge variant="outline" className="text-sm px-2.5 py-0.5">
                                    {isEditing ? 'Change Defect' : 'Record Defect'}
                                </Badge>
                            </div>
                            <DialogTitle className="text-lg font-bold text-foreground">
                                {isEditing ? `Edit Quality Defect ${defect?.defectId ?? ''}` : 'Record Quality Defect'}
                            </DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground">
                                {isEditing
                                    ? 'Corrections to the defect record. The defect number and its status do not change here — status follows the 8D, and the number is issued once.'
                                    : 'Simulate creating a Quality Notification. The defect is recorded on its own — starting an 8D is a separate, explicit step from the Defects list.'}
                            </DialogDescription>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept=".json,application/json"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                className="gap-1.5 h-9 text-sm bg-primary/10 hover:bg-primary/20 border-primary text-primary font-semibold shadow-2xs"
                            >
                                <Upload className="w-3.5 h-3.5 text-primary" />
                                Choose .JSON File
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setShowJsonImport(!showJsonImport);
                                    if (showJsonPreview) setShowJsonPreview(false);
                                }}
                                className="gap-1.5 h-9 text-sm text-muted-foreground hover:text-foreground"
                            >
                                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                {showJsonImport ? 'Hide Paste Box' : 'Paste JSON'}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setShowJsonPreview(!showJsonPreview);
                                    if (showJsonImport) setShowJsonImport(false);
                                }}
                                className="gap-1.5 h-9 text-sm text-muted-foreground hover:text-foreground"
                            >
                                <Code2 className="w-3.5 h-3.5 text-muted-foreground" />
                                {showJsonPreview ? 'Hide Live Payload' : 'Inspect Payload'}
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-6 pt-2">
            {/* Collapsible JSON Import Card */}
            {showJsonImport && (
                <Card className="border-primary/40 bg-card shadow-md">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b border-border/60 bg-muted/30">
                        <div className="flex items-center gap-2">
                            <FileJson className="w-4 h-4 text-primary" />
                            <span className="text-sm font-semibold text-foreground">
                                Paste JSON Payload (Deep Structure or OData Object)
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                className="h-8 text-sm gap-1 text-primary border-primary/30"
                            >
                                <Upload className="w-3 h-3" />
                                Browse File
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setImportJsonText('');
                                    setImportError(null);
                                }}
                                className="h-8 text-sm text-muted-foreground hover:text-foreground"
                            >
                                Clear
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                        <Textarea
                            className="font-mono text-sm min-h-36 bg-background border-border/70 leading-relaxed"
                            placeholder='{\n  "notificationId": "8D-10049001",\n  "symptomShortText": "Operator stopped the line - rough edge felt on flange after milling",\n  "material": { "materialId": "MAT-10247", "description": "Bracket Housing X240" },\n  "workCenter": { "workCenterId": "WC-MILL-07", "description": "CNC Milling Line 7" },\n  "defect": { "defectCode": "DEF-0489", "defectText": "Flange edge burr above limit" },\n  "defectQuantity": 61,\n  "defectQuantityUom": "PC",\n  "inspections": [{ "characteristic": "Burr height at flange edge", "measuredValue": "0.26", "specUpperLimit": 0.10, "specUom": "mm", "valuation": "Rejected" }]\n}'
                            value={importJsonText}
                            onChange={(e) => setImportJsonText(e.target.value)}
                        />
                        {importError && (
                            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-2">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{importError}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-end gap-2 pt-1">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setShowJsonImport(false);
                                    setImportError(null);
                                }}
                                className="h-8 text-sm"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => applyJsonPayload(importJsonText)}
                                className="h-8 text-sm font-semibold gap-1.5 px-3"
                                disabled={!importJsonText.trim()}
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                Apply to Form
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Collapsible Live JSON Payload Inspector */}
            {showJsonPreview && (
                <Card className="border-primary/30 bg-slate-950 text-slate-100 dark">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b border-slate-800">
                        <div className="flex items-center gap-2">
                            <Code2 className="w-4 h-4 text-cyan-400" />
                            <span className="text-sm font-mono font-semibold text-cyan-400">
                                Generated OData Payload (JSON)
                            </span>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={copyJson}
                            className="h-8 text-sm text-slate-300 hover:text-white hover:bg-slate-800 gap-1"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? 'Copied!' : 'Copy Payload'}
                        </Button>
                    </CardHeader>
                    <CardContent className="p-4">
                        <pre className="text-sm font-mono leading-relaxed overflow-x-auto text-cyan-200 max-h-72 p-2 rounded bg-slate-900 border border-slate-800">
                            {payloadJsonString}
                        </pre>
                    </CardContent>
                </Card>
            )}

            {/* Error Display Banner */}
            {error && (
                <div className="flex items-start gap-2.5 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1 font-medium">{error}</div>
                </div>
            )}

            {/* SAP QM Defect Form */}
            {/* onKeyDown gắn ở đây, không gắn lên từng ô: keydown nổi bọt lên nên
                một handler phủ hết mọi ô bên trong, thêm ô mới không phải nối dây lại. */}
            <form onSubmit={handleSubmit} onKeyDown={fillPlaceholderOnTab} className="space-y-6">
                {/* 1. Header Information */}
                <Card className="shadow-sm">
                    <CardHeader className="bg-muted/30 pb-3 border-b border-border/60">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4 text-primary" />
                                <CardTitle className="text-base font-bold">1. Defect Header</CardTitle>
                            </div>
                            <Badge variant="outline" className="font-mono text-sm px-2.5 py-0.5">
                                Quality Defect
                            </Badge>
                        </div>
                        <CardDescription className="text-sm">
                            Basic defect header parameters including defect ID, origin type, and symptom summary.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Defect ID — tự động cấp theo dải số, tuyệt đối không cho nhập tay */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">Defect ID</Label>
                                <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 border-primary/30 bg-primary/10 text-primary">
                                    {isEditing ? 'Assigned' : 'System Assigned'}
                                </Badge>
                            </div>
                            <Input
                                value={displayedNotificationId}
                                className="font-mono h-9 text-sm font-semibold bg-muted/60 text-foreground cursor-not-allowed select-all"
                                readOnly
                                disabled
                            />
                            <p className="text-sm text-muted-foreground">
                                {isEditing
                                    ? 'Issued once, when the defect was recorded. It cannot change — the 8D and the audit trail refer to it.'
                                    : 'Auto-assigned by system number sequence on save.'}
                            </p>
                        </div>

                        {/*
                          Ba nguồn gốc, không phải hai. Q2 vốn đã đi vào được qua
                          cửa import và có case thật trong kho — thiếu nó ở đây
                          nghĩa là một loại case chỉ nhập được bằng file.
                        */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Defect Origin / Type</Label>
                            <Select value={origin} onValueChange={changeOrigin}>
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Select origin" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ORIGINS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Found Date */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Found Date</Label>
                            <Input
                                type="date"
                                value={foundDate}
                                onChange={(e) => setFoundDate(e.target.value)}
                                className="h-9 text-sm"
                            />
                        </div>

                        {/* Symptom Short Text */}
                        <div className="md:col-span-2 space-y-1.5">
                            <Label className="text-sm font-semibold">
                                Symptom Short Text / Primary Description <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                value={symptomShortText}
                                maxLength={255}
                                onChange={(e) => setSymptomShortText(e.target.value.slice(0, 255))}
                                placeholder="e.g. Operator stopped the line - rough edge felt on flange after milling"
                                className="h-9 text-sm"
                                required
                            />
                        </div>

                        {/*
                          Số lượng bị ảnh hưởng — SỐ + ĐƠN VỊ, không còn là một câu.
                          '61 units on hold' đọc thì hiểu, nhưng không cộng được, không
                          so được, không quy ra tiền được. SAP tách RKMNG/MGEIN chính
                          vì thế. Đơn vị đi qua danh mục UOM đã seed sẵn.
                        */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Quantity Affected</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={defectQuantity}
                                    onChange={(e) => setDefectQuantity(e.target.value)}
                                    placeholder="e.g. 61"
                                    className="h-9 text-sm flex-1"
                                />
                                <div className="w-28">
                                    <ValueHelpInput
                                        value={defectQuantityUom}
                                        onChange={setDefectQuantityUom}
                                        entries={uomVh.entries}
                                        loading={uomVh.loading}
                                        placeholder="UoM"
                                        catalogLabel="the UoM list"
                                        quiet
                                    />
                                </div>
                            </div>
                        </div>

                        {/*
                          Reference Number — số của hệ thống KHÁC. Không F4: danh mục
                          nằm ở phía khách hàng / nhà cung cấp, ta không sở hữu nó.
                        */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Reference Number</Label>
                            <Input
                                value={referenceNumber}
                                onChange={(e) => setReferenceNumber(e.target.value)}
                                placeholder="e.g. customer complaint or delivery note no."
                                className="font-mono h-9 text-sm"
                            />
                            <p className="text-sm leading-snug text-muted-foreground">
                                External document this defect refers to. Leave empty if there is none.
                            </p>
                        </div>

                        {/*
                          Q1 KHÔNG có hai ô này — xem `ORIGINS.allowsLot`. Ẩn hẳn
                          chứ không khoá xám: một ô xám vẫn là một ô, và người dùng
                          sẽ đi tìm cách bật nó lên. Không có ô thì không có câu hỏi.
                        */}
                        {!originAllowsLot ? (
                            <div className="md:col-span-2 space-y-1.5">
                                <Label className="text-sm font-semibold">Discovery</Label>
                                <p className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm leading-snug text-muted-foreground">
                                    A customer complaint reaches us after delivery, so it has no inspection
                                    lot of ours and no discovery mode. Record the complaint reference below
                                    instead.
                                </p>
                            </div>
                        ) : (
                        <>
                        {/* Discovery Mode / Entry Mode */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Discovery Mode</Label>
                            <Select value={entryMode} onValueChange={(val: any) => setEntryMode(val)}>
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Select mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="during-inspection">Found during inspection (Path A)</SelectItem>
                                    <SelectItem value="outside-inspection">Found outside inspection (Path B)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/*
                          Lô kiểm tra — mắt xích Đường A.
                          Chọn một lô là kéo về vật tư, nhà máy, trạm, thiết bị và một
                          dòng kết quả. Trước đây đây là ô gõ tay: người vận hành chép
                          lại một số mà hệ thống đã có, rồi gõ lại tất cả những gì lô
                          đó vốn đã biết. `quiet` vì lô KHÔNG tham gia chấm tiền lệ —
                          cảnh báo ngoài danh mục ở đây chỉ gây nhiễu.
                        */}
                        {entryMode === 'during-inspection' ? (
                            <div className="md:col-span-2 space-y-1.5">
                                <Label className="text-sm font-semibold">Inspection Lot ID</Label>
                                <ValueHelpInput
                                    value={inspectionLotId}
                                    onChange={setInspectionLotId}
                                    onPick={(entry) => applyLotPick(entry, inspectionLotVh.returnMapping)}
                                    entries={inspectionLotVh.entries}
                                    loading={inspectionLotVh.loading}
                                    placeholder="e.g. 0010000001"
                                    catalogLabel="the inspection lot list"
                                    quiet
                                />
                                <p className="text-sm leading-snug text-muted-foreground">
                                    {materialId.trim()
                                        ? `Lots for ${materialId.trim()}. Picking one fills material, plant, work centre and a result row.`
                                        : 'Picking a lot fills material, plant, work centre and a result row. Choose a material below to narrow the list.'}
                                </p>
                            </div>
                        ) : (
                            <div className="md:col-span-2 space-y-1.5">
                                <Label className="text-sm font-semibold">Inspection Lot</Label>
                                <Input
                                    value="N/A (Found outside scheduled inspection)"
                                    disabled
                                    className="h-9 text-sm bg-muted/60 text-muted-foreground"
                                />
                            </div>
                        )}
                        </>
                        )}
                    </CardContent>
                </Card>

                {/* 2. Material & Production Context */}
                <Card className="shadow-sm">
                    <CardHeader className="bg-muted/30 pb-3 border-b border-border/60">
                        <div className="flex items-center gap-2">
                            <Box className="w-4 h-4 text-primary" />
                            <CardTitle className="text-base font-bold">2. Material & Production Context</CardTitle>
                        </div>
                        <CardDescription className="text-sm">
                            Master data links connecting the defect to Material Master, Batch Management, and Work Center.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Plant */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Plant</Label>
                            <ValueHelpInput
                                value={plant}
                                onChange={setPlant}
                                entries={plantVh.entries}
                                loading={plantVh.loading}
                                strict
                                catalogLabel="the plant list"
                                maintenanceHint="Maintain the plant list in Master Data."
                                placeholder="e.g. PL-1000"
                            />
                        </div>

                        {/* Material ID */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Material ID</Label>
                            <ValueHelpInput
                                value={materialId}
                                onChange={(newMat) => {
                                    if (newMat !== materialId) {
                                        setMaterialId(newMat);
                                        setBatchId(''); // Auto-clear batch khi đổi material
                                    }
                                }}
                                onPick={(entry) => {
                                    if (entry.key !== materialId) {
                                        setBatchId(''); // Auto-clear batch khi đổi material
                                    }
                                    applyPick(entry, materialVh.returnMapping);
                                }}
                                entries={materialVh.entries}
                                loading={materialVh.loading}
                                strict
                                catalogLabel="the material master"
                                scoringNote="Precedent search matches this code exactly."
                                maintenanceHint="Add the material in Master Data first."
                                placeholder="e.g. MAT-10247"
                            />
                        </div>

                        {/* Material Description */}
                        <div className="md:col-span-2 space-y-1.5">
                            <Label className="text-sm font-semibold">Material Description</Label>
                            <Input
                                value={materialDesc}
                                onChange={(e) => setMaterialDesc(e.target.value)}
                                placeholder="e.g. Bracket Housing X240"
                                className="h-9 text-sm"
                            />
                        </div>

                        {/* Material Group — dẫn xuất từ mã vật tư, không gõ tay.
                            Mô tả thì vẫn sửa được: người ghi nhận có thể nói rõ
                            thêm. Nhóm vật tư thì không — nó phải khớp master data,
                            và một nhóm gõ tay lệch mã là một case không lọc được. */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Material Group</Label>
                            <Input
                                value={materialGroup}
                                readOnly
                                placeholder="— from Material ID —"
                                className="font-mono h-9 text-sm bg-muted/60 text-muted-foreground"
                            />
                        </div>

                        {/* Batch ID — phụ thuộc vào Material ID */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Batch ID</Label>
                            <ValueHelpInput
                                value={batchId}
                                onChange={setBatchId}
                                onPick={(entry) => applyPick(entry, batchVh.returnMapping)}
                                entries={batchVh.entries}
                                loading={batchVh.loading}
                                strict
                                disabled={!materialId.trim()}
                                catalogLabel={materialId.trim() ? `the batch list for ${materialId.trim()}` : 'the batch list'}
                                scoringNote={materialId.trim() ? `Filtered to batches of ${materialId.trim()}` : 'Select Material ID first'}
                                maintenanceHint="Maintain batches in Master Data first."
                                placeholder={materialId.trim() ? 'e.g. B-49172' : 'Select Material ID first'}
                            />
                        </div>

                        {/* Work Center ID */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Work Center ID</Label>
                            <ValueHelpInput
                                value={workCenterId}
                                onChange={setWorkCenterId}
                                onPick={(entry) => applyPick(entry, workCenterVh.returnMapping)}
                                entries={workCenterVh.entries}
                                loading={workCenterVh.loading}
                                strict
                                catalogLabel="the work centre list"
                                scoringNote="Precedent search matches this code exactly."
                                maintenanceHint="Add the work centre in Master Data first."
                                placeholder="e.g. WC-MILL-07"
                            />
                        </div>

                        {/* Work Center Description — dẫn xuất, xem ghi chú ở Material Group */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Work Center Description</Label>
                            <Input
                                value={workCenterDesc}
                                readOnly
                                placeholder="— from Work Center ID —"
                                className="h-9 text-sm bg-muted/60 text-muted-foreground"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Defect Codes & Quality Inspection Results.
                    Tiêu đề tránh chữ "Classification": S7 đã bỏ "Defect Class"
                    khỏi giao diện và thay bằng "Severity", nên để lại một tiêu đề
                    họ hàng với nó là mời người dùng đi tìm một ô không còn tồn
                    tại. Mục này gồm nhóm mã, mã, mức nghiêm trọng và số đo — gọi
                    theo cái nó chứa thì không cần thuật ngữ nào cả. */}
                <Card className="shadow-sm">
                    <CardHeader className="bg-muted/30 pb-3 border-b border-border/60">
                        <div className="flex items-center gap-2">
                            <Factory className="w-4 h-4 text-primary" />
                            <CardTitle className="text-base font-bold">3. Defect Codes & Measurements</CardTitle>
                        </div>
                        <CardDescription className="text-sm">
                            Defect catalog codes and quantitative measurement values against tolerance limits.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="p-5 space-y-4">
                        {/* Defect Code Group → Defect Code → Severity.
                            Đúng thứ tự của catalog type 9: nhóm thu hẹp danh sách
                            mã, và mã suy ra mức nghiêm trọng. */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-border/40">
                            <div className="space-y-1.5">
                                <Label className="text-sm font-semibold">Defect Code Group</Label>
                                <ValueHelpInput
                                    value={defectCodeGroup}
                                    onChange={(next) => {
                                        setDefectCodeGroup(next);
                                        // Đổi nhóm mà giữ nguyên mã cũ thì ra một cặp
                                        // nhóm/mã mâu thuẫn — và nó lưu được, vì cả
                                        // hai ô đều "có trong danh mục". Xoá mã đi để
                                        // người dùng chọn lại trong nhóm mới.
                                        if (defectCode) {
                                             setDefectCode('');
                                            setDefectText('');
                                            setDefectClass('');
                                        }
                                    }}
                                    entries={codeGroupVh.entries}
                                    loading={codeGroupVh.loading}
                                    strict
                                    catalogLabel="the code groups"
                                    maintenanceHint="Maintain code groups in Master Data."
                                    placeholder="e.g. QM-SUR"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-semibold">Defect Code</Label>
                                <ValueHelpInput
                                    value={defectCode}
                                    onChange={setDefectCode}
                                    onPick={(entry) => applyPick(entry, defectCodeVh.returnMapping)}
                                    entries={defectCodeVh.entries}
                                    loading={defectCodeVh.loading}
                                    strict
                                    catalogLabel={defectCodeGroup ? `group ${defectCodeGroup}` : 'the defect catalogue'}
                                    scoringNote="Precedent search matches this code exactly."
                                    maintenanceHint="Add the code in Master Data first."
                                    placeholder="e.g. DEF-0489"
                                />
                            </div>
                            {/* Severity — dẫn xuất từ mã, y như SAP suy nó ra từ
                                catalog type 9. Mức nghiêm trọng là thuộc tính của
                                MÃ, không phải ý kiến của người đang ghi nhận: hai
                                người gặp cùng một lỗi phải ra cùng một mức. */}
                            <div className="space-y-1.5">
                                <Label className="text-sm font-semibold">Severity</Label>
                                <Input
                                    value={defectClass}
                                    readOnly
                                    placeholder="— from Defect Code —"
                                    className="h-9 text-sm bg-muted/60 text-muted-foreground"
                                />
                            </div>
                            <div className="md:col-span-3 space-y-1.5">
                                <Label className="text-sm font-semibold">Defect Catalog Description</Label>
                                <Input
                                    value={defectText}
                                    onChange={(e) => setDefectText(e.target.value)}
                                    placeholder="e.g. Flange edge burr above limit"
                                    className="h-9 text-sm"
                                />
                            </div>
                        </div>

                        {/* Inspection Measurements Table */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-semibold">
                                        Inspection Characteristics & Measured Values (D2 Evidence)
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        Tip: If this material has historical inspection lots across multiple equipments/fixtures, the system will automatically compute the Is / Is-Not comparison in D2.
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        A row counts as evidence only once it can be judged — set the
                                        valuation, or give a limit for the measured value to be checked against.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addInspection}
                                    className="h-8 text-sm gap-1 shrink-0"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add Characteristic
                                </Button>
                            </div>

                            {/*
                              Ô 'Spec Limit' cũ là MỘT chuỗi tự do — 'max 0.10 mm',
                              '0.05..0.10', 'per drawing'. Server phải đoán nó bằng
                              regex, và khi đoán trượt thì `outOfSpec` về null, kéo
                              theo việc D2 so nhầm đặc tính (`postProcess.ts`). Ba ô
                              số/đơn vị + một ô phán quyết thay chỗ nó: không còn gì
                              để đoán.
                            */}
                            <div className="space-y-2">
                                {/* Column Headers */}
                                <div className="flex items-center gap-2 px-1 text-sm font-semibold text-muted-foreground">
                                    <div className="flex-[2]">Characteristic Name</div>
                                    <div className="flex-1">Measured Value</div>
                                    <div className="w-[4.5rem] shrink-0">Lower</div>
                                    <div className="w-[4.5rem] shrink-0">Upper</div>
                                    <div className="w-20 shrink-0">UoM</div>
                                    <div className="w-32 shrink-0">Valuation</div>
                                    <div className="flex-1">Equipment / Fixture</div>
                                    {inspections.length > 1 && <div className="w-8 shrink-0" />}
                                </div>

                                {inspections.map((insp, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <div className="flex-[2] min-w-0">
                                            <ValueHelpInput
                                                value={insp.characteristic}
                                                onChange={(val) => updateInspection(idx, 'characteristic', val)}
                                                onPick={(entry) => handlePickCharacteristic(idx, entry)}
                                                entries={characteristicVh.entries}
                                                loading={characteristicVh.loading}
                                                strict={false}
                                                quiet={true}
                                                pickKey="text"
                                                placeholder="e.g. Flange Face Flatness"
                                                catalogLabel={materialId ? `MIC for ${materialId}` : 'inspection characteristics'}
                                                maintenanceHint="Pick standard MIC (auto-fills limits) or type custom."
                                            />
                                        </div>
                                        <Input
                                            value={insp.measuredValue}
                                            onChange={(e) => updateInspection(idx, 'measuredValue', e.target.value)}
                                            placeholder="e.g. 0.32 mm"
                                            className="h-9 flex-1 font-mono text-sm"
                                        />
                                        <Input
                                            type="number"
                                            step="any"
                                            value={insp.specLowerLimit}
                                            onChange={(e) => updateInspection(idx, 'specLowerLimit', e.target.value)}
                                            placeholder="min"
                                            className="h-9 w-[4.5rem] shrink-0 font-mono text-sm"
                                        />
                                        <Input
                                            type="number"
                                            step="any"
                                            value={insp.specUpperLimit}
                                            onChange={(e) => updateInspection(idx, 'specUpperLimit', e.target.value)}
                                            placeholder="max"
                                            className="h-9 w-[4.5rem] shrink-0 font-mono text-sm"
                                        />
                                        <Input
                                            value={insp.specUom}
                                            onChange={(e) => updateInspection(idx, 'specUom', e.target.value)}
                                            placeholder="mm"
                                            className="h-9 w-20 shrink-0 font-mono text-sm"
                                        />
                                        {/*
                                          Bước ③ của SAP. Mặc định là RỖNG chứ không
                                          phải 'Accepted': chưa ai phán quyết thì đừng
                                          ghi là đạt.
                                        */}
                                        <Select
                                            value={insp.valuation || 'none'}
                                            onValueChange={(val) =>
                                                updateInspection(idx, 'valuation', val === 'none' ? '' : val)}
                                        >
                                            <SelectTrigger className="h-9 w-32 shrink-0 text-sm">
                                                <SelectValue placeholder="—" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">— not judged</SelectItem>
                                                <SelectItem value="Accepted">Accepted</SelectItem>
                                                <SelectItem value="Rejected">Rejected</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            value={insp.equipment}
                                            onChange={(e) => updateInspection(idx, 'equipment', e.target.value)}
                                            placeholder="e.g. WC-MILL-07-F1"
                                            className="h-9 flex-1 font-mono text-sm"
                                        />
                                        {inspections.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeInspection(idx)}
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                ))}

                                {/*
                                  Cảnh báo, KHÔNG chặn. Một dòng chưa phán quyết được
                                  vẫn là dữ liệu thật — nó chỉ không dùng làm bằng
                                  chứng D2 được, và server cũng nói đúng câu đó trong
                                  phần Gaps. Chặn Save ở đây sẽ khoá luôn người vận
                                  hành ghi lại một số đo mà chưa có bản vẽ trong tay.
                                */}
                                {unjudgedRows.length > 0 && (
                                    <p className="flex items-start gap-1 pt-1 text-sm leading-snug text-warning">
                                        <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
                                        <span>
                                            {unjudgedRows.join(', ')} — no valuation and no limit, so D2 cannot
                                            judge {unjudgedRows.length > 1 ? 'these rows' : 'this row'}.
                                        </span>
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Responsibility */}
                <Card className="shadow-sm">
                    <CardHeader className="bg-muted/30 pb-3 border-b border-border/60">
                        <div className="flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-primary" />
                            <CardTitle className="text-base font-bold">4. Responsibility</CardTitle>
                        </div>
                        <CardDescription className="text-sm">
                            Who found it and who coordinates the notification. The 8D team itself is not decided here — D1 proposes it from the people who solved comparable defects.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Reported By */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">Reported By</Label>
                                {(reportedBy === currentUserName || (!reportedBy && currentUserName)) && (
                                    <span className="text-xs font-mono text-muted-foreground font-medium px-2 py-0.5 rounded bg-muted">
                                        you
                                    </span>
                                )}
                            </div>
                            <Select value={reportedBy || currentUserName} onValueChange={setReportedBy}>
                                <SelectTrigger className="h-9 text-sm w-full">
                                    <SelectValue placeholder="— select reporter —" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {reportedByOptions.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Responsible Department */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Responsible Department</Label>
                            <ValueHelpInput
                                value={department}
                                onChange={setDepartment}
                                onPick={(entry) => applyPick(entry, departmentVh.returnMapping)}
                                entries={departmentVh.entries}
                                loading={departmentVh.loading}
                                strict
                                dropdownPlacement="top"
                                placeholder="e.g. Quality Assurance"
                                catalogLabel="the responsible department list"
                                maintenanceHint="Select a department from Master Data."
                            />
                        </div>

                        {/* Notification Coordinator */}
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold">Notification Coordinator</Label>
                            <ValueHelpInput
                                value={coordinator}
                                onChange={setCoordinator}
                                onPick={(entry) => applyPick(entry, coordinatorVh.returnMapping)}
                                entries={coordinatorVh.entries}
                                loading={coordinatorVh.loading}
                                strict
                                dropdownPlacement="top"
                                placeholder="e.g. Heli (QE)"
                                catalogLabel="the notification coordinator list"
                                maintenanceHint="Add coordinator in Master Data first."
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* 5. Customer Reference (Q1 Complaint fields) */}
                {origin === ORIGIN_CUSTOMER && (
                    <Card className="shadow-sm border-destructive/30 bg-destructive/5">
                        <CardHeader className="bg-destructive/10 pb-3 border-b border-destructive/20">
                            <div className="flex items-center gap-2">
                                <UserCheck className="w-4 h-4 text-destructive" />
                                <CardTitle className="text-base font-bold text-destructive">
                                    5. Customer Complaint Reference (Q1 Fields)
                                </CardTitle>
                            </div>
                            <CardDescription className="text-sm text-destructive/80">
                                Additional customer-facing complaint metadata required for Q1 external defects.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-sm font-semibold">
                                    Complaint Reference # <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    value={complaintReference}
                                    onChange={(e) => setComplaintReference(e.target.value)}
                                    placeholder="e.g. CC-2026-1188"
                                    className="font-mono h-9 text-sm bg-card"
                                />
                                {/* Ô này từng được lấp bằng 'CC-2026-PENDING' khi trống.
                                    Giờ nó chặn Save — nên phải nói ngay tại ô, chứ không
                                    để người dùng bấm Save rồi mới biết. */}
                                {!complaintReference.trim() && (
                                    <p className="text-sm leading-snug text-destructive">
                                        Required — the customer's own reference number. Leave the case
                                        unsaved rather than inventing one.
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-semibold">Customer Contact / Plant</Label>
                                <Input
                                    value={customerPlantContact}
                                    onChange={(e) => setCustomerPlantContact(e.target.value)}
                                    placeholder="e.g. Vestbeck Motors - Plant 2"
                                    className="h-9 text-sm bg-card"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-semibold">SLA Response Due Date</Label>
                                <Input
                                    type="date"
                                    value={slaResponseDue.match(/^\d{4}-\d{2}-\d{2}$/) ? slaResponseDue : ''}
                                    onChange={(e) => setSlaResponseDue(e.target.value)}
                                    className="h-9 text-sm bg-card"
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Form Action Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 pt-4 border-t border-border">
                    {/* Nút xám mà không nói vì sao là chỗ người dùng bỏ cuộc. Nêu
                        đích danh ô nào đang giữ giá trị ngoài danh mục. */}
                    {saveBlockers.length > 0 && (
                        <div className="space-y-1 sm:mr-auto">
                            {saveBlockers.map((msg) => (
                                <p key={msg} className="flex items-start gap-1.5 text-sm leading-snug text-destructive">
                                    <AlertCircle className="mt-px w-3.5 h-3.5 shrink-0" />
                                    <span>{msg}</span>
                                </p>
                            ))}
                        </div>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => onOpenChange(false)}
                        className="h-9 text-sm"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={busy || !symptomShortText.trim() || saveBlockers.length > 0}
                        className="gap-2 h-9 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md text-sm"
                    >
                        {/* Nhãn nói ĐÚNG việc nút làm. Bản trước hứa "Start 8D
                            Process" nên người dùng bấm để mở 8D, và một 8D được
                            mở ra cho mọi lỗi — kể cả lỗi chỉ cần ghi rồi đóng. */}
                        {busy ? <Spinner className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                        {isEditing
                            ? (busy ? 'Saving Changes…' : 'Save Changes')
                            : (busy ? 'Recording Defect…' : 'Record Defect')}
                    </Button>
                </div>
            </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export const CreateDefectPage = CreateDefectDialog;
export default CreateDefectDialog;
