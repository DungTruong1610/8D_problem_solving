# Code Quality & Git Workflow Guidelines

**Version:** 2.0 (AI-Optimized)
**Status:** Approved
**Target Audience:** All Developers, AI Agents

---

## 1. Commit Message Convention

AI agents and developers must use **Conventional Commits** for semantic history.

### Format
`<type>(<scope>): <subject>`

### Types
- `feat`: New feature.
- `fix`: Bug fix.
- `docs`: Documentation.
- `refactor`: Code restructuring.
- `test`: Adding tests.
- `chore`: Tooling/build changes.

### Example
`feat(extraction): add AI field detection`

---

## 2. Code Quality Tools

### 2.1. Linting & Formatting
- **ESLint**: Enforce coding standards (`npm run lint`).
- **Prettier**: Unified code style.

### 2.2. Pre-commit Hooks
Use **Husky** to run linting and commit-msg validation before every commit.

---

## 3. Git Branching Strategy (GitFlow)

- **`main`**: Production-ready code.
- **`develop`**: Integration branch for new features.
- **`feature/*`**: Individual tasks/features (branch from `develop`).
- **`bugfix/*`**: Bug fixes (branch from `develop`).
- **`hotfix/*`**: Critical production fixes (branch from `main`).

---

## 4. Pull Request Process

### 4.1. Author Requirements
- PRs should be small (< 400 lines).
- Self-review code before requesting others.
- Ensure all CI checks pass.

### 4.2. Review Rules
- One logic approval for features.
- Two approvals for `main` merges.
- Reviews should occur within 24 hours.

---

## 5. Workflow Examples

```bash
# Feature development
git checkout -b feature/new-logic
git commit -m "feat: implement logic"
git push origin feature/new-logic
# Create PR targeting 'develop'
```

---

## 6. Definition of Done

- [ ] Code reviewed.
- [ ] Tests pass (Unit + Integration).
- [ ] Documentation updated.
- [ ] No linting errors.
- [ ] Deployed to Dev environment.
