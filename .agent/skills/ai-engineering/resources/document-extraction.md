# 📄 Document Extraction (Native LLM)

**Purpose:** Extracting structured business data from images/PDFs using Multimodal LLMs (GPT-4o, Gemini 1.5, Claude 3.5) instead of specialized OCR services.

## 1. The Pattern (Base64 -> JSON)
Instead of using an async job queue (DOX), we treat document extraction as a synchronous (or near-sync) Chat Completion call.

1.  **Ingest:** Frontend converts file (PDF/Image) to **Base64** string.
2.  **Payload:** Construct a Chat Message with the Base64 data included.
3.  **Prompt:** "Extract the following fields... Return ONLY valid JSON."
4.  **Parse:** Receive JSON directly from the LLM.

## 2. Implementation details (CAP/Node.js)

Since we avoid specialized SDKs, we use the standard GenAI Hub (or native) client.

```typescript
// Conceptual Example
const payload = {
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Extract invoice number, date, and total. Return JSON." },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64String}` } }
      ]
    }
  ],
  response_format: { type: "json_object" } // Crucial for reliability
};
```

## 3. Advantages over DOX
*   **Flexibility:** Not bound by pre-trained schemas. You can ask for "The handwritten note in the margin".
*   **Latency:** Often faster than the Upload -> Poll -> Result cycle of DOX.
*   **Simplicity:** No need to manage DOX Schemas or Templates in a separate UI.

## 4. Best Practices
1.  **Token Limits:** High-res PDFs burn tokens. Resize images before sending if possible.
2.  **Validation:** LLMs can hallucinate. ALWAYS validate the returned JSON against a Zod/Pydantic schema before saving to DB.
3.  **PDFs:** Many LLMs accept Images only. You may need to convert `PDF -> PNG` (using `pdf2pic` or similar) before sending if the model doesn't support native PDF.
