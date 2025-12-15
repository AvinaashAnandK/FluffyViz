# PromptComposer Manual Testing Guide

## Status: Ready for Testing
**Date**: October 10, 2025
**Dev Server**: http://localhost:3001
**Sample Data**: `public/sample-data/sample-turn-level.csv`

---

## Critical Bug Fixed

### Bug: Variable ID Mismatch in @ Trigger Flow
**Location**: `src/components/spreadsheet/PromptComposer.tsx:165-184`

**Issue**: Variable ID was generated twice with `Date.now()`, causing mapping to fail:
```typescript
// BEFORE (BUGGY)
editor.chain().focus().insertVariable({
  id: `var_${Date.now()}`,  // ID #1
  ...
}).run()

const varId = `var_${Date.now()}`  // ID #2 - different!
setMappings(prev => ({ ...prev, [varId]: column }))
```

**Fix**: Generate ID once and reuse:
```typescript
// AFTER (FIXED)
const varId = `var_${Date.now()}`  // Generate once

editor.chain().focus().insertVariable({
  id: varId,  // Use same ID
  ...
}).run()

setMappings(prev => ({ ...prev, [varId]: column }))  // Same ID
```

**Impact**: This bug would have prevented the @ trigger from creating properly mapped pills. Pills would appear but wouldn't serialize correctly.

---

## Prerequisites

1. **Start Dev Server** (if not already running):
   ```bash
   cd /Users/avinaash/Documents/FluffyViz/fluffy-viz
   npm run dev
   ```
   Server should be at: http://localhost:3001

2. **Prepare Test Data**:
   - File: `public/sample-data/sample-turn-level.csv`
   - Contains columns: `user_message`, `assistant_message`, `model`, `timestamp`, etc.

---

## Test Plan

### Test 1: Template Mode - Load Template with Pre-configured Pills

**Steps**:
1. Navigate to http://localhost:3001
2. Click **"Upload File"**
3. Select `sample-turn-level.csv` from desktop (or upload via drag-drop)
4. Spreadsheet editor opens automatically
5. Click **"Add AI Column"** button (top-right)
6. AddColumnModal drawer opens from right side
7. Select **"Sentiment Analysis"** template from dropdown

**Expected Results**:
- ✅ Template loads in PromptComposer editor
- ✅ Template text appears: "Analyze the sentiment of the following text..."
- ✅ One **gray dashed pill** appears with text "Text to Analyze"
- ✅ Pill tooltip shows: "The text content to analyze for sentiment"
- ✅ Yellow warning banner shows: "⚠ Map required fields: Text to Analyze"
- ✅ Submit button is **disabled**

**Screenshots to capture**:
- Initial state with gray dashed pill
- Warning banner

---

### Test 2: Map Variable by Clicking Pill

**Steps** (continuing from Test 1):
1. Click the **gray dashed pill** "Text to Analyze"
2. ColumnCombobox dropdown opens

**Expected Results**:
- ✅ Dropdown appears near the pill
- ✅ Shows searchable list of columns:
  - `turn_id`
  - `session_id`
  - `user_id`
  - `timestamp`
  - `user_message` ← This one has text content
  - `assistant_message` ← This one too
  - `model`
  - etc.
- ✅ Each column shows **preview value** from first row
  - Example: `user_message` → "What is the capital of France?"
- ✅ Search box is functional

**Steps (continue)**:
3. Click **"user_message"** from dropdown

**Expected Results**:
- ✅ Dropdown closes
- ✅ Pill turns **orange** (solid background)
- ✅ Pill text shows mapped column: "User Message" (formatted)
- ✅ Yellow warning banner **disappears**
- ✅ Submit button becomes **enabled**

**Screenshots to capture**:
- Dropdown open with column list and previews
- Orange pill after mapping

---

### Test 3: Preview Interpolated Prompt

**Steps** (continuing from Test 2):
1. Click **"Preview Interpolated Prompt"** accordion (below editor)
2. Accordion expands

**Expected Results**:
- ✅ Preview shows serialized prompt with `{{column_slug}}` syntax:
  ```
  Analyze the sentiment of the following text:

  {{user_message}}

  Classify as: Positive, Negative, or Neutral
  Provide only the classification.
  ```
- ✅ Preview updates in real-time if you edit text in editor

**Screenshots to capture**:
- Preview accordion expanded

---

### Test 4: @ Trigger - Insert Column on the Fly

**Steps**:
1. Click in the editor (in empty space)
2. Type some text: "Additional context: "
3. Type **@** symbol
4. Dropdown appears with column list

**Expected Results**:
- ✅ @ trigger only works at start of line or after space (context-aware)
- ✅ Dropdown shows same column list as before
- ✅ Typing filters the list (fuzzy search)

**Steps (continue)**:
5. Select **"assistant_message"** from dropdown

**Expected Results**:
- ✅ @ character is removed
- ✅ **Orange pill** inserted: "Assistant Message"
- ✅ Cursor moves after pill
- ✅ Mapping added automatically (pill is already orange, not gray)
- ✅ Preview updates to include `{{assistant_message}}`

**Steps (continue)**:
6. Press **ESC** key (without selecting)

**Expected Results**:
- ✅ Dropdown closes
- ✅ @ character is removed
- ✅ No pill inserted
- ✅ Editor returns to normal state

**Screenshots to capture**:
- @ trigger dropdown open
- Newly inserted orange pill from @ trigger

---

### Test 5: Multiple Variables - Translate Template

**Steps**:
1. Close current modal (if open)
2. Click **"Add AI Column"** again
3. Select **"Translate"** template

**Expected Results**:
- ✅ Template loads: "Translate {{input}} to {{language}}"
- ✅ Two pills appear:
  - "Text to Translate" (gray dashed - required)
  - "Target Language" (orange - has default "English")
- ✅ Warning banner shows: "⚠ Map required fields: Text to Translate"
- ✅ Submit button **disabled**

**Steps (continue)**:
4. Click "Text to Translate" pill
5. Select "user_message"
6. Verify "Target Language" pill remains orange (default value)

**Expected Results**:
- ✅ First pill turns orange
- ✅ Second pill stays orange (default preserved)
- ✅ Warning banner disappears
- ✅ Submit button enabled
- ✅ Preview shows:
  ```
  Translate {{user_message}} to {{language}}

  Maintain original formatting and context.
  ```

**Screenshots to capture**:
- Two pills (one gray, one orange) before mapping
- Both pills orange after mapping

---

### Test 6: Bring Your Own Prompt (Custom Template)

**Steps**:
1. Close current modal
2. Click **"Add AI Column"**
3. Select **"Bring Your Own Prompt"** template

**Expected Results**:
- ✅ Empty editor (just placeholder)
- ✅ No pills
- ✅ No warning banner
- ✅ Submit button **enabled** (no required fields)

**Steps (continue)**:
4. Type: "Summarize this conversation:"
5. Press Enter (new line)
6. Type **@**
7. Select "user_message"
8. Type " and "
9. Type **@**
10. Select "assistant_message"

**Expected Results**:
- ✅ Both pills inserted as orange (automatically mapped)
- ✅ Preview shows:
  ```
  Summarize this conversation:
  {{user_message}} and {{assistant_message}}
  ```

**Screenshots to capture**:
- Custom prompt with multiple pills

---

### Test 7: Validation - Unmapped Required Fields

**Steps**:
1. Select "Classify" template
2. Template has two required fields:
   - "Text to Classify"
   - "Categories"
3. Do NOT map any pills yet

**Expected Results**:
- ✅ Warning banner shows: "⚠ Map required fields: Text to Classify, Categories"
- ✅ Submit button **disabled**

**Steps (continue)**:
4. Map only "Text to Classify" to "user_message"

**Expected Results**:
- ✅ Warning banner updates: "⚠ Map required fields: Categories"
- ✅ Submit button still **disabled**

**Steps (continue)**:
5. Map "Categories" to any column (e.g., "model")

**Expected Results**:
- ✅ Warning banner **disappears**
- ✅ Submit button **enabled**

---

### Test 8: Edge Cases

#### Test 8a: @ Mid-Word (Should NOT Trigger)
1. Type "email@example.com"
2. Verify @ does NOT open dropdown (mid-word)

#### Test 8b: @ After Space (Should Trigger)
1. Type "Hello " (with trailing space)
2. Type "@"
3. Verify dropdown DOES open

#### Test 8c: Multi-line Prompt
1. Create prompt with multiple paragraphs
2. Insert pills in different paragraphs
3. Verify preview preserves line breaks

#### Test 8d: Edit Text Around Pills
1. Insert pill in middle of sentence
2. Edit text before pill
3. Edit text after pill
4. Verify pill remains intact and mapping preserved

---

## Build Verification

**Build Status**: ✅ PASSED
```bash
npm run build
```

**Results**:
- ✓ Compiled successfully in 14.3s
- Edit page: 161 kB (includes TipTap + PromptComposer)
- First Load JS: 320 kB
- No TypeScript errors in PromptComposer components
- Only pre-existing lint warnings (unrelated to PromptComposer)

---

## Test Data Reference

**Sample CSV Columns**:
- `turn_id` (number)
- `session_id` (string)
- `user_id` (string)
- `timestamp` (datetime)
- `user_message` (text) ← Good for testing
- `assistant_message` (text) ← Good for testing
- `model` (string)
- `prompt_tokens` (number)
- `completion_tokens` (number)
- `total_tokens` (number)
- `latency_ms` (number)
- `cost_usd` (number)

**First Row Values** (for preview verification):
- `user_message`: "What is the capital of France?"
- `assistant_message`: "The capital of France is Paris."

---

## Known Issues (Intentionally Deferred)

These are NOT bugs - they're future enhancements:

1. **Keyboard navigation between pills** - Use mouse to click pills
2. **Undo/redo for mappings** - Undo only affects text, not mappings
3. **Copy/paste pill preservation** - Pills become plain text when copied
4. **Default column auto-mapping** - Manual mapping required for all fields
5. **Column type filtering** - All columns shown regardless of type

---

## Success Criteria

✅ All 8 test scenarios pass
✅ No console errors
✅ Pills render correctly (orange = mapped, gray = unmapped)
✅ Validation works (warning banner + submit button state)
✅ Preview shows correct {{column_slug}} format
✅ @ trigger works in valid contexts
✅ Build succeeds with no new errors

---

## Troubleshooting

### Pills Don't Appear After Loading Template
- **Check**: Network tab for API call to `/api/prompts/[templateId]`
- **Check**: Browser console for errors
- **Fix**: Refresh page, template should load from cache

### Dropdown Doesn't Open on @
- **Check**: Are you typing @ at start of line or after space?
- **Try**: Click existing pill instead

### Submit Button Stays Disabled
- **Check**: Yellow warning banner for unmapped fields
- **Fix**: Click each gray dashed pill and map to a column

### Preview Shows Empty or Incorrect Format
- **Check**: Are all pills orange (mapped)?
- **Check**: Preview accordion expanded?
- **Expected format**: `{{column_slug}}` not `{single}`

---

## Next Steps After Manual Testing

1. Create automated Playwright tests for critical paths
2. Test with different datasets (JSON, larger CSVs)
3. Test all 6 templates (Translate, Sentiment, Summarize, Keywords, Classify, Custom)
4. Performance testing with large datasets (1000+ rows)
5. Dark mode visual verification
6. Mobile responsive testing (if applicable)

---

## Files Changed in This Session

**Bug Fix**:
- `src/components/spreadsheet/PromptComposer.tsx:165` - Fixed variable ID generation

**Build**:
- ✅ Compiled successfully
- ✅ No new TypeScript errors
- ✅ No new lint warnings in PromptComposer code

---

**Ready for manual testing!** 🚀

Please test using the steps above and report any issues found.
