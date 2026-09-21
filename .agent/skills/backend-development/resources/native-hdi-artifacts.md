---
skill: Native HDI Artifacts
description: How to use native HANA artifacts when CDS annotations are insufficient.
---

# 🗄️ Native HDI Artifacts Skill

**Context:** Use this skill when you need advanced HANA features that CDS annotations don't support or don't reliably translate (e.g., composite indexes, full-text indexes, calculated columns).

## 1. When to Use Native HDI Artifacts

| Scenario | CDS Annotation | Reliable? | Recommendation |
|----------|----------------|-----------|----------------|
| Simple Index (single column) | `@cds.index` | ⚠️ Partial | Try CDS first, fall back to native |
| **Composite Index** | `@index: [{ key: ['col1', 'col2'] }]` | ❌ No | **Use native `.hdbindex`** |
| Full-Text Index | N/A | ❌ No | Use native `.hdbfulltextindex` |
| PAGE LOADABLE | `@sql.append: 'PAGE LOADABLE'` | ✅ Yes | CDS annotation works |
| Unique Constraint | `@assert.unique` | ✅ Yes | CDS annotation works |
| Calculated Column | N/A | ❌ No | Use native `.hdbcalculationview` |

> [!IMPORTANT]
> `@sql.append` appends raw SQL and works reliably. Use it for simple table options.
> Custom `@index` annotations are **not reliably translated** by the CDS compiler for HANA.

---

## 2. Directory Structure

Native HDI artifacts must be placed in `db/src/` (NOT `db/src/gen/`):

```
db/
├── schema.cds              # CDS entities
├── src/
│   ├── .hdiconfig          # Plugin configuration (required)
│   ├── myIndex.hdbindex    # Native index file
│   └── gen/                # ❌ DO NOT place files here (auto-generated)
```

**Why?**
- `cds build` reads from `db/src/` and writes to `gen/db/src/`
- Files in `db/src/gen/` are **ignored** by the build process
- Your native files are copied alongside generated files during deployment

---

## 3. Creating a Native Index (`.hdbindex`)

### Step 1: Ensure `.hdiconfig` exists in `db/src/`

If missing, create `db/src/.hdiconfig`:

```json
{
  "file_suffixes": {
    "hdbindex": {
      "plugin_name": "com.sap.hana.di.index"
    },
    "hdbfulltextindex": {
      "plugin_name": "com.sap.hana.di.fulltextindex"
    }
  }
}
```

### Step 2: Create the `.hdbindex` file

File: `db/src/cnma.clair2.ExtractionChangeLog_Index.hdbindex`

```sql
INDEX cnma_clair2_ExtractionChangeLog_Composite
  ON cnma_clair2_ExtractionChangeLog (parent_ID, objectIndex)
```

> [!CAUTION]
> **Table names use underscores, not dots!**
> - CDS Entity: `cnma.clair2.ExtractionChangeLog`
> - HANA Table: `cnma_clair2_ExtractionChangeLog`

### Step 3: Deploy

```bash
cds deploy --to hana --profile hybrid
```

Verify in deployment output:
```
added files: [
  "src/cnma.clair2.ExtractionChangeLog_Index.hdbindex"
]
...
Deploying "src/cnma.clair2.ExtractionChangeLog_Index.hdbindex"... ok
```

---

## 4. Naming Conventions

| File Type | Naming Pattern | Example |
|-----------|----------------|---------|
| Index | `<namespace>.<EntityName>_<Purpose>.hdbindex` | `cnma.clair2.ExtractionChangeLog_Index.hdbindex` |
| Full-Text | `<namespace>.<EntityName>_FT.hdbfulltextindex` | `cnma.clair2.DocumentUpload_FT.hdbfulltextindex` |

**Inside the file**, use the physical table name with underscores:
- ✅ `cnma_clair2_ExtractionChangeLog`
- ❌ `cnma.clair2.ExtractionChangeLog`

---

## 5. Common Errors & Solutions

### Error: "Could not find a .hdiconfig file"

**Cause:** Missing `.hdiconfig` in `db/src/`

**Fix:** Create `db/src/.hdiconfig` with the plugins you need (see Step 1).

---

### Error: "the file requires db://<table> which is not provided"

**Cause:** Index file in wrong location (`db/src/gen/`) or incorrect table name.

**Fix:**
1. Move file to `db/src/` (not `db/src/gen/`)
2. Use underscores in table name: `cnma_clair2_TableName`

---

### Index not appearing in HANA

**Cause:** File not included in build output.

**Check:** Look at `cds build` output for your file:
```
gen\db\src\your.hdbindex
```

If missing, the file is in the wrong location.

---

## 6. Difference: Index vs Unique Constraint

| Feature | Regular Index | `@assert.unique` |
|---------|---------------|------------------|
| Purpose | Query performance | Data integrity |
| Allows duplicates? | ✅ Yes | ❌ No |
| Use case | Filter/sort optimization | Prevent duplicate records |

**Example where Index is correct (not unique):**
```
ExtractionChangeLog: Multiple changes per document+object
- Change 1: supplierName at 10:00
- Change 2: deliveryDate at 10:01
- Change 3: supplierName at 10:05
All have same (parent_ID, objectIndex) → Index OK, Unique ❌
```

---

## 7. Reference: HDI Plugin Types

| Plugin | Suffix | Purpose |
|--------|--------|---------|
| `com.sap.hana.di.index` | `.hdbindex` | Regular indexes |
| `com.sap.hana.di.fulltextindex` | `.hdbfulltextindex` | Full-text search |
| `com.sap.hana.di.constraint` | `.hdbconstraint` | Custom constraints |
| `com.sap.hana.di.calculationview` | `.hdbcalculationview` | Calculation views |
| `com.sap.hana.di.sequence` | `.hdbsequence` | Sequences |

---

## 8. Quick Reference Checklist

- [ ] `.hdiconfig` exists in `db/src/` with required plugins
- [ ] Native artifact file is in `db/src/` (NOT `db/src/gen/`)
- [ ] Table name uses underscores: `namespace_EntityName`
- [ ] Index name is descriptive: `EntityName_Purpose`
- [ ] Run `cds deploy --to hana --profile hybrid` to deploy
- [ ] Verify file appears in build output under `gen/db/src/`
