// Core normalized data structure for agent conversations
export interface NormalizedAgentData {
  id: string;
  timestamp: string;
  session_id: string;
  user_input: string;
  agent_reasoning?: string;
  agent_response: string;
  conversation_context?: string;
  metadata: Record<string, any>;
}

// Augmented data after AI processing
export interface AugmentedAgentData extends NormalizedAgentData {
  sentiment?: string;
  response_quality_score?: number;
  user_intent?: string;
  conversation_summary?: string;
  error_detected?: boolean;
  error_description?: string;
  helpfulness_score?: number;
  judge_rationale?: string;
  running_summary?: string;
}

// Data with embeddings generated
export interface EmbeddedAgentData extends AugmentedAgentData {
  embeddings: Record<string, number[]>;
}

// Raw input data formats
export interface MessageCentricData {
  timestamp: string;
  conversation_id?: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  metadata?: Record<string, any>;
}

export interface LangfuseSpanData {
  id: string;
  timestamp: string;
  name: string;
  user_id?: string;
  session_id?: string;
  public: boolean;
  bookmarked: boolean;
  tags: string[];
  metadata: Record<string, any>;
  observations: Array<{
    id: string;
    trace_id: string;
    parent_observation_id?: string;
    type: 'SPAN' | 'GENERATION' | 'EVENT';
    name: string;
    start_time: string;
    end_time: string;
    input?: any;
    output?: any;
    model?: string;
    model_parameters?: Record<string, any>;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    calculated_total_cost?: number;
    level: 'DEFAULT' | 'WARNING' | 'ERROR';
    metadata?: Record<string, any>;
  }>;
}

export interface LangSmithRunData {
  id: string;
  name: string;
  run_type: 'llm' | 'chain' | 'tool';
  start_time: string;
  end_time: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  extra: {
    invocation_params?: Record<string, any>;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    reasoning?: string;
  };
  error?: string | null;
  execution_order: number;
  serialized: Record<string, any>;
  parent_run_id?: string | null;
  manifest_id?: string;
  events: any[];
  tags: string[];
  trace_id: string;
  dotted_order: string;
  status: string;
  child_run_ids: string[];
  direct_child_run_ids: string[];
  parent_run_ids: string[];
  feedback_stats: Record<string, any>;
  reference_example_id?: string | null;
  total_tokens?: number;
  total_cost?: string;
  session_id?: string;
}

export interface TurnLevelData {
  turn_id: string;
  conversation_id: string;
  timestamp: string;
  user_message: string;
  assistant_text: string;
  reasoning?: string;
  metadata_json?: string;
}

export interface ArizeTraceData {
  'context.trace_id': string;
  'context.span_id': string;
  name: string;
  kind: string;
  status_code: string;
  start_time: string;
  end_time: string;
  attributes: {
    'llm.model_name'?: string;
    'llm.invocation_parameters'?: string;
    'input.value'?: string;
    'output.value'?: string;
    'llm.input_messages'?: Array<{
      'message.role': string;
      'message.content': string;
    }>;
    'llm.output_messages'?: Array<{
      'message.role': string;
      'message.content': string;
    }>;
    'llm.token_count.prompt'?: number;
    'llm.token_count.completion'?: number;
    'llm.token_count.total'?: number;
    'session.id'?: string;
    'user.id'?: string;
    metadata?: Record<string, any>;
  };
  events: any[];
  links: any[];
  resource: {
    attributes: {
      'service.name': string;
      'service.version': string;
    };
  };
}

// Data format types
export type SupportedFormat = 'message-centric' | 'langfuse' | 'langsmith' | 'turn-level' | 'arize';

export interface FormatDetectionResult {
  detectedFormat: SupportedFormat | null;
  confidence: number;
  suggestions: string[];
  errors: string[];
}

// Schema mapping for custom fields
export interface FieldMapping {
  sourceField: string;
  targetField: keyof NormalizedAgentData | 'metadata';
  transformation?: string;
}

// Upload result types
export interface ValidationError {
  row_index: number;
  field: string;
  error_type: string;
  message: string;
  suggested_fix?: string;
}

export interface DataSchema {
  detected_fields: string[];
  field_types: Record<string, 'string' | 'number' | 'boolean' | 'date' | 'json'>;
  required_fields: string[];
  sample_values: Record<string, any[]>;
}

export interface UploadResult {
  data: NormalizedAgentData[];
  validation_errors: ValidationError[];
  stats: {
    total_rows: number;
    valid_rows: number;
    invalid_rows: number;
    duplicate_ids: number;
  };
  schema: DataSchema;
}