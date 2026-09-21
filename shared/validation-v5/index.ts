import { Parser } from 'expr-eval';

// An outcome code is a free-form string defined per rule set in `outcomePolicy`
// (e.g. "pass", "warning", "error", or custom codes like "critical"). The number
// and meaning of outcomes is configurable; only the color/severity primitive
// below stays a fixed 3-value set so the UI palette does not need to grow.
export type ValidationOutcomeV5 = string;
export type ValidationSeverityV5 = 'success' | 'warning' | 'error';

export interface ValidationConfigV5 {
    version: 5;
    enabled: boolean;
    showStatusColumn?: boolean;
    objectType?: string;
    expressionLanguage?: string;
    ruleSets: ValidationRuleSetV5[];
}

export interface ValidationRuleSetV5 {
    ruleSetCode?: string;
    ruleSetName: string;
    active?: boolean;
    validationRunScope?: string[];
    statusChangeScope?: string[];
    referenceData?: Record<string, ReferenceDataConfigV5>;
    /**
     * Consolidated, configurable outcome model. Each entry defines one outcome
     * (identity + severity + blocking + its full policy). Array order = severity
     * rank (last = most severe); the winning outcome is the highest-ranked one
     * that occurs. Replaces the legacy aggregationPolicy/actionsPolicy/documentStatus.
     */
    outcomePolicy?: OutcomePolicyV5;
    functions: ValidationFunctionV5[];

    // ── Legacy v5.0 fields (read only for back-compat when outcomePolicy is absent) ──
    aggregationPolicy?: Record<string, unknown>;
    actionsPolicy?: Partial<Record<string, LegacyActionPolicyV5>>;
    documentStatus?: Partial<Record<string, LegacyDocumentStatusPolicyV5>>;
}

export interface OutcomePolicyV5 {
    /** Only "highestSeverityWins" is supported today. */
    aggregation?: 'highestSeverityWins';
    outcomes: OutcomeDefV5[];
}

export interface OutcomeDefV5 {
    code: string;
    label?: string;
    /** Color/severity primitive: success | warning | error. Drives chip color. */
    severity?: ValidationSeverityV5 | 'destructive' | 'info';
    /** Whether this outcome blocks the document (the overall verdict). */
    blocking?: boolean;
    chip?: { show?: boolean; label?: string };
    message?: { enabled?: boolean; text?: string };
    status?: { change?: boolean; target?: string };
    actions?: { block?: string[] };
    /**
     * Notification: when this outcome wins, fire the listed email/notification actions.
     * `actions` is the allow-list of action names to trigger (e.g. ["extractionFailedNotify"]).
     * Uses the generic `onValidationNotify` auto-trigger event.
     */
    notification?: { enabled?: boolean; actions?: string[] };
    /**
     * Auto-processing: when this outcome wins, automatically execute the document's next
     * action(s). `actions` is the ordered allow-list of action names that may run automatically
     * (the configurable ceiling, e.g. ["verifyData"] = stop at Verified; add "postDocument" = post).
     */
    autoProcessing?: { enabled?: boolean; actions?: string[] };
}

/** Legacy shapes kept only so old configs can be migrated on read. */
export interface LegacyActionPolicyV5 {
    canProceed?: boolean;
    blockActions?: { enabled?: boolean; actions?: string[] };
}
export interface LegacyDocumentStatusPolicyV5 {
    targetStatus?: string;
    chipLabel?: string;
    headerMessage?: { enabled?: boolean; text?: string };
    changeStatus?: boolean;
    autoProcessing?: boolean;
    notification?: boolean;
}

export interface ReferenceDataConfigV5 {
    referenceCode?: string;
    referenceName?: string;
    activeSource?: string;
    keyField?: string;
    sources?: Record<string, ReferenceDataSourceV5>;
}

export interface ReferenceDataSourceV5 {
    source: 'embedded' | 'odata' | string;
    enabled?: boolean;
    keyField?: string;
    rows?: Array<Record<string, unknown>>;
}

export interface ValidationFunctionV5 {
    functionCode: string;
    functionName: string;
    /**
     * Human-friendly explanation of what this function checks, authored in the UI.
     * Persisted with the config so user-created functions describe themselves; for
     * legacy seed functions that predate this field the editor falls back to a
     * curated preview map keyed by `functionCode`.
     */
    description?: string;
    active?: boolean;
    /**
     * Evaluation grain:
     * - `itemTable` — once per row of the top-level item array (the default).
     * - `nestedTable` — once per row of a named array nested under each item
     *   (`nestedArrayField`), e.g. schedule lines. Item-relative paths still resolve
     *   to the parent item, so tolerance/control fields keep working.
     * - `header` — once per document, independent of the item rows. Runs even when the
     *   item table is empty, so structural/header checks are expressible (e.g. "the item
     *   table must not be empty", or a header field like "confirmation number must start
     *   with 1001"). Header rules read header fields by their plain path and get two
     *   built-in variables describing the item table: `itemCount` (number of rows) and
     *   `hasItems` (boolean). The result belongs to the document, not a row, so it has no
     *   `itemIndex` — it drives the rule-set outcome + header banner but never renders as a
     *   table row. Aggregate grains are not supported by the engine.
     */
    runOn: 'itemTable' | 'nestedTable' | 'header';
    /**
     * For `runOn: 'nestedTable'` only — the property under each item holding the
     * nested rows to iterate. Generic by design: the config names it (e.g.
     * `"scheduleLines"`) so the engine stays object-type agnostic.
     */
    nestedArrayField?: string;
    /**
     * Optional guard expression, evaluated in the same env as the decision table
     * (context + derived). When present and falsy the evaluation is skipped (no
     * result), letting a rule step aside per item/row — e.g. an item-level rule with
     * `"scheduleLineInc != true"` defers to its schedule-line counterpart.
     */
    runWhen?: string;
    /**
     * Optional target table to run this rule against. Defaults to the primary
     * item table (options.arrayField or "items") when omitted.
     */
    targetTable?: string;
    context?: Record<string, ContextFieldV5>;
    derived?: Record<string, DerivedExpressionV5>;
    /**
     * One decision table per function: rows are scanned by ascending priority and
     * the first matching `when` wins (firstMatch). A function emits exactly one
     * resultCode — two independent decisions should be two functions, not two tables.
     */
    decisionTable?: DecisionTableV5;
    /** @deprecated Legacy array form. Only the first entry is read; kept for back-compat with stored configs. */
    decisionTables?: DecisionTableV5[];
    /** @deprecated The result mapping is now inlined on each decision row (`outcome`/`label`/`ui`). Read-only fallback for older stored configs. */
    resultMapping?: Record<string, ResultMappingV5>;
}

export interface ContextFieldV5 {
    label?: string;
    source?: 'field' | string;
    path?: string;
    dataType?: string;
    unit?: string;
}

export interface DerivedExpressionV5 {
    label?: string;
    expression: string;
}

export interface DecisionTableV5 {
    tableCode?: string;
    tableName?: string;
    rows?: DecisionRowV5[];
}

export interface DecisionRowV5 {
    priority: number;
    when?: string;
    /** If false, the rule is skipped during evaluation. Defaults to true. */
    active?: boolean;
    /**
     * Unified rule identifier. In the merged model it also serves as the result's
     * label (the engine shows the rule code wherever a label is needed unless a
     * legacy config supplies one). Replaces the legacy `resultCode` + `label`
     * pair.
     */
    ruleCode?: string;
    /** Outcome code (references an outcome code in the rule set's outcomePolicy). */
    outcome?: string;
    /** UI treatment (tag, highlighted fields, channels). */
    ui?: ResultUiV5;
    /** @deprecated Legacy alias for `ruleCode`. Read-only fallback for older configs. */
    resultCode?: string;
    /** @deprecated Legacy explicit label; the rule code now serves as the label. Read-only fallback. */
    label?: string;
}

/** UI treatment for a rule result: tag, field highlights, and contribution channels. */
export interface ResultUiV5 {
    showTag?: {
        enabled?: boolean;
        label?: string;
        bgColor?: string;
        textColor?: string;
    };
    highlightFields?: {
        enabled?: boolean;
        fields?: Array<{
            field: string;
            bgColor?: string;
            textColor?: string;
        }>;
    };
    /**
     * Field-level message shown under the field header / in the item-table "!"
     * tooltip. A dedicated block with its OWN enable toggle — independent of
     * `showTag` (the Result-column tag/identity) and of `highlightFields` (the
     * colour). `text` supports `{var}` placeholders resolved from the result's
     * context/derived values. `fields` lists the field paths the message anchors
     * to; when omitted it falls back to `highlightFields.fields[].field`, so a
     * message can be attached to a field that is NOT colour-highlighted.
     */
    message?: {
        enabled?: boolean;
        text?: string;
        fields?: string[];
    };
    channels?: {
        contributeToHeaderBanner?: boolean;
        contributeToSummaryChip?: boolean;
        /** When true, the validation message is rendered inline at the affected
         *  field — on the item row for item-level rules, near the header field
         *  for header-level rules. Defaults to true (opt-out). */
        messageAtField?: boolean;
    };
    /**
     * Dynamic field properties driven by validation rules. Each entry maps a
     * field path to a property override (`readOnly`, `mandatory`, `editable`,
     * `optional`, `hide`). The UI cell renderer reads these to adjust field
     * editability per row based on data conditions (e.g. GR-based IV flag).
     */
    fieldProperties?: Array<{
        field: string;
        property: 'hide' | 'readOnly' | 'editable' | 'mandatory' | 'optional';
    }>;
}

/**
 * @deprecated The result mapping is now inlined on each decision row
 * (`DecisionRowV5.outcome`/`label`/`ui`). Kept as a read-only fallback so older
 * stored configs with a separate `resultMapping` map still evaluate.
 */
export interface ResultMappingV5 {
    /** References an outcome code defined in the rule set's outcomePolicy. */
    outcome: string;
    label?: string;
    ui?: ResultUiV5;
}

/** Normalized, runtime-ready outcome definition (resolved with defaults + back-compat). */
export interface ResolvedOutcomeV5 {
    code: string;
    label: string;
    severity: ValidationSeverityV5;
    blocking: boolean;
    rank: number;
    chipShow: boolean;
    chipLabel: string;
    messageEnabled: boolean;
    messageText: string;
    statusChange: boolean;
    statusTarget?: string;
    blockActions: string[];
    notify: boolean;
    /** Action names to fire as notifications when this outcome wins (the configurable allow-list). */
    notifyActions: string[];
    autoProcess: boolean;
    /** Action names allowed to run automatically when autoProcess is true (the configurable ceiling). */
    autoProcessActions: string[];
}

export interface ValidationFunctionResultV5 {
    objectIndex: number;
    itemIndex?: number;
    /** For nested-table results: index of the nested row (e.g. schedule line) within its item. */
    nestedIndex?: number;
    /** For nested-table results: the nested array property name (e.g. "scheduleLines"). */
    nestedField?: string;
    ruleSetCode?: string;
    ruleSetName: string;
    functionCode: string;
    functionName: string;
    tableCode?: string;
    resultCode: string;
    outcome: ValidationOutcomeV5;
    severity: ValidationSeverityV5;
    label: string;
    canProceed: boolean;
    ui?: ResultUiV5;
    context: Record<string, unknown>;
    derived: Record<string, unknown>;
}

export interface ValidationItemResultV5 {
    objectIndex: number;
    itemIndex: number;
    targetTable: string;
    outcome: ValidationOutcomeV5;
    severity: ValidationSeverityV5;
    functionResults: ValidationFunctionResultV5[];
}

export interface ValidationRuleSetResultV5 {
    ruleSetCode?: string;
    ruleSetName: string;
    outcome: ValidationOutcomeV5;
    severity: ValidationSeverityV5;
    canProceed: boolean;
    recommendedDocumentStatus?: string;
    /** Resolved policy of the winning outcome (chip, message, status, actions, notify, autoProcess). */
    policy: ResolvedOutcomeV5;
    functionResults: ValidationFunctionResultV5[];
    itemResults: ValidationItemResultV5[];
    blocking: ValidationFunctionResultV5[];
    nonBlocking: ValidationFunctionResultV5[];
}

export interface ValidationEvaluationResultV5 {
    enabled: boolean;
    outcome: ValidationOutcomeV5;
    severity: ValidationSeverityV5;
    canProceed: boolean;
    recommendedDocumentStatus?: string;
    ruleSets: ValidationRuleSetResultV5[];
    itemResults: ValidationItemResultV5[];
    blocking: ValidationFunctionResultV5[];
    nonBlocking: ValidationFunctionResultV5[];
}

export interface EvaluateValidationOptionsV5 {
    currentStatus?: string | null;
    arrayField?: string;
}

interface CompiledRuleSetV5 {
    ruleSet: ValidationRuleSetV5;
    referenceMaps: Map<string, Map<string, Record<string, unknown>>>;
    outcomes: ResolvedOutcomeV5[];
    outcomesByCode: Map<string, ResolvedOutcomeV5>;
    baseline: ResolvedOutcomeV5;
}

interface CompiledValidationConfigV5 {
    config: ValidationConfigV5;
    ruleSets: CompiledRuleSetV5[];
}

const parser = new Parser();

/**
 * Loose (JS-`==`-style) equality for the `==` / `!=` operators.
 *
 * WHY: expr-eval's built-in `==`/`!=` are STRICT (`===`) — they never coerce. But every
 * extracted field value reaches the expression env as a STRING (extraction stores
 * `{ value: "3600.000" }`, and `buildContext` keeps it verbatim — it must, or leading-zero
 * identifiers like PO "00010" would be mangled). So a natural rule like `netAmount == 0`
 * or `taxCode == 5` compared a string against a numeric literal and was ALWAYS false, which
 * is why authors had to write the `- 0` trick (`itemCount - 0 == 0`): the subtraction forces
 * numeric coercion before the strict compare. Overriding `==`/`!=` to coerce like JS `==`
 * removes that footgun engine-wide (FE + BE share this parser).
 *
 * Semantics (mirror JS `==` for the primitive operands we ever see — string/number/bool/null):
 *   - identical value/type → equal;
 *   - null/undefined only equals null/undefined;
 *   - SAME type → strict compare (so two strings compare as strings — "00010" stays "00010",
 *     NOT 10 — preserving identifier semantics);
 *   - DIFFERENT types → numeric compare when both sides are numeric, else string compare.
 * Existing `- 0` workarounds still evaluate correctly (arithmetic → number → loose `==`).
 */
function looseEquals(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || a === undefined || b === null || b === undefined) return false;
    if (typeof a === typeof b) return a === b;
    const na = Number(a as never);
    const nb = Number(b as never);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
    return String(a) === String(b);
}
// `binaryOps` exists at runtime but isn't in expr-eval's .d.ts (only unaryOps/functions/consts).
const binaryOps = (parser as unknown as { binaryOps: Record<string, (a: unknown, b: unknown) => unknown> }).binaryOps;
binaryOps['=='] = looseEquals;
binaryOps['!='] = (a: unknown, b: unknown) => !looseEquals(a, b);

const compiledStringCache = new Map<string, CompiledValidationConfigV5>();

const severityRank: Record<ValidationSeverityV5, number> = {
    success: 0,
    warning: 1,
    error: 2,
};

const blockActionKeywords: Record<string, string[]> = {
    Submit: ['submit'],
    Approve: ['approve'],
    Post: ['post'],
};

export function parseValidationConfigV5(input: unknown): ValidationConfigV5 | null {
    if (!input) return null;

    let parsed: unknown = input;
    if (typeof input === 'string') {
        try {
            parsed = JSON.parse(input);
        } catch {
            return null;
        }
    }

    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<ValidationConfigV5>;
    if (candidate.version !== 5) return null;
    if (!Array.isArray(candidate.ruleSets)) return null;

    return candidate as ValidationConfigV5;
}

export function compileValidationConfigV5(input: ValidationConfigV5 | string): CompiledValidationConfigV5 | null {
    if (typeof input === 'string') {
        const cached = compiledStringCache.get(input);
        if (cached) return cached;

        const parsed = parseValidationConfigV5(input);
        if (!parsed) return null;

        const compiled = compileParsedConfig(parsed);
        compiledStringCache.set(input, compiled);
        return compiled;
    }

    return compileParsedConfig(input);
}

export function evaluateValidationConfigV5(
    input: ValidationConfigV5 | string | null | undefined,
    extractedData: Record<string, unknown> | null | undefined,
    options: EvaluateValidationOptionsV5 = {},
): ValidationEvaluationResultV5 {
    const compiled = input ? compileValidationConfigV5(input) : null;
    if (!compiled || !compiled.config.enabled || !extractedData) {
        return emptyEvaluation(true);
    }

    const scopedRuleSets = compiled.ruleSets.filter(({ ruleSet }) => isRuleSetInScope(ruleSet, options.currentStatus));
    if (scopedRuleSets.length === 0) return emptyEvaluation(true);

    const objects = Array.isArray((extractedData as { objectList?: unknown }).objectList)
        ? ((extractedData as { objectList: Record<string, unknown>[] }).objectList)
        : [extractedData];

    const ruleSetResults: ValidationRuleSetResultV5[] = [];

    for (const compiledRuleSet of scopedRuleSets) {
        const functionResults: ValidationFunctionResultV5[] = [];
        const itemResultBuckets = new Map<string, ValidationFunctionResultV5[]>();

        objects.forEach((objectData, objectIndex) => {
            const defaultArrayField = options.arrayField || 'items';

            for (const fn of compiledRuleSet.ruleSet.functions || []) {
                if (fn.active === false) continue;

                const targetTable = fn.targetTable || defaultArrayField;
                const items = Array.isArray((objectData as Record<string, unknown>)[targetTable])
                    ? ((objectData as Record<string, unknown>)[targetTable] as Record<string, unknown>[])
                    : [];
                const headerData = { ...objectData };
                delete (headerData as Record<string, unknown>)[targetTable];

                const collect = (fnResult: ValidationFunctionResultV5 | null, itemIndex: number) => {
                    if (!fnResult) return;
                    functionResults.push(fnResult);
                    const key = `${objectIndex}:${targetTable}:${itemIndex}`;
                    const bucket = itemResultBuckets.get(key) || [];
                    bucket.push(fnResult);
                    itemResultBuckets.set(key, bucket);
                };

                if (fn.runOn === 'nestedTable') {
                    // Iterate a named array nested under each item (e.g. schedule lines).
                    // An empty/absent array yields no iterations — i.e. the rule runs only
                    // when nested rows exist. Results carry the parent item index, so they
                    // roll up to that item's row automatically.
                    const nestedField = fn.nestedArrayField;
                    if (!nestedField) continue;
                    items.forEach((item, itemIndex) => {
                        const nestedRows = Array.isArray((item as Record<string, unknown>)[nestedField])
                            ? ((item as Record<string, unknown>)[nestedField] as Record<string, unknown>[])
                            : [];
                        nestedRows.forEach((row, nestedIndex) => {
                            collect(
                                evaluateFunctionForItem(
                                    compiledRuleSet,
                                    fn,
                                    item,
                                    headerData as Record<string, unknown>,
                                    objectIndex,
                                    itemIndex,
                                    targetTable,
                                    { row, field: nestedField, index: nestedIndex },
                                ),
                                itemIndex,
                            );
                        });
                    });
                    continue;
                }

                if (fn.runOn === 'header') {
                    // Header grain: one evaluation per object, independent of the item rows —
                    // so a structural rule (e.g. "the item table must not be empty") still fires
                    // when there are zero rows. The result has no itemIndex, so it contributes to
                    // the rule-set outcome and header banner but is NOT bucketed into an item row
                    // (no phantom row): push it straight onto functionResults, bypassing collect().
                    const headerResult = evaluateHeaderFunction(
                        compiledRuleSet,
                        fn,
                        objectData as Record<string, unknown>,
                        objectIndex,
                        targetTable,
                        items.length,
                    );
                    if (headerResult) functionResults.push(headerResult);
                    continue;
                }

                if (fn.runOn !== 'itemTable') continue;
                items.forEach((item, itemIndex) => {
                    collect(
                        evaluateFunctionForItem(
                            compiledRuleSet,
                            fn,
                            item,
                            headerData as Record<string, unknown>,
                            objectIndex,
                            itemIndex,
                            targetTable,
                        ),
                        itemIndex,
                    );
                });
            }
        });

        const rankOf = (code: ValidationOutcomeV5) => compiledRuleSet.outcomesByCode.get(code)?.rank ?? -1;

        const itemResults = Array.from(itemResultBuckets.entries()).map(([key, results]) => {
            const [objectIndex, targetTable, itemIndex] = key.split(':');
            const outcome = highestOutcomeByRank(results.map(r => r.outcome), rankOf, compiledRuleSet.baseline.code);
            return {
                objectIndex: Number(objectIndex),
                itemIndex: Number(itemIndex),
                targetTable,
                outcome,
                severity: severityOf(compiledRuleSet, outcome),
                functionResults: results,
            };
        });

        const outcome = highestOutcomeByRank(functionResults.map(r => r.outcome), rankOf, compiledRuleSet.baseline.code);
        const policy = compiledRuleSet.outcomesByCode.get(outcome) || compiledRuleSet.baseline;
        const canProceed = !policy.blocking;
        const recommendedDocumentStatus = policy.statusTarget;
        const blocking = functionResults.filter(r => isBlocking(compiledRuleSet, r.outcome));
        const nonBlocking = functionResults.filter(r => !isBlocking(compiledRuleSet, r.outcome) && severityOf(compiledRuleSet, r.outcome) !== 'success');

        ruleSetResults.push({
            ruleSetCode: compiledRuleSet.ruleSet.ruleSetCode,
            ruleSetName: compiledRuleSet.ruleSet.ruleSetName,
            outcome,
            severity: policy.severity,
            canProceed,
            recommendedDocumentStatus,
            policy,
            functionResults,
            itemResults,
            blocking,
            nonBlocking,
        });
    }

    // Across rule sets the outcome vocabularies may differ, so the document-level
    // winner is chosen by the fixed color/severity rank (success < warning < error).
    const overallSeverity = ruleSetResults.reduce<ValidationSeverityV5>((highest, r) =>
        severityRank[r.severity] > severityRank[highest] ? r.severity : highest, 'success');
    const winningRuleSet = ruleSetResults.find(r => r.severity === overallSeverity);
    const overallOutcome = winningRuleSet?.outcome || 'pass';
    const allItemResults = mergeItemResults(ruleSetResults.flatMap(r => r.itemResults));
    const blocking = ruleSetResults.flatMap(r => r.blocking);
    const nonBlocking = ruleSetResults.flatMap(r => r.nonBlocking);

    return {
        enabled: true,
        outcome: overallOutcome,
        severity: overallSeverity,
        canProceed: ruleSetResults.every(r => r.canProceed),
        recommendedDocumentStatus: winningRuleSet?.recommendedDocumentStatus,
        ruleSets: ruleSetResults,
        itemResults: allItemResults,
        blocking,
        nonBlocking,
    };
}

export function computeStatusChangeV5(
    input: ValidationConfigV5 | string | null | undefined,
    currentStatus: string | null | undefined,
    extractedData: Record<string, unknown> | null | undefined,
    options: Omit<EvaluateValidationOptionsV5, 'currentStatus'> = {},
): string | null {
    const compiled = input ? compileValidationConfigV5(input) : null;
    if (!compiled || !extractedData) return null;

    const evaluation = evaluateValidationConfigV5(input, extractedData, { ...options, currentStatus });
    const matchingRuleSet = evaluation.ruleSets.find(ruleSet => {
        if (ruleSet.outcome !== evaluation.outcome) return false;
        const sourceRuleSet = compiled.ruleSets.find(compiledSet =>
            compiledSet.ruleSet.ruleSetCode === ruleSet.ruleSetCode
            || compiledSet.ruleSet.ruleSetName === ruleSet.ruleSetName
        )?.ruleSet;
        if (!sourceRuleSet) return false;
        if (!isStatusChangeInScope(sourceRuleSet, currentStatus)) return false;
        return ruleSet.policy.statusChange && !!ruleSet.policy.statusTarget;
    });

    return matchingRuleSet?.recommendedDocumentStatus || null;
}

export function matchActionsToBlockedLabels(
    actions: Array<{ name: string; label?: string; handler?: string }> | null | undefined,
    blockActions: string[]
): Set<string> {
    const blocked = new Set<string>();
    if (!actions?.length || !blockActions?.length) return blocked;

    for (const action of actions) {
        const haystack = `${action.name} ${action.label || ''} ${action.handler || ''}`.toLowerCase();
        for (const actionLabel of blockActions) {
            const keywords = blockActionKeywords[actionLabel] || [actionLabel.toLowerCase()];
            if (keywords.some(keyword => haystack.includes(keyword))) {
                blocked.add(action.name);
                break;
            }
        }
    }
    return blocked;
}

export function getBlockedActionNamesV5(
    input: ValidationConfigV5 | string | null | undefined,
    currentStatus: string | null | undefined,
    extractedData: Record<string, unknown> | null | undefined,
    actions: Array<{ name: string; label?: string; handler?: string }> | null | undefined,
    options: Omit<EvaluateValidationOptionsV5, 'currentStatus'> = {},
): Set<string> {
    const blocked = new Set<string>();
    if (!actions?.length || !input || !extractedData) return blocked;

    const compiled = compileValidationConfigV5(input);
    if (!compiled) return blocked;

    const evaluation = evaluateValidationConfigV5(input, extractedData, { ...options, currentStatus });
    for (const ruleSetResult of evaluation.ruleSets) {
        const blockActions = ruleSetResult.policy.blockActions;
        const matched = matchActionsToBlockedLabels(actions, blockActions);
        for (const name of matched) {
            blocked.add(name);
        }
    }

    return blocked;
}

/**
 * Normalized outcome list for a rule set, resolving the new `outcomePolicy`,
 * falling back to legacy actionsPolicy/documentStatus, then to the canonical
 * pass/warning/error defaults. Exported so the frontend can render chips and
 * banners from the same source of truth as the engine.
 */
export function getRuleSetOutcomesV5(ruleSet: ValidationRuleSetV5 | null | undefined): ResolvedOutcomeV5[] {
    if (!ruleSet) return [];
    return compileOutcomes(ruleSet);
}

function compileParsedConfig(config: ValidationConfigV5): CompiledValidationConfigV5 {
    return {
        config,
        ruleSets: (config.ruleSets || []).map(ruleSet => {
            const outcomes = compileOutcomes(ruleSet);
            const outcomesByCode = new Map(outcomes.map(o => [o.code, o]));
            const baseline = outcomes.find(o => o.severity === 'success') || outcomes[0];
            return {
                ruleSet,
                referenceMaps: compileReferenceMaps(ruleSet.referenceData),
                outcomes,
                outcomesByCode,
                baseline,
            };
        }),
    };
}

const DEFAULT_OUTCOME_RAWS: OutcomeDefV5[] = [
    { code: 'pass', label: 'Passed', severity: 'success', blocking: false },
    { code: 'warning', label: 'Warning', severity: 'warning', blocking: false },
    { code: 'error', label: 'Error', severity: 'error', blocking: true },
];

function compileOutcomes(ruleSet: ValidationRuleSetV5): ResolvedOutcomeV5[] {
    const raws = ruleSet.outcomePolicy?.outcomes?.length
        ? ruleSet.outcomePolicy.outcomes
        : synthesizeLegacyOutcomes(ruleSet);
    return raws.map((raw, index) => normalizeOutcome(raw, index));
}

/** Build outcome defs from legacy actionsPolicy/documentStatus (or canonical defaults). */
function synthesizeLegacyOutcomes(ruleSet: ValidationRuleSetV5): OutcomeDefV5[] {
    const hasLegacy = !!ruleSet.documentStatus || !!ruleSet.actionsPolicy;
    if (!hasLegacy) return DEFAULT_OUTCOME_RAWS;

    return ['pass', 'warning', 'error'].map((code) => {
        const ds = ruleSet.documentStatus?.[code];
        const ap = ruleSet.actionsPolicy?.[code];
        const severity: ValidationSeverityV5 = code === 'pass' ? 'success' : code === 'warning' ? 'warning' : 'error';
        return {
            code,
            label: capitalize(code),
            severity,
            blocking: ap?.canProceed === false || code === 'error',
            chip: { show: true, label: ds?.chipLabel || capitalize(code) },
            message: { enabled: ds?.headerMessage?.enabled ?? false, text: ds?.headerMessage?.text || '' },
            status: { change: ds?.changeStatus ?? false, target: ds?.targetStatus },
            actions: { block: ap?.blockActions?.enabled ? (ap.blockActions.actions || []) : [] },
            notification: { enabled: ds?.notification ?? false },
            autoProcessing: { enabled: ds?.autoProcessing ?? false },
        };
    });
}

function normalizeOutcome(raw: OutcomeDefV5, index: number): ResolvedOutcomeV5 {
    const severity = normalizeSeverity(raw.severity, raw.code);
    return {
        code: raw.code,
        label: raw.label || capitalize(raw.code),
        severity,
        blocking: raw.blocking ?? severity === 'error',
        rank: index,
        chipShow: raw.chip?.show ?? true,
        chipLabel: raw.chip?.label || raw.label || capitalize(raw.code),
        messageEnabled: raw.message?.enabled ?? false,
        messageText: raw.message?.text || '',
        statusChange: raw.status?.change ?? false,
        statusTarget: raw.status?.target,
        blockActions: raw.actions?.block || [],
        notify: raw.notification?.enabled ?? false,
        notifyActions: raw.notification?.actions || [],
        autoProcess: raw.autoProcessing?.enabled ?? false,
        autoProcessActions: raw.autoProcessing?.actions || [],
    };
}

function normalizeSeverity(severity: OutcomeDefV5['severity'], code: string): ValidationSeverityV5 {
    if (severity === 'success' || severity === 'warning' || severity === 'error') return severity;
    if (severity === 'destructive') return 'error';
    if (severity === 'info') return 'warning';
    const lower = (code || '').toLowerCase();
    if (lower.includes('pass') || lower.includes('success') || lower.includes('ok')) return 'success';
    if (lower.includes('error') || lower.includes('reject') || lower.includes('critical') || lower.includes('fail')) return 'error';
    return 'warning';
}

function capitalize(value: string): string {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function severityOf(compiledRuleSet: CompiledRuleSetV5, code: ValidationOutcomeV5): ValidationSeverityV5 {
    return compiledRuleSet.outcomesByCode.get(code)?.severity || 'success';
}

function isBlocking(compiledRuleSet: CompiledRuleSetV5, code: ValidationOutcomeV5): boolean {
    return !!compiledRuleSet.outcomesByCode.get(code)?.blocking;
}

function compileReferenceMaps(referenceData?: Record<string, ReferenceDataConfigV5>): Map<string, Map<string, Record<string, unknown>>> {
    const maps = new Map<string, Map<string, Record<string, unknown>>>();
    if (!referenceData) return maps;

    for (const [referenceName, referenceConfig] of Object.entries(referenceData)) {
        const activeSourceName = referenceConfig.activeSource || 'embedded';
        const source = referenceConfig.sources?.[activeSourceName];
        if (!source || source.source !== 'embedded') continue;

        const keyField = source.keyField || referenceConfig.keyField;
        if (!keyField || !Array.isArray(source.rows)) continue;

        const rowMap = new Map<string, Record<string, unknown>>();
        for (const row of source.rows) {
            const key = row[keyField];
            if (key === undefined || key === null) continue;
            rowMap.set(String(key), normalizeReferenceRow(row));
        }

        maps.set(referenceName, rowMap);
        if (referenceConfig.referenceCode) maps.set(referenceConfig.referenceCode, rowMap);
    }

    return maps;
}

function normalizeReferenceRow(row: Record<string, unknown>): Record<string, unknown> {
    const normalized = { ...row };
    for (const field of ['tol2EarlyDays', 'tol2LateDays']) {
        const value = toNumber(normalized[field]);
        if (value !== null && Math.abs(value) >= 999) {
            normalized[field] = Number.POSITIVE_INFINITY;
        }
    }
    return normalized;
}

interface NestedRowContext {
    /** The nested row being evaluated (e.g. one schedule line). */
    row: Record<string, unknown>;
    /** The nested array property name on the item (e.g. "scheduleLines"). */
    field: string;
    /** The nested row's index within its item. */
    index: number;
}

function evaluateFunctionForItem(
    compiledRuleSet: CompiledRuleSetV5,
    fn: ValidationFunctionV5,
    item: Record<string, unknown>,
    headerData: Record<string, unknown>,
    objectIndex: number,
    itemIndex: number,
    arrayField: string,
    nested?: NestedRowContext,
): ValidationFunctionResultV5 | null {
    const context = buildContext(fn.context, item, headerData, arrayField, nested);
    const helpers = buildExpressionHelpers(compiledRuleSet.referenceMaps);
    const derived = evaluateDerived(fn.derived, context, helpers);
    const env = { ...context, ...derived };

    // Optional guard: when present and falsy, the rule produces no result for this
    // item/row (e.g. an item-level rule deferring to its schedule-line counterpart).
    if (fn.runWhen && !evaluateExpression(fn.runWhen, env, helpers)) return null;

    const decision = evaluateDecisionTable(resolveDecisionTable(fn), env, helpers);
    if (!decision) return null;

    // The matched row is self-contained; build the result with this row's identity
    // (item + optional nested-row indices). `buildFunctionResult` resolves the rule
    // code, outcome, and label (with legacy fallbacks) shared with the header grain.
    return buildFunctionResult(compiledRuleSet, fn, decision, {
        objectIndex,
        itemIndex,
        nestedIndex: nested?.index,
        nestedField: nested?.field,
    }, context, derived);
}

/**
 * Evaluate a `header`-grain function once for a document, independent of the item rows.
 * The item-relative env is the header data itself, plus two built-ins describing the item
 * table — `itemCount` (row count) and `hasItems` (boolean) — so structural rules like
 * "the item table must not be empty" are expressible without iterating rows. The returned
 * result carries no `itemIndex`/`nestedIndex`: it belongs to the document, so it drives the
 * rule-set outcome and header banner but never renders as a table row.
 */
function evaluateHeaderFunction(
    compiledRuleSet: CompiledRuleSetV5,
    fn: ValidationFunctionV5,
    headerData: Record<string, unknown>,
    objectIndex: number,
    arrayField: string,
    itemCount: number,
): ValidationFunctionResultV5 | null {
    // Header rules have no "item": resolve their context paths against the header data,
    // then expose the item-table built-ins. Built-ins are merged first so an explicit
    // context field could still override them if a config ever needed to.
    const context: Record<string, unknown> = {
        itemCount,
        hasItems: itemCount > 0,
        ...buildContext(fn.context, headerData, headerData, arrayField),
    };
    const helpers = buildExpressionHelpers(compiledRuleSet.referenceMaps);
    const derived = evaluateDerived(fn.derived, context, helpers);
    const env = { ...context, ...derived };

    if (fn.runWhen && !evaluateExpression(fn.runWhen, env, helpers)) return null;

    const decision = evaluateDecisionTable(resolveDecisionTable(fn), env, helpers);
    if (!decision) return null;

    // No itemIndex/nestedIndex — a header result is document-level (see jsdoc above).
    return buildFunctionResult(compiledRuleSet, fn, decision, { objectIndex }, context, derived);
}

/** Identity carried by a function result; item/nested grains set the row indices, header leaves them unset. */
interface FunctionResultIdentityV5 {
    objectIndex: number;
    itemIndex?: number;
    nestedIndex?: number;
    nestedField?: string;
}

/**
 * Build a `ValidationFunctionResultV5` from a matched decision row: resolve the unified
 * `ruleCode` (with legacy `resultCode`/`label`/`resultMapping` fallbacks) and its outcome.
 * Shared by the item, nested, and header grains so they emit identical result shapes.
 */
function buildFunctionResult(
    compiledRuleSet: CompiledRuleSetV5,
    fn: ValidationFunctionV5,
    decision: { tableCode?: string; row: DecisionRowV5 },
    identity: FunctionResultIdentityV5,
    context: Record<string, unknown>,
    derived: Record<string, unknown>,
): ValidationFunctionResultV5 {
    const { row } = decision;
    const ruleCode = row.ruleCode || row.resultCode || '';
    const legacyMapping = fn.resultMapping?.[ruleCode];
    const outcomeCode = row.outcome || legacyMapping?.outcome || compiledRuleSet.baseline.code;
    const outcomeDef = compiledRuleSet.outcomesByCode.get(outcomeCode) || compiledRuleSet.baseline;

    return {
        objectIndex: identity.objectIndex,
        itemIndex: identity.itemIndex,
        nestedIndex: identity.nestedIndex,
        nestedField: identity.nestedField,
        ruleSetCode: compiledRuleSet.ruleSet.ruleSetCode,
        ruleSetName: compiledRuleSet.ruleSet.ruleSetName,
        functionCode: fn.functionCode,
        functionName: fn.functionName,
        tableCode: decision.tableCode,
        resultCode: ruleCode,
        outcome: outcomeDef.code,
        severity: outcomeDef.severity,
        label: row.label || legacyMapping?.label || ruleCode,
        canProceed: !outcomeDef.blocking,
        ui: row.ui || legacyMapping?.ui,
        context,
        derived,
    };
}

function buildContext(
    contextConfig: ValidationFunctionV5['context'] = {},
    item: Record<string, unknown>,
    headerData: Record<string, unknown>,
    arrayField: string,
    nested?: NestedRowContext,
): Record<string, unknown> {
    const context: Record<string, unknown> = {};

    for (const [name, field] of Object.entries(contextConfig)) {
        const path = field.path || name;
        // Coerce unresolved paths to null (not undefined): the expression evaluator
        // treats a present-but-undefined variable as an error (so the whole expression
        // collapses to null), whereas null flows through comparisons and the helpers
        // (coalesce/daysBetween/lookup) cleanly. Matters for nested rules whose lines
        // may omit a field (e.g. a supplier-generated split with no per-line qty/date).
        context[name] = resolvePath(path, item, headerData, arrayField, nested) ?? null;
    }

    return context;
}

function evaluateDerived(
    derivedConfig: ValidationFunctionV5['derived'] = {},
    context: Record<string, unknown>,
    helpers: Record<string, unknown>,
): Record<string, unknown> {
    const derived: Record<string, unknown> = {};

    for (const [name, expressionConfig] of Object.entries(derivedConfig)) {
        derived[name] = evaluateExpression(expressionConfig.expression, { ...context, ...derived }, helpers);
    }

    return derived;
}

/**
 * Resolve the function's single decision table, tolerating the legacy array form
 * (`decisionTables[]`) by reading its first entry.
 */
function resolveDecisionTable(fn: ValidationFunctionV5): DecisionTableV5 | undefined {
    return fn.decisionTable ?? fn.decisionTables?.[0];
}

function evaluateDecisionTable(
    table: DecisionTableV5 | undefined,
    env: Record<string, unknown>,
    helpers: Record<string, unknown>,
): { tableCode?: string; row: DecisionRowV5 } | null {
    if (!table) return null;
    const rows = [...(table.rows || [])].sort((a, b) => a.priority - b.priority);
    for (const row of rows) {
        if (row.active === false) continue;
        if (!row.when || Boolean(evaluateExpression(row.when, env, helpers))) {
            return { tableCode: table.tableCode, row };
        }
    }

    return null;
}

// Parsed expressions are cached by their source string. Parsing (tokenize + build
// AST) is the dominant per-evaluation cost, and an expression is pure: the same
// string always yields the same AST, which is then evaluated with different
// variables each call (expr-eval is parse-once / evaluate-many by design). The
// expression vocabulary is bounded by the config, so this cache is effectively
// fixed-size — it makes per-item/per-line evaluation cheap even when the same rules
// run across many items and schedule lines.
const parsedExpressionCache = new Map<string, ReturnType<typeof parser.parse>>();

function evaluateExpression(expression: string, env: Record<string, unknown>, helpers: Record<string, unknown>): unknown {
    try {
        let parsed = parsedExpressionCache.get(expression);
        if (!parsed) {
            parsed = parser.parse(normalizeExpression(expression));
            parsedExpressionCache.set(expression, parsed);
        }
        const variables: Record<string, unknown> = {
            ...helpers,
            null: null,
            true: true,
            false: false,
            Infinity: Number.POSITIVE_INFINITY,
            ...env,
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return parsed.evaluate(variables as any);
    } catch {
        return null;
    }
}

function normalizeExpression(expression: string): string {
    return expression
        .replace(/&&/g, ' and ')
        .replace(/\|\|/g, ' or ')
        .replace(/!==/g, '!=')
        .replace(/===/g, '==');
}

/** Documentation entry for a helper function available in expressions. */
export interface ExpressionFunctionDoc {
    /** Function name — MUST match a key returned by `buildExpressionHelpers`. */
    name: string;
    signature: string;
    description: string;
    example: string;
}

export interface ExpressionOperatorDoc {
    symbol: string;
    description: string;
}

/**
 * Single source of truth for the derived-expression language shown to admins in
 * the editor's "Syntax & functions" help. The `functions` list is kept in lockstep
 * with `buildExpressionHelpers` by a drift test (see test/validation-v5); the
 * operators mirror `normalizeExpression` + the expr-eval operators, and constants
 * mirror the values injected in `evaluateExpression`.
 */
export const EXPRESSION_LANGUAGE: {
    functions: ExpressionFunctionDoc[];
    operators: ExpressionOperatorDoc[];
    constants: string[];
} = {
    functions: [
        { name: 'lookup', signature: "lookup('refSet', key)", description: 'Find a row in a Reference Data set by its key; returns the row — read a column with .column.', example: "lookup('confirmationControlProfiles', confirmationControlKey).tol2EarlyDays" },
        { name: 'coalesce', signature: 'coalesce(a, b, …)', description: 'First value that is not null, undefined, or empty.', example: 'coalesce(confirmedPrice, netPriceAmount, 0)' },
        { name: 'daysBetween', signature: 'daysBetween(d1, d2)', description: 'Whole days from d2 to d1 (d1 − d2); negative when d1 is earlier.', example: 'daysBetween(confirmedDate, requestedDate)' },
        { name: 'dateDiffDays', signature: 'dateDiffDays(d1, d2)', description: 'Same as daysBetween.', example: 'dateDiffDays(confirmedDate, requestedDate)' },
        { name: 'dateAddDays', signature: 'dateAddDays(date, n)', description: 'Date shifted by n days, returned as YYYY-MM-DD.', example: 'dateAddDays(requestedDate, 5)' },
        { name: 'abs', signature: 'abs(x)', description: 'Absolute value.', example: 'abs(deltaDays)' },
        { name: 'min', signature: 'min(a, b, …)', description: 'Smallest of the values.', example: 'min(confirmedQty, orderQty)' },
        { name: 'max', signature: 'max(a, b, …)', description: 'Largest of the values.', example: 'max(confirmedQty, orderQty)' },
        { name: 'round', signature: 'round(x)', description: 'Round to the nearest integer.', example: 'round(orderQty * 1.05)' },
        { name: 'startsWith', signature: 'startsWith(text, prefix)', description: 'True when text begins with prefix (both coerced to string; false if either is null).', example: "startsWith(confirmationNumber, '1001')" },
        { name: 'endsWith', signature: 'endsWith(text, suffix)', description: 'True when text ends with suffix (both coerced to string; false if either is null).', example: "endsWith(documentNumber, 'Z')" },
        { name: 'contains', signature: 'contains(text, search)', description: 'True when text contains search (both coerced to string; false if either is null).', example: "contains(reference, 'PO-')" },
    ],
    operators: [
        { symbol: '+  -  *  /  %', description: 'Arithmetic (% = remainder)' },
        { symbol: '==  !=  <  <=  >  >=', description: 'Comparison. == / != coerce numbers vs numeric text (e.g. amount == 0 works even when the field is text "0"); two text values compare as text.' },
        { symbol: '&&   ||   not', description: 'Logical and / or / not' },
        { symbol: 'a ? b : c', description: 'Conditional — if a then b else c. Nestable for switch-case: a ? x : b ? y : z' },
        { symbol: '(  )', description: 'Grouping' },
    ],
    constants: ['null', 'true', 'false', 'Infinity'],
};

export function buildExpressionHelpers(referenceMaps: Map<string, Map<string, Record<string, unknown>>>): Record<string, unknown> {
    return {
        coalesce: (...values: unknown[]) => values.find(value => value !== null && value !== undefined && value !== ''),
        lookup: (referenceName: unknown, key: unknown) => {
            if (referenceName === null || referenceName === undefined || key === null || key === undefined) return null;
            const map = referenceMaps.get(String(referenceName));
            return map?.get(String(key)) || null;
        },
        lookupRange: (referenceName: unknown, value: unknown, fromField: unknown, toField: unknown) => {
            if (referenceName === null || referenceName === undefined || value === null || value === undefined) return null;
            const map = referenceMaps.get(String(referenceName));
            if (!map) return null;
            
            const cleanNum = (val: unknown): number | null => {
                if (val === null || val === undefined || val === '') return null;
                if (typeof val === 'number') return val;
                const cleaned = String(val).replace(/,/g, '.');
                const num = Number(cleaned);
                return Number.isNaN(num) ? null : num;
            };

            const numValue = cleanNum(value);
            if (numValue === null) return null;

            for (const row of map.values()) {
                const fromVal = cleanNum(row[String(fromField)]);
                const toVal = cleanNum(row[String(toField)]);
                
                const minVal = fromVal !== null ? fromVal : Number.NEGATIVE_INFINITY;
                const maxVal = toVal !== null ? toVal : Number.POSITIVE_INFINITY;

                if (numValue >= minVal && numValue <= maxVal) {
                    return row;
                }
            }
            return null;
        },
        daysBetween: (left: unknown, right: unknown) => daysBetween(left, right),
        dateDiffDays: (left: unknown, right: unknown) => daysBetween(left, right),
        dateAddDays: (date: unknown, days: unknown) => dateAddDays(date, days),
        abs: Math.abs,
        min: Math.min,
        max: Math.max,
        round: Math.round,
        // String predicates for header-field checks (e.g. confirmation-number prefixes).
        // Null-safe: a null/undefined operand yields false rather than throwing.
        startsWith: (text: unknown, prefix: unknown) =>
            text == null || prefix == null ? false : String(text).startsWith(String(prefix)),
        endsWith: (text: unknown, suffix: unknown) =>
            text == null || suffix == null ? false : String(text).endsWith(String(suffix)),
        contains: (text: unknown, search: unknown) =>
            text == null || search == null ? false : String(text).includes(String(search)),
    };
}

function resolvePath(
    path: string,
    item: Record<string, unknown>,
    headerData: Record<string, unknown>,
    arrayField: string,
    nested?: NestedRowContext,
): unknown {
    // Nested-row scope: "<arrayField>.<nestedField>." reads from the nested row.
    // Checked first because it is more specific than the bare item prefix below.
    if (nested) {
        const nestedPrefix = `${arrayField}.${nested.field}.`;
        if (path.startsWith(nestedPrefix)) {
            return unwrapValue(getByPath(nested.row, path.slice(nestedPrefix.length)));
        }
    }

    const itemPrefix = `${arrayField}.`;
    if (path.startsWith(itemPrefix)) {
        return unwrapValue(getByPath(item, path.slice(itemPrefix.length)));
    }

    const itemValue = getByPath(item, path);
    if (itemValue !== undefined) return unwrapValue(itemValue);
    return unwrapValue(getByPath(headerData, path));
}

function getByPath(source: unknown, path: string): unknown {
    if (!source || typeof source !== 'object' || !path) return undefined;
    
    // Normalize array bracket notation to dot notation: "items[0].field" -> "items.0.field"
    const normalizedPath = path.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '');
    
    return normalizedPath.split('.').reduce<unknown>((current, part) => {
        if (!current || typeof current !== 'object') return undefined;
        return (current as Record<string, unknown>)[part];
    }, source);
}

function unwrapValue(value: unknown): unknown {
    if (value && typeof value === 'object' && 'value' in value) {
        return (value as { value: unknown }).value;
    }
    return value;
}

function daysBetween(left: unknown, right: unknown): number | null {
    const leftDate = toUtcDate(left);
    const rightDate = toUtcDate(right);
    if (leftDate === null || rightDate === null) return null;
    return Math.round((leftDate - rightDate) / 86400000);
}

function dateAddDays(date: unknown, days: unknown): string | null {
    const start = toUtcDate(date);
    const offset = toNumber(days);
    if (start === null || offset === null) return null;
    const result = new Date(start + offset * 86400000);
    return result.toISOString().slice(0, 10);
}

function toUtcDate(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const text = String(value);
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (dateOnly) {
        return Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    }
    const parsed = new Date(text).getTime();
    return Number.isNaN(parsed) ? null : parsed;
}

function toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return value;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
}

function isRuleSetInScope(ruleSet: ValidationRuleSetV5, currentStatus: string | null | undefined): boolean {
    if (ruleSet.active === false) return false;
    if (currentStatus == null) return true;
    const scope = ruleSet.validationRunScope;
    return !scope || scope.length === 0 || scope.includes(currentStatus);
}

function isStatusChangeInScope(ruleSet: ValidationRuleSetV5, currentStatus: string | null | undefined): boolean {
    if (!currentStatus) return false;
    const scope = ruleSet.statusChangeScope;
    return !!scope && scope.includes(currentStatus);
}

function highestOutcomeByRank(
    outcomes: Array<ValidationOutcomeV5 | undefined>,
    rankOf: (code: ValidationOutcomeV5) => number,
    baselineCode: ValidationOutcomeV5,
): ValidationOutcomeV5 {
    let bestCode = baselineCode;
    let bestRank = rankOf(baselineCode);
    for (const next of outcomes) {
        if (!next) continue;
        const rank = rankOf(next);
        if (rank > bestRank) {
            bestRank = rank;
            bestCode = next;
        }
    }
    return bestCode;
}

function mergeItemResults(itemResults: ValidationItemResultV5[]): ValidationItemResultV5[] {
    const buckets = new Map<string, { results: ValidationFunctionResultV5[]; severity: ValidationSeverityV5 }>();
    for (const itemResult of itemResults) {
        const targetTable = itemResult.targetTable || 'items';
        const key = `${itemResult.objectIndex}:${targetTable}:${itemResult.itemIndex}`;
        const bucket = buckets.get(key) || { results: [], severity: 'success' as ValidationSeverityV5 };
        bucket.results.push(...itemResult.functionResults);
        if (severityRank[itemResult.severity] > severityRank[bucket.severity]) bucket.severity = itemResult.severity;
        buckets.set(key, bucket);
    }

    return Array.from(buckets.entries()).map(([key, bucket]) => {
        // key format: objectIndex:targetTable:itemIndex
        const firstColon = key.indexOf(':');
        const lastColon = key.lastIndexOf(':');
        const objectIndex = Number(key.substring(0, firstColon));
        const targetTable = key.substring(firstColon + 1, lastColon);
        const itemIndex = Number(key.substring(lastColon + 1));
        
        // Cross-rule-set rows roll up by color/severity rank; the winning function
        // result's outcome code is preserved for display.
        const winner = bucket.results.reduce<ValidationFunctionResultV5 | undefined>((best, r) =>
            !best || severityRank[r.severity] > severityRank[best.severity] ? r : best, undefined);
        return {
            objectIndex,
            targetTable,
            itemIndex,
            outcome: winner?.outcome || 'pass',
            severity: bucket.severity,
            functionResults: bucket.results,
        };
    });
}

function emptyEvaluation(enabled: boolean): ValidationEvaluationResultV5 {
    return {
        enabled,
        outcome: 'pass',
        severity: 'success',
        canProceed: true,
        ruleSets: [],
        itemResults: [],
        blocking: [],
        nonBlocking: [],
    };
}
