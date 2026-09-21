---
name: solid-backend-nodejs
description: |
  Architectural skill for building SOLID-compliant Node.js backend services with
  TypeScript, Express, and Mongoose. Auto-scaffolds a full layered stack
  (Model → Repository → Mapper → Service → Validator → Controller → Route) with
  interface-first design, constructor-based Dependency Injection, a single
  composition root, custom typed Error classes, and a unified ApiResponse<T>
  envelope. Enforces post-task import verification and a SOLID checklist before
  any completion claim.

  ALWAYS trigger when the user asks to:
  - Vietnamese: tạo API mới, làm backend, tạo module mới, tạo controller/service/repository,
    viết route, thêm endpoint, refactor backend, áp dụng SOLID, DI, dependency injection,
    tách layer, kiến trúc backend, xây backend Node, Express, Mongoose, scaffold module,
    interface-first, composition root, tuân thủ backend_developer_agent
  - English: scaffold backend module, create API endpoint, new controller/service/repository,
    design backend architecture, apply SOLID, refactor to layered architecture, dependency
    injection setup, composition root, interface-first design, Express route handler,
    Mongoose repository, backend developer agent
  - Trigger proactively when: editing files under routes/, controllers/, services/,
    repositories/, mappers/, validators/, composition/, or interfaces/ in a Node.js
    project; when the project is the Trading Journal backend; when writing Express
    middleware, Zod/Joi validators, or DTO mappers.

  Stack assumed: Node.js · TypeScript (ESM) · Express · Mongoose (MongoDB). Copy-ready
  TypeScript templates live in templates/. Folder layout, SOLID verification checklist,
  and full hard-rules reference live in references/. Real-world Open/Closed example
  (storage Strategy pattern) lives in examples/.
metadata:
  version: 1.0.0
  author: Leo
  tech_stack: Node.js, TypeScript, Express, Mongoose
---

# Skill: solid-backend-nodejs

Uncompromising SOLID architecture for Node.js backend. Every file this skill
generates follows the same rules so the codebase stays predictable, testable,
and easy to refactor. No business logic in routes. No Mongoose in controllers.
No God interfaces. No hard-coded dependencies.

> **Tuyên ngôn**: Code đẹp không phải code ngắn. Code đẹp là code mà khi đọc,
> mỗi file chỉ làm 1 việc, mỗi function có tên tự giải thích, và khi cần thay
> đổi, bạn chỉ sửa đúng 1 chỗ.

---

## Step 1 — Detect Language & Project Context

**Language:** Match the user. Vietnamese → reply in Vietnamese ("Anh/chị"). English → reply in English.

**Project probe (run in parallel before scaffolding):**
- `package.json` exists? Check for `express`, `mongoose`, `typescript`.
- `tsconfig.json` exists? Note `module` (ESM vs CommonJS — affects `.js` vs no-ext imports).
- `server/src/` or `src/` layout already present?
- `composition/container.ts` exists? If yes, we extend; if no, we bootstrap.

If the project is fresh, scaffold the full layout from `references/folder-structure.md`.

---

## Step 2 — The 5 SOLID Principles (quick reference)

**S — Single Responsibility**: Each layer owns exactly one concern.
Route = routing. Controller = orchestration. Service = business logic. Repository = data access. Mapper = DTO transform. Middleware = cross-cutting. Validator = input checks.

**O — Open/Closed**: Extend by adding new classes (Strategy, Factory, Plugin), never by modifying existing ones. See `examples/storage-strategy-pattern.md`.

**L — Liskov Substitution**: Any class implementing an interface must be swappable without breaking callers. No narrowed return types. No new thrown errors not in the contract.

**I — Interface Segregation**: Split fat interfaces into focused ones (e.g., `ITradeReadService` + `ITradeWriteService` + `ITradeImageService`).

**D — Dependency Inversion**: High-level modules depend on interfaces. Concrete instantiation happens only in `composition/container.ts`.

---

## Step 3 — Hard Rules (summary)

Full list with rationale in `references/hard-rules.md`. Never negotiate these.

**❌ NEVER**: business logic in routes · `req`/`res` in services · Mongoose in controllers · functions > 50 lines · hard-coded `new Concrete()` outside container · `any` as return type · input mutation · try/catch scattered across routes · duplicated code · concrete imports in high-level modules.

**✅ ALWAYS**: one file = one responsibility · interface before implementation · constructor DI · validate at boundary · DTO via Mapper between layers · pure functions where possible · typed `AppError` subclasses · `ApiResponse<T>` envelope · JSDoc on interfaces · verbs for methods, nouns for classes.

---

## Step 4 — Workflow for a New Feature

**4.1 — Analyze**
- Which module(s) are affected?
- Which layers change?
- Does an existing interface already cover the contract?

**4.2 — Design the interface FIRST**
- Write `interfaces/<module>.interfaces.ts` before any implementation.
- Specify input types, output types, and exact error cases.

**4.3 — Implement bottom-up, in this order:**

| # | Layer | Template |
|---|---|---|
| 1 | Model (if new schema) | write a Mongoose schema + interface |
| 2 | Repository | `templates/repository.template.ts` |
| 3 | Mapper | `templates/mapper.template.ts` |
| 4 | Service | `templates/service.template.ts` |
| 5 | Validator | `templates/validator.template.ts` |
| 6 | Controller | `templates/controller.template.ts` |
| 7 | Route | `templates/route.template.ts` |
| 8 | Container wire-up | `templates/composition-container.template.ts` |

Before copying templates, `grep` the project for existing naming conventions
(plural routes? singular services? `.js` extension in imports?). Match them
exactly — consistency matters more than preference.

**4.4 — Run SOLID checklist** (step 5)

**4.5 — Run post-task verification** (step 6) — mandatory.

---

## Step 5 — SOLID Checklist (MANDATORY before completion)

Walk through `references/solid-checklist.md`. Each item must be **verifiable**,
not assumed. If any ✅ can't be defended with a concrete reason, fix the code.

---

## Step 6 — Post-Task Verification (NON-NEGOTIABLE)

After ANY file creation, rename, move, or refactor — before claiming the task
done, ALWAYS run these three checks:

**1. Import verification** — invoke the `node-verify-import` skill. Zero broken
   imports. This catches `.js` vs `.ts` extension mistakes, wrong relative paths,
   and stale requires after renames.

**2. Type check** — run `npx tsc --noEmit` (server folder). Zero type errors.

**3. SOLID checklist** — re-confirm step 5.

Skipping verification is a contract violation. Runtime "Cannot find module"
errors after a refactor cost 10× more than the 30-second verification step.

---

## Step 7 — Infrastructure Provided by Templates

Everything the templates assume you have. If any are missing, scaffold them first.

| Provided | Purpose |
|---|---|
| `asyncHandler` | Wraps async routes so errors forward to `errorHandler` |
| `AppError` base class | Typed, HTTP-status-aware errors |
| `NotFoundError`, `ValidationError`, `UnauthorizedError` | Common subclasses |
| Global `errorHandler` middleware | Unified `{ success: false, error, details? }` response |
| `ApiResponse<T>` type | Success envelope: `{ success: true, data: T }` |
| `composition/container.ts` | Single place where concrete classes are instantiated |

---

## Step 8 — What Lives in References

- `references/folder-structure.md` — Target project layout with every folder annotated
- `references/solid-checklist.md` — Per-principle verification steps with examples
- `references/hard-rules.md` — Full NEVER/ALWAYS rules with rationale and counter-examples

## What Lives in Examples

- `examples/storage-strategy-pattern.md` — End-to-end OCP demonstration: adding S3 support without touching any service code

---

## Forbidden Shortcuts

- Do NOT skip the interface step "to save time". The interface IS the design.
- Do NOT put logic in a route "because it's small". It grows.
- Do NOT use `any` "temporarily". Temporary becomes permanent.
- Do NOT `new Concrete()` outside `container.ts`. DI is the whole point.
- Do NOT claim "done" without running the three post-task checks (step 6).
