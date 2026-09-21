---
name: pr-requirements
mode: model_decision
description: Checklist and requirements for Pull Request submissions
---

# Pull Request Requirements

## Before Creating a PR

Ensure all the following are complete:

### Code Quality
- [ ] Code compiles without errors
- [ ] All tests pass locally
- [ ] No linting errors
- [ ] Code follows project style guidelines

### Documentation Checklist
- [ ] **CHANGELOG.md** updated (if user-facing change)
- [ ] **Technical docs** updated (if architecture/API changed)
- [ ] **Product docs** updated (if user behavior changed)
- [ ] **Business docs** updated (if process flow changed)
- [ ] All doc changes have updated "Last Updated" date

### Testing
- [ ] Unit tests added/updated for new code
- [ ] E2E tests added for new features
- [ ] Manual testing completed

---

## PR Description Template

```markdown
## Summary
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] Refactoring

## Related Issues
Fixes #123

## Documentation Updates
- [ ] CHANGELOG.md
- [ ] Technical docs: [list files]
- [ ] Product docs: [list files]
- [ ] No documentation needed (explain why)

## Testing Done
- [ ] Unit tests
- [ ] E2E tests
- [ ] Manual testing

## Screenshots (if UI change)
[Add screenshots]
```

---

## Documentation Rules

### MUST Update Docs When:
- Adding/changing API endpoints
- Adding/changing user-facing features
- Changing security behavior
- Changing configuration options
- Changing workflow/process logic

### MAY Skip Docs When:
- Pure refactoring (no behavior change)
- Dependency updates (security patches)
- Test-only changes
- Internal code comments only

---

## Review Guidelines

Reviewers should verify:
1. PR description is complete
2. Documentation checklist is checked
3. CHANGELOG entry exists for user-facing changes
4. Code and documentation are consistent
