# PromptComposer Quick Start Guide

## Running the Application

### 1. Start Dev Server
```bash
cd fluffy-viz
npm run dev
```

Visit http://localhost:3000 (or 3001 if 3000 is in use)

### 2. Upload Sample Data
- Click "Upload File" on the home page
- Use any CSV or JSON file from `public/sample-data/`
- The spreadsheet editor will open automatically

### 3. Open PromptComposer
- In the spreadsheet view, click "Add AI Column" button
- Or select any template from the template library
- The AddColumnModal drawer opens from the right side

## Using PromptComposer

### Template Mode (Recommended for Beginners)

1. **Select a Template**
   - Choose from: Translate, Sentiment Analysis, Summarize, Extract Keywords, or Classify
   - Template loads with pre-configured variable pills

2. **Map Variables to Columns**
   - Click any **gray dashed pill** (unmapped)
   - A dropdown appears showing available columns with preview values
   - Select a column → pill turns **orange** (mapped)
   - Repeat for all required fields

3. **Validate**
   - Yellow warning banner shows unmapped fields
   - Submit button disabled until all required fields mapped

4. **Preview**
   - Click "Preview Interpolated Prompt" accordion
   - See exactly what will be sent to the LLM
   - Variable pills shown as `{{column_slug}}`

5. **Configure Model & Submit**
   - Select AI model (search HuggingFace catalog)
   - Choose inference provider
   - Click "Add Column"

### Bring-Your-Own Mode (For Power Users)

1. **Select "Bring Your Own Prompt"** template
2. **Type freely** in the editor
3. **Insert columns** by typing `@`
   - Dropdown appears with available columns
   - Select column → inserts as pill
   - Continue typing around pills
4. **Preview & Submit** as above

## Visual Guide

### Pill States
- 🟠 **Orange pill** = Mapped (ready to use)
  - Example: `User Message` → mapped to "user_message" column
- ⚪ **Gray dashed pill** = Unmapped (needs mapping)
  - Example: `Target Language` → not yet mapped

### Column Dropdown
```
┌─────────────────────────────┐
│ Search columns...           │
├─────────────────────────────┤
│ ✓ User Message              │
│   "Hello, how are you?"     │  ← First row preview
├─────────────────────────────┤
│   Agent Reply               │
│   "I'm doing well, thanks!" │
├─────────────────────────────┤
│   Timestamp                 │
│   "2025-01-15T10:30:00Z"    │
└─────────────────────────────┘
```

### Validation Banner
```
┌────────────────────────────────────────┐
│ ⚠ Map required fields:                 │
│   Target Language, Categories          │
└────────────────────────────────────────┘
```

### Preview Accordion
```
▼ Preview Interpolated Prompt
┌────────────────────────────────────────┐
│ Translate {{user_message}} to English │
│                                        │
│ Original text:                         │
│ {{user_message}}                       │
└────────────────────────────────────────┘
```

## Keyboard Shortcuts

- **@ key**: Open column dropdown (context-aware)
- **ESC**: Close dropdown / cancel
- **↑/↓**: Navigate dropdown options
- **Enter**: Select highlighted column
- **Cmd/Ctrl+Z**: Undo text changes (not mappings)
- **Cmd/Ctrl+Shift+Z**: Redo text changes

## Tips & Tricks

### Efficient Workflow
1. Load template first (pre-configured pills)
2. Map all pills before editing text
3. Use preview to verify before submitting
4. Model selection is independent of prompt

### Common Patterns

**Translation:**
```
Translate {{source_text}} to {{target_language}}.

Maintain formatting and context.
```

**Classification:**
```
Classify {{user_message}} into one of these categories: {{categories}}

Provide only the category name.
```

**Sentiment Analysis:**
```
Analyze the sentiment of: {{text}}

Respond with: Positive, Negative, or Neutral
```

### Handling Special Cases

**Null/Empty Values:**
- At runtime, null values become `(empty)`
- Preview shows exactly what LLM receives

**Multi-line Prompts:**
- Press Enter to create new paragraphs
- Pills work across multiple lines

**Literal @ Symbol:**
- Type `@` followed by space → no dropdown
- Type `@` in middle of word → no dropdown
- Only triggers at start or after space

## Troubleshooting

### Dropdown Doesn't Open
✅ **FIXED (Oct 10, 2025)**: This issue has been resolved.
- Dropdown now uses React Portal for reliable rendering
- Positioned with `position: fixed` for accurate placement
- If still having issues: Check console for errors

### Dropdown Appears in Wrong Position
✅ **FIXED (Oct 10, 2025)**: @ trigger positioning corrected.
- Fake anchor now uses `position: fixed` matching combobox
- Dropdown should appear directly below cursor or pill

### Dropdown Stays Open After Closing Modal
✅ **FIXED (Oct 10, 2025)**: Auto-cleanup implemented.
- Combobox automatically closes when modal closes
- Click outside dropdown to dismiss it
- Press ESC to cancel

### Can't Submit
- Check yellow warning banner
- Map all required fields (pills without default values)
- Verify model and provider selected

### Pills Look Wrong
- Orange = mapped (correct)
- Gray dashed = unmapped (needs action)
- Hover for tooltip with details

### Preview Shows Unexpected Output
- Check pill mappings (click pills to verify)
- Expand preview accordion to see full template
- Variable syntax is `{{column_slug}}` not `{single}`

## Testing the Feature

### Manual Testing Checklist
1. ✅ Load translate template → map variables → preview → submit
2. ✅ Type @ → select column → verify pill inserted
3. ✅ Click unmapped pill → select column → verify orange
4. ✅ Try to submit with unmapped fields → verify blocked
5. ✅ Map all fields → verify warning gone → submit enabled
6. ✅ Preview accordion → verify {{}} syntax
7. ✅ Test with null/empty column values → verify preview
8. ✅ Create multi-line prompt → verify formatting preserved
9. ✅ Test @ trigger in different positions → verify context-awareness
10. ✅ Test ESC to cancel dropdown → verify cleanup

### Sample Test Data
Use `public/sample-data/langsmith-runs.json` or any CSV with text columns.

**Good columns for testing:**
- `user_message` (text)
- `agent_reply` (text)
- `timestamp` (datetime)
- `status` (enum)

## Development Commands

```bash
# Run dev server
npm run dev

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test
npm test -- prompt-serializer

# Build for production
npm run build

# Lint code
npm run lint
```

## Next Steps

After mastering PromptComposer:
1. Explore advanced templates (classify, extract keywords)
2. Create custom multi-column transformations
3. Experiment with different model/provider combinations
4. Export enriched data to Embedding Atlas

## Getting Help

### Documentation
- `implementation-plan.md` - Technical architecture
- `implementation-summary.md` - Feature documentation
- `COMPLETION-REPORT.md` - Test results & status

### Common Issues
See "Troubleshooting" section above

### Feature Requests
File issues at https://github.com/anthropics/claude-code/issues

---

**Happy prompting! 🚀**
