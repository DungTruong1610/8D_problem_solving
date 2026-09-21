# 🤖 Multi-Agent Systems (CrewAI)

**Definition:** Orchestrating multiple specialized agents to collaborate on a complex task.

> **⚠️ Warning:** Do NOT use CrewAI if a simple 5-line prompt will do.
> *   **Good:** "Summarize this PDF." (Single Call)
> *   **Bad:** "Create a Summary Agent to read the PDF and a Writer Agent to type it out." (Over-Engineering)

## 1. The "Crew" Metaphor
Instead of one "God Agent", you have a team:
*   **Manager:** Breaks down the plan.
*   **Researcher:** Googles/Searches DB.
*   **Writer:** Drafts the report.
*   **Reviewer:** Critiques the report.

## 2. Delegation Patterns
*   **Hierarchical:** Manager delegates to subordinates. Results bubble up. (Strict, reliable).
*   **Sequential:** Agent A passes output to Agent B. (Pipeline).
*   **Consensual:** Agents debate until they agree. (Slow, high quality).

## 3. When to use?
*   **Use Single Agent** for: "Find invoice #123".
*   **Use Multi-Agent** for: "Research the impact of the new tax law on our Q3 sales and draft a memo to the CFO."

## 4. Protocols
*   **MCP (Model Context Protocol):** Standardizing how agents discover tools and share context across boundaries.
