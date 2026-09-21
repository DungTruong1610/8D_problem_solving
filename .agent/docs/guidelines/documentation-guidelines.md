# Technical Documentation Guidelines

**Version:** 1.0
**Target Audience:** Developers, Technical Writers

---

## 1. Purpose

Technical documentation serves as the knowledge base for developers working on Antigravity projects. Well-structured documentation reduces onboarding time, prevents knowledge loss, and maintains consistency across projects.

---

## 2. Documentation Types

### 2.1. Getting Started Guides
**Purpose:** Help new developers set up the development environment and run the application.

**Structure:**
- Prerequisites (required tools, versions)
- Installation steps (numbered, sequential)
- Environment setup (.env configuration)
- First run verification
- Next steps (links to other docs)

**File naming:** `01-getting-started.md`

### 2.2. Architecture Documents
**Purpose:** Explain system design, patterns, and component relationships.

**Structure:**
- System architecture diagram
- Component descriptions
- Design patterns used
- Request/response flows
- Technology stack details

**File naming:** `02-architecture.md`

### 2.3. Developer Guides
**Purpose:** Explain how to implement specific features or extend the system.

**Structure:**
- Overview of the feature/task
- Step-by-step implementation guide
- Code examples
- Best practices
- Common pitfalls

**File naming:** `06-adding-document-types.md`, `09-ui-developer-guide.md`

### 2.4. Reference Documentation
**Purpose:** Provide quick lookups for APIs, components, or configurations.

**Structure:**
- Alphabetical or logical grouping
- Each item: description, parameters, examples
- Tables for structured data

**File naming:** `10-component-reference.md`, `07-configuration.md`

### 2.5. Troubleshooting Guides
**Purpose:** Help diagnose and fix common issues.

**Structure:**
- Problem description
- Possible causes
- Step-by-step solutions
- Prevention tips

**File naming:** `08-troubleshooting.md`

---

## 3. Documentation Structure

### 3.1. File Organization

```
docs/
├── technical-docs/
│   ├── 01-getting-started.md
│   ├── 02-architecture.md
│   ├── 03-project-structure.md
│   ├── 04-data-flow.md
│   ├── 05-core-components.md
│   ├── 06-adding-features.md
│   ├── 07-configuration.md
│   ├── 08-troubleshooting.md
│   └── 09-ui-developer-guide.md
```

**Naming Convention:**
- Use numbered prefixes (01-10) for recommended reading order
- Use kebab-case for file names
- Use `.md` extension (Markdown)

### 3.2. Document Template

```markdown
# Document Title

Brief 1-2 sentence description of what this document covers.

## Section 1: [Topic]

Content...

### Subsection 1.1

Content...

## Section 2: [Topic]

Content...

## Next Steps

- Link to [Related Doc](./related-doc.md)
- See [Another Guide](./another-guide.md)
```

---

## 4. Formatting Standards

### 4.1. Headings

```markdown
# H1: Document Title (once per document)
## H2: Major sections
### H3: Subsections
#### H4: Rarely used
```

### 4.2. Code Blocks

Always specify the language for syntax highlighting:

```markdown
\`\`\`typescript
import cds from '@sap/cds';

export class MyService extends cds.ApplicationService {
    async init() {
        // Your code
    }
}
\`\`\`
```

**Supported languages:** `typescript`, `javascript`, `bash`, `json`, `yaml`, `cds`

### 4.3. File Paths

Use backticks for file and directory references:

```markdown
Edit the `srv/service.ts` file in the `handlers/` directory.
```

### 4.4. Commands

```markdown
**Terminal 1 - Backend:**
\`\`\`bash
npm start
\`\`\`

**Terminal 2 - Frontend:**
\`\`\`bash
cd app/frontend
npm run dev
\`\`\`
```

### 4.5. Tables

Use tables for structured comparisons or reference data:

```markdown
| Command | Description |
|---------|-------------|
| `npm start` | Start the CAP server |
| `npm test` | Run tests |
```

### 4.6. Callouts

Use blockquotes for important notes:

```markdown
> **Note**: This feature requires SAP AI Core credentials.

> **Warning**: Do not commit `.env` files to version control.

> **Tip**: Use `cds watch` for auto-reload during development.
```

---

## 5. Diagrams

### 5.1. ASCII Diagrams

For simple flows and architecture:

```
┌──────────────┐
│   Frontend   │
└──────────────┘
       │
       ▼ HTTP
┌──────────────┐
│   Backend    │
└──────────────┘
```

### 5.2. Mermaid Diagrams

For complex flows (rendered by GitHub, VS Code):

```markdown
\`\`\`mermaid
sequenceDiagram
    Frontend->>Backend: Upload File
    Backend->>AI Core: Extract Data
    AI Core-->>Backend: Extracted JSON
    Backend-->>Frontend: Status Update
\`\`\`
```

---

## 6. Cross-References

### 6.1. Internal Links

Link to other docs using relative paths:

```markdown
See [Architecture Overview](./02-architecture.md) for more details.

Read the [Installation Steps](./01-getting-started.md#installation) section.
```

### 6.2. Code References

Link to specific files in the codebase:

```markdown
The main service is defined in `srv/service.ts`.

Check the handler implementation in `srv/handlers/DocumentHandler.ts`.
```

### 6.3. External Links

```markdown
Learn more about [SAP CAP](https://cap.cloud.sap/).

Read the [React documentation](https://react.dev/).
```

---

## 7. Code Examples

### 7.1. Minimal Examples

Keep examples focused on the concept being explained:

```typescript
// ✅ GOOD: Focused on the pattern
this.before('CREATE', Products, (req) => {
    if (!req.data.name) return req.error(400, 'NAME_REQUIRED');
});

// ❌ BAD: Too much boilerplate
import cds from '@sap/cds';
export class ProductService extends cds.ApplicationService {
    async init() {
        const { Products } = this.entities;
        this.before('CREATE', Products, (req) => {
            if (!req.data.name) return req.error(400, 'NAME_REQUIRED');
        });
        await super.init();
    }
}
```

### 7.2. Complete Examples

For tutorials, provide full working code:

```typescript
// srv/service.ts
import cds from '@sap/cds';

export class CatalogService extends cds.ApplicationService {
    async init() {
        const { Products } = this.entities;
        
        // Validation
        this.before('CREATE', Products, this.validateProduct);
        
        return super.init();
    }
    
    private async validateProduct(req) {
        if (!req.data.name) {
            return req.error(400, 'Product name is required');
        }
    }
}
```

---

## 8. Maintenance

### 8.1. Update Frequency

- Update docs **before** merging code changes
- Review docs quarterly for accuracy
- Archive outdated docs (don't delete)

### 8.2. Version Control

- Commit docs with related code changes
- Use descriptive commit messages: `docs: update data flow diagram`

### 8.3. Ownership

- Each technical doc should have an owner (maintained in README)
- The owner reviews PRs affecting their doc

---

## 9. Checklist

Before publishing technical documentation:

- [ ] Clear title and description
- [ ] Logical section flow
- [ ] Code blocks have language specified
- [ ] All commands tested and working
- [ ] Links verified (no broken links)
- [ ] Screenshots/diagrams up-to-date
- [ ] Spelling and grammar checked
- [ ] Reviewed by at least one other developer
