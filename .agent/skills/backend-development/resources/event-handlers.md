# ⚡ Event Handlers & Request Pipeline

This guide covers advanced patterns for intercepting and handling SAP CAP requests, with a focus on **Drafts** and **Event Sequences**.

## 1. The Draft Handling Pitfall (READ)

When an entity is `@odata.draft.enabled`, CAP generates a separate `Entity.drafts` entity set.

**The Problem:**
Standard `this.srv.after('READ', 'MyEntity', ...)` handlers **MAY NOT FIRE** for:
1.  Draft-specific endpoints (e.g., editing a draft).
2.  Complex `$expand` queries where CAP optimizes the read path.

**The Solution:**
You often need to explicitly register handlers for the `.drafts` entity set or use a more aggressive interception pattern.

### Pattern A: Explicit Draft Registration (Recommended)
Register the handler for both the main entity and its draft counterpart.

```typescript
// Register for both Active and Draft entities
this.srv.after('READ', 'RequestTypes', this.enrichResponse.bind(this));
this.srv.after('READ', 'RequestTypes.drafts', this.enrichResponse.bind(this));

private async enrichResponse(results: any[], req: cds.Request) {
    // Logic handles both array (list) and single object (by ID)
    const items = Array.isArray(results) ? results : [results];
    // ... enrichment logic ...
}
```

### Pattern B: The Wrapper Pattern (Aggressive)
If `after` handlers are still being skipped (rare, but possible with deep optimization), wrap the READ event.

```typescript
this.srv.on('READ', 'RequestTypes', async (req, next) => {
    // 1. Let CAP perform the DB read
    const results = await next(); 
    
    // 2. Intercept and enrich MANUALLY
    if (results) {
        await this.enrichResponse(results);
    }
    
    return results;
});
```

---

## 2. Virtual Fields & expansions

When populating virtual fields (e.g., `ownerDisplayName`) based on `$expand` data:

1.  **Service Projection:** Ensure your Service Entity `projection` includes the navigation properties pointing to **Service Entities**, not DB entities.
    *   *Bad:* `steps : Composition of many db.StepDefinitions ...` (Returns raw DB rows, no virtuals)
    *   *Good:* `steps : Composition of many StepDefinitions ...` (Returns Service rows, virtuals exist)

2.  **Child Handlers:** `after('READ')` handlers on child entities (e.g., `StepDefinitions`) *should* fire during expand, but if they don't (due to drafts), use **Pattern A** on the **Parent** handler to manually iterate and enrich children.

```typescript
// Parent Handler (RequestTypes)
private async afterRead(items: any[]) {
    for (const item of items) {
        if (item.steps) {
            // Manually enrich children if Child Handler didn't fire
            await this.enrichSteps(item.steps);
        }
    }
}
```
