# <PROJECT NAME> — SAP CAP Backend (Conarum Standard)

> Project-specific context cho Claude.
> Project này tuân theo **Conarum CAP backend standard** (skill `cnma-cap-backend`).
> Skill đó đã chứa đầy đủ folder skeleton + core classes + naming conventions.
> File này bổ sung: SOLID application notes + mandatory verification pipeline +
> project-specific placement rules + common pitfalls.
>
> Khi scaffold project mới / module mới, **ưu tiên invoke skill `cnma-cap-backend`**
> để tự tạo đúng structure thay vì viết tay.

---

## Stack

<!-- TODO: điền version cụ thể -->
- **Framework**: SAP Cloud Application Programming Model (`@sap/cds` v7+)
- **Runtime**: Node.js (LTS) + TypeScript
- **Database**: SAP HANA Cloud (prod) / SQLite (dev)
- **Auth**: XSUAA (BTP) via `@sap/xssec` + Passport JWT
- **Logging**: Winston structured logger (via `srv/utils/logger.ts`)
- **Observability**: `cf-nodejs-logging-support` + BTP service logging middleware
- **Deployment**: MTA (`mta.yaml`) → Cloud Foundry / Kyma
- **Namespace**: `cnma.{module_name}` (CRITICAL — xem phần Namespace Convention bên dưới)

---

## Conarum Project Structure

Folder layout tuân theo skill `cnma-cap-backend`. **KHÔNG** tự phát minh layout mới:

```
<project-root>/
├── db/
│   ├── schema/                 # CDS entity definitions
│   ├── src/                    # HANA artifacts (calculation views)
│   ├── view/                   # HANA SQL views
│   ├── build.js                # Custom DB build
│   ├── undeploy.json           # ⚠️ MUST BE [] — xem HDI Protection bên dưới
│   └── package.json            # HDI deployer
├── srv/
│   ├── server.ts               # ★ CAP Bootstrap hook (Express middleware, auth, cron)
│   ├── {ServiceName}.cds       # OData service definition
│   ├── {ServiceName}.ts        # OData service handler
│   ├── src/
│   │   ├── core/               # ★ CommonService, DBHandler, DestinationCloudService, ActionResponse
│   │   ├── model/core/         # ★ ApiResponse, ServiceResponse, ValidationResponse
│   │   ├── interfaces/         # ★ ICommon (IApiResponse, IServiceResponse, ICommonService, Managed...)
│   │   ├── enum/               # ★ HttpStatusCodeEnum (HTTP_STATUS, HTTP_SUCCES_STATUSES)
│   │   ├── config/             # Configuration
│   │   ├── services/           # Business logic services (extend CommonServiceImpl)
│   │   ├── middleware/         # Express middleware (btp-service-logging, etc.)
│   │   ├── utils/              # Utilities (logger, enum/BTPDestinationServices)
│   │   ├── api/                # Non-OData REST routes
│   │   ├── events/             # Domain event handlers
│   │   ├── workers/            # Background workers
│   │   └── cds/
│   │       ├── handlers/       # {Entity}Handler.ts — register hooks only
│   │       ├── events/         # On{Before|After}{Hook}{Entity}Event.ts — entity lifecycle logic
│   │       └── actions/        # On{ActionName}Action.ts — CDS actions logic
│   └── type/                   # TS type definitions
├── i18n/                       # Localization
├── mta.yaml                    # MTA deployment descriptor
├── package.json
├── tsconfig.json
├── xs-security.json            # XSUAA
└── .eslintrc
```

Classes đánh dấu `★` **phải được generate bằng scaffold_backend.py** từ skill,
KHÔNG viết tay — để đảm bảo đồng nhất giữa các module Conarum.

---

## Namespace Convention (CRITICAL)

Mọi project MUST có namespace prefix `cnma.{module_name}`:

| Where | Format | Example |
|---|---|---|
| CDS schema file | `namespace {{namespace}};` | `namespace cnma.notification;` |
| CDS service file | `using {{namespace}} as ns from '../db/...'` | `using cnma.notification as ns from '../db/schema/Notification';` |
| `package.json` name | `"name": "{{project_name}}"` | `"name": "cnma_notification_service"` |
| Service handler | OData path dùng namespace entities | `srv.on('READ', ns.MyEntity, ...)` |

Khi scaffold project mới, **luôn hỏi namespace** trước khi tạo file.

---

## CDS Event & Action Naming Convention (MANDATORY)

Files under `srv/src/cds/events/` và `srv/src/cds/actions/` tuân nghiêm ngặt pattern:

### Entity Lifecycle Events → `srv/src/cds/events/{entity}/`

```
On{Before|After}{CDS_Hook}{EntityName}Event.ts
```

| CDS Hook | File Pattern | Example |
|---|---|---|
| `srv.on('READ', Entity)` | `OnRead{Entity}Event.ts` | `OnReadVariantSettingsEvent.ts` |
| `srv.before('CREATE', Entity)` | `OnBeforeCreate{Entity}Event.ts` | `OnBeforeCreateVariantSettingsEvent.ts` |
| `srv.after('CREATE', Entity)` | `OnAfterCreate{Entity}Event.ts` | `OnAfterCreateLogRecordEvent.ts` |
| `srv.after('UPDATE', Entity)` | `OnAfterUpdate{Entity}Event.ts` | `OnAfterUpdateConsumerHandlerSettingsEvent.ts` |

### CDS Actions → `srv/src/cds/actions/`

```
On{ActionName}Action.ts
```

| CDS Hook | File Pattern | Example |
|---|---|---|
| `srv.on('actionName')` | `On{ActionName}Action.ts` | `OnReprocessByFilterAction.ts` |
| Multi-method action | `{Domain}Action.ts` | `ConsumerHealthAction.ts` |

### Rules (strict)

- Mỗi file **must** export `execute(data, req)` (static method trong class, xem template)
- Handler files (`srv/src/cds/handlers/{Entity}Handler.ts`) **chỉ** register hooks và delegate sang event/action classes — KHÔNG chứa business logic
- Entity hook logic → `srv/src/cds/events/`
- Action logic → `srv/src/cds/actions/`

**Reference**: `VariantHandler.ts` + `OnReadVariantSettingsEvent.ts` + `OnAdjustDefaultVariantSettingAction.ts` trong skill templates.

---

## Core Classes — khi nào dùng cái nào

### `CommonServiceImpl` — base class cho services

Extend class này cho MỌI service mới trong `srv/src/services/`. Cung cấp:

- `getText(textKey, params?)` — i18n lookup
- `buildServiceResponse<T>(statusCode, message, data?)` — trả `IServiceResponse<T>`
- `buildValidationResponse<T>(valid, message)` — trả `IValidationResponseData<T>`
- `setCreateManaged(data, owner)` / `setUpdateManaged(data, owner)` — audit fields

### `DBHandlerService extends CommonServiceImpl` — generic CRUD

Dùng cho data access, **KHÔNG** tự viết raw `cds.run(SELECT...)` rải rác trong services. Pattern bắt buộc:

```ts
const tx = cds.tx(cds.context);   // ← KHÔNG dùng cds.tx(req)
try {
  const result = await tx.run(query);
  await tx.commit();              // ← bắt buộc để release connection pool
  return new ServiceResponse(HTTP_STATUS.OK, this.getText('KEY'), result);
} catch (error) {
  await tx.rollback().catch((err) => console.error('Rollback error:', err));
  return new ServiceResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, ...);
}
```

### `DestinationCloudService` — BTP destination + token management

Dùng cho external service calls qua BTP destination. Handle OAuth2
`client_credentials` flow. Pair với `BTPServiceLoggingMiddleware` để có
structured logs (start / success / error, duration, correlation).

### `ActionResponse` (static helpers) — CDS actions

Dùng cho response trong `srv/src/cds/actions/`:

```ts
return ActionResponse.ok('Done', { detail: '...' });
return ActionResponse.error('Failed: ...');
```

---

## Response Envelope Hierarchy

3 response classes, dùng ĐÚNG scope:

| Class | Dùng khi | Shape |
|---|---|---|
| `ApiResponse<T>` | Response cuối cùng trả về client (OData custom actions, non-OData REST) | `{ success, message, data }` |
| `ServiceResponse<T>` | Trả từ service method — có `statusCode` để handler decide HTTP code | `ApiResponse<T> + statusCode + toApiResponse()` |
| `ValidationResponse<T>` | Trả từ validator method | `{ valid, message, toApiResponse() }` |

Flow chuẩn:

```
Validator → ValidationResponse → (if invalid) toApiResponse() → return
Service → ServiceResponse → (handler) → toApiResponse() → req.reply / return
Action handler → ActionResponse.ok() / .error()
```

**KHÔNG** tự tạo envelope khác. **KHÔNG** return raw object không qua envelope cho custom actions.

---

## SOLID trong Conarum CAP — áp dụng cụ thể

| Principle | Áp dụng |
|---|---|
| **SRP** | Handler `.ts` = register hooks only. Business logic → `events/` hoặc `actions/` class. Data access → `DBHandler` hoặc service methods. KHÔNG mix. |
| **OCP** | Thêm entity / action mới = thêm file mới trong đúng folder (`events/{entity}/`, `actions/`). KHÔNG sửa handler cũ. Factory pattern cho multi-destination. |
| **LSP** | Mọi `{EntityName}Event` class có `static execute(req)` — swap được. Mọi service extend `CommonServiceImpl` phải honor contract methods. |
| **ISP** | `ICommon.ts` đã tách: `ICommonService`, `IDestinationCloudService`, `IApiResponse<T>`, `IServiceResponse<T>`, `IValidationResponseData<T>`. KHÔNG gộp thêm method không liên quan. |
| **DIP** | Services extend `CommonServiceImpl` (abstract base). External calls qua `IDestinationCloudService`. KHÔNG instantiate concrete class external service trực tiếp trong business logic. |

---

## Project-Specific Placement Rules

<!-- TODO: điền -->

| Concern | Goes in | Not in |
|---|---|---|
| Business logic cho entity hook | `srv/src/cds/events/{entity}/On*Event.ts` | Handler file, service directly |
| Business logic cho action | `srv/src/cds/actions/On*Action.ts` | Handler file |
| Cross-entity orchestration | `srv/src/services/*.service.ts` (extends `CommonServiceImpl`) | Handler, event file |
| HANA CRUD | `DBHandlerService` methods | Service trực tiếp |
| External BTP call | qua `DestinationCloudService` + `BTPServiceLoggingMiddleware` | axios trực tiếp |
| i18n messages | `i18n/` bundles + `getText('KEY')` | Hardcoded strings |
|   |   |   |

---

## 🚨 HDI Container Protection — NON-NEGOTIABLE

Sau khi init project mới, file `db/undeploy.json` mặc định có content:

```json
[
  "src/gen/**/*.hdbview",
  "src/gen/**/*.hdbindex",
  "src/gen/**/*.hdbconstraint",
  "src/gen/**/*_drafts.hdbtable",
  "src/gen/**/*.hdbcalculationview"
]
```

**MUST clean thành `[]` TRƯỚC KHI DEPLOY**:

```json
[]
```

**Nếu deploy khi undeploy.json vẫn còn entries** → sẽ WIPE tất cả data trong
HDI container (vì share container giữa các module Conarum) → **phải redeploy
tất cả applications**. Đây là incident cấp critical — check mỗi lần deploy.

---

## 🚨 Post-Task Verification — NON-NEGOTIABLE

Trước ANY "done" / "completed" / "xong rồi", Claude MUST chạy:

### 1. CDS compile

```bash
cds compile srv --to json > /dev/null
# hoặc
cds build
```

Schema + service definitions valid. Zero compile errors.

### 2. Check imports (skill-provided)

```bash
node .agent/skills/cnma-cap-backend/scripts/check_imports.js
```

Exit code 0 required.

### 3. Verify imports (skill-provided)

```bash
node .agent/skills/cnma-cap-backend/scripts/verify-imports.js
```

Exit code 0 required. Script scan `srv/` cho `require()` paths + external
modules allowlist, confirm mọi import resolve on disk.

**Nếu không có `.agent/skills/...` trong project** → dùng skill global
`node-verify-import` với `--dir srv`.

### 4. TypeScript check

```bash
npx tsc --noEmit
```

Zero type errors.

### 5. Validate scaffolded structure (sau scaffold / move files)

```bash
python .agent/skills/cnma-cap-backend/scripts/validate.py
```

Confirm đủ files + folders required.

### 6. HDI undeploy.json check (trước deploy)

```bash
cat db/undeploy.json
```

Phải là `[]`. Nếu không → STOP, clean, re-check.

### 7. SOLID checklist (applicable items)

Walkthrough `solid-backend-nodejs/references/solid-checklist.md` — SRP/OCP/LSP/ISP
full apply; DIP apply via `CommonServiceImpl` inheritance + `IDestinationCloudService`.

### Nếu BẤT KỲ bước nào fail → STOP, analyze, fix, re-run. KHÔNG claim done.

---

## Common Pitfalls — Conarum CAP

1. **Business logic trong `{Entity}Handler.ts`** → handler swell. Tách sang `events/{entity}/On*Event.ts`. Handler chỉ delegate.
2. **Dùng `cds.tx(req)` thay vì `cds.tx(cds.context)`** → connection pool issues trên HANA. Luôn `cds.tx(cds.context)` như trong `DBHandler`.
3. **Quên `tx.commit()`** sau query thành công → connection không release, pool exhaust sau vài request.
4. **Quên `tx.rollback()`** trong catch → zombie transaction, deadlock.
5. **Return raw object** từ action handler thay vì qua `ActionResponse.ok()/.error()` → frontend parse lệch format.
6. **Service không extend `CommonServiceImpl`** → mất `getText`, mất `buildServiceResponse`, mất consistent envelope.
7. **Hardcoded user-facing strings** trong handler → không translate được. Dùng `getText('KEY')` + `i18n/` bundle.
8. **Quên namespace prefix `cnma.`** trong `.cds` schema/service → conflict với entity ở module khác khi deploy chung HDI.
9. **`undeploy.json` còn entries khi deploy** → wipe container → redeploy all apps. Check mỗi lần deploy.
10. **File naming không theo convention** — `VariantHandler.ts` viết thành `variantHandler.ts`, hoặc event file viết thành `ReadVariantSettings.ts` thay vì `OnReadVariantSettingsEvent.ts` → Conarum tooling không pick up được, reviewer reject.
11. **Folder `cds/events/` đặt file actions**, hoặc ngược lại → broken separation. Action → `cds/actions/`, Entity hook → `cds/events/{entity}/`.
12. **Quên export `execute(data, req)` static method** trong event/action class → handler gọi fail runtime.
13. **Axios call external không qua `BTPServiceLoggingMiddleware`** → mất structured log, khó debug trên BTP Kibana.
14. **Destination name hardcoded** trong business logic → dùng `BTPDestinationServices` enum trong `utils/enum/`.

<!-- TODO: thêm pitfalls khi gặp incident trong project này -->

---

## When Claude is unsure

- **Scaffold project / module mới** → invoke skill **`cnma-cap-backend`** (không viết tay skeleton)
- **Architecture question** → skill `solid-backend-nodejs` → `references/solid-checklist.md`
- **Core class usage** (CommonService / DBHandler / Response classes) → đọc template trong skill `cnma-cap-backend/templates/srv/core/` và `templates/srv/model/core/`
- **Event/Action naming** → bảng convention phía trên, hoặc xem `VariantHandler.ts` trong skill templates làm reference
- **HANA transaction pattern** → copy từ `DBHandler.ts` template, KHÔNG tự chế
- **i18n key** → định nghĩa trong `i18n/messages.properties` + dùng `this.getText('KEY')`
- **Verify correctness** → chạy 7-step verification pipeline ở trên
- **CAP doc** → https://cap.cloud.sap/docs/ (fallback nếu Conarum standard chưa cover)
