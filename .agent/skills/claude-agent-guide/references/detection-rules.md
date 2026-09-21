# Stack Detection Rules

The `scripts/detect-stack.js` script applies these rules in order and emits a
single JSON object describing the project stack. This document is the spec it
implements — keep them in sync.

---

## Signal Sources (in priority order)

1. `package.json` — `dependencies`, `devDependencies`, `engines.node`, `type`
2. `tsconfig.json` — `compilerOptions.module`, `target`, `moduleResolution`
3. `prisma/schema.prisma` — presence of file
4. `**/*.cds` files — presence of CDS model files (excluding `node_modules`)
5. `mta.yaml` — SAP MTA deployment descriptor
6. `.cdsrc.json` — SAP CAP configuration
7. `nest-cli.json` — NestJS CLI configuration
8. `.env.example` — hints about external services

Folder layout (`src/`, `srv/`, `db/`, `app/`) is used only to disambiguate when
package.json signals are inconclusive.

---

## Framework Detection

Check `package.json.dependencies` (also walk `devDependencies` as fallback):

| Dependency key                  | Framework           |
|---------------------------------|---------------------|
| `@nestjs/core`                  | `nest`              |
| `@sap/cds`                      | `cap`               |
| `fastify`                       | `fastify`           |
| `express`                       | `express`           |
| `koa`                           | `koa`               |
| `hapi` / `@hapi/hapi`           | `hapi`              |
| (none of the above)             | `unknown`           |

**Tie-breakers:**

- If both `@nestjs/core` and `@sap/cds` present → `cap` wins (CAP project using
  Nest adapter is rare and CAP conventions dominate).
- If both `express` and `fastify` present → `fastify` wins (it's rarely added
  as a transitive dep; explicit install wins).
- If `@nestjs/platform-express` present but `@nestjs/core` missing → treat as
  `nest` (unusual but safe).

---

## ORM Detection

Check dependencies AND file presence:

| Signal                              | ORM          |
|-------------------------------------|--------------|
| `@prisma/client` + `prisma/schema.prisma` | `prisma`  |
| `@prisma/client` only                | `prisma` (warn: schema missing) |
| `mongoose`                           | `mongoose`   |
| `typeorm` + `@nestjs/typeorm`        | `typeorm`    |
| `typeorm` only                       | `typeorm`    |
| `sequelize`                          | `sequelize`  |
| `drizzle-orm`                        | `drizzle`    |
| `@sap/cds` (implicit — uses CDS model) | `cds`      |
| (none)                               | `none`       |

**Mixed ORM case:** if `@prisma/client` AND `mongoose` both present → emit
`ambiguous` with both candidates in `detectedSignals` and let the skill
fall back to AskUserQuestion.

---

## Validation Library

| Dependency                 | Validation       |
|----------------------------|------------------|
| `zod`                      | `zod`            |
| `class-validator`          | `class-validator`|
| `joi`                      | `joi`            |
| `yup`                      | `yup`            |
| `valibot`                  | `valibot`        |
| (none)                     | `none`           |

NestJS projects default to `class-validator` even if not listed — the
framework pulls it transitively via `@nestjs/common` in some setups. If no
validation lib is detected on a Nest project, mark as `class-validator?`.

---

## Auth Strategy

| Dependency                   | Auth                 |
|------------------------------|----------------------|
| `jsonwebtoken`               | `jwt`                |
| `@nestjs/passport` + `passport-jwt` | `passport-jwt` |
| `@nestjs/jwt`                | `nestjs-jwt`         |
| `@sap/xssec` / `@sap/approuter` | `xsuaa`          |
| `@clerk/clerk-sdk-node`      | `clerk`              |
| `next-auth`                  | `next-auth`          |
| (none)                       | `none`               |

---

## Module System

Read `tsconfig.json.compilerOptions.module` (case-insensitive):

| `module` value     | Module system |
|--------------------|---------------|
| `NodeNext`         | `esm`         |
| `ESNext` / `ES2022`/ `ES2020` | `esm` |
| `CommonJS`         | `cjs`         |
| (missing)          | fallback to `package.json.type` (`module` → `esm`, else `cjs`) |

---

## Runtime

1. `package.json.engines.node` (e.g. `">=20"`) → `node@20+`
2. If missing, check `tsconfig.json.compilerOptions.target` (e.g. `ES2022` → Node 18+)
3. Else default to `node@20`

---

## Template Selection Matrix

Input: `(framework, orm)` → Output: `recommendedTemplate`, `mixins`

| Framework    | ORM        | recommendedTemplate    | mixins                     |
|--------------|------------|------------------------|----------------------------|
| `express`    | `mongoose` | `CLAUDE.generic.md`    | —                          |
| `express`    | `prisma`   | `CLAUDE.prisma.md`     | —                          |
| `express`    | `none`     | `CLAUDE.generic.md`    | —                          |
| `fastify`    | `mongoose` | `CLAUDE.generic.md`    | —                          |
| `fastify`    | `prisma`   | `CLAUDE.prisma.md`     | —                          |
| `nest`       | `prisma`   | `CLAUDE.nest.md`       | `CLAUDE.prisma.md`         |
| `nest`       | `typeorm`  | `CLAUDE.nest.md`       | —                          |
| `nest`       | `mongoose` | `CLAUDE.nest.md`       | —                          |
| `nest`       | `none`     | `CLAUDE.nest.md`       | —                          |
| `cap`        | `cds`      | `CLAUDE.cap.md`        | —                          |
| `unknown`    | any        | `CLAUDE.generic.md`    | — (warn user to confirm)   |

**Mixin merging (Nest + Prisma):** keep the Nest primary structure. From the
Prisma template, graft only these sections (by H2 heading):

- `## Generated Types` (no `models/` folder — Prisma generates them)
- `## Transactions` (use `tx` parameter, not `this.prisma`)
- `## Prisma Error Code Mapping` (P2002, P2025, P2003 → AppError subclasses)
- `## Verification — Prisma extras` (add `prisma validate`, `prisma generate`)

Each section appears once in the output — dedupe by H2 text.

---

## Ambiguity Handling

If any of the following happen, set `stack: "ambiguous"` and include a
`candidates` array in the JSON output:

- Multiple ORMs detected (e.g., Mongoose + Prisma)
- Multiple frameworks detected (e.g., Express + Fastify both explicit)
- No framework detected but `package.json` exists

Example ambiguous output:

```json
{
  "stack": "ambiguous",
  "candidates": [
    { "framework": "nest", "orm": "prisma", "template": "CLAUDE.nest.md" },
    { "framework": "nest", "orm": "mongoose", "template": "CLAUDE.nest.md" }
  ],
  "detectedSignals": [
    "package.json: @prisma/client@5.11 present",
    "package.json: mongoose@8.2 present",
    "Both ORMs detected — choose one"
  ]
}
```

The calling skill turns `candidates` into `AskUserQuestion` options.

---

## Output JSON Schema

```json
{
  "stack": "node-ts-esm | node-ts-cjs | node-js | ambiguous",
  "framework": "nest | express | fastify | koa | cap | unknown",
  "orm": "prisma | mongoose | typeorm | sequelize | drizzle | cds | none | ambiguous",
  "validation": "zod | class-validator | joi | yup | valibot | none",
  "auth": "jwt | passport-jwt | nestjs-jwt | xsuaa | clerk | next-auth | none",
  "runtime": "node@18 | node@20 | node@22",
  "recommendedTemplate": "CLAUDE.generic.md | CLAUDE.nest.md | CLAUDE.prisma.md | CLAUDE.cap.md",
  "mixins": ["CLAUDE.prisma.md"],
  "projectName": "string — from package.json.name or folder basename",
  "detectedSignals": ["human-readable evidence string", "..."],
  "candidates": [ /* only present when stack is 'ambiguous' */ ]
}
```

`detectedSignals` is the most important field for debugging — always include
every signal that contributed to the decision.

---

## Confidence Rules

- **High confidence** (proceed silently): primary framework + one ORM detected
  from explicit `dependencies`.
- **Medium confidence** (proceed with warning in `detectedSignals`): framework
  from `devDependencies` only, or ORM inferred from folder layout.
- **Low confidence** (trigger AskUserQuestion): no framework detected, or
  multiple primary candidates.
