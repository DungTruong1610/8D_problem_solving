/**
 * Định nghĩa F4 cho form ghi nhận lỗi.
 *
 * ── Vì sao đi qua `ValueHelpList` chứ không đọc thẳng bảng ──
 * Ba mã `materialId`, `workCenterId`, `defectCode` sẽ được đồng bộ từ S/4 khi hệ
 * thống được nối. Nếu form gọi thẳng vào `HistoricalCases`, ngày đó tới là phải
 * sửa form, sửa service, sửa cả kiểu dữ liệu ở giữa. Đi qua `ValueHelpList` thì
 * chuyển sang S/4 là đổi `sourceType` của một DÒNG DỮ LIỆU từ 'reference' sang
 * 'external' và điền `externalEndpoint` — không có dòng code nào phải đổi.
 *
 * `returnMapping` là phần trả lời cho "chọn xong thì tự điền các ô liên quan":
 * chọn một mã vật tư thì mô tả và nhóm vật tư được dán vào, không ai gõ tay.
 *
 * ── Vì sao seed bằng code chứ không bằng CSV trong `db/data/` ──
 * HDI ghi đè CSV ở MỖI lần deploy, nên danh sách plant mà admin sửa trên hệ
 * thống sẽ bị xoá mà không ai được báo. Hàm này idempotent: chỉ thêm dòng còn
 * thiếu, không bao giờ đè lên dòng đã có.
 */

import cds from '@sap/cds';

import { TASK_CODES, TASK_CODE_GROUPS } from '../../../../shared/task-catalogue';
import { ADDITIONAL_Q_DEFECTS } from './sampleDefects';

const LOG = cds.log('valuehelp-seed');

const VALUE_HELPS = 'cnma.valuehelp.ValueHelpList';

/** Mọi F4 của form ghi nhận lỗi dùng chung một `objectType`. */
export const DEFECT_OBJECT_TYPE = 'QualityNotification';

export const VALUE_HELP_IDS = {
    plant: 'PLANT',
    material: 'MATERIAL',
    workCenter: 'WORK_CENTER',
    defectCode: 'DEFECT_CODE',
    uom: 'UOM',
    partner: 'PARTNER',
    defectCodeGroup: 'DEFECT_CODE_GROUP',
    /** Đường A: lỗi phát hiện TRONG kiểm tra, nên có một lô thật đứng sau. */
    inspectionLot: 'INSPECTION_LOT',
    /** Catalog type 2 — mã hoá HÀNH ĐỘNG của D3/D5/D7, song song với type 9 mã hoá lỗi. */
    taskCode: 'TASK_CODE',
    taskCodeGroup: 'TASK_CODE_GROUP',
    /** Quản lý lô hàng (SAP MCHA/MCH1). Con của Material. */
    batch: 'BATCH',
    /** Danh mục phòng ban chịu trách nhiệm (SAP QMEL-ABTEI). */
    department: 'DEPARTMENT',
    /** Điều phối viên thông báo lỗi (SAP QMEL-PARNR). */
    coordinator: 'COORDINATOR',
    /** Đặc tính đo kiểm chuẩn (SAP QPMK Master Inspection Characteristics). Con của Material. */
    characteristic: 'INSPECTION_CHARACTERISTIC',
} as const;

/**
 * Danh sách nhà máy — CHỖ DÀNH SẴN, không phải master data thật.
 *
 * App này không có nguồn plant nào: không trong `HistoricalCases`, không trong
 * mock dataset, không trong schema. Bốn dòng dưới đây tồn tại để ô chọn có thứ
 * để chọn ngay hôm nay; sửa chúng bằng cách sửa `staticEntries` của dòng
 * `PLANT`, hoặc trỏ sang S/4 như mọi F4 khác.
 *
 * Ghi rõ ra đây thay vì giấu trong code giao diện: chỗ này là chỗ người vận hành
 * sẽ tìm khi họ muốn đổi danh sách.
 *
 * ── Vì sao khoá là `1000` chứ không `PL-1000` ──
 * Bản đầu tôi đặt `PL-1000` cho dễ đọc. Sai hai lần: WERKS của SAP là CHAR(4) số
 * trần, và mọi lô kiểm tra đang có trong app đều mang `plant: '1000'` (xem
 * `scripts/generate-comprehensive-seed.mjs`). F4 cứng với khoá `PL-1000` sẽ biến
 * TOÀN BỘ dữ liệu đang có thành không lưu lại được — danh mục phải theo dữ liệu,
 * không phải ngược lại.
 */
const PLACEHOLDER_PLANTS = [
    { key: '1000', text: '1000 — Main Manufacturing' },
    { key: '2000', text: '2000 — Machining Centre' },
    { key: '3000', text: '3000 — Assembly' },
    { key: '4000', text: '4000 — Spare Parts' },
];

/**
 * Nhóm mã lỗi — tầng trên của catalog type 9 trong SAP.
 *
 * SAP không cho chọn mã lỗi từ một danh sách phẳng: catalog profile quyết định
 * nhóm nào dùng được, rồi trong nhóm mới tới mã. Bốn nhóm dưới đây phân loại
 * đúng 25 mã đang có theo BẢN CHẤT của lỗi, không phải theo tiền tố mã.
 */
export const DEFECT_CODE_GROUPS = [
    { key: 'QM-DIM', text: 'Dimensional / geometry' },
    { key: 'QM-SUR', text: 'Surface finish' },
    { key: 'QM-MAT', text: 'Material / structural' },
    { key: 'QM-ASM', text: 'Assembly / joining' },
];

/**
 * 25 mã lỗi, kèm NHÓM và MỨC NGHIÊM TRỌNG — phủ trọn kho case.
 *
 * ── Vì sao defectClass nằm ở đây chứ không phải người dùng chọn ──
 * Trong SAP QM, chọn một defect code thì hệ thống TỰ gán defect class theo cấu
 * hình catalog type 9. Mức nghiêm trọng là thuộc tính của MÃ, không phải ý kiến
 * của người đang ghi nhận lỗi — hai người gặp cùng một lỗi phải ra cùng một mức.
 *
 * ── Cơ sở phân loại, nói rõ để cãi được ──
 *   Critical  lỗi có thể tới tay khách hàng dưới dạng hỏng chức năng hoặc rò rỉ:
 *             rỗ khí mặt bích làm kín, bong keo kết cấu, nứt khi tạo hình
 *   Major     sai kích thước hoặc siết lực ngoài dung sai — lắp được nhưng tuổi
 *             thọ và khả năng lắp lẫn bị ảnh hưởng
 *   Minor     khuyết tật bề mặt và ngoại quan, không ảnh hưởng chức năng
 *
 * ── Phân loại theo MÃ, không theo vụ việc ──
 * `DEF-0220` (côn đường kính ngoài) từng làm kẹt chuyền của khách, nhưng vẫn là
 * Major: mức nghiêm trọng là thuộc tính của mã, còn "đã tới tay khách hàng" là
 * thuộc tính của vụ việc. Cho phép vụ việc nâng mức là phá đúng cái tính chất
 * làm cho việc suy ra mức từ mã có giá trị — hai người ghi cùng một lỗi ra cùng
 * một mức.
 *
 * ── Hai chỗ dễ bị chất vấn, trả lời trước ──
 *   `DEF-0104` Major còn `DEF-0902` Minor, dù cả hai đều là vết rung. Khác nhau ở
 *   chỗ 0104 là độ nhám Ra có dung sai trên MẶT BÍCH LÀM KÍN — một đặc tính chức
 *   năng đo được; 0902 là vết trên mặt mài không kèm chức năng nào được nêu.
 *   `DEF-0318` xếp QM-MAT chứ không QM-SUR: mã có kèm nứt tế vi ở mép, đó là
 *   khuyết tật cấu trúc, không phải hoàn thiện bề mặt.
 *
 * Đây là một GIẢ ĐỊNH ĐƯỢC GHI RÕ, không phải dữ liệu từ hệ thống chất lượng của
 * nhà máy. Sửa ở đúng chỗ này khi có catalogue thật, hoặc trỏ `DEFECT_CODE` sang
 * S/4 bằng `sourceType: 'external'` và mọi thứ dưới đây thành thừa.
 */
export const DEFECT_CODES = [
    { key: 'DEF-0104', text: 'Chatter marks and surface waviness on milled flange', codeGroup: 'QM-SUR', defectClass: 'Major' },
    { key: 'DEF-0220', text: 'Outer diameter taper out of tolerance on CNC lathe', codeGroup: 'QM-DIM', defectClass: 'Major' },
    { key: 'DEF-0318', text: 'Excessive burr and edge micro-cracks on stamped sheet', codeGroup: 'QM-MAT', defectClass: 'Major' },
    { key: 'DEF-0377', text: 'Shaft diameter below lower tolerance', codeGroup: 'QM-DIM', defectClass: 'Major' },
    { key: 'DEF-0440', text: 'Sink mark and internal void on cosmetic injection molded surface', codeGroup: 'QM-SUR', defectClass: 'Minor' },
    { key: 'DEF-0489', text: 'Flange edge burr above limit', codeGroup: 'QM-SUR', defectClass: 'Major' },
    { key: 'DEF-0512', text: 'Porosity at sealing flange face', codeGroup: 'QM-MAT', defectClass: 'Critical' },
    { key: 'DEF-0580', text: 'Solder bridging short circuit on fine-pitch QFN package', codeGroup: 'QM-ASM', defectClass: 'Critical' },
    { key: 'DEF-0601', text: 'Coating layer peeling', codeGroup: 'QM-SUR', defectClass: 'Minor' },
    { key: 'DEF-0630', text: 'Stripped plastic thread boss during automated screwdriving', codeGroup: 'QM-ASM', defectClass: 'Critical' },
    { key: 'DEF-0714', text: 'Pitting corrosion and dark discoloration on anodized aluminum bezel', codeGroup: 'QM-SUR', defectClass: 'Minor' },
    { key: 'DEF-0723', text: 'Bolt torque below specification', codeGroup: 'QM-ASM', defectClass: 'Major' },
    { key: 'DEF-0810', text: 'Adhesive bond failure', codeGroup: 'QM-ASM', defectClass: 'Critical' },
    { key: 'DEF-0822', text: 'Insufficient case depth after induction hardening', codeGroup: 'QM-MAT', defectClass: 'Critical' },
    { key: 'DEF-0902', text: 'Chatter marks on ground surface', codeGroup: 'QM-SUR', defectClass: 'Minor' },
    { key: 'DEF-0910', text: 'Internal porosity in robotic fiber laser welded lap joint', codeGroup: 'QM-MAT', defectClass: 'Critical' },
    { key: 'DEF-1015', text: 'Port thread depth insufficient', codeGroup: 'QM-DIM', defectClass: 'Major' },
    { key: 'DEF-1020', text: 'Hydraulic pressure test leak due to O-ring seal extrusion', codeGroup: 'QM-ASM', defectClass: 'Critical' },
    { key: 'DEF-1120', text: 'Retainer cracking during forming', codeGroup: 'QM-MAT', defectClass: 'Critical' },
    { key: 'DEF-1140', text: 'Grinding burn and micro-cracks on precision linear guideway', codeGroup: 'QM-MAT', defectClass: 'Critical' },
    { key: 'DEF-1233', text: 'Bore position out of true position', codeGroup: 'QM-DIM', defectClass: 'Major' },
    { key: 'DEF-1250', text: 'Coordinate Measuring Machine false rejection on bolt circle true position', codeGroup: 'QM-DIM', defectClass: 'Major' },
    { key: 'DEF-1340', text: 'Pocket depth inconsistent across units', codeGroup: 'QM-DIM', defectClass: 'Major' },
    { key: 'DEF-1455', text: 'Paint gloss out of specification', codeGroup: 'QM-SUR', defectClass: 'Minor' },
    { key: 'DEF-1610', text: 'Raised metal ridge at bore mouth', codeGroup: 'QM-SUR', defectClass: 'Major' },
    { key: 'DEF-2210', text: 'Weld seam cracked under straightening load', codeGroup: 'QM-MAT', defectClass: 'Critical' },
];

/** Đơn vị đo — cố định theo chuẩn, không đổi theo nhà máy nên để static. */
const UNITS_OF_MEASURE = [
    { key: 'PC', text: 'Piece' },
    { key: 'EA', text: 'Each' },
    { key: 'KG', text: 'Kilogram' },
    { key: 'G', text: 'Gram' },
    { key: 'M', text: 'Metre' },
    { key: 'MM', text: 'Millimetre' },
    { key: 'L', text: 'Litre' },
    { key: 'ML', text: 'Millilitre' },
    { key: 'M2', text: 'Square metre' },
    { key: 'M3', text: 'Cubic metre' },
    { key: 'BOX', text: 'Box' },
    { key: 'PAL', text: 'Pallet' },
];

/**
 * Danh sách lô sản xuất/vật tư mẫu gắn với từng Material — phục vụ F4 có cascading theo materialId.
 */
/**
 * Danh sách lô sản xuất/vật tư mẫu gắn với từng Material — phục vụ F4 có cascading theo materialId.
 * Cấu trúc: Plant (1000) -> Material ID (MAT-...) -> Batch ID (B-...)
 */
export const BATCHES = [
    // MAT-10247 (Bracket Housing X240)
    { key: 'B-49172', text: 'Bracket Housing X240 - Lot 2026-01-A (Quarantined: Surface Chatter & Burr)', materialId: 'MAT-10247', materialDesc: 'Bracket Housing X240', plant: '1000', status: 'Quarantined', batchDate: '2026-01-15' },
    { key: 'B-50231', text: 'Bracket Housing X240 - Lot 2026-02-A (Quarantined: Internal Porosity Void)', materialId: 'MAT-10247', materialDesc: 'Bracket Housing X240', plant: '1000', status: 'Quarantined', batchDate: '2026-02-10' },
    { key: 'B-51004', text: 'Bracket Housing X240 - Lot 2026-02-B (Unrestricted: Conforming Final Lot)', materialId: 'MAT-10247', materialDesc: 'Bracket Housing X240', plant: '1000', status: 'Unrestricted', batchDate: '2026-02-28' },
    { key: 'B-51288', text: 'Bracket Housing X240 - Lot 2026-03-A (Unrestricted: Released for Assembly)', materialId: 'MAT-10247', materialDesc: 'Bracket Housing X240', plant: '1000', status: 'Unrestricted', batchDate: '2026-03-01' },
    { key: 'B-55901', text: 'Bracket Housing X240 - Lot 2026-03-B (Quarantined: Burr Height Above Limit)', materialId: 'MAT-10247', materialDesc: 'Bracket Housing X240', plant: '1000', status: 'Quarantined', batchDate: '2026-08-12' },
    { key: 'B-54390', text: 'Bracket Housing X240 - Lot 2026-03-C (Quarantined: Pocket Depth Inconsistent)', materialId: 'MAT-10247', materialDesc: 'Bracket Housing X240', plant: '1000', status: 'Quarantined', batchDate: '2026-07-19' },
    // MAT-12800 (Chassis Frame Weldment F70)
    { key: 'B-56010', text: 'Chassis Frame Weldment F70 - Lot 2026-03-W (Quarantined: Weld Seam Cracked)', materialId: 'MAT-12800', materialDesc: 'Chassis Frame Weldment F70', plant: '1000', status: 'Quarantined', batchDate: '2026-08-12' },
    // MAT-88301 (Shaft Pinion SP-90)
    { key: 'B-55901', text: 'Shaft Pinion SP-90 - Lot 2026-01-SP (Quarantined: Pinion Taper Angle Out of Spec)', materialId: 'MAT-88301', materialDesc: 'Shaft Pinion SP-90', plant: '1000', status: 'Quarantined', batchDate: '2026-01-20' },
    { key: 'B-55902', text: 'Shaft Pinion SP-90 - Lot 2026-02-SP (Unrestricted: Hardness & Dimensions Passed)', materialId: 'MAT-88301', materialDesc: 'Shaft Pinion SP-90', plant: '1000', status: 'Unrestricted', batchDate: '2026-02-05' },
    // MAT-30911 (Brake Caliper Piston)
    { key: 'B-38290', text: 'Caliper Piston - Lot 2026-01-CP (Quarantined: Outer Diameter Scoring Scratch)', materialId: 'MAT-30911', materialDesc: 'Brake Caliper Piston', plant: '1000', status: 'Quarantined', batchDate: '2026-01-18' },
    { key: 'B-38291', text: 'Caliper Piston - Lot 2026-02-CP (Unrestricted: Polished Chrome Plating Conforming)', materialId: 'MAT-30911', materialDesc: 'Brake Caliper Piston', plant: '1000', status: 'Unrestricted', batchDate: '2026-02-12' },
    // MAT-11500 (Sprocket Hub H22)
    { key: 'B-40112', text: 'Sprocket Hub H22 - Lot 2026-02-SH (Quarantined: Central Bore Oversized +0.05mm)', materialId: 'MAT-11500', materialDesc: 'Sprocket Hub H22', plant: '1000', status: 'Quarantined', batchDate: '2026-02-14' },
    { key: 'B-40115', text: 'Sprocket Hub H22 - Lot 2026-02-SH2 (Unrestricted: Keyway & Bore Tolerance Normal)', materialId: 'MAT-11500', materialDesc: 'Sprocket Hub H22', plant: '1000', status: 'Unrestricted', batchDate: '2026-02-20' },
    // MAT-10318 (Pump Housing P90)
    { key: 'B-60318', text: 'Pump Housing P90 - Lot 2026-02-PH (Quarantined: Casting Micro-crack at Flange)', materialId: 'MAT-10318', materialDesc: 'Pump Housing P90', plant: '1000', status: 'Quarantined', batchDate: '2026-02-01' },
    { key: 'B-60320', text: 'Pump Housing P90 - Lot 2026-02-PH2 (Unrestricted: Hydrostatic Pressure Test Passed)', materialId: 'MAT-10318', materialDesc: 'Pump Housing P90', plant: '1000', status: 'Unrestricted', batchDate: '2026-02-25' },
    // MAT-10402 (Drive Shaft S150)
    { key: 'B-70402', text: 'Drive Shaft S150 - Lot 2026-02-DS (Quarantined: Runout & Total Wobble Above 0.08mm)', materialId: 'MAT-10402', materialDesc: 'Drive Shaft S150', plant: '1000', status: 'Quarantined', batchDate: '2026-02-08' },
    { key: 'B-70405', text: 'Drive Shaft S150 - Lot 2026-02-DS2 (Unrestricted: Dynamic Balancing Verified)', materialId: 'MAT-10402', materialDesc: 'Drive Shaft S150', plant: '1000', status: 'Unrestricted', batchDate: '2026-02-22' },
    // MAT-88410 (Fuel Regulator Housing Valve)
    { key: 'B-88411', text: 'Fuel Regulator Valve - Lot 2026-02-FR (Quarantined: High Pressure Helium Leakage)', materialId: 'MAT-88410', materialDesc: 'Fuel Regulator Housing Valve', plant: '1000', status: 'Quarantined', batchDate: '2026-02-15' },
    { key: 'B-88412', text: 'Fuel Regulator Valve - Lot 2026-02-FR2 (Unrestricted: Sealing Integrity 100% Passed)', materialId: 'MAT-88410', materialDesc: 'Fuel Regulator Housing Valve', plant: '1000', status: 'Unrestricted', batchDate: '2026-02-26' },
    // MAT-10555 (Cylinder Head CH-50)
    { key: 'B-90551', text: 'Cylinder Head CH-50 - Lot 2026-01-CH (Quarantined: Warpage on Gasket Surface)', materialId: 'MAT-10555', materialDesc: 'Cylinder Head CH-50', plant: '1000', status: 'Quarantined', batchDate: '2026-01-25' },
    { key: 'B-90552', text: 'Cylinder Head CH-50 - Lot 2026-02-CH (Unrestricted: CMM Surface Flatness Verified)', materialId: 'MAT-10555', materialDesc: 'Cylinder Head CH-50', plant: '1000', status: 'Unrestricted', batchDate: '2026-02-18' },
    // MAT-10611 (Transmission Gear TG-12)
    { key: 'B-91611', text: 'Transmission Gear TG-12 - Lot 2026-01-TG (Quarantined: Tooth Profile Involute Deviation)', materialId: 'MAT-10611', materialDesc: 'Transmission Gear TG-12', plant: '1000', status: 'Quarantined', batchDate: '2026-02-03' },
    { key: 'B-91612', text: 'Transmission Gear TG-12 - Lot 2026-02-TG (Unrestricted: Carburized & Quenched Passed)', materialId: 'MAT-10611', materialDesc: 'Transmission Gear TG-12', plant: '1000', status: 'Unrestricted', batchDate: '2026-02-27' },
    // MAT-10744 (Manifold Valve MV-04)
    { key: 'B-92741', text: 'Manifold Valve MV-04 - Lot 2026-01-MV (Quarantined: O-ring Sealing Groove Depth Defect)', materialId: 'MAT-10744', materialDesc: 'Manifold Valve MV-04', plant: '1000', status: 'Quarantined', batchDate: '2026-02-06' },
    { key: 'B-92742', text: 'Manifold Valve MV-04 - Lot 2026-02-MV (Unrestricted: Pressure Hold Tested)', materialId: 'MAT-10744', materialDesc: 'Manifold Valve MV-04', plant: '1000', status: 'Unrestricted', batchDate: '2026-02-24' },
];

/**
 * Danh mục phòng ban tiêu chuẩn (ISO 9001 / IATF 16949).
 * Đơn vị tổ chức cha trực tiếp của các Coordinator.
 */
export const DEPARTMENTS = [
    { key: 'QA', text: 'Quality Assurance', plant: '1000', lead: 'Heli (QE)' },
    { key: 'PRD', text: 'Production Shop Floor', plant: '1000', lead: 'Sarah Connor' },
    { key: 'ENG', text: 'Process Engineering', plant: '1000', lead: 'Frank Castle' },
    { key: 'MAINT', text: 'Maintenance & Tooling', plant: '1000', lead: 'Dave Miller' },
    { key: 'SCM', text: 'Supply Chain & Logistics', plant: '1000', lead: 'Grace Hopper' },
    { key: 'CS', text: 'Customer Quality & Field Service', plant: '1000', lead: 'Alex Murphy' },
];

/**
 * Danh mục điều phối viên thông báo lỗi (Notification Coordinators) chuẩn.
 * Nhân sự trực thuộc từng phòng ban (Department) tương ứng.
 */
export const COORDINATORS = [
    { key: 'BP-QA-01', text: 'Heli (QE)', department: 'Quality Assurance', functionTitle: 'Lead Quality Assurance Engineer', email: 'heli.qe@example.com', phone: '+84 901 234 567' },
    { key: 'BP-QA-02', text: 'Minh Dinh', department: 'Quality Assurance', functionTitle: 'Senior QM Coordinator & 8D Champion', email: 'minh.dinh@example.com', phone: '+84 902 345 678' },
    { key: 'BP-PRD-01', text: 'Sarah Connor', department: 'Production Shop Floor', functionTitle: 'Production Section Coordinator', email: 'sarah.c@example.com', phone: '+84 903 456 789' },
    { key: 'BP-PRD-02', text: 'Marcus Wright', department: 'Production Shop Floor', functionTitle: 'Shift Supervisor & Assembly Lead', email: 'marcus.w@example.com', phone: '+84 903 888 999' },
    { key: 'BP-ENG-01', text: 'Frank Castle', department: 'Process Engineering', functionTitle: 'Senior Process & Tooling Engineer', email: 'frank.c@example.com', phone: '+84 904 567 890' },
    { key: 'BP-MAINT-01', text: 'Dave Miller', department: 'Maintenance & Tooling', functionTitle: 'Tooling & Machine Maintenance Specialist', email: 'dave.m@example.com', phone: '+84 905 678 901' },
    { key: 'BP-SCM-01', text: 'Grace Hopper', department: 'Supply Chain & Logistics', functionTitle: 'Supplier Quality Assurance Lead', email: 'grace.h@example.com', phone: '+84 906 789 012' },
    { key: 'BP-CS-01', text: 'Alex Murphy', department: 'Customer Quality & Field Service', functionTitle: 'Customer Complaint Lead & Field Liaison', email: 'alex.m@example.com', phone: '+84 907 111 222' },
];

/**
 * Danh mục đặc tính đo kiểm chuẩn (Master Inspection Characteristics - SAP QPMK).
 * Gắn với từng Material (hoặc chung) kèm dung sai thiết kế và thiết bị đo chuẩn.
 */
export const INSPECTION_CHARACTERISTICS = [
    // MAT-10247 (Bracket Housing X240)
    { key: 'MIC-FLAT-01', text: 'Flange Face Flatness', materialId: 'MAT-10247', materialDesc: 'Bracket Housing X240', specLowerLimit: '0.0000', specUpperLimit: '0.0800', specUom: 'mm', defaultEquipment: 'CMM-ZEISS-01', charType: 'Quantitative' },
    { key: 'MIC-BURR-01', text: 'Flange Edge Burr Height', materialId: 'MAT-10247', materialDesc: 'Bracket Housing X240', specLowerLimit: '0.0000', specUpperLimit: '0.0500', specUom: 'mm', defaultEquipment: 'OPTICAL-COMP-01', charType: 'Quantitative' },
    { key: 'MIC-DIST-01', text: 'Bolt Hole Pitch Distance', materialId: 'MAT-10247', materialDesc: 'Bracket Housing X240', specLowerLimit: '120.0000', specUpperLimit: '120.1500', specUom: 'mm', defaultEquipment: 'CMM-ZEISS-01', charType: 'Quantitative' },
    { key: 'MIC-PORO-01', text: 'Porosity Void Area Ratio', materialId: 'MAT-10247', materialDesc: 'Bracket Housing X240', specLowerLimit: '0.0000', specUpperLimit: '1.5000', specUom: '%', defaultEquipment: 'XRAY-SCAN-01', charType: 'Quantitative' },

    // MAT-88301 (Shaft Pinion SP-90)
    { key: 'MIC-TAPER-01', text: 'Pinion Taper Angle', materialId: 'MAT-88301', materialDesc: 'Shaft Pinion SP-90', specLowerLimit: '15.0000', specUpperLimit: '15.0500', specUom: 'deg', defaultEquipment: 'PROFILE-PROJ-02', charType: 'Quantitative' },
    { key: 'MIC-HARD-01', text: 'Surface Hardness Rockwell C', materialId: 'MAT-88301', materialDesc: 'Shaft Pinion SP-90', specLowerLimit: '58.0000', specUpperLimit: '62.0000', specUom: 'HRC', defaultEquipment: 'ROCKWELL-HR-01', charType: 'Quantitative' },
    { key: 'MIC-TOOTH-01', text: 'Gear Tooth Involute Error', materialId: 'MAT-88301', materialDesc: 'Shaft Pinion SP-90', specLowerLimit: '0.0000', specUpperLimit: '0.0120', specUom: 'mm', defaultEquipment: 'GEAR-TESTER-01', charType: 'Quantitative' },

    // MAT-30911 (Brake Caliper Piston)
    { key: 'MIC-OD-01', text: 'Piston Outer Diameter (OD)', materialId: 'MAT-30911', materialDesc: 'Brake Caliper Piston', specLowerLimit: '45.0000', specUpperLimit: '45.0200', specUom: 'mm', defaultEquipment: 'AIR-GAUGE-02', charType: 'Quantitative' },
    { key: 'MIC-COAT-01', text: 'Chrome Plating Thickness', materialId: 'MAT-30911', materialDesc: 'Brake Caliper Piston', specLowerLimit: '15.0000', specUpperLimit: '25.0000', specUom: 'µm', defaultEquipment: 'EDDY-CURRENT-01', charType: 'Quantitative' },
    { key: 'MIC-ROUGH-02', text: 'Piston Skirt Roughness Ra', materialId: 'MAT-30911', materialDesc: 'Brake Caliper Piston', specLowerLimit: '0.0000', specUpperLimit: '0.2000', specUom: 'µm', defaultEquipment: 'SURF-TESTER-01', charType: 'Quantitative' },

    // MAT-11500 (Sprocket Hub H22)
    { key: 'MIC-BORE-01', text: 'Central Bore Diameter', materialId: 'MAT-11500', materialDesc: 'Sprocket Hub H22', specLowerLimit: '22.0000', specUpperLimit: '22.0300', specUom: 'mm', defaultEquipment: 'BORE-MICROMETER-01', charType: 'Quantitative' },
    { key: 'MIC-KEY-01', text: 'Keyway Width', materialId: 'MAT-11500', materialDesc: 'Sprocket Hub H22', specLowerLimit: '6.0000', specUpperLimit: '6.0400', specUom: 'mm', defaultEquipment: 'PLUG-GAUGE-GO-NOGO', charType: 'Quantitative' },

    // MAT-10318 (Pump Housing P90)
    { key: 'MIC-ROUGH-01', text: 'Sealing Face Roughness Ra', materialId: 'MAT-10318', materialDesc: 'Pump Housing P90', specLowerLimit: '0.0000', specUpperLimit: '0.8000', specUom: 'µm', defaultEquipment: 'MITUTOYO-SJ410', charType: 'Quantitative' },
    { key: 'MIC-BURST-01', text: 'Hydrostatic Burst Pressure', materialId: 'MAT-10318', materialDesc: 'Pump Housing P90', specLowerLimit: '120.0000', specUpperLimit: '150.0000', specUom: 'bar', defaultEquipment: 'HYDRO-BENCH-01', charType: 'Quantitative' },

    // MAT-10402 (Drive Shaft S150)
    { key: 'MIC-RUNOUT-01', text: 'Total Radial Runout / Wobble', materialId: 'MAT-10402', materialDesc: 'Drive Shaft S150', specLowerLimit: '0.0000', specUpperLimit: '0.0400', specUom: 'mm', defaultEquipment: 'DIAL-INDICATOR-BENCH', charType: 'Quantitative' },
    { key: 'MIC-BAL-01', text: 'Dynamic Balance Imbalance', materialId: 'MAT-10402', materialDesc: 'Drive Shaft S150', specLowerLimit: '0.0000', specUpperLimit: '1.5000', specUom: 'g·cm', defaultEquipment: 'SHENK-BALANCING-01', charType: 'Quantitative' },

    // MAT-88410 (Fuel Regulator Housing Valve)
    { key: 'MIC-LEAK-01', text: 'Helium Leak Rate', materialId: 'MAT-88410', materialDesc: 'Fuel Regulator Housing Valve', specLowerLimit: '0.0000', specUpperLimit: '1.0000', specUom: 'sccm', defaultEquipment: 'PFEIFFER-HELIUM-01', charType: 'Quantitative' },
    { key: 'MIC-CRACK-01', text: 'Valve Cracking Pressure', materialId: 'MAT-88410', materialDesc: 'Fuel Regulator Housing Valve', specLowerLimit: '3.4000', specUpperLimit: '3.6000', specUom: 'bar', defaultEquipment: 'TEST-STAND-FRV', charType: 'Quantitative' },

    // MAT-10555 (Cylinder Head CH-50)
    { key: 'MIC-WARP-01', text: 'Cylinder Deck Face Warpage', materialId: 'MAT-10555', materialDesc: 'Cylinder Head CH-50', specLowerLimit: '0.0000', specUpperLimit: '0.0500', specUom: 'mm', defaultEquipment: 'CMM-ZEISS-01', charType: 'Quantitative' },

    // MAT-10611 (Transmission Gear TG-12)
    { key: 'MIC-BACK-01', text: 'Gear Mesh Backlash', materialId: 'MAT-10611', materialDesc: 'Transmission Gear TG-12', specLowerLimit: '0.0800', specUpperLimit: '0.1500', specUom: 'mm', defaultEquipment: 'DIAL-GAUGE-02', charType: 'Quantitative' },

    // MAT-10744 (Manifold Valve MV-04)
    { key: 'MIC-GROOVE-01', text: 'O-ring Sealing Groove Depth', materialId: 'MAT-10744', materialDesc: 'Manifold Valve MV-04', specLowerLimit: '2.4000', specUpperLimit: '2.5000', specUom: 'mm', defaultEquipment: 'DEPTH-MICROMETER-01', charType: 'Quantitative' },

    // Đặc tính chung (General / Across Materials)
    { key: 'MIC-VISUAL-01', text: 'Surface Cosmetic Defect / Scratch', materialId: '', materialDesc: 'General (All Materials)', specLowerLimit: '0.0000', specUpperLimit: '0.0000', specUom: 'visual', defaultEquipment: 'OPTICAL-MICROSCOPE', charType: 'Qualitative' },
];

interface ValueHelpSeed {
    valueHelpID: string;
    description: string;
    sourceType: 'static' | 'reference';
    staticEntries?: string;
    referenceTable?: string;
    keyColumn?: string;
    textColumn?: string;
    returnMapping?: string;
    dependsOn?: string;
    displayFormat?: string;
    sortBy?: string;
}

const SEEDS: ValueHelpSeed[] = [
    {
        valueHelpID: VALUE_HELP_IDS.plant,
        description: 'Plants available for quality notifications. Placeholder list — replace staticEntries, or switch sourceType to external once S/4 is connected.',
        sourceType: 'static',
        staticEntries: JSON.stringify(PLACEHOLDER_PLANTS),
        displayFormat: 'textOnly',
        sortBy: 'key',
    },
    {
        valueHelpID: VALUE_HELP_IDS.uom,
        description: 'Units of measure for the affected quantity.',
        sourceType: 'static',
        staticEntries: JSON.stringify(UNITS_OF_MEASURE),
        displayFormat: 'textOnly',
        sortBy: 'key',
    },
    {
        valueHelpID: VALUE_HELP_IDS.material,
        description: 'Materials seen on closed 8D cases. Selecting one fills the description and the material group.',
        sourceType: 'reference',
        referenceTable: 'HistoricalCases',
        keyColumn: 'materialId',
        textColumn: 'materialDesc',
        // Mô tả và nhóm vật tư được DÁN vào, không gõ tay — đúng cách một F4 của
        // SAP hoạt động, và cũng là cách duy nhất để nhóm vật tư đúng với mã.
        returnMapping: JSON.stringify([
            { sourceColumn: 'materialDesc', targetField: 'materialDesc' },
            { sourceColumn: 'materialFamily', targetField: 'materialGroup' },
        ]),
        displayFormat: 'textOnly',
        sortBy: 'key',
    },
    {
        valueHelpID: VALUE_HELP_IDS.workCenter,
        description: 'Work centres seen on closed 8D cases. Selecting one fills the description.',
        sourceType: 'reference',
        referenceTable: 'HistoricalCases',
        keyColumn: 'workCenterId',
        textColumn: 'workCenterDesc',
        returnMapping: JSON.stringify([
            { sourceColumn: 'workCenterDesc', targetField: 'workCenterDesc' },
        ]),
        displayFormat: 'textOnly',
        sortBy: 'key',
    },
    {
        /**
         * Danh bạ Business Partner cho D1 và cho hai ô người ở form ghi nhận lỗi.
         *
         * ── Vì sao email và điện thoại hiện đang trống ──
         * `HistoricalTeamMembers` CÓ hai cột đó, nhưng `librarySeeder` ghi null vì
         * dữ liệu mock không hề mang chúng. Tôi KHÔNG sinh địa chỉ email giả: một
         * địa chỉ bịa trong bản 8D gửi khách hàng tệ hơn hẳn một ô trống.
         *
         * Nên dòng này tạo ra CHỖ để duy trì, không tạo ra dữ liệu. Điền email và
         * điện thoại vào `HistoricalTeamMembers` thì chúng tự chảy qua
         * `returnMapping` vào bảng nhóm của D1 — không phải sửa dòng code nào.
         * Khi S/4 được nối, đổi `sourceType` sang 'external' là xong.
         */
        valueHelpID: VALUE_HELP_IDS.partner,
        description: 'Business partners seen on closed 8D cases. Email and phone come from HistoricalTeamMembers — maintain them there, or switch sourceType to external once S/4 is connected.',
        sourceType: 'reference',
        referenceTable: 'HistoricalTeamMembers',
        keyColumn: 'partnerId',
        textColumn: 'partnerName',
        returnMapping: JSON.stringify([
            { sourceColumn: 'partnerName', targetField: 'partnerName' },
            { sourceColumn: 'functionTitle', targetField: 'functionTitle' },
            { sourceColumn: 'email', targetField: 'email' },
            { sourceColumn: 'phone', targetField: 'phone' },
        ]),
        displayFormat: 'textOnly',
        sortBy: 'text',
    },
    {
        valueHelpID: VALUE_HELP_IDS.defectCodeGroup,
        description: 'Defect code groups (catalog type 9). Picking a group narrows the defect codes below it.',
        sourceType: 'static',
        staticEntries: JSON.stringify(DEFECT_CODE_GROUPS),
        displayFormat: 'textOnly',
        sortBy: 'key',
    },
    {
        /**
         * ── Vì sao `static` chứ không `reference` như vật tư và work center ──
         * Mã lỗi phải mang theo `defectClass` và `codeGroup`. `HistoricalCases`
         * không có hai cột đó, và thêm cột thì phải deploy lại HDI container dùng
         * chung. Nhưng `staticEntries` là một cột LargeString ĐÃ TỒN TẠI, và
         * handler trả nguyên các trường phụ ra cho `returnMapping` — nên hợp đồng
         * F4 giống hệt, chỉ khác chỗ lấy dữ liệu.
         *
         * Cái giá: danh sách không còn tự bám theo kho case. Một mã lỗi mới xuất
         * hiện trong kho sẽ không tự hiện trong ô chọn cho tới khi ai đó thêm vào
         * đây. Chấp nhận được, vì catalogue mã lỗi vốn là master data được duy
         * trì có chủ đích, không phải thứ mọc lên từ dữ liệu giao dịch — và đích
         * đến thật là `sourceType: 'external'` trỏ vào S/4.
         */
        valueHelpID: VALUE_HELP_IDS.defectCode,
        description: 'Defect catalogue codes with their code group and defect class. Selecting one fills the description and the severity — derived from catalog type 9.',
        sourceType: 'static',
        staticEntries: JSON.stringify(DEFECT_CODES),
        dependsOn: 'codeGroup',
        returnMapping: JSON.stringify([
            { sourceColumn: 'text', targetField: 'defectText' },
            { sourceColumn: 'defectClass', targetField: 'defectClass' },
            { sourceColumn: 'codeGroup', targetField: 'defectCodeGroup' },
        ]),
        displayFormat: 'textOnly',
        sortBy: 'key',
    },
    {
        /**
         * Lô kiểm tra — mắt xích ② của chuỗi, và là thứ biến "Found during
         * inspection" từ một giá trị dropdown thành một liên kết thật.
         *
         * ── Đây là toàn bộ Đường A ──
         * Chọn một lô thì vật tư, nhà máy, work center, thiết bị VÀ dòng kết quả
         * của lô được dán sang form. Không có mapping này thì người vận hành gõ
         * lại đúng những gì hệ thống đã giữ — và gõ lại là chỗ sai lệch sinh ra.
         *
         * ── Vì sao `dependsOn: 'materialId'` chứ không lọc cả nhà máy ──
         * Handler chỉ nhận MỘT cột phụ thuộc. Chọn vật tư vì nó thu hẹp mạnh hơn
         * hẳn: một nhà máy có hàng nghìn lô, một vật tư trong kho này có sáu. Nhà
         * máy vẫn được DÁN VỀ từ lô, nên chuỗi vẫn khép — chỉ là không lọc theo nó.
         *
         * ── Giới hạn đã biết (Q8) ──
         * Một dòng ở đây là MỘT đặc tính, không phải một lô nhiều kết quả. Lô
         * trượt nhiều đặc tính thì một cú chọn chỉ mang về được một dòng; những
         * dòng còn lại vẫn phải nhập tay. Đã ghi trong S2 của kế hoạch.
         */
        valueHelpID: VALUE_HELP_IDS.inspectionLot,
        description: 'Inspection lots (Path A). Selecting one fills material, plant, work centre, equipment and the lot\'s characteristic result row.',
        sourceType: 'reference',
        referenceTable: 'InspectionLots',
        keyColumn: 'lotId',
        textColumn: 'characteristic',
        dependsOn: 'materialId',
        returnMapping: JSON.stringify([
            { sourceColumn: 'materialId', targetField: 'materialId' },
            { sourceColumn: 'plant', targetField: 'plant' },
            { sourceColumn: 'workCenterId', targetField: 'workCenterId' },
            { sourceColumn: 'equipment', targetField: 'lotEquipment' },
            { sourceColumn: 'characteristic', targetField: 'lotCharacteristic' },
            { sourceColumn: 'measuredValue', targetField: 'lotMeasuredValue' },
            { sourceColumn: 'unit', targetField: 'lotUom' },
            // `conforming` là boolean; phía form dịch sang Accepted / Rejected.
            // Dịch ở đây thì phải bịa một cột không có trong bảng.
            { sourceColumn: 'conforming', targetField: 'lotConforming' },
        ]),
        displayFormat: 'textOnly',
        sortBy: 'key',
    },
    {
        valueHelpID: VALUE_HELP_IDS.taskCodeGroup,
        description: 'Task code groups (catalog type 2). Picking a group narrows the task codes below it.',
        sourceType: 'static',
        staticEntries: JSON.stringify(TASK_CODE_GROUPS),
        displayFormat: 'textOnly',
        sortBy: 'key',
    },
    {
        /**
         * Mã nhiệm vụ — catalog type 2, cặp song sinh của `DEFECT_CODE`.
         *
         * ── Vì sao `returnMapping` KHÔNG có `actionType` ──
         * `DEFECT_CODE` dán về `defectClass` vì mức nghiêm trọng là thuộc tính
         * CỦA mã lỗi. Mã nhiệm vụ không có thuộc tính tương đương: dữ liệu thật
         * ghi `Rework 48 bridged boards` là Containment còn `Rework 212 affected
         * shafts` là Corrective. Cùng một việc, hai vai trò. Dán một
         * `actionType` về từ đây là ép sai một trong hai — discipline thuộc về
         * case, không thuộc về mã. Lý do đầy đủ nằm ở `taskCatalogue.ts`.
         */
        valueHelpID: VALUE_HELP_IDS.taskCode,
        description: 'Quality task catalogue codes with their code group (catalog type 2). Selecting one fills the standard task text; the discipline stays a property of the case, not of the code.',
        sourceType: 'static',
        staticEntries: JSON.stringify(TASK_CODES),
        dependsOn: 'codeGroup',
        returnMapping: JSON.stringify([
            { sourceColumn: 'text', targetField: 'taskText' },
            { sourceColumn: 'codeGroup', targetField: 'taskCodeGroup' },
        ]),
        displayFormat: 'textOnly',
        sortBy: 'key',
    },
    {
        valueHelpID: VALUE_HELP_IDS.batch,
        description: 'Batches of materials (MCHA/MCH1). Filtered by materialId.',
        sourceType: 'static',
        staticEntries: JSON.stringify(BATCHES),
        dependsOn: 'materialId',
        returnMapping: JSON.stringify([
            { sourceColumn: 'key', targetField: 'batchId' },
            { sourceColumn: 'materialId', targetField: 'materialId' },
            { sourceColumn: 'plant', targetField: 'plant' },
        ]),
        displayFormat: 'keyAndText',
        sortBy: 'key',
    },
    {
        valueHelpID: VALUE_HELP_IDS.department,
        description: 'Responsible departments for defect handling and quality assurance (QMEL-ABTEI).',
        sourceType: 'static',
        staticEntries: JSON.stringify(DEPARTMENTS),
        returnMapping: JSON.stringify([
            { sourceColumn: 'text', targetField: 'department' },
        ]),
        displayFormat: 'textOnly',
        sortBy: 'key',
    },
    {
        valueHelpID: VALUE_HELP_IDS.coordinator,
        description: 'Quality notification coordinators and lead engineers (QMEL-PARNR).',
        sourceType: 'static',
        staticEntries: JSON.stringify(COORDINATORS),
        returnMapping: JSON.stringify([
            { sourceColumn: 'text', targetField: 'coordinator' },
            { sourceColumn: 'department', targetField: 'department' },
        ]),
        displayFormat: 'textOnly',
        sortBy: 'text',
    },
    {
        valueHelpID: VALUE_HELP_IDS.characteristic,
        description: 'Master inspection characteristics (QPMK) with default tolerance limits and equipment. Filtered by materialId.',
        sourceType: 'static',
        staticEntries: JSON.stringify(INSPECTION_CHARACTERISTICS),
        dependsOn: 'materialId',
        returnMapping: JSON.stringify([
            { sourceColumn: 'text', targetField: 'characteristic' },
            { sourceColumn: 'specLowerLimit', targetField: 'specLowerLimit' },
            { sourceColumn: 'specUpperLimit', targetField: 'specUpperLimit' },
            { sourceColumn: 'specUom', targetField: 'specUom' },
            { sourceColumn: 'defaultEquipment', targetField: 'equipment' },
        ]),
        displayFormat: 'textOnly',
        sortBy: 'text',
    },
];

/**
 * Thêm những định nghĩa F4 còn thiếu. Không đụng tới dòng đã có.
 *
 * Hỏng thì ghi log và đi tiếp: thiếu F4 làm form phải gõ tay, còn ném lỗi ở đây
 * thì cả chuỗi seed phía sau không chạy.
 */
export async function seedValueHelps(): Promise<void> {
    try {
        const db = await cds.connect.to('db');
        const existing = await db.run(
            SELECT.from(VALUE_HELPS).columns('valueHelpID').where({ objectType: DEFECT_OBJECT_TYPE }),
        );
        const have = new Set((existing as any[]).map((r) => r.valueHelpID));
        const missing = SEEDS.filter((s) => !have.has(s.valueHelpID));
        if (!missing.length) {
            await upgradeDefectCodeToStatic(db);
            await reconcileStaticCatalogues(db);
            await seedStandardTeamDirectory(db);
            await seedSampleDefects(db);
            return;
        }

        await db.run(
            INSERT.into(VALUE_HELPS).entries(
                missing.map((seed) => ({
                    valueHelpID: seed.valueHelpID,
                    objectType: DEFECT_OBJECT_TYPE,
                    description: seed.description,
                    sourceType: seed.sourceType,
                    staticEntries: seed.staticEntries ?? null,
                    referenceTable: seed.referenceTable ?? null,
                    keyColumn: seed.keyColumn ?? null,
                    textColumn: seed.textColumn ?? null,
                    returnMapping: seed.returnMapping ?? null,
                    dependsOn: seed.dependsOn ?? null,
                    displayFormat: seed.displayFormat ?? 'keyAndText',
                    sortBy: seed.sortBy ?? 'text',
                    isActive: true,
                })),
            ),
        );
        LOG.info(`Đã seed ${missing.length} định nghĩa F4: ${missing.map((s) => s.valueHelpID).join(', ')}`);
        await upgradeDefectCodeToStatic(db);
        await reconcileStaticCatalogues(db);
        await seedStandardTeamDirectory(db);
        await seedSampleDefects(db);
        return;
    } catch (e: any) {
        LOG.error(`Seed value help thất bại (form sẽ phải gõ tay): ${e.message}`);
    }
}

/**
 * Bù các mục catalogue còn thiếu vào những F4 static đã tồn tại.
 *
 * ── Vì sao cần hàm này ──
 * `seedValueHelps` idempotent ở mức DÒNG: đã có dòng `DEFECT_CODE` thì không đụng
 * vào nữa. Đúng cho cấu hình, sai cho NỘI DUNG catalogue — thêm 12 mã vào
 * `DEFECT_CODES` sẽ không bao giờ tới được một database đã chạy, và ô chọn vẫn
 * cứ 13 mã như cũ mà không ai biết vì sao.
 *
 * Nên tính idempotent được hạ xuống một tầng: mức MỤC, không phải mức dòng. Mục
 * nào đã có thì giữ nguyên y hệt — admin sửa mô tả hay mức nghiêm trọng trên hệ
 * thống thì bản sửa đó thắng seed. Chỉ những `key` chưa từng có mới được thêm.
 *
 * Hệ quả có chủ ý: hàm này KHÔNG BAO GIỜ XOÁ. Gỡ một mã khỏi `DEFECT_CODES` sẽ
 * không gỡ nó khỏi database — và đó là điều đúng, vì các case đã ghi nhận mã đó
 * vẫn cần nó hiển thị được.
 */
async function reconcileStaticCatalogues(db: any): Promise<void> {
    for (const seed of SEEDS) {
        if (seed.sourceType !== 'static' || !seed.staticEntries) continue;

        const row = await db.run(
            SELECT.one.from(VALUE_HELPS)
                .columns('ID', 'staticEntries')
                .where({ valueHelpID: seed.valueHelpID, objectType: DEFECT_OBJECT_TYPE }),
        );
        if (!row) continue;

        // Đồng bộ displayFormat nếu cấu hình trong code có thay đổi
        if (seed.displayFormat) {
            await db.run(
                UPDATE(VALUE_HELPS)
                    .set({ displayFormat: seed.displayFormat })
                    .where({ ID: row.ID }),
            );
        }

        let stored: Array<{ key?: string }>;
        try {
            const parsed = JSON.parse(row.staticEntries || '[]');
            if (!Array.isArray(parsed)) throw new Error('không phải mảng');
            stored = parsed;
        } catch (e: any) {
            // Nội dung hỏng thì bỏ qua chứ không ghi đè: đè lên là xoá mất bản
            // admin đã sửa, và mất im lặng. Báo to để có người đi sửa tay.
            LOG.error(`staticEntries của ${seed.valueHelpID} không đọc được (${e.message}) — bỏ qua reconcile, cần sửa tay.`);
            continue;
        }

        if (stored.length === 0) {
            await db.run(
                UPDATE(VALUE_HELPS)
                    .set({ staticEntries: seed.staticEntries })
                    .where({ ID: row.ID }),
            );
            LOG.info(`Đã nạp toàn bộ staticEntries cho ${seed.valueHelpID}`);
            continue;
        }

        const have = new Set(stored.map((entry) => entry.key));
        const additions = (JSON.parse(seed.staticEntries) as Array<{ key: string }>)
            .filter((entry) => !have.has(entry.key));
        if (!additions.length) continue;

        await db.run(
            UPDATE(VALUE_HELPS)
                .set({ staticEntries: JSON.stringify([...stored, ...additions]) })
                .where({ ID: row.ID }),
        );
        LOG.info(
            `Đã bù ${additions.length} mục vào ${seed.valueHelpID}: ${additions.map((a) => a.key).join(', ')}`,
        );
    }
}

/**
 * Kiểm tra mọi `defectCode` trong kho case đều chọn được trong ô F4.
 *
 * ── Vì sao đây là lỗi chặn chứ không phải cảnh báo cho vui ──
 * F4 nay là CỨNG: giá trị ngoài catalogue không lưu được. Một mã có thật trong
 * kho mà không có trong catalogue nghĩa là người vận hành gặp đúng lỗi đó sẽ
 * không ghi nhận được, và không có đường vòng nào trên form.
 *
 * Chỉ ĐỌC và BÁO, không tự sửa: tự thêm mã thiếu vào catalogue là bịa ra nhóm mã
 * và mức nghiêm trọng cho nó — hai thứ không suy được từ dữ liệu case. Chỗ sửa
 * đúng là `DEFECT_CODES` ở trên, do người quyết định.
 *
 * @returns các mã có trong kho nhưng không có trong catalogue
 */
export async function verifyDefectCatalogueCoverage(): Promise<string[]> {
    try {
        const db = await cds.connect.to('db');

        const row = await db.run(
            SELECT.one.from(VALUE_HELPS)
                .columns('staticEntries')
                .where({ valueHelpID: VALUE_HELP_IDS.defectCode, objectType: DEFECT_OBJECT_TYPE }),
        );
        if (!row) {
            LOG.error('Chưa có định nghĩa F4 DEFECT_CODE — không kiểm tra được độ phủ catalogue.');
            return [];
        }

        // Đọc catalogue từ DATABASE chứ không từ hằng số ở trên: sau reconcile,
        // database mới là bản đang thực sự phục vụ ô chọn.
        const catalogue = new Set(
            (JSON.parse(row.staticEntries || '[]') as Array<{ key: string }>).map((e) => e.key),
        );

        const cases = await db.run(
            SELECT.from('cnma.proresolve.HistoricalCases').columns('defectCode'),
        );
        const used = new Set(
            (cases as Array<{ defectCode?: string | null }>)
                .map((c) => c.defectCode?.trim())
                .filter((c): c is string => !!c),
        );

        const orphans = [...used].filter((code) => !catalogue.has(code)).sort();
        if (orphans.length) {
            LOG.error(
                `${orphans.length}/${used.size} mã lỗi trong kho case KHÔNG chọn được trên form ` +
                `(F4 cứng sẽ chặn lưu): ${orphans.join(', ')}. ` +
                'Thêm chúng vào DEFECT_CODES trong valueHelpSeeder.ts, kèm codeGroup và defectClass.',
            );
        } else {
            LOG.info(`Catalogue phủ đủ ${used.size} mã lỗi đang có trong kho case.`);
        }
        return orphans;
    } catch (e: any) {
        LOG.error(`Không kiểm tra được độ phủ catalogue mã lỗi: ${e.message}`);
        return [];
    }
}

/**
 * Kiểm tra danh mục nhiệm vụ so với những mã ĐANG NẰM trong kho hành động.
 *
 * ── Vì sao phép kiểm này khác phép kiểm mã lỗi ──
 * Mã lỗi do NGƯỜI gõ vào một ô F4 cứng, nên mã mồ côi nghĩa là "có người sẽ
 * không ghi nhận được lỗi này". Mã nhiệm vụ do LUẬT sinh ra
 * (`classifyTaskCode`), nên mã mồ côi nghĩa là một chuyện khác hẳn: bộ luật và
 * danh mục đã lệch nhau — một luật còn phát ra mã mà `TASK_CODES` đã bỏ đi. Ô
 * chọn vẫn dùng được, nhưng cột mã trong kho chứa một giá trị không tra ngược
 * được sang tên. Đó là lỗi của lập trình viên, không phải của người vận hành.
 *
 * ── Vì sao đếm cả hành động CHƯA có mã ──
 * Đó là con số nói cho biết bộ luật còn hụt ở đâu. Nó KHÔNG phải lỗi: câu văn
 * không mã hoá được thì để trống là câu trả lời đúng (xem `task-catalogue.ts`).
 * Nhưng tỉ lệ trống tăng dần qua các lần nạp dữ liệu mới là dấu hiệu cần thêm
 * luật, và không ai nhìn thấy nó nếu không có ai đếm.
 *
 * Chỉ ĐỌC và BÁO, cùng thái độ với `verifyDefectCatalogueCoverage`.
 *
 * @returns các mã có trong kho hành động nhưng không có trong danh mục
 */
export async function verifyTaskCatalogueCoverage(): Promise<string[]> {
    try {
        const db = await cds.connect.to('db');

        const row = await db.run(
            SELECT.one.from(VALUE_HELPS)
                .columns('staticEntries')
                .where({ valueHelpID: VALUE_HELP_IDS.taskCode, objectType: DEFECT_OBJECT_TYPE }),
        );
        if (!row) {
            LOG.error('Chưa có định nghĩa F4 TASK_CODE — không kiểm tra được độ phủ danh mục nhiệm vụ.');
            return [];
        }

        const catalogue = new Set(
            (JSON.parse(row.staticEntries || '[]') as Array<{ key: string }>).map((e) => e.key),
        );

        const actions = await db.run(
            SELECT.from('cnma.proresolve.HistoricalActions').columns('taskCode'),
        );
        const rows = actions as Array<{ taskCode?: string | null }>;
        const used = new Set(
            rows.map((a) => a.taskCode?.trim()).filter((c): c is string => !!c),
        );
        const uncoded = rows.filter((a) => !a.taskCode?.trim()).length;

        const orphans = [...used].filter((code) => !catalogue.has(code)).sort();
        if (orphans.length) {
            LOG.error(
                `${orphans.length} mã nhiệm vụ trong kho hành động KHÔNG có trong danh mục ` +
                `(luật và danh mục đã lệch nhau): ${orphans.join(', ')}. ` +
                'Thêm chúng vào TASK_CODES trong shared/task-catalogue.ts, hoặc sửa luật phát ra chúng.',
            );
        } else {
            LOG.info(
                `Danh mục nhiệm vụ phủ đủ ${used.size}/${catalogue.size} mã đang dùng trong kho hành động.`,
            );
        }
        if (uncoded) {
            LOG.warn(
                `${uncoded}/${rows.length} hành động trong kho chưa mã hoá được. ` +
                'Không phải lỗi — nhưng nếu con số này tăng thì bộ luật trong shared/task-catalogue.ts cần bổ sung.',
            );
        }
        return orphans;
    } catch (e: any) {
        LOG.error(`Không kiểm tra được độ phủ danh mục nhiệm vụ: ${e.message}`);
        return [];
    }
}

/**
 * Nâng `DEFECT_CODE` từ `reference` lên `static`.
 *
 * Bản đầu trỏ vào `HistoricalCases`, và chỉ mang được mã với mô tả. Mức nghiêm
 * trọng và nhóm mã không có cột nào để chứa. Bản static mang cả bốn trường mà
 * không cần thêm cột nào vào HDI container dùng chung.
 *
 * Chỉ chạm dòng còn ở `reference` — ai đã sửa tay sang static rồi thì giữ nguyên,
 * đúng nguyên tắc idempotent của cả file này.
 */
async function upgradeDefectCodeToStatic(db: any): Promise<void> {
    const row = await db.run(
        SELECT.one.from(VALUE_HELPS)
            .columns('ID', 'sourceType')
            .where({ valueHelpID: VALUE_HELP_IDS.defectCode, objectType: DEFECT_OBJECT_TYPE }),
    );
    if (!row || row.sourceType !== 'reference') return;

    const seed = SEEDS.find((s) => s.valueHelpID === VALUE_HELP_IDS.defectCode)!;
    await db.run(
        UPDATE(VALUE_HELPS).set({
            sourceType: 'static',
            staticEntries: seed.staticEntries,
            returnMapping: seed.returnMapping,
            dependsOn: seed.dependsOn,
            description: seed.description,
            // Không còn đọc bảng nào nữa — xoá hẳn để không ai đọc nhầm cấu hình.
            referenceTable: null,
            keyColumn: null,
            textColumn: null,
        }).where({ ID: row.ID }),
    );
    LOG.info('Đã nâng DEFECT_CODE từ reference lên static (kèm defectClass và codeGroup)');
}

export const STANDARD_TEAM_DIRECTORY = [
    { partnerId: '100000', partnerName: 'Local Developer', functionTitle: '8D Team Leader & Quality Champion', partnerRole: '8D Team Leader', email: 'developer@proresolve.com', phone: '+49 89 2018 0000' },
    { partnerId: '100001', partnerName: 'Heli Weber', functionTitle: 'Quality Engineer & 8D Facilitator', partnerRole: '8D Team Leader', email: 'heli.weber@proresolve.com', phone: '+49 89 2018 0001' },
    { partnerId: '100011', partnerName: 'Quyen La', functionTitle: 'Quality Technician & Line Inspector', partnerRole: '8D Team Member', email: 'quyen.la@proresolve.com', phone: '+49 89 2018 0011' },
    { partnerId: '100012', partnerName: 'Minh Dinh', functionTitle: 'CNC Machining Process Engineer', partnerRole: '8D Team Member', email: 'minh.dinh@proresolve.com', phone: '+49 89 2018 0012' },
    { partnerId: '100014', partnerName: 'Karl Wagner', functionTitle: 'Maintenance Technician & Mechanical Specialist', partnerRole: '8D Team Member', email: 'karl.wagner@proresolve.com', phone: '+49 89 2018 0014' },
    { partnerId: '100023', partnerName: 'Luis Moreno', functionTitle: 'Foundry & Casting Process Engineer', partnerRole: '8D Team Member', email: 'luis.moreno@proresolve.com', phone: '+49 89 2018 0023' },
    { partnerId: '100031', partnerName: 'Sara Klein', functionTitle: 'Supplier Quality Engineer', partnerRole: '8D Team Member', email: 'sara.klein@proresolve.com', phone: '+49 89 2018 0031' },
    { partnerId: '100045', partnerName: 'Ingo Braun', functionTitle: 'Manufacturing & Assembly Engineer', partnerRole: '8D Team Member', email: 'ingo.braun@proresolve.com', phone: '+49 89 2018 0045' },
    { partnerId: '100052', partnerName: 'Petra Vogel', functionTitle: 'Document Control Officer', partnerRole: '8D Team Member', email: 'petra.vogel@proresolve.com', phone: '+49 89 2018 0052' },
    { partnerId: '100061', partnerName: 'Anh Pham', functionTitle: 'Tooling & Fixture Engineer', partnerRole: '8D Team Member', email: 'anh.pham@proresolve.com', phone: '+49 89 2018 0061' },
    { partnerId: '100067', partnerName: 'Marek Nowak', functionTitle: 'Process Engineer - Coating & Surface Treatment', partnerRole: '8D Team Member', email: 'marek.nowak@proresolve.com', phone: '+49 89 2018 0067' },
    { partnerId: '100072', partnerName: 'Stefan Wolf', functionTitle: 'Electrical & Controls Automation Technician', partnerRole: '8D Team Member', email: 'stefan.wolf@proresolve.com', phone: '+49 89 2018 0072' },
    { partnerId: '100088', partnerName: 'Rita Fischer', functionTitle: 'Assembly Supervisor', partnerRole: '8D Team Member', email: 'rita.fischer@proresolve.com', phone: '+49 89 2018 0088' },
    { partnerId: '100095', partnerName: 'Elena Rostova', functionTitle: 'Materials & Metallurgy Specialist', partnerRole: '8D Team Member', email: 'elena.rostova@proresolve.com', phone: '+49 89 2018 0095' },
    { partnerId: '100102', partnerName: 'Dario Conti', functionTitle: 'Bonding Process Engineer', partnerRole: '8D Team Member', email: 'dario.conti@proresolve.com', phone: '+49 89 2018 0102' },
    { partnerId: '100112', partnerName: 'Thomas Meyer', functionTitle: 'Mechanical Maintenance Technician', partnerRole: '8D Team Member', email: 'thomas.meyer@proresolve.com', phone: '+49 89 2018 0112' },
    { partnerId: '100115', partnerName: 'Eva Lindqvist', functionTitle: 'Facilities Engineer', partnerRole: '8D Team Member', email: 'eva.lindqvist@proresolve.com', phone: '+49 89 2018 0115' },
    { partnerId: '100125', partnerName: 'Christian Bauer', functionTitle: 'Powder Coating & Painting Specialist', partnerRole: '8D Team Member', email: 'christian.bauer@proresolve.com', phone: '+49 89 2018 0125' },
    { partnerId: '100133', partnerName: 'Ola Nyberg', functionTitle: 'Press Shop Engineer', partnerRole: '8D Team Member', email: 'ola.nyberg@proresolve.com', phone: '+49 89 2018 0133' },
    { partnerId: '100138', partnerName: 'Tobias Berg', functionTitle: 'Milling & Machining Specialist', partnerRole: '8D Team Member', email: 'tobias.berg@proresolve.com', phone: '+49 89 2018 0138' },
    { partnerId: '100147', partnerName: 'Lena Hoffmann', functionTitle: 'Metrology Specialist & CMM Inspector', partnerRole: '8D Team Member', email: 'lena.hoffmann@proresolve.com', phone: '+49 89 2018 0147' },
];

export async function seedStandardTeamDirectory(db: any): Promise<void> {
    try {
        const existing = await db.run(
            SELECT.from('cnma.proresolve.HistoricalTeamMembers').columns('partnerId'),
        );
        const have = new Set((existing as any[]).map((r) => String(r.partnerId ?? '').replace(/^BP-/i, '')));

        for (const member of STANDARD_TEAM_DIRECTORY) {
            if (!have.has(member.partnerId)) {
                await db.run(
                    INSERT.into('cnma.proresolve.HistoricalTeamMembers').entries({
                        ID: cds.utils.uuid(),
                        partnerId: member.partnerId,
                        partnerName: member.partnerName,
                        functionTitle: member.functionTitle,
                        partnerRole: member.partnerRole,
                        email: member.email,
                        phone: member.phone,
                    }),
                );
                have.add(member.partnerId);
            } else {
                await db.run(
                    UPDATE('cnma.proresolve.HistoricalTeamMembers').set({
                        partnerName: member.partnerName,
                        functionTitle: member.functionTitle,
                        email: member.email,
                        phone: member.phone,
                    }).where({ partnerId: member.partnerId }),
                );
            }
        }
        LOG.info(`Đã seed/cập nhật danh mục nhân sự chuẩn (${STANDARD_TEAM_DIRECTORY.length} hồ sơ chuyên môn)`);
    } catch (e: any) {
        LOG.warn(`Không seed được danh mục nhân sự chuẩn: ${e.message}`);
    }
}

/**
 * Tự động đảm bảo danh sách lỗi mẫu Q1, Q2, Q3 luôn sẵn sàng trong hệ thống
 * để kiểm thử tính năng tạo và phân tích 8D Report (Analyze Dialog).
 */
export async function seedSampleDefects(db: any): Promise<void> {
    try {
        const existing = await db.run(
            SELECT.from('cnma.proresolve.Defects').columns('defectId'),
        );
        const have = new Set((existing as any[]).map((r) => r.defectId));

        let addedCount = 0;
        for (const item of ADDITIONAL_Q_DEFECTS) {
            if (!have.has(item.defectId)) {
                await db.run(
                    INSERT.into('cnma.proresolve.Defects').entries({
                        ID: item.id,
                        defectId: item.defectId,
                        origin: item.origin,
                        status: item.status,
                        symptomShortText: item.symptomShortText,
                        foundDate: item.foundDate,
                        defectQuantity: item.defectQuantity,
                        defectQuantityUom: item.defectQuantityUom,
                        referenceNumber: item.referenceNumber,
                        plant: item.plant,
                        materialId: item.materialId,
                        materialDesc: item.materialDesc,
                        materialGroup: item.materialGroup,
                        batchId: item.batchId,
                        workCenterId: item.workCenterId,
                        workCenterDesc: item.workCenterDesc,
                        defectCodeGroup: item.defectCodeGroup,
                        defectCode: item.defectCode,
                        defectText: item.defectText,
                        defectClass: item.defectClass,
                        entryMode: item.entryMode,
                        inspectionLotId: item.inspectionLotId,
                        reportedBy: item.reportedBy,
                        coordinator: item.coordinator,
                        department: item.department,
                        complaintReference: item.complaintReference,
                        customerPlantContact: item.customerPlantContact,
                        slaResponseDue: item.slaResponseDue,
                    }),
                );

                for (const char of item.characteristics) {
                    await db.run(
                        INSERT.into('cnma.proresolve.DefectCharacteristics').entries({
                            ID: cds.utils.uuid(),
                            defect_ID: item.id,
                            lineNo: char.lineNo,
                            characteristic: char.characteristic,
                            measuredValue: char.measuredValue,
                            specLowerLimit: char.specLowerLimit ?? null,
                            specUpperLimit: char.specUpperLimit ?? null,
                            specUom: char.specUom ?? null,
                            valuation: char.valuation,
                            equipment: char.equipment ?? null,
                        }),
                    );
                }
                have.add(item.defectId);
                addedCount++;
            }
        }
        if (addedCount > 0) {
            LOG.info(`Đã seed ${addedCount} lỗi kiểm thử mẫu mới vào cnma.proresolve.Defects`);
        }
    } catch (e: any) {
        LOG.warn(`Không seed được danh mục lỗi kiểm thử mẫu: ${e.message}`);
    }
}

