---
name: cnma-devops-init-btp-cf
description: Scaffold BTP Cloud Foundry deployment files for CNMA CAP projects.
  TRIGGER when user says "init cf", "setup cf deployment", "add devops files",
  "prepare btp deploy", "add mta.yaml", "add Jenkinsfile", "setup pipeline",
  "cnma-devops-init-btp-cf", "devops init", or wants CF/BTP deployment scaffolding
  for a CNMA CAP Node.js project. Generates mta.yaml, xs-security.json,
  .deploycfg/, .pipeline/config.yml, Jenkinsfile, package.json deploy scripts,
  .cfignore, .npmrc, mta_archives/ for BTP CF deployment.
argument-hint: "[project-name] [--type full|srv-only|no-ui] [--objectstore] [--aicore]"
---

# cnma-devops-init-btp-cf

Scaffold production-ready BTP CF deployment files for CNMA CAP projects following Conarum conventions.

## Usage
```
/cnma-devops-init-btp-cf [project-name] [--type full|srv-only] [--objectstore] [--aicore]
```

**Types:**
- `full` (default) — DB + SRV + UI + UIDeployer + DestinationContent
- `srv-only` — DB + SRV + DestinationContent (no HTML5 modules)

**Flags:**
- `--objectstore` — add Object Store (S3) resource + SRV binding
- `--aicore` — add AI Core resource + SRV binding

## Process

### Step 1 — Gather context

If arguments incomplete, ask:
1. Project name (e.g. `ai_doc` → prefixes: `cnma_ai_doc`, `cnma-ai-doc`, `cnma.ai.doc`)
2. Type: `full` or `srv-only`
3. Uses Object Store? (S3/file upload)
4. Uses AI Core? (LLM/embedding)

Also read existing files to understand current state (do NOT overwrite if already correct):
- `mta.yaml` — check what modules/resources already exist
- `package.json` — read scripts to MERGE (never overwrite name/version/dependencies)
- `xs-security.json` — preserve existing scopes if present

### Step 2 — Derive identifiers

From project name `ai_doc`:
| Variable | Value | Use |
|----------|-------|-----|
| `APP_UNDERSCORE` | `cnma_ai_doc` | MTA ID, resource names, module names |
| `APP_HYPHEN` | `cnma-ai-doc` | xsappname, destination names, deploycfg |
| `APP_DOT` | `cnma.ai.doc` | sap.cloud.service |
| `APP_UPPER` | `AI_DOC` | Jenkins env var: `DEPLOY_TARGET_AI_DOC` |
| `MTAR` | `cnma_ai_doc_1.0.0.mtar` | build output |

### Step 3 — Generate files

Load references as needed, substitute variables, write files:

| File | Reference | Action |
|------|-----------|--------|
| `mta.yaml` | `references/mta-yaml-template.md` | CREATE or UPDATE |
| `xs-security.json` | `references/xs-security-template.md` | CREATE or UPDATE (preserve existing scopes) |
| `package.json` scripts block | `references/package-scripts-template.md` | MERGE into existing |
| `.deploycfg/{{APP_HYPHEN}}.json` | `references/deploycfg-template.md` | CREATE |
| `.deploycfg/cpea.mtaext` | `references/deploycfg-template.md` | CREATE |
| `.deploycfg/payg.mtaext` | `references/deploycfg-template.md` | CREATE |
| `.pipeline/config.yml` | `references/pipeline-files-template.md` | CREATE |
| `Jenkinsfile` | `references/pipeline-files-template.md` | CREATE |
| `.cfignore` | inline | CREATE if missing |
| `.npmrc` | inline | CREATE if missing |
| `mta_archives/.gitkeep` | inline | CREATE dir + placeholder |

### Step 4 — Report

List all files created/updated. Remind user:
- `npm install` if rimraf not in devDependencies
- Set Jenkins env var `DEPLOY_TARGET_{{APP_UPPER}}` pointing to deploy config API
- Set Jenkins env var `CONARUM_TEAM_WEBHOOK_NOTIFICATION` for Teams notifications
- Run `mbt validate` to verify mta.yaml

## Constraints
- **MERGE not overwrite** for `package.json` — only add missing scripts/cds config keys
- **Idempotent** — check file exists before creating; skip if already correct
- **CNMA scope convention** — `CNMA_<APP>_READ`, `CNMA_<APP>_WRITE`, `CNMA_CUST_ADMIN`, `CNMA_CUST_SUPER_ADMIN`
- **SRV memory** — always 1024M / 2048M disk / cflinuxfs4 stack
- **DB** — always no-route, no-start, hdi-deploy task
