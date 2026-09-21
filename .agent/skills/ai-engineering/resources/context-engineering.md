# 🧠 Context Engineering

**Definition:** The art of optimizing the limited "Working Memory" (Context Window) of an LLM to maximize performance and minimize cost/latency.

## 1. The Hierarchy of Context

1.  **System Prompt (The Soul):**
    *   Immutable instructions. "You are a specialized SAP Architect..."
    *   **Best Practice:** Version control this file.

2.  **Few-Shot Examples (The Training):**
    *   Static examples of Input -> Output.
    *   **Impact:** Drastically improves adherence to strict formats (like CDS or MTA.yaml).

3.  **Dynamic Context (The Knowledge):**
    *   RAG results, User History, File contents.
    *   **Rule:** Only inject what is relevant to the *current* turn.

## 2. Optimization Techniques

*   **Context Compression:** Do not send the whole 10MB PDF. Send the "Summary" or "Table of Contents" first. Let the agent ask for specific pages.
*   **Formatting:** Use XML tags (`<context>...</context>`) to help the model distinguish between instructions and data.
*   **Output Token Management:** If you just want a boolean, tell the model "Reply with ONLY 'true' or 'false'". Don't pay for a paragraph of explanation.

## 3. The "Needle in a Haystack" Problem
Just because the context window is 1M tokens doesn't mean the model pays attention to all of it.
*   **Recency Bias:** Models pay most attention to the *end* of the prompt.
*   **Primacy Bias:** Models pay attention to the *start*.
*   **The Middle:** Information in the middle is often lost. Put critical constraints in the System Prompt (Start) or the User Query (End).
