// @ts-nocheck
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface DefectSeed {
    id: string;
    defectId: string;
    origin: 'Q1 - Customer Complaint' | 'Q2 - Supplier Defect' | 'Q3 - Internal Defect';
    status: 'Open' | 'In Process';
    symptomShortText: string;
    foundDate: string;
    defectQuantity: number;
    defectQuantityUom: string;
    referenceNumber: string;
    plant: string;
    materialId: string;
    materialDesc: string;
    materialGroup: string;
    batchId: string;
    workCenterId: string;
    workCenterDesc: string;
    defectCodeGroup: string;
    defectCode: string;
    defectText: string;
    defectClass: string;
    entryMode: string;
    inspectionLotId: string | null;
    reportedBy: string;
    coordinator: string;
    department: string;
    complaintReference: string;
    customerPlantContact: string;
    slaResponseDue: string;
    characteristics: Array<{
        lineNo: number;
        characteristic: string;
        measuredValue: string;
        specLowerLimit?: number | null;
        specUpperLimit?: number | null;
        specUom?: string | null;
        valuation: string;
        equipment?: string | null;
    }>;
}

export const ADDITIONAL_Q_DEFECTS: DefectSeed[] = [
    // ── Q1: Customer Complaints ──────────────────────────────────────────────
    {
        id: '10000000-0000-0000-0000-000000000201',
        defectId: '8D-10049201',
        origin: 'Q1 - Customer Complaint',
        status: 'Open',
        symptomShortText: 'Customer Tier-1 assembly reported excessive burr and oil contamination on mounting bracket face',
        foundDate: '2026-09-18',
        defectQuantity: 185,
        defectQuantityUom: 'PCE',
        referenceNumber: 'CC-2026-1022',
        plant: '1000',
        materialId: 'MAT-10247',
        materialDesc: 'Bracket Housing X240',
        materialGroup: 'MG-HOUSING',
        batchId: 'B-50810',
        workCenterId: 'WC-MILL-07',
        workCenterDesc: 'CNC 5-Axis Milling Center 7',
        defectCodeGroup: 'DEF-GENERIC',
        defectCode: 'DEF-0489',
        defectText: 'Flange edge burr above limit',
        defectClass: 'Major',
        entryMode: 'outside-inspection',
        inspectionLotId: null,
        reportedBy: 'Customer Quality Manager',
        coordinator: 'Heli Weber',
        department: 'Quality Assurance',
        complaintReference: 'CC-2026-1022',
        customerPlantContact: 'David Miller - BMW Dingolfing, Chassis Line 2',
        slaResponseDue: '2026-09-25',
        characteristics: [
            {
                lineNo: 1,
                characteristic: 'Flange burr height',
                measuredValue: '0.28mm',
                specLowerLimit: null,
                specUpperLimit: 0.10,
                specUom: 'mm',
                valuation: 'Rejected',
                equipment: 'WC-MILL-07',
            },
            {
                lineNo: 2,
                characteristic: 'Flange flatness',
                measuredValue: '0.08mm',
                specLowerLimit: null,
                specUpperLimit: 0.05,
                specUom: 'mm',
                valuation: 'Rejected',
                equipment: 'WC-MILL-07',
            },
        ],
    },
    {
        id: '10000000-0000-0000-0000-000000000202',
        defectId: '8D-10049202',
        origin: 'Q1 - Customer Complaint',
        status: 'Open',
        symptomShortText: 'Customer reported powder coating peeling and flaking around hinge pin boss',
        foundDate: '2026-09-19',
        defectQuantity: 92,
        defectQuantityUom: 'PCE',
        referenceNumber: 'CC-2026-1035',
        plant: '1000',
        materialId: 'MAT-10555',
        materialDesc: 'Housing Cover C80',
        materialGroup: 'MG-HOUSING',
        batchId: 'B-50825',
        workCenterId: 'WC-COAT-05',
        workCenterDesc: 'Powder Coating Line 5',
        defectCodeGroup: 'DEF-GENERIC',
        defectCode: 'DEF-0601',
        defectText: 'Coating layer peeling',
        defectClass: 'Major',
        entryMode: 'outside-inspection',
        inspectionLotId: null,
        reportedBy: 'Customer Field Engineer',
        coordinator: 'Marek Nowak',
        department: 'Quality Assurance',
        complaintReference: 'CC-2026-1035',
        customerPlantContact: 'Elena Rossi - Ferrari Maranello, Body Shop',
        slaResponseDue: '2026-09-26',
        characteristics: [
            {
                lineNo: 1,
                characteristic: 'Coating layer thickness',
                measuredValue: '34um',
                specLowerLimit: 60.0,
                specUpperLimit: 90.0,
                specUom: 'um',
                valuation: 'Rejected',
                equipment: 'WC-COAT-05',
            },
            {
                lineNo: 2,
                characteristic: 'Cross-cut adhesion test',
                measuredValue: 'Class 4B',
                specLowerLimit: null,
                specUpperLimit: 1.0,
                specUom: 'Class',
                valuation: 'Rejected',
                equipment: 'WC-COAT-05',
            },
        ],
    },
    {
        id: '10000000-0000-0000-0000-000000000203',
        defectId: '8D-10049203',
        origin: 'Q1 - Customer Complaint',
        status: 'Open',
        symptomShortText: 'Customer engine assembly detected coolant leakage through porous cast cylinder boss',
        foundDate: '2026-09-20',
        defectQuantity: 45,
        defectQuantityUom: 'PCE',
        referenceNumber: 'CC-2026-1048',
        plant: '1000',
        materialId: 'MAT-10318',
        materialDesc: 'Pump Housing P90',
        materialGroup: 'MG-HOUSING',
        batchId: 'B-50840',
        workCenterId: 'WC-CAST-03',
        workCenterDesc: 'Aluminium Die Casting Line 3',
        defectCodeGroup: 'DEF-GENERIC',
        defectCode: 'DEF-0512',
        defectText: 'Porosity at sealing flange face',
        defectClass: 'Critical',
        entryMode: 'outside-inspection',
        inspectionLotId: null,
        reportedBy: 'Warranty Investigation Engineer',
        coordinator: 'Heli Weber',
        department: 'Quality Assurance',
        complaintReference: 'CC-2026-1048',
        customerPlantContact: 'Klaus Lindemann - Porsche Zuffenhausen Engine Plant',
        slaResponseDue: '2026-09-24',
        characteristics: [
            {
                lineNo: 1,
                characteristic: 'Pressure test leak rate',
                measuredValue: '18.5 mbar*l/s',
                specLowerLimit: null,
                specUpperLimit: 5.0,
                specUom: 'mbar*l/s',
                valuation: 'Rejected',
                equipment: 'WC-CAST-03',
            },
            {
                lineNo: 2,
                characteristic: 'Porosity pore size',
                measuredValue: '0.85mm',
                specLowerLimit: null,
                specUpperLimit: 0.20,
                specUom: 'mm',
                valuation: 'Rejected',
                equipment: 'WC-CAST-03',
            },
        ],
    },

    // ── Q2: Supplier Defects ─────────────────────────────────────────────────
    {
        id: '10000000-0000-0000-0000-000000000210',
        defectId: '8D-10049210',
        origin: 'Q2 - Supplier Defect',
        status: 'Open',
        symptomShortText: 'Incoming raw aluminum casting blanks received from Supplier CastTech with severe shrinkage porosity',
        foundDate: '2026-09-17',
        defectQuantity: 240,
        defectQuantityUom: 'PCE',
        referenceNumber: 'PO-882910-SUP',
        plant: '1000',
        materialId: 'MAT-10318',
        materialDesc: 'Pump Housing P90',
        materialGroup: 'MG-HOUSING',
        batchId: 'SUP-CT-2026-09',
        workCenterId: 'WC-INSP-01',
        workCenterDesc: 'Incoming Goods Inspection 1',
        defectCodeGroup: 'DEF-GENERIC',
        defectCode: 'DEF-0512',
        defectText: 'Porosity at sealing flange face',
        defectClass: 'Major',
        entryMode: 'during-inspection',
        inspectionLotId: '040000001001',
        reportedBy: 'Incoming QA Inspector',
        coordinator: 'Karl Wagner',
        department: 'Incoming Quality Inspection',
        complaintReference: 'N/A - supplier defect, no customer reference',
        customerPlantContact: 'N/A',
        slaResponseDue: 'N/A',
        characteristics: [
            {
                lineNo: 1,
                characteristic: 'Porosity area ratio',
                measuredValue: '4.8%',
                specLowerLimit: null,
                specUpperLimit: 1.0,
                specUom: '%',
                valuation: 'Rejected',
                equipment: 'WC-INSP-01',
            },
            {
                lineNo: 2,
                characteristic: 'Material tensile strength',
                measuredValue: '182 MPa',
                specLowerLimit: 240.0,
                specUpperLimit: null,
                specUom: 'MPa',
                valuation: 'Rejected',
                equipment: 'WC-INSP-01',
            },
        ],
    },
    {
        id: '10000000-0000-0000-0000-000000000211',
        defectId: '8D-10049211',
        origin: 'Q2 - Supplier Defect',
        status: 'Open',
        symptomShortText: 'Cold-rolled steel coils from Supplier SteelCorp showing wavy edges and surface micro-cracks',
        foundDate: '2026-09-19',
        defectQuantity: 520,
        defectQuantityUom: 'PCE',
        referenceNumber: 'PO-883104-SUP',
        plant: '1000',
        materialId: 'MAT-10620',
        materialDesc: 'Stamping Bracket SB-12',
        materialGroup: 'MG-BRACKET',
        batchId: 'SUP-SC-55210',
        workCenterId: 'WC-INSP-01',
        workCenterDesc: 'Incoming Goods Inspection 1',
        defectCodeGroup: 'DEF-GENERIC',
        defectCode: 'DEF-0318',
        defectText: 'Excessive burr and edge micro-cracks on stamped sheet',
        defectClass: 'Major',
        entryMode: 'during-inspection',
        inspectionLotId: '040000001002',
        reportedBy: 'Incoming QA Inspector',
        coordinator: 'Karl Wagner',
        department: 'Incoming Quality Inspection',
        complaintReference: 'N/A - supplier defect, no customer reference',
        customerPlantContact: 'N/A',
        slaResponseDue: 'N/A',
        characteristics: [
            {
                lineNo: 1,
                characteristic: 'Sheet thickness deviation',
                measuredValue: '1.68mm',
                specLowerLimit: 1.45,
                specUpperLimit: 1.55,
                specUom: 'mm',
                valuation: 'Rejected',
                equipment: 'WC-INSP-01',
            },
            {
                lineNo: 2,
                characteristic: 'Material Vickers hardness',
                measuredValue: '205 HV',
                specLowerLimit: null,
                specUpperLimit: 160.0,
                specUom: 'HV',
                valuation: 'Rejected',
                equipment: 'WC-INSP-01',
            },
        ],
    },
    {
        id: '10000000-0000-0000-0000-000000000212',
        defectId: '8D-10049212',
        origin: 'Q2 - Supplier Defect',
        status: 'Open',
        symptomShortText: 'Forged shaft blanks delivered by ForgingTech showing excessive radial runout and surface seams',
        foundDate: '2026-09-20',
        defectQuantity: 110,
        defectQuantityUom: 'PCE',
        referenceNumber: 'PO-883550-SUP',
        plant: '1000',
        materialId: 'MAT-10820',
        materialDesc: 'Rotor Shaft R60',
        materialGroup: 'MG-SHAFT',
        batchId: 'SUP-FT-8812',
        workCenterId: 'WC-INSP-01',
        workCenterDesc: 'Incoming Goods Inspection 1',
        defectCodeGroup: 'DEF-GENERIC',
        defectCode: 'DEF-0902',
        defectText: 'Chatter marks on ground surface',
        defectClass: 'Major',
        entryMode: 'during-inspection',
        inspectionLotId: '040000001003',
        reportedBy: 'Incoming QA Inspector',
        coordinator: 'Karl Wagner',
        department: 'Incoming Quality Inspection',
        complaintReference: 'N/A - supplier defect, no customer reference',
        customerPlantContact: 'N/A',
        slaResponseDue: 'N/A',
        characteristics: [
            {
                lineNo: 1,
                characteristic: 'Total radial runout',
                measuredValue: '0.16mm',
                specLowerLimit: null,
                specUpperLimit: 0.04,
                specUom: 'mm',
                valuation: 'Rejected',
                equipment: 'WC-INSP-01',
            },
            {
                lineNo: 2,
                characteristic: 'Surface inclusion level',
                measuredValue: 'Level 3.5',
                specLowerLimit: null,
                specUpperLimit: 1.0,
                specUom: 'Level',
                valuation: 'Rejected',
                equipment: 'WC-INSP-01',
            },
        ],
    },

    // ── Q3: Internal Factory Defects ─────────────────────────────────────────
    {
        id: '10000000-0000-0000-0000-000000000220',
        defectId: '8D-10049220',
        origin: 'Q3 - Internal Defect',
        status: 'Open',
        symptomShortText: 'CNC 5-Axis milling station WC-MILL-07 generated excessive flange chatter marks Ra 3.4um',
        foundDate: '2026-09-18',
        defectQuantity: 68,
        defectQuantityUom: 'PCE',
        referenceNumber: '8D-10049220',
        plant: '1000',
        materialId: 'MAT-10247',
        materialDesc: 'Bracket Housing X240',
        materialGroup: 'MG-HOUSING',
        batchId: 'B-50901',
        workCenterId: 'WC-MILL-07',
        workCenterDesc: 'CNC 5-Axis Milling Center 7',
        defectCodeGroup: 'DEF-GENERIC',
        defectCode: 'DEF-0104',
        defectText: 'Chatter marks and surface waviness on milled flange',
        defectClass: 'Major',
        entryMode: 'during-inspection',
        inspectionLotId: '010000008801',
        reportedBy: 'Shift Quality Inspector',
        coordinator: 'Minh Dinh',
        department: 'Quality Assurance',
        complaintReference: 'N/A - internal defect, no customer reference',
        customerPlantContact: 'N/A',
        slaResponseDue: 'N/A',
        characteristics: [
            {
                lineNo: 1,
                characteristic: 'Surface roughness Ra',
                measuredValue: '3.4um',
                specLowerLimit: null,
                specUpperLimit: 0.8,
                specUom: 'um',
                valuation: 'Rejected',
                equipment: 'WC-MILL-07',
            },
            {
                lineNo: 2,
                characteristic: 'Spindle vibration amplitude',
                measuredValue: '5.2mm/s',
                specLowerLimit: null,
                specUpperLimit: 1.5,
                specUom: 'mm/s',
                valuation: 'Rejected',
                equipment: 'WC-MILL-07',
            },
        ],
    },
    {
        id: '10000000-0000-0000-0000-000000000221',
        defectId: '8D-10049221',
        origin: 'Q3 - Internal Defect',
        status: 'Open',
        symptomShortText: 'CNC Lathe station WC-TURN-02 tool insert breakdown caused shaft diameter taper 0.024mm',
        foundDate: '2026-09-19',
        defectQuantity: 145,
        defectQuantityUom: 'PCE',
        referenceNumber: '8D-10049221',
        plant: '1000',
        materialId: 'MAT-10402',
        materialDesc: 'Drive Shaft S150',
        materialGroup: 'MG-SHAFT',
        batchId: 'B-50915',
        workCenterId: 'WC-TURN-02',
        workCenterDesc: 'CNC Turning Cell 2',
        defectCodeGroup: 'DEF-GENERIC',
        defectCode: 'DEF-0220',
        defectText: 'Outer diameter taper out of tolerance on CNC lathe',
        defectClass: 'Major',
        entryMode: 'during-inspection',
        inspectionLotId: '010000008802',
        reportedBy: 'CNC Cell Operator',
        coordinator: 'Minh Dinh',
        department: 'Machining Operations',
        complaintReference: 'N/A - internal defect, no customer reference',
        customerPlantContact: 'N/A',
        slaResponseDue: 'N/A',
        characteristics: [
            {
                lineNo: 1,
                characteristic: 'Shaft diameter D1',
                measuredValue: '24.932mm',
                specLowerLimit: 24.950,
                specUpperLimit: 25.000,
                specUom: 'mm',
                valuation: 'Rejected',
                equipment: 'WC-TURN-02',
            },
            {
                lineNo: 2,
                characteristic: 'Taper deviation along length',
                measuredValue: '0.024mm',
                specLowerLimit: null,
                specUpperLimit: 0.010,
                specUom: 'mm',
                valuation: 'Rejected',
                equipment: 'WC-TURN-02',
            },
        ],
    },
    {
        id: '10000000-0000-0000-0000-000000000222',
        defectId: '8D-10049222',
        origin: 'Q3 - Internal Defect',
        status: 'Open',
        symptomShortText: 'Automated assembly station WC-ASSY-05 screwdriving stripped internal plastic threads',
        foundDate: '2026-09-20',
        defectQuantity: 58,
        defectQuantityUom: 'PCE',
        referenceNumber: '8D-10049222',
        plant: '1000',
        materialId: 'MAT-10950',
        materialDesc: 'Pump Motor Assembly PMA-30',
        materialGroup: 'MG-ASSEMBLY',
        batchId: 'B-50930',
        workCenterId: 'WC-ASSY-05',
        workCenterDesc: 'Automated Sub-Assembly Station 5',
        defectCodeGroup: 'DEF-GENERIC',
        defectCode: 'DEF-0630',
        defectText: 'Stripped plastic thread boss during automated screwdriving',
        defectClass: 'Major',
        entryMode: 'during-inspection',
        inspectionLotId: '010000008803',
        reportedBy: 'Assembly Line Leader',
        coordinator: 'Sophie Martin',
        department: 'Final Assembly',
        complaintReference: 'N/A - internal defect, no customer reference',
        customerPlantContact: 'N/A',
        slaResponseDue: 'N/A',
        characteristics: [
            {
                lineNo: 1,
                characteristic: 'Fastener rundown torque',
                measuredValue: '0.75 Nm',
                specLowerLimit: 1.80,
                specUpperLimit: 2.20,
                specUom: 'Nm',
                valuation: 'Rejected',
                equipment: 'WC-ASSY-05',
            },
            {
                lineNo: 2,
                characteristic: 'Screw angle rotation',
                measuredValue: '750 deg',
                specLowerLimit: 360.0,
                specUpperLimit: 480.0,
                specUom: 'deg',
                valuation: 'Rejected',
                equipment: 'WC-ASSY-05',
            },
        ],
    },
    {
        id: '10000000-0000-0000-0000-000000000223',
        defectId: '8D-10049223',
        origin: 'Q3 - Internal Defect',
        status: 'Open',
        symptomShortText: 'Precision grinding cell WC-GRIND-01 coolant blockage caused severe thermal grinding burn on rail',
        foundDate: '2026-09-21',
        defectQuantity: 34,
        defectQuantityUom: 'PCE',
        referenceNumber: '8D-10049223',
        plant: '1000',
        materialId: 'MAT-11280',
        materialDesc: 'Guide Rail GR-200',
        materialGroup: 'MG-LINEAR',
        batchId: 'B-50945',
        workCenterId: 'WC-GRIND-01',
        workCenterDesc: 'CNC Precision Surface Grinder 1',
        defectCodeGroup: 'DEF-GENERIC',
        defectCode: 'DEF-1140',
        defectText: 'Grinding burn and micro-cracks on precision linear guideway',
        defectClass: 'Critical',
        entryMode: 'during-inspection',
        inspectionLotId: '010000008804',
        reportedBy: 'Metrology Lab Specialist',
        coordinator: 'Lena Hoffmann',
        department: 'Quality Assurance',
        complaintReference: 'N/A - internal defect, no customer reference',
        customerPlantContact: 'N/A',
        slaResponseDue: 'N/A',
        characteristics: [
            {
                lineNo: 1,
                characteristic: 'Surface residual tensile stress',
                measuredValue: '+480 MPa',
                specLowerLimit: null,
                specUpperLimit: 0.0,
                specUom: 'MPa',
                valuation: 'Rejected',
                equipment: 'WC-GRIND-01',
            },
            {
                lineNo: 2,
                characteristic: 'Nital etch indication',
                measuredValue: 'Level 4 Dark temper burn',
                specLowerLimit: null,
                specUpperLimit: 0.0,
                specUom: 'Level',
                valuation: 'Rejected',
                equipment: 'WC-GRIND-01',
            },
        ],
    },
];

export function seedQDefects(): void {
    const dbPath = path.resolve('db.sqlite');
    if (!fs.existsSync(dbPath)) {
        console.error('db.sqlite not found!');
        return;
    }
    const db = new Database(dbPath);

    const checkStmt = db.prepare('SELECT defectId FROM cnma_proresolve_Defects WHERE defectId = ?');
    const insertDefectStmt = db.prepare(`
        INSERT INTO cnma_proresolve_Defects (
            ID, createdAt, createdBy, modifiedAt, modifiedBy,
            defectId, origin, status, symptomShortText, foundDate, completionDate,
            defectQuantity, defectQuantityUom, referenceNumber, plant,
            materialId, materialDesc, materialGroup, batchId,
            workCenterId, workCenterDesc, defectCodeGroup, defectCode, defectText,
            defectClass, entryMode, inspectionLotId, reportedBy, coordinator,
            department, complaintReference, customerPlantContact, slaResponseDue
        ) VALUES (
            @id, datetime('now'), 'seed-script', datetime('now'), 'seed-script',
            @defectId, @origin, @status, @symptomShortText, @foundDate, null,
            @defectQuantity, @defectQuantityUom, @referenceNumber, @plant,
            @materialId, @materialDesc, @materialGroup, @batchId,
            @workCenterId, @workCenterDesc, @defectCodeGroup, @defectCode, @defectText,
            @defectClass, @entryMode, @inspectionLotId, @reportedBy, @coordinator,
            @department, @complaintReference, @customerPlantContact, @slaResponseDue
        )
    `);

    const insertCharStmt = db.prepare(`
        INSERT INTO cnma_proresolve_DefectCharacteristics (
            ID, createdAt, createdBy, modifiedAt, modifiedBy,
            defect_ID, lineNo, characteristic, measuredValue,
            specLowerLimit, specUpperLimit, specUom, valuation, equipment
        ) VALUES (
            @id, datetime('now'), 'seed-script', datetime('now'), 'seed-script',
            @defect_ID, @lineNo, @characteristic, @measuredValue,
            @specLowerLimit, @specUpperLimit, @specUom, @valuation, @equipment
        )
    `);

    let insertedCount = 0;
    const tx = db.transaction(() => {
        for (const item of ADDITIONAL_Q_DEFECTS) {
            const row = checkStmt.get(item.defectId);
            if (!row) {
                insertDefectStmt.run({
                    id: item.id,
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
                });

                for (const char of item.characteristics) {
                    insertCharStmt.run({
                        id: crypto.randomUUID(),
                        defect_ID: item.id,
                        lineNo: char.lineNo,
                        characteristic: char.characteristic,
                        measuredValue: char.measuredValue,
                        specLowerLimit: char.specLowerLimit ?? null,
                        specUpperLimit: char.specUpperLimit ?? null,
                        specUom: char.specUom ?? null,
                        valuation: char.valuation,
                        equipment: char.equipment ?? item.workCenterId,
                    });
                }
                insertedCount++;
            }
        }
    });

    tx();
    console.log(`Đã seed thành công ${insertedCount} defects mẫu (Q1, Q2, Q3) vào db.sqlite.`);

    // ── Update CSV files ─────────────────────────────────────────────────────
    const defectsCsvPath = path.resolve('db/data/cnma.proresolve-Defects.csv');
    const charsCsvPath = path.resolve('db/data/cnma.proresolve-DefectCharacteristics.csv');

    if (fs.existsSync(defectsCsvPath)) {
        let defectsCsv = fs.readFileSync(defectsCsvPath, 'utf8').trim();
        for (const d of ADDITIONAL_Q_DEFECTS) {
            if (!defectsCsv.includes(d.defectId)) {
                defectsCsv += `\n${d.id};2026-03-01T00:00:00Z;seed-script;2026-03-01T00:00:00Z;seed-script;${d.defectId};${d.origin};${d.status};${d.symptomShortText};${d.foundDate};;${d.defectQuantity};${d.defectQuantityUom};${d.referenceNumber};${d.plant};${d.materialId};${d.materialDesc};${d.materialGroup};${d.batchId};${d.workCenterId};${d.workCenterDesc};${d.defectCodeGroup};${d.defectCode};${d.defectText};${d.defectClass};${d.entryMode};${d.inspectionLotId ?? ''};${d.reportedBy};${d.coordinator};${d.department};${d.complaintReference};${d.customerPlantContact};${d.slaResponseDue}`;
            }
        }
        fs.writeFileSync(defectsCsvPath, defectsCsv + '\n', 'utf8');
        console.log('Đã cập nhật db/data/cnma.proresolve-Defects.csv');
    }

    if (fs.existsSync(charsCsvPath)) {
        let charsCsv = fs.readFileSync(charsCsvPath, 'utf8').trim();
        for (const d of ADDITIONAL_Q_DEFECTS) {
            for (const c of d.characteristics) {
                const charId = `char-${d.defectId}-${c.lineNo}`;
                if (!charsCsv.includes(`${d.id};${c.lineNo};`)) {
                    charsCsv += `\n${charId};2026-03-01T00:00:00Z;seed-script;2026-03-01T00:00:00Z;seed-script;${d.id};${c.lineNo};${c.characteristic};${c.measuredValue};${c.specLowerLimit ?? ''};${c.specUpperLimit ?? ''};${c.specUom ?? ''};${c.valuation};${c.equipment ?? d.workCenterId}`;
                }
            }
        }
        fs.writeFileSync(charsCsvPath, charsCsv + '\n', 'utf8');
        console.log('Đã cập nhật db/data/cnma.proresolve-DefectCharacteristics.csv');
    }
}

if (require.main === module) {
    seedQDefects();
}
