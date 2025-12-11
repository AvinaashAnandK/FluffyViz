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
- Choose from 10+ providers: OpenAI, Anthropic, Google, Perplexity, Groq, Together AI, Mistral, Cohere, Novita, HuggingFace
- Configure API keys per provider

**Prompt Editor**:
- Rich text editor with variable pills
- Type `@` to insert column references
- Preview interpolated prompts before generation

**Generation Settings**:
- Temperature control (creativity vs. focus)
- Max tokens limit
- Web search configuration

### 4. Web Search Augmentation (NEW)

Enhance AI responses with real-time web information:

**How It Works**:
- Enable "Web Search" toggle in Generation Settings
- Configure location (City, Region, Country as ISO code)
- AI queries the web before generating responses
- Sources automatically saved to companion `_sources` column

**Supported Providers**:
| Provider | Search Type | Notes |
|----------|-------------|-------|
| OpenAI | Tool-based | Uses `web_search_preview` tool via Responses API |
| Perplexity | Built-in | Always searches, location optional |
| Google | Grounding | Search grounding for Gemini models |

**Location Settings**:
- City: Free text (e.g., "Bangalore")
- Region: Free text (e.g., "Karnataka")
- Country: ISO code (e.g., "IN" for India, "US" for USA)

**Output**:
- Main column: AI response with current information
- Sources column: JSON array of URLs used

### 5. Conversational History Aggregation

Transform multi-turn conversations into formatted context:

**Aggregation Strategies**:
- `turn_only` - Single turn
- `history_until_turn` - All turns up to current
- `turn_plus_n` - Current turn plus N previous
- `full_conversation` - Entire conversation

Uses `conversation_id` and `sequence_id` columns to group and order turns.

### 6. Structured Output Mode

Generate JSON responses validated against a schema:

**Features**:
- Define output fields with types (string, number, boolean, array)
- Schema validation ensures consistent output
- Automatic expansion into separate columns per field
- Works with all providers via Vercel AI SDK

### 7. Embedding Visualization

Generate and visualize semantic embeddings:

- **Composition Modes**:
  - Single column
  - Multiple columns with separator
  - Full conversational context
- **UMAP Reduction** - Project high-dimensional vectors to 2D
- **Interactive Scatter Plot** - Click points to view trace details
- **Persistent Layers** - Save embedding layers for comparison

### 8. Privacy-First Architecture

- **All data stays in your browser** - DuckDB WASM database
- **No server-side storage** - Files stored in IndexedDB
- **Provider API calls** - Only when you explicitly generate content
- **Max file size** - 50MB (warning at 30MB)

---

## Target Users

### ML Engineers

Transform raw agent logs into structured data for:
- Model performance analysis
- Quality evaluation (LLM-as-a-Judge)
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
4. Configure Generation Settings:
   - Temperature and max tokens
   - Enable web search (optional)
   - Set location for local results
5. Map template variables to columns
6. Preview interpolated prompt
7. Generate augmented data

### Step 4: Review Results

- AI responses appear in new column
- Sources (if web search enabled) in `_sources` column
- Cell metadata tracks status (success/failed)
- Retry failed cells with different models

### Step 5: Iterate

- Add multiple AI columns
- Aggregate conversational history
- Generate embeddings for visualization

### Step 6: Visualize

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

| Provider | Free Tier | Text | Embeddings | Web Search | Streaming |
|----------|-----------|------|------------|------------|-----------|
| OpenAI | No | Yes | Yes | Yes | Yes |
| Perplexity | No | Yes | No | Built-in | Yes |
| Google AI | Yes | Yes | Yes | Yes | Yes |
| Anthropic | No | Yes | No | No | Yes |
| Groq | Yes | Yes | No | No | Yes |
| Cohere | Yes | Yes | Yes | No | Yes |
| Mistral | Yes | Yes | Yes | No | Yes |
| Together AI | Yes | Yes | No | No | Yes |
| HuggingFace | Yes | Yes | Yes | No | Yes |
| Novita AI | Yes | Yes | No | No | Yes |

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
- Web search augmentation - get current information

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
6. Enable web search for current information (optional)
7. Generate augmented data

### Sample Files

FluffyViz works with standard agent log formats:
- Message-centric JSONL
- Langfuse/LangSmith JSON exports
- Turn-level CSV files

---

## Performance Considerations

- **File size limit**: 50MB maximum
- **Large datasets**: Use filtering and pagination for datasets >1000 rows
- **Embedding generation**: Batch processing with progress tracking
- **Model selection**: Some providers have rate limits on free tiers
- **Web search**: Adds latency (~1-3 seconds per request)

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

### Search-Augmented Responses
Upload questions → Enable web search → Generate current answers → Verify with sources

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
A: To use AI columns, you need API keys for your chosen providers (e.g., OpenAI, Perplexity). Keys are stored securely in your local browser storage.

**Q: Can I work offline?**
A: Yes! You can upload, view, and edit files completely offline. Only AI column generation requires an internet connection.

**Q: What file size limits apply?**
A: Maximum 50MB per file. A warning appears at 30MB. For larger datasets, consider pre-filtering your data.

**Q: How does web search work?**
A: When enabled, the AI provider searches the web before generating a response. Sources are saved to a companion column for verification.

**Q: Which providers support web search?**
A: OpenAI (via Responses API), Perplexity (built-in), and Google (search grounding).

---

## Known Issues

### Search-Preview Models Not Supported
Models like `gpt-4o-search-preview` don't work due to an AI SDK bug. Use:
- OpenAI Responses API models (GPT-4o, GPT-4.1) with web search tool
- Perplexity models (Sonar, Sonar Pro) with built-in search

See [PROVIDER_CONFIG.md](./PROVIDER_CONFIG.md) for details.

---

## Roadmap

### Current Focus
- Web search augmentation with sources
- Enhanced prompt editor with variable pills
- Improved error handling and retry mechanisms

### Future Plans
- Export functionality (CSV, JSON, Parquet)
- Web Worker support for large files
- Virtual scrolling for 10k+ row datasets
- OAuth integration for providers
- Collaborative editing features

---

## Support

- **Documentation**: See technical_docs.md for implementation details
- **Issues**: Report bugs and feature requests on GitHub
- **Contributing**: Pull requests welcome

---

## Summary

FluffyViz empowers AI/ML teams to quickly analyze and augment their agent data:

- **Parse** any format with auto-detection
- **Augment** with 10+ AI providers and web search
- **Visualize** patterns with embedding clusters

All without:
- Writing custom scripts
- Setting up infrastructure
- Compromising data privacy
- Learning complex tools

**Upload your data. Augment with AI. Visualize insights.**
