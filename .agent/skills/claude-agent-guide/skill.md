---
name: claude-agent-guide
description: |
  Generates or updates the `CLAUDE.md` file in a project root so Claude (Code
  / Cowork) has accurate, stack-appropriate context the moment the project is
  opened. Auto-detects the project stack (generic Express/Fastify + Mongoose,
  NestJS, Prisma ORM, SAP CAP / Conarum standard) by scanning `package.json`,
  `tsconfig.json`, `schema.prisma`, `*.cds` files, and folder layout — then
  picks the right template variant and fills project-specific placeholders from
  the codebase. If `CLAUDE.md` already exists, runs a diff-based update that
  preserves user-filled sections (pitfalls, placement rules, stack notes) while
  refreshing skill-managed sections (response envelope, error flow, post-task
  verification pipeline).

  ALWAYS trigger when the user asks to:
  - Vietnamese: tạo CLAUDE.md, sinh CLAUDE.md, init CLAUDE.md, bootstrap project
    context, tạo guide cho Claude, setup CLAUDE.md, update CLAUDE.md, refresh
    CLAUDE.md, sinh agent guide, làm CLAUDE cho project, dự án chưa có CLAUDE.md
  - English: init CLAUDE.md, create CLAUDE.md, generate CLAUDE.md, scaffold
    project context, bootstrap agent guide, update CLAUDE.md, refresh CLAUDE.md,
    regenerate project context, my project has no CLAUDE.md, improve CLAUDE.md
  - Trigger proactively when: user opens a Node.js/TypeScript project without a
    `CLAUDE.md` at root and starts a backend task, or the existing `CLAUDE.md`
    references an outdated skill name / old folder structure.

  Supports 4 variants out of the box: generic Express/Fastify + Mongoose,
  NestJS, Prisma, SAP CAP (Conarum standard). Mix stacks handled by merging
  sections across templates (e.g., Nest + Prisma).
metadata:
  version: 1.0.0
  author: Leo
  pairs_with: solid-backend-nodejs, cnma-cap-backend, node-verify-import
---

# Skill: claude-agent-guide

Generates or updates `CLAUDE.md` — the project-level context file that Claude
reads automatically on session start. One well-written `CLAUDE.md` saves the
user from typing stack + conventions + verification rules every session.

---

## Step 1 — Detect Language

Match the user:
- Vietnamese → reply in Vietnamese ("Anh/chị")
- English → reply in English
- Default → match the invoking prompt

---

## Step 2 — Check if `CLAUDE.md` Already Exists

Look at the project root (the current working directory, or whatever the user
points at). Common locations:

- `<root>/CLAUDE.md` — most common
- `<root>/server/CLAUDE.md` — backend subfolder
- `<root>/srv/CLAUDE.md` — CAP projects

Branch:

- **Exists** → `references/update-workflow.md` (preserve user-filled content, refresh skill-managed sections)
- **Does NOT exist** → `references/generation-workflow.md` (fresh scaffold)

---

## Step 3 — Detect Stack

Run the bundled detector:

```bash
node <skill_dir>/scripts/detect-stack.js [--dir <project_root>]
```

Defaults to `process.cwd()`. Outputs JSON like:

```json
{
  "stack": "node-ts-esm",
  "framework": "nest",
  "orm": "prisma",
  "validation": "class-validator",
  "auth": "passport-jwt",
  "recommendedTemplate": "CLAUDE.nest.md",
  "mixins": ["CLAUDE.prisma.md"],
  "detectedSignals": [
    "package.json: @nestjs/core@10.x",
    "package.json: @prisma/client@5.x",
    "schema.prisma present at prisma/schema.prisma",
    "tsconfig.json: module=NodeNext"
  ]
}
```

If auto-detection is ambiguous (e.g., both Mongoose + Prisma present), fall
back to `AskUserQuestion` with the detected options.

See `references/detection-rules.md` for the full decision tree.

---

## Step 4 — Pick Template Variant

| Detected | Primary template | Optional mixin |
|---|---|---|
| Express/Fastify + Mongoose | `templates/CLAUDE.generic.md` | — |
| NestJS (any ORM) | `templates/CLAUDE.nest.md` | ORM mixin if applicable |
| Any framework + Prisma | `templates/CLAUDE.prisma.md` | framework mixin if applicable |
| NestJS + Prisma | `templates/CLAUDE.nest.md` | `templates/CLAUDE.prisma.md` (merge Prisma-specific sections) |
| SAP CAP (`@sap/cds`) | `templates/CLAUDE.cap.md` | — |

**Mixin strategy**: start from primary template. For the mixin, graft these
sections from Prisma template into the Nest primary: *Generated types*,
*Transactions*, *Prisma error code mapping*, *`prisma generate` step in
verification*. Don't duplicate — each section appears once.

---

## Step 5 — Generate or Update

### 5a. Generation (CLAUDE.md does not exist)

Follow `references/generation-workflow.md`:

1. Read the chosen template file from `templates/`
2. Scan the codebase to fill placeholders — see the Scanning Rules table below
3. Present the filled CLAUDE.md to the user via AskUserQuestion for review
4. On approval, write `CLAUDE.md` to the project root
5. Remind user about any `<TODO>` markers still needing their input

### 5b. Update (CLAUDE.md exists)

Follow `references/update-workflow.md`:

1. Parse the existing `CLAUDE.md` into sections (by H2 headings)
2. Classify each section:
   - **Skill-managed** (response envelope, error flow, post-task verification) → replace with latest template version
   - **User-filled** (placement rules, common pitfalls, project notes) → preserve verbatim
   - **New** (sections in template but not in existing) → propose to add
3. Show a diff via AskUserQuestion: approve per section, or approve-all
4. Apply approved changes; write back

---

## Scanning Rules (fill placeholders from codebase)

| Placeholder | Source |
|---|---|
| Stack: Runtime | `package.json.engines.node` or `tsconfig.json` `target` |
| Stack: Framework | `package.json.dependencies` (express, fastify, @nestjs/core, @sap/cds) |
| Stack: ORM | `package.json.dependencies` (mongoose, @prisma/client, typeorm) |
| Stack: Validation | `package.json.dependencies` (zod, joi, class-validator) |
| Stack: Auth | `package.json.dependencies` (jsonwebtoken, @nestjs/passport, @sap/xssec) |
| Stack: ESM vs CJS | `tsconfig.json.compilerOptions.module` (NodeNext/ESNext → ESM) |
| Folder layout | `ls` project root — respect existing structure even if non-standard |
| External services | `.env.example` keys hints (STRIPE_KEY → Stripe, SENDGRID_API_KEY → email...) |
| Project name | `package.json.name` or folder basename |

Never invent facts — if a placeholder can't be filled from evidence, leave it
as `<TODO>` and remind the user.

---

## Step 6 — Post-Generation Check

After writing `CLAUDE.md`:

1. Confirm the file was written to the expected path
2. Verify it parses as valid markdown (no unclosed code blocks, all H2 headings resolve)
3. Point out every `<TODO>` marker remaining and ask the user to fill

---

## Step 7 — Ask About Companion Skills

If the generated `CLAUDE.md` references skills that might not be installed,
ask the user whether to install them too. Common companions:

- `solid-backend-nodejs` — for generic/nest/prisma CLAUDE.md
- `cnma-cap-backend` — for CAP CLAUDE.md
- `node-verify-import` — referenced in verification pipeline by all variants

Don't install automatically — just inform and let the user decide.

---

## References Directory

- `references/detection-rules.md` — exact decision tree + package.json signals
- `references/generation-workflow.md` — step-by-step for fresh scaffold
- `references/update-workflow.md` — diff + preservation strategy

## Templates Directory

Bundled copies of the 4 CLAUDE variants (authored by Leo):

- `templates/CLAUDE.generic.md` — default Express/Fastify + Mongoose
- `templates/CLAUDE.nest.md` — NestJS
- `templates/CLAUDE.prisma.md` — Prisma ORM
- `templates/CLAUDE.cap.md` — SAP CAP (Conarum standard)

## Scripts Directory

- `scripts/detect-stack.js` — stack detection, pure Node.js built-ins, no `npm install`

---

## Non-Negotiables

- **Never overwrite an existing `CLAUDE.md` without diff-based user approval**
- **Never invent project-specific facts**. If no evidence → `<TODO>` marker.
- **Always offer the user the diff/preview** before writing
- **Always report `<TODO>` markers** still needing input after generation
