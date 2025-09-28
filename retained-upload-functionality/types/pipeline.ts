import {
  NormalizedAgentData,
  AugmentedAgentData,
  EmbeddedAgentData,
  SupportedFormat,
  FieldMapping
} from './agent-data';
import { AugmentationJob } from './augmentation';
import { EmbeddingStrategy, EmbeddingProfileKey } from './embedding';

// Pipeline stage definitions
export type PipelineStage = 'upload' | 'augment' | 'embed' | 'visualize';

// Upload stage configuration
export interface UploadConfig {
  file: File;
  detected_format: SupportedFormat;
  field_mappings: FieldMapping[];
  validation_enabled: boolean;
  preview_rows: number;
}

// Upload stage result
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

// Data schema information
export interface DataSchema {
  detected_fields: string[];
  field_types: Record<string, 'string' | 'number' | 'boolean' | 'date' | 'json'>;
  required_fields: string[];
  sample_values: Record<string, any[]>;
}

// Validation error
export interface ValidationError {
  row_index: number;
  field: string;
  error_type: 'missing_required' | 'invalid_type' | 'invalid_format' | 'duplicate_id';
  message: string;
  suggested_fix?: string;
}

// Augment stage configuration
export interface AugmentConfig {
  selected_functions: string[];
  llm_provider: string;
  batch_config: {
    batch_size: number;
    concurrent_requests: number;
    rate_limit_delay: number;
  };
  quality_control: {
    validation_enabled: boolean;
    confidence_threshold: number;
    retry_failed: boolean;
  };
}

// Embed stage configuration
export interface EmbedConfig {
  selected_profiles: EmbeddingProfileKey[];
  embedding_strategy: EmbeddingStrategy;
  model_configs: Record<string, any>;
  output_format: 'parquet' | 'json' | 'csv';
}

// Visualize stage configuration
export interface VisualizeConfig {
  atlas_config: {
    active_profile: EmbeddingProfileKey;
    available_profiles: EmbeddingProfileKey[];
    profile_switching: boolean;
  };
  metadata_filters: string[];
  custom_overlays: string[];
}

// Pipeline state
export interface PipelineState {
  current_stage: PipelineStage;
  stages: {
    upload: {
      status: StageStatus;
      config?: UploadConfig;
      result?: UploadResult;
      errors: string[];
    };
    augment: {
      status: StageStatus;
      config?: AugmentConfig;
      job?: AugmentationJob;
      result?: AugmentedAgentData[];
      errors: string[];
    };
    embed: {
      status: StageStatus;
      config?: EmbedConfig;
      result?: EmbeddedAgentData[];
      errors: string[];
    };
    visualize: {
      status: StageStatus;
      config?: VisualizeConfig;
      atlas_data?: any;
      errors: string[];
    };
  };
  global_settings: {
    project_name: string;
    auto_save: boolean;
    export_settings: ExportSettings;
  };
}

// Stage status
export type StageStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped';

// Export settings
export interface ExportSettings {
  include_metadata: boolean;
  include_embeddings: boolean;
  format: 'parquet' | 'json' | 'csv';
  compression: boolean;
}

// Pipeline actions
export type PipelineAction =
  | { type: 'SET_STAGE'; stage: PipelineStage }
  | { type: 'UPDATE_UPLOAD_CONFIG'; config: Partial<UploadConfig> }
  | { type: 'SET_UPLOAD_RESULT'; result: UploadResult }
  | { type: 'UPDATE_AUGMENT_CONFIG'; config: Partial<AugmentConfig> }
  | { type: 'SET_AUGMENT_JOB'; job: AugmentationJob }
  | { type: 'UPDATE_EMBED_CONFIG'; config: Partial<EmbedConfig> }
  | { type: 'SET_EMBED_RESULT'; result: EmbeddedAgentData[] }
  | { type: 'UPDATE_VISUALIZE_CONFIG'; config: Partial<VisualizeConfig> }
  | { type: 'SET_STAGE_STATUS'; stage: PipelineStage; status: StageStatus }
  | { type: 'ADD_STAGE_ERROR'; stage: PipelineStage; error: string }
  | { type: 'CLEAR_STAGE_ERRORS'; stage: PipelineStage }
  | { type: 'RESET_PIPELINE' };

// Data processor interface
export interface DataProcessor {
  processUpload(config: UploadConfig): Promise<UploadResult>;
  processAugmentation(
    data: NormalizedAgentData[],
    config: AugmentConfig
  ): Promise<AugmentedAgentData[]>;
  processEmbedding(
    data: AugmentedAgentData[],
    config: EmbedConfig
  ): Promise<EmbeddedAgentData[]>;
  exportForVisualization(
    data: EmbeddedAgentData[],
    config: VisualizeConfig
  ): Promise<any>;
}

// Progress tracking for long operations
export interface OperationProgress {
  operation_id: string;
  stage: PipelineStage;
  total_items: number;
  completed_items: number;
  current_operation: string;
  estimated_completion?: string;
  errors_count: number;
  warnings_count: number;
  start_time: string;
  last_update: string;
}

// Progress update specific to augmentation
export interface ProgressUpdate {
  job_id: string;
  stage: PipelineStage;
  total_items: number;
  completed_items: number;
  current_batch: number;
  estimated_completion: string;
  errors_count: number;
  warnings_count: number;
  start_time: string;
  last_update: string;
}