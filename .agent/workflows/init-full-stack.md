---
description: Initialize a complete SAP CAP + React full-stack project with Antigravity standards
---

// turbo-all

# Phase 1: Backend (CAP)

1.  **Scaffold CAP Project**
    ```bash
    cds init --add mta,pipeline,hana,xsuaa
    ```

2.  **Install CAP Dependencies**
    ```bash
    npm install
    ```

3.  **Apply Antigravity Backend Config**
    ```bash
    npm install --save-dev eslint prettier eslint-config-prettier husky lint-staged
    cp .agent/templates/config/.eslintrc.js .
    cp .agent/templates/config/.prettierrc .
    cp .agent/templates/config/tsconfig.json .
    ```

4.  **Create Backend Structure**
    ```bash
    mkdir -p srv/handlers srv/lib/processors srv/lib/actions srv/lib/utils tests db/data
    ```

5.  **Setup Jest for Backend**
    ```bash
    npm install --save-dev jest @types/jest ts-jest
    echo "module.exports = { preset: 'ts-jest', testEnvironment: 'node', testMatch: ['**/tests/**/*.test.ts'] };" > jest.config.js
    ```

---

# Phase 2: Frontend (React + shadcn/ui)

6.  **Create React App**
    ```bash
    mkdir -p app
    cd app
    npm create vite@latest request-management -- --template react-ts
    cd request-management
    npm install
    ```

7.  **Initialize shadcn/ui**
    ```bash
    npx shadcn@latest init -y
    npx shadcn@latest add button card dialog input select tabs switch tooltip label
    ```

8.  **Install Full Stack Dependencies**
    ```bash
    npm install @tanstack/react-query zustand axios react-router-dom
    npm install react-hook-form zod @hookform/resolvers
    npm install react-i18next i18next
    npm install framer-motion lucide-react
    ```

9.  **Copy Antigravity Custom Components**
    ```bash
    cp ../../.agent/ui-kit-template/src/components/ui/Table.tsx src/components/ui/
    cp ../../.agent/ui-kit-template/src/components/ui/Badge.tsx src/components/ui/
    cp ../../.agent/ui-kit-template/src/components/GlobalToast.tsx src/components/
    cp ../../.agent/ui-kit-template/src/components/GlobalErrorBoundary.tsx src/components/
    mkdir -p src/utils
    cp ../../.agent/ui-kit-template/src/utils/GlobalEvents.ts src/utils/
    ```

10. **Configure Vite Proxy**
    Add to `vite.config.ts`:
    ```typescript
    server: {
      proxy: {
        '/admin': 'http://localhost:4004',
        '/browse': 'http://localhost:4004',
        '/request': 'http://localhost:4004'
      }
    }
    ```

---

# Phase 3: Git & DevOps

11. **Initialize Git**
    ```bash
    cd ../..  # Back to project root
    git init
    git add .
    git commit -m "chore: initial full-stack project"
    ```

12. **Connect to Azure DevOps**
    ```bash
    git remote add origin git@ssh.dev.azure.com:v3/your-org/your-project/your-repo
    git push -u origin main
    ```

13. **Add Agent Team Submodule**
    ```bash
    git submodule add git@ssh.dev.azure.com:v3/conarumdc/cdk/cap-agent-team .agent
    git submodule update --init --recursive
    ```

---

# Verification

14. **Start Backend**
    ```bash
    cds watch
    ```

15. **Start Frontend** (in separate terminal)
    ```bash
    cd app/request-management
    npm run dev
    ```

16. **Verify Stack**
    - Backend: http://localhost:4004
    - Frontend: http://localhost:5173
