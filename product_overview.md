# FluffyViz Product Overview

## What is FluffyViz?

FluffyViz is a **local-first web application** that transforms raw AI agent conversation logs into actionable spreadsheet data with AI-powered augmentation. Built for AI/ML engineers and product managers who need to analyze, enrich, and visualize their agent data without compromising privacy.

**Core Workflow**: Upload → Augment → Visualize

---

## Key Features

### 1. Multi-Format Data Import

Upload your agent data in any common format:

- **JSONL** - Message-centric conversation logs
- **JSON** - Langfuse spans, LangSmith runs, Arize traces
- **CSV** - Turn-level structured data

FluffyViz automatically detects your data format and flattens nested structures into clean spreadsheet columns using dot notation (e.g., `user.name`, `response.tokens`).

### 2. Spreadsheet Editor

View and edit your data in a familiar spreadsheet interface:

- **Pagination** - Handle large datasets efficiently (100 rows/page)
- **Sorting** - Sort by any column
- **Filtering** - Query with operators: `=`, `!=`, `>`, `<`, `LIKE`, `IS NULL`, etc.
- **Inline Editing** - Click any cell to edit

### 3. AI-Powered Column Augmentation

Add intelligent columns using AI models:

**Built-in Templates**:
- Translate text to multiple languages
- Extract keywords
- Summarize content
- Analyze sentiment
- Classify into categories
- Custom prompts (single or multi-column input)

**Model Selection**:
- Search models from HuggingFace registry
- Choose from 10 providers: OpenAI, Anthropic, Google, Groq, Together AI, Mistral, Cohere, Novita, HuggingFace, Local LLM
- Configure API keys per provider

**Prompt Editor**:
- Rich text editor with variable pills
- Type `@` to insert column references
- Preview interpolated prompts before generation

### 4. Conversational History Aggregation

Transform multi-turn conversations into formatted context:

**Aggregation Strategies**:
- `turn_only` - Single turn
- `history_until_turn` - All turns up to current
- `turn_plus_n` - Current turn plus N previous
- `full_conversation` - Entire conversation

Uses `conversation_id` and `sequence_id` columns to group and order turns.

### 5. Embedding Visualization

Generate and visualize semantic embeddings:

- **Composition Modes**:
  - Single column
  - Multiple columns with separator
  - Full conversational context
- **UMAP Reduction** - Project high-dimensional vectors to 2D
- **Interactive Scatter Plot** - Click points to view trace details
- **Persistent Layers** - Save embedding layers for comparison

### 6. Privacy-First Architecture

- **All data stays in your browser** - DuckDB WASM database
- **No server-side storage** - Files stored in IndexedDB
- **Provider API calls** - Only when you explicitly generate content
- **Max file size** - 50MB (warning at 25MB)

---

## Target Users

### ML Engineers

Transform raw agent logs into structured data for:
- Model performance analysis
- Quality evaluation
- A/B testing insights
- Error pattern detection

### AI Product Managers

Gain insights into:
- User interaction patterns
- Feature performance metrics
- Conversation quality trends
- Content categorization

---

## User Workflow

### Step 1: Upload

1. Drag and drop or click to select file
2. FluffyViz auto-detects format with confidence scoring
3. Preview data structure before import
4. Override format if detection is incorrect

### Step 2: Edit & Explore

1. Browse data in spreadsheet view
2. Sort and filter to find patterns
3. Edit cells inline as needed
4. Navigate with pagination controls

### Step 3: Augment with AI

1. Click "Add Column" button
2. Select a template or write custom prompt
3. Choose AI model and provider
4. Map template variables to columns
5. Preview interpolated prompt
6. Generate augmented data

### Step 4: Iterate

- Retry failed cells with different models
- Add multiple AI columns
- Aggregate conversational history
- Generate embeddings for visualization

### Step 5: Visualize

1. Open Embedding Wizard
2. Select composition mode
3. Choose columns to embed
4. Generate embeddings
5. Explore interactive scatter plot
6. Click points to view full traces

---

## Supported Data Formats

| Format | File Type | Description |
|--------|-----------|-------------|
| Message-Centric | JSONL | Simple `{role, content, timestamp}` turns |
| Langfuse Spans | JSON | Observations with type (SPAN/GENERATION/EVENT) |
| LangSmith Runs | JSON | LLM runs with inputs, outputs, metadata |
| Arize Traces | JSON | ML observability traces |
| Turn-Level | CSV | Pre-structured tabular data |

---

## AI Provider Support

| Provider | Free Tier | Text | Embeddings | Streaming |
|----------|-----------|------|------------|-----------|
| HuggingFace | Yes | Yes | Yes | Yes |
| Google AI | Yes | Yes | Yes | Yes |
| Cohere | Yes | Yes | Yes | Yes |
| Mistral | Yes | Yes | Yes | Yes |
| Groq | Yes | Yes | No | Yes |
| Together AI | Yes | Yes | No | Yes |
| Novita AI | Yes | Yes | No | Yes |
| OpenAI | No | Yes | Yes | Yes |
| Anthropic | No | Yes | No | Yes |
| Local LLM | Yes | Yes | No | - |

---

## Built-in Templates

### Translation
Translate text to specified languages while preserving tone and context.

### Keyword Extraction
Extract relevant keywords and phrases from content.

### Summarization
Generate concise summaries of longer text.

### Sentiment Analysis
Classify sentiment as positive, negative, or neutral with confidence scores.

### Classification
Categorize content into user-defined classes.

### Custom Prompts
Write your own prompts with:
- Single column input - reference one data column
- Multi-column input - combine multiple columns

### Conversational History
Aggregate multi-turn conversations with configurable strategies.

---

## Getting Started

### Prerequisites
- Modern browser (Chrome, Firefox, Safari, Edge)
- Optional: API keys for AI providers

### Quick Start

1. Open FluffyViz in your browser
2. Upload a sample file (JSON, JSONL, or CSV)
3. Explore the spreadsheet editor
4. Add an AI column using a template
5. Configure your provider API key
6. Generate augmented data

### Sample Files

FluffyViz includes sample files for testing:
- `sample-message-centric.jsonl`
- `sample-langfuse.json`
- `sample-langsmith.json`
- `sample-turn-level.csv`

---

## Performance Considerations

- **File size limit**: 50MB maximum
- **Large datasets**: Use filtering and pagination for datasets >1000 rows
- **Embedding generation**: Batch processing with progress tracking
- **Model selection**: Some providers have rate limits on free tiers

---

## Privacy & Security

FluffyViz is designed with privacy as a core principle:

- **No account required** - Start using immediately
- **Browser-only storage** - Data never leaves your machine
- **API keys stored locally** - In browser config, not transmitted to FluffyViz servers
- **Open source** - Audit the code yourself

**Note**: When generating AI content, data is sent to your selected provider (OpenAI, Anthropic, etc.) according to their privacy policies.

---

## Use Cases

### Agent Quality Analysis
Upload agent logs → Classify response quality → Aggregate by conversation → Identify patterns

### Multi-Language Support
Upload conversations → Translate to target language → Extract sentiment → Compare across languages

### Error Detection
Upload traces → Classify error types → Generate summaries → Create debugging reports

### User Intent Mining
Upload interactions → Extract keywords → Classify intents → Visualize clusters

### Performance Benchmarking
Upload runs → Generate embeddings → Visualize semantic similarity → Compare model outputs

---

## FAQ

**Q: Where is my data stored?**
A: All data is stored locally in your browser's DuckDB WASM database (backed by IndexedDB). Clearing your browser data will remove your files.

**Q: Do I need an API key?**
A: To use AI columns, you will need to configure API keys for your chosen providers (e.g., OpenAI, Anthropic, HuggingFace). These keys are stored securely in your local browser storage.

**Q: Can I work offline?**
A: Yes! You can upload, view, and edit files completely offline. Only the AI column generation and embedding visualization require an internet connection.

**Q: What file size limits apply?**
A: Maximum 50MB per file. A warning appears at 25MB. For larger datasets, consider pre-filtering your data.

---

## Roadmap

### Current Focus
- Enhanced prompt editor with variable pills
- Improved error handling and retry mechanisms
- Extended provider support

### Future Plans
- Web Worker support for large files
- Virtual scrolling for 10k+ row datasets
- OAuth integration for providers
- Export to additional visualization tools
- Collaborative editing features

---

## Support

- **Documentation**: See technical docs for implementation details
- **Issues**: Report bugs and feature requests on GitHub
- **Contributing**: Pull requests welcome

---

## Summary

FluffyViz empowers AI/ML teams to quickly analyze and augment their agent data without:
- Writing custom scripts
- Setting up infrastructure
- Compromising data privacy
- Learning complex tools

**Upload your data. Augment with AI. Visualize insights.**
