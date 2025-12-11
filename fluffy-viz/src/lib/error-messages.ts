/**
 * User-facing error messages for web search and AI generation errors
 */

import type { WebSearchErrorType } from '@/types/web-search'
import type { FailureType } from '@/lib/duckdb'

export interface ErrorDisplayInfo {
  title: string
  description: string
  action: string
}

/**
 * Web search specific error messages
 */
export const WEB_SEARCH_ERROR_MESSAGES: Record<WebSearchErrorType, ErrorDisplayInfo> = {
  search_no_results: {
    title: 'No search results',
    description: 'Web search found no relevant information for this query.',
    action: 'The response was generated without web context. Consider rephrasing or retrying.',
  },
  search_rate_limit: {
    title: 'Search rate limited',
    description: 'Too many search requests in a short time.',
    action: 'Wait a minute and retry, or process fewer rows at once.',
  },
  search_timeout: {
    title: 'Search timed out',
    description: 'The web search took too long to complete.',
    action: 'Try a simpler query or retry. Complex queries may timeout.',
  },
  search_quota_exceeded: {
    title: 'Search quota exceeded',
    description: 'You have reached the search API limit for this period.',
    action: 'Wait until quota resets, or disable web search for this column.',
  },
  search_provider_error: {
    title: 'Search service error',
    description: 'The search provider encountered an error.',
    action: 'This is usually temporary. Retry in a few minutes.',
  },
}

/**
 * Standard AI generation error messages
 */
export const AI_ERROR_MESSAGES: Record<FailureType, ErrorDisplayInfo> = {
  rate_limit: {
    title: 'Rate limit exceeded',
    description: 'Too many requests to the AI provider.',
    action: 'Wait a minute before retrying, or reduce batch size.',
  },
  auth: {
    title: 'Authentication failed',
    description: 'Invalid or expired API key.',
    action: 'Check your API key in provider settings.',
  },
  network: {
    title: 'Network error',
    description: 'Could not connect to the AI provider.',
    action: 'Check your internet connection and try again.',
  },
  server_error: {
    title: 'Server error',
    description: 'The AI provider is experiencing issues.',
    action: 'This is usually temporary. Retry in a few minutes.',
  },
  invalid_request: {
    title: 'Invalid request',
    description: 'The request could not be processed.',
    action: 'Check your prompt and settings, then retry.',
  },
}

/**
 * Get error display info for a web search error type
 */
export function getWebSearchErrorInfo(type: WebSearchErrorType): ErrorDisplayInfo {
  return WEB_SEARCH_ERROR_MESSAGES[type]
}

/**
 * Get error display info for a standard AI error type
 */
export function getAIErrorInfo(type: FailureType): ErrorDisplayInfo {
  return AI_ERROR_MESSAGES[type]
}

/**
 * Get a user-friendly error message from error type
 */
export function formatErrorMessage(
  errorType: FailureType | WebSearchErrorType | undefined,
  fallbackMessage?: string
): string {
  if (!errorType) {
    return fallbackMessage || 'An unknown error occurred.'
  }

  // Check web search errors first
  if (errorType in WEB_SEARCH_ERROR_MESSAGES) {
    const info = WEB_SEARCH_ERROR_MESSAGES[errorType as WebSearchErrorType]
    return `${info.title}: ${info.description}`
  }

  // Check standard AI errors
  if (errorType in AI_ERROR_MESSAGES) {
    const info = AI_ERROR_MESSAGES[errorType as FailureType]
    return `${info.title}: ${info.description}`
  }

  return fallbackMessage || 'An unknown error occurred.'
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(errorType: FailureType | WebSearchErrorType | undefined): boolean {
  if (!errorType) return true

  // All standard AI errors except auth are generally retryable
  const nonRetryableStandard: FailureType[] = ['auth', 'invalid_request']
  if (nonRetryableStandard.includes(errorType as FailureType)) {
    return false
  }

  // Web search specific
  if (errorType === 'search_quota_exceeded') {
    return false
  }

  return true
}

/**
 * Get suggested wait time for rate limit errors (in ms)
 */
export function getSuggestedWaitTime(errorType: FailureType | WebSearchErrorType | undefined): number {
  switch (errorType) {
    case 'rate_limit':
    case 'search_rate_limit':
      return 60000 // 1 minute
    case 'search_timeout':
    case 'search_provider_error':
      return 5000 // 5 seconds
    case 'server_error':
      return 30000 // 30 seconds
    default:
      return 0
  }
}
