/**
 * Configuration for data parsing and processing
 */

export const parserConfig = {
  /**
   * Maximum depth for flattening nested objects
   * Prevents infinite recursion and performance issues with deeply nested data
   */
  maxFlattenDepth: 10,

  /**
   * Maximum array length to process
   * Arrays longer than this will be truncated to prevent performance issues
   */
  maxArrayLength: 1000,

  /**
   * Maximum string length for individual values
   * Strings longer than this will be truncated
   */
  maxStringLength: 10000,

  /**
   * Whether to show warnings when limits are exceeded
   */
  showWarnings: true,
} as const;

export type ParserConfig = typeof parserConfig;
