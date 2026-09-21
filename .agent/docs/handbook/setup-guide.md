# New Antigravity Project Setup Guide

**Version:** 1.0
**Estimated Time:** 30-45 minutes

---

## Prerequisites

- [ ] Node.js 20+ installed
- [ ] SAP CAP CLI installed (`npm i -g @sap/cds-dk`)
- [ ] Git configured with your credentials
- [ ] Access to Antigravity standards repository

---

## Step 1: Initialize Project

### Backend (SAP CAP)

```bash
# Create new CAP project
cds init my-app --add typescript,hana

cd my-app

# Install dependencies
npm install
```

### Frontend (React + TypeScript)

```bash
# Create frontend app
mkdir -p app
cd app
npm create vite@latest frontend -- --template react-ts

cd frontend

# Install Antigravity standard dependencies
npm install tailwindcss @tailwindcss/vite lucide-react framer-motion clsx tailwind-merge react-router-dom axios
```

---

## Step 2: Install Antigravity Agents

Instead of copying files manually, we install the Agent Team as a **Submodule**. This keeps your project linked to the latest standards.

```bash
# In project root
git submodule add git@ssh.dev.azure.com:v3/conarumdc/cdk/cap-agent-team .agent

# Initialize
git submodule update --init --recursive
```

### What just happened?
*   You now have a `.agent/` folder.
*   The **AI Rules** are in `.agent/rules/`.
*   The **Skills** are in `.agent/skills/`.
*   The **Agent Roster** is in `.agent/general concepts/`.

**Note:** You do NOT need to copy these files into `docs/`. The Agent will read them directly from `.agent/`.

---

## Step 3: Application Configuration

Bootstrap your project with standard configs from the `.agent` submodule.

```bash
# Backend (Root)
cp .agent/templates/config/.eslintrc.js .
cp .agent/templates/config/.prettierrc .
cp .agent/templates/config/tsconfig.json .

# Frontend (if React)
cp .agent/templates/config/.eslintrc.js app/frontend/
```

### Update `package.json`
Add these standard scripts to your `package.json`:
```json
{
  "scripts": {
    "start": "cds-serve",
    "watch": "cds-ts watch",
    "build": "cds build --production",
    "lint": "eslint srv/**/*.ts",
    "test": "jest"
  }
}
```

---

## Step 4: Project Structure

Create the standard folder structure:

```bash
# Backend
New-Item -ItemType Directory -Path "srv\handlers" -Force
New-Item -ItemType Directory -Path "srv\lib\processors" -Force
New-Item -ItemType Directory -Path "srv\lib\actions" -Force
New-Item -ItemType Directory -Path "srv\lib\utils" -Force
New-Item -ItemType Directory -Path "tests" -Force

# Data
New-Item -ItemType Directory -Path "db\data" -Force
```

Your structure should look like:

```
my-app/
├── .agent/
│   └── rules/           # ← AI enforcement rules
├── docs/                # ← Reference guidelines
├── app/
│   └── frontend/        # ← React + TypeScript + Tailwind
├── db/
│   ├── schema.cds
│   └── data/
├── srv/
│   ├── service.cds
│   ├── service.ts
│   ├── handlers/
│   └── lib/             # ← Service business logic
│       ├── processors/
│       ├── actions/
│       └── utils/
└── tests/
```

---

## Step 5: Initialize Git Repository

```bash
# Initialize Git
git init

# Create .gitignore
@"
node_modules/
gen/
.cdsrc-private.json
*.db
.env
.agent/
"@ | Out-File -FilePath .gitignore -Encoding utf8

# Create initial commit
git add .
git commit -m "feat: initial project setup with Antigravity standards"

# Create develop branch
git checkout -b develop

# Connect to Remote (Azure DevOps)
# REPLACE WITH YOUR REPO URL!
git remote add origin git@ssh.dev.azure.com:v3/conarumdc/cdk/my-app
git push -u origin main
```

---

## Step 6: First Entity (Hello World)

Create a sample entity following CAP standards:

### db/schema.cds

```cds
namespace com.company.myapp;

using { cuid, managed } from '@sap/cds/common';

entity Products : cuid, managed {
    name        : String(100);
    description : String(500);
    price       : Decimal(10,2);
    status      : String enum { Active; Inactive; } default 'Active';
}
```

### srv/service.cds

```cds
using { com.company.myapp as db } from '../db/schema';

service CatalogService {
    entity Products as projection on db.Products;
}
```

### srv/service.ts

```typescript
import cds from '@sap/cds';

export class CatalogService extends cds.ApplicationService {
    async init() {
        const { Products } = this.entities;
        
        this.before('CREATE', Products, (req) => {
            console.log('Creating product:', req.data.name);
        });
        
        return super.init();
    }
}
```

---

## Step 7: Verification

### Backend

```bash
# Generate types
npx cds-typer "*" --outputDirectory @types/cds

# Run server
npm start

# Verify: http://localhost:4004
# Should see Catalog Service with Products entity
```

### Frontend

```bash
cd app/frontend

# Start dev server
npm run dev

# Verify: http://localhost:5173
```

---

## Step 8: Setup Testing

```bash
# Install testing dependencies
npm install --save-dev jest @types/jest ts-jest

# Create jest.config.js
@"
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts']
};
"@ | Out-File -FilePath jest.config.js -Encoding utf8

# Run tests
npm test
```

---

## Step 9: Documentation

Update project README:

```markdown
# My App

## Quick Start

\`\`\`bash
npm install
npm start
\`\`\`

## Standards

This project follows [Antigravity Development Standards](./docs/).

- Backend: See [Backend Guidelines](./docs/backend-guidelines.md)
- Frontend: See [Design Guidelines](./docs/design-guidelines.md)
- Git: Follow [Git Workflow](./docs/git-workflow-guidelines.md)
```

---

## Step 10: CI/CD Setup (Optional)

If using Azure DevOps, copy `azure-pipelines.yml` from reference project.

---

## Checklist Summary

- [ ] CAP project initialized
- [ ] Frontend (React + TypeScript + Tailwind) created
- [ ] Global rules copied to `.agent/rules/`
- [ ] Documentation copied to `docs/`
- [ ] Configuration files copied
- [ ] Project structure created
- [ ] Git repository initialized with GitFlow
- [ ] Sample entity created and tested
- [ ] Testing framework configured
- [ ] README updated

---

## Next Steps

1. **Define Your Domain Model** in `db/schema.cds`
2. **Create Services** following `backend-guidelines.md`
3. **Build UI** following `design-guidelines.md`
4. **Implement Dynamic Workflows** using `status-action-concept.md`

---

## Getting Help

- **Standards Questions**: Check `docs/` folder
- **CAP Patterns**: See `backend-guidelines.md`
- **UI Components**: See `design-guidelines.md`
- **AI Assistant**: Just ask! The rules in `.agent/rules/` will guide me.

---

**Welcome to the Antigravity ecosystem! 🚀**
