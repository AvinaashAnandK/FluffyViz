# Fix Plan

- **Prompt lifecycle & validation (`src/components/spreadsheet/PromptComposer.tsx`)**
  - Call `onPromptChange` immediately after the TipTap editor hydrates and whenever the template rehydrates so the modal knows the base prompt state without waiting for edits.
  - Reset mappings/anchors whenever `initialTemplate` changes, hydrate optional variables with defaults, and remove any previously injected fake anchors before creating new ones to avoid DOM leaks.
  - Expand the warning banner: keep required-field guidance, and when `serializePrompt` reports zero mapped variables append “No columns are mapped. This prompt will run as an ungrounded generation.” so users understand they’re launching an ungrounded prompt but can still continue.

- **Dropdown positioning & focus (`src/components/spreadsheet/ColumnCombobox.tsx` + `PromptComposer.tsx`)**
  - Recompute the anchor rect on scroll/resize, flip/clamp within the viewport, and always clean up the temporary anchor span after closing.
  - Auto-focus the `CommandInput`, wire the Escape key to `onCancel`, and route keystrokes typed after `@` into the combobox search so stray filter text doesn’t enter the editor.

- **Mention trigger lifecycle (`src/lib/tiptap/mention-trigger.ts`, `PromptComposer.tsx`)**
  - Treat newline boundaries as valid trigger contexts, and cancel the dropdown if the `@` character is deleted or replaced so the overlay never lingers.
  - When inserting via `@`, delete any interim filter text along with the `@` and normalize cursor placement near viewport edges.

- **Variable pill accessibility (`src/lib/tiptap/variable-node.tsx`)**
  - Add arrow-key handling that skips over pills (rather than trapping the caret) and show both the friendly label and raw slug in the tooltip (`Mapped to: user_message`).

- **Prompt serialization fidelity (`src/lib/prompt-serializer.ts`)**
  - Emit line breaks for `hardBreak` nodes so Shift+Enter content survives in the preview/export.

- **Column preview formatting (`src/components/spreadsheet/AddColumnModal.tsx`)**
  - Replace `|| ''` with nullish coalescing for column previews so legitimate `0`/`false` values still display to the user.

---

# Codex Implementation Prompt

Implement all items in the fix plan above:
1. Update `PromptComposer` to emit an initial `onPromptChange`, reset mappings when templates swap, hydrate defaults, clean up anchor spans, and expand the warning banner with the ungrounded-generation notice when no columns are mapped.
2. Refactor the column combobox positioning/focus logic to follow the anchor while scrolling, clamp to the viewport, focus the search input, and ensure Escape closes it.
3. Enhance the mention-trigger extension and handler so newline contexts work, and the dropdown cancels cleanly when `@` is removed; make sure any `@`-typed filter text doesn’t stay in the editor.
4. Improve variable pill keyboard navigation and tooltip content to reflect the mapped slug.
5. Teach `serializePrompt` to respect `hardBreak` nodes and adjust column-preview fallbacks to keep zero/false values visible.