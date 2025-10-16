/**
 * Batch embedding generation using Vercel AI SDK
 * Supports OpenAI, Cohere, and Voyage AI providers
 */

import { embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createCohere } from '@ai-sdk/cohere';
import type { GenerationProgress } from '@/types/embedding';

const BATCH_SIZE = 100; // Process 100 texts per batch

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
  const allEmbeddings: number[][] = [];
  const totalBatches = Math.ceil(texts.length / BATCH_SIZE);

  try {
    const embeddingModel = getEmbeddingModel(config.provider, config.model, config.apiKey);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, texts.length);
      const batch = texts.slice(startIdx, endIdx);

      // Report progress
      config.onProgress?.({
        phase: 'embedding',
        current: startIdx,
        total: texts.length,
        message: `Embedding batch ${batchIndex + 1}/${totalBatches}...`,
      });

      // Generate embeddings for batch
      const { embeddings } = await embedMany({
        model: embeddingModel,
        values: batch,
      });

      allEmbeddings.push(...embeddings);
    }

    // Report completion
    config.onProgress?.({
      phase: 'embedding',
      current: texts.length,
      total: texts.length,
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
export function getEmbeddingDimension(provider: string, model: string): number {
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
