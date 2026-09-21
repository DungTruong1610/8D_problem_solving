---
name: documentation-standards
mode: model_decision
description: Guidelines for updating and maintaining project documentation. Use when writing docs.
---

# 📝 Documentation Standards

**Philosophy:** Code without docs is legacy code. Docs that are outdated are lies.

## ⚠️ SCOPE: KERNEL ONLY
**These rules apply ONLY to the maintenance of this `cap-agent-team` repository.**
They do **NOT** apply to the "Host Project" (the application consuming this repo via submodule).
*   **Target:** The `cap-agent-team` definition developers.
*   **Not:** The Client Application developers.

## 1. The Golden Rule of Synchronization
> **"If you change the Capabilities, you MUST update the README."**

*   **Trigger:** Any change to `agents/`, `skills/`, or major architectural decisions.
*   **Action:** Immediately update the root `README.md` and `agent-team-roster.md`.
*   **Why:** The `README.md` is the "Context Root" for all future AI sessions. If it is stale, the team is lobotomized.

## 2. The Law of Skill Assignment
> **"A Skill does not exist until it is Equipped."**

*   **Trigger:** Creating a new file in `skills/**/SKILL.md`.
*   **Action:** You **MUST** immediately open `agents/*.md` and add the link to the `Equipped Skills` section of the relevant Agent.
*   **Context:** If you define "React", you must give it to the "Frontend Engineer". A book on a shelf is useless if no one reads it.
*   **Markdown First:** All docs must be `.md`.
*   **Mermaid Diagrams:** Use `mermaid` for flowcharts.
*   **Link Integrity:** Always check relative links (`../`) when moving files.

## 3. Location
*   `guidelines/` -> Theoretical "How-to" (Humans).
*   `rules/` -> Strict Enforcements (AI & Linters).
*   `skills/` -> Reference material for Agents.
