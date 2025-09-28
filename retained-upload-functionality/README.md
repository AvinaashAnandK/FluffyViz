# Data Upload Functionality

## What This Does (In Simple Terms)

This folder contains the data upload system that helps people transform their conversation data from AI tools into a format that can be analyzed and visualized. Think of it as a "translator" that takes messy data files and turns them into clean, organized information.

### What Problem It Solves

When people use AI chatbots or agents, the conversation data gets stored in different formats depending on which platform they use:
- **ChatGPT/OpenAI**: Might export as message-by-message logs
- **LangFuse**: Stores data with detailed tracking information
- **LangSmith**: Has its own specific data structure
- **Arize**: Uses trace-based formatting
- **CSV files**: Simple spreadsheet format

Each platform stores the same basic information (what the user asked, what the AI responded) but in completely different ways, making it hard to analyze conversations across platforms.

### How It Works

This upload system is like a smart translator that:

1. **Detects the Format**: When you upload a file, it automatically figures out which platform it came from by looking at the structure and field names

2. **Validates the Data**: Checks if the file is properly formatted and identifies any problems

3. **Normalizes Everything**: Converts all the different formats into one standard format with these key pieces:
   - User's question/input
   - AI's response
   - When the conversation happened
   - Context about the conversation
   - Any additional metadata

4. **Provides Feedback**: Shows you a preview of your data and reports any issues it found

### What Files Are Included

**Core Components:**
- `Upload/index.tsx` - The main interface users see for uploading files
- `Upload/FormatDetector.ts` - The "detective" that figures out what format your file is in
- `data-processor.ts` - The "translator" that converts different formats to the standard format

**Type Definitions:**
- `types/agent-data.ts` - Defines what conversation data looks like
- `types/pipeline.ts` - Defines the upload process and configuration
- `types/index.ts` - Exports all the types for easy use

**Sample Data:**
- `sample-data/` - Example files in different formats that you can use to test the system

### Supported Data Formats

1. **Message-Centric JSONL**: Each line is a separate message with role (user/assistant), content, and timestamp
2. **LangFuse Traces**: Detailed tracking data from the LangFuse platform
3. **LangSmith Runs**: Execution data from LangSmith
4. **Arize Traces**: OpenInference format traces from Arize
5. **Turn-Level CSV**: Simple spreadsheet with user messages and AI responses

### Why This Is Useful

Before this system, if you wanted to analyze conversations from different AI platforms, you'd have to:
- Manually convert each format
- Write custom code for each platform
- Deal with missing or inconsistent data
- Spend hours cleaning and organizing data

With this upload functionality, you just:
1. Drop your file in
2. Let it detect and validate the format
3. Get clean, standardized data ready for analysis

This makes it easy for researchers, product managers, and developers to understand how their AI systems are performing across different platforms and conversations.

### Technical Benefits

- **Automatic format detection** with confidence scoring
- **Data validation** to catch errors early
- **Flexible field mapping** for custom data structures
- **Preview functionality** to see your data before processing
- **Error reporting** with suggested fixes
- **Standardized output** that works with downstream analysis tools

### Format Detection Method

The system uses **exact matching with predefined flexibility** rather than fuzzy matching:

**Exact Field Matching:**
- Checks for specific field names like `role`, `content`, `timestamp`
- Validates exact JSON structure patterns for each platform
- Requires specific data types and formats

**Predefined Variations:**
- For CSV files: Recognizes common field name variations (e.g., "user_message" matches "user_input", "input", "question")
- For JSON formats: Looks for platform-specific fields (LangFuse: `observations`, LangSmith: `run_type`, Arize: `context.trace_id`)
- Includes case-insensitive matching and substring matching for CSV headers

**Why Not Fuzzy Matching:**
This approach makes the system reliable and predictable - it knows exactly what to expect from each platform format. While it's less flexible than fuzzy matching, it ensures consistent results and prevents misidentification of data formats.

**Field Mapping Examples:**
```
user_input → ['user_message', 'user_input', 'input', 'user', 'question']
agent_response → ['assistant_message', 'assistant_text', 'response', 'output', 'answer']
session_id → ['conversation_id', 'session_id', 'conversationId', 'conv_id']
```

The system is designed to be both user-friendly for non-technical users and robust enough for large-scale data processing.