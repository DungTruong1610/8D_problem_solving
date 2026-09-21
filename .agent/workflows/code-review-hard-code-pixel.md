---
description: Audit and fix arbitrary pixel/sizing values in Tailwind classNames, replacing them with the standard spacing/type scale
---

# Hardcoded Pixel Audit & Fix Workflow

Use this workflow to find and replace arbitrary Tailwind bracket values (`[10px]`, `[600px]`, `[14px]`) and inline `style` pixel values with proper Tailwind scale utilities.
Run from the **frontend project root** (the folder containing `tsconfig.app.json` and `src/`).

---

## Phase 1: Discovery — Auto-Detect Affected Files

// turbo
```bash
echo "========================================" && echo "  ARBITRARY PIXEL AUDIT — DISCOVERY" && echo "========================================" && echo "" && echo "--- Arbitrary Tailwind bracket values (px/rem/em in className) ---" && grep -rn --include="*.tsx" -E "\-\[[0-9]+(px|rem|em|vh|vw|%)\]" src/pages/ src/components/common/ src/components/filterbar/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/" | head -80 && echo "" && echo "--- Arbitrary hex color values in className ---" && grep -rn --include="*.tsx" -E "\[#[0-9a-fA-F]{3,6}\]" src/pages/ src/components/common/ src/components/filterbar/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/" | head -40 && echo "" && echo "--- Inline style with pixel values ---" && grep -rn --include="*.tsx" -E "style=\{\{[^}]*(padding|margin|width|height|fontSize|gap|top|left|right|bottom)[^}]*[0-9]+px" src/pages/ src/components/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/" | head -40 && echo "" && echo "--- Affected Folders ---" && grep -rl --include="*.tsx" -E "\-\[[0-9]+(px|rem|em|vh|vw|%)\]|\[#[0-9a-fA-F]{3,6}\]" src/pages/ src/components/common/ src/components/filterbar/ 2>/dev/null | grep -v "demos/" | sed 's|/[^/]*$||' | sort -u | while read dir; do count=$(grep -rn --include="*.tsx" -E "\-\[[0-9]+(px|rem|em|vh|vw|%)\]|\[#[0-9a-fA-F]{3,6}\]" "$dir" 2>/dev/null | grep -v "demos/" | wc -l); echo "  📁 $dir — $count instance(s)"; done && echo "" && echo "--- Total ---" && total=$(grep -rn --include="*.tsx" -E "\-\[[0-9]+(px|rem|em|vh|vw|%)\]|\[#[0-9a-fA-F]{3,6}\]" src/pages/ src/components/common/ src/components/filterbar/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/" | wc -l) && echo "  🎯 $total arbitrary value instance(s) found"
```

After running this, the agent should:
1. **Parse the output** to identify all affected folders and instance counts
2. **Create a task list** in `task.md` with one task per affected folder, ordered by instance count (most → fewest)
3. **Process each folder** as a separate phase below

> [!IMPORTANT]
> Do NOT proceed to Phase 2 until the discovery scan is complete.

---

## Phase 2: Fix — Process Each Affected Folder

For **each folder** discovered in Phase 1, repeat these sub-steps:

### 2a. List Files in Current Folder

// turbo
```bash
grep -rn --include="*.tsx" -E "\-\[[0-9]+(px|rem|em|vh|vw|%)\]|\[#[0-9a-fA-F]{3,6}\]" <FOLDER_PATH> 2>/dev/null | grep -v "demos/"
```

Replace `<FOLDER_PATH>` with the actual folder path from Phase 1.

### 2b. View & Fix Each File

For each file:
1. `view_file` to see context around each arbitrary value
2. Determine the **intent** (is it a spacing? sizing? color?)
3. Apply replacements using the **Tailwind Scale Reference** below
4. If it's a color, apply the semantic token mapping (see `../code-review-hard-code-color.md`)
5. Use `multi_replace_file_content` for multiple edits in one file

### 2c. Verify Folder is Clean

// turbo
```bash
grep -rn --include="*.tsx" -E "\-\[[0-9]+(px|rem|em|vh|vw|%)\]|\[#[0-9a-fA-F]{3,6}\]" <FOLDER_PATH> 2>/dev/null | grep -v "demos/" | wc -l
```

**Must be 0** before moving to the next folder. Mark the folder as `[x]` in `task.md`.

---

## Phase 3: Final Verification

// turbo
```bash
echo "========================================" && echo "  FINAL VERIFICATION" && echo "========================================" && remaining=$(grep -rn --include="*.tsx" -E "\-\[[0-9]+(px|rem|em|vh|vw|%)\]|\[#[0-9a-fA-F]{3,6}\]" src/pages/ src/components/common/ src/components/filterbar/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/" | wc -l) && echo "" && if [ "$remaining" -eq 0 ]; then echo "  ✅ PASS — 0 arbitrary pixel/color values remaining in production code"; else echo "  ❌ FAIL — $remaining arbitrary value(s) still found:"; echo ""; grep -rn --include="*.tsx" -E "\-\[[0-9]+(px|rem|em|vh|vw|%)\]|\[#[0-9a-fA-F]{3,6}\]" src/pages/ src/components/common/ src/components/filterbar/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/"; fi
```

---

## Tailwind Spacing Scale Reference (4px base)

Use this to convert pixel values to Tailwind scale utilities.

| Pixels | Tailwind | Applies to |
|--------|----------|-----------|
| 1px | `*-px` | border, outline |
| 2px | `*-0.5` | - |
| 4px | `*-1` | - |
| 6px | `*-1.5` | - |
| 8px | `*-2` | most common small gap |
| 10px | `*-2.5` | - |
| 12px | `*-3` | - |
| 14px | `*-3.5` | - |
| 16px | `*-4` | standard padding |
| 20px | `*-5` | - |
| 24px | `*-6` | - |
| 28px | `*-7` | - |
| 32px | `*-8` | - |
| 40px | `*-10` | button height `h-10` |
| 44px | `*-11` | - |
| 48px | `*-12` | - |
| 64px | `*-16` | - |
| 80px | `*-20` | - |
| 96px | `*-24` | - |

> `*` = `p`, `m`, `gap`, `w`, `h`, `space-x`, `space-y`, `inset`, `top`, `left`, etc.

### Width / Max-Width

| Arbitrary | Tailwind Alternative |
|-----------|---------------------|
| `w-[600px]` | `w-full max-w-2xl` (672px) |
| `w-[400px]` | `w-full max-w-sm` (384px) |
| `w-[800px]` | `w-full max-w-3xl` (768px) |
| `w-[100%]` | `w-full` |
| `min-w-[200px]` | `min-w-48` (192px) or `min-w-52` (208px) |

### Font Size

| Arbitrary | Tailwind |
|-----------|----------|
| `text-[10px]` | `text-xs` (12px) |
| `text-[12px]` | `text-xs` (12px) |
| `text-[13px]` | `text-sm` (14px) — round up |
| `text-[14px]` | `text-sm` (14px) |
| `text-[16px]` | `text-base` (16px) |
| `text-[18px]` | `text-lg` (18px) |
| `text-[20px]` | `text-xl` (20px) |
| `text-[24px]` | `text-2xl` (24px) |

### Height (Common UI Elements)

| Use Case | Tailwind |
|----------|----------|
| Icon button (32px) | `h-8 w-8` |
| Input / button default (36px) | `h-9` |
| Input / button large (40px) | `h-10` |
| Row height (48px) | `h-12` |
| Card header (64px) | `h-16` |

---

## Exceptions — Values That May Stay

Some arbitrary values are acceptable in design system primitives only:

- `button.tsx`, `input.tsx`, `badge.tsx` — design system core (ask before changing)
- Animation keyframe values — e.g., `translate-y-[2px]` for micro-interactions
- Third-party component overrides — document with a comment explaining why

Add a comment when keeping an arbitrary value: `{/* kept: exact px required for [reason] */}`

---

## Semantic Token for Colors Found in Brackets

If you encounter `bg-[#b10e10]` or `text-[#6a6d70]`, use the token mapping:

| Hex | Semantic Token |
|-----|---------------|
| `#b10e10` / `#990c0e` | `bg-primary` / `text-primary` |
| `#6a6d70` | `text-muted-foreground` |
| `#32363a` | `text-foreground` |
| `#edeff0` | `bg-background` |
| `#ffffff` | `bg-card` |
| `#d9d9d9` | `border-border` |
| `#256f3a` | `text-success` / `bg-success-bg` |
| `#aa0808` / `#e90b0b` | `text-destructive` / `bg-error-bg` |
| `#e76500` | `text-warning` / `bg-warning-bg` |
| `#0070f2` | `text-info` / `bg-info-bg` |

For unknown hex values, inspect your project's design system theme CSS (e.g., `node_modules/@cnma/react-ui/dist/theme.css` or equivalent) to find the matching semantic token.
