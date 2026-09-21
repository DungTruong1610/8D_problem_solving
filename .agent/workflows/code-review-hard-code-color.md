---
description: Audit and fix hardcoded Tailwind color classes, replacing them with semantic design tokens
---

# Hardcoded Color Audit & Fix Workflow

Use this workflow to find and replace hardcoded Tailwind color classes with semantic design tokens.
Run from the **frontend project root** (the folder containing `tsconfig.app.json` and `src/`).

---

## Phase 1: Discovery — Auto-Detect Affected Folders

// turbo
```bash
echo "========================================" && echo "  HARDCODED COLOR AUDIT — DISCOVERY" && echo "========================================" && echo "" && echo "--- Affected Folders (grouped by top-level) ---" && grep -rl --include="*.tsx" -E "(text|bg|border|ring|fill|from|to|via)-(red|blue|green|yellow|orange|purple|pink|indigo|teal|cyan|emerald|violet|amber|sky|slate|gray|grey)-[0-9]+" src/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/" | sed 's|/[^/]*$||' | sort -u | while read dir; do count=$(grep -rl --include="*.tsx" -E "(text|bg|border|ring|fill|from|to|via)-(red|blue|green|yellow|orange|purple|pink|indigo|teal|cyan|emerald|violet|amber|sky|slate|gray|grey)-[0-9]+" "$dir" 2>/dev/null | grep -v "demos/" | wc -l); total=$(grep -rn --include="*.tsx" -E "(text|bg|border|ring|fill|from|to|via)-(red|blue|green|yellow|orange|purple|pink|indigo|teal|cyan|emerald|violet|amber|sky|slate|gray|grey)-[0-9]+" "$dir" 2>/dev/null | grep -v "demos/" | wc -l); echo "  📁 $dir — $count file(s), $total instance(s)"; done && echo "" && echo "--- Total ---" && total=$(grep -rn --include="*.tsx" -E "(text|bg|border|ring|fill|from|to|via)-(red|blue|green|yellow|orange|purple|pink|indigo|teal|cyan|emerald|violet|amber|sky|slate|gray|grey)-[0-9]+" src/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/" | wc -l) && echo "  🎯 $total hardcoded color instance(s) found" && echo ""
```

After running this, the agent should:

1. **Parse the output** to identify all affected folders and their instance counts
2. **Create a task list** in `task.md` with one task per affected folder, ordered by instance count (most → fewest)
3. **Process each folder** as a separate phase below

> [!IMPORTANT]
> Do NOT proceed to Phase 2 until the discovery scan is complete.
> Create the task list dynamically based on the discovered folders.

---

## Phase 2: Fix — Process Each Affected Folder

For **each folder** discovered in Phase 1, repeat these sub-steps:

### 2a. List Files in Current Folder

// turbo
```bash
grep -rn --include="*.tsx" -E "(text|bg|border|ring|fill|from|to|via)-(red|blue|green|yellow|orange|purple|pink|indigo|teal|cyan|emerald|violet|amber|sky|slate|gray|grey)-[0-9]+" <FOLDER_PATH> 2>/dev/null | grep -v "demos/"
```

Replace `<FOLDER_PATH>` with the actual folder path from Phase 1.

### 2b. View & Fix Each File

For each file:
1. `view_file` to see context around each hardcoded color
2. Determine the **semantic meaning** (is it a status? error? info? accent? drag state?)
3. Apply replacements using the token mapping table below
4. Use `multi_replace_file_content` for multiple non-contiguous edits in one file

### 2c. Verify Folder is Clean

// turbo
```bash
grep -rn --include="*.tsx" -E "(text|bg|border|ring|fill|from|to|via)-(red|blue|green|yellow|orange|purple|pink|indigo|teal|cyan|emerald|violet|amber|sky|slate|gray|grey)-[0-9]+" <FOLDER_PATH> 2>/dev/null | grep -v "demos/" | wc -l
```

**Must be 0** before moving to next folder. Mark the folder as `[x]` in `task.md`.

---

## Phase 3: Final Verification

// turbo
```bash
echo "========================================" && echo "  FINAL VERIFICATION" && echo "========================================" && remaining=$(grep -rn --include="*.tsx" -E "(text|bg|border|ring|fill|from|to|via)-(red|blue|green|yellow|orange|purple|pink|indigo|teal|cyan|emerald|violet|amber|sky|slate|gray|grey)-[0-9]+" src/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/" | wc -l) && echo "" && if [ "$remaining" -eq 0 ]; then echo "  ✅ PASS — 0 hardcoded colors remaining in production code"; else echo "  ❌ FAIL — $remaining hardcoded color(s) still found:"; echo ""; grep -rn --include="*.tsx" -E "(text|bg|border|ring|fill|from|to|via)-(red|blue|green|yellow|orange|purple|pink|indigo|teal|cyan|emerald|violet|amber|sky|slate|gray|grey)-[0-9]+" src/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/"; fi
```

---

## Semantic Token Mapping Reference

### Core Mapping Table

| Hardcoded Color | Foreground | Background | Border |
|----------------|-----------|-----------|--------|
| `red-*` | `text-destructive` | `bg-error-bg` | `border-destructive/30` |
| `green-*`, `emerald-*`, `teal-*` | `text-success` | `bg-success-bg` | `border-success/30` |
| `amber-*`, `yellow-*`, `orange-*` | `text-warning` | `bg-warning-bg` | `border-warning/30` |
| `blue-*`, `sky-*`, `cyan-*` | `text-info` | `bg-info-bg` | `border-info/30` |
| `purple-*`, `violet-*`, `indigo-*` | `text-accent-foreground` | `bg-accent` | `border-accent-foreground/30` |
| `gray-*`, `slate-*` | `text-muted-foreground` | `bg-muted` | `border-border` |

### Opacity Variants

| Original Shade | Replacement |
|---------------|-------------|
| `*-700`, `*-800` (dark text) | `text-{token}` (full) |
| `*-500`, `*-600` (medium) | `text-{token}` or `text-{token}/80` |
| `*-400` (light) | `text-{token}/60` |
| `*-300` (very light) | `text-{token}/40` |
| `*-50`, `*-100` (bg tint) | `bg-{token}-bg` |
| `*-200` (border) | `border-{token}/30` |
| `ring-*-200` (subtle ring) | `ring-{token}/30` |
| `ring-*-400`+ (strong ring) | `ring-{token}` |

### Confidence Scores

| Pattern | Replacement |
|---------|-------------|
| `bg-green-100 text-green-700` (≥80%) | `bg-confidence-high/15 text-confidence-high` |
| `bg-orange-100 text-orange-700` (≥50%) | `bg-confidence-medium/15 text-confidence-medium` |
| `bg-red-100 text-red-700` (<50%) | `bg-confidence-low/15 text-confidence-low` |

### Special Cases

| Pattern | Replacement | Notes |
|---------|-------------|-------|
| `bg-slate-900` (dark code bg) | `bg-foreground/95` | Code viewers |
| `text-gray-800` (heading) | `text-foreground` | Main headings |
| `border-gray-100` | `border-border` | Subtle dividers |
| `fill-amber-500` | `fill-warning` | Icon fills |
| `ring-blue-500` (selected state) | `ring-primary` | Selected items |

---

## Exceptions — Files to Skip

- `src/components/demos/` — intentional color showcases
- Color picker components — need raw colors by design
- Third-party component style overrides

## Theme Reference Files

Review these files to see available tokens before starting:
- `src/styles/theme.css` — semantic design tokens
- `src/styles/index.css` — global CSS variables
- `tailwind.config.ts` — Tailwind theme extension
