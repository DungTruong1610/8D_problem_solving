---
description: Create and run CAP unit tests using Jest with proven patterns
---

# Unit Test Workflow for SAP CAP

Use this workflow when creating or running unit tests for CAP services.

---

## Part A: Run Existing Tests

### 1. Run All Unit Tests
// turbo
```bash
npm test
```

### 2. Run with Verbose Output
// turbo
```bash
npm test -- --verbose
```

### 3. Run Specific Test File
// turbo
```bash
npx jest tests/unit/<filename>.test.ts
```

### 4. Run with Coverage Report
// turbo
```bash
npm run test:coverage
```

---

## Part B: Create New Unit Tests

### 1. Identify Target Module
Determine the module/service to test (e.g., `srv/lib/my-service.ts` or `srv/handlers/MyHandler.ts`).

### 2. Create Test File
Create file at `tests/unit/<module-name>.test.ts` using this template:

```typescript
/**
 * Unit Tests: <ModuleName>
 */
import cds from '@sap/cds';
import path from 'path';
// Import the module under test (static import, NOT dynamic)
import { MyModule } from '../../srv/lib/my-module';

// Project root with forward slashes for Windows compatibility
const PROJECT_ROOT = path.resolve(__dirname, '../..').replace(/\\/g, '/');

describe('<ModuleName>', () => {
    let db: cds.Service;
    
    beforeAll(async () => {
        cds.root = PROJECT_ROOT;
        
        // Load CDS files as EXPLICIT array (no globs!)
        await cds.load([
            PROJECT_ROOT + '/db/schema.cds',
            PROJECT_ROOT + '/srv/<relevant-service>.cds'
        ]);
        
        await cds.deploy('*').to('sqlite::memory:');
        db = await cds.connect.to('db');
    }, 60000);

    beforeEach(async () => {
        // Clean up test data
        const { MyEntity } = db.entities('my.namespace');
        try {
            await DELETE.from(MyEntity).where({ code: { like: 'TEST_%' } });
        } catch { /* ignore */ }
    });

    describe('<FeatureName>', () => {
        test('should <expected behavior>', async () => {
            // Arrange
            const input = { /* test data */ };
            
            // Act
            const result = await MyModule.doSomething(input);
            
            // Assert
            expect(result).not.toBeNull();
        });
    });
});
```

### 3. Run New Test
// turbo
```bash
npx jest tests/unit/<new-test-file>.test.ts --verbose
```

### 4. Verify All Pass
// turbo
```bash
npm test
```

---

## Part C: Critical Patterns (Must Follow)

| Pattern | ✅ Correct | ❌ Wrong |
|---------|-----------|----------|
| **Imports** | `import { X } from 'module'` | `await import('module')` |
| **Paths** | `path.replace(/\\/g, '/')` | `path` with backslashes |
| **CDS Load** | `await cds.load([...files])` | `await cds.load('**/*.cds')` |
| **Null Check** | `expect(x).toBeFalsy()` | `expect(x).toBeNull()` |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tests timeout | Increase `testTimeout` in jest.config.js |
| Path errors on Windows | Use `.replace(/\\/g, '/')` |
| `cds.model` undefined | Use file inspection for annotations |
| Dynamic import fails | Switch to static import |

---

## Reference
- Full guide: `.agent/skills/testing/resources/cap-unit-testing.md`
- Guidelines: `.agent/guidelines/testing-guidelines.md`
