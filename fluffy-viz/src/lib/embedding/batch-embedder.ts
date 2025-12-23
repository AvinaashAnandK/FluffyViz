/**
 * Batch embedding generation using Vercel AI SDK
 * Supports OpenAI, Cohere, and Voyage AI providers
 * Uses tiktoken for accurate token counting (OpenAI models)
 */

import { embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createCohere } from '@ai-sdk/cohere';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';
import { get_encoding, type Tiktoken } from 'tiktoken';
import type { GenerationProgress } from '@/types/embedding';

const BATCH_SIZE = 100; // Process 100 texts per batch

/**
 * Max token limits per embedding model
 */
const MODEL_MAX_TOKENS: Record<string, number> = {
  // OpenAI - 8191 tokens max
  'text-embedding-3-small': 8191,
  'text-embedding-3-large': 8191,
  'text-embedding-ada-002': 8191,
  // Cohere - 512 tokens max for embed-v3
  'embed-english-v3.0': 512,
  'embed-multilingual-v3.0': 512,
  'embed-english-light-v3.0': 512,
  'embed-multilingual-light-v3.0': 512,
  // Google - 2048 tokens
  'text-embedding-004': 2048,
  // Mistral - 8192 tokens
  'mistral-embed': 8192,
};

// Cached tiktoken encoder (lazy initialized)
let tiktokenEncoder: Tiktoken | null = null;

/**
 * Get or create tiktoken encoder
 * Uses cl100k_base which is used by text-embedding-3-* models
 */
function getEncoder(): Tiktoken {
  if (!tiktokenEncoder) {
    tiktokenEncoder = get_encoding('cl100k_base');
  }
  return tiktokenEncoder;
}

/**
 * Free the tiktoken encoder to release WASM memory
 * Call this after embedding generation is complete, before running UMAP
 * This helps prevent WASM memory conflicts between tiktoken and embedding-atlas
 */
export async function freeTiktokenEncoder(): Promise<void> {
  if (tiktokenEncoder) {
    console.log('[Batch Embedder] Freeing tiktoken encoder...');
    tiktokenEncoder.free();
    tiktokenEncoder = null;

    // Give the browser a chance to garbage collect the WASM memory
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('[Batch Embedder] Tiktoken encoder freed');
  }
}

/**
 * Count tokens using tiktoken (for OpenAI models)
 */
function countTokens(text: string): number {
  const encoder = getEncoder();
  return encoder.encode(text).length;
}

/**
 * Token count scaling factors relative to OpenAI's cl100k_base tokenizer.
 * A factor < 1.0 means that provider's tokenizer produces MORE tokens than OpenAI
 * for the same text, so we need to be more conservative.
 */
const TOKENIZER_SCALE_FACTOR: Record<string, number> = {
  openai: 1.0,     // Exact - we use tiktoken
  cohere: 0.9,     // Cohere's BPE is slightly less efficient
  google: 0.85,    // SentencePiece can be less efficient for some text
  mistral: 0.95,   // Very similar to OpenAI's tokenizer
};

/**
 * Truncate text to fit within token limit using tiktoken
 * Uses binary search for efficiency
 */
function truncateToTokenLimit(text: string, model: string, provider: string): string {
  const maxTokens = MODEL_MAX_TOKENS[model] || 8000;
  const providerKey = provider.toLowerCase();

  // Get scale factor (default to conservative 0.8 for unknown providers)
  const scaleFactor = TOKENIZER_SCALE_FACTOR[providerKey] ?? 0.8;

  // Adjust max tokens based on provider's tokenizer efficiency
  const adjustedMaxTokens = Math.floor(maxTokens * scaleFactor);

  const tokenCount = countTokens(text);

  if (tokenCount <= adjustedMaxTokens) {
    return text;
  }

  // Binary search to find the right truncation point
  let low = 0;
  let high = text.length;
  const suffix = ' [truncated...]';
  const targetTokens = adjustedMaxTokens - countTokens(suffix);

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    const truncated = text.substring(0, mid);
    const tokens = countTokens(truncated);

    if (tokens <= targetTokens) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return text.substring(0, low) + suffix;
}

export interface BatchEmbedderConfig {
  provider: string;
  model: string;
  apiKey: string;
  onProgress?: (progress: GenerationProgress) => void;
}

export interface EmbeddingResult {
  embeddings: number[][];
  dimension: number;
}

/**
 * Get embedding model based on provider and model name with API key
 */
function getEmbeddingModel(provider: string, model: string, apiKey: string) {
  switch (provider.toLowerCase()) {
    case 'openai': {
      const openai = createOpenAI({ apiKey });
      return openai.textEmbeddingModel(model);
    }

    case 'cohere': {
      const cohere = createCohere({ apiKey });
      return cohere.textEmbeddingModel(model);
    }

    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey });
      return google.textEmbeddingModel(model);
    }

    case 'mistral': {
      const mistral = createMistral({ apiKey });
      return mistral.textEmbeddingModel(model);
    }

    // Add more providers as needed
    // case 'voyageai':
    //   return voyageai.embedding(model);

    default:
      throw new Error(`Unsupported embedding provider: ${provider}`);
  }
}

/**
 * Generate embeddings in batches with progress reporting
 */
export async function batchEmbed(
  texts: string[],
  config: BatchEmbedderConfig
): Promise<EmbeddingResult> {
  // Validate, clean, and truncate input texts
  // OpenAI rejects empty strings with '$.input' is invalid error
  const emptyIndices: number[] = [];
  const truncatedIndices: number[] = [];

  const cleanedTexts = texts.map((text, i) => {
    if (!text || text.trim().length === 0) {
      emptyIndices.push(i);
      return '[empty]'; // Placeholder for empty texts
    }

    // Truncate to fit model's token limit
    const truncated = truncateToTokenLimit(text, config.model, config.provider);
    if (truncated.length < text.length) {
      truncatedIndices.push(i);
    }
    return truncated;
  });

  // Log summary of empty texts
  if (emptyIndices.length > 0) {
    console.warn(`[Batch Embedder] Found ${emptyIndices.length}/${texts.length} empty texts, replacing with placeholder`);
    if (emptyIndices.length <= 10) {
      console.warn(`[Batch Embedder] Empty indices:`, emptyIndices);
    } else {
      const firstFive = emptyIndices.slice(0, 5);
      const lastFive = emptyIndices.slice(-5);
      console.warn(`[Batch Embedder] Empty indices (first 5):`, firstFive);
      console.warn(`[Batch Embedder] Empty indices (last 5):`, lastFive);
    }
  }

  // Log summary of truncated texts
  if (truncatedIndices.length > 0) {
    const maxTokens = MODEL_MAX_TOKENS[config.model] || 8000;
    console.warn(`[Batch Embedder] Truncated ${truncatedIndices.length}/${texts.length} texts to fit ${config.model} limit (${maxTokens} tokens)`);
    if (truncatedIndices.length <= 10) {
      console.warn(`[Batch Embedder] Truncated indices:`, truncatedIndices);
    } else {
      console.warn(`[Batch Embedder] First truncated at index ${truncatedIndices[0]}, last at ${truncatedIndices[truncatedIndices.length - 1]}`);
    }
  }

  const allEmbeddings: number[][] = [];
  const totalBatches = Math.ceil(cleanedTexts.length / BATCH_SIZE);

  try {
    const embeddingModel = getEmbeddingModel(config.provider, config.model, config.apiKey);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, cleanedTexts.length);
      const batch = cleanedTexts.slice(startIdx, endIdx);

      // Report progress
      config.onProgress?.({
        phase: 'embedding',
        current: startIdx,
        total: cleanedTexts.length,
        message: `Embedding batch ${batchIndex + 1}/${totalBatches}...`,
      });

      // Generate embeddings for batch
      try {
        const { embeddings } = await embedMany({
          model: embeddingModel,
          values: batch,
        });

        allEmbeddings.push(...embeddings);
      } catch (batchError) {
        // Log detailed info about the failing batch
        const charLengths = batch.map(t => t.length);
        const maxLen = Math.max(...charLengths);
        const maxIdx = charLengths.indexOf(maxLen);
        console.error(`[Batch Embedder] Batch ${batchIndex + 1}/${totalBatches} failed!`);
        console.error(`[Batch Embedder] Batch size: ${batch.length}, char lengths: min=${Math.min(...charLengths)}, max=${maxLen}`);
        console.error(`[Batch Embedder] Longest text (idx ${startIdx + maxIdx}): ${batch[maxIdx]?.substring(0, 200)}...`);
        throw batchError;
      }
    }

    // Report completion
    config.onProgress?.({
      phase: 'embedding',
      current: cleanedTexts.length,
      total: cleanedTexts.length,
      message: 'Embedding complete',
    });

    return {
      embeddings: allEmbeddings,
      dimension: allEmbeddings[0]?.length || 0,
    };
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get available embedding models for a provider
 */
export function getEmbeddingModelsForProvider(provider: string): string[] {
  switch (provider.toLowerCase()) {
    case 'openai':
      return [
        'text-embedding-3-small',
        'text-embedding-3-large',
        'text-embedding-ada-002',
      ];

    case 'cohere':
      return [
        'embed-english-v3.0',
        'embed-multilingual-v3.0',
        'embed-english-light-v3.0',
        'embed-multilingual-light-v3.0',
      ];

    // Add more providers as needed
    // case 'voyageai':
    //   return [
    //     'voyage-3-lite',
    //     'voyage-3',
    //     'voyage-code-3',
    //   ];

    default:
      return [];
  }
}

/**
 * Get default embedding model for a provider
 */
export function getDefaultEmbeddingModel(provider: string): string {
  switch (provider.toLowerCase()) {
    case 'openai':
      return 'text-embedding-3-small';

    case 'cohere':
      return 'embed-english-v3.0';

    // case 'voyageai':
    //   return 'voyage-3-lite';

    default:
      return '';
  }
}

/**
 * Get embedding dimension for a model
 */
export function getEmbeddingDimension(_provider: string, model: string): number {
  // Common dimensions by model
  const dimensions: Record<string, number> = {
    'text-embedding-3-small': 1536,
    'text-embedding-3-large': 3072,
    'text-embedding-ada-002': 1536,
    'embed-english-v3.0': 1024,
    'embed-multilingual-v3.0': 1024,
    'embed-english-light-v3.0': 384,
    'embed-multilingual-light-v3.0': 384,
    'voyage-3-lite': 1536,
    'voyage-3': 1024,
    'voyage-code-3': 1536,
  };

  return dimensions[model] || 1536; // Default to 1536
}
