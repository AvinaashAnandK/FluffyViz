'use client';

/**
 * Multi-step wizard for creating embedding views
 * Guides users through provider selection, composition mode, and generation
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import type { WizardState, GenerationProgress } from '@/types/embedding';
import { getEmbeddingModelsForProvider, getDefaultEmbeddingModel } from '@/lib/embedding/batch-embedder';

interface EmbeddingWizardProps {
  open: boolean;
  onClose: () => void;
  columns: string[];
  onGenerate: (state: WizardState) => Promise<void>;
}

const EMBEDDING_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', models: ['text-embedding-3-small', 'text-embedding-3-large'] },
  { id: 'cohere', name: 'Cohere', models: ['embed-english-v3.0', 'embed-multilingual-v3.0'] },
];

export function EmbeddingWizard({ open, onClose, columns, onGenerate }: EmbeddingWizardProps) {
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
            <Label>What to Embed?</Label>
            <div className="space-y-2">
              <Card
                className={`p-4 cursor-pointer border-2 ${state.compositionMode === 'single' ? 'border-primary' : 'border-border'}`}
                onClick={() => updateState({ compositionMode: 'single', compositionConfig: {} })}
              >
                <h3 className="font-medium">Single Column</h3>
                <p className="text-sm text-muted-foreground">Select one column to embed</p>
              </Card>

              <Card
                className={`p-4 cursor-pointer border-2 ${state.compositionMode === 'multi' ? 'border-primary' : 'border-border'}`}
                onClick={() => updateState({ compositionMode: 'multi', compositionConfig: {} })}
              >
                <h3 className="font-medium">Multi-Column Concatenation</h3>
                <p className="text-sm text-muted-foreground">Combine multiple columns from current row</p>
              </Card>

              <Card
                className={`p-4 cursor-pointer border-2 ${state.compositionMode === 'conversational' ? 'border-primary' : 'border-border'}`}
                onClick={() => updateState({ compositionMode: 'conversational', compositionConfig: {} })}
              >
                <h3 className="font-medium">Conversational History</h3>
                <p className="text-sm text-muted-foreground">Aggregate turns across rows by session</p>
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
              <p><strong>Composition Mode:</strong> {state.compositionMode}</p>
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
            <Label>Column</Label>
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
          </div>
        );

      case 'multi':
        return (
          <div className="space-y-4">
            <Label>Columns to Combine</Label>
            <Select
              value={state.compositionConfig.columns?.[0]}
              onValueChange={(value) =>
                updateState({
                  compositionConfig: {
                    ...state.compositionConfig,
                    columns: [value],
                    separator: '\n'
                  }
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select columns" />
              </SelectTrigger>
              <SelectContent>
                {columns.map(col => (
                  <SelectItem key={col} value={col}>{col}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'conversational':
        return (
          <div className="space-y-4">
            <div>
              <Label>Conversation ID Column</Label>
              <Select
                value={state.compositionConfig.conversationIdColumn}
                onValueChange={(value) =>
                  updateState({
                    compositionConfig: {
                      ...state.compositionConfig,
                      conversationIdColumn: value,
                      strategy: 'full-conversation',
                      turnFormatColumns: columns.slice(0, 2)
                    }
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select conversation ID column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(col => (
                    <SelectItem key={col} value={col}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Sequence Column</Label>
              <Select
                value={state.compositionConfig.sequenceColumn}
                onValueChange={(value) =>
                  updateState({
                    compositionConfig: {
                      ...state.compositionConfig,
                      sequenceColumn: value
                    }
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sequence column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(col => (
                    <SelectItem key={col} value={col}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
        if (state.compositionMode === 'conversational') {
          return !!state.compositionConfig.conversationIdColumn && !!state.compositionConfig.sequenceColumn;
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
      <SheetContent side="right" className="w-[500px] sm:w-[600px]">
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
