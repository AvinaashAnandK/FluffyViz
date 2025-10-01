# AI Spreadsheet Integration Plan - Avinaash

## Integration Plan for Spreadsheet-Extract into FluffyViz

Based on analysis of the spreadsheet-extract component, here's the comprehensive approach for integration:

### 1. **Understanding @spreadsheet-extract/ Functionality**

The spreadsheet-extract component is a sophisticated **AI-powered Excel-like interface** with these key features:

- **Excel-style UI**: Column headers (A, B, C), row numbering, editable cells
- **AI Column Generation**: 5 built-in templates (Translate, Extract Keywords, Summarize, Generate Images, Custom Processing)
- **Drag-to-Fill**: Click and drag functionality to copy values down rows
- **Provider Flexibility**: Support for multiple AI providers (OpenAI, Anthropic, Groq, Google AI)
- **Data Manipulation**: Real-time cell editing with instant updates

### 2. **Integration Flow After Enhanced-Upload**

**Proposed Integration Point**: After `processData()` completion in `enhanced-upload.tsx:271-307`

**Flow Design**:
```
Enhanced Upload → Process Data → **[NEW: Spreadsheet View]** → Export/Visualize
```

**Implementation Strategy**:
- Add new state in `page.tsx` to track when data processing is complete
- Create a new step in the 4-step workflow: "Upload → **Edit** → Augment → Process → Visualize"
- Pass the processed `UploadResult` data directly to a new `SpreadsheetView` component
- Allow users to refine/edit data before moving to augmentation phase

**Data Flow**:
```typescript
// In page.tsx - extend handleDataUploaded
const handleDataUploaded = (result: UploadResult) => {
  setUploadResult(result);
  setShowSpreadsheetEditor(true); // New state to show spreadsheet
  setSpreadsheetData(result.parsedData); // Pass data to spreadsheet
};
```

### 3. **Design System Adaptation Strategy**

**Core Principle**: **Functionality over design**, with strategic styling adjustments to maintain app cohesion.

**Key Adaptations Needed**:

**✅ Keep As-Is (Functionality Priority)**:
- Spreadsheet table structure and drag-to-fill mechanics
- AI column generation modal workflow
- Cell editing interactions

**🔧 Adapt to FluffyViz Style**:
- **Colors**: Replace default colors with FluffyViz palette (`#454372` primary)
- **Cards**: Wrap spreadsheet in `shadcn/ui Card` components matching style guide
- **Typography**: Apply `Open Sans` font family and sizing hierarchy
- **Buttons**: Replace with `shadcn/ui Button` components
- **Modals**: Integrate `AddColumnModal` with FluffyViz dialog styling
- **Status Indicators**: Use FluffyViz badge color system (green/blue/yellow)

**Styling Strategy**:
```typescript
// Adapt existing Tailwind classes without breaking functionality
className={cn(
  "existing-functional-classes", // Keep spreadsheet mechanics
  "bg-background border-border text-foreground", // Apply FluffyViz theme
  "font-sans" // Apply Open Sans
)}
```

**Component Architecture**:
- Create `SpreadsheetView` wrapper component in `/fluffy-viz/src/components/`
- Import and adapt `Spreadsheet`, `SpreadsheetTable`, `AddColumnModal` from spreadsheet-extract
- Maintain original component logic while applying FluffyViz theming
- Add proper TypeScript integration with existing FluffyViz types

## Refined Integration Architecture

### 1. **Routing & Navigation Strategy** ✅ YES to dedicated page

**Route Structure:**
```typescript
// New route: /edit/[fileId]
/edit/[fileId] → SpreadsheetEditor page
```

**Navigation Flow:**
```typescript
// In enhanced-upload.tsx processData()
const processData = async () => {
  // ... existing logic
  const persistedId = await saveFile(/* ... */);

  // Redirect to spreadsheet editor
  router.push(`/edit/${persistedId}`);
};
```

**Breadcrumb Integration:**
```typescript
// Update workflow steps in style guide
const workflowSteps = [
  { id: "upload", title: "Upload", status: "completed" },
  { id: "edit", title: "Edit", status: "current" }, // NEW STEP
  { id: "augment", title: "Augment", status: "pending" },
  { id: "process", title: "Process", status: "pending" },
  { id: "visualize", title: "Visualize", status: "pending" }
];
```

### 2. **Data Header Mapping Architecture**

**Mapping Strategy:**
```typescript
interface DataColumnMapping {
  originalHeader: string;
  spreadsheetColumn: string; // A, B, C, etc.
  dataType: 'string' | 'number' | 'date' | 'boolean';
  isAIGenerated: boolean;
}

// In SpreadsheetEditor component
const mapUploadedDataToColumns = (uploadResult: UploadResult) => {
  const headers = Object.keys(uploadResult.parsedData[0] || {});
  return headers.map((header, index) => ({
    id: header,
    name: header,
    spreadsheetColumn: indexToLetter(index),
    type: inferDataType(uploadResult.parsedData, header),
    isAIGenerated: false,
    visible: true
  }));
};
```

### 3. **AI Column Generation Config System**

**Config Architecture:**
```typescript
// /src/config/ai-column-templates.ts
export const AI_COLUMN_CONFIGS = {
  'data-augmentation': {
    translate: {
      prompt: 'Translate the following text to {language}: {input}',
      description: 'Translate text to different languages',
      icon: 'Languages'
    },
    extract_keywords: {
      prompt: 'Extract 3-5 key terms from: {input}',
      description: 'Extract important keywords and phrases',
      icon: 'Tags'
    },
    summarize: {
      prompt: 'Summarize in 1-2 sentences: {input}',
      description: 'Create concise summaries',
      icon: 'FileText'
    },
    generate_image: {
      prompt: 'Generate image description for: {input}',
      description: 'Create image generation prompts',
      icon: 'Image'
    },
    custom: {
      prompt: 'Process the following: {input}',
      description: 'Custom data processing',
      icon: 'Wand2'
    }
  },
  'agent-evaluation': {
    tasks: [
      { id: 'accuracy', label: 'Accuracy Assessment' },
      { id: 'hallucination', label: 'Hallucination Detection' },
      { id: 'sentiment', label: 'Sentiment Analysis' },
      { id: 'toxicity', label: 'Toxicity Detection' },
      { id: 'relevance', label: 'Response Relevance' }
    ],
    repos: [
      { id: 'anthropic', label: 'Anthropic Evals', url: 'github.com/anthropics/evals' },
      { id: 'openai', label: 'OpenAI Evals', url: 'github.com/openai/evals' },
      { id: 'huggingface', label: 'HF Evaluate', url: 'github.com/huggingface/evaluate' },
      { id: 'langchain', label: 'LangChain Evaluators', url: 'github.com/langchain-ai/langchain' }
    ],
    templates: {
      accuracy: 'Evaluate the accuracy of this response: {input}. Rate 1-10 and explain.',
      hallucination: 'Check for factual errors or hallucinations in: {input}',
      sentiment: 'Analyze sentiment (positive/negative/neutral): {input}',
      toxicity: 'Rate toxicity level (0-1): {input}',
      relevance: 'Rate how relevant this response is to the query: {input}'
    }
  }
} as const;
```

**Modal UI Design:**
```typescript
// AddColumnModal with theme switching
<Tabs value={selectedTheme} onValueChange={setSelectedTheme}>
  <TabsList>
    <TabsTrigger value="data-augmentation">Data Augmentation</TabsTrigger>
    <TabsTrigger value="agent-evaluation">Agent Evaluation</TabsTrigger>
  </TabsList>

  <TabsContent value="data-augmentation">
    {/* Existing template selection */}
  </TabsContent>

  <TabsContent value="agent-evaluation">
    <Select value={selectedTask}>
      <SelectTrigger>
        <SelectValue placeholder="Select evaluation task" />
      </SelectTrigger>
      <SelectContent>
        {AI_COLUMN_CONFIGS['agent-evaluation'].tasks.map(task => (
          <SelectItem key={task.id} value={task.id}>{task.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>

    <Select value={selectedRepo}>
      <SelectTrigger>
        <SelectValue placeholder="Select implementation source" />
      </SelectTrigger>
      <SelectContent>
        {AI_COLUMN_CONFIGS['agent-evaluation'].repos.map(repo => (
          <SelectItem key={repo.id} value={repo.id}>
            {repo.label} <Badge variant="outline">{repo.url}</Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </TabsContent>
</Tabs>
```

### 4. **AI-Powered Drag-to-Fill Architecture**

**Implementation Strategy:**
```typescript
interface AIDragFillOperation {
  sourceCell: { row: number; col: string; value: any };
  targetRange: { startRow: number; endRow: number; col: string };
  pattern: 'sequence' | 'contextual' | 'similar';
}

const handleAIDragFill = async (operation: AIDragFillOperation) => {
  const { sourceCell, targetRange } = operation;

  // Analyze surrounding context for pattern recognition
  const contextData = extractContextualData(data, sourceCell);

  const prompt = `
    Based on this data pattern:
    ${JSON.stringify(contextData, null, 2)}

    Generate ${targetRange.endRow - targetRange.startRow + 1} new values that follow the same pattern for column ${targetRange.col}.
    Return as JSON array.
  `;

  const generatedValues = await callLLMProvider(prompt);

  // Apply generated values to target range
  updateCellRange(targetRange, generatedValues);
};
```

### 5. **Cell-Level Feedback System**

**Cell State Management:**
```typescript
interface CellState {
  value: any;
  isEditing: boolean;
  isAIGenerated: boolean;
  feedback?: 'positive' | 'negative';
  generationMeta?: {
    prompt: string;
    provider: string;
    timestamp: Date;
  };
}

// Cell Component with Edit + Feedback
const EditableCell = ({ cellState, onEdit, onFeedback }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {cellState.isEditing ? (
        <Input value={cellState.value} onBlur={onEdit} />
      ) : (
        <span onClick={() => onEdit(true)}>{cellState.value}</span>
      )}

      {/* Edit button (always visible for AI cells) */}
      {(isHovered || cellState.isAIGenerated) && (
        <Button
          size="sm"
          variant="ghost"
          className="absolute top-0 right-0"
          onClick={() => onEdit(true)}
        >
          <Edit2 className="h-3 w-3" />
        </Button>
      )}

      {/* Feedback buttons (only for AI-generated cells) */}
      {cellState.isAIGenerated && isHovered && (
        <div className="absolute -top-8 right-0 flex gap-1">
          <Button
            size="sm"
            variant={cellState.feedback === 'positive' ? 'default' : 'outline'}
            onClick={() => onFeedback('positive')}
          >
            <ThumbsUp className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant={cellState.feedback === 'negative' ? 'destructive' : 'outline'}
            onClick={() => onFeedback('negative')}
          >
            <ThumbsDown className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};
```

### 6. **Column-Level Regeneration with Few-Shot Learning**

**Few-Shot Prompt Engineering:**
```typescript
const generateFewShotPrompt = (column: Column, feedbackData: CellFeedback[]) => {
  const positiveExamples = feedbackData
    .filter(f => f.feedback === 'positive')
    .map(f => ({ input: f.originalInput, output: f.generatedOutput }));

  const negativeExamples = feedbackData
    .filter(f => f.feedback === 'negative')
    .map(f => ({ input: f.originalInput, output: f.generatedOutput }));

  return `
    ${column.prompt}

    Here are examples of good outputs:
    ${positiveExamples.map(ex => `Input: ${ex.input}\nGood Output: ${ex.output}`).join('\n\n')}

    Here are examples to avoid:
    ${negativeExamples.map(ex => `Input: ${ex.input}\nAvoid: ${ex.output}`).join('\n\n')}

    Now process: {input}
  `;
};

// Column header with regenerate button
const ColumnHeader = ({ column, onRegenerate }) => (
  <div className="flex items-center justify-between p-2">
    <span>{column.name}</span>
    {column.isAIGenerated && (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onRegenerate(column.id)}
        title="Regenerate column using feedback"
      >
        <RotateCcw className="h-3 w-3" />
      </Button>
    )}
  </div>
);
```

### 7. **LLM Provider Integration**

**Provider Hook Integration:**
```typescript
// Use existing sidebar provider config
const SpreadsheetEditor = () => {
  const { providers, activeProvider } = useAIProviderConfig(); // From sidebar

  const callLLMProvider = async (prompt: string, options?: CallOptions) => {
    if (!activeProvider) {
      throw new Error('No AI provider configured');
    }

    return await activeProvider.generateCompletion({
      prompt,
      model: options?.model || activeProvider.defaultModel,
      temperature: options?.temperature || 0.7,
      maxTokens: options?.maxTokens || 1000
    });
  };

  // Use in all AI operations: column generation, drag-fill, regeneration
};
```

## Benefits of This Approach

- **Preserves Core UX**: Excel-like functionality remains intact
- **Visual Cohesion**: Users won't feel like they're entering a different app
- **Rapid Integration**: Minimal refactoring required for functionality
- **Future-Proof**: Can incrementally improve design post-integration
- **Sophisticated AI Features**: Goes beyond basic spreadsheet to provide AI-augmented data processing
- **Feedback Loop**: Creates learning system that improves over time
- **Config-Driven**: Maintainable and extensible architecture

This architecture creates a sophisticated, integrated system that feels native to FluffyViz while providing powerful AI-augmented spreadsheet capabilities. The key is maintaining the config-driven approach for maintainability and extensibility.