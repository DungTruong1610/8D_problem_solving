# 8D Copilot — Internal Verification Runbook for AI4Biz

**Competition:** AI4Biz 2026 · **Organizer:** LIKELION Vietnam · **Team:** UIT_4Lovpe<br>
**Competition reference:** [Official AI4Biz challenge](https://app.notion.com/p/likelion/AI-FOR-BUSINESS-INNOVATION-3f744860a4f480ab920ddb3911a25c21)

## Purpose and limits

The existing `verify:sprint1` command is an internal regression harness retained from an earlier development stage. AI4Biz does not require a 90-second harness or award the old 12/8-point scores. Legacy competition labels may still appear in the application or console until those assets are updated separately.

The harness exercises dataset validation, case mapping, precedent lookup and stop rules. It does **not** call LLM drafting and cannot establish end-to-end AI latency, root-cause accuracy, business ROI or official competition points.

## Run the checks

From the repository root, with the environment prepared using [RUNNING-LOCAL.md](../RUNNING-LOCAL.md):

```bash
npm run verify:sprint1
npm run verify:sprint1 -- --json
npm run verify:sprint1 -- --judge-input path/to/case.json
```

Read the actual result of the run. Record the date, commit, database mode, input case and expected/actual outcome. A prior PASS or a sample console transcript is not evidence that the current version passes.

## Coverage

| Scenario | What to inspect |
|---|---|
| Happy path | Valid input maps successfully and retrieves the expected qualifying precedent |
| Dirty data | Normalization is visible; uncertain facts require confirmation |
| Conflicting evidence | Contradictions trigger the appropriate review/stop |
| No qualifying precedent | The application does not cite an unsupported precedent and escalates appropriately |
| Additional input | Malformed payloads receive a useful validation error; valid cases follow the same code path |

Exact inputs and expected outcomes live in the test fixtures. This documentation update does not modify the fixtures. Retrieval thresholds depend on the selected profile; do not translate profile points into an unsupported universal similarity percentage.

## Demonstrate the product separately

Open the User & Judge Guide at `/#/guide` on the configured frontend URL. Existing UI labels such as “Sprint 1” and “Run 90s Verify Suite” refer to the internal harness. If the backend is unavailable, report the error and retry after recovery; do not substitute recorded PASS rows.

For the AI4Biz demo, additionally run actual drafting and inspect the retrieved source, proposed explanation, stop conditions, human decision and audit record. Clearly label seeded data. Rehearse an English demo video of at most 2 minutes; the full final pitch is at most 15 minutes, followed by 5 minutes of Q&A, with at least 3 presenting members.

## Evidence to retain

- Harness output for the exact code version being demonstrated.
- Separate AI drafting observations with provider/model, configuration, latency and failures.
- Human review notes: missing evidence, corrections and whether the proposed next step is usable.
- Business measurements with the same task, input and acceptance criteria on both sides of a comparison.

No test result is generated or asserted by this documentation migration. Use the [AI4Biz rubric](https://app.notion.com/p/likelion/AI-FOR-BUSINESS-INNOVATION-3f744860a4f480ab920ddb3911a25c21) for competition preparation.
