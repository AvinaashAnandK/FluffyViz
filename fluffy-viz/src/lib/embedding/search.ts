/**
 * FluffySearcher - Custom search implementation for EmbeddingAtlas
 *
 * Implements the Searcher interface with:
 * - fullTextSearch: Keyword search using DuckDB ILIKE
 * - vectorSearch: Conceptual search using cosine similarity
 * - nearestNeighbors: Find similar points by ID
 */

import { executeQuery } from '@/lib/duckdb/client';
import { getLayerTableName } from './storage';

/**
 * Search result from EmbeddingAtlas Searcher interface
 */
interface SearchResult {
  id: string;
  distance?: number;
}

/**
 * Search options from EmbeddingAtlas Searcher interface
 */
interface SearchOptions {
  limit: number;
  predicate: string | null;
  onStatus: (status: string) => void;
}

/**
 * Searcher interface expected by EmbeddingAtlas
 */
export interface Searcher {
  fullTextSearch?(
    query: string,
    options?: Partial<SearchOptions>
  ): Promise<SearchResult[]>;

  vectorSearch?(
    query: string,
    options?: Partial<SearchOptions>
  ): Promise<SearchResult[]>;

  nearestNeighbors?(
    id: string,
    options?: Partial<SearchOptions>
  ): Promise<SearchResult[]>;
}

/**
 * Configuration for FluffySearcher
 */
export interface FluffySearcherConfig {
  layerId: string;
  fileId: string;
  searchableColumns?: string[];
  embeddingProvider?: string;
  embeddingModel?: string;
  apiKey?: string;
}

/**
 * Create a FluffySearcher instance for a given embedding layer
 */
export function createFluffySearcher(config: FluffySearcherConfig): Searcher {
  const {
    layerId,
    searchableColumns = ['composed_text'],
  } = config;

  const tableName = getLayerTableName(layerId);

  /**
   * Full-text search using DuckDB ILIKE
   * Searches across all searchable columns
   */
  const fullTextSearch = async (
    query: string,
    options?: Partial<SearchOptions>
  ): Promise<SearchResult[]> => {
    const limit = options?.limit ?? 100;
    const predicate = options?.predicate;

    options?.onStatus?.('Searching...');

    try {
      // Escape query for LIKE pattern
      const escapedQuery = query.replace(/[%_\\]/g, '\\$&');
      const likePattern = `%${escapedQuery}%`;

      // Build OR conditions for each searchable column
      const searchConditions = searchableColumns
        .map(col => `CAST("${col}" AS VARCHAR) ILIKE '${likePattern}'`)
        .join(' OR ');

      // Build full query with optional predicate
      const whereClause = predicate
        ? `WHERE (${searchConditions}) AND (${predicate})`
        : `WHERE ${searchConditions}`;

      const sql = `
        SELECT point_id
        FROM "${tableName}"
        ${whereClause}
        LIMIT ${limit}
      `;

      const results = await executeQuery<{ point_id: string }>(sql);

      console.log(`[FluffySearcher] Full-text search found ${results.length} results for "${query}"`);

      return results.map(r => ({ id: r.point_id }));
    } catch (error) {
      console.error('[FluffySearcher] Full-text search error:', error);
      return [];
    }
  };

  /**
   * Vector search using cosine similarity
   * Embeds the query and finds semantically similar points
   */
  const vectorSearch = async (
    query: string,
    options?: Partial<SearchOptions>
  ): Promise<SearchResult[]> => {
    const limit = options?.limit ?? 100;
    const predicate = options?.predicate;

    // Check if we have embedding configuration
    if (!config.embeddingProvider || !config.embeddingModel || !config.apiKey) {
      console.warn('[FluffySearcher] Vector search unavailable: missing embedding config');
      // Fall back to full-text search
      return fullTextSearch(query, options);
    }

    try {
      // Step 1: Embed the query
      options?.onStatus?.('Embedding query...');
      const queryEmbedding = await embedQuery(
        query,
        config.embeddingProvider,
        config.embeddingModel,
        config.apiKey
      );

      if (!queryEmbedding || queryEmbedding.length === 0) {
        console.warn('[FluffySearcher] Failed to embed query, falling back to text search');
        return fullTextSearch(query, options);
      }

      // Step 2: Compute cosine similarity
      options?.onStatus?.('Computing similarity...');

      // Format query embedding as DuckDB array literal
      const embeddingLiteral = `[${queryEmbedding.join(',')}]::DOUBLE[]`;

      // Build predicate clause
      const predicateClause = predicate ? `AND (${predicate})` : '';

      // Query using cosine similarity
      // Note: We join with embedding_points to get the raw vectors
      const sql = `
        WITH scored AS (
          SELECT
            el.point_id,
            array_cosine_similarity(ep.embedding, ${embeddingLiteral}) AS similarity
          FROM "${tableName}" el
          JOIN embedding_points ep
            ON ep.point_id = el.point_id AND ep.layer_id = '${layerId}'
          WHERE ep.embedding IS NOT NULL ${predicateClause}
        )
        SELECT point_id, 1 - similarity AS distance
        FROM scored
        WHERE similarity > 0.5
        ORDER BY similarity DESC
        LIMIT ${limit}
      `;

      const results = await executeQuery<{ point_id: string; distance: number }>(sql);

      console.log(`[FluffySearcher] Vector search found ${results.length} results for "${query}"`);

      return results.map(r => ({
        id: r.point_id,
        distance: r.distance,
      }));
    } catch (error) {
      console.error('[FluffySearcher] Vector search error:', error);
      // Fall back to full-text search
      return fullTextSearch(query, options);
    }
  };

  /**
   * Find nearest neighbors to a given point
   */
  const nearestNeighbors = async (
    pointId: string,
    options?: Partial<SearchOptions>
  ): Promise<SearchResult[]> => {
    const limit = options?.limit ?? 20;
    const predicate = options?.predicate;

    options?.onStatus?.('Finding similar points...');

    try {
      // Build predicate clause
      const predicateClause = predicate ? `AND (${predicate})` : '';

      // Query using cosine similarity against the target point's embedding
      const sql = `
        WITH target AS (
          SELECT embedding
          FROM embedding_points
          WHERE layer_id = '${layerId}' AND point_id = '${pointId}'
          LIMIT 1
        ),
        scored AS (
          SELECT
            el.point_id,
            array_cosine_similarity(ep.embedding, (SELECT embedding FROM target)) AS similarity
          FROM "${tableName}" el
          JOIN embedding_points ep
            ON ep.point_id = el.point_id AND ep.layer_id = '${layerId}'
          WHERE ep.embedding IS NOT NULL
            AND el.point_id != '${pointId}'
            ${predicateClause}
        )
        SELECT point_id, 1 - similarity AS distance
        FROM scored
        WHERE similarity > 0
        ORDER BY similarity DESC
        LIMIT ${limit}
      `;

      const results = await executeQuery<{ point_id: string; distance: number }>(sql);

      console.log(`[FluffySearcher] Found ${results.length} neighbors for point ${pointId}`);

      return results.map(r => ({
        id: r.point_id,
        distance: r.distance,
      }));
    } catch (error) {
      console.error('[FluffySearcher] Nearest neighbors error:', error);
      return [];
    }
  };

  return {
    fullTextSearch,
    vectorSearch,
    nearestNeighbors,
  };
}

/**
 * Embed a query string using the specified provider and model
 */
async function embedQuery(
  text: string,
  provider: string,
  model: string,
  apiKey: string
): Promise<number[] | null> {
  try {
    // Use the AI SDK's embed function
    const { embed } = await import('ai');

    // Get the appropriate provider
    let aiModel;
    switch (provider) {
      case 'openai': {
        const { createOpenAI } = await import('@ai-sdk/openai');
        const openai = createOpenAI({ apiKey });
        aiModel = openai.embedding(model);
        break;
      }
      case 'cohere': {
        const { createCohere } = await import('@ai-sdk/cohere');
        const cohere = createCohere({ apiKey });
        aiModel = cohere.textEmbeddingModel(model);
        break;
      }
      case 'google': {
        const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
        const google = createGoogleGenerativeAI({ apiKey });
        aiModel = google.textEmbeddingModel(model);
        break;
      }
      case 'mistral': {
        const { createMistral } = await import('@ai-sdk/mistral');
        const mistral = createMistral({ apiKey });
        aiModel = mistral.textEmbeddingModel(model);
        break;
      }
      default:
        console.warn(`[FluffySearcher] Unsupported provider: ${provider}`);
        return null;
    }

    const { embedding } = await embed({
      model: aiModel,
      value: text,
    });

    return embedding;
  } catch (error) {
    console.error('[FluffySearcher] Error embedding query:', error);
    return null;
  }
}

/**
 * Get searchable columns from a layer table
 * Returns text-like columns suitable for ILIKE search
 */
export async function getSearchableColumns(layerId: string): Promise<string[]> {
  const tableName = getLayerTableName(layerId);

  try {
    const result = await executeQuery<{ column_name: string; data_type: string }>(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = '${tableName}'
        AND data_type IN ('VARCHAR', 'TEXT', 'JSON')
      ORDER BY ordinal_position
    `);

    // Filter out internal columns
    const searchable = result
      .filter(r => !r.column_name.startsWith('_ev_'))
      .map(r => r.column_name);

    return searchable;
  } catch (error) {
    console.error('[FluffySearcher] Error getting searchable columns:', error);
    return ['composed_text'];
  }
}
