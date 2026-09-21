# 📋 10 Essential SAP CAP Workflows

This document defines the standard operating procedures for an SAP Cloud Application Programming Model (CAP) project.

---

## 1. 🐣 Project Initialization (The Birth)
*Goal: Start a clean project with all best practices pre-configured.*
1.  **Scaffold**: Run `cds init <project-name> --add mta, pipeline, hana, xsuaa`.
2.  **Linting**: Install ESLint + Prettier + Husky (`npm install ...`).
3.  **Agents**: Copy `.agent/` folder from the template.
4.  **Git**: `git init`, `git add .`, `git commit -m "chore: initial commit"`.

## 2. 🏗️ Feature Development (The Daily Grind)
*Goal: Add a new feature safety.*
1.  **Branch**: `git checkout -b feature/<feature-name>`.
2.  **Schema**: Modify `db/schema.cds`. Validate with `cds compile db/`.
3.  **Deploy Local**: Run `cds deploy --to sqlite` to update local DB.
4.  **Service**: Update `srv/service.cds` and `srv/handlers/`.
5.  **Test**: Add Unit Test -> Run `npm test`.

## 3. 💾 Database Migration (The Schema Evolution)
*Goal: Update the database without losing data.*
1.  **Check**: Compare local model vs. deployed DB.
2.  **Generate**: Run `cds build` to generate HDBCDS artifacts.
3.  **Deploy (Local)**: `cds deploy --to sqlite`.
4.  **Deploy (HANA)**: Run `cf deploy gen/db --no-start` (Hybrid testing) or push via MTA.

## 4. 🌱 Data Seeding (The Population)
*Goal: Fill the DB with realistic test data.*
1.  **CSV**: Create `db/data/my.namespace-Entity.csv`.
2.  **Mock**: Use `cds-mock-data` (optional) for large volumes.
3.  **Apply**: Run `cds deploy`. The CSVs are automatically loaded.
4.  **Verify**: Check via `sqlite3` or CAP `orders.http` request.

## 5. 🔌 External Service Integration (The Handshake)
*Goal: Connect to S/4HANA or a 3rd Party API.*
1.  **Import**: Get the `$metadata` (EDMX) file.
2.  **Import Command**: `cds import s4hana-api.edmx`.
3.  **Mock**: Run `cds run`. The external service is automatically mocked locally.
4.  **Connect**: Configure `package.json` -> `cds.requires` -> `credentials`.

## 6. 🛡️ Security Setup (The Gatekeeper)
*Goal: Secure the endpoints with XSUAA.*
1.  **Config**: Update `xs-security.json` with Scopes and RoleTemplates.
2.  **BTP Service**: Run `cf create-service xsuaa application my-app-uaa -c xs-security.json`.
3.  **Bind**: Update `mta.yaml` to bind `srv` to `uaa`.
4.  **Annotations**: Add `@(requires: 'authenticated-user')` to CDS services.

## 7. 🧪 End-to-End Testing (The Exam)
*Goal: Verify the full stack works.*
1.  **Env**: Ensure Local Server is running (`npm start`) or deploy to Dev space.
2.  **Auth**: Get a valid JWT Token (mocked or real).
3.  **Run**: Execute Playwright/k6 scripts.
4.  **Report**: Check the HTML test report for failures.

## 8. 📦 MTA Build & Assembly (The Packaging)
*Goal: Create the deployment artifact.*
1.  **Build**: Run `mbt build -t gen --mtar mta.tar`.
2.  **Validate**: Check `gen/` folder structure (db, srv, app).
3.  **Artifact**: The `.mtar` file is ready in `gen/`.

## 9. 🚀 Blue/Green Deployment (The Launch)
*Goal: Deploy with zero downtime.*
1.  **Deploy**: `cf deploy gen/mta.tar --strategy blue-green`.
2.  **Verify**: The "Idle" (Green) app is started. Run smoke tests on the idle route.
3.  **Switch**: If healthy, BTP switches the routes. Old "Blue" app is stopped.

## 10. 🧹 Clean Core Maintenance (The Housekeeping)
*Goal: Ensure no technical debt accumulates.*
1.  **Audit**: Run `npm run lint` and `npm audit`.
2.  **Dependencies**: Update `package.json` deps (`@sap/cds`, `react`).
3.  **Prune**: Remove unused CDS entities or exported types.
4.  **Restart**: Bounce the servers to clear memory leaks.
