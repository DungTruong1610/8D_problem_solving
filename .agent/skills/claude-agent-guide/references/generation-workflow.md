# Generation Workflow — Fresh `CLAUDE.md` Scaffold

Used when `CLAUDE.md` does NOT exist at the project root. Produces a new file
that is specific to the detected stack, pre-filled from codebase evidence.

---

## Precondition

- `scripts/detect-stack.js` has already run and produced a JSON decision
- `recommendedTemplate` + `mixins` are known
- The project root is known (passed in or `process.cwd()`)

If the stack detection returned `stack: "ambiguous"`, DO NOT proceed here —
ask the user to pick via `AskUserQuestion` first.

---

## Step 1 — Load Primary Template

Read `templates/<recommendedTemplate>` from the skill directory. Keep the
markdown as a string; preserve all H2 anchors since the update workflow
keys off them.

## Step 2 — Apply Mixins (if any)

For each mixin in `mixins[]`:

1. Read the mixin template file
2. Extract the allowlisted H2 sections (see Detection Rules § Mixin merging)
3. Insert each extracted section into the primary template:
   - If a section with the same H2 already exists in primary → **replace it**
   - Else → insert before the `## Verification` section (or at the end)

Never duplicate headings. After merging, every H2 should be unique.

## Step 3 — Fill Placeholders from the Codebase

The templates contain `<PLACEHOLDER>` markers and `<TODO>` markers.

- `<PLACEHOLDER>` = scanner should attempt to fill automatically
- `<TODO>` = needs human input; leave as-is

### Placeholder fill table

| Placeholder                  | How to fill                                              |
|------------------------------|----------------------------------------------------------|
| `<PROJECT_NAME>`             | `package.json.name`, else folder basename                |
| `<NODE_VERSION>`             | `package.json.engines.node`, else `>=20`                 |
| `<FRAMEWORK>`                | from detector (`nest`/`express`/etc.)                    |
| `<ORM>`                      | from detector                                            |
| `<VALIDATION_LIB>`           | from detector                                            |
| `<AUTH_STRATEGY>`            | from detector                                            |
| `<ESM_OR_CJS>`               | from detector                                            |
| `<ENTRY_FILE>`               | `package.json.main` or scan for `src/index.ts`, `src/main.ts`, `server.ts`, `srv/server.js` |
| `<FOLDER_LAYOUT>`            | `ls -la` project root, keep top-level dirs only          |
| `<DB_DRIVER_HINT>`           | `mongoose` → MongoDB; `prisma` → read `schema.prisma` `datasource db.provider`; `typeorm` → check `ormconfig`/module config |
| `<EXTERNAL_SERVICES>`        | Scan `.env.example` keys (see service hints below)       |
| `<CURRENT_DATE>`             | Today's date in `YYYY-MM-DD`                             |

### `.env.example` → External service hints

| Key pattern                       | Service inferred   |
|-----------------------------------|--------------------|
| `STRIPE_*`                        | Stripe payments    |
| `SENDGRID_*` / `POSTMARK_*` / `SMTP_*` | Email          |
| `GEMINI_API_KEY` / `GOOGLE_AI_*`  | Google Gemini      |
| `OPENAI_API_KEY`                  | OpenAI             |
| `ANTHROPIC_API_KEY`               | Anthropic Claude   |
| `AWS_*` / `S3_*`                  | AWS / S3 storage   |
| `CLOUDINARY_*`                    | Cloudinary         |
| `REDIS_URL`                       | Redis              |
| `MONGO_URI` / `MONGODB_URI`       | MongoDB            |
| `DATABASE_URL` + Prisma            | Inferred from `schema.prisma` datasource |
| `TWILIO_*`                        | Twilio SMS/voice   |
| `FIREBASE_*`                      | Firebase           |

Never invent a service. If `.env.example` is missing or empty, leave
`<EXTERNAL_SERVICES>` as `<TODO>`.

### Folder layout extraction

Run `ls -la` (or equivalent) on project root. Keep entries that are directories
and NOT in this blocklist: `node_modules`, `.git`, `dist`, `build`, `.next`,
`coverage`, `.vscode`, `.idea`, `.cache`.

Render them as a compact tree (one level deep) into `<FOLDER_LAYOUT>`.

## Step 4 — Inject the 3 Mandatory Skill-Managed Sections

Every generated `CLAUDE.md` MUST include these sections verbatim (from the
template — no placeholders here):

1. **Response envelope** — `ApiResponse<T>` / `ActionResponse` contract
2. **Error flow** — typed AppError hierarchy + handler mapping
3. **Post-task verification pipeline** — the numbered verification steps for the detected stack

These are the sections that the Update Workflow will refresh — so they must
start with the exact H2 heading specified in each template so the parser can
find them.

## Step 5 — Assemble & Preview

Build the final markdown string in this order:

1. Front-matter / title (from template)
2. Stack section (with filled placeholders)
3. Folder layout section
4. Response envelope
5. Error flow
6. Placement rules (template defaults, user will refine)
7. Common pitfalls (template defaults + detected-stack specific)
8. External services
9. Post-task verification pipeline
10. References to companion skills

Present the output to the user via `AskUserQuestion`:

```
Preview generated for <PROJECT_NAME> (stack: <FRAMEWORK> + <ORM>).

Options:
- Approve & write CLAUDE.md
- Edit before writing (paste your changes inline)
- Show me only the placeholder summary
- Cancel
```

## Step 6 — Write to Disk

On approval:

1. Target path = `<project_root>/CLAUDE.md`
2. Use the Write tool (NOT `echo >` via bash)
3. Confirm with `ls -la <path>`

## Step 7 — Post-Write Report

Report back to the user:

- ✅ File written to `<path>`
- 📋 List every `<TODO>` marker still in the file (line number + context)
- 🔌 Companion skills referenced (suggest install if not present):
  - `solid-backend-nodejs` (generic/nest/prisma)
  - `cnma-cap-backend` (cap)
  - `node-verify-import` (all)

Example report:

```
✅ Wrote /Users/leo/projects/foo/CLAUDE.md

📋 TODOs needing your input:
  - Line 42: <TODO: document the Analytics module placement>
  - Line 87: <TODO: list custom domain errors beyond AppError>
  - Line 112: <TODO: external services — .env.example was empty>

🔌 Referenced skills:
  - solid-backend-nodejs — already installed ✓
  - node-verify-import — not detected, run: cp -r ... ~/.claude/skills/
```

---

## Error Handling

| Failure                            | Recovery                                    |
|------------------------------------|---------------------------------------------|
| Template file missing              | Abort, report which file + expected path    |
| `package.json` unreadable          | Abort — no project context to work from     |
| `detect-stack.js` exits non-zero   | Surface stderr, retry with `--verbose`      |
| User rejects preview               | Keep the draft in memory; do not write      |
| Write permission denied on root    | Report path + suggest running from terminal |

Never silently write `CLAUDE.md`. The user must approve the final content.
