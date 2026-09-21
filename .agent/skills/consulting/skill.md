---
name: consulting
description: Business consulting protocols for requirements gathering, stakeholder engagement, and proposing alternatives. Use before implementing any significant feature.
---

# 🤝 Consulting Skill

**Context:** Use this skill before implementing features to ensure requirements are complete and the right solution is being built.

## Core Principle

> **"A good consultant doesn't just build what's asked—they ensure what's asked is what's needed."**

## Three Protocols

| Protocol | When | Reference |
|----------|------|-----------|
| Requirements Gathering | Before any implementation | `resources/requirements-gathering.md` |
| Stakeholder Engagement | When clarification needed | `resources/stakeholder-engagement.md` |
| Challenge Framework | When proposing alternatives | `resources/challenge-framework.md` |
| Technical Consulting | Before architecture/technology choices | `resources/technical-consulting.md` |

## Quick Decision Tree

```
NEW REQUIREMENT RECEIVED
│
├─ Is it clear and complete?
│   ├─ No  → Requirements Gathering Protocol
│   └─ Yes → Continue
│
├─ Are there unstated assumptions?
│   ├─ Yes → Stakeholder Engagement Protocol
│   └─ No  → Continue
│
├─ Is this the best approach?
│   ├─ Unsure → Challenge Framework (propose alternatives)
│   └─ Yes    → Continue
│
├─ Is the technical approach platform-standard?
│   ├─ No  → Technical Consulting (climb the decision ladder)
│   └─ Yes → Continue
│
└─ IMPLEMENT (with validated requirements)
```

## Consulting Checklist

Before implementing, verify:

- [ ] **Problem understood** — What specific problem does this solve?
- [ ] **Users identified** — Who will use this? What are their roles?
- [ ] **Scope defined** — What's in scope? What's explicitly out of scope?
- [ ] **Edge cases covered** — What happens when things go wrong?
- [ ] **Success criteria clear** — How do we know it's done correctly?
- [ ] **Alternatives considered** — Is this the simplest/best approach?

## CAP-Specific Questions

When gathering requirements for CAP features:

| Feature Type | Questions to Ask |
|--------------|------------------|
| New entity | Fields needed? Relationships? Who creates/reads/updates/deletes? |
| New action | Input parameters? Output? Who can trigger? Async or sync? |
| New workflow | Status values? Transitions? Approval required? Notifications? |
| Integration | Which API? Authentication? Error handling? Retry logic? |
| UI feature | Which user roles see this? Mobile support? Accessibility? |

## Bottom Line

1. Ask before implementing
2. Validate before building
3. Propose alternatives
4. Challenge when appropriate

**Understand. Validate. Challenge. Then implement.**
