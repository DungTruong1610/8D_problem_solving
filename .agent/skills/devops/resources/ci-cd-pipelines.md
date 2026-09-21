---
skill: CI/CD Pipeline Automation
description: Designing and managing automated build and deployment pipelines.
---

# 🔄 CI/CD Pipeline Skill

**Context:** Use this skill when modifying `.github/workflows` or `azure-pipelines.yaml`.

## 1. The Standard Pipeline Flow
Every pipeline must verify "The 4 Gates":
1.  **Dependencies:** `npm ci` (Clean Install). Never use `npm install` in CI.
2.  **Quality:** `npm run lint` + `npm run test` (Unit).
3.  **Build:** `mbt build` (Generates the `.mtar` artifact).
4.  **Deploy:** `cf deploy` (Only on `develop` or `main` branches).

## 2. Cloud Foundry CLI Automation
Scripting the deployment:
- **Login:** Use a service user with `SpaceDeveloper` role.
- **Target:** `cf target -o <Org> -s <Space>`.
- **Deploy:** `cf deploy <file>.mtar -f` (Force to avoid prompts).

## 3. Secret Management
- **Rule:** NEVER put credentials in the pipeline file.
- **Solution:** Use Repository Secrets (`$BTP_PASSWORD`, `$BTP_API`).

## 4. Release Strategy
- **Feature Branches:** Run Gates 1-2 (Deps, Quality).
- **Develop Branch:** Run Gates 1-4 (Deploy to `DEV`).
- **Main Branch:** Run Gates 1-4 (Deploy to `PROD` with manual approval).
