# Type Sharing Between Backend (srv) and Frontend (app)

**Version:** 2.0  
**Status:** Approved  
**Purpose:** Ensure TypeScript types generated from CDS schema are shared between backend and frontend to maintain type safety and eliminate duplication.

---

## The Problem

When using SAP CAP with TypeScript:
- `cds-typer` generates types in `@cds-models/` from `schema.cds`
- The frontend app (React) is a separate npm project in `app/`
- Without configuration, frontend cannot import from `@cds-models/`

This leads to:
- ❌ Type drift (schema changes not reflected in UI)
- ❌ Maintenance burden (update in multiple places)
- ❌ Runtime errors from mismatched types

---

## Recommended Approach: Direct Import via Path Alias

Configure the frontend's TypeScript and Vite to resolve `#cds-models/*` to the root `@cds-models/` folder.

### Step 1: Configure tsconfig.json

```json
// app/request-management/tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "#cds-models/*": ["../../@cds-models/*"]
    }
  }
}
```

Also add to `tsconfig.app.json` if using project references.

### Step 2: Configure vite.config.ts

```typescript
// app/request-management/vite.config.ts
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "#cds-models": path.resolve(__dirname, "../../@cds-models"),
    },
  },
})
```

### Step 3: Import in Frontend Code

```typescript
// Now you can import directly from @cds-models!
import { Requests } from '#cds-models/_';
import { RequestStatus } from '#cds-models/sap/cre';
```

---

## Important Considerations

### @cds-models is Gitignored

The `@cds-models/` folder is regenerated on each machine. This means:
- Every developer must run `npm run build:types` after cloning
- CI/CD pipelines must run `npm run build:types` before building frontend

### When Schema Changes

```bash
# After modifying schema.cds:
npm run build:types    # Regenerates @cds-models/
# Frontend automatically picks up new types (TypeScript will show errors if breaking)
```

---

## NPM Scripts

Add these to root `package.json` (included in template):

```json
{
  "devDependencies": {
      "concurrently": "^9"
  },
  "scripts": {
    "build:types": "cds-typer \"*\" --outputDirectory @cds-models",
    "watch:types": "cds-typer \"*\" --outputDirectory @cds-models --watch",
    "dev": "concurrently \"npm run watch:types\" \"cds-watch\""
  }
}
```

With this setup, running `npm run dev` will:
1. Start the CAP server (via `cds-watch` which handles server restarts)
2. Start the Type Generator in watch mode (updates `@cds-models` on schema change)

**No manual refresh needed!**

---

## Fallback: Curated srv/types.ts

If `@cds-models` types are too complex or include CAP runtime dependencies, create a curated subset:

```
schema.cds → cds-typer → @cds-models/ (full types, for srv)
                       ↘
                         srv/types.ts (curated enums/interfaces)
                       ↘
                         app/*/src/types/schema.ts (synced copy)
```

Use `scripts/sync-types.js` to copy `srv/types.ts` to frontend.

---

## Quick Reference

| Import Pattern | Use For |
|----------------|---------|
| `#cds-models/_` | Entity types (Requests, Steps, etc.) |
| `#cds-models/sap/cre` | Namespace-specific types |
| `@/types` | Frontend-specific types |
| `@/types/schema` | Synced backend types (fallback) |

---

## Anti-Patterns to Avoid

❌ **Don't** manually define enums in frontend that duplicate `schema.cds`  
❌ **Don't** hardcode status/priority values in components  
❌ **Don't** forget to run `build:types` after schema changes  

✅ **Do** import from `#cds-models` when possible  
✅ **Do** run `npm run build:types` after cloning or schema changes  
✅ **Do** add `build:types` to CI/CD pipeline
