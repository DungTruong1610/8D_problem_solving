import type { JudgeStop, JudgeStopType } from '../../../../../shared/judge-evaluation';

export interface TestCaseResult {
    id: string;
    title: string;
    category: string;
    inputSummary: string;
    expectedBehavior: string;
    actualBehavior: string;
    status: 'PASS' | 'FAIL';
    durationMs: number;
    details: Record<string, any>;
    reportId?: string;
    notificationId?: string;
    /** Loại dừng chính theo luật `stops.ts`; null = AI được đi tiếp. */
    stopType?: JudgeStopType | null;
    stops?: JudgeStop[];
}

export interface VerifyHarnessReport {
    suite: string;
    track: string;
    challenge: string;
    executedAt: string;
    totalDurationMs: number;
    targetDurationLimitMs: number;
    passed: number;
    failed: number;
    total: number;
    verdict: 'PASS' | 'FAIL';
    results: TestCaseResult[];
}

export const STANDARD_TEST_CASE_TEMPLATE = {
    "$schema": "",
    "$testCaseId": "TC-01",
    "$title": "Milling Burr Defect (Happy Path - Strong Precedent Match)",
    "$category": "Quadrant 1 - Perfect End-to-End Workflow",
    "notificationId": "8D-10049001",
    "origin": "Q3 - Internal Defect",
    "symptomShortText": "Operator stopped the line - rough edge felt on bracket flange after milling",
    "status": "In Process",
    "foundDate": "2026-08-12",
    "completionDate": null,
    "quantityExtent": "61 units on hold",
    "teamSize": null,
    "material": {
        "materialId": "MAT-10247",
        "description": "Bracket Housing X240",
        "materialGroup": "MG-HOUSING"
    },
    "batch": {
        "batchId": "B-55901",
        "materialId": "MAT-10247"
    },
    "defect": {
        "defectCode": "DEF-0489",
        "defectText": "Flange edge burr above limit"
    },
    "workCenter": {
        "workCenterId": "WC-MILL-07",
        "description": "CNC Milling Line 7"
    },
    "inspections": [
        {
            "characteristic": "Burr height at flange edge",
            "measuredValue": "0.26mm",
            "specValue": "max 0.10mm"
        }
    ],
    "causesIshikawa": [],
    "fiveWhyChain": [],
    "actions": [],
    "teamAssignments": [],
    "isIsNot": null,
    "fmeaLink": null,
    "costCopq": null,
    "lessonsLearned": null,
    "customerReference": {
        "complaintReference": "N/A - internal defect, no customer reference",
        "customerPlantContact": "N/A",
        "slaResponseDue": "N/A"
    }
};

export const SANDBOX_INITIAL_JSON = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$testCaseId": "TC-01",
    "$title": "Milling Burr Defect (Happy Path - Strong Precedent Match)",
    "$category": "Quadrant 1 - Perfect End-to-End Workflow",
    "notificationId": "8D-10049001",
    "origin": "Q3 - Internal Defect",
    "symptomShortText": "Operator stopped the line - rough edge felt on bracket flange after milling",
    "status": "Completed",
    "foundDate": "2026-08-12",
    "completionDate": "2026-08-18",
    "quantityExtent": "61 units on hold",
    "teamSize": 4,
    "material": {
        "materialId": "MAT-10247",
        "description": "Bracket Housing X240",
        "materialGroup": "MG-HOUSING"
    },
    "batch": {
        "batchId": "B-55901",
        "materialId": "MAT-10247"
    },
    "defect": {
        "defectCode": "DEF-0489",
        "defectText": "Flange edge burr above limit"
    },
    "workCenter": {
        "workCenterId": "WC-MILL-07",
        "description": "CNC Milling Line 7"
    },
    "inspections": [
        {
            "characteristic": "Burr height at flange edge",
            "measuredValue": "0.26mm",
            "specValue": "max 0.10mm"
        },
        {
            "characteristic": "Flange flatness",
            "measuredValue": "0.08mm",
            "specValue": "0.05mm +/-0"
        }
    ],
    "causesIshikawa": [
        {
            "category": "Man",
            "description": "EMP-2340, Shift C operator deburring technique verified per SOP-MILL-04",
            "metricValue": null,
            "isRootCause": "N",
            "source": "MES/HR log audit"
        },
        {
            "category": "Machine",
            "description": "Deburring tool EQ-MILL07-002 ran to 11,800 cycles past 8,000-cycle replacement limit",
            "metricValue": "11,800 cycles",
            "isRootCause": "Y",
            "source": "SAP PM maintenance log"
        },
        {
            "category": "Method",
            "description": "DOC-4610 Rev B - Milling & deburring work instruction unchanged and valid",
            "metricValue": null,
            "isRootCause": "N",
            "source": "SAP DMS routing"
        },
        {
            "category": "Material",
            "description": "Alloy batch cert conforming to DIN EN 1706",
            "metricValue": null,
            "isRootCause": "N",
            "source": "SAP QALS incoming inspect"
        },
        {
            "category": "Measurement",
            "description": "Optical comparator GA-0044 calibrated 2026-06-20",
            "metricValue": "4.2% GR&R",
            "isRootCause": "N",
            "source": "Test equipment mgmt"
        },
        {
            "category": "Environment",
            "description": "Ambient temperature 22.8C within allowable limits",
            "metricValue": "22.8C",
            "isRootCause": "N",
            "source": "Shopfloor IoT telemetry"
        }
    ],
    "fiveWhyChain": [
        {
            "stepNo": 1,
            "question": "Why is the flange edge burr height 0.26mm above 0.10mm specification?",
            "answer": "The deburring cutter insert no longer sheared cleanly during contour pass",
            "evidenceCitation": "Inspection telemetry characteristic 'Burr height at flange edge'"
        },
        {
            "stepNo": 2,
            "question": "Why did the deburring cutter insert stop shearing cleanly?",
            "answer": "Deburring tool EQ-MILL07-002 reached 11,800 cycles, exceeding 8,000-cycle replacement limit",
            "evidenceCitation": "Equipment maintenance log EQ-MILL07-002"
        },
        {
            "stepNo": 3,
            "question": "Why was the tool-life replacement limit exceeded without notice?",
            "answer": "No automated tool-life counter interlock was configured on CNC controller WC-MILL-07",
            "evidenceCitation": "Preventive maintenance plan PM-MILL-07"
        },
        {
            "stepNo": 4,
            "question": "Why was there no automated counter interlock configured?",
            "answer": "Line relied on manual whiteboard tally tracking prone to shift-handover omissions",
            "evidenceCitation": "Operating procedure SOP-MILL-04"
        },
        {
            "stepNo": 5,
            "question": "Why was manual tracking retained for critical finishing tooling?",
            "answer": "FMEA-MILL07-03 had not assigned high RPN severity to tool over-cycling",
            "evidenceCitation": "Process FMEA review audit FMEA-MILL07-03"
        }
    ],
    "actions": [
        {
            "lineNo": 1,
            "actionType": "Containment",
            "actionText": "Quarantine 61 units from batch B-55901 and perform 100% manual deburring audit",
            "status": "Done"
        },
        {
            "lineNo": 2,
            "actionType": "Corrective",
            "actionText": "Replace worn deburring tool insert EQ-MILL07-002 and recalibrate tool offset",
            "status": "Done"
        },
        {
            "lineNo": 3,
            "actionType": "Preventive",
            "actionText": "Implement automated cycle counter interlock on WC-MILL-07 controller at 8,000 cycles",
            "status": "Done"
        }
    ],
    "teamAssignments": [
        {
            "partnerId": "100001",
            "partnerName": "Heli Weber",
            "functionTitle": "Quality Engineer",
            "partnerRole": "8D Team Leader",
            "source": "Assigned from Quality Assurance"
        },
        {
            "partnerId": "100012",
            "partnerName": "Minh Dinh",
            "functionTitle": "CNC Machining Process Engineer",
            "partnerRole": "8D Team Member",
            "source": "Assigned from Production Engineering"
        },
        {
            "partnerId": "100018",
            "partnerName": "Karl Wagner",
            "functionTitle": "Machine Maintenance Technician",
            "partnerRole": "8D Team Member",
            "source": "Assigned from Maintenance"
        },
        {
            "partnerId": "100011",
            "partnerName": "Quyen La",
            "functionTitle": "Quality Inspector",
            "partnerRole": "8D Team Member",
            "source": "Assigned from Quality Inspection"
        }
    ],
    "isIsNot": {
        "whatIs": "Flange edge burr height 0.26mm",
        "whatIsNot": "Pocket depth deviation or bolt-hole pitch",
        "whereIs": "Bracket flange edge at CNC Milling Line 7 (WC-MILL-07)",
        "whereIsNot": "Other machining cells WC-PRESS-12 or WC-MILL-08",
        "whenIs": "Batch B-55901 during second half of shift",
        "whenIsNot": "Early shift parts before tool cycle overrun",
        "extentIs": "61 units affected in batch B-55901",
        "extentIsNot": "Batches before tool changeover",
        "notes": "Problem isolated specifically to tool wear overrun on cutter EQ-MILL07-002"
    },
    "fmeaLink": {
        "fmeaId": "FMEA-MILL07-03",
        "description": "Process FMEA for CNC Milling Operations (Deburring Tool Wear)"
    },
    "costCopq": {
        "costOfPoorQualityEur": 12750
    },
    "lessonsLearned": {
        "whatWorked": "Tool-life telemetry in PM log isolated the root cause within single shift",
        "whatDidnt": "Manual tally board allowed 3,800 overrun cycles before optical detection"
    },
    "customerReference": {
        "complaintReference": "N/A - internal defect, no customer reference",
        "customerPlantContact": "N/A",
        "slaResponseDue": "N/A"
    }
};

export const SAMPLE_JUDGE_VALID = {
    notificationId: "8D-10049002",
    origin: "Q1 - Customer Complaint",
    symptomShortText: "Coolant weeping from pump housing joint face after 200 hours in field",
    material: {
        materialId: "MAT-10318",
        description: "Pump Housing P90",
        materialGroup: "MG-HOUSING"
    },
    workCenter: {
        workCenterId: "WC-CAST-03",
        description: "Aluminium Die Casting Line 3"
    },
    inspections: [
        {
            characteristic: "Helium leak rate",
            measuredValue: "9 mbar*l/s",
            specValue: "max 5 mbar*l/s"
        }
    ]
};

export const SAMPLE_JUDGE_OUT_OF_SCOPE = {
    invoiceId: "INV-99821",
    department: "Finance & Accounting",
    description: "Expense reimbursement request for team building dinner and beverages",
    amountVnd: 4850000,
    claimant: "Accounting Lead"
};

export const SAMPLE_JUDGE_OUT_OF_DOMAIN = {
    notificationId: "8D-99999",
    symptomShortText: "New Laser Micro-welding crack on experimental titanium alloy",
    workCenter: { workCenterId: "WC-WELD-11" },
    defectType: "UNKNOWN_LASER_WELDING"
};

/** Case the guide points at whenever it needs "a real, finished 8D" to open. */
export const BENCHMARK_NOTIFICATION_ID = '8D-10048412';

// ── Tabs ─────────────────────────────────────────────────────────────────────

export const GUIDE_TABS = [
    { id: 'overview', label: 'Pages', legacy: 'section-pages' },
    { id: 'ai-config', label: 'AI Configuration', legacy: 'section-config' },
    { id: 'test-case', label: 'Test Case Format', legacy: 'section-json' },
    { id: 'evaluation', label: 'Evaluation', legacy: 'section-verify' },
    { id: 'cli', label: 'CLI', legacy: 'section-cli' },
] as const;

export type GuideTabId = typeof GUIDE_TABS[number]['id'];

/**
 * `?tab=` wins; the old `?section=section-*` anchors still resolve so links
 * written before the tab layout keep landing on the right content.
 */
export function resolveGuideTab(params: URLSearchParams): GuideTabId {
    const tab = params.get('tab');
    const byId = GUIDE_TABS.find((t) => t.id === tab);
    if (byId) return byId.id;
    const section = params.get('section');
    const byLegacy = GUIDE_TABS.find((t) => t.legacy === section);
    return byLegacy ? byLegacy.id : 'overview';
}

// ── Tab 1: Pages ─────────────────────────────────────────────────────────────

export const PAGE_CARDS = [
    {
        key: '8d-list',
        title: '8D Reports',
        route: '/8d',
        summary: 'Worklist of every quality notification and its 8D progress.',
        steps: [
            'Filter by status or overdue SLA.',
            'Click a row to open its 8D workspace.',
            'Use "Create Defect" to add a notification.',
        ],
    },
    {
        key: '8d-detail',
        title: '8D Workspace',
        route: `/8d/${BENCHMARK_NOTIFICATION_ID}`,
        summary: 'Work through D1 - D8 with AI drafts and precedent matches.',
        steps: [
            'Check precedent matches in the side panel.',
            'Review each discipline from D1 to D8.',
            'Click "Approve Step" to unlock the next one.',
        ],
    },
    {
        key: 'master-data',
        title: 'Master Data',
        route: '/master-data',
        summary: 'Inspection history, defect records and the closed case library.',
        steps: [
            'Switch between the four data tabs.',
            'Look up work centers, materials and codes.',
            'Pick specialists for the D1 team.',
        ],
    },
    {
        key: 'workflow',
        title: 'AI Configuration',
        route: '/workflow',
        summary: 'Models, discipline prompts and precedent retrieval settings.',
        steps: [
            'Choose the LLM provider.',
            'Edit prompts for D1 - D8.',
            'Tune retrieval weights and cutoff.',
        ],
    },
] as const;

// ── Tab 2: AI configuration ─────────────────────────────────────────────────

export const AI_CONFIG_CARDS = [
    {
        key: 'model',
        title: 'LLM provider',
        summary: 'Pick the model that drafts every discipline.',
        items: [
            { label: 'DeepSeek', note: 'Default - fast and low cost' },
            { label: 'Gemini', note: 'Strong multilingual extraction' },
            { label: 'Mock mode', note: 'Offline, no API key needed' },
        ],
    },
    {
        key: 'prompts',
        title: 'Discipline prompts',
        summary: 'Each of D1 - D8 has its own system and user prompt.',
        items: [
            { label: '{{symptomShortText}}', note: 'Defect description' },
            { label: '{{inspections}}', note: 'Measured vs spec values' },
            { label: '{{precedents}}', note: 'Matched historical cases' },
        ],
    },
    {
        key: 'retrieval',
        title: 'Precedent retrieval',
        summary: 'Controls how historical cases are scored and filtered.',
        items: [
            { label: 'Weights', note: 'Work center, material, defect code' },
            { label: 'Cutoff 0.60', note: 'Below it the Copilot refuses' },
            { label: 'Profiles', note: 'Per-step scoring presets' },
        ],
    },
] as const;

// ── Tab 3: Test case format ─────────────────────────────────────────────────

export type FieldRequirement = 'Required' | 'Recommended' | 'Optional';

export const SCHEMA_FIELDS: { name: string; requirement: FieldRequirement; type: string; note: string }[] = [
    { name: 'notificationId', requirement: 'Required', type: 'string', note: 'Case identifier, e.g. "8D-10049001"' },
    { name: 'symptomShortText', requirement: 'Required', type: 'string', note: 'Defect description, used for similarity search' },
    { name: 'material.materialId', requirement: 'Required', type: 'string', note: 'Flat materialId is also accepted' },
    { name: 'workCenter.workCenterId', requirement: 'Required', type: 'string', note: 'Flat workCenterId is also accepted' },
    { name: 'defect', requirement: 'Recommended', type: 'object', note: 'defectCode, defectText' },
    { name: 'inspections', requirement: 'Recommended', type: 'array', note: 'characteristic, measuredValue, specValue' },
    { name: 'teamAssignments', requirement: 'Recommended', type: 'array', note: 'Pre-assigned D1 team members' },
    { name: 'origin', requirement: 'Optional', type: 'string', note: 'Q1 customer, Q2 supplier, Q3 internal' },
    { name: 'status · foundDate', requirement: 'Optional', type: 'string', note: 'SAP status and detection date (YYYY-MM-DD)' },
    { name: 'quantityExtent · batch', requirement: 'Optional', type: 'string · object', note: 'Affected quantity and batch' },
    { name: 'causesIshikawa', requirement: 'Optional', type: 'array', note: 'Initial 6M hypotheses' },
    { name: 'fiveWhyChain', requirement: 'Optional', type: 'array', note: 'Existing 5-Why steps' },
    { name: 'actions', requirement: 'Optional', type: 'array', note: 'Containment, corrective, preventive rows' },
    { name: 'isIsNot · fmeaLink', requirement: 'Optional', type: 'object', note: 'Is / Is-Not boundary and FMEA reference' },
    { name: 'costCopq · lessonsLearned', requirement: 'Optional', type: 'object', note: 'Cost of poor quality and D8 lessons' },
    { name: 'customerReference', requirement: 'Optional', type: 'object', note: 'Complaint reference and SLA (Q1 cases)' },
];

export const QUADRANT_TIPS = [
    { id: 'TC-01', title: 'Happy path', hint: 'WC-MILL-07 + MAT-10247 + burr 0.26mm matches a strong precedent.' },
    { id: 'TC-02', title: 'Dirty data', hint: 'German text, comma decimals ("0,32 mm") and padded IDs.' },
    { id: 'TC-03', title: 'Bias hunter', hint: 'Record blames "Man" while telemetry shows machine drift.' },
    { id: 'TC-04', title: 'Safe refusal', hint: 'Defect with no matching closed case → no precedent cited, escalate.' },
] as const;

// ── Tab 4: Evaluation ───────────────────────────────────────────────────────

export const TEST_CASES = [
    {
        id: 'TC-01',
        title: 'Milling burr defect',
        quadrant: 'Happy path',
        notificationId: '8D-10049001',
        summary: 'New internal defect on WC-MILL-07, burr 0.26mm vs max 0.10mm.',
        expected: 'The D4 precedent search (same engine as the app) returns 8D-10048412; symptom and measurement present; no blocking stop.',
        stopType: null,
        jsonPath: 'mock-data/sprint1-test-cases/tc-01-happy-path.json',
    },
    {
        id: 'TC-02',
        title: 'Dirty SAP QM export',
        quadrant: 'Messy real-world data',
        notificationId: '8D-90048412',
        summary: 'German text, comma decimal "0,32 mm", padded material ID, missing fields.',
        expected: 'No crash, values normalized, gaps reported - and stops (unverified facts) until a QE confirms the parsed 0.32 mm.',
        stopType: 'unverified-facts',
        jsonPath: 'mock-data/sprint1-test-cases/tc-02-dirty-sap.json',
    },
    {
        id: 'TC-03',
        title: 'Pocket depth deviation',
        quadrant: 'Confirmation bias',
        notificationId: '8D-10048880',
        summary: 'Engineer blamed the operator; telemetry shows 0.9mm tool changer drift.',
        expected: 'Stops at D4 (unverified facts): "Man" has no evidence while "Machine" has a measured drift. The QE decides.',
        stopType: 'unverified-facts',
        jsonPath: 'mock-data/sprint1-test-cases/tc-03-bias-hunter.json',
    },
    {
        id: 'TC-04',
        title: 'Welding defect on milling cell',
        quadrant: 'Safe refusal',
        notificationId: '8D-10049003',
        summary: 'Welding defect code on a milling cell - only the work center and material match past cases.',
        expected: 'The D4 precedent search returns nothing above its threshold, so the AI stops (outside scope), cites no precedent and escalates to a person.',
        stopType: 'outside-scope',
        jsonPath: 'mock-data/sprint1-test-cases/tc-04-graceful-refusal.json',
    },
] as const;

export const JUDGE_PRESETS = [
    { key: 'valid', label: 'Valid defect', payload: SAMPLE_JUDGE_VALID },
    { key: 'out-of-domain', label: 'Out of domain', payload: SAMPLE_JUDGE_OUT_OF_DOMAIN },
    { key: 'junk', label: 'Junk invoice', payload: SAMPLE_JUDGE_OUT_OF_SCOPE },
] as const;

// ── Tab 5: CLI ──────────────────────────────────────────────────────────────

export const CLI_COMMANDS = [
    { id: 'dev', title: 'Start backend + frontend', cmd: 'npm run dev', note: 'Backend on 4008, UI on 5544' },
    { id: 'verify', title: 'Run the 4 test cases', cmd: 'npm run verify:sprint1', note: 'Same harness as the Evaluation tab' },
    { id: 'judge', title: 'Evaluate a judge file', cmd: 'npm run verify:sprint1 -- --judge-input mock-data/incoming/issue-B-customer-leak.json', note: 'Handle or refuse an unseen payload' },
    { id: 'json', title: 'Machine-readable report', cmd: 'npm run verify:sprint1 -- --json', note: 'JSON output for CI or grading' },
    // `;` rather than `&&`: Windows PowerShell 5.1 rejects `&&`.
    { id: 'seed', title: 'Reset the SQLite database', cmd: 'npm run deploy:sqlite; npm run seed:sqlite', note: 'Overwrites db.sqlite with sample data' },
    { id: 'test', title: 'Run unit tests', cmd: 'npm test', note: 'Jest test suite' },
] as const;

// ── Guided tour ─────────────────────────────────────────────────────────────

export const TOUR_STEPS = [
    {
        title: '8D Reports',
        route: '/8d',
        description: 'Every quality notification lives here with its 8D progress.',
        actions: [
            'Search or filter by status.',
            `Open the benchmark case ${BENCHMARK_NOTIFICATION_ID}.`,
        ],
    },
    {
        title: '8D Workspace',
        route: `/8d/${BENCHMARK_NOTIFICATION_ID}`,
        description: 'Review AI drafts discipline by discipline, with precedents on the side.',
        actions: [
            'Check the precedent matches and their scores.',
            'Step through D1 - D8 and approve each one.',
        ],
    },
    {
        title: 'Root cause evidence',
        route: `/8d/${BENCHMARK_NOTIFICATION_ID}`,
        description: 'D4 compares what people claimed with what the measurements show.',
        actions: [
            'Open D4 and read the physical evidence panel.',
            'See where the AI agrees or disagrees with the record.',
        ],
    },
    {
        title: 'AI Configuration',
        route: '/workflow',
        description: 'Change model, prompts and retrieval without redeploying.',
        actions: [
            'Switch the LLM provider.',
            'Edit a discipline prompt and save.',
        ],
    },
    {
        title: 'Evaluation',
        route: '/guide?tab=evaluation',
        description: 'Run the 4 test cases and try unseen payloads.',
        actions: [
            'Click "Run verification".',
            'Paste a payload into the judge sandbox.',
        ],
    },
] as const;
