/**
 * Lưới an toàn cuối cùng, chạy sau khi model trả kết quả.
 *
 * Tách khỏi `eightDAnalyzer` có chủ đích: đây là logic thuần, không I/O, không
 * phụ thuộc `@sap/cds` hay CDK. Nhờ vậy test được trực tiếp mà không phải dựng
 * cả runtime CAP lên.
 *
 * ── Nguyên tắc ──
 * Sửa thì phải GHI LẠI. Mọi chỗ chữa đều vào mảng `repairs`. Im lặng sửa sẽ
 * giấu mất việc prompt đang có vấn đề: báo cáo trông vẫn đẹp trong khi model
 * ngày càng trả về thứ sai lệch.
 */

import {
    DISCIPLINE_CODES,
    DISCIPLINE_TITLES,
    ISHIKAWA_CATEGORIES,
    type CaseContext,
    type DisciplineCode,
    type DisciplineDraft,
    type EightDResult,
} from './types';
import { buildSourceVocabulary, checkSources } from './sourceVocabulary';
import type { IndependentFinding } from './independentAnalysis';
import { computeIsIsNot } from './isIsNot';

function placeholder(code: DisciplineCode, index: number): DisciplineDraft {
    return {
        code,
        sequence: index + 1,
        title: DISCIPLINE_TITLES[code],
        summary: 'Not generated. The model omitted this discipline.',
        content:
            '_This discipline was missing from the model response and has been inserted as a ' +
            'placeholder. Re-run the analysis to populate it._',
        actionItems: [],
        sources: [],
        confidence: 0,
        dataBacked: false,
        data: {},
    };
}

/** Giới hạn khớp `maxLength` của hai trường tương ứng trong D4_FORM_SCHEMA. */
const D4_FINDING_MAX = 220;
const D4_STATEMENT_MAX = 320;

/** Bóc `finding` từ `independent` (IndependentAnalysis), chịu được shape lạ. */
function findingOf(independent: unknown): IndependentFinding | null {
    const finding = (independent as { finding?: unknown } | null | undefined)?.finding;
    if (!finding || typeof finding !== 'object') return null;
    const candidate = finding as IndependentFinding;
    return typeof candidate.rootCauseCategory === 'string' ? candidate : null;
}

/**
 * Backfill D4 tất định từ CaseContext VÀ từ chẩn đoán độc lập.
 *
 * D4 là bước cả báo cáo bị chấm theo — và pipeline này thực ra có sẵn HAI nguồn
 * root cause không phụ thuộc vào lượt viết báo cáo:
 *   - bản ghi của kỹ sư trong CaseContext (fiveWhy / ishikawa / rootCause), và
 *   - chẩn đoán mù (`independentAnalysis`): một lượt gọi CHUYÊN root cause, tự
 *     dựng `derivedFiveWhy`, tự chọn nhánh 6M, tự loại năm nhánh kia kèm lý do.
 *
 * Trước đây cả hai chỉ được đưa vào prompt làm ngữ cảnh, còn `data.rootCause`
 * vẫn phó thác cho model viết báo cáo — model nhỏ chạy nhanh (Haiku) thỉnh
 * thoảng bỏ bảng Ishikawa, bỏ answer của một bước 5-Why, quên cờ root cause.
 * Nhờ hai nguồn trên, các trường cấu trúc của D4 dựng lại được BẰNG CODE:
 *
 *   1. `fiveWhy`: bản ghi thắng tuyệt đối; case chưa điều tra thì chuỗi khuyết
 *      answer bị thay NGUYÊN KHỐI bằng `derivedFiveWhy` (vá lai hai chuỗi khác
 *      nhau sẽ ra một chuỗi không ai theo nổi)
 *   2. `ishikawaBoard` đủ sáu nhánh: recorded > verdict của chẩn đoán độc lập
 *      (statement cho nhánh nó chọn, reason cho nhánh nó loại) > "not assessed"
 *   3. đúng một nhánh mang cờ isRootCause: theo bản ghi, không có bản ghi thì
 *      theo nhánh chẩn đoán độc lập chọn — luôn source='proposed', kỹ sư mới là
 *      người xác nhận
 *   4. `statement`: bản ghi, hoặc giả thuyết đóng khung rõ ràng từ chẩn đoán
 *      độc lập — không bao giờ trống
 *
 * Mọi thứ lấy từ chẩn đoán độc lập đều mang source='proposed' và được trích
 * `independent` trong sources — không bịa, chỉ chiếu lại kết quả một lượt suy
 * luận đã chạy và đã được đối chiếu.
 */
function backfillRootCause(
    d: DisciplineDraft,
    context: CaseContext,
    independent: unknown,
    repairs: string[],
): void {
    const finding = findingOf(independent);
    let usedFinding = false;
    const data = (d.data ??= {});
    const root: Record<string, unknown> =
        data.rootCause && typeof data.rootCause === 'object' && !Array.isArray(data.rootCause)
            ? data.rootCause as Record<string, unknown>
            : {};
    data.rootCause = root;

    // ── 1. Chuỗi 5-Why ──
    const modelRows = (Array.isArray(root.fiveWhy) ? root.fiveWhy : [])
        .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
        .filter((row) => String(row.why ?? '').trim());
    const chainComplete = modelRows.length > 0
        && modelRows.every((row) => String(row.answer ?? '').trim());
    const findingChain = (finding?.derivedFiveWhy ?? [])
        .filter((row) => String(row?.question ?? '').trim() && String(row?.answer ?? '').trim())
        .map((row, index) => ({
            step: index + 1,
            why: row.question,
            answer: row.answer,
            evidence: row.evidence ?? '',
        }));
    if (context.fiveWhy.length) {
        if (!modelRows.length) {
            root.fiveWhy = context.fiveWhy.map((row) => ({
                step: row.stepNo,
                why: row.question,
                answer: row.answer,
                evidence: row.evidenceCitation,
            }));
            repairs.push('D4: rootCause.fiveWhy trống; chép lại chuỗi 5-Why đã ghi từ CaseContext.');
        } else {
            let patched = 0;
            for (const row of modelRows) {
                const recorded = context.fiveWhy.find((r) => r.stepNo === Number(row.step));
                if (!recorded) continue;
                if (!String(row.answer ?? '').trim()) { row.answer = recorded.answer; patched += 1; }
                if (!String(row.evidence ?? '').trim()) row.evidence = recorded.evidenceCitation;
            }
            if (patched) repairs.push(`D4: ${patched} bước 5-Why thiếu answer; điền lại từ bản ghi.`);
            root.fiveWhy = modelRows;
        }
    } else if (findingChain.length && (!modelRows.length || !chainComplete)) {
        root.fiveWhy = findingChain;
        usedFinding = true;
        repairs.push(modelRows.length
            ? 'D4: chuỗi 5-Why của model khuyết answer; thay bằng chuỗi từ chẩn đoán độc lập (proposed).'
            : 'D4: rootCause.fiveWhy trống; dùng chuỗi từ chẩn đoán độc lập (proposed).');
    } else if (modelRows.length) {
        root.fiveWhy = modelRows;
    }

    // ── 2. Bảng Ishikawa — luôn đủ sáu nhánh ──
    const boardRows = (Array.isArray(root.ishikawaBoard) ? root.ishikawaBoard : [])
        .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object');
    const boardWasEmpty = boardRows.length === 0;
    const byCategory = new Map<string, Record<string, unknown>>();
    for (const row of boardRows) {
        const category = String(row.category ?? '');
        if ((ISHIKAWA_CATEGORIES as readonly string[]).includes(category) && !byCategory.has(category)) {
            byCategory.set(category, row);
        }
    }
    let recordedRestored = 0;
    for (const recorded of context.ishikawa) {
        if (!(ISHIKAWA_CATEGORIES as readonly string[]).includes(recorded.category)) continue;
        const existing = byCategory.get(recorded.category);
        if (existing && String(existing.finding ?? '').trim()) continue;
        const verdict = [recorded.description, recorded.metricValue ? `(${recorded.metricValue})` : '']
            .filter(Boolean).join(' ').slice(0, D4_FINDING_MAX);
        byCategory.set(recorded.category, {
            category: recorded.category,
            finding: verdict,
            isRootCause: recorded.isRootCause,
            source: 'recorded',
        });
        recordedRestored += 1;
    }
    // Verdict của chẩn đoán độc lập cho nhánh còn trống: statement cho nhánh nó
    // chọn, reason cho năm nhánh nó loại, runner-up nếu có.
    const findingVerdicts = new Map<string, string>();
    if (finding) {
        if (String(finding.rootCauseStatement ?? '').trim()) {
            findingVerdicts.set(finding.rootCauseCategory, finding.rootCauseStatement);
        }
        for (const ruled of finding.ruledOut ?? []) {
            if (ruled && String(ruled.reason ?? '').trim() && !findingVerdicts.has(ruled.category)) {
                findingVerdicts.set(ruled.category, ruled.reason);
            }
        }
        if (finding.runnerUpCategory && finding.runnerUpReason
            && !findingVerdicts.has(finding.runnerUpCategory)) {
            findingVerdicts.set(finding.runnerUpCategory, finding.runnerUpReason);
        }
    }
    let fromFinding = 0;
    for (const category of ISHIKAWA_CATEGORIES) {
        const row = byCategory.get(category);
        if (row && String(row.finding ?? '').trim()) continue;
        const verdict = findingVerdicts.get(category);
        if (verdict) {
            byCategory.set(category, {
                category,
                finding: verdict.slice(0, D4_FINDING_MAX),
                isRootCause: false,
                source: 'proposed',
            });
            fromFinding += 1;
            usedFinding = true;
        } else if (!row) {
            byCategory.set(category, { category, finding: 'not assessed', isRootCause: false, source: 'proposed' });
        } else {
            row.finding = 'not assessed';
        }
    }
    if (recordedRestored) {
        repairs.push(`D4: bảng Ishikawa thiếu ${recordedRestored} nhánh đã ghi; chép lại từ CaseContext.`);
    }
    if (fromFinding) {
        repairs.push(`D4: ${fromFinding} nhánh Ishikawa trống; điền verdict từ chẩn đoán độc lập (proposed).`);
    }
    if (boardWasEmpty && !recordedRestored && !fromFinding) {
        repairs.push('D4: rootCause.ishikawaBoard trống; dựng khung 6M (not assessed).');
    }
    const board = ISHIKAWA_CATEGORIES.map((category) => byCategory.get(category)!);
    root.ishikawaBoard = board;

    // ── 3. Đúng một nhánh mang cờ root cause ──
    const marked = board.filter((row) => row.isRootCause === true);
    const recordedCategory = context.rootCause?.category;
    if (marked.length > 1) {
        const keep = marked.find((row) => row.category === recordedCategory)
            ?? marked.find((row) => row.category === finding?.rootCauseCategory)
            ?? marked[0];
        for (const row of marked) if (row !== keep) row.isRootCause = false;
        repairs.push(`D4: ${marked.length} nhánh Ishikawa cùng mang cờ root cause; chỉ giữ ${String(keep.category)}.`);
    } else if (!marked.length) {
        const target = recordedCategory && byCategory.has(recordedCategory)
            ? recordedCategory
            : finding && byCategory.has(finding.rootCauseCategory)
                ? finding.rootCauseCategory
                : null;
        if (target) {
            byCategory.get(target)!.isRootCause = true;
            if (target === recordedCategory) {
                repairs.push(`D4: không nhánh nào được đánh dấu root cause; đánh dấu lại ${target} theo bản ghi.`);
            } else {
                usedFinding = true;
                repairs.push(`D4: không nhánh nào được đánh dấu root cause; đánh dấu ${target} theo chẩn đoán độc lập (proposed).`);
            }
        }
    }

    // ── 4. Kết luận ──
    if (!String(root.statement ?? '').trim()) {
        const tagged = context.fiveWhy.find((row) => row.isRootCauseStep);
        const recordedFallback = context.rootCause
            ? `${context.rootCause.category}: ${context.rootCause.description}`
            : tagged?.answer ?? '';
        if (recordedFallback) {
            const clean = recordedFallback.replace(/^Root cause:\s*/i, '').trim();
            root.statement = `Root cause: ${clean}`.slice(0, D4_STATEMENT_MAX);
            repairs.push('D4: thiếu rootCause.statement; dựng lại từ root cause đã ghi.');
        } else if (finding && String(finding.rootCauseStatement ?? '').trim()) {
            const raw = finding.rootCauseStatement.trim().replace(/^(Root cause:\s*|Root cause \(hypothesis\):\s*)/i, '');
            root.statement = (
                `Root cause (hypothesis): ${raw}`
            ).slice(0, D4_STATEMENT_MAX);
            usedFinding = true;
            repairs.push('D4: thiếu rootCause.statement; dựng giả thuyết từ chẩn đoán độc lập.');
        }
    }

    // ── 5. Evidence gaps — chỉ điền khi model BỎ HẲN trường, không đè mảng rỗng
    //      có chủ đích ──
    if (root.evidenceGaps === undefined && finding?.evidenceGaps?.length) {
        const gaps = finding.evidenceGaps
            .filter((gap): gap is string => typeof gap === 'string' && gap.trim().length > 0)
            .slice(0, 10);
        if (gaps.length) {
            root.evidenceGaps = gaps;
            usedFinding = true;
            repairs.push('D4: thiếu rootCause.evidenceGaps; lấy từ chẩn đoán độc lập.');
        }
    }

    // Đã dùng chẩn đoán độc lập thì phải trích dẫn nó — luật grounding của D4.
    if (usedFinding && !d.sources.includes('independent')) d.sources.push('independent');
}

function backfillD1Suggestion(
    d: DisciplineDraft,
    context: CaseContext,
    precedents: unknown,
    repairs: string[],
): void {
    const data = (d.data ??= {});
    const team: Record<string, unknown> =
        data.team && typeof data.team === 'object' && !Array.isArray(data.team)
            ? data.team as Record<string, unknown>
            : {};

    const hasCurrentTeam = Boolean(context.team.leader) || context.team.members.length > 0;
    const hasPrecedentTeam = Array.isArray(precedents)
        && precedents.some((item: any) => Array.isArray(item?.team) && item.team.length > 0);

    const roster = Array.isArray(team.roster) ? team.roster : [];
    const isUnassignedOnly = roster.length > 0 && roster.every((r: any) => r?.sourceType === 'unassigned' || r?.name === 'Unassigned');

    if (!hasCurrentTeam && !hasPrecedentTeam) {
        data.team = team;
        team.selectionMethod = 'Roles only - assignment required';
        team.suggestionStatus = 'No team suggestion available; assign manually.';
        repairs.push('D1: không có dữ liệu đội ngũ khả dụng; hiển thị trạng thái gợi ý phân công thủ công.');
    } else if (isUnassignedOnly) {
        data.team = team;
        team.selectionMethod = 'Roles only - assignment required';
        team.suggestionStatus = 'No team suggestion available; assign manually.';
        repairs.push('D1: không có dữ liệu đội ngũ khả dụng; hiển thị trạng thái gợi ý phân công thủ công.');
    } else if (team.suggestionStatus) {
        delete team.suggestionStatus;
    }
}

function backfillD2IsIsNot(
    d: DisciplineDraft,
    context: CaseContext,
    repairs: string[],
): void {
    const data = (d.data ??= {});
    const problem: Record<string, unknown> =
        data.problem && typeof data.problem === 'object' && !Array.isArray(data.problem)
            ? data.problem as Record<string, unknown>
            : {};
    data.problem = problem;

    // Entry mode / How box
    if (!String(problem.how ?? '').trim()) {
        if (context.header.entryMode === 'during-inspection' && context.header.inspectionLotId) {
            problem.how = `Detected during in-process inspection (Lot: ${context.header.inspectionLotId})`;
            repairs.push('D2: điền problem.how từ inspection lot đã ghi.');
        } else if (context.header.entryMode === 'outside-inspection') {
            problem.how = 'Detected outside standard inspection';
            repairs.push('D2: điền problem.how theo ghi nhận ngoài quy trình kiểm tra.');
        }
    }

    const primaryChar = context.inspections.find((i) => i.outOfSpec)?.characteristic || context.inspections[0]?.characteristic;

    // Nếu có historicalInspectionLots -> tính theo R2.2.3
    if (context.historicalInspectionLots && context.historicalInspectionLots.length > 0) {
        const computed = computeIsIsNot(context.historicalInspectionLots, primaryChar);
        if (computed.applicable) {
            problem.is = computed.is;
            problem.isNot = computed.isNot;
            if (!String(problem.isIsNotBasis ?? '').trim() && computed.isIsNotBasis) {
                problem.isIsNotBasis = computed.isIsNotBasis;
            }
            delete problem.isIsNotStatus;
            if (!d.sources.includes('historicalInspectionLots')) {
                d.sources.push('historicalInspectionLots');
            }
            if (Array.isArray(problem.sources) && !problem.sources.includes('historicalInspectionLots')) {
                problem.sources.push('historicalInspectionLots');
            }
            repairs.push('D2: tính Is / Is-Not từ dữ liệu lô kiểm tra lịch sử (historicalInspectionLots).');
        } else {
            problem.is = [];
            problem.isNot = [];
            problem.isIsNotStatus = computed.reason;
            problem.isIsNotBasis = '';
            repairs.push(`D2: không đủ điều kiện so sánh Is / Is-Not (${computed.reason}).`);
        }
    } else if (context.isIsNot && (context.isIsNot.is || context.isIsNot.isNot)) {
        // Fallback vào isIsNot có sẵn trong context
        if (!Array.isArray(problem.is) || problem.is.length === 0) {
            problem.is = context.isIsNot.is ? [context.isIsNot.is] : [];
        }
        if (!Array.isArray(problem.isNot) || problem.isNot.length === 0) {
            problem.isNot = context.isIsNot.isNot ? [context.isIsNot.isNot] : [];
        }
        if (!String(problem.isIsNotBasis ?? '').trim() && context.isIsNot.notes) {
            problem.isIsNotBasis = context.isIsNot.notes;
        }
        delete problem.isIsNotStatus;
    } else {
        // Hoàn toàn không có dữ liệu so sánh
        problem.is = [];
        problem.isNot = [];
        problem.isIsNotStatus = primaryChar
            ? 'Cannot compare — there is no measurement history for this part.'
            : 'Not applicable — this defect has no measurable characteristic.';
        problem.isIsNotBasis = '';
    }
}

interface TeamMemberCandidate {
    name: string;
    role: string;
    responsibility: string;
}

function extractTeamCandidates(
    context: CaseContext,
    disciplines: DisciplineDraft[],
    previousDisciplines?: readonly DisciplineDraft[],
): TeamMemberCandidate[] {
    const candidates: TeamMemberCandidate[] = [];
    const seenNames = new Set<string>();

    const addCandidate = (name: string, role = '', responsibility = '') => {
        const cleanName = String(name || '').trim();
        if (!cleanName || cleanName.toLowerCase() === 'unassigned' || seenNames.has(cleanName.toLowerCase())) {
            return;
        }
        seenNames.add(cleanName.toLowerCase());
        candidates.push({ name: cleanName, role, responsibility });
    };

    // 1. From context.team
    if (context.team?.leader) {
        const l = context.team.leader;
        const leaderName = typeof l === 'string' ? l : ((l as any).partnerName || (l as any).name || '');
        if (leaderName) {
            addCandidate(leaderName, 'Team Leader', 'Overall 8D coordination and lead');
        }
    }
    for (const m of context.team?.members ?? []) {
        const memName = typeof m === 'string' ? m : ((m as any)?.partnerName || (m as any)?.name || '');
        if (memName) {
            const role = (m as any)?.partnerRole || (m as any)?.role || (m as any)?.functionTitle || '';
            addCandidate(memName, role, '');
        }
    }

    // 2. From D1 draft in disciplines or previousDisciplines
    const allDrafts = [...disciplines, ...(previousDisciplines ?? [])];
    const d1 = allDrafts.find((d) => d?.code === 'D1');
    if (d1?.data) {
        const teamObj = (d1.data as Record<string, unknown>).team || d1.data;
        const rawRoster = (teamObj as Record<string, unknown>)?.assignedRoster
            ?? (teamObj as Record<string, unknown>)?.roster
            ?? (d1.data as Record<string, unknown>)?.['team.assignedRoster']
            ?? (d1.data as Record<string, unknown>)?.['team.roster'];
        const roster = Array.isArray(rawRoster) ? rawRoster as unknown[] : [];
        for (const row of roster) {
            const r = row as Record<string, unknown>;
            if (r?.name && String(r.name).toLowerCase() !== 'unassigned') {
                const role = String(r.assigned8DRole && r.assigned8DRole !== 'Team Member' ? r.assigned8DRole : (r.organizationalRole || r.assigned8DRole || (r as any).functionTitle || '')).trim();
                addCandidate(
                    String(r.name),
                    role,
                    String(r.caseResponsibility || ''),
                );
            }
        }
    }

    return candidates;
}

const DOMAIN_RULES: Array<{
    actionKeywords: string[];
    roleKeywords: string[];
}> = [
    {
        // Quality assurance, inspection, containment, measurements, FMEA
        actionKeywords: [
            'quarantine', 'hold', 'sort', 'containment', 'inspect', 'inspection', 'check', 'measurement',
            'measure', 'gauge', 'cmm', 'roughness', 'burr', 'tolerance', 'dimension', 'sampling',
            'audit', 'defect', 'nonconforming', 'quality', 'qe', 'fai', 'first-article', 'fmea', 'incoming', 'outgoing', 'dock',
        ],
        roleKeywords: ['quality', 'qe', 'inspector', 'inspection', 'qa', 'audit', 'fmea'],
    },
    {
        // Maintenance, tooling, calibration, machine repair
        actionKeywords: [
            'maintenance', 'pm', 'tool', 'tooling', 'fixture', 'clamp', 'spindle', 'wheel', 'grind',
            'calibrate', 'calibration', 'dressing', 'clean', 'service', 'repair', 'lubricate', 'recondition',
            'wear', 'sensor', 'hydraulics', 'mechanic', 'preventive',
        ],
        roleKeywords: ['maintenance', 'technician', 'tooling', 'mechanic', 'planner', 'equipment'],
    },
    {
        // Production, machinist, machining, setup, NC program
        actionKeywords: [
            'production', 'operator', 'machinist', 'machining', 'milling', 'turning', 'lathe',
            'feed rate', 'speed', 'cutting', 'parameter', 'nc program', 'setup', 'run', 'batch',
            'line', 'shift', 'work center', 'assembly', 'weld',
        ],
        roleKeywords: ['production', 'operator', 'machinist', 'line', 'shift', 'manufacturing'],
    },
    {
        // Process engineering, industrial engineering, SOP, specification
        actionKeywords: [
            'process', 'engineering', 'specification', 'drawing', 'procedure', 'sop', 'instruction',
            'standardize', 'parameter', 'fmea', 'control plan', 'training',
        ],
        roleKeywords: ['process', 'engineer', 'engineering', 'methods', 'industrial'],
    },
];

const STOP_WORDS = new Set(['and', 'the', 'for', 'with', 'from', 'that', 'this', 'have', 'has', 'per', 'all', 'into', 'each', 'after', 'over', 'out']);

function formatCandidate(c: TeamMemberCandidate): string {
    const role = c.role.trim();
    return role ? `${c.name} (${role})` : c.name;
}

function resolveAssigneeFromTeam(
    currentOwner: string,
    actionText: string,
    candidates: TeamMemberCandidate[],
): string | null {
    if (!candidates.length) return null;

    const trimmed = String(currentOwner ?? '').trim();
    // If it's already an exact match to a candidate's name or candidate already has (role)
    const exactMatch = candidates.find((c) => {
        const nameMatch = c.name.toLowerCase() === trimmed.toLowerCase();
        const formattedMatch = formatCandidate(c).toLowerCase() === trimmed.toLowerCase();
        return nameMatch || formattedMatch;
    });
    if (exactMatch) return formatCandidate(exactMatch);

    // Clean currentOwner (strip "Unassigned", parentheses, etc.)
    const cleanedOwner = trimmed
        .replace(/^Unassigned\s*(\([^)]*\))?/i, '')
        .trim();

    const searchBlob = `${cleanedOwner} ${actionText}`.toLowerCase();

    // Score candidates based on keyword overlap with their role, responsibility, and name
    let bestCandidate: TeamMemberCandidate | null = null;
    let highestScore = 0;

    for (const c of candidates) {
        let score = 0;
        const roleLower = c.role.toLowerCase();
        const respLower = c.responsibility.toLowerCase();
        const nameLower = c.name.toLowerCase();

        // 1. Direct mention of member name
        if (nameLower && searchBlob.includes(nameLower)) score += 30;

        // 2. Direct keyword in role / resp mentioned in searchBlob
        const roleTokens = `${roleLower} ${respLower}`
            .split(/[\s,./·()_-]+/)
            .map((t) => t.trim())
            .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

        for (const token of roleTokens) {
            if (searchBlob.includes(token)) {
                score += 6;
            }
        }

        // 3. Domain clustering rules (weighted by number of action keywords)
        for (const rule of DOMAIN_RULES) {
            const matchesRole = rule.roleKeywords.some((rk) => roleLower.includes(rk) || respLower.includes(rk));
            if (matchesRole) {
                const matchedActionKws = rule.actionKeywords.filter((kw) => searchBlob.includes(kw));
                score += matchedActionKws.length * 8;
            }
        }

        if (score > highestScore) {
            highestScore = score;
            bestCandidate = c;
        }
    }

    const picked = highestScore > 0 ? bestCandidate : candidates[0];
    return picked ? formatCandidate(picked) : null;
}

function backfillActionOwners(
    disciplines: DisciplineDraft[],
    context: CaseContext,
    previousDisciplines?: readonly DisciplineDraft[],
    repairs?: string[],
): void {
    const candidates = extractTeamCandidates(context, disciplines, previousDisciplines);
    if (!candidates.length) return;

    for (const d of disciplines) {
        if (!['D3', 'D5', 'D7'].includes(d.code) || !d.data) continue;

        let actionArray: Array<Record<string, unknown>> | null = null;
        if (d.code === 'D3') {
            if (Array.isArray((d.data as any)['containment.actions'])) {
                actionArray = (d.data as any)['containment.actions'];
            } else if (Array.isArray((d.data as any).containment?.actions)) {
                actionArray = (d.data as any).containment.actions;
            }
        } else if (d.code === 'D5') {
            if (Array.isArray((d.data as any)['corrective.actions'])) {
                actionArray = (d.data as any)['corrective.actions'];
            } else if (Array.isArray((d.data as any).corrective?.actions)) {
                actionArray = (d.data as any).corrective.actions;
            }
        } else if (d.code === 'D7') {
            if (Array.isArray((d.data as any)['preventive.actions'])) {
                actionArray = (d.data as any)['preventive.actions'];
            } else if (Array.isArray((d.data as any).preventive?.actions)) {
                actionArray = (d.data as any).preventive.actions;
            }
        }

        if (!actionArray) continue;

        let assignedCount = 0;
        for (const act of actionArray) {
            if (!act || typeof act !== 'object') continue;
            const currentOwner = String(act.owner ?? '').trim();
            const actionText = String(act.action || act.actionText || '').trim();

            const resolved = resolveAssigneeFromTeam(currentOwner, actionText, candidates);
            if (resolved && resolved !== currentOwner) {
                act.owner = resolved;
                assignedCount += 1;
            }
        }

        if (assignedCount > 0 && repairs) {
            repairs.push(`${d.code}: gán người phụ trách cho ${assignedCount} hành động từ danh sách đội ngũ D1.`);
        }
    }
}

export function postProcess(
    result: EightDResult,
    context: CaseContext,
    enrichment?: unknown,
    independent?: unknown,
    /** Tiền lệ đã tìm được — để `precedents#N` trong `sources` giải được. */
    precedents?: unknown,
    constraintsJson?: string | Partial<Record<DisciplineCode, string>>,
    /**
     * Chỉ dựng lại đúng những bước này. Bỏ trống = cả tám, tức hành vi cũ.
     *
     * Cần cho chế độ sinh từng bước: gọi hàm này với đúng một discipline mà
     * không giới hạn phạm vi thì bảy bước còn lại bị coi là "model bỏ sót" và
     * được thay bằng placeholder — kết quả trả về là mảng D1..D8 đầy đủ, nên
     * bên gọi lấy `disciplines[0]` sẽ luôn nhận ô D1 thay vì bước vừa sinh.
     */
    only?: readonly DisciplineCode[],
    previousDisciplines?: readonly DisciplineDraft[],
): { result: EightDResult; repairs: string[] } {
    const repairs: string[] = [];
    const incoming = Array.isArray(result?.disciplines) ? result.disciplines : [];
    const vocab = buildSourceVocabulary(context, enrichment, independent, precedents);

    const byCode = new Map<string, DisciplineDraft>();
    for (const d of incoming) {
        if (!d || typeof d !== 'object') continue;
        if (byCode.has(d.code)) {
            repairs.push(`Model trả trùng ${d.code}; giữ bản đầu tiên.`);
            continue;
        }
        byCode.set(d.code, d);
    }

    const unknown = [...byCode.keys()].filter(
        (c) => !DISCIPLINE_CODES.includes(c as DisciplineCode),
    );
    if (unknown.length) repairs.push(`Model trả mã lạ, đã bỏ: ${unknown.join(', ')}.`);

    // Lọc từ `DISCIPLINE_CODES` chứ không dùng thẳng `only`: thứ tự và `sequence`
    // phải là thứ tự chuẩn D1..D8, không phải thứ tự bên gọi truyền vào.
    const targetCodes = only?.length
        ? DISCIPLINE_CODES.filter((code) => only.includes(code))
        : DISCIPLINE_CODES;

    const disciplines = targetCodes.map((code) => {
        const i = DISCIPLINE_CODES.indexOf(code);
        const found = byCode.get(code);
        if (!found) {
            repairs.push(`Thiếu ${code}; chèn placeholder.`);
            return placeholder(code, i);
        }

        const d: DisciplineDraft = {
            ...found,
            code,
            sequence: i + 1,
            title: String(found.title ?? '').trim() || DISCIPLINE_TITLES[code],
            summary: String(found.summary ?? '').trim(),
            content: String(found.content ?? '').trim(),
            actionItems: Array.isArray(found.actionItems) ? found.actionItems : [],
            sources: Array.isArray(found.sources) ? found.sources : [],
            confidence: Number(found.confidence),
            dataBacked: Boolean(found.dataBacked),
            data: found.data && typeof found.data === 'object' && !Array.isArray(found.data) ? found.data : {},
        };

        if (d.summary.length > 500) {
            repairs.push(`${code}: summary dài ${d.summary.length} ký tự; cắt còn 500.`);
            d.summary = `${d.summary.slice(0, 497)}...`;
        }

        if (!Number.isFinite(d.confidence)) {
            repairs.push(`${code}: confidence không phải số; đặt 0.`);
            d.confidence = 0;
        } else if (d.confidence < 0 || d.confidence > 1) {
            repairs.push(`${code}: confidence ${d.confidence} ngoài khoảng 0..1; kẹp lại.`);
            d.confidence = Math.min(1, Math.max(0, d.confidence));
        }

        // D6 không bao giờ có dữ liệu verification trong dataset này. Model tự
        // tin ở đây nghĩa là nó đang bịa — hạ cờ và ghi nhận.
        if (code === 'D6' && d.dataBacked) {
            repairs.push(
                'D6 được đánh dataBacked=true nhưng dataset không có dữ liệu verification; hạ xuống false.',
            );
            d.dataBacked = false;
        }

        // ── Kiểm tra sources có trỏ vào thứ thật sự tồn tại không ──
        // Không kiểm thì `sources` chỉ là chuỗi tự do và lớp chống bịa thành
        // trang trí: model viết 'fiveWhy#7' trên case có 3 bước vẫn lọt.
        const { known, unknown } = checkSources(d.sources, vocab);
        if (unknown.length) {
            repairs.push(`${code}: sources không tồn tại trong CaseContext: ${unknown.join(', ')}.`);
            d.sources = known;
        }
        // Cùng bộ lọc cho data.sources — đây là mảng hiển thị ở UI (Source records).
        // Không lọc thì `d.sources` (cột cũ) sạch nhưng `data.sources` (cấu trúc mới)
        // vẫn còn path bịa, và người đọc thấy "[object Object]" thay vì cảnh báo.
        if (d.data && Array.isArray(d.data.sources)) {
            const dataSources = (d.data.sources as unknown[]).filter((s): s is string => typeof s === 'string');
            const { known: dataKnown, unknown: dataUnknown } = checkSources(dataSources, vocab);
            if (dataUnknown.length) {
                repairs.push(`${code}: data.sources không tồn tại trong CaseContext: ${dataUnknown.join(', ')}.`);
                d.data.sources = dataKnown;
            }
        }

        // Khẳng định có dữ liệu chống lưng mà không chỉ ra được nguồn nào thì
        // không phải khẳng định có dữ liệu chống lưng.
        if (d.dataBacked && d.sources.length === 0) {
            repairs.push(
                `${code}: dataBacked=true nhưng không còn source hợp lệ nào; hạ xuống false.`,
            );
            d.dataBacked = false;
        }

        return d;
    });

    const d1 = disciplines.find((discipline) => discipline.code === 'D1');
    if (d1) backfillD1Suggestion(d1, context, precedents, repairs);

    const d2 = disciplines.find((discipline) => discipline.code === 'D2');
    if (d2) backfillD2IsIsNot(d2, context, repairs);

    // D4 phải ra ĐỦ (statement, 5-Why có answer, bảng Ishikawa sáu nhánh, cờ
    // root cause) trên mọi lượt chạy — kể cả khi model bỏ sót, kể cả khi cả
    // discipline bị thay bằng placeholder. Dữ liệu đã ghi và chẩn đoán độc lập
    // là hai nguồn code tự chiếu lại được.
    const d4 = disciplines.find((discipline) => discipline.code === 'D4');
    if (d4) backfillRootCause(d4, context, independent, repairs);

    // Gán assignee từ đội ngũ D1 cho các hành động D3, D5, D7
    backfillActionOwners(disciplines, context, previousDisciplines, repairs);

    // ── Discipline nào không có fact nào chống lưng thì không được tự tin ──
    // Ánh xạ từ mã discipline sang chỗ chứa fact tương ứng trong CaseContext.
    const unsupported: Partial<Record<DisciplineCode, boolean>> = {
        D3: context.actions.containment.length === 0,
        D5: context.actions.corrective.length === 0,
        D7: context.actions.preventive.length === 0 && !context.fmea,
        D8: !context.lessonsLearned,
    };
    for (const d of disciplines) {
        if (unsupported[d.code] && d.dataBacked) {
            repairs.push(
                `${d.code}: dataBacked=true nhưng CaseContext không có dữ liệu nguồn tương ứng; hạ xuống false.`,
            );
            d.dataBacked = false;
        }
    }

    const configuredConstraints: Partial<Record<DisciplineCode, string>> = typeof constraintsJson === 'string' ? { D1: constraintsJson } : (constraintsJson ?? {});
    if (d1 && configuredConstraints.D1) {
        const hasCurrentTeam = Boolean(context.team.leader) || context.team.members.length > 0;
        const hasPrecedentTeam = Array.isArray(precedents)
            && precedents.some((item: any) => Array.isArray(item?.team) && item.team.length > 0);
        if (!hasCurrentTeam && !hasPrecedentTeam && d1.dataBacked) {
            repairs.push('D1: dataBacked=true but neither current nor precedent team data exists; set to false.');
            d1.dataBacked = false;
        }
        const groundedSources = d1.sources.filter((source) => /^(team\.|precedents#)/.test(source));
        if (groundedSources.length !== d1.sources.length) {
            repairs.push('D1: removed team sources that were not grounded in team.* or precedents#N.');
            d1.sources = groundedSources;
            if (d1.sources.length === 0) d1.dataBacked = false;
        }
    }

    for (const discipline of disciplines) {
        const json = configuredConstraints[discipline.code];
        if (!json) continue;
        try {
            const config = JSON.parse(json) as { rules?: Array<{ type?: string; enabled?: boolean; pattern?: string; message?: string }> };
            for (const rule of config.rules ?? []) {
                if (rule.enabled === false) continue;
                if (rule.type === 'sourcePattern' && rule.pattern) {
                    const pattern = new RegExp(rule.pattern);
                    const grounded = discipline.sources.filter((source) => pattern.test(source));
                    if (grounded.length !== discipline.sources.length) {
                        repairs.push(`${discipline.code}: removed sources outside configured pattern ${rule.pattern}.`);
                        discipline.sources = grounded;
                        if (!grounded.length) discipline.dataBacked = false;
                    }
                    // Cùng pattern cho data.sources — UI render mảng này trong Source records.
                    if (discipline.data && Array.isArray(discipline.data.sources)) {
                        const dataSources = discipline.data.sources as unknown[];
                        const groundedData = dataSources.filter((item): item is string => typeof item === 'string' && pattern.test(item));
                        if (groundedData.length !== dataSources.length) {
                            repairs.push(`${discipline.code}: filtered data.sources against pattern ${rule.pattern}.`);
                            discipline.data.sources = groundedData;
                        }
                    }
                }
                if (rule.type === 'requiredDisclosure' && rule.pattern && !new RegExp(rule.pattern, 'i').test(discipline.content)) {
                    repairs.push(`${discipline.code}: required disclosure is missing (${rule.message ?? rule.pattern}).`);
                }
            }
        } catch {
            repairs.push(`${discipline.code}: configured constraints could not be evaluated.`);
        }
    }

    // ── Ràng buộc Q1-ONLY-CUSTOMER-FIELDS, thực thi ở code ──
    // Không phó thác cho model: đây là luật của dataset, không phải lựa chọn văn phong.
    let customerSummary = result?.customerSummary ?? null;
    if (typeof customerSummary === 'string' && customerSummary.trim() === '') customerSummary = null;

    if (!context.isCustomerFacing && customerSummary) {
        repairs.push('Case Q3 nhưng model vẫn sinh customerSummary; bỏ đi.');
        customerSummary = null;
    }
    if (context.isCustomerFacing && !customerSummary) {
        repairs.push('Case Q1 nhưng model không sinh customerSummary.');
    }

    return {
        result: {
            internalSummary: String(result?.internalSummary ?? '').trim(),
            customerSummary,
            disciplines,
        },
        repairs,
    };
}
