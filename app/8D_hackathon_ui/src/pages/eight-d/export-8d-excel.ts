import * as XLSX from 'xlsx';
import { type Report8D, type Discipline8D, getReviewTrail, isCustomerComplaint } from '@/services/eightd-service';

function safeStr(val: unknown): string {
    if (val == null) return '';
    return String(val).trim();
}

function parseData(d: Discipline8D): Record<string, unknown> {
    if (!d.resultJson) return {};
    try {
        const parsed = JSON.parse(d.resultJson);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function getVal(data: Record<string, unknown>, dottedKey: string): unknown {
    if (data[dottedKey] !== undefined) return data[dottedKey];
    const parts = dottedKey.split('.');
    let cur: unknown = data;
    for (const p of parts) {
        if (!cur || typeof cur !== 'object') return undefined;
        cur = (cur as Record<string, unknown>)[p];
    }
    return cur;
}

function fitCols(rows: (string | number | null | undefined)[][], minW = 12, maxW = 55) {
    const colWidths: number[] = [];
    for (const row of rows) {
        row.forEach((val, colIdx) => {
            const str = val == null ? '' : String(val);
            const len = Math.min(Math.max(str.length + 3, minW), maxW);
            colWidths[colIdx] = Math.max(colWidths[colIdx] || minW, len);
        });
    }
    return colWidths.map((w) => ({ wch: w }));
}

export async function export8DToExcel(report: Report8D): Promise<void> {
    const wb = XLSX.utils.book_new();
    const disciplines = [...(report.disciplines ?? [])].sort((a, b) => a.sequence - b.sequence);
    const dMap = new Map<string, { discipline: Discipline8D; data: Record<string, unknown> }>();
    for (const d of disciplines) {
        dMap.set(d.code, { discipline: d, data: parseData(d) });
    }

    // ── SHEET 1: Overview & Executive Summary ──
    const overviewRows: (string | number | null | undefined)[][] = [
        ['8D PROBLEM SOLVING REPORT', ''],
        ['Notification / Case ID:', report.notificationId],
        ['Report Status:', `${report.sapStatus} (AI: ${report.status})`],
        ['Origin:', report.origin],
        ['Reference Number:', report.referenceNumber || '—'],
        ['Found Date:', report.foundDate || '—'],
        ['Completion Date:', report.completionDate || '—'],
        ['SLA Response Due:', report.slaResponseDue || '—'],
        ['Coordinator:', report.coordinator || '—'],
        ['Team Leader:', report.teamLeader || '—'],
        ['', ''],
        ['PRODUCT & PROCESS DETAILS', ''],
        ['Material ID:', report.materialId || '—'],
        ['Material Description:', report.materialDesc || '—'],
        ['Plant:', report.plant || '—'],
        ['Batch ID:', report.batchId || '—'],
        ['Work Center:', `${report.workCenterId || '—'} - ${report.workCenterDesc || ''}`],
        ['Defect Code & Group:', `${report.defectCodeGroup ? `${report.defectCodeGroup} / ` : ''}${report.defectCode || '—'}`],
        ['Defect Description:', report.defectText || '—'],
        ['Defect Class / Severity:', report.defectClass || '—'],
        ['Quantity Affected:', report.defectQuantity != null ? `${report.defectQuantity} ${report.defectQuantityUom || ''}` : report.quantityExtent || '—'],
        ['Cost of Poor Quality (COPQ):', report.copqEur != null ? `€${report.copqEur.toLocaleString()}` : '—'],
        ['Root Cause Category:', report.rootCauseCategory || '—'],
        ['FMEA Reference ID:', report.fmeaId || '—'],
        ['', ''],
        ['AI EXECUTIVE SUMMARY', ''],
        ['Internal Summary:', report.internalSummary || '—'],
    ];

    if (isCustomerComplaint(report.origin) && report.customerSummary) {
        overviewRows.push(['Customer Summary:', report.customerSummary]);
    }

    overviewRows.push(
        ['', ''],
        ['8D DISCIPLINE PROGRESS', '', '', '', ''],
        ['Discipline Code', 'Discipline Title', 'Review Status', 'Reviewed By', 'Summary'],
    );

    for (const d of disciplines) {
        overviewRows.push([
            d.code,
            d.title,
            d.reviewStatus || 'Draft',
            d.reviewedBy || '—',
            d.summary || '—',
        ]);
    }

    const wsOverview = XLSX.utils.aoa_to_sheet(overviewRows);
    wsOverview['!cols'] = fitCols(overviewRows, 15, 60);
    XLSX.utils.book_append_sheet(wb, wsOverview, '8D Overview');

    // ── SHEET 2: D1 - Team Roster ──
    const d1 = dMap.get('D1');
    const teamRows: (string | number | null | undefined)[][] = [
        ['D1: ESTABLISH THE TEAM — ROSTER', '', '', ''],
        ['Member Name', 'Assigned 8D Role', 'Organizational Role', 'Case Responsibility'],
    ];

    if (d1) {
        const rawRoster = getVal(d1.data, 'team.assignedRoster')
            ?? getVal(d1.data, 'team.roster')
            ?? [];
        const roster = Array.isArray(rawRoster) ? rawRoster : [];
        if (roster.length > 0) {
            for (const r of roster) {
                if (r && typeof r === 'object') {
                    teamRows.push([
                        safeStr((r as Record<string, unknown>).name),
                        safeStr((r as Record<string, unknown>).assigned8DRole || (r as Record<string, unknown>).partnerRole),
                        safeStr((r as Record<string, unknown>).organizationalRole || (r as Record<string, unknown>).functionTitle),
                        safeStr((r as Record<string, unknown>).caseResponsibility),
                    ]);
                }
            }
        } else {
            teamRows.push(['No roster logged yet.', '', '', '']);
        }
    }
    const wsTeam = XLSX.utils.aoa_to_sheet(teamRows);
    wsTeam['!cols'] = fitCols(teamRows, 16, 45);
    XLSX.utils.book_append_sheet(wb, wsTeam, 'D1 Team');

    // ── SHEET 3: D2 - Problem Description (5W2H) ──
    const d2 = dMap.get('D2');
    const problemRows: (string | number | null | undefined)[][] = [
        ['D2: PROBLEM DESCRIPTION (5W2H)', ''],
    ];
    if (d2) {
        problemRows.push(
            ['Problem Statement:', safeStr(getVal(d2.data, 'problem.statement') || d2.discipline.summary)],
            ['What (Defect):', safeStr(getVal(d2.data, 'problem.what'))],
            ['Where (Location/Process):', safeStr(getVal(d2.data, 'problem.where'))],
            ['When (Date/Shift):', safeStr(getVal(d2.data, 'problem.when'))],
            ['Who (Discovered By):', safeStr(getVal(d2.data, 'problem.who'))],
            ['Why (Specification/Requirement):', safeStr(getVal(d2.data, 'problem.why'))],
            ['How (Surfaced/Detection):', safeStr(getVal(d2.data, 'problem.how'))],
            ['Extent (Affected Qty/Spread):', safeStr(getVal(d2.data, 'problem.extent'))],
            ['', ''],
            ['IS / IS-NOT COMPARATIVE ANALYSIS', ''],
            ['Is / Is-Not Reasoning & Basis:', safeStr(getVal(d2.data, 'problem.isIsNotBasis'))],
        );
    }
    const wsProblem = XLSX.utils.aoa_to_sheet(problemRows);
    wsProblem['!cols'] = fitCols(problemRows, 22, 65);
    XLSX.utils.book_append_sheet(wb, wsProblem, 'D2 Problem');

    // ── SHEET 4: D3, D5, D7 - Action Plan & Tasks ──
    const actionRows: (string | number | null | undefined)[][] = [
        ['8D ACTION PLAN (D3 CONTAINMENT, D5 CORRECTIVE, D7 PREVENTIVE)', '', '', '', '', ''],
        ['Phase', 'Action Description', 'Assignee / Owner', 'Status', 'Origin', 'Task Code / Category'],
    ];

    const extractActions = (code: string, prefix: string, label: string) => {
        const item = dMap.get(code);
        if (!item) return;
        const list = getVal(item.data, `${prefix}.assignedActions`)
            ?? getVal(item.data, `${prefix}.actions`)
            ?? [];
        if (Array.isArray(list)) {
            for (const act of list) {
                if (act && typeof act === 'object') {
                    const row = act as Record<string, unknown>;
                    actionRows.push([
                        label,
                        safeStr(row.action || row.name || row.actionText),
                        safeStr(row.assignee || row.owner),
                        safeStr(row.status || 'Planned'),
                        safeStr(row.origin || 'AI Suggestion'),
                        safeStr(row.taskCode ? `${row.taskCode} (${row.taskCodeGroup || ''})` : ''),
                    ]);
                }
            }
        }
    };

    extractActions('D3', 'containment', 'D3 Containment');
    extractActions('D5', 'corrective', 'D5 Corrective');
    extractActions('D7', 'preventive', 'D7 Preventive');

    if (actionRows.length === 2) {
        actionRows.push(['No actions logged yet.', '', '', '', '', '']);
    }

    const wsActions = XLSX.utils.aoa_to_sheet(actionRows);
    wsActions['!cols'] = fitCols(actionRows, 15, 60);
    XLSX.utils.book_append_sheet(wb, wsActions, 'Action Plan');

    // ── SHEET 5: D4 - Root Cause Analysis ──
    const d4 = dMap.get('D4');
    const rootRows: (string | number | null | undefined)[][] = [
        ['D4: ROOT CAUSE ANALYSIS', '', '', ''],
        ['Root Cause Conclusion Statement:', safeStr(d4 ? (getVal(d4.data, 'rootCause.statement') || d4.discipline.summary) : '')],
        ['', '', '', ''],
        ['5-WHY CAUSAL CHAIN', '', '', ''],
        ['Step', 'Why (Question)', 'Answer', 'Evidence / Verification'],
    ];

    if (d4) {
        const fiveWhy = getVal(d4.data, 'rootCause.fiveWhy');
        if (Array.isArray(fiveWhy) && fiveWhy.length > 0) {
            for (const item of fiveWhy) {
                if (item && typeof item === 'object') {
                    const r = item as Record<string, unknown>;
                    rootRows.push([
                        safeStr(r.step),
                        safeStr(r.why || r.question),
                        safeStr(r.answer),
                        safeStr(r.evidence),
                    ]);
                }
            }
        } else {
            rootRows.push(['1', 'Why did the defect occur?', 'Not analyzed yet', '']);
        }

        rootRows.push(
            ['', '', '', ''],
            ['ISHIKAWA 6M CATEGORIES', '', '', ''],
            ['Category', 'Finding / Verdict', 'Root Cause Flag', ''],
        );

        const ishikawa = getVal(d4.data, 'rootCause.ishikawaBoard');
        if (Array.isArray(ishikawa) && ishikawa.length > 0) {
            for (const row of ishikawa) {
                if (row && typeof row === 'object') {
                    const r = row as Record<string, unknown>;
                    rootRows.push([
                        safeStr(r.category),
                        safeStr(r.finding),
                        r.isRootCause ? 'YES (Confirmed)' : 'No',
                        '',
                    ]);
                }
            }
        }
    }

    const wsRoot = XLSX.utils.aoa_to_sheet(rootRows);
    wsRoot['!cols'] = fitCols(rootRows, 14, 55);
    XLSX.utils.book_append_sheet(wb, wsRoot, 'D4 Root Cause');

    // ── SHEET 6: D6 & D8 - Verification & Closure ──
    const d6 = dMap.get('D6');
    const d8 = dMap.get('D8');
    const closureRows: (string | number | null | undefined)[][] = [
        ['D6: VERIFICATION PLAN & EFFECTIVENESS', '', '', '', ''],
        ['Inspection / Measure', 'Sample Size', 'Period', 'Acceptance Criterion', 'Sign-Off Signatory'],
    ];

    if (d6) {
        const plan = getVal(d6.data, 'verification.plan');
        if (Array.isArray(plan) && plan.length > 0) {
            for (const item of plan) {
                if (item && typeof item === 'object') {
                    const r = item as Record<string, unknown>;
                    closureRows.push([
                        safeStr(r.measure),
                        safeStr(r.sampleSize),
                        safeStr(r.period),
                        safeStr(r.acceptanceCriterion),
                        safeStr(r.signOff),
                    ]);
                }
            }
        } else {
            closureRows.push(['No verification plan items logged yet.', '', '', '', '']);
        }
    }

    closureRows.push(
        ['', '', '', '', ''],
        ['D8: CLOSURE & LESSONS LEARNED', '', '', '', ''],
    );

    if (d8) {
        closureRows.push(
            ['What Worked Well:', safeStr(getVal(d8.data, 'closure.lessonsWhatWorked')), '', '', ''],
            ['What Did Not Work:', safeStr(getVal(d8.data, 'closure.lessonsWhatDidNot')), '', '', ''],
            ['Open Items Pending:', safeStr(getVal(d8.data, 'closure.openItems')), '', '', ''],
        );
    }

    const wsClosure = XLSX.utils.aoa_to_sheet(closureRows);
    wsClosure['!cols'] = fitCols(closureRows, 20, 50);
    XLSX.utils.book_append_sheet(wb, wsClosure, 'D6 & D8 Closure');

    // ── SHEET 7: Audit Trail ──
    try {
        const auditRes = await getReviewTrail(report.ID);
        const trail = auditRes?.trail ?? [];
        if (trail.length > 0) {
            const auditRows: (string | number | null | undefined)[][] = [
                ['AUDIT TRAIL & REVIEW HISTORY', '', '', '', '', ''],
                ['Step', 'Timestamp', 'Actor / User', 'Previous Status', 'New Status', 'Note / Reason'],
            ];
            for (const ev of trail) {
                auditRows.push([
                    safeStr(ev.disciplineCode),
                    safeStr(ev.at ? new Date(ev.at).toLocaleString('en-GB') : ''),
                    safeStr(ev.actor || 'System'),
                    safeStr(ev.fromStatus),
                    safeStr(ev.toStatus),
                    safeStr(ev.note),
                ]);
            }
            const wsAudit = XLSX.utils.aoa_to_sheet(auditRows);
            wsAudit['!cols'] = fitCols(auditRows, 15, 45);
            XLSX.utils.book_append_sheet(wb, wsAudit, 'Audit Trail');
        }
    } catch {
        /* Audit trail is optional */
    }

    // ── DOWNLOAD WORKBOOK ──
    const filename = `8D_Report_${report.notificationId || report.ID}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    downloadWorkbook(wb, filename);
}

function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
    try {
        XLSX.writeFile(wb, filename);
    } catch {
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

export function exportWorklistToExcel(rows: any[]): void {
    const wb = XLSX.utils.book_new();
    const headers = [
        '8D Case ID',
        'Source Defect ID',
        'Origin',
        'Severity',
        'Status',
        'Current Step',
        'Days Open',
        'Due Date',
        'Team Leader',
        'Symptom Description',
        'Material ID',
        'Material Description',
        'Plant',
        'Work Center',
        'Defect Code',
        'Defect Text',
        'Root Cause Category',
        'Cost of Poor Quality (EUR)',
        'Analyzed At',
    ];

    const dataRows: (string | number | null | undefined)[][] = [
        ['8D REPORT WORKLIST EXPORT', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
        [`Export Date: ${new Date().toLocaleString('en-GB')}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
        headers,
    ];

    for (const r of rows) {
        const work = r.work ?? {};
        dataRows.push([
            safeStr(r.notificationId),
            safeStr(r.sourceDefectId || '—'),
            safeStr(r.origin),
            safeStr(work.severity || r.defectClass || '—'),
            safeStr(r.status),
            safeStr(work.currentStep || '—'),
            work.ageInDays ?? '—',
            safeStr(work.dueDate || r.slaResponseDue || '—'),
            safeStr(work.owner || r.teamLeader || r.coordinator || '—'),
            safeStr(r.symptomShortText),
            safeStr(r.materialId),
            safeStr(r.materialDesc),
            safeStr(r.plant),
            safeStr(r.workCenterId),
            safeStr(r.defectCode),
            safeStr(r.defectText),
            safeStr(r.rootCauseCategory || '—'),
            r.copqEur != null ? Number(r.copqEur) : '—',
            r.analyzedAt ? new Date(r.analyzedAt).toLocaleString('en-GB') : '—',
        ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    ws['!cols'] = fitCols(dataRows, 12, 50);
    XLSX.utils.book_append_sheet(wb, ws, '8D Worklist');

    const filename = `8D_Worklist_${new Date().toISOString().slice(0, 10)}.xlsx`;
    downloadWorkbook(wb, filename);
}
