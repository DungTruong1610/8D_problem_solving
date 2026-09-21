---
description: Run End-to-End tests using Playwright
---

1.  **Install Playwright**
    Ensure Playwright browsers are installed.
    ```bash
    npx playwright install
    ```

2.  **Start Application**
    Start the CAP server in the background (skip if already running).
    ```bash
    npm start &
    ```

3.  **Run Tests**
    Execute the E2E test suite.
    // turbo
    ```bash
    npx playwright test
    ```

4.  **View Report**
    Open the HTML report if tests failed.
    ```bash
    npx playwright show-report
    ```
