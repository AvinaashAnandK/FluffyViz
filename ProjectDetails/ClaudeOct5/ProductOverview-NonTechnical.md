# FluffyViz - Product Overview for Non-Technical Users

## What is FluffyViz?

FluffyViz is a web application that helps AI teams make sense of their messy AI conversation logs. It turns raw chatbot outputs and agent traces into organized spreadsheets where you can analyze patterns, add insights, and understand how your AI systems are performing.

## The Problem It Solves

When AI teams build chatbots or AI agents, they generate tons of conversation logs. These logs are typically unstructured text that's hard to analyze. Teams struggle to answer questions like:
- "Which conversations led to successful outcomes?"
- "What topics are users most interested in?"
- "Where is our AI failing?"

FluffyViz bridges this gap by making AI conversation data easy to explore and augment with AI-powered insights.

## How It Works (Simple Workflow)

### 1. **Upload Your Data**
- Drag and drop your AI conversation logs (CSV, JSON, or JSONL files)
- FluffyViz automatically detects what format your data is in
- Supports popular AI platforms like Langfuse, LangSmith, and Arize

### 2. **View as a Spreadsheet**
- Your messy data gets transformed into a clean spreadsheet
- Each row is a conversation or message
- Each column is an attribute (user input, AI response, timestamp, etc.)

### 3. **Add AI-Powered Columns**
- Click "Add Column" to create new insights
- Choose from templates like:
  - **Sentiment Analysis**: Is this conversation positive or negative?
  - **Topic Extraction**: What is this conversation about?
  - **Summarization**: Condense long conversations
  - **Classification**: Categorize conversations (support, sales, etc.)
  - **Custom Prompts**: Ask any question about your data
- **Enable Web Search**: Toggle on to let AI access real-time web information
  - Perfect for fact-checking, current events, or research-augmented tasks
  - Works with OpenAI, Google Gemini, and Perplexity models

### 4. **Select Your AI Model**
- Choose from 100+ AI models (GPT-4, Claude, Llama, etc.)
- Pick your inference provider (OpenAI, Anthropic, Groq, etc.)
- FluffyViz handles all the technical details

### 5. **Export and Visualize**
- Download your enriched data
- Future: Export directly to visualization tools like Embedding Atlas

## Key Features

### ✅ **Smart Format Detection**
Upload any common AI log format and FluffyViz figures out how to parse it automatically.

### ✅ **Multiple AI Providers**
Not locked into one AI company—choose from OpenAI, Anthropic, Cohere, Groq, Google, Perplexity, and more.

### ✅ **Web Search Augmentation**
Enable real-time web search for AI columns when you need current information or fact-checking. Supported by OpenAI, Google Gemini, and Perplexity models.

### ✅ **Privacy-First**
All your data stays in your browser. Nothing is sent to external servers except AI inference requests (which you control).

### ✅ **No Installation Required**
Works entirely in your web browser. No software to install.

### ✅ **Template Library**
Pre-built prompts for common tasks so you don't have to write complex prompts from scratch.

## Who Should Use FluffyViz?

- **AI Product Managers**: Understand user behavior and product performance
- **ML Engineers**: Analyze model outputs and find failure patterns
- **Data Analysts**: Augment conversation data with structured attributes
- **Researchers**: Explore large conversation datasets efficiently

## Example Use Cases

### Use Case 1: Customer Support Analysis
**Problem**: You have 10,000 support chat logs and want to know which ones were resolved successfully.

**Solution with FluffyViz**:
1. Upload your chat logs
2. Add column: "Was this issue resolved?" (Yes/No classification)
3. Add column: "Customer sentiment" (Positive/Neutral/Negative)
4. Filter and analyze patterns

### Use Case 2: Chatbot Quality Assessment
**Problem**: Your chatbot generates thousands of responses daily. Which ones are high quality?

**Solution with FluffyViz**:
1. Upload conversation logs
2. Add column: "Response quality score" (1-10 rating)
3. Add column: "Main topic discussed"
4. Identify low-scoring conversations and improve

### Use Case 3: Agent Behavior Research
**Problem**: You're testing different AI agent configurations and need to compare performance.

**Solution with FluffyViz**:
1. Upload traces from different agent versions
2. Add column: "Task success" (Did the agent complete the task?)
3. Add column: "Efficiency rating" (How many steps did it take?)
4. Compare configurations side-by-side

## Technology Foundation

FluffyViz is built as an **open-source tool** combining:
- **HuggingFace AI Sheets**: For AI-powered spreadsheet augmentation
- **Apple Embedding Atlas**: For data visualization (future integration)

## Pricing

Currently in development. Expected to be free and open-source.

## Current Status

**Beta Ready** - Core features working:
- ✅ File upload and format detection
- ✅ Spreadsheet viewing and editing
- ✅ AI model and provider selection UI
- ✅ Prompt template library
- ✅ AI inference integration (OpenAI, Anthropic, Google, Perplexity, and more)
- ✅ Web search augmentation for AI columns
- ✅ DuckDB-based data persistence
- 🚧 Export to visualization tools (in progress)

## Privacy & Security

- **Local-first**: All data stored in your browser using DuckDB WASM
- **No accounts required**: No login, no tracking
- **Controlled AI requests**: You choose when to send data to AI providers
- **File size limits**: 50MB max to keep your browser performant
- **API keys stay local**: Provider API keys are stored only in your browser

## Getting Started

1. Visit the FluffyViz web app (URL TBD when deployed)
2. Click "Upload File" or drag a file into the upload area
3. Wait for automatic format detection
4. View your data as a spreadsheet
5. Click "Add Column" to start augmenting your data

## Support & Feedback

- GitHub: [Repository link TBD]
- Documentation: [Docs link TBD]
- Issues/Bugs: Report via GitHub Issues

---

**Last Updated**: December 2025
**Version**: Beta Build
