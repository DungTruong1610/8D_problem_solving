import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const CLEAN_DIR = path.join(ROOT, 'mock-data', 'clean');
const DATA_DIR = path.join(ROOT, 'db', 'data');

function guid(idx) {
    const i = String(idx).padStart(12, '0');
    return `00000000-0000-0000-0000-${i}`;
}

function text(v) {
    if (v == null) return '';
    const s = String(v).trim();
    return s.replace(/;/g, ','); // tránh vỡ CSV dấu chấm phẩy
}

function parseLimit(str) {
    if (!str) return { lower: '', upper: '', uom: '' };
    const s = String(str).trim();

    // min 12.0 MPa -> lower=12.0
    const minMatch = s.match(/min\s*([0-9.]+)\s*(.*)/i);
    if (minMatch) {
        return { lower: minMatch[1], upper: '', uom: minMatch[2].trim() };
    }

    // max 0.10mm -> upper=0.10
    const maxMatch = s.match(/max\s*([0-9.]+)\s*(.*)/i);
    if (maxMatch) {
        return { lower: '', upper: maxMatch[1], uom: maxMatch[2].trim() };
    }

    // 0.15-0.30mm -> lower=0.15, upper=0.30
    const rangeMatch = s.match(/([0-9.]+)\s*-\s*([0-9.]+)\s*(.*)/);
    if (rangeMatch) {
        return { lower: rangeMatch[1], upper: rangeMatch[2], uom: rangeMatch[3].trim() };
    }

    // +/-0.05mm -> lower=-0.05, upper=0.05
    if (s.includes('+/-') || s.includes('±')) {
        const parts = s.split(/\+\/-|±/);
        if (parts.length === 2) {
            const center = parseFloat(parts[0]);
            const rest = parts[1].trim().match(/([0-9.]+)\s*(.*)/);
            if (rest) {
                const tol = parseFloat(rest[1]);
                return { lower: String(center - tol), upper: String(center + tol), uom: rest[2].trim() };
            }
        }
    }

    return { lower: '', upper: '', uom: '' };
}

console.log('Building Defects seed CSV from mock-data/clean...');

const files = fs.readdirSync(CLEAN_DIR).filter(f => f.startsWith('case-8D-') && f.endsWith('.json'));

const defects = [];
const characteristics = [];

let defectSeq = 1;
let charSeq = 1;
const now = '2026-03-01T00:00:00Z';

for (const file of files) {
    const raw = fs.readFileSync(path.join(CLEAN_DIR, file), 'utf-8');
    const caseData = JSON.parse(raw);

    const defectGuid = guid(defectSeq++);
    const defectId = caseData.notificationId || `8D-${10048000 + defectSeq}`;
    
    // Status: Một số case Open/InProcess, đa số Completed
    let status = caseData.status === 'Closed' ? 'Completed' : (caseData.status || 'InProcess');
    // Chuẩn hoá status theo DefectStatus enum: Open | InProcess | Completed
    if (status === 'Closed') status = 'Completed';
    if (!['Open', 'InProcess', 'Completed'].includes(status)) status = 'InProcess';

    const qtyMatch = (caseData.quantityExtent || '').match(/(\d+)/);
    const qty = qtyMatch ? qtyMatch[1] : '';

    defects.push({
        ID: defectGuid,
        createdAt: now,
        createdBy: 'seed-script',
        modifiedAt: now,
        modifiedBy: 'seed-script',
        defectId: defectId,
        origin: text(caseData.origin || 'Q1 - Customer Complaint'),
        status: status,
        symptomShortText: text(caseData.symptomShortText),
        foundDate: text(caseData.foundDate),
        completionDate: text(caseData.completionDate),
        defectQuantity: qty,
        defectQuantityUom: 'PCE',
        referenceNumber: text(caseData.referenceNumber || caseData.notificationId),
        plant: text(caseData.material?.plant || '1000'),
        materialId: text(caseData.material?.materialId),
        materialDesc: text(caseData.material?.description),
        materialGroup: text(caseData.material?.materialGroup),
        batchId: text(caseData.batch?.batchId),
        workCenterId: text(caseData.workCenter?.workCenterId),
        workCenterDesc: text(caseData.workCenter?.description),
        defectCodeGroup: text(caseData.defect?.defectCodeGroup || 'DEF-GENERIC'),
        defectCode: text(caseData.defect?.defectCode),
        defectText: text(caseData.defect?.defectText),
        defectClass: text(caseData.defect?.defectClass || 'Major'),
        entryMode: caseData.inspections?.length ? 'during-inspection' : 'outside-inspection',
        inspectionLotId: text(caseData.inspectionLotId),
        reportedBy: text(caseData.responsibility?.reportedBy || 'Quality Inspector'),
        coordinator: text(caseData.responsibility?.coordinator || 'Quality Engineer'),
        department: text(caseData.responsibility?.department || 'Quality Assurance'),
        complaintReference: text(caseData.customerReference?.complaintReference),
        customerPlantContact: text(caseData.customerReference?.customerPlantContact),
        slaResponseDue: text(caseData.customerReference?.slaResponseDue),
    });

    if (Array.isArray(caseData.inspections)) {
        let lineNo = 1;
        for (const insp of caseData.inspections) {
            const charGuid = guid(10000 + charSeq++);
            const parsedSpec = parseLimit(insp.specValue);

            characteristics.push({
                ID: charGuid,
                createdAt: now,
                createdBy: 'seed-script',
                modifiedAt: now,
                modifiedBy: 'seed-script',
                defect_ID: defectGuid,
                lineNo: lineNo++,
                characteristic: text(insp.characteristic),
                measuredValue: text(insp.measuredValue),
                specLowerLimit: parsedSpec.lower,
                specUpperLimit: parsedSpec.upper,
                specUom: parsedSpec.uom,
                valuation: insp.valuation || (insp.measuredValue?.includes('PASS') ? 'Accepted' : 'Rejected'),
                equipment: text(insp.equipment || caseData.workCenter?.workCenterId || '')
            });
        }
    }
}

// 1. Write cnma.proresolve-Defects.csv
const defectCols = [
    'ID', 'createdAt', 'createdBy', 'modifiedAt', 'modifiedBy', 'defectId', 'origin', 'status',
    'symptomShortText', 'foundDate', 'completionDate', 'defectQuantity', 'defectQuantityUom',
    'referenceNumber', 'plant', 'materialId', 'materialDesc', 'materialGroup', 'batchId',
    'workCenterId', 'workCenterDesc', 'defectCodeGroup', 'defectCode', 'defectText', 'defectClass',
    'entryMode', 'inspectionLotId', 'reportedBy', 'coordinator', 'department',
    'complaintReference', 'customerPlantContact', 'slaResponseDue'
];

const defectLines = [
    defectCols.join(';'),
    ...defects.map(d => defectCols.map(col => d[col] ?? '').join(';'))
];

const defectsCsvPath = path.join(DATA_DIR, 'cnma.proresolve-Defects.csv');
fs.writeFileSync(defectsCsvPath, defectLines.join('\n'), 'utf-8');
console.log(`Generated ${defects.length} defect records -> ${defectsCsvPath}`);

// 2. Write cnma.proresolve-DefectCharacteristics.csv
const charCols = [
    'ID', 'createdAt', 'createdBy', 'modifiedAt', 'modifiedBy', 'defect_ID', 'lineNo',
    'characteristic', 'measuredValue', 'specLowerLimit', 'specUpperLimit', 'specUom',
    'valuation', 'equipment'
];

const charLines = [
    charCols.join(';'),
    ...characteristics.map(c => charCols.map(col => c[col] ?? '').join(';'))
];

const charCsvPath = path.join(DATA_DIR, 'cnma.proresolve-DefectCharacteristics.csv');
fs.writeFileSync(charCsvPath, charLines.join('\n'), 'utf-8');
console.log(`Generated ${characteristics.length} defect characteristic records -> ${charCsvPath}`);
