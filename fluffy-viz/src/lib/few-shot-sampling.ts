/**
 * Few-shot sampling strategies for selecting examples from edited cells
 *
 * Current implementation: Random sampling
 *
 * Future enhancement ideas:
 * - diversitySample(): Pick examples with different output values
 * - errorWeightedSample(): Prioritize edits where AI was most wrong
 * - recentBiasSample(): Weight recent edits higher
 * - clusterSample(): Representative sampling from edit clusters
 * - semanticSample(): Embedding-based diversity (requires embeddings)
 */

export interface FewShotExample {
  input: Record<string, unknown>; // Original row data
  output: string; // User's edited value
  originalOutput?: string; // Original LLM-generated value (before edit)
  rowIndex: number;
  editedAt: number;
}

export type SamplingStrategy = (
  examples: FewShotExample[],
  maxExamples: number
) => FewShotExample[];

/**
 * Random sampling - no bias, uniform selection
 * This is the initial implementation.
 */
export const randomSample: SamplingStrategy = (examples, maxExamples) => {
  if (examples.length <= maxExamples) {
    return examples;
  }

  // Fisher-Yates shuffle for uniform random sampling
  const shuffled = [...examples];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, maxExamples);
};

/**
 * Default export - can be easily swapped for different strategies
 */
export const selectFewShotExamples = randomSample;

/**
 * Build few-shot prompt prefix from examples
 * @param examples Few-shot examples to include
 * @param columnName Name of the column being generated
 * @returns Prompt prefix with examples
 */
export function buildFewShotPrompt(
  examples: FewShotExample[],
  columnName: string
): string {
  if (examples.length === 0) {
    return '';
  }

  let prompt = 'Here are some examples of how to complete this task:\n\n';

  examples.forEach((example, index) => {
    prompt += `Example ${index + 1}:\n`;

    // Show relevant input fields
    const relevantFields = Object.entries(example.input)
      .filter(([key]) => !key.includes('__meta') && !key.includes('row_index'))
      .slice(0, 5); // Limit to 5 most relevant fields

    relevantFields.forEach(([key, value]) => {
      prompt += `${key}: ${String(value).slice(0, 200)}\n`;
    });

    prompt += `${columnName}: ${example.output}\n\n`;
  });

  prompt += 'Now complete the task for the following:\n';

  return prompt;
}
