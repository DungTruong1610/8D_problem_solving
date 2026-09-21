# 🔄 Agentic Workflows

**Definition:** Systems where the control flow is determined by the LLM itself, rather than a hardcoded script.

## 1. The Core Loop (ReAct)
The fundamental unit of an agent is the **Reason + Act** loop.

1.  **Thought:** The agent analyzes the current state.
2.  **Plan:** The agent decides which Tool to call.
3.  **Action:** The system executes the Tool.
4.  **Observation:** The system feeds the Tool Output back to the agent.
5.  **Reflect:** The agent decides if the task is done or needs another loop.

## 2. Architectures

### Chain (DAG)
*   **Structure:** Step 1 -> Step 2 -> Step 3.
*   **Use Case:** Data Processing Pipelines.
*   **Pros:** deterministic, easy to debug.
*   **Cons:** Brittle. If Step 2 fails, the chain breaks.

### State Machine (Graph)
*   **Structure:** Nodes (Agents) and Edges (Conditions).
*   **Use Case:** Complex Customer Service (Triage -> Refund -> Email).
*   **LangGraph:** The industry standard for defining these graphs in code.

## 3. Critical Design Rules
*   **Stopping Condition:** Every loop MUST have a max_iterations counter (e.g., 10 steps). Otherwise, you get infinite loops ($$$).
*   **Human-in-the-Loop (HITL):** For sensitive actions (deploying to prod, refunding > $100), the "Tool" should just pause execution and wait for a human approval signal. See [AI Safety & Ops](ai-safety-and-ops.md) for UX patterns.
