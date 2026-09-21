---
skill: Database Migration
description: How to safely modify the data model and update the database.
---

# 🛠️ Database Migration Skill

**Context:** Use this skill whenever you need to add entities, modify fields, or change relationships in `db/schema.cds`.

## 1. Schema Modification
- Edit `db/schema.cds` or relevant files in `db/`.
- **Constraint:** Always use `cuid` and `managed` aspects for new entities unless specified otherwise.
- **Constraint:** Field names should be `camelCase`. Entity names should be `PascalCase`.

## 2. Build CDS Models
Before deploying, ensure the CDS models are valid and built.
```bash
npm run build
```

## 3. Deployment (Local SQLite)
For local development, deploy to the pure SQLite file.
```bash
cds deploy --to sqlite:db/db.sqlite
```
> [!WARNING]
> This effectively resets the local database if `drop: true` is set (default behavior often re-creates tables). If preserving data is needed, check for existing CSVs in `db/data/`.

## 4. Deployment (BTP HANA)
If deploying to the cloud (Dev environment):
```bash
cf deploy mta_archives/archive_name.mtar
```
*Note: This usually handles schema evolution (HDI Container).*

## 5. Verification
- Open `db/schema.cds` and verify the syntax is error-free.
- Check that `db/db.sqlite` has been updated (timestamp).
