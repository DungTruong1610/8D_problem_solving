# Deployment & DevOps Guidelines

**Version:** 2.0 (AI-Optimized)
**Status:** Approved
**Target Audience:** DevOps Engineers, AI Agents, Developers

---

## 1. SAP BTP Deployment (MTA)

### 1.1. MTA Descriptor (`mta.yaml`)
```yaml
_schema-version: '3.3'
ID: my-app
modules:
  - name: my-app-srv      # Nodejs CAP service
    requires:
      - name: my-app-db
      - name: my-app-xsuaa
  - name: my-app-db-deployer
  - name: my-app-app      # Frontend build
resources:
  - name: my-app-db       # HANA HDI Container
  - name: my-app-xsuaa    # Auth service
```

### 1.2. CLI Commands
- **Build**: `mbt build`
- **Deploy**: `cf deploy mta_archives/my-app_1.0.0.mtar`

---

## 2. Configuration Management

### 2.1. Environment Variables
Store secrets in **Azure Key Vault** or **SAP BTP Service Keys**.
```javascript
// Accessing via process.env
const apiKey = process.env.SERVICE_API_KEY;
```

### 2.2. Local Development
Use `.env.local` for local secrets. **NEVER COMMIT THIS FILE.**

---

## 3. Environment Strategy

| Environment | Database | Auth | Deployment |
|-------------|----------|------|------------|
| **Local** | SQLite | Mocked | Manual |
| **Dev** | HANA (Shared) | XSUAA | Auto (Merge to `develop`) |
| **Staging** | HANA (Ded.) | XSUAA | Manual Approval |
| **Production** | HANA (Ded.) | XSUAA | Manual Approval |

---

## 4. CI/CD Pipeline (Azure DevOps)

- **Stage: Build**: Install deps, build artifacts, run tests.
- **Stage: DeployDev**: Deploy to BTP Dev space on `develop` branch merge.
- **Stage: DeployProd**: Deploy to BTP Prod space on `main` branch merge (with approval).

---

## 5. Monitoring & Logging

- **Log Levels**: Use `ERROR` for failures, `INFO` for business events, `DEBUG` for dev only.
- **Instrumentation**: Use Application Insights for telemetry in production.

---

## 6. Rollback Procedure

1. **Identify**: Check logs for errors.
2. **Immediate**: Re-deploy previous known-good MTA archive.
3. **Database**: Roll back schema changes if necessary (destructive).
   `cf undeploy my-app`

---

## 7. Health Checks

Implement a `/health` endpoint in the service to verify:
- Database connectivity.
- External API availability (AI Core, S/4).
- Storage/Filesystem status.

---

## 8. Deployment Checklist

- [ ] CI tests passed.
- [ ] Variables configured in target space.
- [ ] Database migrations tested.
- [ ] Rollback plan ready.
- [ ] Post-deployment smoke tests ready.
