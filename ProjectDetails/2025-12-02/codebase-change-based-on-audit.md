# Codebase Changes Based on Audit

**Date:** 2025-12-02
**Based on:** codebase-audit.md + Owner Review

This document outlines specific, actionable changes to be made based on the audit findings.

---

## Summary of Changes

| Category | Items to Change | Effort |
|----------|----------------|--------|
| Legacy/Dead Code Removal | 5 items | Low |
| Error Handling | 1 item | Low |
| Configuration | 2 items | Medium |
| UI/UX Fixes | 3 items | Low |
| Memory Leak Fixes | 2 items | Low |
| Code Consolidation | 1 item | Medium |

**Total Estimated Effort:** ~4-6 hours of focused work

---

## 1. Legacy/Dead Code Removal

### 1.1 Remove Commented-out Header in Edit Page
**File:** `src/app/edit/[fileId]/page.tsx`
**Lines:** 57-76
**Action:** Delete the entire commented JSX block for the header.
```tsx
// DELETE THIS BLOCK:
{/* <div className="flex items-center justify-between p-4 border-b...">
  ...
</div> */}
```

---

### 1.2 Remove Commented-out Multi-Column Custom Templates
**File:** `src/config/ai-column-templates.ts`
**Lines:** 224-228
**Action:** Delete the commented template group. Multi-column functionality is already implemented as part of the structured response feature.
```typescript
// DELETE THIS BLOCK:
// {
//   heading: 'Multi Column Custom Augmentations',
//   templates: Object.values(COLUMN_TEMPLATES).filter(t => t.category === 'multi-column-custom')
// }
```

---

### 1.3 Remove Deprecated loadPromptTemplate Function
**File:** `src/config/ai-column-templates.ts`
**Lines:** 199-205
**Action:** Delete the deprecated function entirely.
```typescript
// DELETE THIS FUNCTION:
/**
 * @deprecated Use loadPromptConfig instead for full configuration
 */
export async function loadPromptTemplate(templateId: string): Promise<string> {
  const config = await loadPromptConfig(templateId)
  return config.prompt_params.prompt_template
}
```
**Follow-up:** Search codebase for any usages and update to `loadPromptConfig` if found.

---

### 1.4 Remove Unused onRetry Prop in AiCell
**File:** `src/components/spreadsheet/AiCell.tsx`
**Line:** 27
**Action:** Remove the unused prop from the interface.
```typescript
// CHANGE FROM:
export interface AiCellProps {
  value: string;
  metadata?: AiCellMetadata;
  onRetry?: () => void; // For future single-cell retry  <-- DELETE THIS LINE
}

// CHANGE TO:
export interface AiCellProps {
  value: string;
  metadata?: AiCellMetadata;
}
```
**Note:** Single-cell retry will be tracked as a separate feature enhancement.

---

### 1.5 Remove TODO Comment and Associated Non-functional Button
**File:** `src/components/spreadsheet/AddColumnModal.tsx`
**Context:** There's a TODO comment about navigating to provider configuration, but the navigation doesn't work.
**Action:** Either:
- **Option A (Recommended):** Implement the navigation properly using `router.push('/settings/providers')` or opening a modal
- **Option B:** Remove the button entirely until the feature is ready

```typescript
// CURRENT (non-functional):
// TODO: Navigate to provider configuration
console.log('Navigate to provider config')

// OPTION A - Implement navigation:
router.push('/settings/providers')

// OPTION B - Remove the button/link entirely
```

---

## 2. Error Handling Improvements

### 2.1 Add Toast for loadPromptConfig Failures
**File:** `src/config/ai-column-templates.ts`
**Lines:** 186-195
**Action:** Import toast and show user-friendly error message.

**Current:**
```typescript
} catch (error) {
  console.error(`Error loading prompt config ${templateId}:`, error)
  throw error
}
```

**Change to:**
```typescript
import { toast } from 'sonner'

// In the catch block:
} catch (error) {
  console.error(`Error loading prompt config ${templateId}:`, error)
  toast.error(`Failed to load template "${templateId}"`, {
    description: 'Please try again or select a different template.'
  })
  throw error
}
```

**Note:** The calling component should also handle this gracefully in its try/catch.

---

## 3. Configuration Changes

### 3.1 Make Batch Size Configurable in Provider Modal
**Current Location:** `src/app/api/generate-column/route.ts:92`
**Current Value:** Hardcoded `BATCH_SIZE = 5`

**Action:** Move batch size to provider configuration.

**Step 1:** Add to provider settings type in `src/config/provider-settings.ts`:
```typescript
export interface ProviderConfig {
  apiKey: string
  enabled: boolean
  capabilities: ProviderCapabilities
  baseUrl?: string
  batchSize?: number  // ADD THIS - default to 5
}
```

**Step 2:** Add UI control in the provider configuration modal to set batch size per provider (1-20 range suggested).

**Step 3:** Update `route.ts` to read from provider config:
```typescript
const batchSize = providerConfig?.batchSize ?? 5
```

---

### 3.2 Make Few-Shot Example Count Configurable in Retry Modal
**Current Location:** `src/lib/few-shot-sampling.ts:73`
**Current Value:** Hardcoded `.slice(0, 5)` for fields

**Action:** Add a configuration option in the Retry Modal UI to control:
- Maximum number of few-shot examples (currently max 10 randomly selected)
- Number of fields to show per example (currently 5)

**File to update:** `src/components/spreadsheet/RetryModal.tsx`

Add a collapsible "Advanced Options" section with:
```typescript
<div className="space-y-2">
  <Label>Max examples to include</Label>
  <Slider min={1} max={15} value={maxExamples} onChange={setMaxExamples} />
</div>
```

---

## 4. UI/UX Fixes

### 4.1 Fix Hardcoded Gray Color for Row Numbers
**File:** `src/components/spreadsheet/SpreadsheetTable.tsx`
**Line:** 436
**Action:** Replace hardcoded color with theme-aware class.

```tsx
// CHANGE FROM:
<td className="w-16 h-24 border bg-gray-50 text-center text-sm text-gray-600">

// CHANGE TO:
<td className="w-16 h-24 border bg-muted text-center text-sm text-muted-foreground">
```

---

### 4.2 Replace Browser confirm() with Styled Dialog
**File:** `src/components/spreadsheet/SpreadsheetTable.tsx`
**Line:** 323
**Action:** Replace native `confirm()` with AlertDialog component.

**Current:**
```typescript
if (confirm(`Are you sure you want to delete the column "${column.name}"?`)) {
```

**Change to:** Use `@/components/ui/alert-dialog`:
```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

// Wrap delete button in AlertDialog
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="ghost" size="sm">
      <Trash2 className="h-4 w-4" />
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Column</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to delete "{column.name}"? This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={() => handleDeleteColumn(column.id)}>
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

### 4.3 Add Loading State for Column Delete
**File:** `src/components/spreadsheet/SpreadsheetTable.tsx`
**Lines:** 317-331
**Action:** Add loading state and disable button during deletion.

```typescript
const [deletingColumnId, setDeletingColumnId] = useState<string | null>(null)

const handleDeleteColumn = async (columnId: string) => {
  setDeletingColumnId(columnId)
  try {
    await onDeleteColumn(columnId)
  } finally {
    setDeletingColumnId(null)
  }
}

// In the AlertDialogAction:
<AlertDialogAction
  onClick={() => handleDeleteColumn(column.id)}
  disabled={deletingColumnId === column.id}
>
  {deletingColumnId === column.id ? 'Deleting...' : 'Delete'}
</AlertDialogAction>
```

---

## 5. Memory Leak Fixes

### 5.1 Clean Up Drag Event Listeners on Unmount
**File:** `src/components/spreadsheet/SpreadsheetTable.tsx`
**Lines:** 146-174
**Action:** Add cleanup in useEffect for unmount scenario.

```typescript
useEffect(() => {
  // Clean up any lingering event listeners on unmount
  return () => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }
}, [])
```

**Note:** Store `handleMouseMove` and `handleMouseUp` as refs or stable callbacks to ensure proper cleanup.

---

### 5.2 Add Cache Clearing Mechanism for Parser
**File:** `src/lib/format-parser.ts`
**Line:** 38
**Action:** Export a function to clear the cache and call it when navigating away or on explicit user action.

```typescript
// Add export:
export function clearParserCache(): void {
  flattenCache.clear()
  console.log('[Parser] Cache cleared')
}

// Consider calling this:
// 1. On file delete
// 2. On "Clear All Files" action
// 3. Optionally on route change via useEffect cleanup
```

---

## 6. Code Consolidation

### 6.1 Provider Definitions Analysis

**Finding:** Two provider definition files exist with overlap:

| File | Export | Usage Count |
|------|--------|-------------|
| `src/config/provider-settings.ts` | `PROVIDER_META` | **13+ usages** |
| `src/lib/providers.ts` | `INFERENCE_PROVIDERS` | 3 usages (internal only) |

**Recommendation:** Keep `PROVIDER_META` in `provider-settings.ts` as the source of truth.

**Action:**
1. Migrate any unique fields from `INFERENCE_PROVIDERS` to `PROVIDER_META` (e.g., `url`, `models`, `pricing`)
2. Update `src/lib/providers.ts` to derive its data from `PROVIDER_META`
3. Consider deprecating `INFERENCE_PROVIDERS` entirely

**Files to update:**
- `src/lib/providers.ts` - Refactor to use `PROVIDER_META`
- Potentially merge provider capabilities into one unified structure

---

## Implementation Order

Suggested order for implementing these changes:

### Phase 1: Quick Wins (< 1 hour)
1. 1.1 - Remove commented header
2. 1.2 - Remove commented templates
3. 1.3 - Remove deprecated function
4. 1.4 - Remove unused prop
5. 4.1 - Fix hardcoded color

### Phase 2: UI Improvements (1-2 hours)
1. 4.2 - Replace confirm() with AlertDialog
2. 4.3 - Add loading state for delete
3. 1.5 - Fix or remove TODO navigation

### Phase 3: Error Handling & Memory (1 hour)
1. 2.1 - Add toast for template errors
2. 5.1 - Clean up drag listeners
3. 5.2 - Add cache clearing

### Phase 4: Configuration (2-3 hours)
1. 3.1 - Batch size in provider modal
2. 3.2 - Few-shot example count in retry modal
3. 6.1 - Provider consolidation (optional, lower priority)

---

## Items Explicitly Ignored

Per owner review, the following audit items are NOT being addressed:

- **Section 2 (Type Safety):** Acceptable for side project
- **Section 3.3 & 3.4:** Error boundary and promise rejection warnings
- **Section 4.1-4.7:** Edge cases (empty file, long names, unicode, etc.)
- **Section 5.2 & 5.3:** Cache size and sample size configuration
- **Section 8.1 & 8.2:** Security considerations (API key logging, input sanitization)
- **Section 9.2 & 9.3:** Date format and import style inconsistencies

---

## Related Documents

- **Feature Enhancements:** See `feature-enhancements.md` for:
  - Single-cell retry functionality
  - Export functionality
  - HuggingFace integration improvements
  - Embedding Atlas deep integration
