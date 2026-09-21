# D1-D4 Step Prompt Configuration

AI Settings provides configurable editor screens for D1, D2, D3, and D4 through `/ai-settings/step-prompts/:stepCode`. D5-D8 remain read-only/planned.

The editor route is outside the standard application `MainLayout`, matching the `ref/ai-agent-extraction` Schema Editor shell: it has its own header, Back/Save actions, sticky tab navigation, and full-width editing canvas.

## Configuration areas

- Data schema: selects the current team, calculated team size, and precedent team inputs supplied to D1.
- Prompt guide: stores the combined D1 agent guidance and enforces an 80-line limit.
- Form mapping: describes the leader, skill-mix rationale, and team-source output controls.
- Constraints: requires team names to be grounded in `team.*` or `precedents#N` and lowers `dataBacked` when no team evidence exists.

Data Schema, Form Editor, and Constraints each provide Visual and JSON modes. Prompt Guide is a single direct prompt configuration editor and does not show a redundant mode switch. Saving validates JSON-backed tabs in both the browser and CAP service.

The visual editors follow the `ref/ai-agent-extraction` Schema Editor patterns:

- Data Schema uses real JSON Schema (`type`, `properties`, and `required`), a field list/detail composition copied from the reference builder, and Monaco for JSON source editing. Legacy flat `fields[]` data is normalized when loaded.
- Form Editor uses the reference three-panel layout: unassigned fields, grouped sortable drag-and-drop canvas, and field/group configuration. Pointer and keyboard sensors support assignment, cross-group moves, and reordering; Review Layout opens a width-aware preview.
- Constraints owns its Form/JSON toolbar like the reference validation screen. Form mode provides a rule list/detail editor; JSON mode uses Monaco and keeps the valid shared draft synchronized.
- The editor tab strip follows the reference navigation treatment, including the active underline, compact spacing, horizontal overflow, and a full-height content region below the standalone header.
- The page uses the reference `h-screen`/`overflow-hidden` shell so Monaco and the visual panels receive a defined height. Unsaved state is shown in the header rather than a floating card that can overlap editors.
- Form layout behavior includes the reference unassigned drop target, pointer-first collision detection, drag-over highlighting, group width/column/order controls, field column and row spans, visibility, spacers, and keyboard/pointer drag sensors.
- Form fields now follow the extraction-app contract: the field key is the AI output path. There is no separate output-field creation or binding control. Legacy `binding` values are normalized into field keys, and the configured paths are included in the D1 AI prompt as its form output contract.
- Raw JSON changes and visual changes share the same draft state, so switching modes remains synchronized.

## Runtime behavior

At analysis time the D1 input schema controls the additional D1 input block sent to the model. The combined prompt replaces the legacy D1 guide, configured constraints are appended to the system prompt, and post-processing applies the D1 grounding rules.

Each editor restores only its own row through `prompt:D1`, `prompt:D2`, `prompt:D3`, or `prompt:D4`. Other steps are not deleted, reseeded, enabled, disabled, or updated.

## Runtime configuration flow

- Before this feature, the AI always used code-defined discipline guides, the full fixed case context, and the fixed `EightDResult` response schema.
- The fixed response envelope and safety rules remain unchanged. This prevents an admin layout edit from breaking the report contract.
- The Prompt Guide now overrides the selected discipline's default writing instructions.
- Data Schema selects which verified context sections are repeated in the step-specific configured-input block sent to the model.
- Form Editor defines the valid output paths and presentation layout for that discipline. Field keys are implicit paths on the discipline object; no second binding is configured.
- Constraints are appended to the system prompt and supported deterministic rules are rechecked in post-processing. Invalid sources are removed and missing disclosures are reported through the repair audit.
- Disabled or blank configuration falls back to the original code defaults, so existing analysis remains operational.
- Existing database rows may predate the JSON columns. Blank JSON values are treated as unconfigured rather than invalid JSON, preventing `Unexpected end of JSON input`; restarting the CAP server backfills D1-D4 defaults.
- Local backend scripts invoke the local TSX CAP runner; plain `cds serve` does not load this repository's `srv/server.ts`, so custom handlers and startup backfill would otherwise be skipped.
# Flexible D1-D4 Runtime Flow

The D1-D4 editors now define the runtime contract used by analysis and report rendering.

- Data Schema declares the discipline output data contract. Its property names are dotted paths inside the discipline `data` result object.
- Form Editor uses exactly the same paths and types, adding only widget and layout presentation. There is no separate output binding.
- Saving rejects duplicate paths, unknown group fields, unsupported data types, unsupported rule types, and invalid severities.
- AI Core receives a lightweight stable response envelope to avoid Gemini serving-state limits. The complete dynamic Data Schema is enforced by backend validation and repair. D5-D8 continue to use the legacy fixed contract.
- Each generated discipline stores `resultJson`, `formSchemaJson`, `validationJson`, and `configVersion`; historical reports therefore retain their original layout.
- Report Detail uses the saved schema snapshot when present and falls back to the legacy discipline card for old reports.

Supported validation includes required values, string length, numeric range, enum membership, citation requirements, source patterns, required disclosures, and data-backed input conditions. Error violations trigger one focused AI repair attempt; warnings remain visible in the saved validation snapshot.

Administrators can call `previewStepConfiguration(stepCode, payload)` on `AiAdminService` to inspect the effective input, Data Schema, lightweight serving schema, Form Schema, rules, and config version without exposing AI credentials.

Saving rejects a configuration when Data Schema and Form Editor do not contain the same field paths or declare different types. Inputs used to populate those outputs continue to come from the complete verified CaseContext, enrichment, independent diagnosis, and precedents.

## Structured D1-D4 Defaults

The default configurations no longer render one large narrative field:

- D1 first states whether selection uses the current case team, precedent recommendations, a hybrid, or unassigned roles. It then shows required capabilities and an explainable roster with organizational role, assigned 8D role, case responsibility, selection reason, source type, source path, and precedent case where applicable. Readiness status is kept separate from its rationale, and the source summary explains how current-case and precedent data contributed.
- D2 produces a problem statement, separate 5W2H facts, Is/Is-Not boundaries, measurement rows, gaps, and traceability.
- D3 produces an owned containment-action table, protected scope, recommendation basis, gaps, and traceability.
- D4 produces a root-cause conclusion, 5-Why table, contributing factors, independent-verification fields, evidence gaps, and traceability.

Group width, 12-column layout, field spans, and collapse state are honored by Report Detail. Runtime errors and warnings appear both in the discipline validation header and next to the affected field. Evidence paths are translated into readable labels and resolved values while retaining the technical path for audit use.

On startup, the application upgrades only the original narrative-only D1-D4 defaults. Structured administrator-authored schemas are preserved.
