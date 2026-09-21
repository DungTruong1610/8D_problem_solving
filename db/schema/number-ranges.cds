namespace cnma.proresolve;

using { managed } from '@sap/cds/common';

/**
 * Dải số (SAP: number range object, NRIV).
 *
 * ── Vấn đề mà bảng này giải ──
 * Trước đây số kế tiếp được tính TRONG TRÌNH DUYỆT: `max(dòng đang tải) + 1`.
 * Ba chỗ hỏng, và cả ba đều hỏng lặng lẽ:
 *
 *   1. Đụng số — hai người mở form cùng lúc thì cùng thấy một số, cùng lưu, và
 *      không có gì phát hiện ra.
 *   2. Suy từ dữ liệu ĐANG TẢI — lọc hoặc phân trang một cái là "số kế tiếp" có
 *      thể đã tồn tại, vì trình duyệt không nhìn thấy dòng lớn nhất.
 *   3. Cấp quá sớm — số hiện ra ngay khi mở form, nên mỗi form bỏ dở đốt một số.
 *
 * ── Vì sao là bảng chứ không phải sequence ──
 * Sequence của database không mang được `prefix` và `width`, và mỗi dialect gọi
 * một kiểu. Một bảng thì chạy y hệt trên SQLite lẫn HANA, đọc được, sửa được, và
 * di trú được — đúng như NRIV của SAP.
 */
entity NumberRanges : managed {

    /** Tên đối tượng dải số. 'DEFECT', 'INSPLOT'. */
    key object       : String(20);

    /** Tiền tố ghép trước phần số. '8D-' cho defect, '' cho lô kiểm tra. */
    prefix           : String(10) default '';

    /**
     * Số ĐÃ CẤP gần nhất, không phải số kế tiếp.
     *
     * Cấp phát là "cộng một rồi ghi", nên lưu giá trị đã dùng khiến giá trị khởi
     * đầu 0 có nghĩa rõ ràng: chưa cấp gì cả, số đầu tiên sẽ là 1.
     */
    currentValue     : Integer64 default 0;

    /** Số chữ số sau khi đệm 0. 8 → '10049201'; 10 → '0010000012'. */
    width            : Integer default 10;

    description      : String(255);
}
