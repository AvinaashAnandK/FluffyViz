# Feature Enhancements

**Date:** 2025-12-02
**Context:** Features identified from audit review and product roadmap

---

## Product Vision & Workflow Context

FluffyViz is inspired by **HuggingFace AI Sheets** combined with **Apple's Embedding Atlas** viewer. The core workflow transforms agent execution traces into actionable insights:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FluffyViz Workflow                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────────────────┐  │
│   │    PARSE     │      │   AUGMENT    │      │       VISUALIZE          │  │
│   │              │      │              │      │                          │  │
│   │ Agent Traces │ ───► │ AI Columns   │ ───► │    Embedding Atlas       │  │
│   │ Conversations│      │ LLM-as-Judge │      │    2D UMAP Projection    │  │
│   │ Multi-turn   │      │ Evaluations  │      │    Interactive Explore   │  │
│   │              │      │ Metadata     │      │                          │  │
│   └──────────────┘      └──────────────┘      └──────────────────────────┘  │
│                                                                              │
│   Input Formats:         Column Types:         Visualization:               │
│   • JSONL traces         • Sentiment           • Points = conversations     │
│   • Langfuse spans       • Classification      • Color = evaluation score   │
│   • LangSmith runs       • Quality scores      • Hover = judge reasoning    │
│   • Arize traces         • Judge reasoning     • Cluster = semantic groups  │
│   • Turn-level CSV       • Custom prompts      • Filter = by augmentation   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Insight
The augmented columns (especially **LLM-as-a-judge evaluations**) become the dimensions and categories for embedding visualization. Users can:
- See how evaluation scores cluster semantically
- Identify patterns in agent failures vs successes
- Explore outliers in judge reasoning
- Cross-reference raw content with quality assessments

---

## Table of Contents

1. [Embedding Atlas Deep Integration](#1-embedding-atlas-deep-integration) ⭐ Core Feature
2. [LLM-as-a-Judge Column Templates](#2-llm-as-a-judge-column-templates) ⭐ Core Feature
3. [Export Functionality](#3-export-functionality)
4. [Single-Cell Retry](#4-single-cell-retry)
5. [HuggingFace Integration Improvements](#5-huggingface-integration-improvements)
6. [Web Search Augmentation](#6-web-search-augmentation) ⭐ New Feature

---

## 1. Embedding Atlas Deep Integration

### Why This Is Central

The Embedding Atlas visualization is not just a feature—it's the **destination** of the entire workflow. Every augmentation column users add in the spreadsheet should seamlessly flow into the embedding view for exploration.

**Current Gap:** The embedding layer doesn't receive all spreadsheet columns. Users can't:
- Color points by any spreadsheet column
- Choose which columns appear in hover tooltip
- Search semantically (conceptual search) within the embedding view
- Save filters to apply in spreadsheet later

### Current State
**File:** `src/components/embedding-viewer/embedding-visualization.tsx`

- Uses basic `EmbeddingAtlas` component
- Hardcoded table name and columns
- Embedding layer doesn't receive all spreadsheet columns
- No dynamic hover/color configuration

### What Already Works

The **Embedding Wizard** (`embedding-wizard.tsx`) already handles column composition for embedding:
- **Single Column** - Select one column to embed
- **Multi-Column Concatenation** - Combine multiple columns from current row
- **Conversational History** - Aggregate turns across rows by session

This creates different embedding indices based on user selection. We don't need to add more composition options.

### What's Missing: Pass ALL Columns to Embedding Layer

Currently, the embedding layer only receives the composed text and coordinates. It should receive **all columns from the spreadsheet** so users can:
- Color points by any column
- Show any column in hover tooltip
- Filter by any column value

```
Spreadsheet Editor
    │
    │ All columns available:
    │ • conversation_id, content, timestamp  (original)
    │ • quality_score, judge_reasoning, etc. (user-added AI columns)
    │
    ▼
Embedding Wizard (already exists)
    │ User selects what text to embed
    │ (single/multi/conversational)
    │
    ▼
DuckDB Table: embedding_layer_{layerId}
    │ Columns: row_id, x, y, composed_text,
    │          + ALL columns from spreadsheet!
    │
    ▼
Embedding Atlas View
    │
    ├── User selects which column colors points
    ├── User selects which columns appear in hover
    ├── Click point → highlights point (no jump to spreadsheet)
    └── Built-in: Table view, point details, density clustering
```

### Implementation Details

#### 1.1 Pass ALL Columns to Embedding Layer

When generating embeddings, copy **all columns** from the spreadsheet (not just AI-generated):

```typescript
// In embedding generation flow
const allColumns = columns.map(c => c.id);

// Create embedding table with ALL columns
CREATE TABLE embedding_layer_{id} AS
SELECT
  row_id,
  x,
  y,
  composed_text,
  ${allColumns.join(', ')}
FROM file_data_{fileId}
JOIN embedding_vectors ON ...
```

This allows users to color/filter/tooltip by any column—original data or AI-augmented.

#### 1.2 Color by Any Column

User selects which column drives point color via dropdown. Column names are user-defined (not hardcoded):

```typescript
// Build additionalFields dynamically from all spreadsheet columns
const additionalFields = Object.fromEntries(
  allColumns.map(col => [col.id, { type: inferFieldType(col) }])
);

<EmbeddingViewMosaic
  coordinator={coordinator}
  table={`embedding_layer_${layer.id}`}
  x="x"
  y="y"
  category={selectedColorColumn}  // User-selected column
  text="composed_text"
  identifier="row_id"
  additionalFields={additionalFields}  // All columns available
  categoryColors={generateColorScale(selectedColorColumn)}
  config={{
    mode: "density",
    autoLabelEnabled: true,
    colorScheme: theme === 'dark' ? 'dark' : 'light',
  }}
  tooltip={tooltip}
  onTooltip={handleTooltip}
/>
```

#### 1.3 Dynamic Hover Tooltip (Checkbox Selection)

User selects which columns appear in hover via checkboxes. The tooltip renders dynamically based on selection:

```typescript
// State for user-selected hover columns
const [hoverColumns, setHoverColumns] = useState<string[]>(['composed_text']);

// Dynamic tooltip rendering
{tooltip && (
  <Card className="absolute bottom-4 right-4 w-96 max-h-[60vh] overflow-auto">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm">Point Details</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      {/* Render each user-selected column */}
      {hoverColumns.map(columnId => {
        const value = tooltip.fields?.[columnId];
        if (value === undefined) return null;

        const column = allColumns.find(c => c.id === columnId);
        return (
          <div key={columnId}>
            <Label>{column?.name || columnId}</Label>
            <p className="text-sm bg-muted p-2 rounded-md mt-1 whitespace-pre-wrap">
              {formatValue(value, column?.type)}
            </p>
          </div>
        );
      })}
    </CardContent>
  </Card>
)}
```

**Hover Column Selector UI:**
```typescript
<div className="space-y-2">
  <Label>Show in hover tooltip</Label>
  {allColumns.map(col => (
    <div key={col.id} className="flex items-center space-x-2">
      <Checkbox
        id={`hover-${col.id}`}
        checked={hoverColumns.includes(col.id)}
        onCheckedChange={(checked) => {
          if (checked) {
            setHoverColumns([...hoverColumns, col.id]);
          } else {
            setHoverColumns(hoverColumns.filter(c => c !== col.id));
          }
        }}
      />
      <Label htmlFor={`hover-${col.id}`}>{col.name}</Label>
    </div>
  ))}
</div>
```

#### 1.4 Click Behavior: Highlight Point

Click on a point highlights it visually. **No jump to spreadsheet**—Embedding Atlas already provides:
- **Table view** - Built-in coordinated table showing all data
- **Point details view** - Built-in panel for inspecting individual points

```typescript
<EmbeddingAtlas
  // ... other props
  onPointClick={(point) => {
    // Just highlight the point, no navigation
    setHighlightedPoints([point.id]);
  }}
/>
```

#### 1.5 Save Filter for Spreadsheet

Instead of real-time cross-filtering with the spreadsheet, provide a **"Save Filter"** button. Users can apply the current selection/filter in Embedding Atlas, save it, then view those rows in the spreadsheet later.

```typescript
// Save current selection as a named filter
const handleSaveFilter = async () => {
  const selectedIds = await getSelectedPointIds();

  // Store filter in DuckDB or local state
  await saveFilter({
    name: filterName,
    layerId: layer.id,
    rowIds: selectedIds,
    createdAt: new Date().toISOString(),
  });

  toast.success(`Filter "${filterName}" saved with ${selectedIds.length} rows`);
};

// Later, in spreadsheet, user can apply saved filter
<Select value={activeFilter} onValueChange={applyFilter}>
  <SelectTrigger>
    <SelectValue placeholder="Apply saved filter..." />
  </SelectTrigger>
  <SelectContent>
    {savedFilters.map(f => (
      <SelectItem key={f.name} value={f.name}>
        {f.name} ({f.rowIds.length} rows)
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

#### 1.6 Embedding Atlas Built-in Features

Embedding Atlas already provides these features—no need to re-implement:

| Feature | Built-in? | Notes |
|---------|-----------|-------|
| Table view | ✅ Yes | Coordinated `Table` component |
| Point details | ✅ Yes | Click on point to see details |
| Density clustering | ✅ Yes | `mode: "density"` with auto-labels |
| Search | ✅ Yes | `Searcher` interface for custom search |
| Export selection | ✅ Yes | `onExportSelection` callback |

**Density Clustering** uses the `findClusters` algorithm:
```typescript
import { findClusters } from "embedding-atlas";

// The view automatically computes density and clusters
// autoLabelEnabled shows cluster labels on the visualization
config={{
  mode: "density",
  autoLabelEnabled: true,
  autoLabelDensityThreshold: 0.1,
}}
```

#### 1.7 Keyword Search (Literal Text Matching)

Enable users to find specific terms across their conversation data:

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 Search                                                       │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ error                                                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│   ○ Keyword (exact match)  ● Conceptual (semantic)              │
│                                                                 │
│   Found 47 matches                              [Highlight All] │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**
- Use DuckDB's `LIKE` or `ILIKE` for case-insensitive matching
- Highlight matching points in the scatter plot
- Show match count and allow filtering to only matches

```typescript
// Keyword search query
const keywordSearch = async (query: string) => {
  const result = await db.query(`
    SELECT row_id
    FROM embedding_layer_${layerId}
    WHERE composed_text ILIKE '%${escapeSql(query)}%'
       OR judge_reasoning ILIKE '%${escapeSql(query)}%'
  `);
  return result.map(r => r.row_id);
};

// Highlight matching points
<EmbeddingViewMosaic
  highlightedRows={keywordMatches}
  // ...
/>
```

**Use Cases:**
- Find all conversations mentioning "refund"
- Locate error messages: "timeout"
- Search for specific product names or features

---

#### 1.8 Conceptual Search (Semantic Similarity)

Inspired by [Lilac ML](https://github.com/lilacai/lilac), enable semantic search where users describe a concept and find semantically similar content—even without exact keyword matches.

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 Search                                                       │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ user seems frustrated or angry                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│   ○ Keyword (exact match)  ● Conceptual (semantic)              │
│                                                                 │
│   Similarity threshold: ────●──── 0.75                          │
│   Found 23 similar conversations                [Highlight All] │
└─────────────────────────────────────────────────────────────────┘
```

**How It Works:**
1. User enters a concept phrase (e.g., "user seems frustrated")
2. Embed the phrase using the same model that created the layer
3. Compute cosine similarity to all points in the embedding space
4. Highlight/filter points above similarity threshold

**Implementation:**

Store raw embeddings (before UMAP reduction) for similarity search. Use DuckDB's vector operations for cosine similarity:

```typescript
// Store embeddings during wizard generation
CREATE TABLE embedding_vectors_{layerId} (
  row_id INTEGER PRIMARY KEY,
  embedding FLOAT[1536]  -- dimension depends on model
);

// Conceptual search using cosine similarity in DuckDB
const conceptualSearch = async (conceptPhrase: string, threshold: number) => {
  // 1. Embed the concept phrase using same model as layer
  const queryEmbedding = await generateEmbedding(conceptPhrase, provider, model);

  // 2. Compute cosine similarity in DuckDB
  const result = await db.query(`
    SELECT
      row_id,
      list_cosine_similarity(embedding, $1::FLOAT[]) as similarity
    FROM embedding_vectors_${layerId}
    WHERE list_cosine_similarity(embedding, $1::FLOAT[]) > ${threshold}
    ORDER BY similarity DESC
  `, [queryEmbedding]);

  return result;
};
```

**DuckDB Vector Functions:**
- `list_cosine_similarity(a, b)` - cosine similarity between two vectors
- `list_distance(a, b)` - Euclidean distance

All vector operations are handled in DuckDB—no JavaScript fallback needed.

**Use Cases:**
- "conversations where the agent didn't understand the question"
- "successful resolutions where user was happy"
- "technical issues with the product"
- "requests for features we don't have"

**UI Enhancements:**
- Gradient highlighting based on similarity score (more similar = brighter)
- Sort table by similarity when in conceptual search mode
- "Save as filter" to create a reusable concept

---

#### 1.9 Combined Search Patterns

Users can combine search types for powerful exploration:

| Pattern | Example |
|---------|---------|
| Keyword only | `error` → exact matches |
| Concept only | `user is confused` → semantic matches |
| Keyword + Concept | `timeout` AND semantically similar to `frustrated` |
| Concept + Filter | Semantic search within `quality_score < 3` |

```typescript
// Combined filter state
interface SearchState {
  keyword?: string;
  concept?: string;
  conceptThreshold?: number;
  columnFilters?: Record<string, any>;
}

// Apply all filters to get final point set
const applyFilters = (state: SearchState) => {
  let matchingRows = allRows;

  if (state.keyword) {
    matchingRows = matchingRows.filter(r =>
      r.text.toLowerCase().includes(state.keyword.toLowerCase())
    );
  }

  if (state.concept) {
    const similarities = computeSimilarities(state.concept);
    matchingRows = matchingRows.filter(r =>
      similarities[r.id] >= (state.conceptThreshold ?? 0.7)
    );
  }

  if (state.columnFilters) {
    // Apply column-based filters (quality_score > 3, etc.)
  }

  return matchingRows;
};
```

### Architecture

```
src/components/embedding-viewer/
├── index.tsx                       # Main container
├── embedding-controls.tsx          # Color/hover column selectors
├── embedding-view-wrapper.tsx      # EmbeddingAtlas wrapper with config
├── saved-filters.tsx               # Manage saved filters
├── search/
│   ├── search-bar.tsx              # Unified search input with mode toggle
│   ├── keyword-search.ts           # DuckDB ILIKE text search
│   ├── conceptual-search.ts        # DuckDB cosine similarity search
│   └── search-results-overlay.tsx  # Match count, threshold slider
└── utils/
    └── color-scales.ts             # Generate colors for scores/categories
```

**Note:** Table view, point details, and clustering are built into Embedding Atlas—no custom components needed.

### Effort Estimate
**High** - 18-22 hours (reduced from 24-30 by leveraging built-in features)

| Task | Hours |
|------|-------|
| Pass ALL columns to embedding layer | 2-3 |
| Dynamic color by column selection | 2 |
| Hover column checkbox selector | 2-3 |
| Save filter functionality | 2-3 |
| Configure built-in clustering/labels | 1-2 |
| **Keyword search (ILIKE)** | 2-3 |
| **Conceptual search (cosine similarity)** | 3-4 |
| **Combined search UI** | 2 |
| Testing & polish | 2-3 |

---

## 2. LLM-as-a-Judge Column Templates

### Overview

LLM-as-a-judge is a key use case for FluffyViz. Users evaluate agent conversations using AI, then visualize patterns in the evaluations. This requires specialized templates.

### Proposed Templates

#### 2.1 Quality Score Template (1-5 Scale)

```yaml
# config/prompts/quality-score.yaml
category: Evaluation
title: Quality Score
description: Rate the quality of an agent response on a 1-5 scale

prompt_params:
  system_instruction: |
    You are an expert evaluator of AI agent conversations.
    Rate the quality of the agent's response based on:
    - Helpfulness: Did it address the user's need?
    - Accuracy: Is the information correct?
    - Clarity: Is the response clear and well-structured?
    - Appropriateness: Is the tone and style suitable?

  prompt_template: |
    Evaluate the following agent response:

    User Query: {{user_message}}
    Agent Response: {{agent_response}}

    Rate the quality from 1-5 and explain your reasoning.

output_schema:
  mode: structured
  fields:
    - id: "score"
      name: "quality_score"
      type: "number"
      description: "Quality score from 1 (poor) to 5 (excellent)"
      required: true
    - id: "reasoning"
      name: "judge_reasoning"
      type: "string"
      description: "Explanation for the score"
      required: true
    - id: "strengths"
      name: "strengths"
      type: "array_string"
      description: "What the response did well"
      required: false
    - id: "improvements"
      name: "improvements"
      type: "array_string"
      description: "Areas for improvement"
      required: false
```

#### 2.2 Failure Mode Classification

```yaml
# config/prompts/failure-mode.yaml
category: Evaluation
title: Failure Mode Classification
description: Classify the type of failure in an agent response

prompt_params:
  system_instruction: |
    You are an AI quality analyst. Identify if and how an agent response failed.

  prompt_template: |
    Analyze this agent interaction for failure modes:

    User Query: {{user_message}}
    Agent Response: {{agent_response}}

    Classify any failures and explain.

output_schema:
  mode: structured
  fields:
    - id: "has_failure"
      name: "has_failure"
      type: "boolean"
      description: "Whether a failure occurred"
      required: true
    - id: "failure_mode"
      name: "failure_mode"
      type: "enum"
      enumOptions:
        - "None"
        - "Hallucination"
        - "Off-topic"
        - "Incomplete"
        - "Harmful"
        - "Repetitive"
        - "Contradictory"
        - "Tool Error"
      required: true
    - id: "severity"
      name: "severity"
      type: "enum"
      enumOptions: ["None", "Minor", "Moderate", "Critical"]
      required: true
    - id: "explanation"
      name: "failure_explanation"
      type: "string"
      required: true
```

#### 2.3 Intent Classification

```yaml
# config/prompts/intent-classification.yaml
category: Analysis
title: User Intent Classification
description: Classify the user's intent in a conversation turn

prompt_params:
  system_instruction: |
    You are an expert at understanding user intents in conversations with AI agents.

  prompt_template: |
    Classify the intent of this user message:

    {{user_message}}

    Context (if available): {{conversation_history}}

output_schema:
  mode: structured
  fields:
    - id: "primary_intent"
      name: "primary_intent"
      type: "enum"
      enumOptions:
        - "Information Seeking"
        - "Task Completion"
        - "Clarification"
        - "Feedback"
        - "Complaint"
        - "Small Talk"
        - "Correction"
        - "Follow-up"
      required: true
    - id: "confidence"
      name: "intent_confidence"
      type: "number"
      description: "Confidence 0-1"
      required: true
    - id: "entities"
      name: "entities"
      type: "array_string"
      description: "Key entities mentioned"
      required: false
```

#### 2.4 Comparative Evaluation (A/B)

```yaml
# config/prompts/comparative-eval.yaml
category: Evaluation
title: Comparative Evaluation
description: Compare two responses and pick the better one

prompt_params:
  system_instruction: |
    You are an expert at comparing AI responses. Be objective and thorough.

  prompt_template: |
    Compare these two agent responses to the same query:

    User Query: {{user_message}}

    Response A: {{response_a}}
    Response B: {{response_b}}

    Which is better and why?

output_schema:
  mode: structured
  fields:
    - id: "winner"
      name: "winner"
      type: "enum"
      enumOptions: ["A", "B", "Tie"]
      required: true
    - id: "margin"
      name: "win_margin"
      type: "enum"
      enumOptions: ["Slight", "Clear", "Decisive"]
      required: true
    - id: "reasoning"
      name: "comparison_reasoning"
      type: "string"
      required: true
```

### Template Group in UI

```typescript
// In ai-column-templates.ts
{
  heading: 'LLM-as-a-Judge Evaluations',
  templates: [
    COLUMN_TEMPLATES.quality_score,
    COLUMN_TEMPLATES.failure_mode,
    COLUMN_TEMPLATES.intent_classification,
    COLUMN_TEMPLATES.comparative_eval,
  ]
}
```

### Effort Estimate
**Medium** - 4-6 hours
- Template YAML files: 2 hours
- Template config updates: 1 hour
- Testing with sample data: 1-2 hours
- Documentation: 1 hour

---

## 3. Export Functionality

### Overview
Users need to export their augmented data for downstream use: training datasets, reports, further analysis in notebooks.

### Key Use Cases for Agent Traces

| Export Scenario | Format | Columns Typically Included |
|-----------------|--------|---------------------------|
| Training data for fine-tuning | JSONL | content, quality_score ≥ 4 |
| Failure analysis report | CSV | All rows where has_failure = true |
| Embedding vectors | Parquet | row_id, embedding vector, content |
| Full augmented dataset | JSON | All columns |

### Proposed Implementation

#### UI Design
```
┌─────────────────────────────────────────────────────────────────┐
│ Export Augmented Data                                     [X]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ What to export:                                                 │
│ ○ All data (1,234 rows)                                         │
│ ○ Current filter (456 rows matching "quality_score > 3")        │
│ ○ Selected embedding cluster (89 points)                        │
│                                                                 │
│ Format:                                                         │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                │
│ │   CSV   │ │  JSON   │ │  JSONL  │ │ Parquet │                │
│ │    ✓    │ │         │ │         │ │         │                │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘                │
│                                                                 │
│ Columns:                                                        │
│ ☑ conversation_id    ☑ content         ☑ quality_score         │
│ ☑ judge_reasoning    ☑ intent_category ☐ embedding_vector      │
│                      [Select All] [Augmented Only]              │
│                                                                 │
│ Options:                                                        │
│ ☐ Include cell metadata (status, errors)                        │
│ ☐ Include UMAP coordinates (x, y)                               │
│                                                                 │
│                                   [Cancel]  [Export]            │
└─────────────────────────────────────────────────────────────────┘
```

### Effort Estimate
**Medium** - 6-8 hours
- Modal UI: 2-3 hours
- Export utilities (CSV, JSON, JSONL): 3-4 hours
- Integration with embedding selection: 1-2 hours

---

## 4. Single-Cell Retry

### Overview
When running LLM-as-judge evaluations across hundreds of rows, some cells will fail (rate limits, timeouts). Users need to retry individual failures without re-running the entire column.

### Current State
- `AiCell.tsx` has `onRetry` prop defined but not implemented
- `RetryModal.tsx` handles batch retry at column level
- Cell metadata tracks status and error details

### Implementation

#### UI: Inline Retry Button
```
┌─────────────────────────────────────────┐
│ Failed Cell                              │
│ ⚠️ Rate limit exceeded  [↻]             │
│                                          │
│ Tooltip: "Click to retry this cell"      │
└─────────────────────────────────────────┘
```

#### Code Changes

1. **`AiCell.tsx`** - Add retry button for failed cells
2. **`SpreadsheetTable.tsx`** - Pass retry handler
3. **`SpreadsheetEditor.tsx`** - Implement single-cell generation

### Effort Estimate
**Medium** - 4-6 hours

---

## 5. HuggingFace Integration Improvements

### Overview
Reference the [HuggingFace AI Sheets](https://github.com/huggingface/aisheets) implementation for proper Hub API integration.

### Improvements Needed
1. Enhanced model search with task filtering
2. Model compatibility validation
3. Caching layer (12 hours TTL as configured)
4. Retry logic with exponential backoff
5. Better error messages for inference failures

### Effort Estimate
**High** - 8-12 hours

---

## 6. Web Search Augmentation

### Overview

Enable LLM-generated columns to access real-time web information when answering questions. This is critical for use cases where agent conversations reference current events, product information, or data that changes frequently.

**Inspiration:** [HuggingFace AI Sheets](https://github.com/huggingface/aisheets) uses Serper API for web search.

### Use Cases for Agent Trace Analysis

| Scenario | Why Web Search Helps |
|----------|---------------------|
| Fact-checking agent claims | Verify if agent provided accurate current information |
| Competitor analysis | Look up products/services mentioned in conversations |
| News-related queries | Ground evaluations in current events context |
| Documentation lookups | Check if agent cited correct docs/APIs |

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Web Search Integration                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   LLM Provider                    Search Provider (Tool)                     │
│   ┌──────────────────┐           ┌──────────────────────┐                   │
│   │ • OpenAI         │           │ • OpenAI built-in*   │                   │
│   │ • Anthropic      │ ───────── │ • Serper API         │                   │
│   │ • Google         │  can use  │ • Tavily API         │                   │
│   │ • Mistral        │   any     │ • Brave Search API   │                   │
│   │ • Groq           │           └──────────────────────┘                   │
│   │ • Perplexity*    │                                                       │
│   └──────────────────┘                                                       │
│                                                                              │
│   * OpenAI Responses API has built-in web_search tool                        │
│   * Perplexity has native search (no tool needed)                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Insight:** LLM provider and search provider are independent choices. Any LLM can use any search tool via AI SDK's tool calling.

### Implementation Phases

#### v0: OpenAI Responses API + Perplexity Provider

**Goal:** Enable web search with minimal changes using providers that have built-in search.

##### 6.1 Migrate OpenAI to Responses API

The AI SDK supports OpenAI Responses API natively:

```typescript
// Before (Chat Completions API)
import { createOpenAI } from '@ai-sdk/openai'
const provider = createOpenAI({ apiKey })
const model = provider('gpt-4o')

// After (Responses API)
const model = provider.responses('gpt-4o')
```

**Code Changes in `ai-inference.ts`:**

```typescript
function getAISDKModel(
  providerId: ProviderKey,
  modelId: string,
  apiKey: string,
  useWebSearch: boolean = false  // New parameter
) {
  switch (providerId) {
    case 'openai': {
      const provider = createOpenAI({ apiKey })
      // Use Responses API when web search is enabled
      return useWebSearch
        ? provider.responses(modelId)
        : provider(modelId)
    }
    // ... other providers unchanged
  }
}
```

**Web Search Tool:**

```typescript
import { openai } from '@ai-sdk/openai'

// When calling generateText with web search
const { text } = await generateText({
  model: openai.responses('gpt-4o'),
  prompt: userPrompt,
  tools: {
    web_search: openai.tools.webSearch(),
  },
  maxSteps: 3,  // Allow tool use round-trips
})
```

##### 6.2 Add Perplexity Provider

Perplexity models have native search—no tool calling needed.

**Install:**
```bash
npm install @ai-sdk/perplexity
```

**Add to `provider-settings.ts`:**

```typescript
export type ProviderKey =
  | 'openai'
  | 'anthropic'
  // ... existing providers
  | 'perplexity'  // NEW

export const PROVIDER_META: Record<ProviderKey, ProviderMeta> = {
  // ... existing providers
  perplexity: {
    label: 'Perplexity',
    freeTier: false,
    needsApiKey: true,
    supports: { text: true, embedding: false, mmEmbedding: false },
  },
}
```

**Add to `ai-inference.ts`:**

```typescript
import { createPerplexity } from '@ai-sdk/perplexity'

case 'perplexity': {
  const provider = createPerplexity({ apiKey })
  return provider(modelId)  // e.g., 'sonar', 'sonar-pro'
}
```

**Perplexity Models:**
- `sonar` - Fast, web-grounded responses
- `sonar-pro` - More capable, better citations

##### 6.2.1 Structured Output + Web Search Compatibility

**Critical Limitation:** `generateObject` does NOT support tools. This is by design in the AI SDK.

When combining **web search + structured output**, use `generateText` with `experimental_output`:

```typescript
import { generateText, Output } from 'ai'
import { z } from 'zod'

// ❌ This will NOT work - generateObject doesn't support tools
const { object } = await generateObject({
  model: openai.responses('gpt-4o'),
  schema: mySchema,
  tools: { web_search: openai.tools.webSearch() },  // Tools ignored!
  prompt: userPrompt,
})

// ✅ Correct approach - use generateText with experimental_output
const { experimental_output } = await generateText({
  model: openai.responses('gpt-4o'),
  prompt: userPrompt,
  tools: {
    web_search: openai.tools.webSearch(),
  },
  maxSteps: 3,
  experimental_output: Output.object({
    schema: z.object({
      score: z.number().describe('Quality score 1-5'),
      reasoning: z.string().describe('Explanation for the score'),
      sources_used: z.array(z.string()).describe('URLs referenced'),
    }),
  }),
})

// Result is in experimental_output
const result = experimental_output
```

**Implementation in `ai-inference.ts`:**

Three code paths needed:

| Scenario | Function | Notes |
|----------|----------|-------|
| Text output (no web search) | `generateText` | Current approach |
| Structured output (no web search) | `generateObject` | Current approach |
| Text output + web search | `generateText` + tools | Add tools parameter |
| **Structured output + web search** | `generateText` + `experimental_output` | **New path** |

```typescript
// In generateStructuredCompletion()
if (useWebSearch) {
  // Use generateText with experimental_output when web search is enabled
  const { experimental_output } = await generateText({
    model: aiModel,
    prompt: promptWithSchema,
    tools: getWebSearchTools(providerId, searchProvider),
    maxSteps: 3,
    experimental_output: Output.object({ schema: zodSchema }),
  })
  return { content: JSON.stringify(experimental_output), data: experimental_output }
} else {
  // Use generateObject when no web search (current behavior)
  const { object } = await generateObject({
    model: aiModel,
    schema: zodSchema,
    prompt: promptWithSchema,
    temperature,
  })
  return { content: JSON.stringify(object), data: object }
}
```

**Requirements:**
- AI SDK 4.0.24+ (current: 5.0.60 ✅)
- `experimental_output` may change in future releases (monitor AI SDK changelog)

**References:**
- [GitHub Discussion: Tools with generateObject](https://github.com/vercel/ai/discussions/1395)
- [GitHub Discussion: Structured output with tools](https://github.com/vercel/ai/discussions/3323)

##### 6.3 UI: Web Search Toggle in AddColumnModal

```
┌─────────────────────────────────────────────────────────────────┐
│ Add AI Column                                              [X]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Template: [Custom Prompt ▼]                                      │
│                                                                  │
│ Prompt:                                                          │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Verify if the agent's claim about @product_name is accurate  │ │
│ │ based on current information.                                │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ☑ Enable web search                                              │
│   ℹ️ LLM will search the web for current information             │
│                                                                  │
│ Provider: [OpenAI ▼]     Model: [gpt-4o ▼]                       │
│                                                                  │
│ ⚠️ Web search adds latency and API costs per row                 │
│                                                                  │
│                                   [Cancel]  [Generate Column]    │
└─────────────────────────────────────────────────────────────────┘
```

**Conditional Logic:**
- When "Enable web search" is checked:
  - If OpenAI selected → use `openai.responses()` + `webSearch` tool
  - If Perplexity selected → use native search (no change needed)
  - If other provider → show message: "Select OpenAI or Perplexity for web search. Search provider configurations coming soon."

##### v0 Effort Estimate

| Task | Hours |
|------|-------|
| OpenAI Responses API migration in `ai-inference.ts` | 2 |
| Add Perplexity provider | 1-2 |
| `experimental_output` code path for structured + web search | 2-3 |
| Web search toggle in AddColumnModal | 2 |
| Conditional provider logic | 1-2 |
| Update `generate-column` API route | 2 |
| Testing with sample prompts (text + structured modes) | 2-3 |
| **Total** | **12-16 hours** |

---

#### v1: External Search Providers as Tools

**Goal:** Allow any LLM to use web search via external APIs (Serper, Tavily, Brave).

##### 6.4 Search Provider Configuration

Add a new tab in the Provider Settings modal:

```
┌─────────────────────────────────────────────────────────────────┐
│ Settings                                                   [X]   │
├─────────────────────────────────────────────────────────────────┤
│ [Model Providers]  [Search Providers]  [Defaults]                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Search Providers                                                 │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Serper                                        [Disabled ▼]  │ │
│ │ API Key: [••••••••••••••••1234]               [Test]        │ │
│ │ Free tier: 2,500 searches/month                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Tavily                                        [Enabled ▼]   │ │
│ │ API Key: [••••••••••••••••5678]               [Test]        │ │
│ │ Free tier: 1,000 searches/month                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Brave Search                                  [Disabled ▼]  │ │
│ │ API Key: [                    ]               [Test]        │ │
│ │ Free tier: 2,000 searches/month                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Default search provider: [Tavily ▼]                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Config Schema (`provider-settings.ts`):**

```typescript
export type SearchProviderKey = 'serper' | 'tavily' | 'brave'

export interface SearchProviderConfig {
  apiKey: string
  enabled: boolean
}

export interface ProviderSettings {
  version: string
  providers: Partial<Record<ProviderKey, ProviderConfig>>
  searchProviders: Partial<Record<SearchProviderKey, SearchProviderConfig>>  // NEW
  defaults?: {
    augmentation?: ProviderKey
    embedding?: ProviderKey
    search?: SearchProviderKey  // NEW
  }
}
```

##### 6.5 Search Tool Implementations

Create unified search tools in `src/lib/websearch/`:

```typescript
// src/lib/websearch/types.ts
export interface SearchResult {
  title: string
  link: string
  snippet: string
}

export interface SearchProvider {
  search(query: string, numResults?: number): Promise<SearchResult[]>
}
```

```typescript
// src/lib/websearch/serper.ts
export class SerperSearch implements SearchProvider {
  constructor(private apiKey: string) {}

  async search(query: string, numResults = 5): Promise<SearchResult[]> {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: numResults }),
    })

    const { organic } = await response.json()
    return organic.map((r: any) => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet || r.description || '',
    }))
  }
}
```

```typescript
// src/lib/websearch/tavily.ts
export class TavilySearch implements SearchProvider {
  constructor(private apiKey: string) {}

  async search(query: string, numResults = 5): Promise<SearchResult[]> {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        max_results: numResults,
      }),
    })

    const { results } = await response.json()
    return results.map((r: any) => ({
      title: r.title,
      link: r.url,
      snippet: r.content,
    }))
  }
}
```

##### 6.6 AI SDK Tool Definition

```typescript
// src/lib/websearch/tool.ts
import { tool } from 'ai'
import { z } from 'zod'

export function createWebSearchTool(searchProvider: SearchProvider) {
  return tool({
    description: 'Search the web for current information. Use this when you need up-to-date facts, news, or data.',
    parameters: z.object({
      query: z.string().describe('The search query'),
    }),
    execute: async ({ query }) => {
      const results = await searchProvider.search(query, 5)
      return results.map(r =>
        `[${r.title}](${r.link})\n${r.snippet}`
      ).join('\n\n')
    },
  })
}
```

**Usage in `generateText`:**

```typescript
const searchTool = createWebSearchTool(new TavilySearch(apiKey))

const { text } = await generateText({
  model: anthropic('claude-3-5-sonnet-20241022'),
  prompt: userPrompt,
  tools: {
    web_search: searchTool,
  },
  maxSteps: 3,
})
```

##### 6.7 Caching Layer

Cache search results to reduce API costs:

```typescript
// src/lib/websearch/cache.ts
const searchCache = new Map<string, { results: SearchResult[], timestamp: number }>()
const CACHE_TTL = 360 * 2 * 60 * 1000 // 12 hours

export async function cachedSearch(
  provider: SearchProvider,
  query: string
): Promise<SearchResult[]> {
  const cacheKey = `${provider.constructor.name}:${query}`
  const cached = searchCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.results
  }

  const results = await provider.search(query)
  searchCache.set(cacheKey, { results, timestamp: Date.now() })
  return results
}
```

##### v1 Effort Estimate

| Task | Hours |
|------|-------|
| Search provider config schema | 1-2 |
| Settings UI - Search Providers tab | 3-4 |
| Serper implementation | 1-2 |
| Tavily implementation | 1-2 |
| Brave implementation | 1-2 |
| AI SDK tool wrapper | 2 |
| Caching layer | 2 |
| Integration in `generate-column` route | 2-3 |
| Testing across providers | 2-3 |
| **Total** | **15-20 hours** |

---

### Considerations

#### Rate Limiting & Usage Tracking

| Provider | Free Tier | Tracking Needed |
|----------|-----------|-----------------|
| OpenAI web_search | Token-based | Included in LLM usage |
| Perplexity | Token-based | Included in LLM usage |
| Serper | 2,500/month | Track query count |
| Tavily | 1,000/month | Track query count |
| Brave | 2,000/month | Track query count |

Consider adding usage counters in localStorage or DuckDB to warn users when approaching limits.

#### Batch Processing Impact

With web search enabled, each row may trigger searches:
- 100 rows × 1-2 searches = 100-200 API calls
- Add confirmation dialog: "This will use approximately X search queries"
- Consider search query deduplication across similar rows

#### Structured Output Compatibility

Web search works with both text and structured output modes:

```typescript
// Structured output with web search
const { object } = await generateObject({
  model: openai.responses('gpt-4o'),
  schema: outputSchema,
  prompt: promptWithSchema,
  tools: {
    web_search: openai.tools.webSearch(),
  },
  maxSteps: 3,
})
```

### File Structure

```
src/lib/websearch/
├── index.ts                 # Exports
├── types.ts                 # SearchResult, SearchProvider interfaces
├── serper.ts                # Serper API implementation
├── tavily.ts                # Tavily API implementation
├── brave.ts                 # Brave Search implementation
├── tool.ts                  # AI SDK tool wrapper
└── cache.ts                 # Result caching

src/config/
├── provider-settings.ts     # Add SearchProviderKey, SearchProviderConfig
└── search-providers.ts      # Search provider metadata (free tiers, etc.)
```

### Effort Summary

| Phase | Scope | Hours |
|-------|-------|-------|
| **v0** | OpenAI Responses API + Perplexity + `experimental_output` | 12-16 |
| **v1** | External search providers (Serper, Tavily, Brave) | 15-20 |
| **Total** | Full web search capability | **27-36 hours** |

---

## Priority Matrix (Revised)

Given the workflow context (Parse → Augment → Visualize), priorities are:

| Feature | Impact on Workflow | Effort | Priority |
|---------|-------------------|--------|----------|
| **Embedding Atlas Deep Integration** | Critical - destination of workflow | High (18-22 hrs) | **P0** |
| **LLM-as-a-Judge Templates** | Critical - key augmentation use case | Medium (4-6 hrs) | **P0** |
| **Export Functionality** | High - enables downstream workflows | Medium (6-8 hrs) | **P1** |
| **Web Search v0** | High - fact-checking, current info | Medium (12-16 hrs) | **P1** |
| **Single-Cell Retry** | Medium - improves augmentation UX | Medium (4-6 hrs) | **P2** |
| **Web Search v1** | Medium - provider flexibility | Medium (15-20 hrs) | **P2** |
| **HuggingFace Improvements** | Medium - quality of life | High (8-12 hrs) | **P3** |
| **LLM-as-a-Judge Registry** | High - community value | High | **P4** (Future) |

### Recommended Implementation Order

1. **LLM-as-a-Judge Templates** (4-6 hours)
   - Quick win, immediately useful for users
   - Enables testing of embedding integration

2. **Embedding Atlas Deep Integration** (18-22 hours)
   - Core differentiator
   - Leverages built-in features (table, details, clustering)
   - Split into phases:
     - **Phase 1:** Pass ALL columns to embedding table
     - **Phase 2:** Color dropdown + hover checkbox selectors
     - **Phase 3:** Save filter functionality
     - **Phase 4:** Keyword search (DuckDB ILIKE)
     - **Phase 5:** Conceptual search (DuckDB cosine similarity)

3. **Export** (6-8 hours)
   - Enables workflow completion
   - Users can take insights elsewhere

4. **Web Search v0** (12-16 hours)
   - OpenAI Responses API migration
   - Add Perplexity provider
   - `experimental_output` for structured output + web search
   - Enables fact-checking and current info grounding

5. **Single-Cell Retry** (4-6 hours)
   - Quality of life for augmentation step

6. **Web Search v1** (15-20 hours)
   - External search providers (Serper, Tavily, Brave)
   - Search provider config UI
   - Any LLM can use any search tool

7. **HuggingFace** (8-12 hours)
   - Can be incremental
   - Caching already helps with 12-hour TTL

8. **LLM-as-a-Judge Prompt Registry** (Future)
   - Build after core features are stable and adopted
   - Similar to Promptfoo's vulnerability database model
   - Community-contributed evaluation prompts
   - Upvote/rating system for quality prompts

---

## References

- [Embedding Atlas GitHub](https://github.com/apple/embedding-atlas)
- [Embedding Atlas Docs](https://apple.github.io/embedding-atlas/)
- [HuggingFace AI Sheets](https://github.com/huggingface/aisheets)
- [Mosaic Framework](https://uwdata.github.io/mosaic/)
- [Lilac ML](https://github.com/lilacai/lilac) - Conceptual search inspiration
- [LLM-as-a-Judge Paper](https://arxiv.org/abs/2306.05685)
- [DuckDB Vector Functions](https://duckdb.org/docs/sql/functions/list.html) - list_cosine_similarity

### Web Search
- [AI SDK OpenAI Responses Guide](https://sdk.vercel.ai/docs/guides/openai-responses) - OpenAI Responses API integration
- [AI SDK Perplexity Provider](https://sdk.vercel.ai/providers/ai-sdk-providers/perplexity) - Perplexity with native search
- [AI SDK Tool Calling](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling) - Custom tool definitions
- [Serper API](https://serper.dev/) - Google search API (2,500 free/month)
- [Tavily API](https://tavily.com/) - AI-optimized search (1,000 free/month)
- [Brave Search API](https://brave.com/search/api/) - Privacy-focused search (2,000 free/month)
