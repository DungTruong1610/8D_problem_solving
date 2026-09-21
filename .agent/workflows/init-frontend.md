---
description: Initialize a React frontend with shadcn/ui, Tailwind, and the complete Antigravity tech stack
---

// turbo-all

1.  **Create Vite + React Project**
    Scaffold the frontend inside `app/` directory.
    ```bash
    cd app
    npm create vite@latest request-management -- --template react-ts
    cd request-management
    ```

2.  **Install Core Dependencies**
    ```bash
    npm install
    ```

3.  **Initialize shadcn/ui**
    Set up shadcn/ui with new-york style and slate base color.
    ```bash
    npx shadcn@latest init -y
    ```

4.  **Add shadcn/ui Components**
    Install base primitives.
    ```bash
    npx shadcn@latest add button card dialog input select tabs switch tooltip label separator
    ```

5.  **Install State & Data Libraries**
    ```bash
    npm install @tanstack/react-query zustand axios react-router-dom
    ```

6.  **Install Form & Validation**
    ```bash
    npm install react-hook-form zod @hookform/resolvers
    ```

7.  **Install Internationalization**
    ```bash
    npm install react-i18next i18next
    ```

8.  **Install UI Enhancements**
    ```bash
    npm install framer-motion lucide-react clsx tailwind-merge class-variance-authority
    ```

9.  **Install Specialized Libraries (Optional)**
    For Studio/workflow features.
    ```bash
    npm install @xyflow/react @dnd-kit/core @dnd-kit/sortable dagre
    npm install -D @types/dagre
    ```

10. **Copy Antigravity Custom Components**
    Copy reusable components from the UI kit template (travels with .agent submodule).
    ```bash
    # Copy from .agent/ui-kit-template to your app
    cp .agent/ui-kit-template/src/components/ui/Table.tsx src/components/ui/
    cp .agent/ui-kit-template/src/components/ui/Badge.tsx src/components/ui/
    cp .agent/ui-kit-template/src/components/GlobalToast.tsx src/components/
    cp .agent/ui-kit-template/src/components/GlobalErrorBoundary.tsx src/components/
    cp .agent/ui-kit-template/src/utils/GlobalEvents.ts src/utils/
    ```

11. **Configure Type Sharing & Proxy**
    Use the pre-configured templates that set up #cds-models path aliases and CAP proxy.
    ```bash
    # Copy configured tsconfig files
    cp ../../.agent/ui-kit-template/tsconfig.json .
    cp ../../.agent/ui-kit-template/tsconfig.app.json .
    
    # Copy configured vite.config.ts
    cp ../../.agent/ui-kit-template/vite.config.ts .
    
    # Create types directory with template
    mkdir -p src/types
    cp ../../.agent/ui-kit-template/src/types/index.ts src/types/
    ```
    
    **Type Setup:**
    1. Edit `src/types/index.ts` to uncomment the import from `#cds-models`
    2. Ensure `npm run build:types` has been run in the project root

12. **Start Development**
    This will auto-generate types and start the server.
    ```bash
    npm run dev
    ```

13. **Start Development**
    ```bash
    npm run dev
    ```
