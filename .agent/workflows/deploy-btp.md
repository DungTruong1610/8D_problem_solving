---
description: Build and deploy CAP TypeScript application to SAP BTP Cloud Foundry
---

# CAP TypeScript: BTP Deployment

> [!IMPORTANT]
> Single workflow for all CAP TypeScript projects. Uses the standard architecture with pre-built artifacts.

> [!CAUTION]
> **ALWAYS clean `gen/` before building.** MTA packages `gen/srv/srv/` (pre-compiled JS + CSN), not source `.ts`/`.cds` files. Stale `gen/` = silently deploying old code.

## Quick Start (3 Commands)

// turbo-all
```bash
# 1. Clean and build
rm -rf gen mta_archives && npm ci && npm run build

# 2. Package MTA
mbt build

# 3. Deploy
cf deploy mta_archives/*.mtar
```

---

## Prerequisites

```bash
# Verify tools
node --version    # >=18
cf --version
mbt --version

# Login to Cloud Foundry
cf login -a https://api.cf.eu10.hana.ondemand.com
cf target  # Verify org/space
```

---

## Project Requirements Checklist

Before deploying, ensure your project follows these standards:

### 1. package.json
```json
{
  "scripts": {
    "build": "cds build --production",
    "build:cf": "npm run build && mbt build"
  },
  "cds": {
    "build": {
      "target": "gen",
      "tasks": [
        { "for": "hana", "src": "db" },
        { "for": "nodejs", "src": "srv" },
        { "for": "typescript", "options": { "tsconfig": "tsconfig.json" } }
      ]
    }
  }
}
```

### 2. CDS @impl Annotations
```cds
// ❌ WRONG
@impl: './service.ts'

// ✅ CORRECT
@impl: './service'
```

### 3. mta.yaml Module Paths
```yaml
modules:
  - name: my-app-srv
    type: nodejs
    path: gen/srv      # ← Must be gen/srv
    build-parameters:
      builder: npm     # ← Must be npm (not custom)

  - name: my-app-db-deployer
    type: hdb
    path: gen/db       # ← Must be gen/db
```

### 4. tsconfig.json Exclusions
```json
{
  "exclude": ["node_modules", "**/*.test.ts", "**/__tests__/**"]
}
```

### 5. Vector/Embedding Fields
```cds
// Exclude from OData projections
entity MyEntity as projection on db.MyEntity excluding { embeddingField };
```

---

## Detailed Steps

### Step 1: Clean Build
// turbo
```bash
rm -rf gen mta_archives
npm ci
```

### Step 2: CDS Production Build
// turbo
```bash
npm run build
```

Generates:
- `gen/db/` - HANA database artifacts
- `gen/srv/` - Compiled JavaScript + CDS models

### Step 3: Build MTA Archive
// turbo
```bash
mbt build
```

Output: `mta_archives/<app>_<version>.mtar`

### Step 4: Deploy to Cloud Foundry
```bash
cf deploy mta_archives/*.mtar
```

### Step 5: Verify Deployment
// turbo
```bash
cf apps
cf logs <app-name>-srv --recent
```

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot find module './xxx.ts'` | `@impl` has `.ts` extension | Remove `.ts` from `@impl` |
| TypeScript errors from tests | Tests in `srv/` compiled | Add to `tsconfig.json` exclude |
| OData type not supported | Vector field in projection | Exclude with `excluding { field }` |
| Service plan not found | Plan name varies by region | `cf marketplace -e <service>` |
| Application crashed | Check logs | `cf logs <app>-srv --recent` |

---

## Blue-Green Deployment (Zero Downtime)

For production with zero downtime:

```bash
cf deploy mta_archives/*.mtar --strategy blue-green
```

---

## Environment-Specific Deployments

Use extension files for different environments:

```bash
# Development
cf deploy mta_archives/*.mtar -e mta-extensions/dev.mtaext

# Production
cf deploy mta_archives/*.mtar -e mta-extensions/prod.mtaext
```
