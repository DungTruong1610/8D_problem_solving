---
description: Start a new feature development task following GitFlow
---

1.  **Sync with Remote**
    Ensure we are starting from a clean state.
    ```bash
    git checkout develop
    git pull origin develop
    ```

2.  **Create Feature Branch**
    Ask the user for the feature name (kebab-case) if not provided.
    ```bash
    git checkout -b feature/<feature-name>
    ```

3.  **Install Dependencies**
    Ensure all tools are ready.
    // turbo
    ```bash
    npm install
    ```

4.  **Ready**
    Notify the user that the environment is ready for development.
