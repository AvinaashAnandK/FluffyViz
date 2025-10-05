# Prompt Editor Revamp – Mental Model & Implementation Plan

## Why We’re Revamping
- **Audience**: ML engineers and AI PMs who need to compose LLM prompts that reference dataset columns without memorising schema names.
- **Goal**: Provide a “prompt canvas” where people can write conversational instructions, drop in column references, and understand exactly what will be sent to the LLM.
- **Scope boundaries**: For this iteration we keep supporting UI minimal (preview + warnings). Prompts persist only as read-only renderings surfaced when a user hovers over the generated column in the spreadsheet viewer—no editable history or restore mechanics.

## Experience Blueprint
### Entry Modes
1. **Preset template**
   - Template list at top (shadcn `Select`).
   - Hydrates the editor with prose plus inline variable pills.
   - Each pill ships with a tooltip (3–5 word hint) describing what data belongs there.
2. **Bring-your-own (blank)**
   - “New Prompt” button resets canvas to empty text.
   - User can type free-form copy and insert column references on demand.

### Editor Canvas
- TipTap/Lexical-powered rich editor renders inline **variable pills** (orange background, rounded) inside normal text.
- Users can type, paste, delete, and reorder text around pills; undo/redo should remain reliable.
- Pills are non-editable spans with:
  - **Display label**: starts as template placeholder (e.g., “User Message”); swaps to selected column name when mapped.
  - **Tooltip**: explains expected content (“Most recent user utterance”).
  - **Click action**: opens the searchable column combobox anchored to that pill.
- Free text is just text nodes; there is no bold/italic toolbar yet.

### Column Combobox
- Built with shadcn `Popover + Command`.
- **Trigger conditions**:
  1. Click an unmapped pill while in template mode.
  2. Type `@` in the canvas for ad-hoc insertion (handle literal `@` by checking if followed by alphanumeric or space).
- **Anchoring**: Use `@floating-ui` to position relative to pill or caret, flipping/offsetting to stay in the viewport.
- **Row layout**: Column name in Title Case, 14–16px semi-bold; first-row preview directly underneath in 12px muted text (show "Null" or "Not Available" if first row value is null/undefined). No format badges (row-level prompts don't need them).
- **Loading state**: Show skeleton loader while columns are being fetched.
- **Empty state**: Show "No columns available" message if dataset is empty.
- Selecting a column:
  - Updates pill label immediately with the column name.
  - Stores mapping (`pillId → columnId`).
  - Closes the combobox and returns focus to the editor.
- Cancelling restores the canvas to pre-trigger state (remove stray `@`).

### Ad-hoc Variables
- Typing `@` opens the combobox even in BYO mode.
- When the user selects a column, the trigger character is replaced with a new pill labelled by that column.
- Preview still serializes as `{{column_slug}}` so downstream APIs see the expected template syntax.

### Support Panel (kept intentionally light)
- **Validation message band** below the editor when conditions require attention.
  - Message lists unmapped placeholder labels (e.g., “Map: User Message, Agent Reply”).
  - Primary CTA remains disabled while the list is non-empty.
- **Preview accordion** (shadcn `Accordion`) sits under the validation band.
  - Accordion is closed by default.
  - On expand, show the fully interpolated runtime prompt:
    - Mapped pill → `{{column_slug}}`
    - Unmapped pill → `{{display_name}}` with `(unmapped)` tag so users can spot issues quickly.

### Behavioural Guarantees
- Columns available inside the drawer are stable for that session; we only revalidate when the drawer opens/closes (handles column deletion/changes during editing).
- Users can keep typing around pills; tokens never collapse into raw text.
- Removing a pill re-introduces its placeholder label if it belongs to a template; in BYO mode it simply deletes that column reference.
- Undo/redo should restore both text and pill mappings (TipTap transaction system tracks attribute changes).
- We are not saving prompts yet, so closing the drawer discards state (optional "Are you sure?" modal can arrive later).

## Technical Architecture
### Rich Editor Foundation
- Adopt **TipTap** (preferred) for structured document state.
- Define a custom inline node `variable` with attributes: `{ id, displayName, tooltip, mappedColumnId, mappedColumnName }`.
- TipTap extensions handle:
  - Rendering the pill component (with tooltip & click handler). Note: Custom node with click handlers requires careful event propagation and `pointer-events` handling.
  - Keymap for `@` trigger. Note: Implement context-aware trigger (only open combobox if `@` is at start or after space to avoid conflicts with literal `@` in prose).
  - Commands to insert/remove variable nodes programmatically.

### State & Data Contracts
```ts
interface ColumnMeta {
  id: string;
  slug: string;           // runtime token (e.g., user_message)
  displayName: string;    // human label (e.g., "User Message")
  preview: string;        // first-row value snippet (derived from data.rows[0])
}

interface PromptEditorState {
  templateId?: string;
  doc: JSONContent;                   // TipTap document
  variableMappings: Record<string, ColumnMeta>; // key = variable node id
  unmappedVariables: { id: string; displayName: string }[];
}
```
- **Column data source**: `PromptComposer` receives `existingColumns` and `data.rows[0]` from parent `AddColumnModal` to derive `ColumnMeta[]`.
- **Templates** stored server-side (YAML) must be migrated to enhanced format with pill metadata (display name, tooltip, required flag). Update `ai-column-templates.ts` and corresponding YAML files.
- Runtime preview function converts `doc` + `variableMappings` into the final interpolated string with `{{column_slug}}` syntax.
- **Persistence**: Only the final interpolated string is stored when column is generated (no doc or mappings saved).

### Component Breakdown
- **Integration**: `PromptComposer` replaces the textarea in existing `AddColumnModal.tsx`. Modal continues to manage column name, model, and provider selection.
- `PromptComposer` component:
  - TipTap EditorProvider + pill renderer + validation banner.
  - Receives `availableColumns: ColumnMeta[]` and `onPromptChange` callback from parent.
- `PromptPreviewAccordion` (pulls preview string, renders accordion block).
- Shared primitives pulled from shadcn: `Tooltip`, `Popover`, `Command`, `Accordion`, `Alert`.
- Helper utilities:
  - `useColumnCombobox` – centralises anchor position (note: use floating-ui `useFloating` hook with `offset`, `flip`, `shift` middleware for viewport-aware positioning), filtering logic, and commit/rollback behaviour.
  - `serializePrompt(doc, mappings)` – returns runtime string and unmapped list.

### Interaction Flow Summary
1. **Template mode**:
   - Pills render from template JSON (all start unmapped).
   - Clicking each pill opens combobox → user picks a column → pill relabels immediately.
   - Validation banner stays until all required pills have mappings.
2. **BYO mode**:
   - Editor starts empty.
   - Typing `@` triggers combobox → new pill inserted.
   - Users can insert multiple columns anywhere in text.
3. **Warning & CTA**:
   - `Continue` button disabled while `unmappedVariables.length > 0`.
   - Warning lists outstanding pills.
4. **Preview**:
   - Accordion content updates live on mapping changes.
   - Copy button (future) could allow users to grab raw prompt for debugging.

### Implementation Phases
1. **Template migration** – update `ai-column-templates.ts` and migrate YAML files to enhanced format with pill metadata (display name, tooltip, required flag).
2. **Editor scaffolding** – integrate TipTap, create variable node extension, basic pill renderer (no mapping yet).
3. **Template hydration** – load enhanced template JSON, render pills with tooltips.
4. **Combobox + mapping** – implement click trigger + `@` trigger, selection pipeline, and pill relabelling.
5. **Validation + CTA gating** – derive unmapped list, show warning, disable primary action.
6. **Preview accordion** – render `{{}}` string and highlight unmapped tokens.
7. **Polish** – robust paste handling, undo/redo QA (including mapping changes), viewport-aware popover.

### Testing Strategy
- **Unit**: serialize/deserialize, mapping reducer, validation selector.
- **Integration (Playwright)**:
  1. Select template → map two pills → verify warning disappears → preview matches expected string.
  2. BYO mode → type `@`, insert column → verify pill inserted and preview updates.
  3. Delete pill → ensure warning reappears & CTA disables.
  4. Test TipTap custom node behavior: click handling, undo/redo with mapping changes, copy/paste pills.
- **Manual QA checklist**:
  - Paste from Google Docs / Slack / Markdown (ensure pills survive).
  - Long prompts with many pills (scrolling + popover positioning).
  - Undo/redo across mapping steps and text edits.
  - Literal `@` in prose doesn't trigger combobox incorrectly.
  - Null/undefined first-row values display "Null" or "Not Available".
  - Accessibility (tooltips, screen readers announce pill state).

## Known Limitations / Future Considerations
- Persistence/storage intentionally deferred; only the final interpolated string is stored when column is generated.
- No formatting controls (bold/italic) yet—future extension once core workflow stabilises.
- Keyboard navigation scoped out for this iteration.
- Potential features later: default column suggestions per template, collaborative editing, version history, test-run prompts using sample rows.

## Next Steps (Separate Implementation)
Once `PromptComposer` is integrated, the next phase is **runtime prompt interpolation**:
- Implement `interpolatePromptForRow(template, row, mappings)` function in `ai-inference.ts`.
- For each row in dataset, replace `{{column_slug}}` with actual row values.
- Handle null/undefined values gracefully (e.g., replace with "(empty)").
- Send interpolated prompts to LLM API providers.

This plan merges the user experience expectations we discussed with a concrete technical path (TipTap + shadcn primitives) so implementation can begin without losing context.
