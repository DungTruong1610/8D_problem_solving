# Hard Rules — Full Reference

These rules are non-negotiable. Every one has been learned through painful
refactors. Violating one "just this once" is how a codebase rots.

---

## ❌ NEVER

### 1. Never put business logic in a route file

A route file exists to map HTTP verbs + paths to controller methods. If it
contains `if`, `Date.now()`, math, or any `await` that isn't
`asyncHandler(controller.method)`, move it out.

### 2. Never touch `req` or `res` inside the service layer

Services must be callable from anywhere: HTTP, a cron job, a test, a CLI. The
moment a service expects `req.body`, it's coupled to Express forever.

### 3. Never call Mongoose directly from a controller

Controllers orchestrate. They don't query. `Trade.find(...)` inside a controller
means there's no repository, which means business logic has nowhere to grow.

### 4. Never write a function longer than ~50 lines

50 is a soft guide, not a hard limit — but any function that crosses it usually
has 2+ responsibilities hiding inside. Split into named helpers.

### 5. Never hard-code a concrete dependency

`private repo = new TradeRepository()` inside a service defeats DI. Inject
through the constructor; wire in `composition/container.ts`.

### 6. Never return `any`

Every exported function signs a contract. `any` is "no contract". Use `unknown`
while exploring, then replace with a real type before committing.

### 7. Never mutate input parameters

Mutating a parameter surprises callers and makes tests flaky. Return a new
object instead:
```ts
// ❌
function addEmail(user, email) { user.email = email; return user; }

// ✅
function addEmail(user, email) { return { ...user, email }; }
```

### 8. Never scatter `try/catch` across routes

`asyncHandler` + global `errorHandler` handle it. If you're writing `try/catch`
in a route, either move the handling into the error handler (if global) or
throw a typed `AppError` subclass (if specific).

### 9. Never duplicate code across layers

Two repositories with the same 3 methods? Extract a generic
`IBaseRepository<T, Create, Update>`. Two services with the same "find or
throw" pattern? Extract a helper.

### 10. Never import concrete classes in high-level modules

A service importing `TradeRepository` directly skips the interface and makes
swapping impossible. Import `ITradeRepository` from `interfaces/`.

---

## ✅ ALWAYS

### 1. Always give each file one responsibility

If you can't describe a file's job in one sentence, split it.

### 2. Always write the interface first

Before a single line of implementation, write the `I<Module>*` interfaces.
The interface is the spec. The class is the detail.

### 3. Always use constructor-based DI

No setter injection. No global registries. Constructors make dependencies
explicit and enforce init order.

### 4. Always validate at the boundary

Validate `req.body` in middleware (Zod). By the time the controller runs, the
data is the type it claims to be.

### 5. Always use a mapper between layers

Repository returns `I<Module>` (internal shape). Service returns `<Module>DTO`
(external shape). The mapper converts. This keeps schema changes from leaking
to clients.

### 6. Always prefer pure functions

Any helper that doesn't need state, I/O, or randomness should be a pure
function. Pure functions test instantly and compose cleanly.

### 7. Always throw typed `AppError` subclasses

`throw new Error('not found')` → 500 generic. `throw new NotFoundError('Trade')`
→ 404 with a clear message. The error hierarchy IS the API contract.

### 8. Always return `ApiResponse<T>`

```ts
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: unknown };
```
One shape, everywhere. Clients write one parser.

### 9. Always document interfaces with JSDoc

Interfaces are the contract. Comment each method with what it does, what it
throws, and any edge cases. Implementations inherit the docs.

### 10. Always name for intent

Classes are nouns: `TradeService`, `StorageProvider`. Methods are verbs:
`findAll`, `create`, `resolveRuleChecklist`. Variables describe content, not
type: `trades`, not `arr`.

---

## Project-wide Non-Negotiables

- **ESM imports**: include `.js` extension when `tsconfig.module` is NodeNext / ESNext
- **Lean queries**: `.lean()` for reads — keeps memory low and serializes cleanly
- **Scope by user**: every user-owned query filters on `userEmail`
- **No logging in services**: log at the edge (middleware, errorHandler), not in business logic
- **No `console.log` committed**: only `console.error` inside errorHandler
