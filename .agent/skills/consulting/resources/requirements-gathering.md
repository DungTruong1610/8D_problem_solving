---
name: requirements-gathering
description: Protocol for validating and completing requirements before implementation.
---

# Requirements Gathering Protocol

Before implementing, ensure requirements are complete using this protocol.

## The 5W Framework

For every feature request, validate:

| Question | Purpose | Red Flag if Missing |
|----------|---------|---------------------|
| **WHO** | Who uses this? Roles? | 🔴 Can't design authorization |
| **WHAT** | What exactly? Fields, actions? | 🔴 Vague scope |
| **WHEN** | When triggered? Conditions? | 🔴 Missing workflow context |
| **WHERE** | Where in UI? Which service? | 🔴 Unknown integration point |
| **WHY** | What problem solved? | 🔴 Solution looking for problem |

## Requirement Completeness Checklist

### Entity/Data Requirements
- [ ] All required fields identified
- [ ] Data types and constraints defined
- [ ] Relationships to other entities clear
- [ ] Unique identifiers specified
- [ ] Mandatory vs optional fields marked

### Workflow Requirements
- [ ] Status values defined
- [ ] Transitions between statuses clear
- [ ] Who can trigger each transition
- [ ] Notifications/emails needed?
- [ ] Approval workflows needed?

### Integration Requirements
- [ ] Source/target system identified
- [ ] API/protocol specified
- [ ] Authentication method clear
- [ ] Error handling defined
- [ ] Retry/fallback logic needed?

### UI Requirements
- [ ] Which users see this screen
- [ ] Required fields vs optional
- [ ] Validation messages defined
- [ ] Success/error feedback specified
- [ ] Mobile considerations?

## Gap Identification Questions

When requirements seem incomplete, ask:

### Scope Gaps
- "What's explicitly OUT of scope for this feature?"
- "Which related features should we NOT touch?"
- "Is this a complete feature or phase 1 of something larger?"

### Edge Case Gaps
- "What happens when [input is empty/null]?"
- "What if the user [does unexpected action]?"
- "How should we handle [failure scenario]?"

### Integration Gaps
- "Does this need to sync with other systems?"
- "Who/what triggers this process?"
- "Where does the data come from/go to?"

### Security Gaps
- "Who can access this? Role restrictions?"
- "Is any data sensitive/PII?"
- "Audit trail required?"

## Output: Requirements Summary

Before implementing, create a brief summary:

```markdown
## Requirements Summary: [Feature Name]

### Validated Requirements
- [Requirement 1]: [Clarified detail]
- [Requirement 2]: [Clarified detail]

### Assumptions Made
- Assuming [X] because [reason]

### Out of Scope
- [What we're NOT doing]

### Questions Still Open
- [Any remaining unknowns]
```
