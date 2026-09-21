# Node.js TypeScript CAP Backend Template

Domain-driven Clean Architecture following **SOLID** principles.

## CAP Standard Structure

```
db/
├── schema/
│   └── *.cds                  # CDS schema definitions
srv/
├── src/
│   ├── common/                # Shared resources (interfaces, models, exceptions)
│   ├── domain/                # DOMAIN LOGIC (Feature-based, SRP)
│   └── infrastructure/        # INFRASTRUCTURE (External Systems, DIP)
├── index.ts                   # Module entry point
└── server.ts                  # Custom CAP bootstrap
```

## Directory Breakdown

### Service Definition
```
srv/
├── {ServiceName}.cds        # Service definition (READ, CREATE, UPDATE, DELETE)
├── server.ts                # CAP bootstrap (custom middleware, routes)
└── index.ts                 # Module entry point
```

### Common Layer
```
common/
├── interfaces/    # ICommon, IServiceResponse
├── model/        # ApiResponse, ServiceResponse
├── enum/         # HttpStatusCode, BTPDestinationServices
├── exception/    # ServiceException, ValidationException
├── util/         # Logger, TextHandler
└── service/      # BaseService
```

### Domain Layer (Feature-based)
```
domain/
└── __feature__/
    ├── handler/   # EventHandlers (registers events only)
    ├── events/    # Event logic (OnRead*, OnBeforeCreate*, etc.)
    ├── model/     # Domain Entity & DTO
    ├── repository/# CQN data access
    └── service/   # Business logic
```

### Infrastructure Layer
```
infrastructure/
├── database/      # DBHandler
├── security/      # SecurityService
├── integration/
│   ├── btp/      # DestinationCloudService
│   ├── erp/      # S4HANAClient
│   └── messaging/# MessagePublisher
└── middleware/    # BTPServiceLoggingMiddleware
```

## Usage

When generating a new feature:

1. Copy `src/domain/__feature__/` template folder
2. Replace `__feature__` with feature name (e.g., `notification`)
3. Replace `{{FeatureName}}` with class name (e.g., `Notification`)
4. Register handlers in `server.ts`

## Infrastructure vs Domain

| Concern | Layer | Reason |
|---------|-------|--------|
| Database operations | `infrastructure/database/` | Low-level detail, not domain logic |
| External APIs (S/4HANA, BTP) | `infrastructure/integration/` | External system access |
| Event messaging | `infrastructure/integration/` | External messaging |
| Business rules | `domain/*/service/` | Core domain logic |
| Data access | `domain/*/repository/` | Domain boundary |
| Event routing | `domain/*/handler/` | Presentation layer |

## Key Principles

### SRP - Single Responsibility
- **Handler**: Event registration only (imports and registers events)
- **Events**: Event logic (OnRead*, OnBeforeCreate*, OnAfterCreate*, etc.)
- **Service**: Business logic (validation, orchestration)
- **Repository**: Data access (CQN queries)

### DIP - Dependency Inversion
- High-level modules depend on abstractions
- Constructor injection for all dependencies
- Never use `any` type; always use interfaces

### Clean Architecture Layers

| Layer | Responsibility | Example |
|-------|---------------|---------|
| **Handler** | Event routing | `onRead()`, `onBeforeCreate()` |
| **Service** | Business logic | `validateCreate()`, `executeCustomAction()` |
| **Repository** | Data access | `find()`, `create()`, `update()` |
| **Infrastructure** | External systems | `S4HANAClient`, `DestinationCloudService`, `DBHandler` |

## Usage

When generating a new feature:

1. Copy `src/domain/__feature__/` template folder
2. Replace `__feature__` with feature name (e.g., `notification`)
3. Replace `{{FeatureName}}` with class name (e.g., `Notification`)
4. Register handlers in `server.ts`

## Hard Rules

✅ **ALWAYS DO:**
- Use TypeScript strict mode
- Wrap responses in `ApiResponse<T>`
- Use `cds.log()` instead of `console.log`
- Implement unit tests for services
- Handle errors with `ServiceException`

❌ **NEVER DO:**
- Write business logic in handlers
- Use `any` type
- Return raw DB objects (map to DTO)
- Call `db.run()` directly in handlers
- Perform N+1 queries (use `.expand()`)