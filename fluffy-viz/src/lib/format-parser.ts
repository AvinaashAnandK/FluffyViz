/**
 * Format Parser - Intelligent data parsing and flattening for FluffyViz
 *
 * This module provides:
 * 1. Format-specific parsers for agent data formats (Langfuse, LangSmith, Arize, Message-Centric)
 * 2. Generic JSON/JSONL parser that can handle any nested structure
 * 3. CSV parser using PapaParse
 * 4. Intelligent flattening that converts nested objects to spreadsheet-friendly format
 *
 * Key features:
 * - Flattens nested objects using dot notation (e.g., user.profile.name)
 * - Handles arrays intelligently (join primitives, stringify objects)
 * - Configurable depth limiting to prevent column explosion
 * - Format-specific logic (e.g., expanding Langfuse observations into rows)
 * - Automatic fallback parsing for unknown formats
 *
 * Usage:
 *   const data = await parseFileContent(fileContent, 'langfuse')
 *   // Returns flattened array of objects ready for spreadsheet display
 */

import Papa from 'papaparse'
import { SupportedFormat } from '@/types'
import { parserConfig } from '@/config/parser.config'

export interface ParsedData {
  [key: string]: any
}

export interface FlattenOptions {
  maxDepth?: number
  arrayHandling?: 'stringify' | 'join' | 'expand'
  dateFormat?: 'iso' | 'timestamp' | 'string'
  prefix?: string
}

// Memoization cache for repeated flattening operations
const flattenCache = new Map<string, Record<string, any>>();
const CACHE_MAX_SIZE = 100;

/**
 * Flattens a nested object into a single-level object with dot notation keys
 * Supports multiple strategies for handling arrays and nested structures
 * Includes memoization for performance optimization
 */
function flattenObject(
  obj: any,
  options: FlattenOptions = {},
  currentDepth = 0
): Record<string, any> {
  const {
    maxDepth = parserConfig.maxFlattenDepth,
    arrayHandling = 'stringify',
    dateFormat = 'iso',
    prefix = ''
  } = options

  // Generate cache key for memoization (only for root level)
  if (currentDepth === 0 && typeof obj === 'object' && obj !== null) {
    const cacheKey = JSON.stringify({ obj: obj, options });
    if (flattenCache.has(cacheKey)) {
      return flattenCache.get(cacheKey)!;
    }
  }

  const flattened: Record<string, any> = {}

  // If we've reached max depth, stringify the remaining object
  if (currentDepth >= maxDepth) {
    if (parserConfig.showWarnings && currentDepth === maxDepth) {
      console.warn(`Maximum flattening depth (${maxDepth}) reached. Remaining data will be stringified.`);
    }
    return { [prefix || 'data']: JSON.stringify(obj) }
  }

  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return { [prefix || 'value']: '' }
  }

  // Handle primitives
  if (typeof obj !== 'object' || obj instanceof Date) {
    if (obj instanceof Date) {
      const dateValue = dateFormat === 'timestamp'
        ? obj.getTime()
        : dateFormat === 'iso'
        ? obj.toISOString()
        : obj.toString()
      return { [prefix || 'value']: dateValue }
    }
    return { [prefix || 'value']: obj }
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return { [prefix || 'array']: '[]' }
    }

    // Apply array length limit from config
    const effectiveArray = obj.length > parserConfig.maxArrayLength
      ? obj.slice(0, parserConfig.maxArrayLength)
      : obj;

    if (obj.length > parserConfig.maxArrayLength && parserConfig.showWarnings) {
      console.warn(
        `Array length (${obj.length}) exceeds maximum (${parserConfig.maxArrayLength}). ` +
        `Only first ${parserConfig.maxArrayLength} items will be processed.`
      );
    }

    // Check if array contains only primitives
    const allPrimitives = effectiveArray.every(item =>
      typeof item !== 'object' || item === null
    )

    if (allPrimitives) {
      // Join primitive arrays
      const joinedValue = effectiveArray.filter(v => v !== null && v !== undefined).join(', ');
      return { [prefix || 'array']: joinedValue.length > parserConfig.maxStringLength
        ? joinedValue.substring(0, parserConfig.maxStringLength) + '...'
        : joinedValue
      };
    }

    // For arrays of objects, handle based on strategy
    if (arrayHandling === 'expand' && effectiveArray.length <= 5) {
      // Expand first few items as separate columns
      const expanded: Record<string, any> = {}
      effectiveArray.slice(0, 5).forEach((item, index) => {
        const itemPrefix = prefix ? `${prefix}[${index}]` : `item_${index}`
        Object.assign(expanded, flattenObject(item, { ...options, prefix: itemPrefix }, currentDepth + 1))
      })
      if (obj.length > 5) {
        expanded[`${prefix}.length`] = obj.length
      }
      return expanded
    } else {
      // Stringify complex arrays
      const stringified = JSON.stringify(effectiveArray);
      return { [prefix || 'array']: stringified.length > parserConfig.maxStringLength
        ? stringified.substring(0, parserConfig.maxStringLength) + '...'
        : stringified
      };
    }
  }

  // Handle objects
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue

    const value = obj[key]
    const newKey = prefix ? `${prefix}.${key}` : key

    if (value === null || value === undefined) {
      flattened[newKey] = ''
    } else if (Array.isArray(value)) {
      const arrayResult = flattenObject(value, { ...options, prefix: newKey }, currentDepth + 1)
      Object.assign(flattened, arrayResult)
    } else if (typeof value === 'object' && !(value instanceof Date)) {
      // Recursively flatten nested objects
      const nestedResult = flattenObject(value, { ...options, prefix: newKey }, currentDepth + 1)
      Object.assign(flattened, nestedResult)
    } else if (value instanceof Date) {
      const dateValue = dateFormat === 'timestamp'
        ? value.getTime()
        : dateFormat === 'iso'
        ? value.toISOString()
        : value.toString()
      flattened[newKey] = dateValue
    } else {
      flattened[newKey] = value
    }
  }

  // Store in cache if this is a root-level call
  if (currentDepth === 0 && typeof obj === 'object' && obj !== null) {
    const cacheKey = JSON.stringify({ obj: obj, options });

    // Implement LRU cache: remove oldest entry if cache is full
    if (flattenCache.size >= CACHE_MAX_SIZE) {
      const firstKey = flattenCache.keys().next().value;
      if (firstKey !== undefined) {
        flattenCache.delete(firstKey);
      }
    }

    flattenCache.set(cacheKey, flattened);
  }

  return flattened
}

/**
 * Generic JSON parser with intelligent flattening
 * Handles any JSON structure including deeply nested objects and arrays
 */
function parseGenericJSON(content: string, options: FlattenOptions = {}): ParsedData[] {
  try {
    const parsed = JSON.parse(content)

    if (Array.isArray(parsed)) {
      // Array of items - flatten each item
      return parsed.map(item => flattenObject(item, options))
    } else if (typeof parsed === 'object' && parsed !== null) {
      // Single object - check if it contains an array property
      // that might be the actual data
      const possibleDataKeys = ['data', 'items', 'results', 'records', 'rows', 'documents']

      for (const key of possibleDataKeys) {
        if (Array.isArray(parsed[key])) {
          // Found a data array - use that
          return parsed[key].map((item: any) => flattenObject(item, options))
        }
      }

      // No data array found, treat as single record
      return [flattenObject(parsed, options)]
    } else {
      // Primitive value
      return [{ value: parsed }]
    }
  } catch (error) {
    console.error('Failed to parse JSON:', error)
    throw new Error(`Invalid JSON: ${error}`)
  }
}

/**
 * Generic JSONL parser with intelligent flattening
 * Handles newline-delimited JSON with any structure
 */
function parseGenericJSONL(content: string, options: FlattenOptions = {}): ParsedData[] {
  const lines = content.split('\n').filter(line => line.trim())
  const parsed: ParsedData[] = []
  const errors: string[] = []

  for (let i = 0; i < lines.length; i++) {
    try {
      const obj = JSON.parse(lines[i])
      const flattened = flattenObject(obj, options)
      parsed.push(flattened)
    } catch (error) {
      errors.push(`Line ${i + 1}: ${error}`)
      console.warn(`Failed to parse JSONL line ${i + 1}:`, lines[i], error)
    }
  }

  if (errors.length > 0 && errors.length === lines.length) {
    throw new Error(`All lines failed to parse: ${errors.slice(0, 3).join('; ')}`)
  }

  return parsed
}

/**
 * Parse CSV format using PapaParse
 */
function parseCSV(content: string): Promise<ParsedData[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn('CSV parsing warnings:', results.errors)
        }
        resolve(results.data as ParsedData[])
      },
      error: (error: Error) => {
        reject(error)
      }
    })
  })
}


/**
 * Parse Message-Centric format (JSONL with role/content structure)
 * Example: {"role": "user", "content": "...", "timestamp": "...", "metadata": {...}}
 */
function parseMessageCentric(content: string): ParsedData[] {
  // Message-centric is typically JSONL with role/content structure
  // Use generic JSONL parser with standard options
  return parseGenericJSONL(content, {
    maxDepth: 4, // Allow deeper nesting for metadata
    arrayHandling: 'stringify',
    dateFormat: 'iso'
  })
}

/**
 * Parse Langfuse format (nested trace/observation structure)
 * Example: {"id": "trace-1", "observations": [{...}], "timestamp": "..."}
 *
 * Langfuse-specific: Extracts observations from traces and creates separate rows
 * Each row contains trace metadata + flattened observation
 */
function parseLangfuse(content: string): ParsedData[] {
  const options: FlattenOptions = {
    maxDepth: 5,
    arrayHandling: 'stringify',
    dateFormat: 'iso'
  }

  try {
    // First try as single JSON object
    const data = JSON.parse(content)

    if (data.observations && Array.isArray(data.observations)) {
      // Single trace with multiple observations - expand observations into rows
      return data.observations.map((obs: any) => ({
        'trace.id': data.id,
        'trace.name': data.name,
        'trace.timestamp': data.timestamp,
        'trace.user_id': data.user_id,
        'trace.session_id': data.session_id,
        ...flattenObject(obs, { ...options, prefix: 'observation' })
      }))
    } else if (Array.isArray(data)) {
      // Array of traces - expand each trace's observations
      const allObservations: ParsedData[] = []
      for (const trace of data) {
        if (trace.observations && Array.isArray(trace.observations)) {
          trace.observations.forEach((obs: any) => {
            allObservations.push({
              'trace.id': trace.id,
              'trace.name': trace.name,
              'trace.timestamp': trace.timestamp,
              'trace.user_id': trace.user_id,
              'trace.session_id': trace.session_id,
              ...flattenObject(obs, { ...options, prefix: 'observation' })
            })
          })
        } else {
          // Trace without observations array - flatten the trace itself
          allObservations.push(flattenObject(trace, options))
        }
      }
      return allObservations
    } else {
      // Single object without observations array - flatten it
      return [flattenObject(data, options)]
    }
  } catch {
    // Try as JSONL - each line might be a trace or observation
    return parseGenericJSONL(content, options)
  }
}

/**
 * Parse LangSmith format (run structure with inputs/outputs)
 * Example: {"id": "run-1", "name": "...", "run_type": "chain", "inputs": {...}, "outputs": {...}}
 *
 * LangSmith-specific: Flattens run structure with special handling for inputs/outputs
 */
function parseLangSmith(content: string): ParsedData[] {
  // LangSmith is typically JSONL with run objects
  // Use deeper nesting since inputs/outputs can be complex
  return parseGenericJSONL(content, {
    maxDepth: 5,
    arrayHandling: 'stringify',
    dateFormat: 'timestamp' // LangSmith often uses timestamps
  })
}

/**
 * Parse Arize format (OpenInference traces)
 * Example: {"context.trace_id": "...", "context.span_id": "...", "attributes": {...}}
 *
 * Arize-specific: Handles OpenInference span structure with attributes
 */
function parseArize(content: string): ParsedData[] {
  const options: FlattenOptions = {
    maxDepth: 5,
    arrayHandling: 'stringify',
    dateFormat: 'timestamp'
  }

  try {
    // First try as single JSON object
    const data = JSON.parse(content)

    if (Array.isArray(data)) {
      // Array of spans - flatten each
      return data.map(span => flattenObject(span, options))
    } else {
      // Single span - flatten it
      return [flattenObject(data, options)]
    }
  } catch {
    // Try as JSONL - each line is a span
    return parseGenericJSONL(content, options)
  }
}

/**
 * Parse Turn-Level format (CSV with conversation turns)
 */
async function parseTurnLevel(content: string): Promise<ParsedData[]> {
  return parseCSV(content)
}

/**
 * Main parser function that routes to format-specific parsers
 * Falls back to generic parsers if format-specific parsing fails
 */
export async function parseFileContent(content: string, format: SupportedFormat): Promise<ParsedData[]> {
  try {
    switch (format) {
      case 'message-centric':
        return parseMessageCentric(content)

      case 'langfuse':
        return parseLangfuse(content)

      case 'langsmith':
        return parseLangSmith(content)

      case 'arize':
        return parseArize(content)

      case 'turn-level':
        return await parseTurnLevel(content)

      default:
        // Unknown format - try to auto-detect and parse
        console.warn(`Unknown format: ${format}, attempting auto-detection`)
        return await autoDetectAndParse(content)
    }
  } catch (error) {
    console.error(`Failed to parse file with format ${format}:`, error)
    // Try generic parsing as last resort
    console.log('Attempting generic parsing as fallback...')
    try {
      return await autoDetectAndParse(content)
    } catch (fallbackError) {
      throw new Error(`Failed to parse file: ${error}. Fallback parsing also failed: ${fallbackError}`)
    }
  }
}

/**
 * Auto-detect format and parse using generic parsers
 * Tries multiple parsing strategies in order of likelihood
 */
async function autoDetectAndParse(content: string): Promise<ParsedData[]> {
  // Strategy 1: Try JSON first (most common for API responses)
  try {
    const result = parseGenericJSON(content)
    if (result.length > 0) {
      console.log('Successfully parsed as JSON')
      return result
    }
  } catch (error) {
    console.log('Not valid JSON, trying JSONL...')
  }

  // Strategy 2: Try JSONL (common for logs and streaming data)
  try {
    const result = parseGenericJSONL(content)
    if (result.length > 0) {
      console.log('Successfully parsed as JSONL')
      return result
    }
  } catch (error) {
    console.log('Not valid JSONL, trying CSV...')
  }

  // Strategy 3: Try CSV (common for tabular data)
  try {
    const result = await parseCSV(content)
    if (result.length > 0) {
      console.log('Successfully parsed as CSV')
      return result
    }
  } catch (error) {
    console.log('Not valid CSV')
  }

  throw new Error('Unable to parse content - not valid JSON, JSONL, or CSV')
}
