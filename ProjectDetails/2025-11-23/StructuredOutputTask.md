# Task: Add Structured Output Feature to Add Columns Feature in the Spreedsheet View
## Context
FluffyViz currently processes CSV data by running LLM prompts on each row. Currently outputs unstructured text. Need to add structured JSON output capability with schema definition. This particular feature creates a column by programmatically running the prompt on every row in the dataset that is uploaded by the user. What I want to introduce in this interface is a structured data output from the LLM, like for example in this use case where we're extracting a keyword column.

## Objective
Implement a structured output feature that allows users to define output schemas (types, fields) for LLM responses, enabling extraction of keywords, entities, classifications, etc. in a structured format.

## Technical Stack
- NextJS
- AI SDK (Vercel)
- CSV processing
- Current: unstructured text output → Target: structured JSON with type validation

## Requirements

### 1. UI Components to Add
#### A. Output Mode Toggle (in right panel, below Prompt section in the PromptComposer Component)
```
Location: After "Prompt" section, before "Preview Prompt"

Component:
┌─ Output Format ────────────────────┐
│ ○ Text (default)                   │
│ ● Structured Data                  │
└─────────────────────────────────────┘
```

#### B. Schema Builder (shown when "Structured Data" selected)
```
┌─ Define Output Schema ─────────────┐
│ [+ Add Field]                      │
│                                     │
│ Field 1                             │
│ Name: [keywords          ]         │
│ Type: [Array of Strings ▼]        │
│ Description: [Key terms...]        │
│ Required: ☑                        │
│ [Remove]                           │
│                                     │
│ Field 2                             │
│ Name: [sentiment         ]         │
│ Type: [Enum             ▼]        │
│ Options: [positive,negative,neutral]│
│ Required: ☑                        │
│ [Remove]                           │
└─────────────────────────────────────┘
```

### 2. Type System to Implement

Support these types with Zod validation:
- `string` → `z.string()`
- `number` → `z.number()`
- `boolean` → `z.boolean()`
- `array_string` → `z.array(z.string())`
- `array_number` → `z.array(z.number())`
- `array_object` → `z.array(z.object({}))`
- `object` → `z.object({})`
- `enum` → `z.enum([...])` (requires options field)

### 3. Data Structure

```typescript
interface FieldSchema {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array_string' | 'array_number' | 'array_object' | 'object' | 'enum';
  description?: string;
  required: boolean;
  enumOptions?: string[]; // Only for enum type
  minItems?: number; // Only for arrays
  maxItems?: number; // Only for arrays
}

interface OutputSchema {
  mode: 'text' | 'structured';
  fields: FieldSchema[];
}
```

### 4. Backend Changes
#### Update API endpoint to handle structured output:
```typescript
// When mode === 'structured', use generateObject instead of generateText

import { generateObject } from 'ai';
import { z } from 'zod';

// Build Zod schema dynamically from fields
const schema = buildZodSchema(fields);

const result = await generateObject({
  model: yourModel,
  schema: schema,
  prompt: interpolatedPrompt
});

// result.object will be typed and validated
```

#### Schema Builder Function:
```typescript
function buildZodSchema(fields: FieldSchema[]) {
  const schemaObject = {};
  
  fields.forEach(field => {
    let fieldSchema;
    
    switch(field.type) {
      case 'string':
        fieldSchema = z.string();
        break;
      case 'number':
        fieldSchema = z.number();
        break;
      case 'boolean':
        fieldSchema = z.boolean();
        break;
      case 'array_string':
        fieldSchema = z.array(z.string());
        if (field.minItems) fieldSchema = fieldSchema.min(field.minItems);
        if (field.maxItems) fieldSchema = fieldSchema.max(field.maxItems);
        break;
      case 'array_number':
        fieldSchema = z.array(z.number());
        break;
      case 'enum':
        fieldSchema = z.enum(field.enumOptions as [string, ...string[]]);
        break;
      // ... other types
    }
    
    if (!field.required) {
      fieldSchema = fieldSchema.optional();
    }
    
    schemaObject[field.name] = fieldSchema;
  });
  
  return z.object(schemaObject);
}
```

### 6. CSV Column Output Options

Add radio buttons for how to output structured data:
```
How to add to CSV:
○ Single JSON column (e.g., "extract_keywords_column")
● Separate columns for each field (e.g., "keywords", "sentiment")
○ Both
```

### 7. Enhanced Prompt Preview

Update preview to show the expected JSON structure:
```
[Your prompt text]

Expected output format:
{
  "keywords": ["string", "string", ...],
  "sentiment": "positive" | "negative" | "neutral",
  "confidence": number
}
```

## Files to Create/Modify

### New Files
1. **`src/components/spreadsheet/SchemaBuilder.tsx`** - Schema builder UI component
2. **`src/lib/schema-utils.ts`** - Zod schema builder function + schema-to-prompt formatter

### Files to Modify
1. **`src/components/spreadsheet/AddColumnModal.tsx`**
   - Add output mode state (`'text' | 'structured'`)
   - Add schema fields state (`FieldSchema[]`)
   - Render SchemaBuilder conditionally
   - Pass schema to onAddColumn callback
   - Update preview to show JSON format when structured

2. **`src/lib/ai-inference.ts`**
   - Add `generateStructuredCompletion()` function using AI SDK's `generateObject`
   - Update `generateColumnData()` to accept optional schema and route to structured completion
   - Handle Zod validation errors

3. **`src/components/spreadsheet/SpreadsheetEditor.tsx`**
   - Update `addColumn()` to pass schema through
   - Update `generateAIColumnData()` to handle structured output
   - Store schema in column metadata

4. **`src/lib/duckdb/types.ts`**
   - Extend `ColumnMetadata` interface with `outputSchema` field

5. **`src/types/structured-output.ts`** (new)
   - Define `FieldSchema`, `OutputSchema` interfaces
   - Define field type union

---

## Implementation Plan

### Phase 1: Core Infrastructure

#### Step 1: Type Definitions
Create `src/types/structured-output.ts` with:
- `FieldSchema` interface
- `OutputSchema` interface
- `FieldType` union type

#### Step 2: Schema Utilities
Create `src/lib/schema-utils.ts` with:
- `buildZodSchema(fields: FieldSchema[])` - Converts field definitions to Zod schema
- `schemaToPromptFormat(fields: FieldSchema[])` - Generates "Expected output format" text for prompt
- `validateStructuredOutput(data: unknown, schema: z.ZodSchema)` - Wrapper for validation

#### Step 3: Structured Inference
Update `src/lib/ai-inference.ts`:
- Add `generateStructuredCompletion()` using `generateObject` from AI SDK
- Modify `generateColumnData()` to accept `outputSchema?: OutputSchema`
- Route to structured completion when schema provided
- Append schema format to prompt before sending to LLM
- Parse and validate response with Zod

### Phase 2: UI Components

#### Step 4: Schema Builder Component
Create `src/components/spreadsheet/SchemaBuilder.tsx`:
- Field list with add/remove
- Per-field inputs: name, type dropdown, description, required checkbox
- Conditional inputs: enum options, array min/max
- State managed by parent (AddColumnModal)

#### Step 5: AddColumnModal Integration
Update `src/components/spreadsheet/AddColumnModal.tsx`:
- Add state: `outputMode`, `schemaFields`
- Add Output Format toggle (radio group)
- Render `<SchemaBuilder />` when mode is 'structured'
- Update preview section to show JSON format
- Pass schema in `onAddColumn` callback

### Phase 3: Data Flow Integration

#### Step 6: SpreadsheetEditor Updates
Update `src/components/spreadsheet/SpreadsheetEditor.tsx`:
- Extend `addColumn()` to receive and pass schema
- Update `generateAIColumnData()` to include schema in inference call
- Store schema in column metadata via `saveColumnMetadata()`

#### Step 7: Metadata Persistence
Update `src/lib/duckdb/types.ts`:
- Add `outputSchema?: OutputSchema` to `ColumnMetadata`

### Phase 4: Polish & Error Handling

#### Step 8: Validation Error UI
- Display Zod validation errors in cell metadata
- Show clear error messages when LLM output doesn't match schema
- Mark cells as failed with `errorType: 'invalid_response'`

#### Step 9: Preview Enhancement
- Show interpolated prompt + expected JSON format in preview
- Use first row data for realistic preview

---

## Key Decisions

1. **v1 Scope**: Single JSON column output only. Separate columns per field deferred to v2.

2. **Schema in Prompt**: Schema format appended to user's prompt so LLM knows expected structure. AI SDK's `generateObject` provides additional constraint.

3. **Component Architecture**: SchemaBuilder is a sibling component to PromptComposer in AddColumnModal, not nested inside it.

4. **State Management**: Schema state lifted to AddColumnModal and passed down to SchemaBuilder.

5. **Provider Support**: All providers work with structured output via AI SDK's `generateObject` abstraction.

6. **Dual Validation**:
   - AI SDK's `generateObject` enforces schema at generation time
   - Zod validation on our end for parsing/type safety

---

## Acceptance Criteria

- [ ] User can toggle between "Text" and "Structured Data" output modes
- [ ] User can add/remove fields with name, type, description, required flag
- [ ] Type dropdown includes all 8 basic types
- [ ] Enum type shows additional "Options" input field
- [ ] Array types show optional min/max items fields
- [ ] Quick templates populate the schema builder correctly
- [ ] Preview shows expected JSON format
- [ ] Backend uses `generateObject` when structured mode is enabled
- [ ] Zod schema is built correctly from field definitions
- [ ] Validation errors are handled gracefully
- [ ] Generated columns are added to CSV correctly
- [ ] Option to choose JSON column vs separate columns works
- [ ] State is preserved when switching between modes

## Testing Checklist

- [ ] Test with keywords extraction (array of strings)
- [ ] Test with sentiment analysis (enum + number)
- [ ] Test with required vs optional fields
- [ ] Test with invalid LLM output (should show validation error)
- [ ] Test CSV export with structured data
- [ ] Test all quick templates
- [ ] Test adding/removing fields dynamically

## Notes

- Keep UI clean - collapse schema builder when not in use
- Add helpful tooltips explaining each type
- Show validation errors inline
- Consider adding a "Test on one row" button before running on full dataset
- Save schema configurations for reuse