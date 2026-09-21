# SOLID Verification Checklist

Run this checklist before claiming any backend task done. Each item must be
verifiable — if you can't point at code that proves the ✅, the ✅ is a lie.

---

## S — Single Responsibility

- [ ] No route file contains `if`, `switch`, or arithmetic — only routing
- [ ] No service file imports from `express` (no `req`, `res`, no middleware types)
- [ ] No controller file imports from `mongoose` or `../models/*`
- [ ] Every file's purpose fits in one sentence ("this file is the X for Y")
- [ ] No function exceeds ~50 lines; long functions split into named helpers
- [ ] Every class name is a noun; every method name is a verb

**Counter-example to catch**: a `tradeController.ts` that calls `Trade.find()`
directly. That's SRP violation — delete it, add a repo, go through the service.

---

## O — Open/Closed

- [ ] Behavior that may have N variants uses Strategy, Factory, or Plugin
- [ ] Adding a new variant requires creating a file, not modifying an existing one
- [ ] `if (provider === 'a') { ... } else if (provider === 'b') { ... }` is gone

**Counter-example**: `storageService.upload()` containing
`if (useGoogleDrive) { ... } else { ... }`. Extract to `IStorageProvider` +
factory + per-provider class.

---

## L — Liskov Substitution

- [ ] Every class implementing an interface can be swapped in the composition
      root without changing any service/controller code
- [ ] No implementation narrows a return type (`Promise<User>` → `Promise<Admin>`)
- [ ] No implementation throws an error NOT documented on the interface
- [ ] No method returns `null` where the interface says `T`, or vice versa

**Counter-example**: `ILogger.log(msg: string): void` but
`FileLogger.log(msg: string): Promise<void>`. Change the interface or the
implementation — they must match.

---

## I — Interface Segregation

- [ ] No interface has methods some callers never use
- [ ] Read vs write operations split into separate interfaces where clients differ
- [ ] Large services implement `IReadService & IWriteService`, not one fat interface

**Counter-example**: `ITradeService` with `getAll + create + uploadImage + getAI`.
A caller that only needs `getAll` shouldn't be forced to depend on the upload
and AI surface area. Split.

---

## D — Dependency Inversion

- [ ] Services import from `../interfaces/*`, not from `../repositories/*` directly
- [ ] Controllers import from `../interfaces/*`, not from `../services/*` directly
- [ ] The ONLY file with `new ConcreteClass()` is `composition/container.ts`
- [ ] No `import mongoose` outside `models/`, `repositories/`, `db.ts`

**Counter-example**: a service that does
`private repo = new TradeRepository()` in its constructor body. That's a hidden
concrete dependency. Inject it.

---

## Post-Task Verification (MANDATORY)

- [ ] `node-verify-import` skill ran → zero broken imports
- [ ] `npx tsc --noEmit` passes → zero type errors
- [ ] If there are tests, they all pass
- [ ] `git diff` was reviewed by eye before commit

If any box is unchecked, fix before claiming completion.
