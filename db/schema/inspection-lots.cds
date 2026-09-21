namespace cnma.proresolve;

using { cuid, managed } from '@sap/cds/common';

/**
 * Lịch sử kiểm tra theo lô (SAP QM QALS / QAMR) — nguồn dân số để phân tích Is / Is-Not.
 */
entity InspectionLots : cuid, managed {
    lotId          : String(30)  @mandatory;
    materialId     : String(30)  @mandatory;
    characteristic : String(120) @mandatory;
    equipment      : String(50);
    /**
     * Work center (ARBPL) của lô.
     *
     * ── Vì sao thêm cột thay vì cắt từ `equipment` ──
     * Form của tab này vẫn hiện một ô "Work Center Reference", nhưng nó được CẮT
     * bằng chuỗi từ mã equipment ('WC-MILL-07-F1' → 'WC-MILL-07'), có sẵn giá trị
     * dự phòng cứng 'WC-MILL-07', và không bao giờ được lưu. Nghĩa là màn hình
     * khẳng định một work center mà cơ sở dữ liệu không hề biết.
     *
     * F4 lô kiểm tra (1.4) phải dán work center vào form ghi nhận lỗi. Dán một
     * chuỗi tự cắt ra là chép lại chỗ đoán sang một case có tính pháp lý.
     */
    workCenterId   : String(30);
    measuredValue  : String(60);
    unit           : String(20);
    conforming     : Boolean default true;
    lotDate        : Date;
    plant          : String(30);
}

/**
 * Sổ đăng ký FMEA theo quy trình / thiết bị — nguồn tham chiếu cho D7 khi case chưa liên kết FMEA.
 */
entity FmeaRegister : cuid, managed {
    fmeaId         : String(30)  @mandatory;
    workCenterId   : String(30);
    materialId     : String(30);
    description    : String(255);
}
