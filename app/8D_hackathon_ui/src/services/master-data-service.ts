import { useQuery } from '@tanstack/react-query';
import axiosInstance from './core/axios-instance';
import { BaseODataService } from './core/base-service';
import { ODataQueryBuilder } from './core/odata-helper';
import type { ODataResponse } from './types/odata.types';

export interface HistoricalCaseItem {
    ID: string;
    notificationId: string;
    origin?: string | null;
    symptomShortText?: string | null;
    sapStatus?: string | null;
    foundDate?: string | null;
    completionDate?: string | null;
    quantityExtent?: string | null;
    workCenterId?: string | null;
    workCenterDesc?: string | null;
    /** Nhóm mã lỗi. Suy từ mã qua danh mục — chưa có trọng số khi chấm tiền lệ. */
    defectCodeGroup?: string | null;
    defectCode?: string | null;
    defectText?: string | null;
    materialId?: string | null;
    materialDesc?: string | null;
    materialFamily?: string | null;
    batchId?: string | null;
    rootCauseCategory?: string | null;
    copqEur?: number | null;
    fmeaId?: string | null;
    sourcePayload?: string | null;
    attributesJson?: string | null;
    /**
     * Dòng này vào kho bằng đường nào: `'imported'` (nạp hàng loạt dữ liệu cũ) hay
     * `'closed-in-app'` (case do chính app đóng ở D8).
     *
     * Cột này trả lời câu hỏi đầu tiên khi ai đó thắc mắc "sao AI lại gợi ý case
     * này": tiền lệ có vết duyệt của con người trên tám bước D không đáng tin
     * ngang một dòng di trú chỉ mang những gì file cũ ghi lại.
     */
    provenance?: string | null;
    /** Lượt chạy 8D đã sinh ra dòng này. Null với dòng import. */
    sourceReportID?: string | null;
    createdAt?: string;
    createdBy?: string;
    modifiedAt?: string;
    modifiedBy?: string;
}

export interface InspectionLotItem {
    ID: string;
    lotId: string;
    materialId: string;
    characteristic: string;
    equipment?: string | null;
    /**
     * Trạm sản xuất của lô. Trước đây màn hình tự cắt nó ra từ mã equipment kèm
     * giá trị dự phòng cứng — nghĩa là con số hiển thị không hề được lưu. Giờ nó
     * là một cột thật, vì Đường A trả nó về form ghi nhận lỗi.
     */
    workCenterId?: string | null;
    measuredValue?: string | null;
    unit?: string | null;
    conforming: boolean;
    lotDate?: string | null;
    plant?: string | null;
    createdAt?: string;
    createdBy?: string;
    modifiedAt?: string;
    modifiedBy?: string;
}

class HistoricalCasesService extends BaseODataService<HistoricalCaseItem> {
    constructor() {
        super('api/cnma/EIGHTD_SRV', 'HistoricalCases');
    }

    protected formatKey(id: string | number): string {
        return String(id);
    }

    async list(params?: {
        search?: string;
        materialId?: string;
        workCenterId?: string;
        top?: number;
        skip?: number;
    }): Promise<ODataResponse<HistoricalCaseItem>> {
        const qb = new ODataQueryBuilder();
        qb.orderBy('createdAt', 'desc');

        if (params?.top != null) qb.top(params.top);
        if (params?.skip != null) qb.skip(params.skip);

        const filters: string[] = [];
        if (params?.search?.trim()) {
            const s = params.search.trim().replace(/'/g, "''");
            filters.push(`(contains(notificationId,'${s}') or contains(symptomShortText,'${s}') or contains(materialDesc,'${s}') or contains(materialId,'${s}') or contains(defectText,'${s}'))`);
        }
        if (params?.materialId?.trim()) {
            filters.push(`materialId eq '${params.materialId.trim().replace(/'/g, "''")}'`);
        }
        if (params?.workCenterId?.trim()) {
            filters.push(`workCenterId eq '${params.workCenterId.trim().replace(/'/g, "''")}'`);
        }

        if (filters.length > 0) {
            qb.filter(filters.join(' and '));
        }

        return this.getList(qb);
    }
}

class InspectionLotsService extends BaseODataService<InspectionLotItem> {
    constructor() {
        super('api/cnma/EIGHTD_SRV', 'InspectionLots');
    }

    protected formatKey(id: string | number): string {
        return String(id);
    }

    async list(params?: {
        search?: string;
        materialId?: string;
        characteristic?: string;
        equipment?: string;
        conforming?: boolean;
        top?: number;
        skip?: number;
    }): Promise<ODataResponse<InspectionLotItem>> {
        const qb = new ODataQueryBuilder();
        qb.orderBy('lotDate', 'desc');

        if (params?.top != null) qb.top(params.top);
        if (params?.skip != null) qb.skip(params.skip);

        const filters: string[] = [];
        if (params?.search?.trim()) {
            const s = params.search.trim().replace(/'/g, "''");
            filters.push(`(contains(lotId,'${s}') or contains(materialId,'${s}') or contains(characteristic,'${s}') or contains(equipment,'${s}'))`);
        }
        if (params?.materialId?.trim()) {
            filters.push(`materialId eq '${params.materialId.trim().replace(/'/g, "''")}'`);
        }
        if (params?.characteristic?.trim()) {
            filters.push(`characteristic eq '${params.characteristic.trim().replace(/'/g, "''")}'`);
        }
        if (params?.equipment?.trim()) {
            filters.push(`equipment eq '${params.equipment.trim().replace(/'/g, "''")}'`);
        }
        if (params?.conforming !== undefined) {
            filters.push(`conforming eq ${params.conforming}`);
        }

        if (filters.length > 0) {
            qb.filter(filters.join(' and '));
        }

        return this.getList(qb);
    }
}

export const historicalCasesService = new HistoricalCasesService();
export const inspectionLotsService = new InspectionLotsService();

/**
 * Lấy trước số thứ tự tiếp theo cho một đối tượng ('DEFECT', 'INSPLOT') từ NumberRanges.
 */
export async function fetchNextNumber(object: 'DEFECT' | 'INSPLOT'): Promise<string> {
    try {
        const res = await axiosInstance.get<{ value: string }>(
            `api/cnma/EIGHTD_SRV/peekNextNumber(object='${object}')`,
        );
        return res.data?.value || (object === 'DEFECT' ? '8D-10049121' : '0010000109');
    } catch {
        return object === 'DEFECT' ? '8D-10049121' : '0010000109';
    }
}

export function useNextNumber(object: 'DEFECT' | 'INSPLOT', enabled = true) {
    return useQuery({
        queryKey: ['number-range', 'next', object],
        queryFn: () => fetchNextNumber(object),
        enabled,
        staleTime: 0,
    });
}
