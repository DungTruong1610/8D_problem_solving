# ☁️ SAP AI Core & GenAI Hub

**Purpose:** This guide defines how to deploy and consume AI models within the SAP BTP ecosystem.

## 1. GenAI Hub (The easy way)
For most "Chat" or "Completion" tasks, use the GenAI Hub via the SAP Cloud SDK.

*   **Architecture:** app -> Destination Service -> AI Core (GenAI Hub) -> Model Provider (Azure OpenAI/Google/AWS).
*   **Code Pattern (CAP/Node.js):**
    ```typescript
    import { AzureOpenAiChatClient } from '@sap-ai-sdk/foundation-models';
    
    const response = await AzureOpenAiChatClient.execute(
      { destinationName: 'AICore' },
      { messages: [{ role: 'user', content: 'Hello' }] }
    );
    ```

## 2. SAP AI Core (The hard way)
Use this for **Custom Models** or **Fine-Tuning**.

*   **Artifacts:** Docker Images (serving the model).
*   **Workflows:** Argo Workflows (defined in YAML) to train or infer.
*   **Deployments:** Serving the trained model as an HTTP endpoint.

## 3. Security Rules
*   **AICore Service Key:** Never check this into git. Use BTP Destinations.
*   **Data Privacy:** Ensure the "Data Processing Agreement" (DPA) allows sending business data to the underlying model provider (e.g., Azure).
