/**
 * Prompt cho pipeline 8D.
 *
 * Toàn bộ nội dung sinh ra là TIẾNG ANH — web hiển thị tiếng Anh, nên prompt
 * cũng viết bằng tiếng Anh để không phải bắc cầu ngôn ngữ giữa yêu cầu và đầu ra.
 *
 * ── Nguyên tắc chi phối mọi prompt ở đây ──
 * Model KHÔNG được sinh fact mới. Dataset đã chứa sẵn phần lớn nội dung 8D
 * (team, actions, Ishikawa, 5-Why, lessons learned) dưới dạng dữ liệu có cấu
 * trúc. Việc của model là diễn đạt thành báo cáo và lấp chỗ trống một cách
 * trung thực — không phải phát minh ra một câu chuyện nghe hợp lý.
 *
 * `sources` trên mỗi discipline là cơ chế thực thi: bắt model chỉ ra fact nào
 * chống lưng cho lời nó viết. Một discipline có `sources` rỗng mà `dataBacked`
 * lại true là dấu hiệu model đang bịa.
 */

import { DISCIPLINE_CODES, DISCIPLINE_TITLES, type CaseContext, type DisciplineCode } from './types';
import type { ContextEnrichment } from './schemas';
import type { IndependentAnalysis } from './independentAnalysis';

// ─────────────────────────────────────────────────────────────────────────────
// Bước 1 — làm giàu ngữ cảnh
// ─────────────────────────────────────────────────────────────────────────────

export const ENRICHMENT_SYSTEM_PROMPT = `
You are a data analysis component in a QM 8D pipeline.

A deterministic mapper has already extracted the verified facts of a defect case
into a CaseContext object. You receive both the RAW dataset and that CaseContext.

Your job is NOT to re-extract what the mapper already captured. It is to add the
four things a rule-based mapper cannot produce:

1. unmapped
   Fields present in the RAW dataset that do not appear anywhere in CaseContext.
   Report each as a dotted path plus its value rendered as text. If everything
   material is already mapped, return an empty array. Do not pad this list with
   metadata, schema definitions or comment fields.

2. derivedFacts
   Short factual statements obtained by ARITHMETIC OR COMPARISON over values
   that already exist. Examples of the right kind of statement:
     - "Measured burr height 0.32mm is 3.2x the 0.10mm maximum."
     - "The tool ran 3,800 cycles past its 8,000-cycle replacement limit, 47% over."
     - "Elapsed time from found date to completion date is 25 days."
   Never introduce a quantity that is not computable from the input. If you
   cannot compute anything meaningful, return an empty array.

3. dataQualityNotes
   Contradictions, gaps or suspicious values you notice. Be specific.

4. severity + severityRationale
   Rate the defect Low / Medium / High / Critical. Weigh the quantity affected,
   the cost of poor quality, how far measurements sit outside specification, and
   whether a customer is involved. Justify in one or two sentences, citing the
   figures you used.

RULES
- Never invent a value. Every number you state must be present in, or computable
  from, the input.
- A string beginning "N/A -" is a DELIBERATE value meaning "does not apply",
  not missing data. Never report it as a gap.
- Output valid JSON matching the schema. No prose outside the JSON.
`.trim();

export function buildEnrichmentPrompt(raw: unknown, context: CaseContext): string {
    // Cắt bỏ metadata trước khi gửi: `schema` một mình đã chiếm ~18KB trong tổng
    // ~41KB của file, mà không chứa fact nào của case. Chỉ `enumerations` là có
    // ích vì nó khai ánh xạ action_type → bước 8D.
    const rawObj = (raw ?? {}) as Record<string, unknown>;
    const trimmed = {
        data: rawObj.data,
        enumerations: (rawObj.schema as any)?.enumerations,
    };

    return [
        '## RAW DATASET (metadata stripped)',
        '```json',
        JSON.stringify(trimmed),
        '```',
        '',
        '## CASE CONTEXT (already extracted by the mapper)',
        '```json',
        JSON.stringify(context),
        '```',
    ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Bước 2 — sinh báo cáo 8D
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hướng dẫn riêng cho từng discipline — phần DUY NHẤT của prompt sinh báo cáo
 * mà admin sửa được trên UI.
 *
 * ── Vì sao tách ra khỏi phần còn lại ──
 * Phần luật ở trên (grounding, sources, honesty về gaps, D6 luôn dataBacked =
 * false) là thứ giữ cho model không bịa. Cho sửa nó trên UI nghĩa là cho phép
 * tắt cơ chế chống bịa bằng vài cú gõ, và không ai đọc lại diff.
 *
 * Còn "D4 nên nhấn cái gì", "D8 nên tóm tắt thế nào" thì là quyết định nghiệp vụ
 * và thay đổi theo nhà máy. Đó mới là phần đáng đưa vào DB.
 *
 * Text ở đây được seed thẳng vào bảng `StepPrompts` để admin nhìn thấy và sửa
 * từ bản đang chạy, thay vì phải đi tìm trong code rồi chép sang.
 */

/**
 * Bỏ phần thụt đầu dòng mà template literal thừa hưởng từ code.
 *
 * Không có nó thì mỗi dòng prompt mang theo 4 dấu cách của chỗ khai báo — chúng
 * đi thẳng vào prompt gửi cho model, vào bảng `StepPrompts`, rồi hiện ra trong ô
 * soạn thảo trên UI như một lỗi căn lề. Tính theo dòng thụt ÍT nhất (bỏ qua dòng
 * đầu, vốn nằm ngay sau dấu backtick), nên thụt sâu hơn của danh sách con vẫn
 * giữ nguyên tương quan.
 */
function dedent(text: string): string {
    const lines = text.split('\n');
    const indents = lines.slice(1).filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length);
    const base = indents.length ? Math.min(...indents) : 0;
    return lines.map((l, i) => (i === 0 ? l : l.slice(base))).join('\n').trim();
}

const GUIDE_SOURCE: Record<DisciplineCode, string> = {
    D1: `Produce TWO separate lists, not one blended list.

      1. Suggested roles - the functions this work actually needs (Quality
         Engineer, Production Engineer, and so on), taken from the teams of the
         precedent cases that cleared the similarity threshold.
      2. Suggested individuals - the specific people who served on those teams,
         ranked by how many of the precedent cases each one worked. State that
         count for every name.

    Cite the precedent behind every role and every name with precedents#N.

    Precedents are scored: work centre +4, defect code +4 (or +2 when only the
    defect text overlaps), material +3 (or +1 for the same material family), out
    of 11. Below 3 is not a precedent. When no case clears 3, write that no team
    suggestion is available and the team must be assigned manually. That is the
    correct answer - a plausible list of invented roles is not.

    Where this case already records a team, name the leader and members with
    their functions and say in one or two sentences why that skill mix fits THIS
    defect. Bring in a precedent person only to cover a capability the current
    team lacks.

    Never name a person who is not in the current team or a precedent team.
    Never output team.assignedRoster: the quality engineer fills that table in on
    the report screen, and email and telephone auto-fill from the business
    partner record without your help.`,

    D2: `Write the problem twice from the SAME facts - one short paragraph, then
    the 5W2H grid. They must agree; the grid is not a second analysis.

      What      the defect by its catalogue classification - code GROUP and
                defect code together, with the catalogue description, e.g.
                "QM-DIM / 0004 - Bore diameter out of tolerance". The code alone
                is not a key: it is only unique inside its group. Where
                product.defectCodeGroup is empty, give the code and say the group
                is not recorded - do not guess it from the code.
                Then the measurement that proves it: measured value against
                specification, with units, and say plainly whether it is out of
                tolerance. Quote the specification as the recorded limits
                (specLowerLimit / specUpperLimit / specUom) when they are set;
                specValue is display text and may be free prose. Where a row
                carries a valuation, that is the inspector's judgement - report
                it as the verdict, and do not overturn it with your own reading
                of the numbers. Where outOfSpec is null, say the row was not
                judged rather than deciding it yourself
      Where     the work centre, by ID and name
      When      the date the defect was found
      Who       for a customer complaint, cite the customer contact. For an
                internal defect, cite the reporter (e.g. responsibility.reportedBy)
                or coordinator if recorded; if no reporter is tracked in system,
                state that it is not tracked rather than inventing anyone
      How       how the defect surfaced: in-process inspection, customer
                complaint, final audit
      How many  the quantity or extent affected, and the batch it belongs to

    Every box names the field it came from. A box with no source says so; it does
    not get a plausible value.

    Is / Is-Not narrows the root cause. The IS and IS NOT values are COMPUTED by
    the system from the historical inspection lots: it groups them by equipment,
    counts the nonconforming rate per group, and takes the sharpest contrast. You
    do not choose them and you must not restate or alter them.

    Your job is problem.isIsNotBasis. Format it with clean sections:
      - Detail by characteristic: For each measured characteristic, state the lot IDs and measurements contrasting affected equipment vs conforming equipment.
      - Synthesis & Conclusion: State plainly that both groups share the same material and process, isolating the equipment/fixture as the sole distinguishing variable for D4.

    When the system reports that no comparison was possible, do not invent one.
    Leave the basis empty and let the status line speak for itself.`,

    D3: `Containment protects the customer and the line WHILE the cause is still
    unknown. Keep every containment action description simple, direct and concise
    (e.g., "Quarantine remaining stock from batch B-49172 and 100% burr check before packing").

    Assign an owner to each containment action from the D1 team roster (team.roster or team.leader/members), formatted strictly as "Name (Role)" (e.g. "Elena Rostova (Team Leader)" or "Anna Schmidt (Quality Engineer)"). Match the action to the person's responsibility.

    Work in this order:
      1. If this case already records containment actions, report them cleanly -
         stating the action description, owner and its status.
      2. Only when nothing is recorded, propose the containment action from the
         highest-scoring precedent cleanly, assign the appropriate D1 team member as owner formatted as "Name (Role)", and adapt the batch and quantity.

    Do not write long verbose paragraphs inside the action text.`,

    D4: `The discipline the whole report is judged on.

    Take the recorded answer in this order:
      1. the step of this case's 5-Why chain tagged as the root cause;
      2. if no step is tagged, the Ishikawa row marked as the root cause.

    Walk the chain step by step and cite the evidence at each step. Name the
    confirmed Ishikawa category and say why the other five were ruled out - the
    context gives you a row for each of the six. Where the chain shows both a
    technical and a systemic cause, separate them.

    A precedent root cause is a finding about ANOTHER case. Present it as a
    hypothesis with the case ID and score, never as this case's cause, and for
    each one name the single piece of evidence that would confirm or kill it
    here.

    You are also given INDEPENDENT DIAGNOSIS - a conclusion reached from the raw
    evidence alone, with the 5-Why chain, the root-cause flag, the corrective
    actions and the FMEA link all withheld. Close D4 with a short paragraph
    headed "Independent verification":
      - Agrees: say so, and note it was reached without access to the recorded
        answer. That is corroboration; state it plainly and briefly.
      - Disagrees: say so openly. Report which branch it chose and why, then
        weigh that against the recorded conclusion. Do not side with the recorded
        answer because it is the recorded answer - if the measurements support
        the independent reasoning better, say so.
      - Note its confidence and any evidence gap it flagged.
    Cite "independent" in this discipline's sources.

    WHEN THIS CASE HAS NO INVESTIGATION AT ALL - fiveWhy empty AND ishikawa
    empty AND no root cause recorded - everything above describes data you do not
    have. Do not improvise a different shape for that situation; follow this one,
    and follow it the same way every time:

      - In rootCause.statement, state the root cause hypothesis directly, concisely,
        and without preamble or multi-sentence paragraphs (e.g.
        "Root cause (hypothesis): Undefined or missing milling process specification (Method).").
        Never end on the bare denial; state the leading hypothesis directly. Do not write long disclaimers or audit plans here.

      - The 5-Why chain is about THE DEFECT, always. Never write a chain about
        why the investigation was not done, why records are missing, or how the
        process failed. Keep questions short & crisp and answers direct & concise
        (max 1 short sentence per step, stating the direct cause).
        Start from the observed symptom and walk down the plausible technical causes.
        Where a step cannot be answered from evidence, put the candidate causes in the
        answer concisely and cite the record in evidence.

      - Each Ishikawa branch gets a VERDICT, not an investigation plan. Say what
        that branch tells you in 1 short phrase or sentence and stop: "shift-independent",
        "gauge R&R 8%", "fixture #2 clamp worn 0.2 mm", "no PM log", "not assessed".
        A reader scans six cells to see which one stands out - never write multi-sentence
        paragraphs or audit plans in 6M cells.
        Where a branch is ruled out, say what ruled it out. Where nothing is
        known, "not assessed" is the whole answer.
        The evidence still to be gathered goes ONCE in rootCause.evidenceGaps,
        never repeated per branch. Mark at most one branch as the root cause, and
        only when the evidence you DO have points there. When nothing points
        anywhere, mark none.

      - Keep all three consistent. The statement, the chain and the board must
        describe the same hypothesis in the same register. A confident board next
        to a statement that says nothing was determined reads as two different
        reports stapled together.

    You never confirm a root cause. The engineer sets that flag.`,

    D5: `Every corrective action must name the step of the D4 chain it removes. An
    action that ties to no step is aimed either at a symptom or at a cause you
    have not established - say which.

    Assign an owner to each corrective action chosen from the D1 team roster (team.roster or team.leader/members), formatted strictly as "Name (Role)" (e.g. "Karl Wagner (Maintenance Planner)" or "Marcus Vance (Manufacturing Engineer)"). Match their role to the root cause fix. Do not output generic "Unassigned" when a member is in the D1 team.

    Report the corrective actions on record with their owner and status. Then state plainly
    which part of the root cause no recorded action covers. That gap is the most
    useful line on this page.

    When nothing is recorded, propose the corrective action from the
    highest-scoring precedent, assign the suitable D1 team member as owner formatted as "Name (Role)", cite the case and its score, and tie it to the
    hypothesis it would fix.

    Corrective is not containment. An action that only limits damage while the
    cause remains belongs in D3.`,

    D6: `This dataset carries no verification evidence, so nothing here may be
    called proven effective, however convincing the corrective action looks.

    Do two things:
      1. List every recorded action with its current status, so the engineer sees
          what is outstanding. Status changes are theirs to make, not yours.
      2. Write the verification PLAN the case still needs: what to measure, on
          what sample size, over what period, against what acceptance criterion,
          and who signs it off. Anchor the criterion to the actual specification
          value in inspections - "back within the 0.50mm tolerance on 30
          consecutive parts" is a plan, "monitor the process" is not.`,

    D7: `Preventive action stops the same cause reaching a different part, line or
    shift. An action that only protects this material or this batch is corrective
    and belongs in D5.

    Assign an owner to each preventive action from the D1 team roster (team.roster or team.leader/members), formatted strictly as "Name (Role)" (e.g. "Anna Schmidt (Quality Engineer)"), based on who is responsible for the affected process, tooling, maintenance, or quality system.

    Report the preventive actions on record with owner, then say which FMEA entry must
    change and how: the occurrence rating, the detection rating, or the control
    itself. Name the FMEA entry by ID when the case links one.

    Where the dataset carries no preventive action or no FMEA link, say so and
    state what a systemic fix would have to cover.

    Precedents matter more here than anywhere else: a preventive action that
    already worked on the same work centre outranks a fresh proposal. Name the
    FMEA entries those precedents link to, with the case ID and score.`,

    D8: `Closure is a gate, not a summary. Check D1 through D7 first: if any is
    incomplete, name which ones and state that the case cannot be closed yet. You
    never close a case - the engineer does, and only once that gate passes.

    Then write the lessons learned, both halves and honestly:
      - What worked - the specific thing worth repeating, not "good teamwork"
      - What did not - the thing that cost time, or let the defect through

    Recognise the team by name. Close by stating what remains open: actions still
    unverified, an FMEA update still pending, any evidence gap the report could
    not fill.`,
};

export const DEFAULT_DISCIPLINE_GUIDE: Record<DisciplineCode, string> = Object.freeze(
    Object.fromEntries(
        Object.entries(GUIDE_SOURCE).map(([code, text]) => [code, dedent(text)]),
    ) as Record<DisciplineCode, string>,
);

/** Khung prompt sinh báo cáo. `{{DISCIPLINE_GUIDE}}` được thay lúc chạy. */
const EIGHT_D_RULES = `
You are a senior quality engineer writing an 8D report for a quality defect case.

You receive a CaseContext of VERIFIED FACTS extracted from the quality system,
plus an enrichment object with derived figures and a severity assessment. Your
job is to write the 8D narrative. It is not to discover new facts.

## HARD RULES

1. GROUNDING. Every number, ID, name, date and measurement you write must come
   from the CaseContext or the enrichment. If you need something that is not
   there, say so plainly in the content rather than inventing it.

2. SOURCES. Every discipline must list the paths it rests on. Each path is
   resolved against the actual CaseContext and enrichment objects you were
   given. A path that does not resolve is discarded, and a discipline left with
   no valid source is downgraded to dataBacked = false.

   Syntax:
     - dot notation for fields:        header.quantityExtent · product.batchId
     - #N for array elements, 1-based: fiveWhy#2 · actions.containment#1
     - a category name indexes the Ishikawa array: ishikawa.Machine
     - the whole node is also valid:   team · rootCause · customer · gaps

   Examples that resolve: origin · header.status · product.materialId ·
   inspections#1 · isIsNot · rootCause.category · ishikawa.Measurement ·
   fiveWhy#3 · actions.corrective#2 · team.leader · fmea · copqEur ·
   lessonsLearned.whatWorked · responsibility.reportedBy · gaps#1 · enrichment.derivedFacts#2

   #N must not exceed the number of entries actually present. Citing fiveWhy#7
   on a case with three steps is a fabrication and is rejected. Prefer the most
   specific path that supports your claim. Cite what you actually used, not
   every path available.

3. HONESTY ABOUT GAPS. Some disciplines have no source data in this dataset.
   When that happens:
     - set dataBacked = false
     - state clearly in the content what is missing
     - propose what should be done, rather than describing it as done
   Never write a confident narrative for a discipline with no supporting data.
   Read CaseContext.gaps: it tells you exactly which disciplines are unsupported.

4. D6 ALWAYS HAS NO DATA. This dataset carries no verification evidence, so no
   corrective action can be described as proven effective. For D6, always set
   dataBacked = false and write a concrete verification PLAN: what to measure,
   over what sample size, across what period, against what acceptance criterion,
   and who signs it off. Anchor the criterion to the actual specification values
   in inspections.

5. CONFIDENCE. Be honest. 0.9 and above when the discipline rests on complete
   facts. 0.5 to 0.7 when you had to reason across gaps. Below 0.5 when you are
   largely proposing rather than reporting.

6. PRECEDENT CASES. You may be given closed cases scored as similar to this one,
   each with the score that earned it a place and why. They are the strongest
   material you have when THIS case has no investigation of its own yet.

   Use them, and use them explicitly:
{{PRECEDENT_STEPS}}

   Cite them as precedents#1, precedents#2 — numbered as given, best first.
   A precedent is evidence about ANOTHER case. Borrowing its conclusion without
   saying where it came from is the worst failure mode available to you: it
   reads as a finding about this case and nobody can tell it apart.

   No precedents given means none scored high enough. Do not invent one, and do
   not treat a low-scoring case as if it qualified.

## DISCIPLINE GUIDE

{{DISCIPLINE_GUIDE}}

## STYLE — SAY WHAT THE READER MUST KNOW, NOTHING ELSE

The output is read on a dashboard by an engineer who has to act. The test for
every sentence is not "is it true" — it is "does the reader need this to decide
what to do next". Cut everything that fails that test, however true.

- ONE FIELD, ONE ANSWER. Each field answers the single question its label asks.
  Answer it, then stop. Do not explain how you reached it, do not restate the
  question, do not preview what another field will say.

- GIVE THE VERDICT, NOT THE INVESTIGATION PLAN. "Machine: spindle runout 4µm vs
  10µm limit" tells the reader something. "Requires assessment of machine
  maintenance records and tool condition" tells them nothing they did not
  already know, and it costs them the time to read it.

- EVIDENCE STILL MISSING IS LISTED ONCE. Every step has one place for gaps -
  the gaps or evidence field. Naming the same missing record inside three other
  fields does not make it more missing; it buries the fields that do carry an
  answer.

- LEAD WITH THE FACT. Number, identifier or verdict first; qualification after,
  if it is needed at all.

    write   "Hole position ⌀0.18 vs ⌀0.20 tol"
    not     "The measured hole position was 0.18 mm against a tolerance of 0.20 mm."

    write   "OP 40 · fixture #2"
    not     "The defect occurred at operation 40 on fixture number 2."

  Use " · " to join facts inside one field rather than writing linking prose.

- BANNED OPENERS. Every one of these is a sentence that has not started yet:
  "It should be noted that", "Based on the available evidence",
  "This indicates that", "Requires assessment of", "Further investigation is
  needed to determine". If a record is missing, name it and stop: "no PM log",
  "no CMM data".

- LENGTH FOLLOWS FROM THE ABOVE, it is not a target of its own. A step with real
  measurements to report may run long and be right; a step with nothing to
  report must be a line or two. Never pad a thin step to look thorough, and
  never cut a fact the reader needs in order to look concise.

- content is markdown: short bullets, no headings — the interface renders the
  discipline title already.
- summary is one sentence: the single thing a reader learns from this step.
- Write for a reader who knows manufacturing but not this case.

{{SUMMARIES}}

Output valid JSON matching the schema. No prose outside the JSON.
`.trim();

/**
 * Hướng dẫn dùng tiền lệ, tách theo bước.
 *
 * Lượt gọi sinh MỘT bước không nên phải đọc hướng dẫn của bảy bước còn lại.
 * Với model nhỏ, phần thừa không chỉ vô ích — nó cạnh tranh sự chú ý với đúng
 * dòng cần đọc.
 */
const PRECEDENT_STEP_GUIDANCE: Partial<Record<DisciplineCode, string>> = {
    D1: `     - D1  When no team is recorded, propose the people who actually served on
           the precedent teams, by name and function. Say how many of the
           precedent cases each person worked. Never invent a name that is not
           in a precedent team.`,
    D3: `     - D3  When no containment action is recorded, propose what the precedent
           contained, and say which case it came from.`,
    D4: `     - D4  A precedent's confirmed root cause is a HYPOTHESIS for this case, not
           a finding. Say plainly that it is a lead to check, and name what
           evidence would confirm or kill it.`,
    D5: `     - D5  When no corrective action is recorded, propose what the precedent
           corrected, and say which case it came from.`,
    D7: `     - D7  Same for preventive actions and FMEA updates: propose what the
           precedent put in place, and name the case it came from.`,
};

/**
 * Hai bản tóm tắt KHÔNG thuộc lượt gọi từng bước — một lượt riêng viết chúng.
 * Để nguyên khối này trong prompt một bước là bảo model sinh ra hai trường không
 * hề có trong schema của lượt đó.
 */
const SUMMARIES_SECTION = `## SUMMARIES

- internalSummary: candid, for the plant. Name equipment, batches and people.
  Include the cost of poor quality and the current status.

- customerSummary: ONLY when origin is "Q1 - Customer Complaint". Outward
  facing: no internal blame, no employee names, no equipment or batch IDs, no
  cost figures. State what was found, what has been contained, what is being
  corrected, and by when. Professional and accountable, not defensive.
  When origin is "Q3 - Internal Defect", set this to null.`;

/**
 * Lắp `EIGHT_D_RULES` cho đúng tập bước mà lượt gọi này phải sinh.
 *
 * Gọi với đủ tám mã thì kết quả giống hệt bản viết tay trước đây — đó là điều
 * `disciplineGuide.test.ts` khoá lại.
 */
function renderRules(steps: readonly DisciplineCode[], guide: string): string {
    const precedentSteps = steps
        .map((code) => PRECEDENT_STEP_GUIDANCE[code])
        .filter(Boolean)
        .join('\n');

    return EIGHT_D_RULES
        .replace('{{DISCIPLINE_GUIDE}}', guide)
        .replace('{{PRECEDENT_STEPS}}', precedentSteps)
        // Chỉ lượt gọi gộp mới sinh hai bản tóm tắt.
        .replace('{{SUMMARIES}}', steps.length === DISCIPLINE_CODES.length ? SUMMARIES_SECTION : '')
        // Bỏ khối rỗng để lại sau khi cắt, tránh ba dòng trắng liên tiếp.
        .replace(/\n{3,}/g, '\n\n');
}

/**
 * Ghép prompt hệ thống cho bước sinh báo cáo.
 *
 * @param overrides Hướng dẫn từng bước lấy từ bảng `StepPrompts`. Bước nào không
 *                  có (hoặc để trống, hoặc bị tắt) thì rơi về
 *                  `DEFAULT_DISCIPLINE_GUIDE` — nên một bảng rỗng cho ra ĐÚNG
 *                  prompt như trước khi có tính năng này.
 */
export function buildEightDSystemPrompt(
    overrides?: Partial<Record<DisciplineCode, string>>,
    constraints?: Partial<Record<DisciplineCode, string>>,
): string {
    const guide = DISCIPLINE_CODES.map((code) => {
        const body = (overrides?.[code] ?? '').trim() || DEFAULT_DISCIPLINE_GUIDE[code];
        // Thụt lề đúng như bản viết tay để model đọc được ranh giới giữa các bước.
        const indented = body.split('\n').map((l) => (l.trim() ? `    ${l.trim()}` : '')).join('\n');
        return `${code}  ${DISCIPLINE_TITLES[code]}\n${indented}`;
    }).join('\n\n');

    const configuredConstraints = DISCIPLINE_CODES.flatMap((code) => {
        const value = constraints?.[code]?.trim();
        return value ? [`${code} configured constraints:`, value] : [];
    }).join('\n');
    const base = renderRules(DISCIPLINE_CODES, guide);
    return configuredConstraints ? `${base}\n\nCONFIGURED STEP CONSTRAINTS\n${configuredConstraints}` : base;
}

export interface PromptPrecedent {
    notificationId: string;
    score: number;
    maxScore: number;
    explanation: string;
    sapStatus: string | null;
    symptomShortText: string | null;
    defectText: string | null;
    workCenterDesc: string | null;
    materialDesc: string | null;
    rootCauseCategory: string | null;
    copqEur: number | null;
    fmeaId: string | null;
    team: Array<{ partnerName: string; functionTitle: string; partnerRole: string }>;
    actions: Array<{ actionType: string; actionText: string; status: string }>;
}

/**
 * Rút gọn tiền lệ trước khi đưa vào prompt.
 *
 * Bỏ `searchText`, `embedding`, `sourcePayload` — vector 1536 số không nói gì
 * với model mà chiếm hàng chục nghìn token, và `sourcePayload` là bản sao của
 * những gì đã có ở các trường trên.
 */
function renderPrecedents(precedents: PromptPrecedent[]): string {
    if (!precedents.length) {
        return 'None. No closed case scored high enough against this one.\n'
            + 'Do not borrow from a case that is not listed here.';
    }
    return precedents.map((p, i) => {
        const team = p.team.length
            ? p.team.map((t) => `${t.partnerName} (${t.functionTitle}${t.partnerRole?.includes('Leader') ? ', led the team' : ''})`).join('; ')
            : 'not recorded';
        const actions = p.actions.length
            ? p.actions.map((a) => `      ${a.actionType}: ${a.actionText} [${a.status}]`).join('\n')
            : '      none recorded';
        return [
            `precedents#${i + 1}  ${p.notificationId}  —  ${p.explanation}`,
            `      status: ${p.sapStatus ?? '—'}`,
            `      symptom: ${p.symptomShortText ?? '—'}`,
            `      defect: ${p.defectText ?? '—'} at ${p.workCenterDesc ?? '—'} on ${p.materialDesc ?? '—'}`,
            `      confirmed root cause: ${p.rootCauseCategory ?? 'not recorded'}`,
            `      cost of poor quality: ${p.copqEur == null ? '—' : `EUR ${p.copqEur}`}`,
            `      FMEA: ${p.fmeaId ?? 'none'}`,
            `      team: ${team}`,
            '      actions:',
            actions,
        ].join('\n');
    }).join('\n\n');
}

/**
 * Xếp hạng riêng của từng bước D trên CÙNG danh sách đã đánh số.
 *
 * ── Vì sao không in lại chi tiết tiền lệ cho từng bước ──
 * Tám bước × ba tiền lệ × mười dòng chi tiết là gấp tám lần token cho cùng một
 * nội dung, và tệ hơn: cùng một case xuất hiện tám lần với tám cách đánh số thì
 * trích dẫn `precedents#N` không còn nghĩa xác định.
 *
 * Danh sách chi tiết in MỘT lần, đánh số một lần. Mỗi bước chỉ nói nó xếp hạng
 * những số nào, theo thứ tự nào, với điểm bao nhiêu — đúng phần thật sự khác nhau.
 */
function renderStepRanking(
    precedents: PromptPrecedent[],
    stepRankings: Record<string, StepRanking> | undefined,
): string {
    if (!stepRankings || !precedents.length) return '';

    const indexById = new Map(precedents.map((p, i) => [p.notificationId, i + 1]));
    const lines: string[] = [];

    for (const code of DISCIPLINE_CODES) {
        const ranking = stepRankings[code];
        if (!ranking) continue;

        const ranked = ranking.notificationIds
            .map((id) => ({ id, index: indexById.get(id), score: ranking.scores[id] }))
            .filter((r) => r.index !== undefined);

        lines.push(
            ranked.length
                ? `- ${code} (profile "${ranking.profileLabel}"): `
                  + ranked.map((r) => `precedents#${r.index} at ${r.score}/${ranking.maxScore}`).join(', ')
                : `- ${code} (profile "${ranking.profileLabel}"): none scored high enough. `
                  + 'Do not borrow from any precedent for this discipline.',
        );
    }

    if (!lines.length) return '';

    return [
        '',
        '## PRECEDENT RANKING PER DISCIPLINE',
        'Each discipline scores the library by its own criteria, so the same case can',
        'rank differently — or not qualify at all — depending on the discipline. Use only',
        'the precedents listed for the discipline you are writing, and cite them by the',
        'numbers above, which are the same across all disciplines.',
        ...lines,
    ].join('\n');
}

/** Thứ hạng tiền lệ của một bước D, tính bằng profile của riêng bước đó. */
export interface StepRanking {
    profileKey: string;
    profileLabel: string;
    maxScore: number;
    /** Mã case theo thứ tự bước này xếp hạng, tốt nhất trước. */
    notificationIds: string[];
    /** Điểm của bước này cho từng mã case. */
    scores: Record<string, number>;
}

export function buildEightDPrompt(
    context: CaseContext,
    enrichment: ContextEnrichment,
    independent: IndependentAnalysis,
    precedents: PromptPrecedent[] = [],
    inputSchemas?: Partial<Record<DisciplineCode, string>>,
    formSchemas?: Partial<Record<DisciplineCode, string>>,
    stepRankings?: Record<string, StepRanking>,
): string {
    const gapNotice = context.gaps.length
        ? [
            '## KNOWN GAPS — these disciplines have no source data',
            ...context.gaps.map((g) => `- ${g}`),
            '',
            'Set dataBacked = false for every discipline affected by the above.',
            '',
        ].join('\n')
        : '';

    const originNotice = context.isCustomerFacing
        ? 'This is a CUSTOMER COMPLAINT (Q1). Produce customerSummary.'
        : 'This is an INTERNAL DEFECT (Q3). Set customerSummary to null.';

    const configuredDataSchemas: string[] = [];
    const configuredOutputs: string[] = [];
    for (const code of DISCIPLINE_CODES) {
        if (inputSchemas?.[code]) {
            try {
                const configured = JSON.parse(inputSchemas[code]!);
                configuredDataSchemas.push(`## ${code} DATA SCHEMA (output data contract)\n\`\`\`json\n${JSON.stringify(configured)}\n\`\`\``);
            } catch { /* Invalid admin JSON is ignored at runtime; save validation prevents new invalid values. */ }
        }
        if (formSchemas?.[code]) {
            try {
                const schema = JSON.parse(formSchemas[code]!) as { fields?: Array<{ key?: string; binding?: string; label?: string; widget?: string; dataType?: string; items?: unknown; properties?: unknown; constraints?: unknown }> };
                const fields = (schema.fields ?? []).map((field) => ({ path: field.binding?.trim() || field.key, label: field.label, type: field.dataType, widget: field.widget, items: field.items, properties: field.properties, constraints: field.constraints })).filter((field) => field.path);
                configuredOutputs.push([`## ${code} AI-GENERATED FORM OUTPUT CONTRACT`, `You must generate every listed field inside the ${code} discipline data object. Use nested objects for dotted paths (for example, team.objective becomes data.team.objective). Do not leave a required field absent; when verified facts are unavailable, provide an explicit evidence-limited recommendation or gap statement without inventing identities, measurements, or completed actions.`, '```json', JSON.stringify(fields), '```'].join('\n'));
            } catch { /* See input-schema handling above. */ }
        }
    }

    return [
        `## ORIGIN\n${originNotice}`,
        '',
        gapNotice,
        '## CASE CONTEXT',
        '```json',
        JSON.stringify(context),
        '```',
        '',
        '## ENRICHMENT',
        '```json',
        JSON.stringify(enrichment),
        '```',
        '',
        '## INDEPENDENT DIAGNOSIS',
        'Reached from raw evidence only. The recorded 5-Why chain, root cause flag,',
        'corrective actions and FMEA link were withheld from this analysis.',
        independent.verdict.agrees
            ? `It AGREES with the recorded root cause (${independent.verdict.recordedCategory}).`
            : `It DISAGREES: it chose ${independent.verdict.aiCategory}, the record says ` +
              `${independent.verdict.recordedCategory}.`,
        '```json',
        JSON.stringify(independent.finding),
        '```',
        '',
        '## PRECEDENT CASES',
        'Closed cases scored as similar to this one, best match first. See rule 6.',
        '',
        renderPrecedents(precedents),
        renderStepRanking(precedents, stepRankings),
        ...configuredDataSchemas,
        ...configuredOutputs,
    ].filter(Boolean).join('\n');
}

export function buildSingleStepSystemPrompt(
    code: DisciplineCode,
    overrideGuide?: string,
    constraint?: string,
): string {
    const body = (overrideGuide ?? '').trim() || DEFAULT_DISCIPLINE_GUIDE[code];
    const indented = body.split('\n').map((l) => (l.trim() ? `    ${l.trim()}` : '')).join('\n');
    const guide = `${code}  ${DISCIPLINE_TITLES[code]}\n${indented}`;

    // Đặt phạm vi lên ĐẦU, trước mọi luật. Phần luật bên dưới nói "every
    // discipline"; không chốt phạm vi ở đây thì model nhỏ dễ trả về nhiều bước
    // hoặc bọc kết quả trong một mảng `disciplines`.
    const scope = [
        '## THIS CALL',
        `Produce EXACTLY ONE discipline object: ${code} — ${DISCIPLINE_TITLES[code]}.`,
        'Return that single object. Do not wrap it in an array or in a "disciplines" field.',
        'Do not write any other discipline. A separate call writes the summaries.',
        `Set code to "${code}". Anything else is discarded.`,
        '',
    ].join('\n');

    const configuredConstraints = constraint?.trim() ? `${code} configured constraints:\n${constraint.trim()}` : '';
    const base = `${scope}\n${renderRules([code], guide)}`;
    return configuredConstraints ? `${base}\n\nCONFIGURED STEP CONSTRAINTS\n${configuredConstraints}` : base;
}

export function buildSingleStepPrompt(
    code: DisciplineCode,
    context: CaseContext,
    enrichment: ContextEnrichment,
    independent: IndependentAnalysis,
    precedents: PromptPrecedent[] = [],
    stepRanking?: StepRanking,
    previousDisciplines: import('./types').DisciplineDraft[] = [],
    inputSchemaJson?: string,
    formSchemaJson?: string,
): string {
    const gapNotice = context.gaps.length
        ? [
            '## KNOWN GAPS — these disciplines have no source data',
            ...context.gaps.map((g) => `- ${g}`),
            '',
            'Set dataBacked = false for every discipline affected by the above.',
            '',
        ].join('\n')
        : '';

    const originNotice = context.isCustomerFacing
        ? 'This is a CUSTOMER COMPLAINT (Q1).'
        : 'This is an INTERNAL DEFECT (Q3).';

    const configuredDataSchemas: string[] = [];
    const configuredOutputs: string[] = [];

    if (inputSchemaJson) {
        try {
            const configured = JSON.parse(inputSchemaJson);
            configuredDataSchemas.push(`## ${code} DATA SCHEMA (output data contract)\n\`\`\`json\n${JSON.stringify(configured)}\n\`\`\``);
        } catch { }
    }

    if (formSchemaJson) {
        try {
            const schema = JSON.parse(formSchemaJson) as { fields?: Array<{ key?: string; binding?: string; label?: string; widget?: string; dataType?: string; items?: unknown; properties?: unknown; constraints?: unknown }> };
            const fields = (schema.fields ?? []).map((field) => ({ path: field.binding?.trim() || field.key, label: field.label, type: field.dataType, widget: field.widget, items: field.items, properties: field.properties, constraints: field.constraints })).filter((field) => field.path);

            // Nêu lại các ràng buộc khắt khe bằng câu chữ, ngoài khối JSON.
            // Đo trên gemini-2.5-flash: chôn `enum` trong một blob JSON thì nó
            // trả `team.selectionMethod` là chuỗi tự do, và bỏ trắng
            // `rootCause.fiveWhy` dù có `minItems`. Response schema mới là thứ
            // chặn được tuyệt đối, nhưng nói rõ ở đây thì model không phải suy
            // ra ràng buộc từ một cấu trúc lồng nhau.
            const spelledOut = (schema.fields ?? []).flatMap((field) => {
                const path = field.binding?.trim() || field.key;
                const c = (field.constraints ?? {}) as { required?: boolean; enum?: unknown[]; minItems?: number };
                if (!path) return [];
                const notes: string[] = [];
                if (Array.isArray(c.enum) && c.enum.length) {
                    notes.push(`must be exactly one of: ${c.enum.map((v) => `"${String(v)}"`).join(' | ')}`);
                }
                if (c.minItems) notes.push(`at least ${c.minItems} item${c.minItems > 1 ? 's' : ''}`);
                if (c.required && !notes.length) notes.push('required — never leave absent or empty');
                return notes.length ? [`- data.${path}: ${notes.join('; ')}`] : [];
            });

            configuredOutputs.push([
                `## ${code} AI-GENERATED FORM OUTPUT CONTRACT`,
                `You must generate every listed field inside the ${code} discipline data object. Use nested objects for dotted paths. Do not leave a required field absent.`,
                // Quan sát thật trên gemini-2.5-flash: nó nhồi why + answer +
                // evidence vào riêng ô `why`, kèm hậu tố tự bịa "(Independent
                // Diagnosis Step 1 of 3.)", lặp lại bốn lần, rồi để `answer`
                // trống. Vòng lặp đó chạy tới khi hết ngân sách token.
                'ONE VALUE PER FIELD. Each field holds only what its name and description say.',
                '  - Never put two fields\' content into one field. If a row has why/answer/evidence,',
                '    the question goes ONLY in why, the answer ONLY in answer, the proof ONLY in evidence.',
                '  - Never repeat a field\'s own content inside itself, and never restate the question',
                '    inside the answer.',
                '  - Field values are plain text. No markdown, no "**Evidence:**" style labels,',
                '    no headings, no bullet markers.',
                '  - Do not append citations to a field value. Citations belong in the sources array.',
                '  - Every row of an array must be DISTINCT. If you have nothing new to add, stop the',
                '    array; a short correct list beats a padded one.',
                '```json',
                JSON.stringify(fields),
                '```',
                ...(spelledOut.length ? ['', `${code} fields with strict constraints — these are checked and rejected:`, ...spelledOut] : []),
            ].join('\n'));
        } catch { }
    }

    const prevNotice = previousDisciplines.length
        ? [
            '## PREVIOUSLY GENERATED STEPS IN THIS REPORT',
            'Use these already established facts and decisions for consistency:',
            '```json',
            JSON.stringify(previousDisciplines.map((d) => ({ code: d.code, title: d.title, summary: d.summary, data: d.data }))),
            '```',
            '',
        ].join('\n')
        : '';

    const rankings: Record<string, StepRanking> = stepRanking ? { [code]: stepRanking } : {};

    return [
        `## TARGET DISCIPLINE: ${code} (${DISCIPLINE_TITLES[code]})`,
        `## ORIGIN\n${originNotice}`,
        '',
        gapNotice,
        prevNotice,
        '## CASE CONTEXT',
        '```json',
        JSON.stringify(context),
        '```',
        '',
        '## ENRICHMENT',
        '```json',
        JSON.stringify(enrichment),
        '```',
        '',
        '## INDEPENDENT DIAGNOSIS',
        '```json',
        JSON.stringify(independent.finding),
        '```',
        '',
        '## PRECEDENT CASES',
        renderPrecedents(precedents),
        renderStepRanking(precedents, rankings),
        ...configuredDataSchemas,
        ...configuredOutputs,
    ].filter(Boolean).join('\n');
}

export function buildSummariesPrompt(
    context: CaseContext,
    enrichment: ContextEnrichment,
    disciplines: import('./types').DisciplineDraft[],
): string {
    const originNotice = context.isCustomerFacing
        ? 'This is a CUSTOMER COMPLAINT (Q1). Produce both internalSummary and customerSummary.'
        : 'This is an INTERNAL DEFECT (Q3). Produce internalSummary, set customerSummary to null.';

    return [
        `## ORIGIN\n${originNotice}`,
        '',
        '## COMPLETE 8D DISCIPLINE REPORT',
        '```json',
        JSON.stringify(disciplines.map((d) => ({ code: d.code, title: d.title, summary: d.summary, content: d.content }))),
        '```',
        '',
        'Generate internalSummary and customerSummary based on the above report.',
    ].join('\n');
}
