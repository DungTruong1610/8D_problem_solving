import fs from 'fs';

function guid(prefix, idx) {
    const p = String(prefix).padStart(8, '0');
    const i = String(idx).padStart(12, '0');
    return `${p}-0000-0000-0000-${i}`;
}

const inspectionLots = [];
let lotSeq = 1;
let itemSeq = 1;

/**
 * Work center của một fixture: 'WC-MILL-07-F1' → 'WC-MILL-07'.
 *
 * Quy ước đặt tên là của CHÍNH file này — mọi mã equipment dưới đây được viết ra
 * theo dạng `<work center>-<fixture>`. Nên tách ở đây là đọc lại thứ ta vừa ghép,
 * không phải đoán. Chỗ ĐOÁN là màn hình Inspection Lots, nơi cùng phép cắt này
 * chạy trên dữ liệu bất kỳ kèm giá trị dự phòng cứng — cột `workCenterId` sinh ra
 * để màn hình đó thôi phải đoán.
 */
function workCenterOf(equipment) {
    return equipment.split('-').slice(0, 3).join('-');
}

function addLotPair(prefix, matId, char, eqBad, valBad, eqGood, valGood, unit, dateBase = '2026-02') {
    // 3 lots bad (100% non-conforming on eqBad)
    for (let i = 1; i <= 3; i++) {
        const lotNum = String(10000000 + lotSeq++).padStart(10, '0');
        const d = String(i + 9).padStart(2, '0');
        inspectionLots.push({
            ID: guid(prefix, itemSeq++),
            lotId: lotNum,
            materialId: matId,
            characteristic: char,
            equipment: eqBad,
            workCenterId: workCenterOf(eqBad),
            measuredValue: `${valBad} ${unit}`.trim(),
            unit: unit,
            conforming: 'false',
            lotDate: `${dateBase}-${d}`,
            plant: '1000'
        });
    }
    // 3 lots good (0% non-conforming on eqGood)
    for (let i = 1; i <= 3; i++) {
        const lotNum = String(10000000 + lotSeq++).padStart(10, '0');
        const d = String(i + 4).padStart(2, '0');
        inspectionLots.push({
            ID: guid(prefix, itemSeq++),
            lotId: lotNum,
            materialId: matId,
            characteristic: char,
            equipment: eqGood,
            workCenterId: workCenterOf(eqGood),
            measuredValue: `${valGood} ${unit}`.trim(),
            unit: unit,
            conforming: 'true',
            lotDate: `${dateBase}-${d}`,
            plant: '1000'
        });
    }
}

// 1. MAT-10247 (Bracket Housing X240)
addLotPair(1, 'MAT-10247', 'Flange burr height', 'WC-MILL-07-F1', '0.32', 'WC-MILL-07-F2', '0.04', 'mm');
addLotPair(1, 'MAT-10247', 'Pocket depth', 'WC-MILL-07-F1', '12.84', 'WC-MILL-07-F2', '13.00', 'mm');

// 2. MAT-11500 (Sprocket Hub H22)
addLotPair(2, 'MAT-11500', 'Ridge height at bore mouth', 'WC-BROACH-01-B1', '0.25', 'WC-BROACH-01-B2', '0.02', 'mm');

// 3. MAT-10318 (Pump Housing P90)
addLotPair(3, 'MAT-10318', 'Porosity area ratio', 'WC-CAST-03-DIE1', '12.5', 'WC-CAST-03-DIE2', '2.2', '%');
addLotPair(3, 'MAT-10318', 'Helium leak rate', 'WC-CAST-03-DIE1', '14.2', 'WC-CAST-03-DIE2', '2.1', 'mbar*l/s');

// 4. MAT-10402 (Drive Shaft S150)
addLotPair(4, 'MAT-10402', 'Outer diameter', 'WC-TURN-02-L1', '24.912', 'WC-TURN-02-L2', '24.985', 'mm');
addLotPair(4, 'MAT-10402', 'Surface roughness Ra', 'WC-TURN-02-L1', '2.2', 'WC-TURN-02-L2', '0.6', 'um');

// 5. MAT-10555 (Housing Cover C80)
addLotPair(5, 'MAT-10555', 'Coating thickness', 'WC-COAT-05-GUN1', '38', 'WC-COAT-05-GUN2', '75', 'um');

// 6. MAT-10611 (Gearbox End Cap G45)
addLotPair(6, 'MAT-10611', 'Bolt seating torque', 'WC-ASSY-08-SPINDLE1', '18', 'WC-ASSY-08-SPINDLE2', '36', 'Nm');

// 7. MAT-10744 (Sensor Mount Bracket S22)
addLotPair(7, 'MAT-10744', 'Lap shear strength', 'WC-BOND-02-DISPENSER1', '4.1', 'WC-BOND-02-DISPENSER2', '14.5', 'MPa');

// 8. MAT-10820 (Rotor Shaft R60)
addLotPair(8, 'MAT-10820', 'Surface roughness Ra', 'WC-GRIND-04-WHEEL1', '2.8', 'WC-GRIND-04-WHEEL2', '0.5', 'um');
addLotPair(8, 'MAT-10820', 'Roundness', 'WC-GRIND-04-WHEEL1', '0.014', 'WC-GRIND-04-WHEEL2', '0.003', 'mm');

// 9. MAT-10905 (Manifold Block M12)
addLotPair(9, 'MAT-10905', 'Thread depth', 'WC-MILL-07-TAP1', '9.2', 'WC-MILL-07-TAP2', '15.0', 'mm');

// 10. MAT-11002 (Spring Retainer SR8)
addLotPair(10, 'MAT-11002', 'Material hardness', 'WC-PRESS-09-TOOL1', '214', 'WC-PRESS-09-TOOL2', '145', 'HV');

// 11. MAT-11130 (Bearing Cap BC14)
addLotPair(11, 'MAT-11130', 'Bore true position', 'WC-MILL-11-F1', '0.19', 'WC-MILL-11-F2', '0.04', 'mm');

// 12. MAT-11388 (Trim Panel T18)
addLotPair(12, 'MAT-11388', 'Gloss 60 degree', 'WC-PAINT-03-ROBOT1', '71', 'WC-PAINT-03-ROBOT2', '86', 'GU');

// 13. MAT-88410 (High-Pressure Fuel Regulator Housing Valve - demo case)
addLotPair(13, 'MAT-88410', 'Helium Leak Rate at 8.0 bar test pressure', 'WC-TEST-03-CHAMBER1', '1.45', 'WC-TEST-03-CHAMBER2', '0.08', 'sccm');
addLotPair(13, 'MAT-88410', 'O-ring sealing seat surface roughness (Ra)', 'WC-TEST-03-CHAMBER1', '1.85', 'WC-TEST-03-CHAMBER2', '0.35', 'um');

// Write InspectionLots.csv
const inspHeader = 'ID;lotId;materialId;characteristic;equipment;workCenterId;measuredValue;unit;conforming;lotDate;plant';
const inspLines = [
    inspHeader,
    ...inspectionLots.map(r => `${r.ID};${r.lotId};${r.materialId};${r.characteristic};${r.equipment};${r.workCenterId};${r.measuredValue};${r.unit};${r.conforming};${r.lotDate};${r.plant}`)
];
fs.writeFileSync('db/data/cnma.proresolve-InspectionLots.csv', inspLines.join('\n'), 'utf-8');
console.log(`Generated ${inspectionLots.length} inspection lot rows.`);

// FMEA Register
const fmeaList = [
    { ID: guid(100, 1), fmeaId: 'FMEA-MILL-2024', workCenterId: 'WC-MILL-07', materialId: 'MAT-10247', description: 'Process FMEA for CNC Milling Operations (Flange & Pocket Machining)' },
    { ID: guid(100, 2), fmeaId: 'FMEA-BROACH-2024', workCenterId: 'WC-BROACH-01', materialId: 'MAT-11500', description: 'Process FMEA for Sprocket Hub Broaching & Bore Deburring' },
    { ID: guid(100, 3), fmeaId: 'FMEA-CAST-2024', workCenterId: 'WC-CAST-03', materialId: 'MAT-10318', description: 'Process FMEA for Aluminium High Pressure Die Casting' },
    { ID: guid(100, 4), fmeaId: 'FMEA-TURN-2024', workCenterId: 'WC-TURN-02', materialId: 'MAT-10402', description: 'Process FMEA for CNC Lathe Shaft Turning & Finish Tolerance' },
    { ID: guid(100, 5), fmeaId: 'FMEA-COAT-2024', workCenterId: 'WC-COAT-05', materialId: 'MAT-10555', description: 'Process FMEA for Electrostatic Powder Coating & Curing' },
    { ID: guid(100, 6), fmeaId: 'FMEA-ASSY-2024', workCenterId: 'WC-ASSY-08', materialId: 'MAT-10611', description: 'Process FMEA for Gearbox End Cap Automated Torque Assembly' },
    { ID: guid(100, 7), fmeaId: 'FMEA-BOND-2024', workCenterId: 'WC-BOND-02', materialId: 'MAT-10744', description: 'Process FMEA for Structural Adhesive Dispensing & Curing' },
    { ID: guid(100, 8), fmeaId: 'FMEA-GRIND-2024', workCenterId: 'WC-GRIND-04', materialId: 'MAT-10820', description: 'Process FMEA for Cylindrical Grinding & Surface Finish' },
    { ID: guid(100, 9), fmeaId: 'FMEA-PRESS-2024', workCenterId: 'WC-PRESS-09', materialId: 'MAT-11002', description: 'Process FMEA for Progressive Stamping, Forming & Annealing' },
    { ID: guid(100, 10), fmeaId: 'FMEA-MILL11-2024', workCenterId: 'WC-MILL-11', materialId: 'MAT-11130', description: 'Process FMEA for Bearing Cap High-Precision Boring' },
    { ID: guid(100, 11), fmeaId: 'FMEA-PAINT-2024', workCenterId: 'WC-PAINT-03', materialId: 'MAT-11388', description: 'Process FMEA for Automotive Trim Robotic Painting & Gloss' },
    { ID: guid(100, 12), fmeaId: 'FMEA-TEST-2024', workCenterId: 'WC-TEST-03', materialId: 'MAT-88410', description: 'Process FMEA for High-Pressure Fuel Regulator Leak & Pressure Testing' },
];

const fmeaHeader = 'ID;fmeaId;workCenterId;materialId;description';
const fmeaLines = [
    fmeaHeader,
    ...fmeaList.map(r => `${r.ID};${r.fmeaId};${r.workCenterId};${r.materialId};${r.description}`)
];
fs.writeFileSync('db/data/cnma.proresolve-FmeaRegister.csv', fmeaLines.join('\n'), 'utf-8');
console.log(`Generated ${fmeaList.length} FMEA register rows.`);
