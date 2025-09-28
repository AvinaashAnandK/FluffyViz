import Papa from 'papaparse';
import {
  SupportedFormat,
  FormatDetectionResult,
  MessageCentricData,
  LangfuseSpanData,
  LangSmithRunData,
  TurnLevelData,
  ArizeTraceData,
} from '@/types';

export class FormatDetector {
  private static readonly SAMPLE_SIZE = 100;

  static async detectFormat(file: File): Promise<FormatDetectionResult> {
    const fileContent = await this.readFileSample(file);
    const detectionResults = await Promise.all([
      Promise.resolve(this.detectMessageCentric(fileContent)),
      Promise.resolve(this.detectLangfuse(fileContent)),
      Promise.resolve(this.detectLangSmith(fileContent)),
      Promise.resolve(this.detectArize(fileContent)),
      this.detectTurnLevel(fileContent),
    ]);

    // Find the format with highest confidence
    const bestMatch = detectionResults.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );

    return {
      detectedFormat: bestMatch.confidence > 0.5 ? bestMatch.format : null,
      confidence: bestMatch.confidence,
      suggestions: this.generateSuggestions(detectionResults),
      errors: this.validateFormat(fileContent, bestMatch.format),
    };
  }

  private static async readFileSample(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        // Take first N lines for analysis
        const lines = content.split('\n').slice(0, this.SAMPLE_SIZE);
        resolve(lines.join('\n'));
      };
      reader.onerror = reject;
      reader.readAsText(file.slice(0, 1024 * 1024)); // Read first 1MB
    });
  }

  private static detectMessageCentric(content: string): {
    format: SupportedFormat;
    confidence: number;
  } {
    let score = 0;
    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length === 0) return { format: 'message-centric', confidence: 0 };

    // Check if each line is valid JSON
    let validJsonLines = 0;
    let hasMessageFields = 0;

    for (const line of lines.slice(0, 10)) {
      try {
        const obj = JSON.parse(line);
        validJsonLines++;

        // Check for message-centric fields
        if (
          obj.role &&
          obj.content &&
          obj.timestamp &&
          ['user', 'assistant'].includes(obj.role)
        ) {
          hasMessageFields++;
        }
      } catch {
        // Not JSON
      }
    }

    if (validJsonLines > 0) {
      score += (validJsonLines / Math.min(lines.length, 10)) * 0.5;
      score += (hasMessageFields / validJsonLines) * 0.5;
    }

    return { format: 'message-centric', confidence: score };
  }

  private static detectLangfuse(content: string): {
    format: SupportedFormat;
    confidence: number;
  } {
    let score = 0;

    try {
      // First try to parse as single JSON object
      const singleObj = JSON.parse(content);
      if (this.isLangfuseObject(singleObj)) {
        return { format: 'langfuse', confidence: 1.0 };
      }
    } catch {
      // If not single JSON, try JSONL
      try {
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines.slice(0, 5)) {
          try {
            const obj = JSON.parse(line);
            if (this.isLangfuseObject(obj)) {
              score += 0.4;
            }
          } catch {
            // Not JSON
          }
        }
      } catch {
        // Not valid format
      }
    }

    return { format: 'langfuse', confidence: Math.min(score, 1) };
  }

  private static isLangfuseObject(obj: any): boolean {
    // Check for Langfuse trace structure
    if (obj.id && obj.observations && Array.isArray(obj.observations)) {
      // Check observation structure
      if (obj.observations.length > 0) {
        const obs = obj.observations[0];
        if (obs.trace_id && obs.type && ['SPAN', 'GENERATION', 'EVENT'].includes(obs.type)) {
          return true;
        }
      }

      // Check for typical Langfuse fields
      if (obj.timestamp && (obj.public !== undefined || obj.bookmarked !== undefined)) {
        return true;
      }
    }
    return false;
  }

  private static detectLangSmith(content: string): {
    format: SupportedFormat;
    confidence: number;
  } {
    let score = 0;

    try {
      const lines = content.split('\n').filter(line => line.trim());

      for (const line of lines.slice(0, 5)) {
        try {
          const obj = JSON.parse(line);

          // Check for LangSmith run structure
          if (obj.id && obj.name && obj.run_type && (obj.inputs || obj.outputs)) {
            score += 0.4;

            // Check for LangSmith specific fields
            if (obj.trace_id && obj.dotted_order) {
              score += 0.3;
            }

            if (obj.execution_order !== undefined && obj.status) {
              score += 0.3;
            }
          }
        } catch {
          // Not JSON
        }
      }
    } catch {
      // Not valid format
    }

    return { format: 'langsmith', confidence: Math.min(score, 1) };
  }

  private static detectArize(content: string): {
    format: SupportedFormat;
    confidence: number;
  } {
    let score = 0;

    try {
      // First try to parse as single JSON object
      const singleObj = JSON.parse(content);
      if (this.isArizeObject(singleObj)) {
        return { format: 'arize', confidence: 1.0 };
      }
    } catch {
      // If not single JSON, try JSONL
      try {
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines.slice(0, 5)) {
          try {
            const obj = JSON.parse(line);
            if (this.isArizeObject(obj)) {
              score += 0.5;
            }
          } catch {
            // Not JSON
          }
        }
      } catch {
        // Not valid format
      }
    }

    return { format: 'arize', confidence: Math.min(score, 1) };
  }

  private static isArizeObject(obj: any): boolean {
    // Check for OpenInference/Arize trace structure
    if (obj['context.trace_id'] && obj['context.span_id'] && obj.attributes) {
      // Check for OpenInference LLM attributes
      const attrs = obj.attributes;
      if (attrs['llm.model_name'] || attrs['input.value'] || attrs['output.value']) {
        return true;
      }

      // Check for OpenInference structure
      if (obj.kind && obj.status_code && obj.resource) {
        return true;
      }
    }
    return false;
  }

  private static async detectTurnLevel(content: string): Promise<{
    format: SupportedFormat;
    confidence: number;
  }> {
    return new Promise<{ format: SupportedFormat; confidence: number }>((resolve) => {
      Papa.parse(content, {
        header: true,
        preview: 10,
        complete: (results) => {
          let score = 0;

          if (results.data && results.data.length > 0) {
            const headers = results.meta.fields || [];
            const requiredFields = ['user_message', 'assistant_message'];
            const optionalFields = ['turn_id', 'session_id', 'timestamp', 'user_id'];

            // Check for required fields - exact match or close match
            const hasRequired = requiredFields.every(field =>
              headers.some(header =>
                header.toLowerCase() === field.toLowerCase() ||
                header.toLowerCase().includes(field.toLowerCase())
              )
            );

            if (hasRequired) {
              score += 0.6;

              // Bonus for optional fields
              const hasOptional = optionalFields.filter(field =>
                headers.some(header =>
                  header.toLowerCase() === field.toLowerCase() ||
                  header.toLowerCase().includes(field.toLowerCase())
                )
              ).length;

              score += (hasOptional / optionalFields.length) * 0.4;
            }
          }

          resolve({ format: 'turn-level', confidence: Math.min(score, 1) });
        },
        error: () => {
          resolve({ format: 'turn-level', confidence: 0 });
        }
      });
    });
  }

  private static generateSuggestions(
    results: Array<{ format: SupportedFormat; confidence: number }>
  ): string[] {
    const suggestions: string[] = [];

    const sorted = results.sort((a, b) => b.confidence - a.confidence);
    const best = sorted[0];

    if (best.confidence < 0.3) {
      suggestions.push(
        'File format not clearly detected. Please verify your data format.'
      );
    }

    if (best.confidence < 0.7 && best.confidence > 0.3) {
      suggestions.push(
        `Format appears to be ${best.format} but with low confidence. Please review field mappings.`
      );
    }

    // Check for common issues
    if (sorted.every(r => r.confidence < 0.2)) {
      suggestions.push(
        'Consider checking if your file contains the expected headers or JSON structure.'
      );
    }

    return suggestions;
  }

  public static validateFormat(content: string, format: SupportedFormat | null): string[] {
    const errors: string[] = [];

    if (!format) {
      errors.push('Unable to detect a supported format');
      return errors;
    }

    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      errors.push('File appears to be empty');
      return errors;
    }

    // Format-specific validation
    switch (format) {
      case 'message-centric':
      case 'langfuse':
      case 'langsmith':
      case 'arize':
        // First try to validate as single JSON object
        try {
          JSON.parse(content);
          // If it parses as single JSON, it's valid
          return errors;
        } catch {
          // If not single JSON, validate as JSONL
          let invalidJsonCount = 0;
          for (const line of lines.slice(0, 10)) {
            try {
              JSON.parse(line);
            } catch {
              invalidJsonCount++;
            }
          }

          if (invalidJsonCount > lines.slice(0, 10).length * 0.5) {
            errors.push('Many lines contain invalid JSON');
          }
        }
        break;

      case 'turn-level':
        // Basic CSV validation - check for commas and reasonable structure
        const firstLine = lines[0];
        if (!firstLine || !firstLine.includes(',')) {
          errors.push('CSV file should contain comma-separated values');
        }
        break;
    }

    return errors;
  }
}