---
name: stakeholder-engagement
description: Protocol for asking clarifying questions and engaging with stakeholders.
---

# Stakeholder Engagement Protocol

When requirements are unclear, use this protocol to engage stakeholders effectively.

## When to Ask Questions

| Signal | Action |
|--------|--------|
| Vague language ("make it better", "improve") | Ask for specific success criteria |
| Missing context ("add a field") | Ask about purpose, users, workflow |
| Ambiguous terms ("fast", "flexible") | Ask for measurable criteria |
| Conflicting requirements | Ask about priorities |
| Unstated assumptions | Validate before proceeding |

## Questioning Techniques

### Open Questions (Explore)
Use to understand the problem space:
- "Can you walk me through the current process?"
- "What problem are you trying to solve?"
- "How do users handle this today?"

### Closed Questions (Confirm)
Use to validate specific details:
- "Should this also apply to [specific case]?"
- "Is [X] the correct data source?"
- "Do you need this in the first release?"

### Probing Questions (Dig Deeper)
Use when answers are incomplete:
- "What happens after [step]?"
- "Who else is involved in this process?"
- "What would make this fail?"

## Question Templates by Domain

### Business Context
- "What business problem does this solve?"
- "Who are the end users of this feature?"
- "What's the expected volume/frequency?"
- "How is this done today? What's wrong with that?"

### User Workflow
- "Walk me through how a user would use this."
- "What's the trigger for this action?"
- "What should happen if [error condition]?"
- "Are there any approval steps?"

### Data & Integration
- "Where does this data come from?"
- "What other systems need to know about this?"
- "How should conflicts/duplicates be handled?"

### Priority & Scope
- "Is this required for the first release?"
- "What's the priority: [A] or [B]?"
- "What can we defer to a later phase?"

## How Many Questions?

| Requirement Complexity | Minimum Questions |
|------------------------|-------------------|
| Simple (clear, small scope) | 1-2 |
| Medium (some ambiguity) | 3-5 |
| Complex (vague, large scope) | 5-10 |
| Critical (security, money) | Until 100% clear |

## Communication Style

### DO
- Be curious, not interrogating
- Acknowledge user's input
- Explain WHY you're asking
- Summarize understanding

### DON'T
- Ask everything at once (overwhelming)
- Use technical jargon
- Assume you know the answer
- Skip ahead to solution

## Example Engagement

```
USER: "We need to track document status."

AGENT: "Great, I want to make sure I understand the full picture before implementing.

1. **Users:** Who will be updating the status? Any role restrictions?
2. **Statuses:** What status values do you need? (e.g., Draft, Submitted, Approved?)
3. **Workflow:** Are there any status transitions that shouldn't be allowed?
4. **History:** Should we track who changed the status and when?

Once I understand these, I can propose the best implementation."
```
