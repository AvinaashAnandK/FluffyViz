# FluffyViz - Product Overview (Non-Technical)

*Last Updated: October 10, 2025*

## What is FluffyViz?

FluffyViz is a browser-based data transformation platform that helps AI teams turn messy conversation logs and agent data into clean, analyzable spreadsheets. Think of it as Excel meets AI - you upload raw data files, and FluffyViz automatically organizes them into spreadsheets where you can add AI-powered analysis columns.

## Who Uses FluffyViz?

### Primary Users
- **ML Engineers**: Analyze AI agent performance by processing raw conversation logs
- **AI Product Managers**: Understand user interactions and feature adoption through data analysis

## What Problem Does It Solve?

When you build AI agents or chatbots, they generate lots of conversation data in different formats. This data is messy and hard to analyze. FluffyViz:

1. **Accepts messy data** - Upload CSV, JSON, or JSONL files from any AI platform
2. **Automatically organizes it** - Recognizes common formats (Langfuse, LangSmith, Arize) and converts them to spreadsheets
3. **Adds AI insights** - Create new columns that use AI to analyze your data (sentiment, keywords, summaries, translations)
4. **Works in your browser** - No data leaves your computer; everything runs locally

## The 4-Step FluffyViz Workflow

### Step 1: Upload
Drag and drop your data file. FluffyViz automatically detects if it's:
- Message-based conversations
- LangSmith run data
- Langfuse traces
- Arize logs
- Or generic CSV/JSON

### Step 2: Augment
Add AI-powered columns to enrich your data:
- **Translate** - Convert text to different languages
- **Extract Keywords** - Pull out important terms
- **Summarize** - Create short summaries of long text
- **Sentiment Analysis** - Detect positive/negative/neutral tone
- **Classify** - Categorize data into groups
- **Custom** - Write your own AI prompts

### Step 3: Process
FluffyViz runs AI models on each row of your data to fill in the new columns. You can:
- Choose from hundreds of AI models
- Select from multiple providers (OpenAI, Anthropic, Groq, etc.)
- Track progress as rows are processed
- Edit results directly in the spreadsheet

### Step 4: Visualize
Export your enriched data to visualization tools like Embedding Atlas or download as CSV for further analysis.

## Key Features

### Smart Format Detection
Upload any file and FluffyViz figures out what format it is. It gives you a confidence score and shows a preview before processing.

### Excel-Like Interface
Familiar spreadsheet experience with:
- Column headers (A, B, C...)
- Click-to-edit cells
- Drag-to-fill functionality
- Add/remove columns easily

### AI Provider Flexibility
Configure multiple AI providers and switch between them:
- Free options: Groq, Together AI
- Premium: OpenAI, Anthropic, Cohere
- Local models supported

### Browser-Based Storage
All your files stay on your computer in your browser. No server uploads, no privacy concerns.

**Recent Performance Improvements (October 2025):**
- Smart file size limits prevent browser crashes (50MB max)
- Automatic warnings for large files (>10MB)
- Protection against data loss from simultaneous edits
- Faster processing of deeply nested data with intelligent caching

### Multi-Tab Sync
Open FluffyViz in multiple browser tabs and they automatically stay in sync. The system prevents conflicts when editing the same file in multiple places.

## How It Works (Simple Version)

1. You upload a file with conversation data
2. FluffyViz reads it and turns nested data into flat spreadsheet columns
3. You add an AI column by selecting a template (like "Sentiment Analysis")
4. For each row, FluffyViz sends the text to an AI model
5. The AI analyzes it and FluffyViz fills in the new column
6. You can edit, add more columns, or export the results

## Example Use Cases

### Use Case 1: Analyzing Customer Support Conversations
**Problem**: You have 1,000 support chat logs and want to know which topics come up most often.

**Solution**:
1. Upload the chat logs (JSON format)
2. Add "Extract Keywords" column to identify topics
3. Add "Classify" column to categorize by department
4. Add "Sentiment Analysis" to find unhappy customers
5. Export to CSV and analyze trends in Excel

### Use Case 2: Evaluating AI Agent Quality
**Problem**: Your AI agent handled 500 conversations and you need to measure quality.

**Solution**:
1. Upload Langfuse trace data
2. Add "Summarize" column to create short summaries of each interaction
3. Add custom column with prompt: "Rate the agent's helpfulness from 1-10"
4. Add "Sentiment Analysis" on user messages to track satisfaction
5. Export to visualization tool to see quality over time

### Use Case 3: Multilingual Data Analysis
**Problem**: You have user feedback in multiple languages and need everything in English.

**Solution**:
1. Upload mixed-language CSV
2. Add "Translate to English" column
3. Add "Extract Keywords" on translated text
4. Add "Classify" to categorize feedback type
5. Export unified English dataset

## What Makes FluffyViz Different?

### Compared to Excel/Google Sheets
- **AI-Powered**: Built-in AI analysis columns (Excel requires complex formulas or scripts)
- **Format-Aware**: Understands AI agent data formats automatically
- **No Setup**: Works immediately in browser, no add-ons needed

### Compared to Data Science Tools (Python/Pandas)
- **No Coding**: Visual interface, no programming required
- **Instant**: See results immediately, no script writing
- **Accessible**: Anyone can use it, not just data scientists

### Compared to AI Platforms
- **Privacy**: Data stays in your browser
- **Flexible**: Use any AI provider or model
- **Universal**: Works with data from any platform

## Current Limitations

1. **Browser Memory**: Large files (>50MB) may slow down or crash
2. **AI Inference**: Currently uses mock data (real API integration coming soon)
3. **Export Options**: Only CSV export available (more formats coming)
4. **Advanced Features**: No pivot tables, charts, or complex formulas yet

## Future Enhancements (Planned)

- Real-time AI streaming for faster column generation
- Built-in data visualization (charts, graphs)
- Advanced filtering and sorting
- Column formulas (like Excel)
- Export to Google Sheets, Excel formats
- Collaboration features (share datasets)
- Automatic data validation and cleaning

## Getting Started

1. Visit FluffyViz in your browser
2. Drag and drop a data file (or use sample data)
3. Wait for format detection and preview
4. Click "Process" to load into spreadsheet
5. Click "+ Add Column" to create AI-powered analysis
6. Choose a template or write custom prompt
7. Select AI model and provider
8. Watch as FluffyViz fills in the column
9. Export when done

## Support & Resources

- Sample datasets available on homepage
- Style guide shows all UI components
- File manager sidebar shows all uploaded files
- Rename/delete files easily
- Configure AI providers in sidebar

## Privacy & Security

- **Local Processing**: All data stays in your browser
- **No Server Upload**: Files never leave your computer
- **API Keys**: Stored only in browser localStorage (never sent to servers)
- **Open Source**: Code available for security review

---

*FluffyViz: Transform AI data into actionable insights, right in your browser.*
