---
description: Initialize a new SAP CAP project with best practices
---

1.  **Scaffold Project**
    Create the base CAP structure with standard add-ons.
    ```bash
    cds init --add mta,pipeline,hana,xsuaa
    ```

2.  **Install Dependencies**
    Install the core CAP packages and development tools.
    // turbo
    ```bash
    npm install
    ```

3.  **Apply Antigravity Configuration**
    Copy standard configs from the Agent templates.
    ```bash
    # Install Tools
    npm install --save-dev eslint prettier eslint-config-prettier husky lint-staged
    
    # Copy Configs
    cp .agent/templates/config/.eslintrc.js .
    cp .agent/templates/config/.prettierrc .
    cp .agent/templates/config/tsconfig.json .
    
    # Overwrite package.json with Antigravity template (includes type scripts)
    # WARNING: Back up existing package.json if needed
    cp .agent/templates/config/package.template.json package.json
    npm install # Re-install to ensure all dependencies match
    ```

4.  **Create Project Structure**
    Refactor the default CAP layout to Antigravity standards.
    ```bash
    # Backend Structure
    mkdir -p srv/handlers srv/lib/processors srv/lib/actions srv/lib/utils tests
    
    # Data Structure
    mkdir -p db/data
    ```

6.  **Generate and Setup Shared Types**
    Generate TypeScript types from CDS schema and create shared types file.
    ```bash
    # Generate types from CDS schema
    npx cds-typer "*" --outputDirectory @cds-models
    
    # Create srv/types.ts for shared types (enums, interfaces used by UI)
    # This file will be the single source of truth for Status, Priority, etc.
    ```
    
    **Important:** See `.agent/guidelines/type-sharing-guideline.md` for details on:
    - How to structure `srv/types.ts`
    - How to sync types to frontend
    - Anti-patterns to avoid

7.  **Initialize Git**
    Start version control.
    ```bash
    git init
    git add .
    git commit -m "chore: initial project structure"
    ```

8.  **Connect to Azure DevOps**
    Link the local repo to the cloud.
    ```bash
    git remote add origin git@ssh.dev.azure.com:v3/your-org/your-project/your-repo
    git push -u origin main
    ```

9.  **Agent Setup (The Brain)**
    Install the Antigravity Agent Team as a submodule.
    ```bash
    git submodule add git@ssh.dev.azure.com:v3/conarumdc/cdk/cap-agent-team .agent
    git submodule update --init --recursive
    ```

10. **Setup Testing Framework**
    Install Jest and configure it for TypeScript.
    ```bash
    npm install --save-dev jest @types/jest ts-jest
    
    # Create Jest Config
    echo "module.exports = { preset: 'ts-jest', testEnvironment: 'node', testMatch: ['**/tests/**/*.test.ts'] };" > jest.config.js
    ```
