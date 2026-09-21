---
name: debugging
description: A structured protocol for finding the root cause of errors (The "General Debugging Protocol").
---

# 🐞 Systematic Debugging Skill

**Context:** Use this skill whenever you encounter an error, crash, or unexpected behavior. Do not "guess" the fix.

## 1. The Protocol (The "5 Whys")
1.  **Reproduce:** Can you make it happen again? If not, it's a ghost.
2.  **Isolate:** Remove variables. Does it happen on Local? On Cloud? With this specific payload?
3.  **Bisect:** Binary search the code. "It worked in Commit A, broken in Commit B."
4.  **Hypothesize & Verify:** "I bet it's the Null Check." -> Add a log -> Run it. -> "Confirmed."
5.  **Fix:** Implement the correction.
6.  **Regress:** Ensure you didn't break anything else.

## 2. Tactics
*   **Rubber Ducking:** Explain the code line-by-line to the user. "Here, I check if `auth` is verified..."
*   **Log Everything:** If you can't see state, you're blind. Add `console.log` or `console.error` generously during investigation (remove later).
*   **Check Assumptions:** "The API returns JSON." -> Does it? Check the `Content-Type` header.

## 3. Common CAP/Fiori Pitfalls
*   **OData:** 400 Bad Request usually means Type Mismatch (String vs UUID).
*   **Fiori:** "Binding not found" usually means a typo in the XML View or `manifest.json`.
*   **BTP:** 500 Internal Server Error often hides the real error in the `cf logs`.

## 4. Output Format
When debugging, report:
> **🔍 Debugging Analysis:**
> *   **Symptom:** Application crashes on Save.
> *   **Context:** Only happens for "Guest" users.
> *   **Cause:** Missing `Scope` check in `srv.js`.
> *   **Fix:** Add `req.user.is('authenticated')` guard.
