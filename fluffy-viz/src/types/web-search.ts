/**
 * Web Search Types for AI Column Generation
 *
 * Supports:
 * - OpenAI (Responses API + search-preview models)
 * - Google Gemini (search grounding)
 * - Perplexity (native search)
 */

/**
 * Search context size affects how much web content is retrieved
 * - low: Faster, cheaper, fewer search results
 * - medium: Balanced (default)
 * - high: Comprehensive, more search results
 */
export type SearchContextSize = 'low' | 'medium' | 'high'

/**
 * Approximate user location for localized search results
 */
export interface UserLocation {
  type: 'approximate'
  city?: string
  region?: string
  country?: string
}

/**
 * Web search configuration passed to inference
 */
export interface WebSearchConfig {
  enabled: boolean
  contextSize: SearchContextSize
  userLocation?: UserLocation
}

/**
 * Source information returned from web search
 */
export interface SearchSource {
  url: string
  title?: string
  snippet?: string
}

/**
 * Web search result containing sources
 */
export interface WebSearchResult {
  sources: SearchSource[]
}

/**
 * Web search specific error types
 */
export type WebSearchErrorType =
  | 'search_no_results'      // Search returned empty results
  | 'search_rate_limit'      // Search API rate limited
  | 'search_timeout'         // Search took too long
  | 'search_quota_exceeded'  // Monthly/daily quota hit
  | 'search_provider_error'  // Provider-specific failure

/**
 * Structured web search error for handling
 */
export interface WebSearchError {
  type: WebSearchErrorType
  message: string
  retryable: boolean
  retryAfterMs?: number  // For rate limits
}

/**
 * Default web search configuration
 */
export const DEFAULT_WEB_SEARCH_CONFIG: WebSearchConfig = {
  enabled: false,
  contextSize: 'medium',
}

/**
 * Create a new web search config with defaults
 */
export function createWebSearchConfig(
  overrides?: Partial<WebSearchConfig>
): WebSearchConfig {
  return {
    ...DEFAULT_WEB_SEARCH_CONFIG,
    ...overrides,
  }
}

/**
 * Check if web search config is effectively enabled
 */
export function isWebSearchEnabled(config?: WebSearchConfig): boolean {
  return config?.enabled === true
}

/**
 * Validate user location has at least one field set
 */
export function isValidUserLocation(location?: UserLocation): boolean {
  if (!location) return true // Optional field
  return !!(location.city || location.region || location.country)
}
