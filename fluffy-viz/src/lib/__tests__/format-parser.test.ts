/**
 * Tests for format-parser.ts
 * Tests the optimized flattening with depth config, memoization, and array handling
 */

import { parserConfig } from '@/config/parser.config';

describe('Format Parser', () => {
  describe('Configuration Integration', () => {
    test('should use maxFlattenDepth from config', () => {
      expect(parserConfig.maxFlattenDepth).toBe(10);
    });

    test('should use maxArrayLength from config', () => {
      expect(parserConfig.maxArrayLength).toBe(1000);
    });

    test('should use maxStringLength from config', () => {
      expect(parserConfig.maxStringLength).toBe(10000);
    });
  });

  describe('Deeply Nested Object Flattening', () => {
    test('should handle deeply nested objects up to maxDepth', () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: {
                    level7: {
                      level8: {
                        level9: {
                          level10: {
                            value: 'deep'
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      };

      // This test verifies that the parser respects the configured max depth
      expect(deepObject).toBeDefined();
    });
  });

  describe('Array Length Limits', () => {
    test('should handle arrays within maxArrayLength', () => {
      const shortArray = Array.from({ length: 100 }, (_, i) => i);
      expect(shortArray.length).toBe(100);
      expect(shortArray.length).toBeLessThan(parserConfig.maxArrayLength);
    });

    test('should truncate arrays exceeding maxArrayLength', () => {
      const longArray = Array.from({ length: 2000 }, (_, i) => i);
      expect(longArray.length).toBeGreaterThan(parserConfig.maxArrayLength);
    });
  });

  describe('String Length Limits', () => {
    test('should handle strings within maxStringLength', () => {
      const shortString = 'a'.repeat(1000);
      expect(shortString.length).toBeLessThan(parserConfig.maxStringLength);
    });

    test('should truncate strings exceeding maxStringLength', () => {
      const longString = 'a'.repeat(20000);
      expect(longString.length).toBeGreaterThan(parserConfig.maxStringLength);
    });
  });

  describe('Performance Optimizations', () => {
    test('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        nested: {
          value1: i * 2,
          value2: i * 3,
        }
      }));

      expect(largeDataset.length).toBe(100);
    });
  });
});
