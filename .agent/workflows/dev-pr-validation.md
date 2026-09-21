---
description: Validate code quality before creating a Pull Request
---

1.  **Static Analysis**
    Run linting to catch style and error issues.
    ```bash
    npm run lint
    ```

2.  **Backend Verification**
    Run unit and integration tests for the CAP service.
    ```bash
    cd srv
    npm test
    cd ..
    ```

3.  **Frontend Verification**
    Run component tests for the React application.
    ```bash
    cd app/frontend
    npm test
    cd ../..
    ```

4.  **Build Check**
    Ensure the application builds without errors.
    ```bash
    npm run build
    ```

5.  **Completion**
    If all steps passed, the code is ready for a Pull Request!
