---
description: Generates comprehensive documentation suite using the standardized category structure
---

# Generate Standard Documentation

This workflow generates a complete documentation suite organized by audience (Product, Business, Technical, Project, Releases).

> **IMPORTANT:** All subfolders and files use number prefixes (01-, 02-, etc.) to control display order in the Wiki and file explorer.

## Prerequisites

- Run `/init-docs` first if the structure doesn't exist
- Have access to `package.json`, `schema.cds`, and project source files

---

## Naming Convention

All files and folders use number prefixes for ordering:

| Prefix | Meaning |
|--------|---------|
| `01-` | First item |
| `02-` | Second item |
| `99-` | Last item (FAQ, troubleshooting) |

**Example:** `01-getting-started.md`, `02-quick-start.md`, `99-faq.md`

---

## Steps

### 1. Analyze Project

Read and understand the project:
- `package.json` - Dependencies, scripts, project name
- `db/schema.cds` or equivalent - Data model, entities
- `srv/` - Backend services and handlers
- `app/` - Frontend structure
- Existing docs in `docs/archive/` for reference

### 2. Generate Product Documentation

Create files in `docs/product/`:

| File | Content |
|------|---------|
| `01-introduction.md` | Product overview |
| `02-getting-started.md` | User-friendly introduction |
| `03-quick-start.md` | 5-minute getting started guide |
| `04-user-manual/` | Feature-by-feature guides |
| `05-security/` | Security and roles for users |
| `06-admin-guide/` | Administrator documentation |
| `99-faq.md` | Frequently asked questions |

### 3. Generate Business Documentation

Create files in `docs/business/`:

| File | Content |
|------|---------|
| `01-process-flows/` | Mermaid flowcharts for key workflows |
| `02-roles-permissions.md` | Role matrix and capabilities |
| `03-data-dictionary.md` | Entity definitions in plain language (NO code) |

### 4. Generate Technical Documentation

Create files in `docs/technical/`:

#### Architecture (`docs/technical/01-architecture/`)
| File | Content |
|------|---------|
| `01-overview.md` | System overview, tech stack, high-level Mermaid diagram |
| `02-workflow.md` | State machines, status flows (if applicable) |
| `03-data-flow.md` | Sequence diagrams showing data movement |
| `04-security-layers.md` | Security architecture |

#### Implementation (`docs/technical/02-implementation/`)
| File | Content |
|------|---------|
| `01-getting-started.md` | Prerequisites, installation, running locally |
| `02-project-structure.md` | Tree view of folders with descriptions |
| `03-backend-handoff.md` | API documentation for frontend team |
| `04-ui-guide.md` | Frontend specifics: components, routing, state |
| `05-adding-features.md` | Step-by-step guide for common extensions |

#### Testing (`docs/technical/03-testing/`)
| File | Content |
|------|---------|
| `01-overview.md` | Testing strategy overview |
| `02-uat-scenarios.md` | User acceptance test scenarios |
| `03-backend-test-report.md` | Backend test results |
| `04-frontend-test-report.md` | Frontend test results |

#### Reference (`docs/technical/04-reference/`)
| File | Content |
|------|---------|
| `01-core-components.md` | Backend entities and domain model |
| `02-api-reference.md` | API/OData endpoints with examples |
| `03-configuration.md` | Environment variables, security, roles |
| `04-component-reference.md` | Reusable UI component docs |

#### Other
| File | Content |
|------|---------|
| `99-troubleshooting.md` | Common errors and fixes |

### 5. Generate Project Documentation

Create files in `docs/project/`:

| File | Content |
|------|---------|
| `01-roadmap.md` | Feature roadmap by quarter |
| `02-backlog.md` | Prioritized feature list |
| `03-sprints/` | Sprint documentation (if applicable) |
| `04-decisions/` | Architecture Decision Records (ADRs) |

### 6. Update Index Files

Ensure all category `README.md` files link to the generated content:
- `docs/README.md`
- `docs/product/README.md`
- `docs/business/README.md`
- `docs/technical/README.md`
- `docs/project/README.md`

### 7. Sync to Wiki

If using the Wiki feature, run:

```powershell
cd app/request-management
node scripts/sync-docs.mjs
```

This syncs `docs/` to `public/docs/` and generates `docs-manifest.json`.

---

## Verification Checklist

- [ ] All files use number prefixes (01-, 02-, etc.)
- [ ] All `README.md` index files have valid links
- [ ] Technical docs have working code samples
- [ ] Business docs have NO code samples
- [ ] Mermaid diagrams render correctly
- [ ] Root README links to new structure
- [ ] No broken internal links
- [ ] Wiki displays correctly (run sync-docs)
