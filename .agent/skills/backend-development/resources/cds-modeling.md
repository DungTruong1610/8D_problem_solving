---
skill: CDS Domain Modeling
description: Advanced data modeling and service design using SAP CAP CDS.
---

# 📐 CDS Domain Modeling Skill

**Context:** Use this skill when designing `db/schema.cds` or `srv/service.cds`.

## 1. Domain Modeling Standards
- **Reuse Types:** Always import from `@sap/cds/common`:
    ```cds
    using { cuid, managed, Currency, Country } from '@sap/cds/common';
    ```
- **UIDs:** Use `cuid` for technical keys (GUIDs). Avoid Integer IDs for business entities.
- **Naming:**
    - Entities: `PascalCase` and singular (e.g., `Invoice`, `Supplier`).
    - Elements: `camelCase` (e.g., `invoiceDate`, `totalAmount`).
    - Avoid context repetition (e.g., use `name` instead of `supplierName` inside `Supplier` entity).

## 2. Deep Structures (Compositions)
Use `Composition` for parent-child relationships to enable automatic deep-insert/delete.
```cds
entity Header : cuid, managed {
    items : Composition of many Item on items.parent = $self;
}
entity Item : cuid {
    parent : Association to Header;
}
```

## 3. Service Facades
Design services (`srv/`) as projections, not 1:1 mirrors of the DB.
- **Exposure:** Only expose what the UI/API needs.
- **Read-Only:** Use `@readonly` for reference data.
```cds
service AdminService {
    entity Invoices as projection on db.Invoices;
    @readonly entity Currencies as projection on common.Currencies;
}
```

## 4. Verification
- Run `cds compile srv/service.cds --to sql` to verify the generated views.
