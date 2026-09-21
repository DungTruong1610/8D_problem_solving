# 🛡️ AI Safety, Evals & Ops

**Purpose:** Ensuring AI systems are reliable, safe, and observable in production.

## 1. Evaluation (LLM-as-a-Judge)
Don't eyeball it. Measure it.

*   **Concept:** Use a strong model (GPT-4o) to grade the output of your application.
*   **The Trinity of Metrics:**
    1.  **Context Precision:** Did the RAG retrieve the right chunks?
    2.  **Faithfulness:** Did the answer ignore the context and hallucinate?
    3.  **Answer Relevance:** Did the answer actually address the user's question?

## 2. Red Teaming
*   **Prompt Injection:** Test if users can make the bot say "I hate SAP".
*   **PII Leakage:** Ensure the model doesn't output email addresses or passwords found in the context.

## 3. AI Observability (LangSmith / Arize)
*   **Tracing:** Every "Thought" in an Agent Loop must be logged.
*   **Latency/Cost:** Track token usage per user.
*   **Drift:** Detection when the model starts behaving differently over time.

## 4. Human-in-the-Loop (HITL)
*   **Approval Gate:** For WRITE actions (Create PO, Delete User), the Agent must emit a `REQUEST_APPROVAL` event.
*   **UI Pattern:** The Frontend renders an "Approve/Reject" card. The execution resumes only after user interaction.
