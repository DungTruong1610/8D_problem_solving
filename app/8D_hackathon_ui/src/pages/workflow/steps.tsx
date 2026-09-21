import type { LucideIcon } from 'lucide-react';
import {
    ClipboardList, Cpu, FileInput, GitBranch, ListChecks, MoreHorizontal, Search,
    ShieldCheck, Sparkles, Stethoscope, Users,
} from 'lucide-react';
import type { RetrievalConfigState } from '@/hooks/use-retrieval-config';
import type { StepPromptsState } from '@/hooks/use-step-prompts';

/**
 * Định nghĩa các bước của quy trình 8D.
 *
 * Tách riêng khỏi phần render để danh sách bước đọc được như một tài liệu: thứ
 * tự, ai làm, và mỗi bước cấu hình được cái gì. Thêm một bước nghĩa là thêm một
 * mục ở đây, không phải sửa layout.
 */

export type Engine = 'rules' | 'ai';

/**
 * Quy trình gãy làm hai nửa và người dùng cần thấy chỗ gãy đó.
 *
 * Nửa đầu đi tìm case cũ nào đáng so sánh — chạy được kể cả khi model chết.
 * Nửa sau viết báo cáo từ những gì nửa đầu tìm ra. Mười hai bước liệt kê phẳng
 * thì không nhìn ra ranh giới này; chia phase thì nhìn ra ngay.
 */
export type Phase = 'retrieval' | 'drafting';

export const PHASE_LABEL: Record<Phase, string> = {
    retrieval: 'Find comparable cases',
    drafting: 'Draft the report',
};

export interface StepStatus {
    text: string;
    ready: boolean;
    warn?: string;
}

/** Mọi cấu hình mà một bước có thể soi vào để tự báo trạng thái. */
export interface WorkflowConfig {
    retrieval: RetrievalConfigState;
    prompts: StepPromptsState;
}

export interface WorkflowStep {
    id: string;
    n: number;
    phase: Phase;
    icon: LucideIcon;
    title: string;
    /** Một câu cho mục lục bên trái. */
    short: string;
    engine: Engine;
    /** Việc bước này làm, nói bằng ngôn ngữ nghiệp vụ. */
    does: string;
    /** Vì sao bước này do luật hay do model — chỗ dễ hiểu nhầm nhất. */
    why: string;
    /** Bước này KHÔNG cấu hình được gì; nói thẳng thay vì để trang trống. */
    noConfig?: string;
    /** Discipline mà bước này cấu hình, nếu có. */
    disciplineCode?: string;
    status?: (cfg: WorkflowConfig) => StepStatus;
}

/**
 * Trạng thái chung cho một bước discipline: đếm bốn lớp cấu hình.
 *
 * Đọc thẳng từ cấu hình đang có hiệu lực chứ không viết cứng, nên một discipline
 * bị xoá cấu hình sẽ hiện ra là chưa sẵn sàng thay vì vẫn báo xanh.
 */
function disciplineStatus(code: string) {
    return ({ prompts }: WorkflowConfig): StepStatus => {
        const p = prompts.byCode[code];
        if (!p) {
            return {
                text: 'No configuration row',
                ready: false,
                warn: `${code} has no row in the configuration table — restore defaults to create it.`,
            };
        }

        const count = (raw: string | null, pick: (v: any) => unknown[]) => {
            if (!raw?.trim()) return 0;
            try {
                return pick(JSON.parse(raw)).length;
            } catch {
                return 0;
            }
        };

        const inputs = count(p.inputSchemaJson, (v) => Object.keys(v?.properties ?? {}));
        const fields = count(p.formSchemaJson, (v) => v?.fields ?? []);
        const rules = count(p.constraintsJson, (v) => v?.rules ?? []);

        return {
            text: `${inputs} inputs · ${fields} output fields · ${rules} rules`,
            ready: inputs > 0 && fields > 0,
            warn: rules === 0
                ? 'No constraints on this discipline — nothing is checked after the model answers.'
                : undefined,
        };
    };
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
    {
        id: 'intake',
        n: 1,
        phase: 'retrieval',
        icon: FileInput,
        title: 'Take in the issue',
        short: 'Validate and normalise recorded case facts',
        engine: 'rules',
        does: 'Read the notification exactly as recorded, normalise dates and IDs written in '
            + 'different locales, and write down every gap the case has — no 5-Why yet, no team yet, '
            + 'no actions yet. Those gaps are passed to the model later so it lowers its confidence '
            + 'in the right places instead of writing a confident report over missing data.',
        why: 'Validation and normalisation have exact rules. A model here would add a non-zero chance '
            + 'of being wrong at the one place everything downstream depends on being right.',
        noConfig: 'Nothing to configure. The rules live in the code and are covered by tests — '
            + 'a defect case either parses or it is rejected with a reason.',
    },
    {
        id: 'library',
        n: 2,
        phase: 'retrieval',
        icon: ListChecks,
        title: 'Keep a library of solved cases',
        short: 'The data everything else searches',
        engine: 'rules',
        does: 'Every closed 8D is stored flat with the three keys used for matching, plus the team '
            + 'that solved it, the actions they took and the root cause they confirmed. This is the '
            + 'raw material for every suggestion the tool makes.',
        why: 'Without this step there is nothing to compare against, and no amount of model quality '
            + 'helps. It is the cheapest part to build and the one that decides whether the rest is '
            + 'worth anything.',
        status: ({ retrieval: c }) => ({
            text: `${c.cases.length} closed cases in the library`,
            ready: c.cases.length > 0,
            warn: c.cases.length === 0
                ? 'Empty library — the tool can only say "no precedent" until cases are loaded'
                : undefined,
        }),
    },
    {
        id: 'embedding',
        n: 3,
        phase: 'retrieval',
        icon: Sparkles,
        title: 'Turn descriptions into vectors',
        short: 'So cases match by meaning, not just by code',
        engine: 'ai',
        does: 'Build one paragraph per case from the defect, the investigation findings and the causal '
            + 'chain, then embed it. Numbers, dates and raw codes are deliberately left out — an '
            + 'embedding cannot tell 10cm from 10m, so anything measurable stays in a database column '
            + 'where it can be compared exactly.',
        why: 'Only an embedding model can tell that "raised metal ridge at bore mouth" and "flange edge '
            + 'burr above limit" describe the same failure. No rule over codes will ever connect those two.',
        status: ({ retrieval: c }) => ({
            text: c.embeddingModel
                ? `${c.embeddedCount}/${c.cases.length} embedded · ${c.embeddingModel}`
                : 'Nothing embedded yet',
            ready: c.cases.length > 0 && c.embeddedCount === c.cases.length,
            warn: c.hasVectorStep && c.notEmbedded > 0
                ? `${c.notEmbedded} case(s) cannot be matched by meaning until they are embedded`
                : undefined,
        }),
    },
    {
        id: 'criteria',
        n: 4,
        phase: 'retrieval',
        icon: GitBranch,
        title: 'Score comparable cases',
        short: 'The matching pipeline and its weights',
        engine: 'rules',
        does: 'Score every closed case against the open one, criterion by criterion. Each step compares '
            + 'one field with one method and contributes its weight; a step can fall back to a weaker '
            + 'match rather than scoring nothing.',
        why: 'A fixed formula, so the number can be recomputed by hand and defended in a review. This '
            + 'is the one stage that must never be a black box — it decides which past case gets '
            + 'quoted in an 8D report.',
        status: ({ retrieval: c }) => ({
            text: `${c.enabledCount}/${c.criteria.length} steps on · maximum score ${c.maxScore}`,
            ready: c.enabledCount > 0,
        }),
    },
    {
        id: 'threshold',
        n: 5,
        phase: 'retrieval',
        icon: Search,
        title: 'Decide what counts as comparable',
        short: 'Threshold, result size, and what gets hidden',
        engine: 'rules',
        does: 'Cut everything below the threshold and keep the best N. Below the threshold the tool '
            + 'shows nothing at all and says why.',
        why: 'A weak precedent is worse than none: it still gets cited in the report as if it meant '
            + 'something, and nobody downstream can tell it apart from a strong one. Being allowed to '
            + 'say "I do not know" is what makes the other answers worth trusting.',
        status: ({ retrieval: c }) => ({
            text: `threshold ${c.settings?.minScore ?? '—'} of ${c.maxScore} · top ${c.settings?.topN ?? '—'}`
                + (c.settings?.closedOnly ? ' · closed cases only' : ' · open cases included'),
            ready: true,
        }),
    },
    {
        id: 'team',
        n: 6,
        phase: 'retrieval',
        icon: Users,
        title: 'Propose the 8D team',
        short: 'Counted from who solved the matching cases',
        engine: 'rules',
        does: 'Group the teams of the matched cases by function and by person, and rank people by how '
            + 'often they worked a comparable defect. The model later writes the justification, but it '
            + 'is given this exact list and may not add a name to it.',
        why: 'Counting, not judgement — which also means a name can never be invented. Every person '
            + 'proposed is on a real past team, traceable to a case number.',
        noConfig: 'Derived from the matched cases in step 4. Change the weights there and this list '
            + 'changes with them.',
        status: ({ retrieval: c }) => ({
            text: c.cases.length ? 'Derived from the matched cases' : 'Needs a case library',
            ready: c.cases.length > 0,
        }),
    },
    {
        id: 'models',
        n: 7,
        phase: 'drafting',
        icon: Cpu,
        title: 'Choose a model per step',
        short: 'Parsing, diagnosing and drafting can differ',
        engine: 'ai',
        does: 'Each AI step routes to its own model. Reading a case into structure is transcription and '
            + 'a fast model is enough; reasoning about causes from raw evidence is where the strongest '
            + 'model earns its cost.',
        why: 'One model for everything means either paying reasoning prices for transcription, or doing '
            + 'the hardest step on the cheapest model.',
    },
    {
        id: 'd1',
        n: 8,
        phase: 'drafting',
        disciplineCode: 'D1',
        icon: Users,
        title: 'D1 · Establish the team',
        short: 'Who should work this defect, and on what evidence',
        engine: 'ai',
        does: 'The candidate list is already fixed by step 6 — counted, never generated. This step '
            + 'decides what the model is handed to justify it: the official team from record, the size of '
            + 'that team, and the teams of the matched precedents. Its answer lands in named fields, and '
            + 'a grounding rule rejects any name that does not trace back to one of those inputs.',
        why: 'Explaining why a skill mix fits a specific defect needs the case read; counting who solved '
            + 'similar defects does not. The split is visible here: the precedent teams arrive as an '
            + 'input, so the model can only rank and justify what the rules already found.',
        status: disciplineStatus('D1'),
    },
    {
        id: 'd2',
        n: 9,
        phase: 'drafting',
        disciplineCode: 'D2',
        icon: ClipboardList,
        title: 'D2 · Describe the problem',
        short: '5W2H and Is / Is-Not from verified facts only',
        engine: 'ai',
        does: 'Turn the case header, the material, the defect record and the inspection results into a '
            + 'problem statement with a 5W2H grid. The Is / Is-Not boundaries come from manual input '
            + 'where they exist; a citation rule then requires a source behind every measured value.',
        why: 'The facts are already in the database — this step is about expressing them, which is what '
            + 'a model does well. Restricting its inputs to the recorded fields is what keeps the prose '
            + 'from drifting past what the case actually contains.',
        status: disciplineStatus('D2'),
    },
    {
        id: 'd3',
        n: 10,
        phase: 'drafting',
        disciplineCode: 'D3',
        icon: ShieldCheck,
        title: 'D3 · Interim containment',
        short: 'Recorded actions, and precedent actions as proposals',
        engine: 'ai',
        does: 'List the containment actions already recorded with owner and status. Where a fresh case '
            + 'has none, the actions taken in matched precedents are offered — explicitly as proposals, '
            + 'each carrying its precedent number.',
        why: 'The distinction between "this was done" and "this was done once, elsewhere, for a similar '
            + 'defect" is the whole point of the step. A constraint rule enforces it, because a proposal '
            + 'silently promoted to a recorded action is the one failure that would matter in an audit.',
        status: disciplineStatus('D3'),
    },
    {
        id: 'd4',
        n: 11,
        phase: 'drafting',
        disciplineCode: 'D4',
        icon: Stethoscope,
        title: 'D4 · Root cause analysis',
        short: 'The recorded chain, weighed against a blind diagnosis',
        engine: 'ai',
        does: 'Walk the recorded 5-Why chain and the Ishikawa 6M evidence, then compare the result '
            + 'against the independent diagnosis made earlier without seeing the case\'s own conclusion. '
            + 'Where the two disagree, the disagreement is reported rather than resolved.',
        why: 'This is the step where the strongest model earns its cost, and also the one most worth '
            + 'constraining: root causes from precedent cases are hypotheses about this defect, never '
            + 'facts about it. The rules here say so explicitly.',
        status: disciplineStatus('D4'),
    },
    {
        id: 'disciplines',
        n: 12,
        phase: 'drafting',
        icon: MoreHorizontal,
        title: 'D5 – D8 · The remaining disciplines',
        short: 'Guidance only, for now',
        engine: 'ai',
        does: 'Corrective actions, effectiveness verification, prevention and closure are drafted from '
            + 'the same report call, guided by a written brief per discipline. They do not yet have the '
            + 'four-layer contract that D1 – D4 have.',
        why: 'The four disciplines that consume precedent data were worth pinning down first — they are '
            + 'the ones where an invented fact reaches a customer. The rest keep their current runtime '
            + 'configuration until the same treatment is worth its cost.',
        noConfig: 'Open a card below to edit a discipline. D5 – D8 show as Planned: their guidance is '
            + 'editable, their input, output and constraint layers are not yet.',
        status: ({ prompts }) => ({
            text: `${prompts.prompts.length} disciplines defined`,
            ready: prompts.prompts.length === 8,
        }),
    },
];
