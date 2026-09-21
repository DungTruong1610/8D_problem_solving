# Dynamic Studio & Runtime UI Architecture

**Version**: 1.3 (Revised based on Feedback)
**Context**: Generic Metadata-Driven UI Pattern
**Target Audience**: Software Architects, React Developers, AI Coding Agents

---

## 1. Executive Summary

This concept describes a **Metadata-Driven Architecture** where application business objects (e.g., "Activities", "Tasks", "Requests") are defined dynamically at runtime rather than hardcoded.

The system consists of two distinct parts:
1.  **The Studio (Design-Time)**: An Admin UI for defining object types, field layouts, and workflows using a Drag-and-Drop interface. It produces a JSON Schema.
2.  **The Runtime (Run-Time)**: A generic engine (`DynamicForm`) that interprets the JSON Schema to render functioning UI forms and validated data payloads on the fly.

**Value Proposition**:
-   **Agility**: New business objects can be created in minutes without code deployments.
-   **Consistency**: A single rendering engine ensures all forms look and behave consistently.
-   **AI-Friendliness**: The structured JSON schema is easily readable and generatable by LLMs.

---

## 2. Business Logic & Concept

### The "Definition" vs. "Instance" Model

The core pattern distinguishes between the **Type Configuration** (Definition) and the **Actual Data** (Instance).

| Concept | Description | Example |
| :--- | :--- | :--- |
| **Object Definition** | Holds the configuration, layout, and rules. Stored as a row in a "Definitions" table. | `"Document Approval Type"` |
| **Layout Schema** | A JSON blob stored in the Definition describing the form fields, nested sections, and types. | `{"sections": [...]}` |
| **Object Instance** | The actual transaction data created by users. It references the Definition. | `"Doc-001" (Type: Document Approval)` |
| **Additional Info** | A JSON column in the Instance that stores all dynamic field data defined by the schema. | `{"priority": "Low", "reviewer": "John"}` |

### The Workflow
1.  **Admin** goes to **Studio**, creates a "Purchase Request" type.
2.  **Admin** drags fields (Item Name, Cost, Vendor) onto the canvas.
3.  **System** saves this as a JSON `layoutSchema`.
4.  **User** goes to "Create Activity", selects "Purchase Request".
5.  **Runtime** fetches the schema and renders the inputs.
6.  **User** saves. Data is stored as `{"Item Name": "Laptop", "Cost": 2000}` in the `additionalInfo` column.

---

## 3. Technical Architecture (The Engine)

To implement this in a new project, you need the following components.

### 3.1 Data Model (Database)

You need a Definition entity and an Instance entity.

**Example (CDS/SQL Schema):**
```cds
entity ObjectDefinitions {
    // ...keys...
    layoutSchema : LargeString; // Stores the JSON UI definition
    statusConfig : LargeString; // Stores workflow states JSON
}

// OPTIONAL: Centralized Value Help Table for Admin Maintenance
entity ManagedLists {
    key code : String(50); // e.g., "COST_CENTERS"
    name     : String(100);
}
entity ManagedListValues {
    key parent_code : String(50);
    key key         : String(50);
    label           : String(100); // Fallback label
    i18nKey         : String(100); // Translation key
}
```

### 3.2 The Layout Schema Structure (JSON)

This contract must support flexible nesting and Advanced Value Help.

```typescript
interface LayoutSchema {
    version: string;
    sections: LayoutNode[];
}

interface LayoutNode {
    id: string;
    type: 'Section' | 'Table';
    title?: string;
    path?: string;
    fields?: FieldDef[];
    columns?: FieldDef[];
    children?: LayoutNode[];
}

interface FieldDef {
    // Identity
    id: string;
    key: string;
    
    // Display
    label: string;
    i18nKey?: string;
    placeholder?: string;
    
    // Control
    controlType: string; // 'Input', 'Select', 'UserPicker', etc.
    dataType: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
    
    // --- ADVANCED VALUE HELP CONFIGURATION ---
    valueHelp?: {
        // 'Static': Fixed array defined in JSON (Good for tiny, unchanging lists like Gender)
        // 'Reference': Points to a managed list in DB (Admin can update via UI)
        // 'Dynamic': Points to a live Entity or OData service (e.g. Suppliers)
        type: 'Static' | 'Reference' | 'Dynamic';

        // For 'Static'
        items?: ValueHelpItem[];

        // For 'Reference'
        listCode?: string; // e.g. "OFFICE_LOCATIONS"

        // For 'Dynamic'
        source?: {
            entity: string;       // e.g. "Suppliers" (CDS Entity Name)
            valueField: string;   // e.g. "supplierID"
            displayField: string; // e.g. "supplierName"
            filter?: string;      // OData filter (e.g. "active eq true")
        };
    };
    
    // Validation
    mandatory: boolean;
    readOnly: boolean;
    optional: boolean;
    constraints?: {
        maxLength?: number;
        regex?: string;
        // ...
    };
}

interface ValueHelpItem {
    key: string;
    label: string;
    i18nKey?: string; // Supports multi-language via translation files
}
```

### 3.3 Frontend Components (React)

#### A. `DynamicForm` + `ComponentRegistry`
The factory that delegates rendering.

#### B. `FieldRenderer` (Value Help Logic)
This component must handle the complexity of `valueHelp`:
1.  **Static**: Render `field.valueHelp.items` directly.
2.  **Reference**: Fetch `ManagedListValues` where `parent_code == field.valueHelp.listCode`. Cache this.
3.  **Dynamic**: Perform an OData/API query to `field.valueHelp.source.entity`. Support search/filtering.

#### C. `FormStudio` (The Architect)
*   **Property Panel for Selects**:
    *   Dropdown to choose "Source Type": Static, Managed List, or Dynamic Entity.
    *   **Static**: Simple table to add Key/Labels/i18nKeys.
    *   **Managed**: Dropdown showing available `ManagedLists`.
    *   **Dynamic**: Input for Entity Name and Fields.

### 3.4 Backend Validation
Logic remains similar but must validate `valueHelp` if "Strict Limit" is enabled (checking if value exists in the source).

---

## 4. Implementation Guide for AI Agents

To ask an AI code agent to build this system, provide the following specific contexts:

### Step 1: Prompt for Data Layer
> "Create a generic Entity called 'Ticket' and a 'TicketDefinition'. Also create a 'ManagedList' and 'ManagedListValues' entity to store centralized dropdown options manageable by admins."

### Step 2: Prompt for Runtime Engine
> "Create a `DynamicForm` engine.
> - Implement a `FieldRenderer` that handles a `valueHelp` object.
> - If type is 'Static', use provided array (respecting `i18nKey`).
> - If type is 'Reference', fetch from `/ManagedLists`.
> - If type is 'Dynamic', fetch from the specified Entity (e.g. `/Suppliers`)."

### Step 3: Prompt for Studio
> "Create a 'FormStudio' page.
> - Right Sidebar Properties: For 'Select' controls, allow configuring the Data Source.
> - Option 1: Static List (Add/Edit items inline).
> - Option 2: Managed List (Select from existing Admin lists).
> - Option 3: Dynamic Entity (Specify Entity Name, Key Field, Display Field)."

---

## 6. Form Schema Tab (Request Type Studio)

The **Form Schema Tab** allows admins to design the data capture form for each workflow step.

### 6.1 UI Components

| Component | Description |
|:---|:---|
| **Left Palette** | Contains draggable elements: Layout (Section, Table) and Fields (Text, Number, Date, Select, Checkbox, Radio). |
| **Center Canvas** | Drop zone where schema is visually composed. Shows live preview of sections and fields. |
| **Right Panel (Field Properties)** | Contextual panel that appears when a field is selected, allowing configuration of label, validation, value help, etc. |

### 6.2 Drag-and-Drop Behavior

1. **Palette → Canvas**: Adds a new top-level item (section, table, or field).
2. **Palette → Section**: Adds a field inside a section's `fields[]` array.
3. **Palette → Table**: Adds a column to the table's `columns[]` array.
4. **Canvas Reordering**: Future enhancement – drag within canvas to reorder items.

### 6.3 Data Model Mapping

| UI Concept | Schema Property | Storage |
|:---|:---|:---|
| Canvas Items | `schema: UiCanvasItem[]` | Zustand store → `layoutSchema` JSON in DB |
| Section | `type: 'section'`, `fields: UiFormField[]` | Nested array |
| Table | `type: 'table'`, `columns: FieldDef[]` | Nested array |
| Standalone Field | `type: 'text' | 'number' | ...` | Top-level in array |

---

## 7. Field Properties Panel

When a field or section is selected, the **Field Properties Panel** slides in from the right.

### 7.1 Available Properties

| Property | Type | Description |
|:---|:---|:---|
| `label` | String | Display name shown to users. |
| `placeholder` | String | Hint text inside input controls. |
| `helpText` | String | Guidance text below the field. |
| `required` | Boolean | Whether the field is mandatory. |
| `readOnly` | Boolean | Whether the field is non-editable. |
| `validationType` | Enum | `none`, `email`, `phone`, `url`, `number`, `custom`. |
| `defaultValue` | Any | Pre-filled value for new instances. |
| `valueHelp` | Object | Configuration for dropdowns (see Section 3.2). |

### 7.2 Value Help Configuration (for Select/Radio)

The panel should provide a dropdown to choose the value help type:

| Type | UI in Panel | Schema Output |
|:---|:---|:---|
| **Static** | Inline table to add key/label pairs. | `valueHelp: { type: 'Static', items: [...] }` |
| **Reference** | Dropdown of existing `ManagedLists`. | `valueHelp: { type: 'Reference', listCode: 'COST_CENTERS' }` |
| **Dynamic** | Inputs for Entity, Key Field, Display Field. | `valueHelp: { type: 'Dynamic', source: { entity: ..., ... } }` |

### 7.3 Actions

- **Duplicate Field**: Creates a copy with a new ID.
- **Delete Field**: Removes from schema.

---

## 8. Key File Patterns (Reference)

*   **`useFormState.ts`**: Handle deep nested state.
*   **`fieldControl.ts` (Backend)**: Recursive validation.
*   **`ValueHelpProvider.tsx`**: (New) A React Context or Hook that centralizes fetching and caching of Managed/Dynamic lists to avoid prop drilling.
*   **`SchemaTab.tsx`**: Form Schema canvas and palette.
*   **`RightPanel.tsx`**: Field Properties panel renderer.

