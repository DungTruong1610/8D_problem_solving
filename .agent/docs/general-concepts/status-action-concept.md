# Dynamic Status & Action Pattern

A reusable architectural pattern for implementing configurable workflow statuses and actions per entity type.

---

## Overview

This pattern enables **dynamic, per-entity-type configuration** of:
- **Statuses** - Lifecycle states with editability control
- **Actions** - Operations available based on current status

```
┌─────────────────────────────────────────────────────────────────┐
│                         Entity Schema                            │
│  entityType: "Invoice"                                           │
│  statusConfig: { statuses: [...], initialStatus: "New" }        │
│  availableActions: [ { name, type, requiredStatus, ... } ]      │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│      Status Engine        │    │      Action Engine        │
│  - Controls editability   │    │  - Filters by status      │
│  - Validates transitions  │    │  - Executes via Strategy  │
└──────────────────────────┘    └──────────────────────────┘
```

---

## Part 1: Status System

### Concept

Each entity type defines its own set of statuses. Each status controls whether the UI is **editable** or **read-only**.

### Data Structure

```typescript
interface IStatusDefinition {
    code: string;       // Internal value (stored in DB)
    label: string;      // Display text (fallback)
    labelKey?: string;  // i18n translation key
    editable: boolean;  // When false, UI is read-only
}

interface IStatusConfig {
    statuses: IStatusDefinition[];
    initialStatus: string;  // Default for new entities
}
```

### Example Configuration

```json
{
  "statuses": [
    { "code": "New", "label": "New", "editable": true },
    { "code": "Processing", "label": "Processing", "editable": false },
    { "code": "Completed", "label": "Completed", "editable": true },
    { "code": "Approved", "label": "Approved", "editable": false },
    { "code": "Error", "label": "Error", "editable": true }
  ],
  "initialStatus": "New"
}
```

### System Status Protection

Define **protected statuses** that cannot be deleted or modified:

```typescript
const SYSTEM_STATUSES: IStatusDefinition[] = [
    { code: 'New', label: 'New', editable: true },
    { code: 'Processing', label: 'Processing', editable: false },
    { code: 'Completed', label: 'Completed', editable: true },
    { code: 'Error', label: 'Error', editable: true },
    { code: 'Approved', label: 'Approved', editable: false },
];
```

### Validation Rules

On entity schema save, validate:
- ✅ All system statuses must exist
- ✅ System status `editable` property cannot change
- ✅ `initialStatus` must reference valid status
- ✅ No duplicate status codes

---

## Part 2: Action System

### Concept

Actions are **configurable operations** that execute based on the entity's current status. Uses the **Strategy Pattern** to route actions to specialized executors.

### Data Structure

```typescript
type ActionType = 'internal' | 'api' | 'email' | 'ai';

interface IActionDefinition {
    // Identity
    name: string;           // Unique identifier
    label: string;          // Display text
    description?: string;   // Tooltip
    icon?: string;          // UI icon name
    
    // Type & Handler
    type: ActionType;
    handler?: string;       // For internal: function name
    
    // API Type Config
    apiEndpoint?: string;
    apiMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    apiPayload?: object;    // Template with ${field} placeholders
    
    // Email Type Config
    emailTo?: string;
    emailSubject?: string;
    emailTemplate?: string;
    
    // AI Type Config
    aiPrompt?: string;
    aiResultField?: string;
    
    // Workflow Control
    requiredStatus: string[];   // Statuses that allow this action
    resultStatus?: string;      // Status after execution
    confirmMessage?: string;    // Confirmation dialog text
}

interface IActionResult {
    success: boolean;
    result: string;
    message?: string;
    newStatus?: string;
    data?: object;
}
```

### Action Executor Architecture

```
                      executeAction(actionName)
                              │
               ┌──────────────┼──────────────┐
               ▼              ▼              ▼
         ┌──────────┐   ┌──────────┐   ┌──────────┐
         │ Internal │   │   API    │   │  Email   │   ...
         │ Executor │   │ Executor │   │ Executor │
         └──────────┘   └──────────┘   └──────────┘
              │              │              │
              ▼              ▼              ▼
         ┌──────────┐   ┌──────────┐   ┌──────────┐
         │ verify   │   │ POST/GET │   │ Send via │
         │ approve  │   │ endpoint │   │ SMTP/SES │
         │ reject   │   └──────────┘   └──────────┘
         └──────────┘
```

### Action Types

| Type | Description | Config Fields |
|------|-------------|---------------|
| `internal` | Execute business logic | `handler` |
| `api` | Call external REST API | `apiEndpoint`, `apiMethod`, `apiPayload` |
| `email` | Send email notification | `emailTo`, `emailSubject`, `emailTemplate` |
| `ai` | AI-powered analysis | `aiPrompt`, `aiResultField` |

---

## Part 3: Implementation Pattern

### 1. Base Action Executor

```typescript
abstract class BaseActionExecutor {
    abstract execute(
        action: IActionDefinition,
        entity: IEntity,
        context: IUserContext
    ): Promise<IActionResult>;
    
    protected resolvePlaceholders(template: string, data: object): string {
        return template.replace(/\$\{(\w+)\}/g, (_, key) => data[key] || '');
    }
}
```

### 2. Internal Action Executor

```typescript
class InternalActionExecutor extends BaseActionExecutor {
    private handlers: Map<string, InternalHandler>;
    
    constructor() {
        this.handlers = new Map([
            ['verify', this.handleVerify.bind(this)],
            ['approve', this.handleApprove.bind(this)],
            ['reject', this.handleReject.bind(this)],
            ['reprocess', this.handleReprocess.bind(this)],
        ]);
    }
    
    async execute(action, entity, context): Promise<IActionResult> {
        const handler = this.handlers.get(action.handler);
        if (!handler) throw new Error(`Unknown handler: ${action.handler}`);
        return await handler(entity, context);
    }
}
```

### 3. API Action Executor

```typescript
class ApiActionExecutor extends BaseActionExecutor {
    async execute(action, entity, context): Promise<IActionResult> {
        const payload = this.buildPayload(action.apiPayload, entity);
        
        const response = await fetch(action.apiEndpoint, {
            method: action.apiMethod || 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        return { 
            success: response.ok,
            result: action.resultStatus || 'Completed',
            message: 'API call completed'
        };
    }
    
    private buildPayload(template: object, entity: IEntity): object {
        return JSON.parse(
            JSON.stringify(template).replace(/\$\{(\w+)\}/g, (_, key) => entity.data[key] || '')
        );
    }
}
```

### 4. Action Executor Factory

```typescript
class ActionExecutorFactory {
    private executors: Map<ActionType, BaseActionExecutor>;
    
    constructor() {
        this.executors = new Map([
            ['internal', new InternalActionExecutor()],
            ['api', new ApiActionExecutor()],
            ['email', new EmailActionExecutor()],
            ['ai', new AIActionExecutor()],
        ]);
    }
    
    getExecutor(action: IActionDefinition): BaseActionExecutor {
        const executor = this.executors.get(action.type);
        if (!executor) throw new Error(`No executor for type: ${action.type}`);
        return executor;
    }
}
```

### 5. Dynamic Action Handler

```typescript
class DynamicActionHandler {
    private executorFactory = new ActionExecutorFactory();
    
    async executeAction(entityId: string, actionName: string): Promise<IActionResult> {
        // 1. Load entity and schema
        const entity = await this.loadEntity(entityId);
        const schema = await this.loadSchema(entity.entityType);
        
        // 2. Get available actions
        const actions = this.parseActions(schema.availableActions);
        const action = actions.find(a => a.name === actionName);
        
        if (!action) throw new Error(`Action not found: ${actionName}`);
        
        // 3. Validate status requirement
        if (!action.requiredStatus.includes(entity.status)) {
            throw new Error(`Action not allowed in status: ${entity.status}`);
        }
        
        // 4. Execute via appropriate executor
        const executor = this.executorFactory.getExecutor(action);
        const result = await executor.execute(action, entity, this.context);
        
        // 5. Update status if configured
        if (result.success && action.resultStatus) {
            await this.updateStatus(entityId, action.resultStatus);
            result.newStatus = action.resultStatus;
        }
        
        return result;
    }
    
    async getAvailableActions(entityId: string): Promise<object> {
        const entity = await this.loadEntity(entityId);
        const schema = await this.loadSchema(entity.entityType);
        const actions = this.parseActions(schema.availableActions);
        const statusConfig = this.parseStatusConfig(schema.statusConfig);
        
        // Filter actions by current status
        const availableActions = actions.filter(
            a => a.requiredStatus.includes(entity.status)
        );
        
        // Get current status config
        const currentStatusConfig = statusConfig.statuses.find(
            s => s.code === entity.status
        );
        
        return {
            actions: availableActions,
            currentStatus: entity.status,
            currentStatusConfig,
            statusConfig
        };
    }
}
```

---

## Part 4: API Design

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `getAvailableActions(entityId)` | GET | Returns actions for current status |
| `executeAction` | POST | Execute action on entity |

### getAvailableActions Response

```json
{
    "actions": [
        {
            "name": "approve",
            "label": "Approve",
            "icon": "accept",
            "type": "internal",
            "confirmMessage": "Approve this document?"
        }
    ],
    "currentStatus": "Completed",
    "currentStatusConfig": { 
        "code": "Completed", 
        "label": "Completed", 
        "editable": true 
    },
    "statusConfig": { 
        "statuses": [...], 
        "initialStatus": "New" 
    }
}
```

### executeAction Request/Response

```json
// Request: POST /Entity(id)/executeAction
{ "actionName": "approve" }

// Response
{
    "success": true,
    "result": "Approved",
    "message": "Document approved successfully",
    "newStatus": "Approved"
}
```

---

## Part 5: Frontend Integration

### Action Button Rendering

```jsx
function ActionButtons({ entityId }) {
    const [actions, setActions] = useState([]);
    const [statusConfig, setStatusConfig] = useState(null);
    
    useEffect(() => {
        fetchAvailableActions(entityId).then(response => {
            setActions(response.actions);
            setStatusConfig(response.currentStatusConfig);
        });
    }, [entityId]);
    
    const handleAction = async (action) => {
        if (action.confirmMessage) {
            const confirmed = await showConfirmDialog(action.confirmMessage);
            if (!confirmed) return;
        }
        
        const result = await executeAction(entityId, action.name);
        if (result.success) {
            showSuccess(result.message);
            refreshData();
        }
    };
    
    return (
        <div>
            {actions.map(action => (
                <Button
                    key={action.name}
                    icon={action.icon}
                    onClick={() => handleAction(action)}
                >
                    {action.label}
                </Button>
            ))}
        </div>
    );
}
```

### Editability Control

```jsx
function EntityForm({ entityId }) {
    const { currentStatusConfig } = useAvailableActions(entityId);
    const isEditable = currentStatusConfig?.editable ?? true;
    
    return (
        <Form readOnly={!isEditable}>
            {/* Form fields */}
        </Form>
    );
}
```

---

## Part 6: Database Schema

```sql
-- Entity Schema Table
CREATE TABLE EntitySchema (
    ID UUID PRIMARY KEY,
    entityType VARCHAR(50) UNIQUE NOT NULL,
    statusConfig TEXT,          -- JSON: IStatusConfig
    availableActions TEXT,      -- JSON: IActionDefinition[]
    -- other schema fields...
);

-- Entity Table
CREATE TABLE Entity (
    ID UUID PRIMARY KEY,
    entityType VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'New',
    data TEXT,                  -- JSON: extracted/entity data
    -- other fields...
    FOREIGN KEY (entityType) REFERENCES EntitySchema(entityType)
);
```

---

## Benefits

| Benefit | Description |
|---------|-------------|
| **No Code Changes** | Add/modify actions via configuration |
| **Per-Type Workflows** | Different entity types have different processes |
| **Status-Action Binding** | Actions are context-aware |
| **UI Consistency** | Frontend renders dynamically from config |
| **Extensible** | Add new executor types without changing core |
| **i18n Ready** | Labels support translation keys |

---

## Implementation Checklist

> **Note**: This pattern has been fully implemented for the Activity Management System, including an extensible executor pattern.

1. [x] Define `IStatusDefinition`, `IStatusConfig` types → `srv/types.ts`
2. [x] Define `IActionDefinition`, `IActionResult` types → `srv/types.ts`
3. [x] Define `SYSTEM_STATUSES` constant → `srv/lib/actionExecutors.ts`
4. [x] Create `BaseActionExecutor` abstract class → `srv/lib/actionExecutors.ts`
5. [x] Create `InternalActionExecutor` with handler map → `srv/lib/actionExecutors.ts`
6. [x] Create `NotificationActionExecutor` (placeholder for API/Email) → `srv/lib/actionExecutors.ts`
7. [x] Create `ActionExecutorFactory` → `srv/lib/actionExecutors.ts`
8. [x] Create `DynamicActionHandler` with executeAction/getAvailableActions → `ActivityHandler.ts`
9. [x] Add status validation on schema save → `ActivityHandler.ts BEFORE UPDATE`
10. [x] Update frontend to call getAvailableActions → via `availableActions` virtual property
11. [x] Render dynamic action buttons → `ActivityActions.tsx`
12. [x] Implement editability control based on status → `statusConfig.locked`
