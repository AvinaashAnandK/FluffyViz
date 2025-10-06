# PromptComposer - Comprehensive QA Test Plan

**Test Date**: ___________
**Tester**: ___________
**Environment**: http://localhost:3001
**Sample Data**: `public/sample-data/sample-turn-level.csv`

---

## Pre-Test Setup

### 1. Start Development Server
```bash
cd /Users/avinaash/Documents/FluffyViz/fluffy-viz
npm run dev
```
**Expected**: Server starts on port 3001 (or 3000)

### 2. Open Browser
- Navigate to: http://localhost:3001
- Open DevTools Console (Cmd+Option+I / F12)
- **Verification**: No console errors on page load

### 3. Upload Sample Data
- Click "Upload File" button
- Select `public/sample-data/sample-turn-level.csv`
- **Expected**: Redirected to `/edit/[fileId]` with spreadsheet visible
- **Columns**: turn_id, session_id, user_id, timestamp, user_message, assistant_message, model, etc.

---

## Test Suite 1: Template Loading & Pill Rendering

### Test 1.1: Open AddColumnModal
**Steps**:
1. Click "Add AI Column" button (top-right of spreadsheet)

**Expected**:
- ✅ Drawer slides in from right side
- ✅ Title: "Add AI Column"
- ✅ Template selector dropdown visible
- ✅ No console errors

**Result**: Pass 
**Notes**: Working as expected

---

### Test 1.2: Load Sentiment Analysis Template
**Steps**:
1. Select "Sentiment Analysis" from template dropdown
2. Wait for template to load

**Expected**:
- ✅ Prompt editor shows text: "Analyze the sentiment of the following text:"
- ✅ One gray dashed pill appears: "Text to Analyze"
- ✅ Pill tooltip (hover): "Text for sentiment analysis"
- ✅ Yellow warning banner: "⚠ Map required fields: Text to Analyze"
- ✅ Submit button is DISABLED
- ✅ Console log: `GET /api/prompts/sentiment 200`

**Result**: Pass
**Notes**: Working as expected

---

### Test 1.3: Load Translate Template (Multiple Variables)
**Steps**:
1. Select "Translate" from dropdown

**Expected**:
- ✅ Template text appears
- ✅ Two pills visible:
  - Gray dashed: "Text to Translate" (required)
  - Orange: "Target Language" (has default "English")
- ✅ Warning banner: "⚠ Map required fields: Text to Translate"
- ✅ Submit button DISABLED
- ✅ Preview accordion available

**Result**: Pass
**Notes**: Both pills are Gray dashed. But, that's the expected behavior.

---

### Test 1.4: Load Bring Your Own Template (Empty Canvas)
**Steps**:
1. Select "Bring Your Own Prompt" from dropdown

**Expected**:
- ✅ Empty editor (just cursor)
- ✅ No pills
- ✅ No warning banner
- ✅ Submit button ENABLED (no required fields)
- ✅ Placeholder hint visible

**Result**: Fail
**Notes**: The editor is empty, there are no pills or warning banner. However, the submit button is not enabled. 

---

## Test Suite 2: Pill Click & Column Mapping

### Test 2.1: Click Unmapped Pill
**Steps**:
1. Load "Sentiment Analysis" template
2. Click the gray dashed "Text to Analyze" pill

**Expected**:
- ✅ Console: `[VariablePill] Clicked: {id: 'input', ...}`
- ✅ Console: `[PromptComposer] Received variable-pill-click event`
- ✅ Dropdown appears BELOW the pill
- ✅ Dropdown shows list of columns with previews:
  - turn_id
  - session_id
  - user_message ("What is the capital of France?")
  - assistant_message ("The capital of France is Paris.")
  - etc.
- ✅ Search box is focused
- ✅ Dropdown is NOT in top-left corner

**Result**: Fail
**Notes**: The dropdown is appearing below the pill at first instance, but stays in place when scrolled down. ![alt text](<Screenshot 2025-10-06 at 10.08.00 AM.png>). 

---

### Test 2.2: Search Columns in Dropdown
**Steps**:
1. With dropdown open, type "user" in search box

**Expected**:
- ✅ Dropdown filters to show:
  - user_id
  - user_message
- ✅ Other columns hidden
- ✅ Preview values still visible

**Result**: Fail
**Notes**: There seems to be some post-processing of the column names that the drawer receives from the spreadsheet component. Where if a column is titled session_ID, it is maintained as a Session Id in capital case. Where is this post-processing happening and why? 

---

### Test 2.3: Select Column from Dropdown
**Steps**:
1. Clear search box (backspace)
2. Click "user_message" from dropdown

**Expected**:
- ✅ Dropdown closes immediately
- ✅ Pill turns ORANGE (solid background)
- ✅ Pill text updates to: "User Message" (formatted)
- ✅ Pill tooltip: "Column: User Message"
- ✅ Yellow warning banner DISAPPEARS
- ✅ Submit button becomes ENABLED
- ✅ Console: No errors

**Result**: Fail
**Notes**: The drop-down closes immediately, the pill turns orange, and the pill text updates to "user message". The tool tip is showing "User Message" but the column name is user_message. The yellow warning banner disappears, but the submit button is not enabled, there are no errors in the console.

---

### Test 2.4: Remap Already-Mapped Pill
**Steps**:
1. Click the now-orange "User Message" pill again

**Expected**:
- ✅ Dropdown opens again
- ✅ "User Message" has a checkmark (✓) indicating current selection
- ✅ Can select different column (e.g., "assistant_message")
- ✅ Pill updates to new column
- ✅ Pill stays orange

**Result**: Pass
**Notes**: Works as expected

---

### Test 2.5: Map Multiple Pills (Translate Template)
**Steps**:
1. Select "Translate" template
2. Click gray "Text to Translate" pill
3. Select "user_message"
4. Verify "Target Language" pill is already orange

**Expected**:
- ✅ First pill turns orange after mapping
- ✅ Second pill remains orange (default preserved)
- ✅ Warning banner disappears
- ✅ Both pills show correct tooltips
- ✅ Submit button enabled

**Result**: Fail
**Notes**: I tried this two times:
1. The first time I selected certain column names from the drop-down for both the pills. I then closed the banner and I reopened the banner with the translate template.
2. The pills are gray as expected, when I open the drawer. But when I click on the gray pill, the drop-down shown has the previous selection ticked. 
3. In both instances, I couldn't spot any default value as such in the UI. 

---

## Test Suite 3: @ Trigger & On-the-Fly Insertion

### Test 3.1: @ Trigger in Empty Editor
**Steps**:
1. Select "Bring Your Own Prompt" template
2. Type: "Summarize this: "
3. Type `@` symbol

**Expected**:
- ✅ Console: `[PromptComposer] @ trigger activated`
- ✅ Dropdown appears AT CURSOR POSITION (not top-left!)
- ✅ Shows all available columns
- ✅ Console: `[ColumnCombobox] Setting position: {top: ..., left: ...}`
- ✅ Position matches cursor location

**Result**: Fail
**Notes**: I tried two variations of this:
1. When I started off with the ` @` symbol, the drop-down appears at the top left part of the screen, and when I click on Backspace, the drop-down still remains.
2. I typed "summarize this" and clicked on the "Type" button. The rate symbol worked as expected - the drop-down appears at the cursor position and it shows all available columns, and the position matches the cursor location.  The third variation I tried was pressing Shift+Enter to go to a new line, but that was not reflected in the display preview. However, just pressing Enter and going to a new line was reflected in the display preview.

---

### Test 3.2: @ Trigger Column Selection
**Steps**:
1. With @ dropdown open, click "user_message"

**Expected**:
- ✅ @ character is REMOVED
- ✅ Orange pill appears: "User Message"
- ✅ Pill is already mapped (orange, not gray)
- ✅ Cursor moves after pill
- ✅ Can continue typing
- ✅ Text should read: "Summarize this: [User Message pill] "

**Result**: Pass
**Notes**: Works as expected. But, a better user experience would be to move the cursor to the combobox search input box. In the current implementation, the expectations is that the user clicks on the specific input from the combobox. 

---

### Test 3.3: @ Trigger Multiple Insertions
**Steps**:
1. After previous test, type: " and "
2. Type `@`
3. Select "assistant_message"

**Expected**:
- ✅ Both pills visible in editor
- ✅ Text: "Summarize this: [pill1] and [pill2]"
- ✅ Both pills are orange
- ✅ Can click either pill to remap

**Result**: Fail
**Notes**: When I typed " and ", the cursor moved to the end of the line, and the @ trigger worked as expected. But the combobox is not aware that it's close to the right hand side of the screen and accordingly flip the combobox to the left hand side of the cursor. 

---

### Test 3.4: @ Trigger Context-Awareness
**Steps**:
1. Type: "email@example.com" (@ mid-word)

**Expected**:
- ✅ @ does NOT trigger dropdown
- ✅ @ character appears as normal text
- ✅ No console logs about @ trigger

**Steps (continue)**:
2. Press space, then type `@`

**Expected**:
- ✅ Dropdown DOES appear (@ after space is valid)

**Result**: Pass
**Notes**: Works as expected. 

---

### Test 3.5: @ Trigger at Line Start
**Steps**:
1. Press Enter to create new line
2. Type `@` as first character

**Expected**:
- ✅ Dropdown appears (@ at start of line is valid)
- ✅ Positioned at cursor

**Result**: Fail
**Notes**: Notes in Test 3.1.

---

## Test Suite 4: Preview & Validation

### Test 4.1: Preview Accordion with Mapped Variables
**Steps**:
1. Load "Sentiment Analysis" template
2. Map "Text to Analyze" to "user_message"
3. Click "Preview Interpolated Prompt" accordion

**Expected**:
- ✅ Accordion expands
- ✅ Shows prompt with `{{user_message}}` syntax (double braces)
- ✅ Full text visible:
  ```
  Analyze the sentiment of the following text:

  {{user_message}}

  Classify as: Positive, Negative, or Neutral
  Provide only the classification.
  ```
- ✅ NOT single braces `{user_message}`

**Result**: Pass 
**Notes**: Works as expected

---

### Test 4.2: Preview Updates in Real-Time
**Steps**:
1. With preview open, click pill and remap to different column (e.g., "assistant_message")

**Expected**:
- ✅ Preview updates immediately to show `{{assistant_message}}`
- ✅ No need to re-open accordion

**Result**: Pass
**Notes**: Works as expected!

---

### Test 4.3: Preview with Multiple Variables
**Steps**:
1. Load "Translate" template
2. Map both variables
3. Open preview

**Expected**:
- ✅ Shows both variables with `{{}}` syntax
- ✅ Multi-line format preserved
- ✅ Example:
  ```
  Translate {{user_message}} to {{language}}

  Maintain original formatting and context.
  ```

**Result**: Pass!
**Notes**: Works as expected

---

### Test 4.4: Validation - Unmapped Required Fields
**Steps**:
1. Load "Classify" template (has 2 required fields: text, categories)
2. Do NOT map any fields

**Expected**:
- ✅ Warning banner: "⚠ Map required fields: Text to Classify, Categories"
- ✅ Submit button DISABLED
- ✅ Both pills are gray dashed

**Result**: PASS
**Notes**: Works as expected

---

### Test 4.5: Validation - Partial Mapping
**Steps**:
1. Map only "Text to Classify" to "user_message"

**Expected**:
- ✅ Warning banner updates: "⚠ Map required fields: Categories"
- ✅ Submit button STILL DISABLED
- ✅ One pill orange, one gray

**Result**: Passed
**Notes**: Works as expected

---

### Test 4.6: Validation - All Fields Mapped
**Steps**:
1. Map "Categories" to any column (e.g., "model")

**Expected**:
- ✅ Warning banner DISAPPEARS completely
- ✅ Submit button ENABLED
- ✅ Both pills orange

**Result**: Pass
**Notes**: Works as expected

---

## Test Suite 5: Combobox Interaction & Cleanup

### Test 5.1: Click Outside to Close
**Steps**:
1. Open combobox by clicking a pill
2. Click anywhere in the modal (but outside combobox)

**Expected**:
- ✅ Console: `[PromptComposer] Click outside detected, closing combobox`
- ✅ Combobox closes
- ✅ Pill remains in previous state (no change)
- ✅ No @ character left behind

**Result**: Pass
**Notes**: Works as expected

---

### Test 5.2: ESC Key to Close
**Steps**:
1. Open combobox (pill click or @ trigger)
2. Press ESC key

**Expected**:
- ✅ Combobox closes
- ✅ If from @ trigger: @ character is REMOVED
- ✅ If from pill click: No changes

**Result**: PASS
**Notes**: Works as expected

---

### Test 5.3: Close Modal with Combobox Open
**Steps**:
1. Open combobox by clicking pill
2. Click X button to close AddColumnModal drawer

**Expected**:
- ✅ Console: `[PromptComposer] Unmounting - cleaning up combobox`
- ✅ Drawer slides out
- ✅ Combobox DISAPPEARS (not left floating)
- ✅ Fake anchor element removed from DOM

**Verification**:
- Open browser DevTools → Elements tab
- Search for `<span style="position: fixed"` in body
- Should be ZERO results (no orphaned anchors)

**Result**: PASS
**Notes**: Works as expected

---

### Test 5.4: Click Inside Combobox (Should NOT Close)
**Steps**:
1. Open combobox
2. Click on the search input box inside combobox
3. Type some text in search

**Expected**:
- ✅ Combobox STAYS OPEN
- ✅ Search filters columns
- ✅ No unexpected closure

**Result**: Pass
**Notes**: Works as expected

---

## Test Suite 6: Edge Cases & Error Handling

### Test 6.1: Rapid Pill Clicking
**Steps**:
1. Click pill 1 to open combobox
2. Immediately click pill 2 (different pill)

**Expected**:
- ✅ First combobox closes
- ✅ Second combobox opens at pill 2's position
- ✅ No overlap or double dropdowns
- ✅ No console errors

**Result**: Pass
**Notes**: Works is expected

---

### Test 6.2: Typing Text Around Pills
**Steps**:
1. Insert pill via @ trigger
2. Type text BEFORE pill
3. Type text AFTER pill
4. Click in middle of text, then type

**Expected**:
- ✅ Pills remain intact (not deleted)
- ✅ Text flows around pills correctly
- ✅ Can select/edit text normally
- ✅ Pills maintain orange color (mappings preserved)

**Result**: Fail
**Notes**: These are my observations for this test case:
- When I insert the pill via the @ trigger, when the text Prompt box is come entirely empty, the drop down box opens at the top left part of the screen
- I typed before and after the pill when I tried to navigate within the text editor using my left arrow key, moving first across the text and then into the pill. It treats the pill as an entity which means that when I press left key it goes into the pill, the cursor disappears, and then when I press left again it appears to the left of the pill which is not the intended behavior. Pills should be treated entirely as a block that gets skipped over by the cursor

---

### Test 6.3: Multi-line Prompts
**Steps**:
1. Type: "Analyze this text:"
2. Press Enter (new line)
3. Type `@` and insert "user_message" pill
4. Press Enter again
5. Type: "Provide detailed analysis."

**Expected**:
- ✅ Text spans multiple lines
- ✅ Pill appears on line 2
- ✅ Line breaks preserved in preview
- ✅ Preview shows:
  ```
  Analyze this text:
  {{user_message}}
  Provide detailed analysis.
  ```

**Result**: Fail
**Notes**: When I typed in "analyze this text", pressed Enter, and then typed @ symbol, the drop-down box did not appear. My sense is that it's not detecting a space before the @ and the new line character is not helping the trigger work correctly. The second thing I noticed here is that once I type at the rate, I can still backtrack and delete it using the Backspace key on my keyboard. When I do that, the combo box is still active.

---

### Test 6.4: Delete Pill (Backspace)
**Steps**:
1. Insert a pill via @
2. Position cursor after pill
3. Press Backspace to delete pill

**Expected**:
- ✅ Pill is deleted
- ✅ Cursor moves to where pill was
- ✅ No console errors
- ✅ Preview updates (variable removed)

**Result**: Pass
**Notes**: Looking as expected

---

### Test 6.5: Copy/Paste Pills
**Steps**:
1. Select text containing a pill (click-drag)
2. Copy (Cmd+C)
3. Paste elsewhere in editor (Cmd+V)

**Expected**:
- ⚠️ Known limitation: Pills paste as PLAIN TEXT (not as pills)
- ✅ Original pill remains intact
- ✅ No crashes or errors

**Result**: Pass
**Notes**: Working as expected, In fact, the pills paste has pills.

---

### Test 6.6: Undo/Redo Text (Not Mappings)
**Steps**:
1. Type some text
2. Insert a pill
3. Type more text
4. Press Cmd+Z (undo)

**Expected**:
- ⚠️ Known limitation: Undo removes TEXT only, not pill mappings
- ✅ Text changes undo correctly
- ✅ Pill may remain but mapping state doesn't undo

**Result**: Pass
**Notes**: Working as expected

---

## Test Suite 7: Template Switching

### Test 7.1: Switch Templates
**Steps**:
1. Load "Sentiment Analysis" template
2. Map the variable to "user_message"
3. Switch to "Translate" template (different dropdown selection)

**Expected**:
- ✅ Editor content clears
- ✅ New template loads with new pills
- ✅ Previous mappings do NOT carry over
- ✅ Console: Template API call succeeds

**Result**: Pass
**Notes**: Working as expected

---

### Test 7.2: Switch from Custom to Template
**Steps**:
1. Select "Bring Your Own Prompt"
2. Type custom text with multiple @ insertions
3. Switch to "Sentiment Analysis"

**Expected**:
- ✅ Custom content is REPLACED (not appended)
- ✅ Template loads fresh
- ✅ No leftover pills from custom

**Result**: Pass
**Notes**: Working as expected

---

## Test Suite 8: Dark Mode & Visual Verification

### Test 8.1: Dark Mode Pills
**Steps**:
1. Toggle dark mode (if available in app)
2. Load template with pills

**Expected**:
- ✅ Unmapped pills: Gray with dashed border (dark theme variant)
- ✅ Mapped pills: Orange (dark theme variant)
- ✅ Pills readable in both modes
- ✅ Dropdown has dark theme styles

**Result**: N/A
**Notes**: Dark mode is not available in the app

---

### Test 8.2: Tooltip Visibility
**Steps**:
1. Hover over mapped pill

**Expected**:
- ✅ Tooltip appears within 300ms
- ✅ Shows mapped column name
- ✅ Readable in current theme

**Steps (continue)**:
2. Hover over unmapped pill

**Expected**:
- ✅ Tooltip shows field description
- ✅ Does NOT show "Mapped to: ..." (only for mapped pills)

**Result**: Fail
**Notes**: The map to in the hover over tool tip shows the "user message" when the column mapped is user_message

---

### Test 8.3: Hover States
**Steps**:
1. Hover over pill (don't click)

**Expected**:
- ✅ Pill background slightly darkens (hover state)
- ✅ Cursor changes to pointer
- ✅ Visual feedback for interactivity

**Result**: Pass
**Notes**: Works as expected

---

## Test Suite 9: End-to-End Workflow

### Test 9.1: Complete Sentiment Analysis Flow
**Steps**:
1. Upload sample-turn-level.csv
2. Click "Add AI Column"
3. Select "Sentiment Analysis" template
4. Map "Text to Analyze" → "user_message"
5. Select AI model (any from HuggingFace)
6. Select provider (e.g., HuggingFace Inference API)
7. Enter column name: "sentiment"
8. Click "Add Column" button

**Expected**:
- ✅ Warning banner cleared before submission
- ✅ Submit succeeds
- ✅ Modal closes
- ✅ New column "sentiment" appears in spreadsheet
- ✅ Column has metadata with prompt: `Analyze the sentiment of the following text:\n\n{{user_message}}\n\n...`
- ✅ Can trigger AI generation on this column

**Result**: Cannot test this workflow because the programmatic calling of the AI provider is not configured in the app yet

---

### Test 9.2: Complete Custom Prompt Flow
**Steps**:
1. Select "Bring Your Own Prompt"
2. Type: "Extract key topics from: "
3. Type `@`, select "user_message"
4. Type " and "
5. Type `@`, select "assistant_message"
6. Preview prompt to verify
7. Select model & provider
8. Name column: "topics"
9. Submit

**Expected**:
- ✅ Column created with custom prompt
- ✅ Prompt saved as: `Extract key topics from: {{user_message}} and {{assistant_message}}`
- ✅ No validation errors

**Result**: Cannot test this workflow because the programmatic calling of the AI provider is not configured in the app yet

---

## Test Suite 10: Performance & Stability

### Test 10.1: Large Dataset
**Steps**:
1. Upload CSV with 1000+ rows (if available)
2. Open AddColumnModal
3. Load template
4. Map variables
5. Open preview

**Expected**:
- ✅ No lag when opening modal
- ✅ Pills render instantly
- ✅ Dropdown shows column previews (first row only)
- ✅ No memory leaks

**Result**: We're not expected to handle CSVs with 1000+ rows

---

### Test 10.2: Rapid Template Switching
**Steps**:
1. Rapidly switch between templates (click dropdown, select, repeat 10 times)

**Expected**:
- ✅ No console errors
- ✅ Each template loads correctly
- ✅ No duplicate pills
- ✅ No memory leaks (check DevTools Memory tab if needed)

**Result**: Pass
**Notes**: Works as expected

---

### Test 10.3: Console Errors
**Steps**:
1. Throughout ALL tests, monitor browser console

**Expected**:
- ✅ No React warnings about keys
- ✅ No "Cannot read property of undefined" errors
- ✅ No unhandled promise rejections
- ✅ Only expected logs from our debug statements

**Acceptable logs**:
- `[PromptComposer] ...`
- `[VariablePill] ...`
- `[ColumnCombobox] ...`
- Template API calls (200 status)

**Result**: ⬜ Pass ⬜ Fail
**Notes**: ___________

---

## Test Suite 11: Accessibility (Optional)

### Test 11.1: Keyboard Navigation in Dropdown
**Steps**:
1. Open combobox with @ trigger
2. Press Tab (or arrow keys) to navigate options

**Expected**:
- ✅ Can navigate options with keyboard
- ✅ Enter key selects highlighted option
- ✅ ESC closes dropdown

**Result**: FAIL
**Notes**: I can not navigate the drop-down box using the down arrow key. Additionally, the cursor still remains in the text editor and does not move to the search part of the combo box when the drop-down box is activated.

---

### Test 11.2: Focus Management
**Steps**:
1. Open modal
2. Tab through form elements

**Expected**:
- ✅ Focus moves in logical order
- ✅ Focus visible (outline or highlight)
- ✅ Can reach all interactive elements

**Result**: Pass
**Notes**:Works as expected

---

## Test Summary

**Total Tests**: 50+
**Passed**: ___ / ___
**Failed**: ___ / ___
**Skipped**: ___ / ___

---

## Critical Issues Found

| Test # | Issue Description | Severity | Screenshot/Video |
|--------|------------------|----------|------------------|
|        |                  | 🔴 Critical / 🟡 Major / 🟢 Minor |  |

---

## Non-Critical Issues Found

| Test # | Issue Description | Expected Behavior | Actual Behavior |
|--------|------------------|-------------------|-----------------|
|        |                  |                   |                 |

---

## Performance Notes

- Modal open speed: ___________
- Combobox render time: ___________
- Template load time: ___________
- Any noticeable lag: ___________

---

## Browser Compatibility

Test in multiple browsers (if applicable):

| Browser | Version | Test Result | Notes |
|---------|---------|-------------|-------|
| Chrome  |         | ⬜ Pass ⬜ Fail |  |
| Firefox |         | ⬜ Pass ⬜ Fail |  |
| Safari  |         | ⬜ Pass ⬜ Fail |  |
| Edge    |         | ⬜ Pass ⬜ Fail |  |

---

## Sign-Off

**Tester Name**: ___________
**Date**: ___________
**Overall Status**: ⬜ Ready for Production ⬜ Needs Fixes

**Comments**:
___________________________________________________________________________
___________________________________________________________________________
___________________________________________________________________________

---

## Appendix: Debug Console Commands

If issues arise during testing, use these console commands for debugging:

```javascript
// Check for orphaned anchor elements
document.querySelectorAll('span[style*="position: fixed"]').length

// Check current combobox state (if component exposed)
// (This requires adding window.debugPromptComposer in dev mode)

// Clear localStorage (if needed)
localStorage.clear()

// Check IndexedDB for stored data
indexedDB.databases()
```

---

## Quick Reference: Expected Pill States

| State | Background | Border | Tooltip | Click Behavior |
|-------|-----------|--------|---------|----------------|
| Unmapped Required | Gray | Dashed gray | Field description | Opens dropdown to map |
| Mapped | Orange solid | None | "Mapped to: [column]" | Opens dropdown to remap |
| Default (optional) | Orange solid | None | "Default: [value]" | Opens dropdown to remap |

---

**End of QA Test Plan**
