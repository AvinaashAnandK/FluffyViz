# Problem Statement
AI teams have raw agent output data but can't effectively analyze it because it lacks the structured attributes needed for meaningful pattern discovery and visualization. They need a workflow that transforms unstructured conversations into actionable insights through iterative augmentation and exploration.

# Target Users
ML Engineers & AI Product Managers who need to understand agent or GenAI features performance patterns

# Core Solution Architecture
## Workflow
```
Upload → Augment → Visualize
```

Four Main Steps:
1. Upload → Raw conversational/agent output data (CSV, JSON, etc.)
2. Augment and Process → Select from library of enrichment functions, use LLM as a judge augmentations + augment using custom prompts. Then batch apply augmentations to add analytical columns. 
3. Visualize → Export enriched dataset directly to Embedding Atlas

## Tech Stack
It is designed as an opensource tool that uses:
> - HuggingFace' AI Sheets: https://github.com/huggingface/aisheets
> - Apple's Embedding Atlas: https://github.com/apple/embedding-atlas
  