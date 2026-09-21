---
name: import-discipline
description: Rules for import statements in cnma_ai_agent_extraction_ui. Critical because verbatimModuleSyntax is ON — wrong import type causes runtime crashes.
---

# Import Discipline

## The Rule

```
verbatimModuleSyntax: true  ←  in tsconfig.app.json
```

This setting makes `import type` statements **fully erased** at runtime.
Using `import type` for a runtime value = silent crash.

## Decision Table

| What you import | Correct syntax |
|----------------|----------------|
| A function, class, or object you CALL | `import { x } from '...'` |
| A type you only use in type position | `import type { T } from '...'` |
| Both in the same statement | `import { fn, type T } from '...'` |

## Examples

```ts
// ✅ Service objects — always value import
import { extractionService } from '@/services/domain/extraction/extractionService';
import { normalizeForSave } from '../utils/normalizeForSave';
import { validateWorkflowMandatoryFields } from '../utils/validateMandatoryFields';
import { toast } from '@/components/ui/sonner';

// ✅ Pure types — type import is fine
import type { ExtractedData, FieldData } from '@/services/domain/extraction/extraction.types';
import type { Schema } from './useSchema';

// ✅ Mixed — inline type keyword
import { useCallback, type FC } from 'react';
```

## Red Flags to Check After Editing Imports

1. Did you convert any `import { fn }` to `import type { fn }`?
2. Did a formatter/linter auto-convert a value import to type import?
3. Did you move a file and re-create the import as `import type`?

## After Any Import Change

Run:
```powershell
npm run typecheck
```

TypeScript with `verbatimModuleSyntax` will catch some cases,
but runtime testing is also needed for edge cases the compiler misses.
