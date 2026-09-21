# Java CAP Backend Template

Domain-driven Clean Architecture following **SOLID** principles with Lombok.

## CAP Standard Structure

```
db/
├── schema/
│   └── *.cds                  # CDS schema definitions
srv/
├── src/main/java/cnma/{{module_name}}/
│   ├── Application.java       # Spring Boot entry point
│   ├── common/                 # Shared resources (interfaces, models, exceptions)
│   ├── domain/                 # DOMAIN LOGIC (Feature-based, SRP)
│   └── infrastructure/        # INFRASTRUCTURE (External Systems, DIP)
└── src/main/resources/
    └── application.yaml       # Spring Boot configuration
```

## Directory Breakdown

### Service Definition
```
srv/
├── src/main/java/cnma/{{module_name}}/Application.java  # Spring Boot entry point
└── src/main/resources/application.yaml                 # Spring configuration
```

### Common Layer
```
common/
├── interfaces/    # ICommon, IServiceResponse
├── model/         # ApiResponse, ServiceResponse
├── enums/         # HttpStatusCode
├── exception/     # ServiceException, ValidationException
├── util/         # AppLogger
└── service/       # BaseService
```

### Domain Layer (Feature-based)
```
domain/
└── __feature__/
    ├── handler/   # EventHandlers (registers events only)
    ├── events/    # Event logic (OnRead*, OnBeforeCreate*, etc.)
    ├── model/     # Entity & DTO
    ├── repository/# CQN data access
    └── service/   # Business logic
```

### Infrastructure Layer
```
infrastructure/
├── database/      # DBHandler
├── security/      # SecurityService, UserContext
├── integration/
│   ├── btp/      # DestinationCloudService
│   ├── erp/      # S4HANAClient
│   └── messaging/# MessagePublisher
└── middleware/    # BTPServiceLoggingMiddleware
```

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
- **Handler**: Event registration only (imports event classes, registers handlers)
- **Events**: Event logic (OnRead*, OnBeforeCreate*, OnAfterCreate*, etc.)
- **Service**: Business logic (validation, orchestration)
- **Repository**: Data access (CQN queries)

### DIP - Dependency Inversion
- Constructor injection ONLY using Lombok `@RequiredArgsConstructor`
- Never use `@Autowired` on fields
- High-level modules depend on interfaces

### Clean Architecture Layers

| Layer | Annotation | Responsibility |
|-------|------------|---------------|
| **Handler** | `@Handler` | Event interception |
| **Service** | `@Service` | Business logic |
| **Repository** | `@Repository` | CQN data access |

## Hard Rules

✅ **ALWAYS DO:**
- Use Lombok (`@RequiredArgsConstructor`, `@Slf4j`, `@Data`)
- Return `Result` via `context.setResult()` in `@On` events
- Use `CqnAnalyzer` for parameter extraction
- Define Entities in `.cds` files before writing Java
- Use `ServiceException` (never plain `RuntimeException`)

❌ **NEVER DO:**
- Create "God Handler" (> 500 lines)
- Use field injection (`@Autowired`)
- Call `db.run()` directly in handlers
- Throw `RuntimeException` (use `ServiceException`)
- Perform N+1 queries (use batch queries)
- Use JPA/Hibernate `@Entity` (use CDS generated interfaces)