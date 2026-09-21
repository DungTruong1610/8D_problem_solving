# SAP CAP Unit Testing Guide

**Version:** 1.0
**Last Updated:** 2026-01-14
**Status:** Approved

---

## 1. Overview

This guide documents **lessons learned** and **best practices** for unit testing SAP CAP (Cloud Application Programming Model) services using Jest.

---

## 2. Test Environment Setup

### 2.1. Required Dependencies

```json
{
  "devDependencies": {
    "jest": "^29.x",
    "ts-jest": "^29.x",
    "@types/jest": "^29.x"
  }
}
```

### 2.2. Jest Configuration

```javascript
// jest.config.js
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.ts'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    testTimeout: 60000, // CDS deploy can take time
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            isolatedModules: true, // CRITICAL for performance
            useESM: false
        }]
    }
};
```

> [!IMPORTANT]
> **`isolatedModules: true`** is essential for performance. Without it, ts-jest compiles the entire project which is very slow.

---

## 3. CDS Model Loading (Windows-Compatible)

### 3.1. The Problem

CDS glob patterns (`**/*.cds`) do not work reliably on Windows due to path separator differences.

### 3.2. The Solution - Explicit File Arrays

```typescript
import cds from '@sap/cds';
import path from 'path';

// Convert backslashes to forward slashes for CDS compatibility
const PROJECT_ROOT = path.resolve(__dirname, '../..').replace(/\\/g, '/');

beforeAll(async () => {
    // Set CDS root explicitly
    cds.root = PROJECT_ROOT;
    
    // Load schema files as an explicit array (NOT glob patterns)
    await cds.load([
        PROJECT_ROOT + '/db/schema.cds',
        PROJECT_ROOT + '/srv/admin-service.cds',
        PROJECT_ROOT + '/srv/identity-service.cds'
    ]);
    
    // Deploy to in-memory SQLite
    await cds.deploy('*').to('sqlite::memory:');
    db = await cds.connect.to('db');
}, 60000);
```

> [!WARNING]
> **Never use glob patterns in Windows environments:**
> ```typescript
> // ❌ WRONG - Fails on Windows
> await cds.load(`${PROJECT_ROOT}/db/**/*.cds`);
> 
> // ✅ CORRECT - Works everywhere
> await cds.load([PROJECT_ROOT + '/db/schema.cds']);
> ```

---

## 4. Common Pitfalls & Solutions

### 4.1. `cds.model` is undefined

**Problem:** After `cds.deploy()`, `cds.model.definitions` is `undefined`.

**Solution:** Use file-based verification for annotations:
```typescript
import fs from 'fs';

test('AdminService has @requires: admin', () => {
    const cdsSource = fs.readFileSync(
        path.join(PROJECT_ROOT, 'srv', 'admin-service.cds'),
        'utf8'
    );
    expect(cdsSource).toMatch(/requires:\s*['"]?admin['"]?/);
});
```

### 4.2. Dynamic Imports Fail in Jest

**Problem:** `await import()` fails with "dynamic import callback was invoked without --experimental-vm-modules".

**Solution:** Use static imports at the top of the file:
```typescript
// ❌ WRONG - Dynamic import fails
const module = await import('../../srv/lib/my-module');

// ✅ CORRECT - Static import works
import { MyModule } from '../../srv/lib/my-module';
```

### 4.3. SELECT.one Returns undefined, Not null

**Problem:** When testing DELETE, `SELECT.one` returns `undefined`, not `null`.

**Solution:** Use `toBeFalsy()` instead of `toBeNull()`:
```typescript
// ✅ Works for both null and undefined
expect(result).toBeFalsy();
```

---

## 5. Test Data Patterns

### 5.1. Unique Test Data

Always generate unique IDs to avoid test pollution:
```typescript
const createUniqueId = (prefix = 'test') => 
    `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
```

### 5.2. Cleanup Before Each Test

```typescript
beforeEach(async () => {
    const { MyEntity } = db.entities('my.namespace');
    try {
        await DELETE.from(MyEntity).where({ code: { like: 'TEST_%' } });
    } catch {
        // Ignore cleanup errors (table might be empty)
    }
});
```

---

## 6. Authorization Testing Pattern

### 6.1. Verify CDS Annotations via Source Files

Since `cds.model` is not always populated in test context, use source file inspection:

```typescript
test('service requires admin role', () => {
    const source = fs.readFileSync(servicePath, 'utf8');
    expect(source).toContain("requires: 'admin'");
});

test('entity is readonly', () => {
    const source = fs.readFileSync(servicePath, 'utf8');
    expect(source).toContain('@readonly');
});
```

---

## 7. Checklist for CAP Unit Tests

- [ ] Use `isolatedModules: true` in Jest config
- [ ] Convert paths to forward slashes for Windows
- [ ] Use explicit file arrays, not glob patterns
- [ ] Set `cds.root` before loading
- [ ] Use `sqlite::memory:` for fast in-memory testing
- [ ] Use static imports, not dynamic imports
- [ ] Generate unique test data to avoid pollution
- [ ] Clean up test data in `beforeEach`
- [ ] Use `toBeFalsy()` for null/undefined checks

---

## Related Documents

- [Testing Guidelines](../../guidelines/testing-guidelines.md)
- [Jest Configuration](../../../../jest.config.js)
