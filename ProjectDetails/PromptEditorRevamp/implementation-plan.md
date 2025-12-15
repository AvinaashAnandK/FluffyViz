# PromptComposer Implementation Plan

## Project Context

**FluffyViz** is a local-first Next.js application that transforms raw conversational/agent data into structured, analyzable datasets. Users upload data, augment it with AI-powered columns using LLM prompts, and export to visualization tools.

**Current State:**
- Simple textarea-based prompt editor in `AddColumnModal.tsx` (lines 129-136)
- Template-based prompt system with YAML configs stored in `src/config/prompts/`
- Uses `{input}` placeholders that get replaced with `{{column_slug}}` syntax
- AI inference is mocked but designed for row-by-row processing

## Implementation Strategy

### Phase 1: Foundation & Dependencies

**1.1 Install TipTap Dependencies**
```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-document @tiptap/extension-paragraph @tiptap/extension-text
npm install @floating-ui/react
```

**1.2 Migrate Template Format**
Enhance YAML templates with pill metadata:

```yaml
# Enhanced format
template_variables:
  - id: "user_message"
    display_name: "User Message"
    slug: "user_message"
    tooltip: "Most recent user utterance"
    required: true
  - id: "language"
    display_name: "Target Language"
    slug: "language"
    tooltip: "Language to translate to"
    required: true
```

Update `ai-column-templates.ts` to parse this enhanced format.

### Phase 2: Core PromptComposer Component

**2.1 Component Structure**
```typescript
// src/components/spreadsheet/PromptComposer.tsx
interface PromptComposerProps {
  availableColumns: ColumnMeta[]
  initialTemplateId?: string
  onPromptChange: (prompt: string, isValid: boolean) => void
}

interface ColumnMeta {
  id: string
  slug: string
  displayName: string
  preview: string  // first row value
}
```

**2.2 TipTap Custom Variable Node Extension**
Create `src/lib/tiptap/variable-node.tsx`:
- Define inline node with attributes: `id`, `displayName`, `tooltip`, `mappedColumnId`, `mappedColumnName`
- Render as pill component with orange background
- Handle click events to trigger column combobox
- Implement tooltip on hover

**2.3 @ Trigger Extension**
Create `src/lib/tiptap/mention-trigger.tsx`:
- Listen for `@` character
- Context-aware: only trigger if at start or after space
- Open column combobox with floating-ui positioning

### Phase 3: Column Selection Combobox

**3.1 Floating Combobox Component**
```typescript
// src/components/spreadsheet/ColumnCombobox.tsx
- Use shadcn Popover + Command
- Floating-ui with offset, flip, shift middleware
- List columns with:
  - Title Case name (14-16px semi-bold)
  - First row preview (12px muted, show "Null" if empty)
- Fuzzy search filtering
- Keyboard navigation (up/down/enter/esc)
```

**3.2 Anchoring Logic**
- For pill clicks: anchor to pill element
- For @ trigger: anchor to text cursor position
- Use `useFloating` hook with reference element tracking

### Phase 4: State Management

**4.1 Editor State Hook**
```typescript
// src/hooks/use-prompt-editor.ts
interface PromptEditorState {
  templateId?: string
  doc: JSONContent  // TipTap document
  variableMappings: Record<string, ColumnMeta>
  unmappedVariables: { id: string; displayName: string }[]
}

- Derive unmappedVariables from doc + mappings
- Serialize to {{column_slug}} format
- Validate completeness
```

### Phase 5: Integration & Polish

**5.1 Replace Textarea in AddColumnModal**
- Replace lines 129-136 with `<PromptComposer />`
- Pass `availableColumns` derived from `SpreadsheetEditor` data
- Wire up `onPromptChange` to update modal state

**5.2 Validation UI**
```typescript
// Below editor canvas
{unmappedVariables.length > 0 && (
  <Alert variant="warning">
    Map required fields: {unmappedVariables.map(v => v.displayName).join(', ')}
  </Alert>
)}
```

**5.3 Preview Accordion**
```typescript
<Accordion type="single" collapsible>
  <AccordionItem value="preview">
    <AccordionTrigger>Preview Interpolated Prompt</AccordionTrigger>
    <AccordionContent>
      <pre>{serializePrompt(doc, mappings)}</pre>
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

### Phase 6: Runtime Integration

**6.1 Update ai-inference.ts**
Ensure `interpolatePrompt` works with `{{column_slug}}` syntax:

```typescript
export function interpolatePromptForRow(
  template: string,
  row: Record<string, any>,
  mappings: Record<string, string>
): string {
  let result = template
  for (const [varId, columnSlug] of Object.entries(mappings)) {
    const value = row[columnSlug] ?? '(empty)'
    result = result.replace(new RegExp(`\\{\\{${columnSlug}\\}\\}`, 'g'), String(value))
  }
  return result
}
```

## Key Implementation Considerations

**1. Data Flow:**
```
Template Selection → Load enhanced YAML → Hydrate TipTap doc with variable pills →
User maps pills to columns → Serialize to {{column_slug}} →
Runtime: interpolate per row → Send to LLM API
```

**2. Persistence Strategy:**
- Only store final interpolated string with `{{column_slug}}` placeholders
- Column metadata includes `prompt` field (already exists in types.ts:10)
- No need to persist TipTap doc or mappings (disposable composition state)

**3. Template Migration:**
Migrate all templates to enhanced variable format with pill metadata.

**4. Integration with Existing Flow:**
- `AddColumnModal` already handles model/provider selection ✓
- `generateColumnData` in `ai-inference.ts` already does row-by-row processing ✓
- Just need to pass interpolated prompt per row

**5. Testing Focus Areas:**
- Template hydration from YAML to TipTap doc
- @ trigger only on valid contexts (not mid-word)
- Undo/redo with variable mappings
- Floating popover viewport boundaries
- Null/undefined column preview values
- Long prompts with many pills (scrolling + performance)

## File Structure Impact

**New Files:**
```
src/components/spreadsheet/PromptComposer.tsx
src/components/spreadsheet/ColumnCombobox.tsx
src/lib/tiptap/variable-node.tsx
src/lib/tiptap/mention-trigger.tsx
src/hooks/use-prompt-editor.ts
src/lib/prompt-serializer.ts
```

**Modified Files:**
```
src/components/spreadsheet/AddColumnModal.tsx (replace textarea)
src/config/ai-column-templates.ts (enhance variable format)
src/config/prompts/*.yaml (migrate to enhanced format)
src/lib/ai-inference.ts (ensure {{}} interpolation works)
```

**Dependencies to Add:**
- TipTap packages (editor framework)
- @floating-ui/react (popover positioning)
- Existing shadcn components already cover the rest (Popover, Command, Accordion, Alert)

## Implementation Sequence

1. Install dependencies
2. Migrate YAML templates to enhanced format
3. Update ai-column-templates.ts to parse enhanced format
4. Create TipTap variable node extension
5. Create prompt serializer utility
6. Create ColumnCombobox component
7. Create PromptComposer component with state management
8. Update ai-inference.ts for {{}} interpolation
9. Integrate into AddColumnModal
10. Add validation UI and preview accordion
11. Comprehensive testing (unit + integration)
