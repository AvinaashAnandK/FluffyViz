# Conversational History - Missing File Error Fixed

**Date:** November 9, 2025
**Error:** "Failed to load prompt config: Internal Server Error"
**Status:** ✅ Fixed

---

## 🐛 Problem

When clicking "Add Conversational History" from the column template menu, the application threw an error:

```
Failed to load prompt config: Internal Server Error
```

**Root Cause:** Two issues:
1. The YAML file `conversational-history.yaml` was missing from `/src/config/prompts/`
2. The API route was not correctly handling paths with leading slashes

---

## ✅ Solution

### 1. Created Missing YAML File

**File Created:** `/src/config/prompts/conversational-history.yaml`

**Contents:**
```yaml
category: Conversational History
title: Add Conversational History
description: Aggregate conversation turns into formatted history

prompt_params:
  system_instruction: |
    This template aggregates conversation turns into a formatted history column.
    It does not use an LLM - instead, it processes your data client-side to create
    a running conversation history for each turn.

  prompt_template: |
    CONVERSATIONAL_HISTORY_CONFIG

    This is a special column type that aggregates conversation history.

    Configuration will be prompted interactively when you add this column.
    You'll need to specify:
    - Conversation ID column: Groups messages into conversations
    - Sequence ID column: Orders messages within each conversation
    - Aggregation strategy: How to format the history

template_variables: []

response_format: TEXT

inference_config:
  generation:
    max_new_tokens: 0
    temperature: 0
```

**Note:** This template is special - it doesn't actually call an LLM. Instead, it uses client-side processing to aggregate conversation turns based on configuration provided by the user.

### 2. Fixed API Route Path Handling

**File Modified:** `/src/app/api/prompts/[templateId]/route.ts`

**Change:**
```typescript
// Before
const yamlPath = path.join(process.cwd(), 'src', template.promptFile)

// After
const promptFilePath = template.promptFile.startsWith('/')
  ? template.promptFile.substring(1)
  : template.promptFile
const yamlPath = path.join(process.cwd(), 'src', promptFilePath)
```

**Why:** The `promptFile` values in `ai-column-templates.ts` have leading slashes (e.g., `/config/prompts/...`). When `path.join` encounters a path starting with `/`, it treats it as an absolute path and ignores previous path segments. The fix strips the leading slash before joining paths.

---

## 🧪 Testing

### How to Test:
1. Open the spreadsheet editor
2. Click the "+" icon to add a column
3. Select "Add Conversational History" from the menu
4. ✅ Should load without errors
5. ✅ Should show the configuration modal

---

## 📝 Notes

### About Conversational History

The Conversational History feature is unique:
- **No LLM calls**: Processes data client-side
- **JSON configuration**: Uses JSON config instead of traditional prompt
- **Special detection**: Detected by `isConversationalHistoryPrompt()` in `conversational-history.ts`
- **Format:**
  ```json
  {
    "conversationIdColumn": "conversation_id",
    "sequenceIdColumn": "turn_index",
    "aggregationStrategy": "all_turns"
  }
  ```

### How It Works:
1. User selects "Add Conversational History"
2. Modal loads (now fixed!)
3. User configures:
   - Which column identifies unique conversations
   - Which column orders messages
   - How to format the history
4. System generates history column client-side (no API calls)
5. Each cell shows the full conversation history up to that turn

---

## 🔍 Related Files

### Fixed:
1. `/src/config/prompts/conversational-history.yaml` - Created
2. `/src/app/api/prompts/[templateId]/route.ts` - Modified

### Related (No Changes):
- `/src/config/ai-column-templates.ts` - Template definition
- `/src/lib/conversational-history.ts` - Processing logic
- `/src/components/spreadsheet/SpreadsheetEditor.tsx` - Usage

---

## ✅ Completion Status

**Error:** Fixed ✅
**File:** Created ✅
**API Route:** Fixed ✅
**Testing:** Ready for user testing ✅

---

**Fixed by:** Claude (Sonnet 4.5)
**Date:** November 9, 2025
