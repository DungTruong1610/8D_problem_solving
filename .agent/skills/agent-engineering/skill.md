---
name: agent-engineering
description: Principles of Prompt Engineering, Persona Design, and Context Management.
---

# 🧬 Agent Engineering Skill

**Context:** Use this skill when creating new Agents, refining existing Prompts, or debugging "Hallucinations".

## 1. The Core Principles (Prompt Engineering)
- **Clarity > Cleverness:** Instructions must be unambiguous.
    - *Bad:* "Write good code."
    - *Good:* "Write TypeScript code that passes strict-null checks."
- **Few-Shot Prompting:** Always provide examples (`<example>`) of the desired input/output. This is the single most effective way to guide behavior.
- **Chain of Thought (CoT):** Force the agent to "Think" before acting. Use `Sequential Thinking` or explicit "1. Analyze, 2. Plan" steps.

## 2. Persona Design Structure
Every Agent file (`.md`) must follow this structure:
1.  **Frontmatter:** YAML with `role` and `description`.
2.  **Header:** Emoji + Title.
3.  **Role Definition:** Use a "Metaphor" (e.g., "The City Planner") to ground the identity.
4.  **Priorities:** Ranked list of what matters most (e.g., "Safety first" vs "Speed first").
5.  **Equipped Skills:** Links to `SKILL.md` files.
6.  **Mental Models:** *How* to think (High-level cognitive frameworks).
7.  **Interaction Examples:** Concrete `<example>` blocks.

## 3. "Drift" Prevention
- **Negative Constraints:** explicit "Do NOT" rules are powerful.
    - *Example:* "Do NOT use `console.log`."
- **Context Handling:** Assume the agent has "Amnesia". Each prompt must reference the necessary context (Guidelines/Rules).

## 4. Debugging Agents
If an agent fails:
1.  **Check the Context:** Did it read the relevant Rule file?
2.  **Check the Prompt:** Was the instruction vague?
3.  **Check the Conflict:** Did two rules contradict each other?
