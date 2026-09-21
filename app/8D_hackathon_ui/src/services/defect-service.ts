/**
 * Bản ghi lỗi chất lượng (QMEL) — mắt xích đứng TRƯỚC báo cáo 8D.
 *
 * ── Vì sao là service riêng chứ không nhét vào `eightd-service` ──
 * Lỗi và 8D là hai vật khác nhau với hai vòng đời khác nhau: một lỗi có thể được
 * ghi nhận rồi đóng lại mà không bao giờ mở 8D, và đó là đường đi bình thường
 * chứ không phải ngoại lệ. Gộp hai thứ vào một service là mời lại đúng cái nhầm
 * lẫn mà Phase 2 sinh ra để gỡ.
 */

import { BaseODataService } from './core/base-service';
import { ODataQueryBuilder } from './core/odata-helper';
import axiosInstance from './core/axios-instance';
import { queryClient } from '@/query-client';
import type { ODataResponse } from './types/odata.types';

/** `Open` | `In Process` | `Completed` — vòng đời của bản ghi LỖI, không phải của 8D. */
export type DefectStatus = 'Open' | 'In Process' | 'Completed';

export interface DefectCharacteristicItem {
    ID?: string;
    lineNo?: number | null;
    characteristic: string;
    measuredValue?: string | null;
    specLowerLimit?: number | null;
    specUpperLimit?: number | null;
    specUom?: string | null;
    valuation?: string | null;
    equipment?: string | null;
}

export interface DefectItem {
    ID: string;
    /** Số lỗi do server cấp từ dải `DEFECT`. Ô nhập bị khoá ở UI. */
    defectId: string;
    origin?: string | null;
    status?: DefectStatus | null;
    symptomShortText?: string | null;
    foundDate?: string | null;
    completionDate?: string | null;
    defectQuantity?: number | null;
    defectQuantityUom?: string | null;
    referenceNumber?: string | null;
    plant?: string | null;
    materialId?: string | null;
    materialDesc?: string | null;
    materialGroup?: string | null;
    batchId?: string | null;
    workCenterId?: string | null;
    workCenterDesc?: string | null;
    defectCodeGroup?: string | null;
    defectCode?: string | null;
    defectText?: string | null;
    defectClass?: string | null;
    entryMode?: string | null;
    inspectionLotId?: string | null;
    reportedBy?: string | null;
    coordinator?: string | null;
    department?: string | null;
    complaintReference?: string | null;
    customerPlantContact?: string | null;
    slaResponseDue?: string | null;
    characteristics?: DefectCharacteristicItem[];
    createdAt?: string;
    createdBy?: string;
    modifiedAt?: string;
    modifiedBy?: string;
}

/** Cột đủ để vẽ một dòng danh sách — không kéo về ba nhóm trường chi tiết. */
const LIST_COLUMNS = [
    'ID', 'defectId', 'origin', 'status', 'symptomShortText', 'foundDate',
    'plant', 'materialId', 'materialDesc', 'batchId',
    'workCenterId', 'workCenterDesc',
    // `defectCodeGroup` đi cùng `defectCode` vì S5 yêu cầu dòng chọn lỗi hiện
    // "mã + nhóm mã": một mã lẻ như `0012` không nói lên gì nếu không biết nó
    // thuộc nhóm nào — cùng con số nằm ở hai nhóm là hai loại lỗi khác hẳn.
    'defectCode', 'defectCodeGroup', 'defectText', 'defectClass',
    'entryMode', 'inspectionLotId', 'referenceNumber',
    'coordinator', 'createdAt',
];

const quote = (v: string) => v.trim().replace(/'/g, "''");

class DefectsService extends BaseODataService<DefectItem> {
    constructor() {
        super('api/cnma/EIGHTD_SRV', 'Defects');
    }

    protected formatKey(id: string | number): string {
        return String(id);
    }

    async create(data: Partial<DefectItem>): Promise<DefectItem> {
        const created = await super.create(data);
        void queryClient.invalidateQueries({ queryKey: ['number-range'] });
        void queryClient.invalidateQueries({ queryKey: ['master-data', 'defects'] });
        return created;
    }

    async delete(id: string | number): Promise<void> {
        await super.delete(id);
        void queryClient.invalidateQueries({ queryKey: ['number-range'] });
        void queryClient.invalidateQueries({ queryKey: ['master-data', 'defects'] });
    }

    async list(params?: {
        search?: string;
        status?: DefectStatus;
        materialId?: string;
        workCenterId?: string;
        top?: number;
        skip?: number;
    }): Promise<ODataResponse<DefectItem>> {
        const qb = new ODataQueryBuilder().select(LIST_COLUMNS).orderBy('createdAt', 'desc').count();

        if (params?.top != null) qb.top(params.top);
        if (params?.skip != null) qb.skip(params.skip);

        const filters: string[] = [];
        if (params?.search?.trim()) {
            const s = quote(params.search);
            filters.push(
                `(contains(defectId,'${s}') or contains(symptomShortText,'${s}')`
                + ` or contains(materialId,'${s}') or contains(materialDesc,'${s}')`
                + ` or contains(defectText,'${s}'))`,
            );
        }
        if (params?.status) filters.push(`status eq '${quote(params.status)}'`);
        if (params?.materialId?.trim()) filters.push(`materialId eq '${quote(params.materialId)}'`);
        if (params?.workCenterId?.trim()) filters.push(`workCenterId eq '${quote(params.workCenterId)}'`);

        if (filters.length) qb.filter(filters.join(' and '));
        return this.getList(qb);
    }

    /** Một lỗi kèm kết quả đo, sắp theo `lineNo` — OData không đảm bảo thứ tự nếu không nói rõ. */
    async getWithCharacteristics(id: string) {
        return this.getById(id, new ODataQueryBuilder().expand('characteristics($orderby=lineNo)'));
    }

    /**
     * Những lỗi CÒN MỞ mà chưa có 8D nào.
     *
     * ── Vì sao lọc bằng hai lượt gọi thay vì một câu OData ──
     * Điều kiện thật là "không tồn tại `Reports` nào mang `sourceDefectId` này".
     * OData v4 của CAP không diễn đạt được phép NOT EXISTS qua hai entity không có
     * association, và dựng một association chỉ để phục vụ bộ lọc này sẽ buộc
     * `sourceDefectId` phải là khoá ngoại UUID — đúng thứ đã bị bác khi thiết kế
     * schema. Hai lượt gọi ở đây rẻ hơn nhiều so với ràng hai bảng vào nhau.
     */
    async listStartable(params?: { search?: string; top?: number }): Promise<DefectItem[]> {
        const [defects, reports] = await Promise.all([
            this.list({ search: params?.search, top: params?.top ?? 100 }),
            axiosInstance.get<{ value: Array<{ sourceDefectId: string | null }> }>(
                'api/cnma/EIGHTD_SRV/Reports?$select=sourceDefectId&$filter=sourceDefectId ne null&$top=1000',
            ),
        ]);

        const taken = new Set(
            (reports.data?.value ?? []).map((r) => r.sourceDefectId).filter(Boolean) as string[],
        );
        return (defects.value ?? []).filter(
            (d) => d.status !== 'Completed' && !taken.has(d.defectId),
        );
    }

    /**
     * Mở một 8D từ lỗi này.
     *
     * Chỉ gửi số lỗi lên: payload phân tích được server dựng lại từ bảng `Defects`
     * (`buildDefectPayload`), nên không có đường nào để sửa dữ liệu case trên
     * đường truyền. Server cũng là nơi chốt luật một-8D-mỗi-lỗi — hai tab mở song
     * song không lách qua được.
     *
     * `dueDate` và `coordinator` là hai CAM KẾT do người mở case gõ tay — không
     * suy ra được từ bản ghi lỗi, nên chúng là ngoại lệ duy nhất của đoạn trên.
     * Để trống thì server rơi về giá trị suy từ payload.
     *
     * @returns ID của report vừa tạo, đang ở trạng thái `Analyzing`
     */
    async startEightD(
        defectID: string,
        options: { title?: string; dueDate?: string; coordinator?: string } = {},
    ): Promise<string> {
        const res = await axiosInstance.post<{ value: string }>(
            `${this.serviceName}/startEightD`,
            {
                defectID,
                title: options.title ?? '',
                dueDate: options.dueDate ?? '',
                coordinator: options.coordinator ?? '',
            },
        );
        void queryClient.invalidateQueries({ queryKey: ['8d'] });
        return res.data.value;
    }
}

export const defectsService = new DefectsService();

/** Nhãn và màu của trạng thái lỗi. Một chỗ định nghĩa, mọi màn hình dùng chung. */
export const DEFECT_STATUS_TONE: Record<DefectStatus, string> = {
    'Open': 'bg-warning/10 text-warning border-warning/20',
    'In Process': 'bg-info/10 text-info border-info/20',
    'Completed': 'bg-success/10 text-success border-success/20',
};
