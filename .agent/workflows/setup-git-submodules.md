---
description: Convert the local .agent folder into a shared Git Submodule
---

1.  **Create Agent Repository**
    (Manual Step) Go to GitHub/Azure DevOps/Bitbucket and create a NEW Empty Repository (e.g., `my-org/cap-agent-team`).
    *   Do NOT initialize it with README or gitignore.

2.  **Move Content to Temp Location**
    Move the existing `.agent` folder out of the way to prepare for the push.
    ```bash
    mv .agent ../agent-temp
    ```

3.  **Push Agents to New Repo**
    Initialize the new repo and push the content.
    ```bash
    cd ../agent-temp
    git init
    git add .
    git commit -m "feat: initial agent team export"
    git branch -M main
    git remote add origin <YOUR_NEW_REPO_URL>
    git push -u origin main
    ```

4.  **Add Submodule to Projects**
    Go back to your main project and add the submodule.
    ```bash
    cd ../<your-project-folder>
    git submodule add <YOUR_NEW_REPO_URL> .agent
    ```

5.  **Commit the Change**
    Commit the new `.gitmodules` file.
    ```bash
    git add .gitmodules .agent
    git commit -m "chore: migrate agents to submodule"
    ```

6.  **Updating Agents (Ongoing)**
    To pull the latest agent improvements from the central repo:
    // turbo
    ```bash
    git submodule update --remote --merge
    ```
