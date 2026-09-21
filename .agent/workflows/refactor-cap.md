---
description: Refactor SAP CAP codebase following SOLID, YAGNI, KISS, DRY principles and Conarum conventions
---

# Refactor CAP Codebase

A systematic refactoring workflow for SAP CAP projects. Applies SOLID, YAGNI, KISS, DRY principles tailored to the Conarum architecture (DB/SRV/App layers).

---

## Step 1: Scope the Refactoring

Ask the user:
1. **Target layer**: Backend (srv), Frontend (app/UI5 or React), or Full Stack?
2. **Scope**: Specific module/entity, specific file, or entire codebase?
3. **Goal**: Code quality, performance, testability, or all?

---

## Step 2: Analyze Current Code

### 2.1 Backend Analysis (srv/)
For each service handler and business logic file, check for:

**S — Single Responsibility Principle (SRP)**
- [ ] Does each class/module do only one thing?
- [ ] Is `server.ts` only doing bootstrap (no business logic)?
- [ ] Are service handlers thin (delegating to `services/` classes)?
- [ ] Are CRUD operations delegated to `DBHandler`, not inline?

**O — Open/Closed Principle (OCP)**
- [ ] Can new entity handlers be added without modifying existing ones?
- [ ] Is `CommonServiceImpl` used as base class (extend, don't modify)?
- [ ] Are response types using `ApiResponse<T>` / `ServiceResponse<T>` generics?

**L — Liskov Substitution (LSP)**
- [ ] Do all services extending `CommonServiceImpl` work interchangeably?
- [ ] Do implementations match their interface contracts (`ICommon.ts`)?

**I — Interface Segregation (ISP)**
- [ ] Are interfaces in `srv/src/interfaces/` focused (no bloated interfaces)?
- [ ] Does each service implement only the interfaces it needs?

**D — Dependency Inversion (DIP)**
- [ ] Do services depend on interfaces, not concrete classes?
- [ ] Is `DestinationCloudService` injected, not hardcoded?
- [ ] Are external API calls abstracted behind interfaces?

### 2.2 Frontend Analysis (app/)

**For UI5:**
- [ ] Do all controllers extend `BaseController`?
- [ ] Is business logic in `Handler/` classes (not in controllers)?
- [ ] Are entity names centralized in `ENTITY.js` (not hardcoded strings)?
- [ ] Are data shapes defined with `DTOInterface` (not raw objects)?
- [ ] Are constants in `utils/Enum/` with `Object.freeze()`?

**For React:**
- [ ] Does the layer dependency rule hold? (`domain/` never imports from `data/`)
- [ ] Is every business operation a separate UseCase class?
- [ ] Do UseCases return `Result<T>` (not throwing raw errors)?
- [ ] Is `container.ts` the only file instantiating concrete classes?
- [ ] Are components purely presentational (logic in hooks)?

---

## Step 3: Apply YAGNI / KISS / DRY Patterns

### YAGNI (You Aren't Gonna Need It)
- [ ] Remove dead code (unused imports, commented-out blocks, unused handlers)
- [ ] Remove empty folders with only `.gitkeep` if no code planned
- [ ] Remove over-engineered abstractions with only one implementation
- [ ] Check for unused npm dependencies: `npx depcheck`

### KISS (Keep It Simple, Stupid)
- [ ] Simplify deeply nested conditionals (use early returns, guard clauses)
- [ ] Replace complex callback chains with async/await
- [ ] Flatten unnecessary class hierarchies
- [ ] In UI5: Replace inline anonymous functions with named handler methods

### DRY (Don't Repeat Yourself)
- [ ] Extract repeated OData query patterns into `DBHandler` methods
- [ ] Extract repeated response formatting into `CommonServiceImpl` helpers
- [ ] Extract repeated UI5 utility code into `utils/UICommon.js`
- [ ] Extract repeated filter logic into shared filter handlers
- [ ] Consolidate duplicated DTO definitions

---

## Step 4: Refactoring Checklist by Layer

### Backend (srv/) Refactoring Actions

| Smell | Action | Reference Template |
|-------|--------|-------------------|
| Business logic in handler `.ts` file | Extract to `services/` class | `templates/srv/Handler.ts` |
| Raw SQL/CQL queries scattered | Centralize in `DBHandler` methods | `templates/srv/core/DBHandler.ts` |
| Inconsistent error responses | Use `ServiceResponse` / `ApiResponse` | `templates/srv/model/core/` |
| Hardcoded status codes | Use `HTTP_STATUS` enum | `templates/srv/enum/HttpStatusCodeEnum.ts` |
| Missing transaction management | Wrap in `cds.tx(cds.context)` with commit/rollback | `templates/srv/core/DBHandler.ts` |
| Duplicated managed field logic | Use `setCreateManaged()` / `setUpdateManaged()` | `templates/srv/core/CommonService.ts` |
| Inline destination lookups | Use `DestinationCloudService` | `templates/srv/core/DestinationCloudService.ts` |
| Missing interfaces for services | Define in `interfaces/` | `templates/srv/interfaces/ICommon.ts` |

### Frontend UI5 Refactoring Actions

| Smell | Action | Reference Template |
|-------|--------|-------------------|
| Fat controller (>500 LOC) | Extract Handler classes | `templates/ui5/controller/Handler/MyHandler.js` |
| Hardcoded entity names | Use `ENTITY.js` registry | `templates/ui5/api/ENTITY.js` |
| Raw data objects | Use DTO pattern | `templates/ui5/api/DTO/MyEntityDTO.js` |
| Scattered magic strings | Create Enum files | `templates/ui5/utils/Enum/AppRouteEnum.js` |
| Duplicated user profile shape | Use Interface pattern | `templates/ui5/interfaces/UserBaseInterface.js` |

### Frontend React Refactoring Actions

| Smell | Action | Reference Template |
|-------|--------|-------------------|
| API calls in components | Move to Repository + UseCase | `templates/react/data/repositories/EntityRepository.ts` |
| Raw fetch/axios calls | Use centralized HttpClient | `templates/react/data/datasources/HttpClient.ts` |
| Business logic in hooks | Extract to UseCase class | `templates/react/domain/usecases/GetAllEntitiesUseCase.ts` |
| Concrete class imports in components | Use DI container | `templates/react/di/container.ts` |
| Try/catch error handling | Use Result monad | `templates/react/core/Result.ts` |

---

## Step 5: Execute Refactoring

For each identified issue:
1. **Read** the reference template from the skill
2. **Create/modify** the file following the template pattern
3. **Update imports** in all affected files
4. **Verify** no regressions:
   - Backend: `npm run build` (TypeScript compile check)
   - UI5: `npx ui5 build` or manual browser test
   - React: `npm run build` or `npm run dev`

---

## Step 6: Final Validation

1. **Build check**: `npm run build` passes without errors
2. **Structure check**: Run `validate.py` (backend) to confirm folder integrity
3. **No dead code**: Run `npx depcheck` for unused dependencies
4. **Code consistency**: Verify all modified files follow template patterns
5. **Notify user**: Summarize changes made and their impact
