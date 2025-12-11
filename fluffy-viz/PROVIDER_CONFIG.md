# Provider Configuration Guide

FluffyViz uses a **file-based configuration system** for AI provider API keys and settings. This allows you to edit your configuration offline with any text editor while also providing a UI for easy management.

## Quick Start

### 1. Create Your Configuration File

Copy the example configuration to get started:

```bash
cd fluffy-viz
cp provider-config.example.json provider-config.json
```

### 2. Add Your API Keys

Edit `provider-config.json` with your preferred text editor:

```json
{
  "$schema": "./provider-config.schema.json",
  "version": "1.0.0",
  "providers": {
    "openai": {
      "apiKey": "sk-proj-YOUR_KEY_HERE",
      "enabled": true,
      "capabilities": {
        "text": true,
        "image": true,
        "embedding": true,
        "mmEmbedding": false
      }
    }
  },
  "defaults": {
    "augmentation": "openai",
    "embedding": "openai"
  }
}
```

### 3. Use the UI (Optional)

Alternatively, configure providers through the UI:

1. Click **"Configure LLM Providers"** in the sidebar
2. Select a provider from the list
3. Paste your API key
4. Enable desired capabilities
5. Click **"Save key"**

The UI writes changes back to `provider-config.json` automatically.

## Configuration Structure

### Provider Keys

Supported providers:

- `openai` - OpenAI (GPT-4, GPT-3.5)
- `anthropic` - Anthropic (Claude)
- `cohere` - Cohere (Command, Embed)
- `groq` - Groq (fast Llama inference)
- `huggingface` - HuggingFace Inference API
- `google` - Google AI (Gemini)
- `mistral` - Mistral AI

### Capabilities

Each provider supports different capabilities:

- **`text`** - Text generation for augmentation
- **`image`** - Image generation
- **`embedding`** - Text embeddings for similarity search
- **`mmEmbedding`** - Multimodal embeddings (text + images)

### Defaults

Set default providers for common use cases:

```json
{
  "defaults": {
    "augmentation": "openai",  // Used for column generation
    "embedding": "cohere"       // Used for similarity search
  }
}
```

## Configuration File Location

**Important:** The configuration file lives in the **project root**, not in `/src`:

```
fluffy-viz/
├── provider-config.json          # Your config (gitignored)
├── provider-config.example.json  # Template (version controlled)
├── provider-config.schema.json   # JSON schema for validation
└── src/
    └── ...
```

### Why Project Root?

- **Offline editing** - Edit without rebuilding the app
- **Hot reload** - Changes apply immediately in dev mode
- **Version control friendly** - Example file tracked, real config gitignored
- **IDE autocomplete** - JSON schema provides hints

## Security

### API Key Storage

- ✅ Keys stored in **gitignored** file (not committed)
- ✅ Plaintext in file (acceptable for local-first app)
- ✅ No backend - keys never leave your machine
- ⚠️ **Do not commit** `provider-config.json`

### Verification

Ensure the file is gitignored:

```bash
git check-ignore provider-config.json
# Should output: provider-config.json
```

## Advanced Usage

### Custom Base URLs

Override provider API endpoints:

```json
{
  "providers": {
    "openai": {
      "apiKey": "sk-...",
      "enabled": true,
      "capabilities": { ... },
      "baseUrl": "https://api.openai.com/v1"  // Custom endpoint
    }
  }
}
```

### Multiple Providers

Enable multiple providers for different tasks:

```json
{
  "providers": {
    "groq": {
      "apiKey": "gsk-...",
      "enabled": true,
      "capabilities": {
        "text": true,
        "image": false,
        "embedding": false,
        "mmEmbedding": false
      }
    },
    "cohere": {
      "apiKey": "co-...",
      "enabled": true,
      "capabilities": {
        "text": false,
        "image": false,
        "embedding": true,
        "mmEmbedding": false
      }
    }
  },
  "defaults": {
    "augmentation": "groq",
    "embedding": "cohere"
  }
}
```

## Validation

The configuration file is validated on load using JSON Schema.

### IDE Validation

Most IDEs will validate automatically using the `$schema` field:

```json
{
  "$schema": "./provider-config.schema.json"
}
```

This provides:
- ✅ Autocomplete for provider names
- ✅ Type checking for fields
- ✅ Inline error messages

### Manual Validation

Check for errors in the browser console:

```
Failed to load provider config: Provider openai requires apiKey string
```

Common errors:
- Missing required fields (`apiKey`, `enabled`, `capabilities`)
- Invalid provider names
- Malformed JSON syntax

## Troubleshooting

### Configuration Not Found

**Error:** "Provider configuration not found"

**Solution:**
```bash
cp provider-config.example.json provider-config.json
```

### Configuration Not Updating

**Issue:** UI changes not persisting

**Solution:**
1. Check browser console for errors
2. Verify `provider-config.json` exists and is writable
3. Restart dev server (`npm run dev`)

### Provider Not Enabled

**Issue:** Provider shows as "Not connected" despite having API key

**Solution:**
1. Ensure `enabled: true` in config
2. Verify API key is not empty string
3. Check capabilities are configured

### Git Tracking Warning

**Issue:** Git wants to commit `provider-config.json`

**Solution:**
```bash
# Remove from tracking if accidentally added
git rm --cached provider-config.json

# Verify it's gitignored
git check-ignore provider-config.json
```

## Known Issues

### OpenAI Search-Preview Models Not Supported

**Issue:** Models with built-in web search (`gpt-4o-search-preview`, `gpt-4o-mini-search-preview`, `gpt-5-search-api`) return invalid responses.

**Cause:** The Vercel AI SDK (`@ai-sdk/openai`) cannot parse the `annotations` field that OpenAI returns in ChatCompletions responses for search-preview models. This is a known SDK bug tracked at: https://github.com/vercel/ai/issues/5834

**Workaround:** These models have been removed from the model registry. Instead, use:
- **Responses API models** (GPT-4o, GPT-4.1, GPT-5) with the `web_search_preview` tool enabled
- **Perplexity models** (Sonar, Sonar Pro) which have built-in web search

**Status:** Waiting for AI SDK fix. The Responses API web search works correctly.

## API Reference

### Configuration Schema

```typescript
interface ProviderSettings {
  version: string                           // Schema version (e.g., "1.0.0")
  providers: Record<ProviderKey, ProviderConfig>
  defaults?: {
    augmentation?: ProviderKey              // Default for text generation
    embedding?: ProviderKey                 // Default for embeddings
  }
}

interface ProviderConfig {
  apiKey: string                            // API key (empty for local providers)
  enabled: boolean                          // Whether provider is active
  capabilities: {
    text: boolean                           // Text generation
    image: boolean                          // Image generation
    embedding: boolean                      // Text embeddings
    mmEmbedding: boolean                    // Multimodal embeddings
  }
  baseUrl?: string                          // Optional custom API endpoint
}
```

## Development Workflow

### Editing Offline

1. Open `provider-config.json` in your editor
2. Make changes
3. Save file
4. Refresh browser (or wait for hot reload)

### Editing via UI

1. Open app in browser
2. Click "Configure LLM Providers"
3. Make changes in UI
4. Changes auto-save to `provider-config.json`

### Both Work Together

- UI reads from file on load
- UI writes to file on save
- File changes reflect in UI on reload
- Choose whichever workflow you prefer

## Integration with AI Inference

The configuration is consumed by the AI inference system:

```typescript
import { useProviderConfig } from '@/hooks/use-provider-config'

function MyComponent() {
  const { config, getProviderApiKey, isProviderEnabled } = useProviderConfig()

  // Get API key for a provider
  const apiKey = getProviderApiKey('openai')

  // Check if provider is enabled
  const enabled = isProviderEnabled('anthropic')

  // Access full config
  const defaultProvider = config?.defaults?.augmentation
}
```

See [`src/lib/ai-inference.ts`](src/lib/ai-inference.ts) for usage in real API calls.

## Related Files

- [`provider-config.schema.json`](../provider-config.schema.json) - JSON schema definition
- [`provider-config.example.json`](../provider-config.example.json) - Template file
- [`src/config/provider-settings.ts`](src/config/provider-settings.ts) - Types and validation
- [`src/hooks/use-provider-config.ts`](src/hooks/use-provider-config.ts) - React hook
- [`src/app/api/provider-config/route.ts`](src/app/api/provider-config/route.ts) - API endpoints
- [`src/components/ai-provider-config-demo.tsx`](src/components/ai-provider-config-demo.tsx) - UI component

## Best Practices

1. **Start with example file** - Always copy from `provider-config.example.json`
2. **Enable only what you need** - Reduce API costs by disabling unused capabilities
3. **Use free tier providers** - Try HuggingFace, Groq, or Cohere for development
4. **Set sensible defaults** - Configure `defaults` for automatic provider selection
5. **Keep backups** - Copy config before making major changes
6. **Never commit secrets** - Verify `.gitignore` is working

## Support

For issues or questions:
- Check browser console for validation errors
- Review this guide for common solutions
- Open an issue with the error message and config structure (redact API keys!)
