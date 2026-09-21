/**
 * Giá trị mặc định cho cấu hình truy hồi.
 *
 * ── Vì sao KHÔNG dùng CSV trong `db/data/` ──
 * CAP dịch CSV thành `.hdbtabledata` và HDI ghi đè toàn bộ bảng ở MỖI lần deploy.
 * Với dữ liệu tham chiếu bất biến thì hợp lý; với bảng admin chỉnh trên UI thì
 * đó là mất dữ liệu: chỉnh trọng số hôm nay, deploy ngày mai là về mặc định mà
 * không ai được báo.
 *
 * Nên seed bằng code lúc khởi động và CHỈ khi bảng rỗng. DB mới (kể cả HDI trên
 * CF) tự có mặc định; deploy lại giữ nguyên phần đã chỉnh.
 *
 * Trọng số dưới đây lấy nguyên văn từ `docs/AI Requirements - 8D Copilot POC.md`
 * mục 2. Sửa ở đây là sửa hành vi đã được acceptance criteria chốt.
 */

import type { Criterion } from './scoring';
import { DEFAULT_DISCIPLINE_GUIDE } from '../prompts';

export const DEFAULT_CRITERIA: readonly (Criterion & {
    description: string;
    sourceTable: string;
})[] = Object.freeze([
    Object.freeze({
        criterionKey: 'workCenter',
        label: 'Work center',
        description:
            'Same production line or machine group. The strongest single signal for D1: '
            + 'who has worked this equipment before is a question about identity, not about wording.',
        sourceTable: 'HistoricalCases · GD 4 WorkCenters',
        sourceField: 'workCenterId',
        matchType: 'exact',
        weight: 4,
        fallbackField: null,
        fallbackMatch: null,
        fallbackWeight: null,
        enabled: true,
        sortOrder: 10,
    }),
    Object.freeze({
        criterionKey: 'defectCode',
        label: 'Defect code',
        description:
            'Same catalogued defect. Falls back to shared keywords in the defect text when the '
            + 'codes differ — two plants often catalogue the same failure under different codes.',
        sourceTable: 'HistoricalCases · GD 3 Defects',
        sourceField: 'defectCode',
        matchType: 'exact',
        weight: 4,
        fallbackField: 'defectKeywords',
        fallbackMatch: 'keyword',
        fallbackWeight: 2,
        enabled: true,
        sortOrder: 20,
    }),
    Object.freeze({
        criterionKey: 'material',
        label: 'Material',
        description:
            'Same part number. Falls back to the same material group when the parts differ but '
            + 'belong to one family.',
        sourceTable: 'HistoricalCases · GD 1 Materials',
        sourceField: 'materialId',
        matchType: 'exact',
        weight: 3,
        fallbackField: 'materialFamily',
        fallbackMatch: 'family',
        fallbackWeight: 1,
        enabled: true,
        sortOrder: 30,
    }),
    Object.freeze({
        criterionKey: 'semantic',
        label: 'Similar description',
        description:
            'Semantic similarity between the two case narratives, from an embedding of the defect, '
            + 'the investigation findings and the causal chain. This is the only criterion that can '
            + 'connect two cases whose work centre, part and defect code all differ — the case where '
            + 'the same failure was written up in different words.',
        sourceTable: 'HistoricalCases.searchText (embedding)',
        sourceField: 'embedding',
        matchType: 'cosine',

        /**
         * Trọng số 5 — ngang một lần trùng work center (4).
         *
         * Với sàn 0.70, một case chỉ giống về ngữ nghĩa ăn 5 × 0.70 = 3.5 điểm,
         * vừa đủ vượt ngưỡng 3. Thấp hơn thì tiêu chí này không bao giờ tự đưa
         * nổi một case vào danh sách, tức là có cũng như không.
         */
        weight: 5,
        fallbackField: null,
        fallbackMatch: null,
        fallbackWeight: null,

        /**
         * Sàn 0.70, chọn theo SỐ ĐO chứ không theo cảm giác.
         *
         * `npx tsx scripts/measure-similarity.mjs` trên 78 cặp của kho hiện tại:
         *
         *     thấp nhất 0.543 · p25 0.608 · trung vị 0.636 · p75 0.687 · cao nhất 0.792
         *
         * Nền cao như vậy vì mọi case đều là văn bản lỗi sản xuất tiếng Anh cùng
         * khuôn — chúng giống nhau sẵn ~0.6 mà chẳng liên quan gì tới nhau. Sàn
         * 0.55 sẽ cho điểm 77/78 cặp và thứ hạng bị nhiễu nền chi phối.
         *
         * 0.70 nằm trên p75, giữ lại đúng nhóm đầu. Đổi công thức ghép
         * `searchText` hoặc đổi model nhúng ⇒ ĐO LẠI, vì phân bố sẽ khác.
         */
        minSimilarity: 0.70,
        enabled: true,
        sortOrder: 40,
    }),
]);

export const DEFAULT_RETRIEVAL_SETTINGS = Object.freeze({
    ID: 'GLOBAL',
    minScore: 3,
    topN: 3,
    closedOnly: true,
});

/**
 * Hai profile re-rank cho D4/D5, seed idempotent lúc khởi động.
 *
 * ── Vì sao phải TÁCH profile thay vì thêm tiêu chí vào `default` ──
 * Cả tám bước đang bind chung `default`. Instruction re-rank của D4 ("cùng cơ
 * chế hỏng") khác hẳn D5 ("action có gỡ được nguyên nhân không") — nhét vào
 * `default` là bắt cả tám bước hỏi chung một câu, sai cho cả tám. Mỗi bước một
 * profile riêng thì mỗi bước hỏi đúng câu của nó, và bật/tắt độc lập.
 *
 * ── Vì sao `enabled: false` ──
 * Re-rank tốn một lượt model mỗi lần tìm và chưa có số đo trên kho thật. Seed
 * tắt để admin THẤY nó tồn tại trên UI, đọc instruction hiểu nó làm gì, và tự
 * quyết bật sau khi chạy eval — không âm thầm đổi hành vi ngay khi deploy.
 *
 * `description` chính là instruction gửi cho model (xem `reranker.ts`) — admin
 * sửa được trên UI, không cần deploy lại.
 */
export const RERANK_PROFILE_SPECS: readonly {
    profileKey: string;
    label: string;
    profileDescription: string;
    stepCode: 'D4' | 'D5';
    criterion: Criterion & { description: string; sourceTable: string };
}[] = Object.freeze([
    Object.freeze({
        profileKey: 'diagnosis',
        label: 'Diagnosis (D4)',
        profileDescription:
            'Cloned from Default for D4. Adds an optional LLM re-rank pass tuned to '
            + '"same failure mechanism" — enable it on the rerank criterion after evaluating.',
        stepCode: 'D4' as const,
        criterion: Object.freeze({
            criterionKey: 'rerank',
            label: 'Mechanism re-rank',
            description:
                'Rank by same physical failure mechanism: judge whether the two cases fail '
                + 'the same way for the same physical reason. Ignore superficial matches of '
                + 'defect codes, part numbers or plant names.',
            sourceTable: 'LLM re-rank (stage 2)',
            sourceField: '',
            matchType: 'rerank',
            weight: 3,
            fallbackField: null,
            fallbackMatch: null,
            fallbackWeight: null,
            /** Sàn trên thang 0-1 của điểm model: dưới 50/100 coi như không liên quan. */
            minSimilarity: 0.5,
            enabled: false,
            sortOrder: 50,
        }),
    }),
    Object.freeze({
        profileKey: 'corrective',
        label: 'Corrective (D5)',
        profileDescription:
            'Cloned from Default for D5. Adds an optional LLM re-rank pass tuned to '
            + '"does the candidate’s corrective action address this root cause" — '
            + 'enable it on the rerank criterion after evaluating.',
        stepCode: 'D5' as const,
        criterion: Object.freeze({
            criterionKey: 'rerank',
            label: 'Action-fit re-rank',
            description:
                'Rank by whether the candidate case’s corrective action would remove the '
                + 'root cause described in the query case. A case with the same defect but an '
                + 'unrelated cause ranks low; a case with a different defect whose action '
                + 'removes the same cause ranks high.',
            sourceTable: 'LLM re-rank (stage 2)',
            sourceField: '',
            matchType: 'rerank',
            weight: 3,
            fallbackField: null,
            fallbackMatch: null,
            fallbackWeight: null,
            minSimilarity: 0.5,
            enabled: false,
            sortOrder: 50,
        }),
    }),
]);

/**
 * Tám dòng hướng dẫn discipline, seed bằng CHÍNH nội dung đang chạy.
 *
 * ── Vì sao seed nội dung thật thay vì để trống ──
 * Bản đầu để trống, với lý do "trống = dùng hằng số trong code, tránh hai bản
 * sao lệch nhau". Đúng về mặt kỹ thuật nhưng vô dụng trên thực tế: người dùng
 * mở UI thấy tám ô rỗng, không biết prompt hiện tại viết gì, và muốn chỉnh một
 * câu thì phải đi lục `prompts.ts` rồi chép sang.
 *
 * Nỗi lo lệch bản vẫn còn thật, và được xử bằng nút "Reset all steps": nó xoá
 * dòng rồi seed lại từ `DEFAULT_DISCIPLINE_GUIDE`, tức là kéo bản trong DB về
 * đúng bản trong code bất cứ lúc nào.
 *
 * Nguồn duy nhất vẫn là `DEFAULT_DISCIPLINE_GUIDE` — ở đây chỉ tham chiếu tới
 * nó, không chép lại text.
 */
const structuredField = (key: string, label: string, widget: string, dataType: string, colSpan: number, constraints: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({ key, label, widget, dataType, colSpan, constraints, ...extra });
const group = (id: string, label: string, fieldKeys: string[], width: string, order: number) => ({ id, label, fieldKeys, width, columns: 12, order });

const D1_FORM_SCHEMA = JSON.stringify({ fields: [
    structuredField('team.objective', 'Team objective', 'callout', 'string', 12, { required: true, minLength: 20, maxLength: 260 }),
    structuredField('team.selectionMethod', 'Selection method', 'status', 'string', 4, { required: true, enum: ['Current case team', 'Precedent recommendation', 'Hybrid', 'Roles only - assignment required'] }),
    structuredField('team.problemCapabilities', 'Capabilities required by this problem', 'tag-selector', 'array', 8, { required: true, minItems: 1 }, { items: { type: 'string' } }),
    structuredField('team.selectionRationale', 'How the team was selected', 'markdown', 'string', 12, { required: true, minLength: 60, maxLength: 1600 }),
    structuredField('team.roster', 'AI suggest', 'ai-suggest', 'array', 12, { required: true, minItems: 1 }, { items: { type: 'object', properties: { name: { type: 'string', maxLength: 120, description: 'ONLY the person name, or "Unassigned". No role, no reasoning.' }, organizationalRole: { type: 'string', maxLength: 120, description: 'ONLY their job title in the organisation, e.g. "Quality Engineer".' }, assigned8DRole: { type: 'string', maxLength: 60, description: 'ONLY their role in THIS 8D, e.g. "Team Leader" or "Team Member".' }, caseResponsibility: { type: 'string', maxLength: 200, description: 'What this person is accountable for here. Never a job title.' }, selectionReason: { type: 'string', maxLength: 220, description: 'Why this person, in one line. Do not repeat the name or the role.' }, servedOnCount: { type: 'integer', description: 'How many qualifying precedent cases this person served on. Rank the roster by this value, descending.' }, sourceType: { type: 'string', enum: ['current_case', 'precedent', 'unassigned'] }, sourcePath: { type: 'string', maxLength: 80, description: 'ONLY the resolvable path: team.leader, team.members#N, precedents#N.team#M, or team.gaps.' }, sourceCase: { type: 'string', maxLength: 60, description: 'ONLY the precedent notification id, when the person came from a precedent.' } }, required: ['name', 'organizationalRole', 'assigned8DRole', 'caseResponsibility', 'selectionReason', 'sourceType', 'sourcePath'] } }),
    // Nhom nguoi dung THUC SU chot - do con nguoi nhap, KHONG phai AI sinh.
    //
    // Van phai khai o day vi `normalizeStepConfig` bat Data Schema va Form
    // Editor khop field chinh xac; thieu mot ben la ca cau hinh D1 vo. Nhung
    // `required` de trong: bao cao vua phan tich xong thi chua ai gan nhom, va
    // bat buoc mot field ma quy trinh chua the dien se sinh loi validate gia.
    //
    // `xSource: 'manual_input'` la thu phan biet no voi chin field kia tren Data
    // Schema - de nguoi doc biet ngay o day khong cho AI ghi.
    structuredField('team.assignedRoster', 'Decision table', 'decision-table', 'array', 12, {}, { xSource: 'manual_input', description: 'Filled in by the quality engineer on the report screen. The AI never writes this.', items: { type: 'object', properties: { partnerId: { type: 'string' }, partnerName: { type: 'string' }, functionTitle: { type: 'string' }, partnerRole: { type: 'string', enum: ['8D Team Leader', '8D Team Member'] } } } }),
    structuredField('team.readinessStatus', 'Team readiness', 'status', 'string', 3, { required: true, enum: ['Ready', 'Partial', 'Needs assignment'] }),
    structuredField('team.readinessRationale', 'Readiness assessment', 'markdown', 'string', 9, { required: true, minLength: 30, maxLength: 500 }),
    structuredField('team.uncoveredCapabilities', 'Uncovered capabilities', 'warning-list', 'array', 6, {}, { items: { type: 'string' } }),
    structuredField('team.sourceSummary', 'Where the team recommendation came from', 'markdown', 'string', 6, { required: true, minLength: 30, maxLength: 500 }),
    structuredField('team.suggestionStatus', 'Suggestion status', 'callout', 'string', 12, {}),
    structuredField('sources', 'Source records', 'evidence-list', 'array', 12, { pattern: '^(team\\.|precedents#)' }, { items: { type: 'string' } }),
], groups: [
    // D1 mac dinh chi bay MOT field ra bao cao: bang nhom 8D.
    //
    // Chin field con lai VAN duoc AI sinh va van bi luat grounding cua D1 kiem
    // tra - chung chi khong nam trong group nao, nen roi vao panel "Available
    // Fields" cua Form Editor. Ai muon hien them thi keo vao group; khong ai
    group('d1-decision-table', 'Decision Table', ['team.assignedRoster', 'team.suggestionStatus'], '100', 10),
] }, null, 2);

const D2_FORM_SCHEMA = JSON.stringify({ fields: [
    // Tham chieu khieu nai: doc thang tu `CaseContext.customer` (SAP QM), KHONG
    // cho AI viet. `caseMapper` da bocs san va co co `applicable` de phan biet
    // "case Q3 nen khong co khach" voi "thieu du lieu" - widget tu an khi khong ap dung.
    structuredField('problem.complaintReference', 'Complaint reference', 'complaint-reference', 'string', 12, {}, { xSource: 'sap_qm', description: 'Read from the SAP QM customer reference on the case. The AI never writes this.' }),
    structuredField('problem.statement', 'Problem statement', 'problem-statement', 'string', 12, { required: true, minLength: 30, maxLength: 600 }),
    // Ban mo ta do KY SU tu sua, giu rieng khoi ban AI viet.
    //
    // Ghi de thang len `problem.statement` thi mat ban goc cua AI, va khong con
    // doi chieu duoc "may viet gi" voi "nguoi sua thanh gi" - dung nguyen tac da
    // dung cho `team.assignedRoster` o D1.
    structuredField('problem.statementOverride', 'Problem statement (edited)', 'text', 'string', 12, {}, { xSource: 'manual_input', description: 'Edited by the quality engineer on the report screen. The AI never writes this.' }),
    // 5W2H: sau o doc lap, moi o mot field - keo tha rieng tung o tren Form Editor.
    // colSpan 4 => tu xep thanh luoi 3 cot trong he 12 cot, dung nhu mockup.
    ...[['what', 'What'], ['where', 'Where'], ['when', 'When'], ['who', 'Who'], ['how', 'How'], ['extent', 'How Many']].map(([key, label]) => structuredField(`problem.${key}`, label, 'w2h-cell', 'string', 4, ['what', 'where', 'extent'].includes(key) ? { required: true } : {})),
    structuredField('problem.impact', 'Business / customer impact', 'text', 'string', 12, {}),
    structuredField('problem.is', 'Is', 'is-box', 'array', 6, {}, { items: { type: 'string' } }), structuredField('problem.isNot', 'Is not', 'isnot-box', 'array', 6, {}, { items: { type: 'string' } }),
    structuredField('problem.isIsNotStatus', 'Is / Is-Not status', 'callout', 'string', 12, {}),
    // Can cu cua Is/Is-Not. `CaseContext.isIsNot.notes` DA co du lieu nay nhung
    // truoc day D2 khong co field nao de chua, nen no bi bo phi.
    structuredField('problem.isIsNotBasis', 'Is / Is-Not basis', 'markdown', 'string', 12, {}),
    structuredField('problem.measuredEvidence', 'Measured evidence', 'table', 'array', 12, {}, { items: { type: 'object', properties: { characteristic: { type: 'string', maxLength: 120, description: 'ONLY the characteristic name, e.g. "Burr height". No value, no verdict.' }, measured: { type: 'string', maxLength: 60, description: 'ONLY the measured value with its unit, e.g. "0.32 mm".' }, specification: { type: 'string', maxLength: 60, description: 'ONLY the specification limit with its unit, e.g. "max 0.10 mm".' }, assessment: { type: 'string', maxLength: 120, description: 'ONLY the verdict, e.g. "Out of tolerance" or "Within spec". No restatement of the numbers.' } } } }),
    structuredField('problem.gaps', 'Missing facts', 'warning-list', 'array', 12, {}, { items: { type: 'string' } }), structuredField('sources', 'Evidence and traceability', 'evidence-list', 'array', 12, {}, { items: { type: 'string' } }),
], groups: [group('d2-ai-result', 'AI-generated problem description', ['problem.complaintReference', 'problem.statement', 'problem.what', 'problem.where', 'problem.when', 'problem.who', 'problem.how', 'problem.extent', 'problem.is', 'problem.isNot', 'problem.isIsNotStatus', 'problem.isIsNotBasis'], '100', 10)] }, null, 2);

const D3_FORM_SCHEMA = JSON.stringify({ fields: [
    // `action` PHAI mo dau bang dong tu menh lenh cua viec CHINH. Ma nhiem vu
    // (SAP catalog type 2) duoc suy ra bang luat tu menh de dau cau - xem
    // `shared/task-catalogue.ts`. Mot cau mo dau bang trang ngu hay bang viec phu
    // van doc duoc, nhung se roi vao sai o trong danh muc, va sai kieu do khong
    // hien ra o dau ca.
    structuredField('containment.actions', 'Containment actions', 'action-cards', 'array', 12, { required: true, minItems: 1 }, { items: { type: 'object', properties: { action: { type: 'string', description: 'Short concise action description without boilerplate prefix. Start with the imperative verb naming the PRIMARY work, e.g. "Quarantine 85 housings at the outgoing dock".' }, owner: { type: 'string', maxLength: 120, description: 'The team member from D1 (team.roster or team.leader/members) assigned to this containment action, selected by matching their role/responsibility to the work required. E.g. "Karl Wagner" or "DungTruonghyhy".' }, status: { type: 'string', enum: ['Planned', 'In Process', 'Done', 'Verified'] } } } }),
    structuredField('containment.gaps', 'Open containment gaps', 'warning-list', 'array', 12, {}, { items: { type: 'string' } }),
    structuredField('sources', 'Evidence and traceability', 'evidence-list', 'array', 12, {}, { items: { type: 'string' } }),
], groups: [group('d3-ai-result', 'Containment plan', ['containment.actions', 'containment.gaps', 'sources'], '100', 10)] }, null, 2);

const D4_FORM_SCHEMA = JSON.stringify({ fields: [
    structuredField('rootCause.statement', 'Root cause', 'ai-draft', 'string', 12, { required: true, minLength: 10, maxLength: 320 }),
    // Ca hai mang duoi day tung de LONG dung cho model bo: `ishikawaBoard` khong
    // required nen Haiku thinh thoang bo ca bang; cac row khong khai `required`
    // item-level nen mot row 5-Why chi co `why` ma khong co `answer` van la
    // output hop le theo schema. Do do "luc ra Ishikawa luc khong" va "5-Why
    // khong tra loi cau hoi" khong phai model hong — la schema cho phep.
    structuredField('rootCause.ishikawaBoard', 'Ishikawa', 'ishikawa-grid', 'array', 12, { required: true, minItems: 6 }, { description: 'Always one row per 6M category with a concise 1-sentence verdict. Copy a recorded assessment verbatim with source=recorded; for a category with no recorded entry propose a brief verdict from evidence with source=proposed, or write "not assessed". Never write audit plans or long essays in cells.', items: { type: 'object', properties: { category: { type: 'string', enum: ['Man', 'Machine', 'Method', 'Material', 'Measurement', 'Environment'] }, finding: { type: 'string', maxLength: 220, description: 'The concise VERDICT for this branch, e.g. clamp pad worn 0.2 mm, or gauge R&R 8%, or not assessed. Never a list of evidence to gather - that goes in evidenceGaps once. Never the category name.' }, isRootCause: { type: 'boolean', description: 'True for at most ONE branch in the whole board.' }, source: { type: 'string', enum: ['recorded', 'proposed'] } }, required: ['category', 'finding', 'isRootCause', 'source'] } }),
    structuredField('rootCause.fiveWhy', '5-Why chain', 'why-chain', 'array', 12, { required: true, minItems: 1 }, { items: { type: 'object', properties: { step: { type: 'integer', description: 'Position in the chain, starting at 1.' }, why: { type: 'string', maxLength: 140, description: 'The question only, ending in a question mark. Keep it short and crisp.' }, answer: { type: 'string', maxLength: 200, description: 'The answer only: 1 concise direct sentence naming the cause. Never repeat the question, never list audit procedures or evidence still to be gathered.' }, evidence: { type: 'string', maxLength: 200, description: 'The CaseContext path or measurement backing the answer. Concise citation only.' } }, required: ['step', 'why', 'answer', 'evidence'] } }),
    structuredField('rootCause.evidenceGaps', 'Evidence gaps', 'warning-list', 'array', 12, {}, { items: { type: 'string' } }),
    structuredField('sources', 'Evidence and traceability', 'evidence-list', 'array', 12, {}, { items: { type: 'string' } }),
], groups: [group('d4-ai-result', 'Root cause analysis', ['rootCause.statement', 'rootCause.ishikawaBoard', 'rootCause.fiveWhy', 'rootCause.evidenceGaps', 'sources'], '100', 10)] }, null, 2);

function outputDataSchemaFromForm(formSchemaJson: string): string {
    const form = JSON.parse(formSchemaJson) as { fields: Array<{ key: string; label?: string; dataType?: string; items?: unknown; properties?: unknown; xSource?: string; description?: string; constraints?: { required?: boolean; enum?: unknown[] } }> };
    const schema: { type: 'object'; properties: Record<string, Record<string, unknown>>; required: string[]; additionalProperties: false } = { type: 'object', properties: {}, required: [], additionalProperties: false };
    for (const field of form.fields) {
        // Mac dinh moi field la do AI sinh. Field nao tu khai `xSource` thi giu
        // nguyen khai bao cua no - `team.assignedRoster` do con nguoi nhap, dan
        // nham la 'ai_enrichment' se noi doi ngay tren man hinh Data Schema.
        schema.properties[field.key] = { type: field.dataType ?? 'string', title: field.label, description: field.description ?? 'Generated by the 8D AI from verified case context.', 'x-source': field.xSource ?? 'ai_enrichment', items: field.items, properties: field.properties, enum: field.constraints?.enum };
        if (field.constraints?.required) schema.required.push(field.key);
    }
    return JSON.stringify(schema, null, 2);
}

/**
 * Ghep huong dan NGHIEP VU voi co hoc dien field cho mot discipline.
 *
 * Runtime doc prompt bang `combinedPrompt ?? systemPrompt` (xem
 * `getDisciplineGuide` trong configRepository.ts). Nghia la combinedPrompt CHE
 * HOAN TOAN systemPrompt chu khong bo sung cho no. Truoc day D1-D4 chi khai
 * combinedPrompt la danh sach co hoc dien field, nen toan bo huong dan nghiep vu
 * trong DEFAULT_DISCIPLINE_GUIDE bi bo qua o dung bon buoc quan trong nhat -
 * model chi con biet dien vao o nao, khong biet phai viet cai gi vao do.
 *
 * Nen combinedPrompt phai TU CHUA phan nghiep vu. Doi noi dung nghiep vu thi sua
 * DEFAULT_DISCIPLINE_GUIDE mot cho, ca hai tang cung doi theo.
 */
const withGuide = (code: keyof typeof DEFAULT_DISCIPLINE_GUIDE, mechanics: readonly string[]): string =>
    [DEFAULT_DISCIPLINE_GUIDE[code], '', '## FIELD MECHANICS', ...mechanics].join('\n');

/**
 * Hai dong co hoc dung chung cho D3, D5 va D7 - ba buoc sinh ra hanh dong.
 *
 * -- Vi sao la HAI dong chu khong phai mot o `taskCode` trong schema --
 * Cach hien nhien de co ma nhiem vu la bao model tra ve mot o `taskCode`. Cach do
 * sai, va sai theo kieu kho phat hien nhat: model se luon dien duoc mot ma nghe
 * hop ly, ke ca khi no chon nham. Luc do co HAI nguon ma - model va
 * `classifyTaskCode` - va chung khong the doi chieu voi nhau, vi khong ai biet
 * cai nao dung.
 *
 * Nen ma van do LUAT suy ra, con viec cua model la viet cau van ma luat doc duoc:
 * dong tu menh lenh cua viec CHINH dung dau. `classifyTaskCode` cat menh de dau
 * roi doi chieu - "Rework 48 bridged boards and re-test continuity" duoc ma theo
 * Rework, dung nhu no phai the.
 *
 * Dat o mot bien dung chung chu khong chep vao ba cho: ba ban chep se lech nhau,
 * va lech o D7 thi khong ai doc D3 nhin thay.
 */
const TASK_CODING_MECHANIC =
    'Start every action with the imperative verb naming the PRIMARY work; when an action has two halves, '
    + 'put the primary one first. Each action is filed against the SAP quality task catalogue by reading its '
    + 'leading clause, so a sentence that opens on the secondary task lands under the wrong code.';

const NO_TASK_CODE_MECHANIC =
    'Never output a task code, code group, or planned end date. The code is derived from your action text by '
    + 'rule, and the date is a human commitment.';


const D5_FORM_SCHEMA = JSON.stringify({ fields: [
    // Moi hanh dong PHAI chi ra buoc nao cua chuoi D4 no go bo. Do la khac biet
    // giua "sua nguyen nhan" va "che trieu chung", va la thu dau tien mot kiem
    // toan vien hoi. `action-cards` giu `origin` va `status` noi len.
    structuredField('corrective.actions', 'Permanent corrective actions', 'action-cards', 'array', 12, { required: true, minItems: 1 }, { items: { type: 'object', properties: { action: { type: 'string', maxLength: 240, description: 'The action and its trigger, starting with the imperative verb that names the PRIMARY work. No owner, no status, no rationale - those are separate fields.' }, owner: { type: 'string', maxLength: 120, description: 'The team member from D1 (team.roster or team.leader/members) assigned to this corrective action, selected by matching their role/responsibility to the root cause fix. E.g. "Karl Wagner" or "Minh Dinh".' }, status: { type: 'string', maxLength: 40, description: 'ONLY the current status, one or two words, e.g. "Planned", "In progress", "Done".' }, origin: { type: 'string', maxLength: 60, description: 'ONLY where it came from: "recorded" for an action already in the case, or "precedents#N" for a proposal.' }, protection: { type: 'string', maxLength: 200, description: 'One line.' } } } }),
    // Phan nguyen nhan goc chua ai che la dong huu ich nhat trang nay.
    structuredField('sources', 'Evidence and traceability', 'evidence-list', 'array', 12, {}, { items: { type: 'string' } }),
], groups: [group('d5-ai-result', 'AI-generated corrective plan', ['corrective.actions'], '100', 10)] }, null, 2);

const D6_FORM_SCHEMA = JSON.stringify({ fields: [
    structuredField('verification.objective', 'Verification objective', 'callout', 'string', 12, { required: true, maxLength: 260 }),
    // Ke hoach phai DO DUOC. "Theo doi quy trinh" khong phai ke hoach; "tro lai
    // trong dung sai tren 30 chi tiet lien tiep" moi la.
    structuredField('verification.plan', 'Verification plan', 'table', 'array', 12, { required: true, minItems: 1 }, { items: { type: 'object', properties: { measure: { type: 'string', maxLength: 200, description: 'One line.' }, sampleSize: { type: 'string', maxLength: 80, description: 'ONLY the sample size, e.g. "30 parts per shift".' }, period: { type: 'string', maxLength: 60, description: 'ONLY the period over which it runs, e.g. "4 weeks".' }, acceptanceCriterion: { type: 'string', maxLength: 220, description: 'The pass/fail threshold with its number, anchored to a real specification value.' }, signOff: { type: 'string', maxLength: 120, description: 'ONLY the role that signs it off.' } } } }),
    structuredField('verification.evidenceStatus', 'Evidence status', 'status', 'string', 4, { required: true, enum: ['No evidence yet', 'Partially verified', 'Verified'] }),
    structuredField('sources', 'Evidence and traceability', 'evidence-list', 'array', 12, {}, { items: { type: 'string' } }),
], groups: [group('d6-ai-result', 'AI-generated verification plan', ['verification.objective', 'verification.plan'], '100', 10)] }, null, 2);

const D7_FORM_SCHEMA = JSON.stringify({ fields: [
    structuredField('preventive.actions', 'Preventive actions', 'action-cards', 'array', 12, { required: true, minItems: 1 }, { items: { type: 'object', properties: { action: { type: 'string', maxLength: 240, description: 'The action and its trigger, starting with the imperative verb that names the PRIMARY work. No owner, no status, no rationale - those are separate fields.' }, owner: { type: 'string', maxLength: 120, description: 'The team member from D1 (team.roster or team.leader/members) assigned to this preventive action, selected by matching their role/responsibility to the systemic/FMEA fix. E.g. "Minh Dinh" or "DungTruonghyhy".' }, status: { type: 'string', maxLength: 40, description: 'ONLY the current status, one or two words, e.g. "Planned", "In progress", "Done".' }, origin: { type: 'string', maxLength: 60, description: 'ONLY where it came from: "recorded" for an action already in the case, or "precedents#N" for a proposal.' }, protection: { type: 'string', maxLength: 200, description: 'One line.' } } } }),
    // D7 chi thuc su chan tai dien khi thay doi duoc ghi vao FMEA. Trang thai
    // CHUA lien ket phai hien ro — do la lo hong that, khong phai o trong.
    structuredField('preventive.fmea', 'FMEA entry to update', 'fmea-link', 'object', 12, {}, { properties: { fmeaId: { type: 'string' }, description: { type: 'string' }, change: { type: 'string' }, currentRating: { type: 'string' }, proposedRating: { type: 'string' } } }),
    structuredField('sources', 'Evidence and traceability', 'evidence-list', 'array', 12, {}, { items: { type: 'string' } }),
], groups: [group('d7-ai-result', 'AI-generated preventive plan', ['preventive.actions', 'preventive.fmea'], '100', 10)] }, null, 2);

const D8_FORM_SCHEMA = JSON.stringify({ fields: [
    // Cong dong case. KHONG phai AI viet: no doc trang thai duyet cua D1-D7. Cho
    // model tra loi "dong duoc chua" la cho no tu cap phep dong case.
    structuredField('closure.gate', 'Closure readiness', 'closure-gate', 'object', 12, {}, { xSource: 'manual_input', description: 'Computed from the review status of D1-D7. The AI never writes this.', properties: {} }),
    structuredField('closure.costOfPoorQuality', 'Cost of poor quality', 'text', 'string', 4, {}, { xSource: 'sap_qm', description: 'Read from the case. The AI never writes this.' }),
    structuredField('closure.lessonsWhatWorked', 'What worked', 'markdown', 'string', 6, { required: true, minLength: 20 }),
    structuredField('closure.lessonsWhatDidNot', 'What did not', 'markdown', 'string', 6, { required: true, minLength: 20 }),
    structuredField('closure.teamRecognition', 'Team recognition', 'markdown', 'string', 12, {}),
    structuredField('closure.openItems', 'Still open at closure', 'warning-list', 'array', 12, {}, { items: { type: 'string' } }),
    structuredField('sources', 'Evidence and traceability', 'evidence-list', 'array', 12, {}, { items: { type: 'string' } }),
], groups: [group('d8-ai-result', 'AI-generated closure summary', ['closure.gate', 'closure.costOfPoorQuality', 'closure.lessonsWhatWorked', 'closure.lessonsWhatDidNot', 'closure.teamRecognition'], '100', 10)] }, null, 2);

const STRUCTURED_CONFIG_OVERRIDES: Record<string, { description: string; combinedPrompt: string; inputSchemaJson: string; formSchemaJson: string; constraintsJson?: string }> = {
    D1: { description: 'Build an explainable cross-functional team with per-member responsibilities, selection reasons, and source traceability.', combinedPrompt: withGuide('D1', [
        'Determine the capabilities required by the actual defect before selecting people.',
        'Set selectionMethod to exactly one allowed value: Current case team, Precedent recommendation, Hybrid, or Roles only - assignment required.',
        'Prefer identities from team.leader and team.members. Use precedents#N.team only to cover a capability missing from the current team.',
        'For every roster row separate organizationalRole, assigned8DRole, and caseResponsibility. Do not put a job title in caseResponsibility.',
        'For every roster row explain selectionReason and provide sourceType, sourcePath, and sourceCase when applicable.',
        'sourcePath must resolve to team.leader, team.members#N, or precedents#N.team#M. Never invent a person.',
        'If a required role has no grounded person, use name Unassigned, sourceType unassigned, sourcePath team.gaps, and readinessStatus Needs assignment.',
        'Set readinessStatus to exactly Ready, Partial, or Needs assignment. Put the explanation only in readinessRationale.',
        'Explain the mix of current-case and precedent sources in sourceSummary, and list all supporting paths in sources.',
        'Never output team.assignedRoster. The quality engineer fills that table in on the report screen.',
        'Set servedOnCount on every precedent-sourced roster row to the number of qualifying precedent cases that person served on, and order the roster by it, highest first. A person taken from the current case has no count - omit it.',
        'When no precedent clears the minimum score, set team.suggestionStatus to exactly "No team suggestion available; assign manually." and set selectionMethod to "Roles only - assignment required". Do not invent a roster.',
    ]), inputSchemaJson: outputDataSchemaFromForm(D1_FORM_SCHEMA), formSchemaJson: D1_FORM_SCHEMA, constraintsJson: JSON.stringify({ enabled: true, rules: [{ id: 'D1_GROUNDING', type: 'sourcePattern', severity: 'error', enabled: true, pattern: '^(team\\.|precedents#)', message: 'Team identities must come from the current team or a cited precedent.' }, { id: 'D1_DATA_BACKED', type: 'dataBackedWhenInputPresent', severity: 'warning', enabled: true, inputFields: ['teamMembers', 'precedentTeams'], message: 'No current or precedent team data supports this assignment.' }] }, null, 2) },
    D2: { description: 'Describe the problem as structured 5W2H, Is/Is-Not, measurements, and explicit gaps.', combinedPrompt: withGuide('D2', ['Populate separate fields for statement, What, Where, When, Who, extent, and impact.', 'Return measured evidence as table rows.', 'Use verified facts only and expose missing facts in problem.gaps.', 'Do not hide all 5W2H information inside one narrative field.', 'Set problem.how to how the defect surfaced, for example in-process inspection or customer complaint.', 'Put the reasoning behind Is / Is-Not into problem.isIsNotBasis, citing the records it rests on.', 'Never output problem.complaintReference or problem.statementOverride. Those come from SAP and from the quality engineer.']), inputSchemaJson: outputDataSchemaFromForm(D2_FORM_SCHEMA), formSchemaJson: D2_FORM_SCHEMA, constraintsJson: JSON.stringify({ enabled: true, rules: [{ id: 'D2_CITATIONS', type: 'citationRequired', severity: 'error', enabled: true, message: 'D2 requires traceable case evidence.' }, { id: 'D2_SOURCES', type: 'sourcePattern', severity: 'warning', enabled: true, pattern: '^(header|product|inspections|isIsNot|historicalInspectionLots|derivedFacts)', message: 'Some D2 evidence is outside the configured problem-data scope.' }] }, null, 2) },
    D3: { description: 'Build a structured containment plan with ownership, protection, origin, rationale, and gaps.', combinedPrompt: withGuide('D3', ['Return containment.actions as rows with action, owner, status, and origin.', 'Assign an owner to every containment action from the D1 team roster (team.roster or team.leader/members), formatted strictly as "Name (Role)" (e.g. "Elena Rostova (Team Leader)" or "Anna Schmidt (Quality Engineer)"). Match the required work to the role.', 'Keep each action text short, direct and concise (e.g. Move to backup server).', 'Distinguish recorded actions from precedent-based proposals.', 'Do not collapse the action plan into one narrative paragraph.', TASK_CODING_MECHANIC, NO_TASK_CODE_MECHANIC]), inputSchemaJson: outputDataSchemaFromForm(D3_FORM_SCHEMA), formSchemaJson: D3_FORM_SCHEMA, constraintsJson: JSON.stringify({ enabled: true, rules: [{ id: 'D3_SOURCES', type: 'sourcePattern', severity: 'error', enabled: true, pattern: '^(actions\\.containment|customer|precedents#)', message: 'Containment actions must be recorded actions or cited proposals.' }, { id: 'D3_DATA_BACKED', type: 'dataBackedWhenInputPresent', severity: 'warning', enabled: true, inputFields: ['actions', 'precedents'], message: 'No current or precedent containment data supports this plan.' }] }, null, 2) },
    D4: { description: 'Show the causal chain, conclusion, contributing factors, independent verification, and evidence gaps.', combinedPrompt: withGuide('D4', ['State the root cause conclusion directly and concisely in rootCause.statement (1 brief sentence, e.g. "Root cause: Undefined or missing milling process specification (Method)").', 'Expose evidence gaps separately in rootCause.evidenceGaps.', 'Treat precedent causes as hypotheses, not facts.', 'rootCause.ishikawaBoard always carries one row per 6M category with a concise 1-sentence/phrase verdict: Man, Machine, Method, Material, Measurement, Environment. Never write long essays or audit plans in 6M cells.', 'Copy each recorded ishikawa entry into its category with source set to recorded. Do not reword a recorded finding.', 'For a category with no recorded entry, propose a brief verdict from the evidence you do have with source set to proposed, or set finding to "not assessed". Never let a proposal read as a recorded finding.', 'Every rootCause.fiveWhy row must carry step, why, answer and evidence with short crisp questions and direct 1-sentence answers. The answer is never empty and never restates the question.']), inputSchemaJson: outputDataSchemaFromForm(D4_FORM_SCHEMA), formSchemaJson: D4_FORM_SCHEMA, constraintsJson: JSON.stringify({ enabled: true, rules: [{ id: 'D4_SOURCES', type: 'sourcePattern', severity: 'error', enabled: true, pattern: '^(fiveWhy|ishikawa|rootCause|independent|precedents#)', message: 'Root-cause conclusions require traceable causal evidence.' }] }, null, 2) },
    D5: { description: 'Tie every corrective action to the step of the root cause chain it removes.', combinedPrompt: withGuide('D5', ['Return corrective.actions as rows with action, owner, status, origin.', 'Assign an owner to every corrective action from the D1 team roster (team.roster or team.leader/members), formatted strictly as "Name (Role)" (e.g. "Karl Wagner (Maintenance Planner)" or "Marcus Vance (Manufacturing Engineer)"). Match the role/responsibility to the root cause fix. Never use generic titles or unassigned when members exist in D1.', 'In corrective.rootCauseCoverage name, per action, which step of the D4 chain it removes.', 'List any part of the root cause with no action against it in corrective.uncoveredCauses.', 'Distinguish recorded actions from precedent-based proposals using origin.', 'Do not collapse the plan into one narrative paragraph.', TASK_CODING_MECHANIC, NO_TASK_CODE_MECHANIC]), inputSchemaJson: outputDataSchemaFromForm(D5_FORM_SCHEMA), formSchemaJson: D5_FORM_SCHEMA, constraintsJson: JSON.stringify({ enabled: true, rules: [{ id: 'D5_SOURCES', type: 'sourcePattern', severity: 'error', enabled: true, pattern: '^(actions\\.corrective|rootCause|fiveWhy|precedents#)', message: 'Corrective actions must cite recorded actions or the root cause chain.' }, { id: 'D5_DATA_BACKED', type: 'dataBackedWhenInputPresent', severity: 'warning', enabled: true, inputFields: ['actions', 'precedents'], message: 'No current or precedent corrective data supports this plan.' }] }, null, 2) },
    D6: { description: 'Write a measurable verification plan; this dataset carries no verification evidence.', combinedPrompt: withGuide('D6', ['Return verification.plan as rows with measure, sampleSize, period, acceptanceCriterion, signOff.', 'Anchor every acceptance criterion to a real specification value from inspections.', 'Set verification.evidenceStatus to exactly one allowed value.', 'Never describe a corrective action as proven effective.']), inputSchemaJson: outputDataSchemaFromForm(D6_FORM_SCHEMA), formSchemaJson: D6_FORM_SCHEMA, constraintsJson: JSON.stringify({ enabled: true, rules: [{ id: 'D6_SOURCES', type: 'sourcePattern', severity: 'warning', enabled: true, pattern: '^(actions|inspections|rootCause|precedents#)', message: 'Verification criteria should cite the actions and measurements they rest on.' }] }, null, 2) },
    D7: { description: 'Preventive actions and the FMEA entry that has to change.', combinedPrompt: withGuide('D7', ['Return preventive.actions as rows with action, owner, status, origin.', 'Assign an owner to every preventive action from the D1 team roster (team.roster or team.leader/members), formatted strictly as "Name (Role)" (e.g. "Anna Schmidt (Quality Engineer)"). Match the role/responsibility to the systemic/FMEA fix.', 'Put the FMEA entry into preventive.fmea with fmeaId, description and the change required.', 'When the case links no FMEA entry, leave preventive.fmea.fmeaId empty and say what a systemic fix would have to cover.', 'List where else the failure mode applies in preventive.systemicScope.', 'An action that only protects this batch is corrective and belongs in D5.', TASK_CODING_MECHANIC, NO_TASK_CODE_MECHANIC]), inputSchemaJson: outputDataSchemaFromForm(D7_FORM_SCHEMA), formSchemaJson: D7_FORM_SCHEMA, constraintsJson: JSON.stringify({ enabled: true, rules: [{ id: 'D7_SOURCES', type: 'sourcePattern', severity: 'error', enabled: true, pattern: '^(actions\\.preventive|fmea|rootCause|precedents#)', message: 'Preventive actions must cite recorded actions, the FMEA link, or a precedent.' }, { id: 'D7_DATA_BACKED', type: 'dataBackedWhenInputPresent', severity: 'warning', enabled: true, inputFields: ['actions', 'fmea', 'precedents'], message: 'No preventive action or FMEA link supports this plan.' }] }, null, 2) },
    D8: { description: 'Lessons learned and what is still open. The closure gate reads D1-D7, not the model.', combinedPrompt: withGuide('D8', ['Write closure.lessonsWhatWorked and closure.lessonsWhatDidNot as two separate fields.', 'Name the specific thing worth repeating; "good teamwork" is not a lesson.', 'List anything unfinished in closure.openItems - unverified actions, a pending FMEA update, an evidence gap.', 'Never output closure.gate or closure.costOfPoorQuality. The screen computes the gate from the review status of D1-D7, and the cost comes from the case.']), inputSchemaJson: outputDataSchemaFromForm(D8_FORM_SCHEMA), formSchemaJson: D8_FORM_SCHEMA, constraintsJson: JSON.stringify({ enabled: true, rules: [{ id: 'D8_SOURCES', type: 'sourcePattern', severity: 'warning', enabled: true, pattern: '^(lessonsLearned|actions|copqEur|team|gaps)', message: 'Closure statements should cite the lessons, actions or cost recorded on the case.' }] }, null, 2) },
};

export const DEFAULT_STEP_PROMPTS: readonly {
    stepCode: string;
    label: string;
    description: string;
    systemPrompt: string;
    inputSchemaJson?: string;
    combinedPrompt?: string;
    formSchemaJson?: string;
    constraintsJson?: string;
}[] = Object.freeze([
    {
        stepCode: 'D1',
        label: 'Establish the Team',
        description: 'Suggest roles and people from the teams of matching precedent cases.',
        systemPrompt: DEFAULT_DISCIPLINE_GUIDE.D1,
        combinedPrompt: [
            'Extract the official team leader and members with their functions.',
            'Explain why the skill mix is appropriate for this problem.',
            'When official team data is missing, recommend people only from matching precedent cases and cite precedents#N.',
            'When neither current team data nor precedents exist, state that manual assignment is required.',
        ].join('\n'),
        inputSchemaJson: JSON.stringify({
            type: 'object',
            properties: {
                teamMembers: { type: 'array', title: 'Team members', description: 'Official team leader and members from the current case.', 'x-source': 'sap_qm', items: { type: 'object', properties: {} } },
                teamSize: { type: 'number', title: 'Team size', description: 'Calculated number of current team members.', 'x-source': 'ai_enrichment' },
                precedentTeams: { type: 'array', title: 'Precedent teams', description: 'Teams from similar completed 8D cases.', 'x-source': 'vector_search', items: { type: 'object', properties: {} } },
            },
            required: [],
            additionalProperties: false,
        }, null, 2),
        formSchemaJson: JSON.stringify({
            fields: [
                { key: 'content', label: 'D1 team recommendation', widget: 'textarea', width: '100%', constraints: { required: true, minLength: 20, maxLength: 1000 } },
                { key: 'sources', label: 'Evidence sources', widget: 'tag-selector', width: '100%', constraints: { pattern: '^(team\\.|precedents#)' } },
                { key: 'confidence', label: 'Confidence', widget: 'input', width: '50%', constraints: { min: 0, max: 100 } },
                { key: 'dataBacked', label: 'Data backed', widget: 'checkbox', width: '50%', constraints: {} },
            ],
            groups: [{ id: 'team', label: 'Team assignment', fieldKeys: ['content', 'sources', 'confidence', 'dataBacked'], width: '100', columns: 2, order: 10 }],
        }, null, 2),
        constraintsJson: JSON.stringify({
            enabled: true,
            rules: [
                { id: 'D1_GROUNDING', name: 'Ground team identities', type: 'sourcePattern', severity: 'error', enabled: true, pattern: '^(team\\.|precedents#)', message: 'Team names must come from the current team or a cited precedent.' },
                { id: 'D1_DATA_BACKED', name: 'Correct data-backed flag', type: 'dataBackedWhenInputPresent', severity: 'warning', enabled: true, inputFields: ['teamMembers', 'precedentTeams'], message: 'Set dataBacked to false when current and precedent team data are both empty.' },
            ],
        }, null, 2),
    },
    {
        stepCode: 'D2', label: 'Describe the Problem', description: 'Draft the problem paragraph and the 5W2H grid from verified case facts.', systemPrompt: DEFAULT_DISCIPLINE_GUIDE.D2,
        combinedPrompt: ['Describe the problem with verified 5W2H facts.', 'Quantify measured-versus-specification differences when values exist.', 'Use Is/Is-Not boundaries and cite every factual statement.', 'Do not invent missing measurements or locations.'].join('\n'),
        inputSchemaJson: JSON.stringify({ type: 'object', properties: {
            header: { type: 'object', title: 'Case header', 'x-source': 'sap_qm', properties: {} },
            product: { type: 'object', title: 'Material and product', 'x-source': 'sap_qm', properties: {} },
            defect: { type: 'object', title: 'Defect details', 'x-source': 'sap_qm', properties: {} },
            inspections: { type: 'array', title: 'Inspection results', 'x-source': 'sap_qm', items: { type: 'object', properties: {} } },
            isIsNot: { type: 'object', title: 'Is / Is-Not analysis', 'x-source': 'manual_input', properties: {} },
            derivedFacts: { type: 'array', title: 'Derived facts', 'x-source': 'ai_enrichment', items: { type: 'string' } },
        }, required: [], additionalProperties: false }, null, 2),
        formSchemaJson: JSON.stringify({ fields: [
            { key: 'summary', label: 'Problem summary', widget: 'textarea', width: '100%', constraints: { required: true, minLength: 20, maxLength: 500 } },
            { key: 'content', label: '5W2H and Is / Is-Not analysis', widget: 'textarea', width: '100%', constraints: { required: true, minLength: 50, maxLength: 1000 } },
            { key: 'sources', label: 'Evidence sources', widget: 'tag-selector', width: '100%', constraints: {} },
            { key: 'confidence', label: 'Confidence', widget: 'input', width: '50%', constraints: { min: 0, max: 1 } },
            { key: 'dataBacked', label: 'Data backed', widget: 'checkbox', width: '50%', constraints: {} },
        ], groups: [{ id: 'problem', label: 'Problem description', fieldKeys: ['summary', 'content', 'sources', 'confidence', 'dataBacked'], width: '100', columns: 2, order: 10 }] }, null, 2),
        constraintsJson: JSON.stringify({ enabled: true, rules: [
            { id: 'D2_CITATIONS', name: 'Require factual citations', type: 'citationRequired', severity: 'error', enabled: true, message: 'Measured values and verified facts require sources.' },
            { id: 'D2_SOURCES', name: 'Use problem evidence', type: 'sourcePattern', severity: 'warning', enabled: true, pattern: '^(header|product|defect|inspections|isIsNot|historicalInspectionLots|derivedFacts)', message: 'D2 sources must resolve to problem evidence.' },
        ] }, null, 2),
    },
    {
        stepCode: 'D3', label: 'Interim Containment Actions', description: 'Surface containment actions, or reuse the top precedent when none exist yet.', systemPrompt: DEFAULT_DISCIPLINE_GUIDE.D3,
        combinedPrompt: ['List immediate containment actions with owner and status when recorded.', 'Assign an owner to each containment action by matching the required work to the team members and roles established in D1 (team.roster / team.leader / team.members).', 'Explain how each action protects the customer or process.', 'If no current action exists, present precedent actions only as proposals and cite precedents#N.', 'Clearly distinguish recorded actions from recommendations.'].join('\n'),
        inputSchemaJson: JSON.stringify({ type: 'object', properties: {
            actions: { type: 'object', title: 'Current actions', 'x-source': 'sap_qm', properties: {} },
            customer: { type: 'object', title: 'Customer impact', 'x-source': 'sap_qm', properties: {} },
            precedents: { type: 'array', title: 'Precedent actions', 'x-source': 'vector_search', items: { type: 'object', properties: {} } },
        }, required: [], additionalProperties: false }, null, 2),
        formSchemaJson: JSON.stringify({ fields: [
            { key: 'summary', label: 'Containment summary', widget: 'textarea', width: '100%', constraints: { required: true, maxLength: 500 } },
            { key: 'content', label: 'Containment action analysis', widget: 'textarea', width: '100%', constraints: { required: true, minLength: 20, maxLength: 1000 } },
            { key: 'actionItems', label: 'Recommended follow-up actions', widget: 'multiSelect', width: '100%', constraints: {} },
            { key: 'sources', label: 'Evidence sources', widget: 'tag-selector', width: '100%', constraints: {} },
            { key: 'confidence', label: 'Confidence', widget: 'input', width: '50%', constraints: { min: 0, max: 1 } },
            { key: 'dataBacked', label: 'Data backed', widget: 'checkbox', width: '50%', constraints: {} },
        ], groups: [{ id: 'containment', label: 'Interim containment', fieldKeys: ['summary', 'content', 'actionItems', 'sources', 'confidence', 'dataBacked'], width: '100', columns: 2, order: 10 }] }, null, 2),
        constraintsJson: JSON.stringify({ enabled: true, rules: [
            { id: 'D3_SOURCES', name: 'Ground containment actions', type: 'sourcePattern', severity: 'error', enabled: true, pattern: '^(actions\.containment|customer|precedents#)', message: 'Containment actions must be recorded actions or cited proposals.' },
            { id: 'D3_DATA_BACKED', name: 'Correct data-backed flag', type: 'dataBackedWhenInputPresent', severity: 'warning', enabled: true, inputFields: ['actions', 'precedents'], message: 'Set dataBacked false when neither current nor precedent actions exist.' },
        ] }, null, 2),
    },
    {
        stepCode: 'D4', label: 'Root Cause Analysis', description: 'Walk the 5-Why chain and weigh it against the independent diagnosis.', systemPrompt: DEFAULT_DISCIPLINE_GUIDE.D4,
        combinedPrompt: ['Walk the recorded 5-Why chain and evaluate Ishikawa 6M evidence.', 'State the confirmed root cause only when supported by evidence.', 'Include an Independent verification section that reports agreement or disagreement with the blind diagnosis.', 'Treat precedent root causes as hypotheses, never as facts for this case.'].join('\n'),
        inputSchemaJson: JSON.stringify({ type: 'object', properties: {
            fiveWhy: { type: 'array', title: '5-Why chain', 'x-source': 'sap_qm', items: { type: 'object', properties: {} } },
            ishikawa: { type: 'array', title: 'Ishikawa findings', 'x-source': 'sap_qm', items: { type: 'object', properties: {} } },
            rootCause: { type: 'object', title: 'Recorded root cause', 'x-source': 'sap_qm', properties: {} },
            independent: { type: 'object', title: 'Independent diagnosis', 'x-source': 'ai_enrichment', properties: {} },
            precedents: { type: 'array', title: 'Precedent root causes', 'x-source': 'vector_search', items: { type: 'object', properties: {} } },
        }, required: [], additionalProperties: false }, null, 2),
        formSchemaJson: JSON.stringify({ fields: [
            { key: 'summary', label: 'Root cause summary', widget: 'textarea', width: '100%', constraints: { required: true, maxLength: 500 } },
            { key: 'content', label: '5-Why, Ishikawa and independent verification', widget: 'textarea', width: '100%', constraints: { required: true, minLength: 50, maxLength: 2500 } },
            { key: 'sources', label: 'Evidence sources', widget: 'tag-selector', width: '100%', constraints: {} },
            { key: 'confidence', label: 'Confidence', widget: 'input', width: '50%', constraints: { min: 0, max: 1 } },
            { key: 'dataBacked', label: 'Data backed', widget: 'checkbox', width: '50%', constraints: {} },
        ], groups: [{ id: 'root-cause', label: 'Root cause analysis', fieldKeys: ['summary', 'content', 'sources', 'confidence', 'dataBacked'], width: '100', columns: 2, order: 10 }] }, null, 2),
        constraintsJson: JSON.stringify({ enabled: true, rules: [
            { id: 'D4_DISCLOSURE', name: 'Independent verification disclosure', type: 'requiredDisclosure', severity: 'error', enabled: true, pattern: 'independent verification', message: 'D4 must disclose agreement or disagreement with the independent diagnosis.' },
            { id: 'D4_SOURCES', name: 'Ground root cause analysis', type: 'sourcePattern', severity: 'error', enabled: true, pattern: '^(fiveWhy|ishikawa|rootCause|independent|precedents#)', message: 'D4 sources must resolve to root-cause evidence.' },
        ] }, null, 2),
    },
    { stepCode: 'D5', label: 'Permanent Corrective Actions', description: 'Tie each corrective action to a step of the root cause chain.' , systemPrompt: DEFAULT_DISCIPLINE_GUIDE.D5 },
    { stepCode: 'D6', label: 'Verify Effectiveness', description: 'Write the verification plan; this dataset carries no verification evidence.' , systemPrompt: DEFAULT_DISCIPLINE_GUIDE.D6 },
    { stepCode: 'D7', label: 'Prevent Recurrence', description: 'Preventive actions and the FMEA entry to update.' , systemPrompt: DEFAULT_DISCIPLINE_GUIDE.D7 },
    { stepCode: 'D8', label: 'Closure and Recognition', description: 'Lessons learned and the completeness gate over D1–D7.' , systemPrompt: DEFAULT_DISCIPLINE_GUIDE.D8 },
].map((row) => ({ ...row, ...(STRUCTURED_CONFIG_OVERRIDES[row.stepCode] ?? {}) })).map((r) => Object.freeze(r)));
