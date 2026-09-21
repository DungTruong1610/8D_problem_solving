# Update Workflow — Refresh Existing `CLAUDE.md`

Used when `CLAUDE.md` already exists. The goal is to update skill-managed
sections (response envelope, error flow, verification pipeline) to match the
latest template, while **preserving every word** the user has written into
their project-specific sections (placement rules, pitfalls, project notes).

**Non-negotiable:** never overwrite existing content without an explicit,
per-section user approval.

---

## Section Classification

Each H2 section in an existing `CLAUDE.md` belongs to one of three classes:

### Skill-managed — safe to refresh

| H2 heading (exact)                      | Reason                    |
|-----------------------------------------|---------------------------|
| `## Response Envelope`                  | Tied to ApiResponse contract |
| `## Error Flow` / `## Error Handling`   | AppError hierarchy canonical |
| `## Post-Task Verification`             | Steps evolve as tools evolve |
| `## Verification Pipeline`              | Alias of above               |

When refreshing, replace the body but keep the heading text as-is.

### User-filled — preserve verbatim

| H2 heading (exact or prefix-match)      | Why preserve               |
|-----------------------------------------|----------------------------|
| `## Placement Rules`                    | Project architectural choices |
| `## Common Pitfalls`                    | Hard-earned knowledge         |
| `## Project Notes` / `## Notes`         | Free-form user content        |
| `## External Services`                  | Often hand-edited after scan  |
| `## Stack Overview`                     | May include project-specific rationale |
| Any H2 containing the project name      | Custom section                |

### New — propose to add

Any H2 in the latest template that doesn't appear in the existing file.
These are offered as additions, not forced.

---

## Parsing Strategy

1. Split the existing `CLAUDE.md` by lines starting with `## ` (exactly two hashes + space)
2. Each chunk = one section with:
   - `heading` (the `## ...` line)
   - `body` (everything until the next `## ` or EOF)
3. Preserve everything before the first H2 (title, stack summary) as "preamble"
4. Do the same parse on the latest template
5. Build a diff map:

```
existing sections: { "Response Envelope": "...", "Placement Rules": "...", "Common Pitfalls": "..." }
template sections: { "Response Envelope": "...", "Error Flow": "...", "Placement Rules": "...", "Post-Task Verification": "..." }

diff:
- REFRESH: Response Envelope (skill-managed, body differs)
- KEEP:    Placement Rules (user-filled, always kept verbatim)
- MISSING from existing: Error Flow, Post-Task Verification → propose ADD
- MISSING from template: Common Pitfalls → KEEP in existing (likely user section)
```

---

## Step-by-Step

### Step 1 — Parse Both Files

Parse existing `CLAUDE.md` + the chosen template (+ mixins) into section maps.

### Step 2 — Build the Change List

For every section in the template:

| Existing? | Class            | Action         |
|-----------|------------------|----------------|
| Yes       | skill-managed    | REFRESH        |
| Yes       | user-filled      | KEEP           |
| No        | skill-managed    | ADD (proposed) |
| No        | user-filled      | ADD (proposed) |

For every section in existing but NOT in template:

| Class         | Action |
|---------------|--------|
| user-filled   | KEEP   |
| skill-managed | FLAG (heading may be stale — ask user before removing) |
| unknown       | KEEP (default to preserve) |

### Step 3 — Detect Stack Drift

Re-run `scripts/detect-stack.js`. Compare detected stack to the stack
mentioned in the existing preamble / `## Stack Overview`.

- **Match** → no drift, proceed.
- **Drift** (e.g., existing says Mongoose, detector says Prisma) → report to
  user and ask whether to refresh the Stack section too. Default: keep
  existing, surface the mismatch.

### Step 4 — Present the Change List

Via `AskUserQuestion`, show a summary:

```
Detected 3 skill-managed sections needing refresh:
  [1] ## Response Envelope          (body changed — 12 lines diff)
  [2] ## Error Flow                 (missing — propose to ADD after Response Envelope)
  [3] ## Post-Task Verification     (body changed — 8 lines diff)

Preserved (no changes proposed):
  ## Placement Rules                (user section)
  ## Common Pitfalls                (user section)
  ## Project Notes                  (user section)

Options:
- Approve all changes
- Review each change individually
- Show me the full diff
- Cancel
```

If the user picks "individually", iterate through each REFRESH/ADD with its
own AskUserQuestion: approve, skip, or edit.

### Step 5 — Apply Approved Changes

Assemble the new file:

1. Keep the original preamble
2. For each section in the TEMPLATE ORDER:
   - If REFRESH approved → use new body
   - If ADD approved → insert new section
   - If KEEP or REFRESH rejected → use existing body (if present)
3. Append any user-only sections (not in template) that weren't removed,
   preserving their original order relative to each other
4. Write the result to `CLAUDE.md` via the Write tool

### Step 6 — Verify & Report

1. `ls -la CLAUDE.md` → confirm write succeeded, show new modification time
2. Report what changed:
   ```
   ✅ Updated /Users/leo/projects/foo/CLAUDE.md

   Refreshed:
     - ## Response Envelope
     - ## Post-Task Verification

   Added:
     - ## Error Flow

   Preserved (untouched):
     - ## Placement Rules
     - ## Common Pitfalls
     - ## Project Notes

   📋 TODOs still pending:
     - Line 95: <TODO: document the Billing module>
   ```

---

## Preservation Rules (Non-Negotiable)

1. **Never delete a user-filled section** without explicit approval
2. **Never merge two user sections** even if headings are similar
3. **Never reorder existing sections** unless the user approves
4. **Never fix typos** inside user-filled sections
5. **Never "improve" prose** the user wrote — treat user content as read-only
6. When in doubt, classify as user-filled (default to preserve)

---

## Diff Presentation

When showing a per-section diff, use this format for readability:

```diff
## Response Envelope

- All controllers return ApiResponse<T> or throw AppError.
+ All controllers return ApiResponse<T> via satisfies narrowing,
+ or throw a typed AppError subclass.
+
+ The response shape is:
+   { success: boolean, message: string, data?: T, error?: { code, message } }
```

Show up to 40 lines per diff by default; offer "show full diff" if more.

---

## Edge Cases

| Scenario                                      | Handling                                 |
|-----------------------------------------------|------------------------------------------|
| Existing file has no H2 headings at all       | Treat whole body as user-filled, offer fresh generation as alternative |
| Existing file is empty (0 bytes)              | Redirect to Generation Workflow          |
| Existing file has conflicting H2 duplicates   | Merge identical ones with a warning; ask user before touching |
| File has frontmatter (`---` block)            | Preserve frontmatter untouched           |
| File references a stack we no longer support  | Keep references as-is, warn user         |
| User approves-all but a section fails to parse | Skip that section, report the failure   |

---

## Safety Net

Before writing the updated file:

1. Write a backup to `<project_root>/.CLAUDE.md.bak` (overwriting any prior backup)
2. Write the new content to `<project_root>/CLAUDE.md`
3. Mention the backup path in the final report

The backup is single-level only — subsequent runs overwrite it. That's a
deliberate tradeoff to avoid clutter; users who want versioned history should
commit `CLAUDE.md` to git.
