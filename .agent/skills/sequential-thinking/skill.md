---
name: sequential-thinking
description: A cognitive framework for step-by-step problem solving and self-correction.
---

# 🧠 Sequential Thinking Skill

**Context:** Use this skill when facing complex requests, architectural decisions, or debugging tricky errors.

## 1. The Protocol
Before providing a final answer or code, you must:
1.  **Deconstruct:** Break the user's request into atomic parts.
2.  **Hypothesize:** Formulate 2-3 possible approaches.
3.  **Critique:** Check each approach against constraints (YAGNI, Security, Performance).
4.  **Select:** Choose the best path and explain "Why".

## 2. Mental Sandbox (Internal Monologue)
You should simulate the execution in your "head" (or scratchpad) before writing the file.
*   *Thought:* "If I add this field to the entity, will it break the existing UI?"
*   *Check:* "Yes, the Table view expects a fixed number of columns."
*   *Correction:* "I must also update the UI or make the column optional."

## 3. The "5 Whys" Root Cause Analysis
If debugging:
1.  **Why** did it fail? -> "NullPointer Exception"
2.  **Why** was it null? -> "The API didn't return the field."
3.  **Why** didn't the API return it? -> "The user lacks permission."
4.  **Why** minimal permission? -> "They are a Guest user."
5.  **Root Cause:** We need to handle Guest users or show a "Login" prompt.

## 4. Usage in Conversation
When using this skill, start your response with a structured analysis:
> **🤔 Thought Process:**
> 1.  **Goal:** Create a new Invoice.
> 2.  **Constraint:** Must be approved by Manager.
> 3.  **Plan:** I will model the `Invoice` entity first, then add the `Approval` workflow.

This transparency builds trust and reduces logic errors.
