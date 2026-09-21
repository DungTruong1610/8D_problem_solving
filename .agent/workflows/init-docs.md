---
description: Initialize standardized documentation structure for a new project
---

# Initialize Documentation Structure

This workflow creates the standardized documentation directory structure for new projects.

> **Note:** All folders use number prefixes (01-, 02-, etc.) to ensure consistent ordering in file explorers and the Wiki sidebar.

// turbo-all

## Steps

### 1. Copy Template to Project

```powershell
Copy-Item -Recurse -Force ".agent/templates/docs-template/*" "docs/"
```

### 2. Rename Folders (Remove Product Prefix)

The template uses prefixes like `01-product`. For the root docs folder:
- Keep the numbering for subfolders
- Rename `01-product` → `product`, `02-business` → `business`, etc.

```powershell
cd docs
Rename-Item "01-product" "product"
Rename-Item "02-business" "business"
Rename-Item "03-technical" "technical"
Rename-Item "04-project" "project"
Rename-Item "05-releases" "releases"
```

### 3. Replace Placeholders

Search and replace in all `docs/` files:
- `{{PROJECT_NAME}}` → Your project name
- `{{DATE}}` → Current date (YYYY-MM-DD)

### 4. Create Root README

Create `docs/README.md` with this template:

```markdown
# [Project Name] - Documentation

> **Last Updated:** [DATE] | **Owner:** Project Team

## 📚 Documentation Categories

| Category | Audience | Purpose |
|----------|----------|---------|
| [**Product**](./product/README.md) | End Users | How to use |
| [**Business**](./business/README.md) | BA Team | Process flows |
| [**Technical**](./technical/README.md) | Developers | Architecture, API |
| [**Project**](./project/README.md) | Internal | Roadmap, sprints |
| [**Releases**](./releases/README.md) | All | Changelog |
```

### 5. Verify Structure

Expected folder structure after init:

```
docs/
├── README.md
├── product/              # End-user documentation
│   ├── README.md
│   ├── 04-user-manual/
│   └── 06-admin-guide/
├── business/             # Business processes
│   ├── README.md
│   └── 01-process-flows/
├── technical/            # Developer docs
│   ├── README.md
│   ├── 01-architecture/
│   ├── 02-implementation/
│   ├── 03-testing/
│   └── 04-reference/
├── project/              # Project management
│   ├── README.md
│   └── 04-decisions/
└── releases/             # Changelog
    └── CHANGELOG.md
```

---

## Verification

- [ ] All directories created with number prefixes in subfolders
- [ ] All README files have content
- [ ] CHANGELOG.md exists in releases/
- [ ] Structure matches expected layout
