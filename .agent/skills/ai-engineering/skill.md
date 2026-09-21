---
name: ai-engineering
description: Expertise in Generative AI, LLM Orchestration, and SAP AI Services.
---

# 🤖 AI Engineering

**Definition:** The discipline of integrating "Stochastic" AI components into "Deterministic" software systems. It is not just prompting; it is about Reliability, Evaluation, and Architecture.

## 🔑 Key Concepts

1.  **RAG (Retrieval-Augmented Generation):**
    *   Do not trust the model's internal training data for business facts.
    *   **Architecture:** Query -> Embed -> Vector Search -> Context Injection -> LLM.
    *   **SAP Context:** Use HANA Vector Engine for embeddings.

2.  **Orchestration (LangChain/LangGraph):**
    *   LLMs are just API calls. You need a "Brain" to chain them together.
    *   Use **Tools** (Function Calling) to let the AI interact with the real world (e.g., "Look up Invoice Status").

3.  **SAP GenAI Hub:**
    *   The gateway to models (GPT-4o, Claude 3.5 Sonnet, Gemini).
    *   **Constraint:** NEVER use direct OpenAI keys. ALWAYS use the BTP Destination Service.

4.  **Multi-Agent Systems:**
    *   Decompose complex tasks into "Crews" (Manager, Researcher, Writer).
    *   **Pattern:** Hierarchical Delegation vs. Sequential Pipelines.

## 🛠️ Best Practices

*   **System Prompts:** Treat them as code. Version them. Test them.
*   **Structured Output:** Force the LLM to return JSON (using Pydantic/Zod schemas). Never parse natural language with Regex.
*   **Evaluation (Evals):** How do you know it's working? Use an "LLM-as-a-Judge" to score responses for accuracy and relevance.

## 📚 References
*   [SAP AI Core Strategy](resources/sap-ai-core.md)
*   [Document Extraction (LLM-based)](resources/document-extraction.md)
*   [Agentic Workflows](resources/agentic-workflows.md)
*   [Context Engineering](resources/context-engineering.md)
*   [AI Safety, Evals & Ops](resources/ai-safety-and-ops.md)
*   [Multi-Agent Systems](resources/multi-agent-systems.md)
