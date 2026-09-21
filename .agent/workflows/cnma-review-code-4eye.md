---
description: Perform a 4-Eyes Principle Code Review focusing on SOLID, DRY, YAGNI, and KISS principles
---

# Code Review (4-Eyes Principle) Workflow

When the user invokes this workflow, follow these steps to perform a comprehensive code review of a specified file or directory.

1. **Understand the Request & Business Context:**
   - Identify the target file or directory the user wants reviewed.
   - If not specified, ask the user what they want reviewed.
   - **CRITICAL:** Always keep the business project context in mind. Evaluate how the code impacts business flow, stability, and maintainability.

2. **Analyze the Codebase:**
   - Read the target files.
   - Evaluate the code against the following principles:
     - **4-Eyes Principle:** Act as the second pair of eyes. Look for logical errors, security flaws, or edge cases the original developer might have missed.
     - **SOLID Principles:** Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion.
     - **DRY (Don't Repeat Yourself):** Is there duplicated logic that can be abstracted?
     - **YAGNI (You Aren't Gonna Need It):** Is there over-engineering or speculative code for features not yet needed?
     - **KISS (Keep It Simple, Stupid):** Is the code overly complex? Can it be written more simply?

3. **Generate the Review Report:**
   - Compile the findings into a structured markdown report.
   - The report MUST include the following sections:
     - **Meta Information:** Date (in `YYMMDD` format), Reviewer Name (Leo - AI + 4-Eyes), and Scope.
     - **Code Score:** Provide an overall score out of 100 based on the principles evaluated.
     - **Business Impact Assessment:** A brief summary of how the current code state impacts the business (e.g., performance bottlenecks, maintainability risks, potential data loss).
     - **Actionable Findings by Severity:** List specific issues that need fixing:
       - 🔴 **CRITICAL:** Show-stoppers, major bugs, or severe design flaws impacting the business.
       - 🟡 **WARNING:** Tech debt, performance issues, or SOLID/DRY/YAGNI violations.
       - 🔵 **LOW:** Minor refactoring opportunities, naming conventions, or KISS improvements.
     - **Detailing Findings:** For each finding, you MUST specify:
       - The exact **Class or Function** name.
       - If it is a high-level architectural or flow issue, provide a **`Before Flow -> Need Optimize Flow`** explanation (can use Mermaid diagrams if helpful).
     - **Principles Summary:** A quick Pass/Fail/Improve breakdown of SOLID, DRY, YAGNI, KISS.

4. **Output the Result:**
   - Use the `write_to_file` tool to save the report to the following path:
     `docs/code-review/Code-Review-[YYMMDD].md` (replace `[YYMMDD]` with the actual date, e.g., `260222`).
   - If the file already exists (multiple reviews on the same day), append a suffix like `-v2`, `-v3`, etc.

5. **Notify the User:**
   - Inform the user that the review is complete and the report has been saved.
   - Provide a brief summary of the Code Score, Critical issues, and Business Impact in the chat.
