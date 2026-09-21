---
name: git-workflow
mode: model_decision
description: Conventions for Git branches, commits, and PRs. Use when performing version control tasks.
---

# Git Workflow

## Branching Strategy (GitFlow)
- `main` - Production-ready code only
- `develop` - Integration branch for features
- `feature/*` - New features (e.g., `feature/invoice-extraction`)
- `bugfix/*` - Bug fixes (e.g., `bugfix/pdf-parser-error`)
- `hotfix/*` - Critical production fixes

## Branch Cleanup Rules (Safety First)
- **Local:** Always use `git branch -d` (lowercase). This **fails** if the branch is not merged.
- **Never:** Use `git branch -D` (uppercase) unless you explicitly want to **destroy** unmerged work.
- **Remote:** Azure DevOps will block deletion if a Policy requires a PR.


## Commit Messages
Follow **Conventional Commits** format:
```
<type>(<scope>): <subject>

Examples:
feat(extraction): add AI-powered invoice field detection
fix(upload): handle large PDF files without timeout
docs(readme): update deployment instructions
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Pull Request Rules
- All commits must follow Conventional Commits
- PRs require **1 approval** for `feature/*` and `bugfix/*`
- PRs require **2 approvals** for merges to `main`
- All CI checks must pass before merge
- Keep PRs small (< 400 lines changed)

## Code Quality
- Run `npm run lint` before committing
- No `console.log` or `debugger` statements in production code
- All tests must pass locally before pushing
