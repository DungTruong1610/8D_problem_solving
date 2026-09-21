---
description: Build the Multi-Target Application (MTA) archive for deployment
---

# MTA Build Workflow

This workflow builds the complete MTA archive for deploying to SAP BTP Cloud Foundry.

## Prerequisites
- Node.js 18+ installed
- MTA Build Tool (`mbt`) installed globally: `npm install -g mbt`
- Cloud Foundry CLI with MTA plugin (for deployment)

---

## Build Steps

> [!CAUTION]
> **ALWAYS clean `gen/` before building.** The MTA packager uses pre-compiled output from `gen/srv/srv/` (compiled `.js` + `csn.json`), NOT the source `.ts`/`.cds` files. If `gen/` is stale, your code changes will be **silently not deployed**. This has caused production issues where backend fixes appeared to have no effect.

1. **Clean Previous Build Artifacts (MANDATORY)**
   Remove old build output to prevent deploying stale code.
   // turbo
   ```bash
   npx rimraf gen mta_archives *.mtar
   ```

2. **Install Root Dependencies**
   Install backend CAP dependencies.
   // turbo
   ```bash
   npm ci
   ```

3. **Install App Dependencies**  
   Install React frontend dependencies.
   // turbo
   ```bash
   cd app && npm ci && cd ..
   ```

4. **Build React App**
   Compile the frontend for production.
   // turbo
   ```bash
   npm run build --prefix app
   ```

5. **Build CDS Artifacts**
   Generate production CDS artifacts (srv, db folders).
   // turbo
   ```bash
   npx cds build --production
   ```

6. **Build MTA Archive**
   Compile everything into the deployable MTAR file.
   // turbo
   ```bash
   mbt build -t . --mtar mta-activity-management.mtar
   ```

7. **Validate Output**
   Verify the MTAR file was created successfully.
   // turbo
   ```bash
   dir mta-activity-management.mtar
   ```

---

## Deployment (Optional)

After successful build, deploy to Cloud Foundry:

```bash
cf login -a <api-endpoint>
cf deploy mta-activity-management.mtar
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `mbt: command not found` | Run `npm install -g mbt` |
| `cds build` fails | Check `package.json` cds configuration |
| Missing HTML5 artifacts | Ensure `app/dist` exists after `npm run build` |
| HANA deployment fails | Verify HDI container permissions in BTP |
| Code changes not taking effect after deploy | **Delete `gen/` and rebuild.** MTA packages `gen/srv/srv/` (pre-compiled JS + CSN), not source files. Stale `gen/` = stale deployment. |
| New CDS functions return 404 | Same as above — `gen/srv/srv/csn.json` must be regenerated to include new function definitions |
| Srv crashes after deploy | Check `cf logs <app>-srv --recent` for the exact error line in the compiled `server.js` |
