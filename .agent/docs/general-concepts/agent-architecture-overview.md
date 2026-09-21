# 🧠 Agent Architecture: A Beginner's Guide

Imagine your project is a **Restaurant Kitchen**. Here is how our concepts map to running that kitchen efficiently.

## 1. Agents (The Staff) 👨‍🍳
**Definition:** Specific "Personas" that perform work.
**Analogy:** The **Roles** in the kitchen.
- **Architect Agent:** The Head Chef (Designs the menu, checks quality).
- **Backend Agent:** The Line Cook (Grills the steak, makes the sauce).
- **QA Agent:** The Food Critic (Tastes everything before it goes out).
**Usage:** You don't ask the Dishwasher to cook a steak. You assign tasks to the right Agent.

## 2. Skills (The Recipes) 📖
**Definition:** Specific technical capabilities ("How-to" guides).
**Analogy:** The **Recipe Cards**.
- "How to Filet a Salmon" (Database Migration).
- "How to Make a Béarnaise Sauce" (API Integration).
**Usage:** When the Line Cook (Agent) needs to do a specific task, they pull out the correct Recipe (Skill) to ensure it's done perfectly.

## 3. Workflows (The Checklists) 📋
**Definition:** End-to-end processes for complex tasks.
**Analogy:** The **Opening/Closing Checklists**.
- "Opening the Kitchen" (Feature Start).
- "Plating a Dish" (PR Validation).
- "Clean Up" (Deploy to Dev).
**Usage:** A step-by-step list that *must* be followed in order to complete a large operation safely.

## 4. Guidelines (The Training Manual) 📚
**Definition:** Best practices, philosophy, and detailed education.
**Analogy:** The **Culinary School Textbook**.
- Explains *why* we rest steak before cutting it (SOLID Principles).
- Explains *how* flavors balance (Design System).
**Usage:** Agents read these to understand the "Philosophy" of your project so they make good decisions even when there isn't a specific rule.

## 5. Rules (The Health Code) 🛑
**Definition:** Strict constraints. Do's and Don'ts.
**Analogy:** The **Health & Safety Laws**.
- "Always wash hands" (No console.log).
- "Raw meat on bottom shelf" (Strict TypeScript).
**Usage:** These are non-negotiable. If an Agent breaks a Rule, the health inspector (Linter) shuts them down immediately.

---

## ⚡ Putting it all together

1. You hire a **Backend Developer (Agent)**.
2. They adhere to the **Coding Standards (Rules)** to stay safe.
3. They use their knowledge from the **Backend Guidelines** to write good code.
4. You ask them to "Add a new feature", so they follow the **Feature Start (Workflow)**.
5. During that workflow, they typically use the **Database Migration (Skill)** to update the system.
