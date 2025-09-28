import Papa from 'papaparse';
import {
  NormalizedAgentData,
  SupportedFormat,
  MessageCentricData,
  LangfuseSpanData,
  LangSmithRunData,
  TurnLevelData,
  ArizeTraceData,
  FieldMapping,
  UploadResult,
  ValidationError,
  DataSchema,
} from '@/types';

export class DataProcessor {
  static async processFile(
    file: File,
    format: SupportedFormat,
    fieldMappings: FieldMapping[] = []
  ): Promise<UploadResult> {
    const content = await this.readFileContent(file);

    let normalizedData: NormalizedAgentData[] = [];
    let validationErrors: ValidationError[] = [];

    try {
      switch (format) {
        case 'message-centric':
          normalizedData = await this.processMessageCentric(content);
          break;
        case 'langfuse':
          normalizedData = await this.processLangfuse(content);
          break;
        case 'langsmith':
          normalizedData = await this.processLangSmith(content);
          break;
        case 'arize':
          normalizedData = await this.processArize(content);
          break;
        case 'turn-level':
          normalizedData = await this.processTurnLevel(content, fieldMappings);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      // Validate and clean data
      const { validData, errors } = this.validateData(normalizedData);
      validationErrors = errors;
      normalizedData = validData;

    } catch (error) {
      validationErrors.push({
        row_index: -1,
        field: 'general',
        error_type: 'invalid_format',
        message: `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    // Generate statistics
    const stats = {
      total_rows: normalizedData.length + validationErrors.length,
      valid_rows: normalizedData.length,
      invalid_rows: validationErrors.length,
      duplicate_ids: this.countDuplicateIds(normalizedData),
    };

    // Generate schema information
    const schema = this.generateSchema(normalizedData);

    return {
      data: normalizedData,
      validation_errors: validationErrors,
      stats,
      schema,
    };
  }

  private static async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  private static async processMessageCentric(content: string): Promise<NormalizedAgentData[]> {
    const lines = content.split('\n').filter(line => line.trim());
    const normalizedData: NormalizedAgentData[] = [];
    const conversationState: Record<string, {
      context: string[];
      turnCount: number;
    }> = {};

    for (let i = 0; i < lines.length; i++) {
      try {
        const data: MessageCentricData = JSON.parse(lines[i]);

        const conversationId = data.conversation_id || data.metadata?.session_id;
        if (!conversationId || !data.role || !data.content) {
          continue; // Skip invalid entries
        }

        // Initialize conversation state if not exists
        if (!conversationState[conversationId]) {
          conversationState[conversationId] = {
            context: [],
            turnCount: 0,
          };
        }

        const convState = conversationState[conversationId];

        if (data.role === 'user') {
          // Store user input for next assistant response
          convState.context.push(`User: ${data.content}`);
        } else if (data.role === 'assistant') {
          // Create normalized record for assistant response
          const userInput = this.extractLastUserInput(convState.context);

          const normalized: NormalizedAgentData = {
            id: `${conversationId}_turn_${convState.turnCount}`,
            timestamp: data.timestamp || new Date().toISOString(),
            session_id: conversationId,
            user_input: userInput,
            agent_response: data.content,
            agent_reasoning: data.reasoning,
            conversation_context: convState.context.join('\n'),
            metadata: data.metadata || {},
          };

          normalizedData.push(normalized);
          convState.context.push(`Assistant: ${data.content}`);
          convState.turnCount++;

          // Keep context manageable (last 10 turns)
          if (convState.context.length > 20) {
            convState.context = convState.context.slice(-20);
          }
        }
      } catch (error) {
        // Skip invalid JSON lines
        continue;
      }
    }

    return normalizedData;
  }

  private static async processLangfuse(content: string): Promise<NormalizedAgentData[]> {
    const lines = content.split('\n').filter(line => line.trim());
    const normalizedData: NormalizedAgentData[] = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        const data: LangfuseSpanData = JSON.parse(lines[i]);

        if (!data.id || !data.observations || !Array.isArray(data.observations)) {
          continue;
        }

        // Process each observation as a potential conversation turn
        for (let obsIndex = 0; obsIndex < data.observations.length; obsIndex++) {
          const obs = data.observations[obsIndex];

          if (obs.type === 'GENERATION' || obs.name.includes('llm')) {
            const userInput = this.extractUserInputFromLangfuseObs(obs);
            const agentResponse = this.extractAgentResponseFromLangfuseObs(obs);

            if (userInput && agentResponse) {
              const normalized: NormalizedAgentData = {
                id: `${data.id}_obs_${obs.id}`,
                timestamp: obs.start_time || data.timestamp,
                session_id: data.session_id || data.id,
                user_input: userInput,
                agent_response: agentResponse,
                agent_reasoning: obs.metadata?.reasoning,
                conversation_context: JSON.stringify(obs.input),
                metadata: {
                  ...obs.metadata,
                  ...data.metadata,
                  observation_name: obs.name,
                  observation_id: obs.id,
                  model: obs.model,
                  usage: obs.usage,
                  cost: obs.calculated_total_cost,
                },
              };

              normalizedData.push(normalized);
            }
          }
        }
      } catch (error) {
        continue;
      }
    }

    return normalizedData;
  }

  private static async processLangSmith(content: string): Promise<NormalizedAgentData[]> {
    const lines = content.split('\n').filter(line => line.trim());
    const normalizedData: NormalizedAgentData[] = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        const data: LangSmithRunData = JSON.parse(lines[i]);

        if (!data.id || !data.inputs || !data.outputs) {
          continue;
        }

        const userInput = this.extractUserInputFromLangSmith(data);
        const agentResponse = this.extractAgentResponseFromLangSmith(data);

        if (userInput && agentResponse) {
          const normalized: NormalizedAgentData = {
            id: data.id,
            timestamp: data.start_time || new Date().toISOString(),
            session_id: data.session_id || data.trace_id,
            user_input: userInput,
            agent_response: agentResponse,
            agent_reasoning: data.extra?.reasoning,
            conversation_context: JSON.stringify(data.inputs),
            metadata: {
              ...data.extra,
              name: data.name,
              run_type: data.run_type,
              parent_run_id: data.parent_run_id,
              execution_order: data.execution_order,
              status: data.status,
              total_tokens: data.total_tokens,
              total_cost: data.total_cost,
            },
          };

          normalizedData.push(normalized);
        }
      } catch (error) {
        continue;
      }
    }

    return normalizedData;
  }

  private static async processArize(content: string): Promise<NormalizedAgentData[]> {
    const lines = content.split('\n').filter(line => line.trim());
    const normalizedData: NormalizedAgentData[] = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        const data: ArizeTraceData = JSON.parse(lines[i]);

        if (!data['context.trace_id'] || !data.attributes) {
          continue;
        }

        const userInput = this.extractUserInputFromArize(data);
        const agentResponse = this.extractAgentResponseFromArize(data);

        if (userInput && agentResponse) {
          const normalized: NormalizedAgentData = {
            id: `${data['context.trace_id']}_${data['context.span_id']}`,
            timestamp: data.start_time || new Date().toISOString(),
            session_id: data.attributes['session.id'] || data['context.trace_id'],
            user_input: userInput,
            agent_response: agentResponse,
            agent_reasoning: data.attributes.metadata?.reasoning,
            conversation_context: data.attributes['input.value'] || '',
            metadata: {
              ...data.attributes.metadata,
              span_name: data.name,
              span_kind: data.kind,
              model: data.attributes['llm.model_name'],
              user_id: data.attributes['user.id'],
              service: data.resource?.attributes?.['service.name'],
              status: data.status_code,
              token_usage: {
                prompt: data.attributes['llm.token_count.prompt'],
                completion: data.attributes['llm.token_count.completion'],
                total: data.attributes['llm.token_count.total'],
              },
            },
          };

          normalizedData.push(normalized);
        }
      } catch (error) {
        continue;
      }
    }

    return normalizedData;
  }

  private static async processTurnLevel(
    content: string,
    fieldMappings: FieldMapping[]
  ): Promise<NormalizedAgentData[]> {
    return new Promise((resolve, reject) => {
      Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const normalizedData: NormalizedAgentData[] = [];

            for (let i = 0; i < results.data.length; i++) {
              const row = results.data[i] as any;

              const normalized: NormalizedAgentData = {
                id: this.extractFieldValue(row, 'id', fieldMappings) || `turn_${i}`,
                timestamp: this.extractFieldValue(row, 'timestamp', fieldMappings) || new Date().toISOString(),
                session_id: this.extractFieldValue(row, 'session_id', fieldMappings) || `session_${i}`,
                user_input: this.extractFieldValue(row, 'user_input', fieldMappings) || '',
                agent_response: this.extractFieldValue(row, 'agent_response', fieldMappings) || '',
                agent_reasoning: this.extractFieldValue(row, 'agent_reasoning', fieldMappings),
                conversation_context: this.extractFieldValue(row, 'conversation_context', fieldMappings),
                metadata: this.extractMetadata(row, fieldMappings),
              };

              if (normalized.user_input && normalized.agent_response) {
                normalizedData.push(normalized);
              }
            }

            resolve(normalizedData);
          } catch (error) {
            reject(error);
          }
        },
        error: reject,
      });
    });
  }

  private static extractLastUserInput(context: string[]): string {
    for (let i = context.length - 1; i >= 0; i--) {
      if (context[i].startsWith('User: ')) {
        return context[i].substring(6);
      }
    }
    return '';
  }

  private static extractUserInputFromLangfuseObs(obs: any): string {
    if (obs.input?.messages) {
      const userMessages = obs.input.messages.filter((m: any) => m.role === 'user');
      if (userMessages.length > 0) {
        return userMessages[userMessages.length - 1].content;
      }
    }

    if (obs.input?.input) {
      return obs.input.input;
    }

    if (typeof obs.input === 'string') {
      return obs.input;
    }

    return '';
  }

  private static extractAgentResponseFromLangfuseObs(obs: any): string {
    if (obs.output?.content) {
      return obs.output.content;
    }

    if (obs.output?.output) {
      return obs.output.output;
    }

    if (typeof obs.output === 'string') {
      return obs.output;
    }

    return '';
  }

  private static extractUserInputFromLangSmith(data: LangSmithRunData): string {
    if (data.inputs.input) {
      return data.inputs.input;
    }

    if (data.inputs.messages) {
      const userMessages = data.inputs.messages.filter((m: any) => m.role === 'user');
      if (userMessages.length > 0) {
        return userMessages[userMessages.length - 1].content;
      }
    }

    return '';
  }

  private static extractAgentResponseFromLangSmith(data: LangSmithRunData): string {
    if (data.outputs.text) {
      return data.outputs.text;
    }

    if (data.outputs.generations && Array.isArray(data.outputs.generations)) {
      const generation = data.outputs.generations[0];
      if (generation?.text) {
        return generation.text;
      }
    }

    if (data.outputs.output) {
      return data.outputs.output;
    }

    if (data.outputs.content) {
      return data.outputs.content;
    }

    return '';
  }

  private static extractUserInputFromArize(data: ArizeTraceData): string {
    if (data.attributes['input.value']) {
      return data.attributes['input.value'];
    }

    if (data.attributes['llm.input_messages'] && Array.isArray(data.attributes['llm.input_messages'])) {
      const userMessages = data.attributes['llm.input_messages'].filter(
        (m: any) => m['message.role'] === 'user'
      );
      if (userMessages.length > 0) {
        return userMessages[userMessages.length - 1]['message.content'];
      }
    }

    return '';
  }

  private static extractAgentResponseFromArize(data: ArizeTraceData): string {
    if (data.attributes['output.value']) {
      return data.attributes['output.value'];
    }

    if (data.attributes['llm.output_messages'] && Array.isArray(data.attributes['llm.output_messages'])) {
      const assistantMessages = data.attributes['llm.output_messages'].filter(
        (m: any) => m['message.role'] === 'assistant'
      );
      if (assistantMessages.length > 0) {
        return assistantMessages[assistantMessages.length - 1]['message.content'];
      }
    }

    return '';
  }

  private static extractFieldValue(
    row: any,
    targetField: keyof NormalizedAgentData,
    mappings: FieldMapping[]
  ): string | undefined {
    // Check if there's a specific mapping for this field
    const mapping = mappings.find(m => m.targetField === targetField);
    if (mapping) {
      return row[mapping.sourceField];
    }

    // Try common field name variations
    const commonMappings: Record<string, string[]> = {
      id: ['turn_id', 'id', 'turnId', 'turn'],
      timestamp: ['timestamp', 'time', 'created_at', 'date'],
      session_id: ['conversation_id', 'session_id', 'conversationId', 'conv_id'],
      user_input: ['user_message', 'user_input', 'input', 'user', 'question'],
      agent_response: ['assistant_message', 'assistant_text', 'assistant_response', 'response', 'output', 'answer'],
      agent_reasoning: ['reasoning', 'rationale', 'explanation', 'thinking'],
      conversation_context: ['conversation_context', 'context', 'history'],
    };

    const variations = commonMappings[targetField as string] || [];
    for (const variation of variations) {
      if (row[variation] !== undefined) {
        return row[variation];
      }
    }

    return undefined;
  }

  private static extractMetadata(row: any, mappings: FieldMapping[]): Record<string, any> {
    const metadata: Record<string, any> = {};

    // Add fields that are mapped to metadata
    const metadataMappings = mappings.filter(m => m.targetField === 'metadata');
    for (const mapping of metadataMappings) {
      if (row[mapping.sourceField] !== undefined) {
        metadata[mapping.sourceField] = row[mapping.sourceField];
      }
    }

    // Add any remaining fields not already mapped
    const mappedFields = new Set(mappings.map(m => m.sourceField));
    const coreFields = new Set(['id', 'turn_id', 'timestamp', 'conversation_id', 'session_id', 'user_message', 'user_input', 'assistant_text', 'agent_response', 'reasoning', 'agent_reasoning', 'conversation_context']);

    for (const [key, value] of Object.entries(row)) {
      if (!mappedFields.has(key) && !coreFields.has(key) && value !== undefined && value !== '') {
        metadata[key] = value;
      }
    }

    return metadata;
  }

  private static validateData(data: NormalizedAgentData[]): {
    validData: NormalizedAgentData[];
    errors: ValidationError[];
  } {
    const validData: NormalizedAgentData[] = [];
    const errors: ValidationError[] = [];

    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      const rowErrors: ValidationError[] = [];

      // Required field validation
      if (!record.id) {
        rowErrors.push({
          row_index: i,
          field: 'id',
          error_type: 'missing_required',
          message: 'ID is required',
          suggested_fix: 'Generate automatic ID',
        });
      }

      if (!record.user_input || record.user_input.trim() === '') {
        rowErrors.push({
          row_index: i,
          field: 'user_input',
          error_type: 'missing_required',
          message: 'User input is required',
        });
      }

      if (!record.agent_response || record.agent_response.trim() === '') {
        rowErrors.push({
          row_index: i,
          field: 'agent_response',
          error_type: 'missing_required',
          message: 'Agent response is required',
        });
      }

      // Timestamp validation
      if (record.timestamp && !this.isValidTimestamp(record.timestamp)) {
        rowErrors.push({
          row_index: i,
          field: 'timestamp',
          error_type: 'invalid_format',
          message: 'Invalid timestamp format',
          suggested_fix: 'Use ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)',
        });
      }

      if (rowErrors.length === 0) {
        // Fix missing ID if possible
        if (!record.id) {
          record.id = `generated_${i}_${Date.now()}`;
        }

        // Fix missing timestamp
        if (!record.timestamp) {
          record.timestamp = new Date().toISOString();
        }

        validData.push(record);
      } else {
        errors.push(...rowErrors);
      }
    }

    return { validData, errors };
  }

  private static isValidTimestamp(timestamp: string): boolean {
    const date = new Date(timestamp);
    return !isNaN(date.getTime());
  }

  private static countDuplicateIds(data: NormalizedAgentData[]): number {
    const ids = data.map(d => d.id);
    const uniqueIds = new Set(ids);
    return ids.length - uniqueIds.size;
  }

  private static generateSchema(data: NormalizedAgentData[]): DataSchema {
    if (data.length === 0) {
      return {
        detected_fields: [],
        field_types: {},
        required_fields: [],
        sample_values: {},
      };
    }

    const sample = data.slice(0, 10);
    const allFields = new Set<string>();
    const fieldTypes: Record<string, 'string' | 'number' | 'boolean' | 'date' | 'json'> = {};
    const sampleValues: Record<string, any[]> = {};

    // Analyze core fields
    const coreFields = ['id', 'timestamp', 'session_id', 'user_input', 'agent_response', 'agent_reasoning', 'conversation_context'];
    for (const field of coreFields) {
      allFields.add(field);
      fieldTypes[field] = field === 'timestamp' ? 'date' : 'string';
      sampleValues[field] = sample.map(d => (d as any)[field]).filter(v => v !== undefined).slice(0, 3);
    }

    // Analyze metadata fields
    for (const record of sample) {
      if (record.metadata && typeof record.metadata === 'object') {
        for (const [key, value] of Object.entries(record.metadata)) {
          allFields.add(`metadata.${key}`);

          // Map JavaScript types to our schema types
          const valueType = typeof value;
          if (valueType === 'string') {
            fieldTypes[`metadata.${key}`] = 'string';
          } else if (valueType === 'number') {
            fieldTypes[`metadata.${key}`] = 'number';
          } else if (valueType === 'boolean') {
            fieldTypes[`metadata.${key}`] = 'boolean';
          } else {
            fieldTypes[`metadata.${key}`] = 'json';
          }

          if (!sampleValues[`metadata.${key}`]) {
            sampleValues[`metadata.${key}`] = [];
          }
          sampleValues[`metadata.${key}`].push(value);
        }
      }
    }

    return {
      detected_fields: Array.from(allFields),
      field_types: fieldTypes,
      required_fields: ['id', 'user_input', 'agent_response'],
      sample_values: sampleValues,
    };
  }
}