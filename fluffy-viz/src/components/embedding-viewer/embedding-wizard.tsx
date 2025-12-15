'use client';

/**
 * Multi-step wizard for creating embedding views
 * Guides users through provider selection, composition mode, and generation
 *
 * Composition Modes:
 * - Single Column: Embed one column directly (1:1 mapping)
 * - Multi-Column: Combine multiple columns per row (1:1 mapping)
 * - Cross-Row Aggregation: Group rows together (N:1 mapping)
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { AlertCircle, Plus, X, Info } from 'lucide-react';
import type { WizardState, GenerationProgress, ConversationalStrategy } from '@/types/embedding';
import { getEmbeddingModelsForProvider, getDefaultEmbeddingModel } from '@/lib/embedding/batch-embedder';

interface EmbeddingWizardProps {
  open: boolean;
  onClose: () => void;
  columns: string[];
  rows?: Record<string, unknown>[]; // Optional: for preview count calculation
  onGenerate: (state: WizardState) => Promise<void>;
}

const EMBEDDING_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', models: ['text-embedding-3-small', 'text-embedding-3-large'] },
  { id: 'cohere', name: 'Cohere', models: ['embed-english-v3.0', 'embed-multilingual-v3.0'] },
];

const SEPARATOR_OPTIONS = [
  { value: '\n\n', label: 'Double newline' },
  { value: '\n', label: 'Single newline' },
  { value: '\n---\n', label: 'Separator line (---)' },
  { value: ' | ', label: 'Pipe ( | )' },
  { value: ', ', label: 'Comma' },
];

export function EmbeddingWizard({ open, onClose, columns, rows = [], onGenerate }: EmbeddingWizardProps) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>({
    step: 0,
    name: '',
    provider: '',
    model: '',
    dimension: 1536,
    compositionMode: 'single',
    compositionConfig: {},
  });
  const [progress] = useState<GenerationProgress | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Auto-detect potential columns for Cross-Row Aggregation
  const detectedColumns = useMemo(() => {
    const conversationIdCandidates = ['conversation_id', 'session_id', 'conv_id', 'thread_id', 'chat_id'];
    const sequenceCandidates = ['timestamp', 'turn_number', 'sequence', 'turn', 'index', 'order', 'created_at'];

    const foundConvId = columns.find(col =>
      conversationIdCandidates.some(candidate => col.toLowerCase().includes(candidate.replace('_', '')))
    );
    const foundSequence = columns.find(col =>
      sequenceCandidates.some(candidate => col.toLowerCase().includes(candidate.replace('_', '')))
    );

    return { conversationIdColumn: foundConvId, sequenceColumn: foundSequence };
  }, [columns]);

  // Apply auto-detected defaults when switching to cross-row mode
  useEffect(() => {
    if (state.compositionMode === 'conversational' && !state.compositionConfig.conversationIdColumn) {
      const updates: Partial<WizardState['compositionConfig']> = {
        strategy: 'full-conversation',
        turnFormatColumns: [],
        separator: '\n---\n',
      };
      if (detectedColumns.conversationIdColumn) {
        updates.conversationIdColumn = detectedColumns.conversationIdColumn;
      }
      if (detectedColumns.sequenceColumn) {
        updates.sequenceColumn = detectedColumns.sequenceColumn;
      }
      setState(prev => ({
        ...prev,
        compositionConfig: { ...prev.compositionConfig, ...updates }
      }));
    }
  }, [state.compositionMode, state.compositionConfig.conversationIdColumn, detectedColumns]);

  // Calculate preview count for Cross-Row Aggregation
  const previewCount = useMemo(() => {
    if (state.compositionMode !== 'conversational' || !rows.length) {
      return { inputRows: rows.length, outputPoints: rows.length };
    }

    const convIdCol = state.compositionConfig.conversationIdColumn;
    if (!convIdCol) {
      return { inputRows: rows.length, outputPoints: rows.length };
    }

    // Count unique conversation IDs
    const uniqueConvIds = new Set(rows.map(row => String(row[convIdCol] ?? '')));
    const strategy = state.compositionConfig.strategy || 'full-conversation';

    // For turn-only, history-until, and turn-plus-n, each row becomes a point
    // For full-conversation, each unique conv ID becomes a point
    const outputPoints = strategy === 'full-conversation'
      ? uniqueConvIds.size
      : rows.length;

    return { inputRows: rows.length, outputPoints };
  }, [state.compositionMode, state.compositionConfig.conversationIdColumn, state.compositionConfig.strategy, rows]);

  // Validation: Check if Group By column has all unique values (no aggregation)
  const validationWarnings = useMemo(() => {
    const warnings: string[] = [];

    if (state.compositionMode === 'conversational' && state.compositionConfig.conversationIdColumn && rows.length > 0) {
      const convIdCol = state.compositionConfig.conversationIdColumn;
      const uniqueConvIds = new Set(rows.map(row => String(row[convIdCol] ?? '')));

      if (uniqueConvIds.size === rows.length) {
        warnings.push(`"${convIdCol}" has all unique values. No rows will be grouped together. Consider selecting a different Group By column.`);
      }
    }

    if (state.compositionMode === 'multi' && (state.compositionConfig.columns?.length || 0) < 2) {
      warnings.push('Select at least 2 columns to combine, or use Single Column mode.');
    }

    return warnings;
  }, [state.compositionMode, state.compositionConfig, rows]);

  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleNext = useCallback(() => {
    setStep(prev => Math.min(prev + 1, 5));
  }, []);

  const handleBack = useCallback(() => {
    setStep(prev => Math.max(prev - 1, 0));
  }, []);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      await onGenerate(state);
      onClose();
    } catch (error) {
      console.error('Error generating embeddings:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [state, onGenerate, onClose]);

  // Multi-column selection helpers
  const addColumn = useCallback((column: string) => {
    const currentColumns = state.compositionConfig.columns || [];
    if (!currentColumns.includes(column)) {
      updateState({
        compositionConfig: {
          ...state.compositionConfig,
          columns: [...currentColumns, column],
          separator: state.compositionConfig.separator || '\n\n',
        }
      });
    }
  }, [state.compositionConfig, updateState]);

  const removeColumn = useCallback((column: string) => {
    const currentColumns = state.compositionConfig.columns || [];
    updateState({
      compositionConfig: {
        ...state.compositionConfig,
        columns: currentColumns.filter(c => c !== column),
      }
    });
  }, [state.compositionConfig, updateState]);

  // Cross-row turn format column helpers
  const addTurnFormatColumn = useCallback((column: string) => {
    const currentColumns = state.compositionConfig.turnFormatColumns || [];
    if (!currentColumns.includes(column)) {
      updateState({
        compositionConfig: {
          ...state.compositionConfig,
          turnFormatColumns: [...currentColumns, column],
        }
      });
    }
  }, [state.compositionConfig, updateState]);

  const removeTurnFormatColumn = useCallback((column: string) => {
    const currentColumns = state.compositionConfig.turnFormatColumns || [];
    updateState({
      compositionConfig: {
        ...state.compositionConfig,
        turnFormatColumns: currentColumns.filter(c => c !== column),
      }
    });
  }, [state.compositionConfig, updateState]);

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="view-name">View Name</Label>
              <Input
                id="view-name"
                placeholder="e.g., Conversation History Analysis"
                value={state.name}
                onChange={(e) => updateState({ name: e.target.value })}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Give this embedding view a descriptive name
              </p>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label>Provider</Label>
              <Select
                value={state.provider}
                onValueChange={(value) => {
                  const defaultModel = getDefaultEmbeddingModel(value);
                  updateState({ provider: value, model: defaultModel });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {EMBEDDING_PROVIDERS.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {state.provider && (
              <div>
                <Label>Model</Label>
                <Select
                  value={state.model}
                  onValueChange={(value) => updateState({ model: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {getEmbeddingModelsForProvider(state.provider).map(model => (
                      <SelectItem key={model} value={model}>{model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <Label>What do you want to embed?</Label>
            <div className="space-y-2">
              <Card
                className={`p-4 cursor-pointer border-2 transition-colors ${state.compositionMode === 'single' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'}`}
                onClick={() => updateState({ compositionMode: 'single', compositionConfig: {} })}
              >
                <h3 className="font-medium">Single Column</h3>
                <p className="text-sm text-muted-foreground">Embed one existing column directly</p>
                <p className="text-xs text-muted-foreground mt-1">1 row = 1 point</p>
              </Card>

              <Card
                className={`p-4 cursor-pointer border-2 transition-colors ${state.compositionMode === 'multi' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'}`}
                onClick={() => updateState({ compositionMode: 'multi', compositionConfig: { columns: [], separator: '\n\n' } })}
              >
                <h3 className="font-medium">Multi-Column Concatenation</h3>
                <p className="text-sm text-muted-foreground">Combine multiple columns from each row</p>
                <p className="text-xs text-muted-foreground mt-1">1 row = 1 point</p>
              </Card>

              <Card
                className={`p-4 cursor-pointer border-2 transition-colors ${state.compositionMode === 'conversational' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'}`}
                onClick={() => updateState({ compositionMode: 'conversational', compositionConfig: {} })}
              >
                <h3 className="font-medium">Cross-Row Aggregation</h3>
                <p className="text-sm text-muted-foreground">Group rows together (e.g., conversation turns)</p>
                <p className="text-xs text-muted-foreground mt-1">N rows = 1 point</p>
              </Card>
            </div>
          </div>
        );

      case 3:
        return renderCompositionConfig();

      case 4:
        return (
          <div className="space-y-4">
            <h3 className="font-medium">Review Configuration</h3>
            <div className="space-y-2 text-sm">
              <p><strong>View Name:</strong> {state.name}</p>
              <p><strong>Provider:</strong> {state.provider}</p>
              <p><strong>Model:</strong> {state.model}</p>
              <p><strong>Composition Mode:</strong> {
                state.compositionMode === 'single' ? 'Single Column' :
                state.compositionMode === 'multi' ? 'Multi-Column Concatenation' :
                'Cross-Row Aggregation'
              }</p>

              {/* Preview Count */}
              {rows.length > 0 && (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {previewCount.inputRows} rows → {previewCount.outputPoints} embedding points
                    </span>
                  </div>
                </div>
              )}

              {/* Validation Warnings */}
              {validationWarnings.length > 0 && (
                <div className="mt-4 space-y-2">
                  {validationWarnings.map((warning, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                      <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-yellow-700 dark:text-yellow-400">{warning}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h3 className="font-medium">Generating Embeddings...</h3>
            {progress && (
              <>
                <Progress value={(progress.current / progress.total) * 100} />
                <p className="text-sm text-muted-foreground">{progress.message}</p>
              </>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const renderCompositionConfig = () => {
    switch (state.compositionMode) {
      case 'single':
        return (
          <div className="space-y-4">
            <div>
              <Label>Select Column to Embed</Label>
              <Select
                value={state.compositionConfig.sourceColumn}
                onValueChange={(value) =>
                  updateState({ compositionConfig: { ...state.compositionConfig, sourceColumn: value } })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(col => (
                    <SelectItem key={col} value={col}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Each value in this column will become one embedding point
              </p>
            </div>
          </div>
        );

      case 'multi':
        return (
          <div className="space-y-6">
            {/* Column Selection with Badges */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Columns to Combine</Label>

              {/* Selected columns as badges */}
              {(state.compositionConfig.columns?.length || 0) > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {state.compositionConfig.columns?.map(col => (
                    <Badge key={col} variant="secondary" className="gap-1 py-1">
                      {col}
                      <button
                        onClick={() => removeColumn(col)}
                        className="ml-1 hover:bg-muted rounded-sm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Add column selector */}
              <Select value="" onValueChange={addColumn}>
                <SelectTrigger>
                  <SelectValue placeholder="Add column..." />
                </SelectTrigger>
                <SelectContent>
                  {columns
                    .filter(col => !state.compositionConfig.columns?.includes(col))
                    .map(col => (
                      <SelectItem key={col} value={col}>
                        <div className="flex items-center gap-2">
                          <Plus className="w-3 h-3" />
                          {col}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Selected columns will be combined in order for each row
              </p>
            </div>

            {/* Separator Selection */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Separator</Label>
              <Select
                value={state.compositionConfig.separator || '\n\n'}
                onValueChange={(value) =>
                  updateState({
                    compositionConfig: { ...state.compositionConfig, separator: value }
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEPARATOR_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Text inserted between column values
              </p>
            </div>

            {/* Preview */}
            {(state.compositionConfig.columns?.length || 0) >= 2 && (
              <div className="p-3 bg-muted rounded-md">
                <Label className="text-xs font-medium mb-1 block">Preview Format</Label>
                <code className="text-xs text-muted-foreground">
                  {state.compositionConfig.columns?.join(
                    state.compositionConfig.separator === '\n\n' ? ' ↵↵ ' :
                    state.compositionConfig.separator === '\n' ? ' ↵ ' :
                    state.compositionConfig.separator || ' '
                  )}
                </code>
              </div>
            )}
          </div>
        );

      case 'conversational':
        return (
          <div className="space-y-6">
            {/* Group By Column */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Group By Column</Label>
              <Select
                value={state.compositionConfig.conversationIdColumn}
                onValueChange={(value) =>
                  updateState({
                    compositionConfig: { ...state.compositionConfig, conversationIdColumn: value }
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(col => (
                    <SelectItem key={col} value={col}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Rows with the same value will become ONE embedding point
              </p>
            </div>

            {/* Order By Column */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Order By Column</Label>
              <Select
                value={state.compositionConfig.sequenceColumn}
                onValueChange={(value) =>
                  updateState({
                    compositionConfig: { ...state.compositionConfig, sequenceColumn: value }
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(col => (
                    <SelectItem key={col} value={col}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Orders rows within each group (ascending)
              </p>
            </div>

            {/* Text Columns to Include */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Text Columns (per row)</Label>

              {/* Selected columns as badges */}
              {(state.compositionConfig.turnFormatColumns?.length || 0) > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {state.compositionConfig.turnFormatColumns?.map(col => (
                    <Badge key={col} variant="secondary" className="gap-1 py-1">
                      {col}
                      <button
                        onClick={() => removeTurnFormatColumn(col)}
                        className="ml-1 hover:bg-muted rounded-sm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Add column selector */}
              <Select value="" onValueChange={addTurnFormatColumn}>
                <SelectTrigger>
                  <SelectValue placeholder="Add column..." />
                </SelectTrigger>
                <SelectContent>
                  {columns
                    .filter(col =>
                      col !== state.compositionConfig.conversationIdColumn &&
                      col !== state.compositionConfig.sequenceColumn &&
                      !state.compositionConfig.turnFormatColumns?.includes(col)
                    )
                    .map(col => (
                      <SelectItem key={col} value={col}>
                        <div className="flex items-center gap-2">
                          <Plus className="w-3 h-3" />
                          {col}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Column values included for each row in the aggregated text
              </p>
            </div>

            {/* Aggregation Strategy */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Aggregation Strategy</Label>
              <RadioGroup
                value={state.compositionConfig.strategy || 'full-conversation'}
                onValueChange={(val) =>
                  updateState({
                    compositionConfig: {
                      ...state.compositionConfig,
                      strategy: val as ConversationalStrategy
                    }
                  })
                }
              >
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="full-conversation" id="full-conversation" />
                    <Label htmlFor="full-conversation" className="font-normal cursor-pointer flex-1">
                      Full group
                      <span className="text-xs text-muted-foreground ml-2">(All rows in group → 1 point)</span>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="turn-only" id="turn-only" />
                    <Label htmlFor="turn-only" className="font-normal cursor-pointer flex-1">
                      Row only
                      <span className="text-xs text-muted-foreground ml-2">(Each row → 1 point)</span>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="history-until" id="history-until" />
                    <Label htmlFor="history-until" className="font-normal cursor-pointer flex-1">
                      History until row
                      <span className="text-xs text-muted-foreground ml-2">(All rows up to current)</span>
                    </Label>
                  </div>

                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <RadioGroupItem value="turn-plus-n" id="turn-plus-n" />
                      <Label htmlFor="turn-plus-n" className="font-normal cursor-pointer flex-1">
                        Row plus N
                        <span className="text-xs text-muted-foreground ml-2">(Current + N previous)</span>
                      </Label>
                    </div>
                    {state.compositionConfig.strategy === 'turn-plus-n' && (
                      <div className="ml-6 mt-2 space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">N =</span>
                          <Slider
                            value={[state.compositionConfig.contextSize || 3]}
                            onValueChange={(val) =>
                              updateState({
                                compositionConfig: { ...state.compositionConfig, contextSize: val[0] }
                              })
                            }
                            min={1}
                            max={10}
                            step={1}
                            className="flex-1"
                          />
                          <span className="text-sm font-medium w-12 text-right">
                            {state.compositionConfig.contextSize || 3}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Separator */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Row Separator</Label>
              <Select
                value={state.compositionConfig.separator || '\n---\n'}
                onValueChange={(value) =>
                  updateState({
                    compositionConfig: { ...state.compositionConfig, separator: value }
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEPARATOR_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview Count */}
            {rows.length > 0 && state.compositionConfig.conversationIdColumn && (
              <div className="p-3 bg-muted rounded-md">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    <strong>{previewCount.inputRows}</strong> rows → <strong>{previewCount.outputPoints}</strong> embedding points
                  </span>
                </div>
              </div>
            )}

            {/* Validation Warning */}
            {validationWarnings.length > 0 && (
              <div className="space-y-2">
                {validationWarnings.map((warning, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                    <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-yellow-700 dark:text-yellow-400">{warning}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return state.name.trim().length > 0;
      case 1:
        return state.provider && state.model;
      case 2:
        return state.compositionMode;
      case 3:
        if (state.compositionMode === 'single') {
          return !!state.compositionConfig.sourceColumn;
        }
        if (state.compositionMode === 'multi') {
          return (state.compositionConfig.columns?.length || 0) >= 1;
        }
        if (state.compositionMode === 'conversational') {
          return !!(
            state.compositionConfig.conversationIdColumn &&
            state.compositionConfig.sequenceColumn &&
            (state.compositionConfig.turnFormatColumns?.length || 0) >= 1
          );
        }
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-[500px] sm:w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create Embedding View</SheetTitle>
          <SheetDescription>
            Step {step + 1} of 5
          </SheetDescription>
        </SheetHeader>

        <div className="py-6">
          {renderStep()}
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleBack} disabled={step === 0 || isGenerating}>
            Back
          </Button>
          {step < 4 ? (
            <Button onClick={handleNext} disabled={!canProceed() || isGenerating}>
              Continue
            </Button>
          ) : (
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate Embeddings'}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
