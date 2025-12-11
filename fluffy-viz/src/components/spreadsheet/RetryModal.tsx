/**
 * RetryModal - Modal for regenerating AI column cells
 *
 * Features:
 * - Show failed/edited cell counts
 * - Few-shot example preview
 * - Scope selection (failed only, failed+edited, all)
 * - Model/provider change (future)
 */

'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertCircle, Globe, Lock } from 'lucide-react';
import type { FewShotExample } from '@/lib/few-shot-sampling';
import { ModelSelector } from './ModelSelector';
import { ProviderSelector } from './ProviderSelector';
import { GenerationSettings } from './GenerationSettings';
import { loadProviderSettings, getEnabledProviders, type ProviderSettings } from '@/config/provider-settings';
import type { WebSearchConfig } from '@/types/web-search';

import type { Model, ModelProvider } from '@/types/models';

export interface RetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: (options: RetryOptions) => Promise<void>;
  columnName: string;
  columnPrompt?: string;
  columnIdToNameMap?: Map<string, string>;
  stats: {
    failed: number;
    edited: number;
    succeeded: number;
    total: number;
  };
  examples: FewShotExample[];
  hasRateLimitErrors?: boolean;
  currentModel?: Model;
  currentProvider?: ModelProvider;
  onModelChange?: (model: Model, provider: ModelProvider) => void;
  /** Original web search config (locked - cannot change enabled state) */
  webSearchConfig?: WebSearchConfig;
  /** Original temperature setting */
  temperature?: number;
  /** Original maxTokens setting */
  maxTokens?: number;
}

export interface RetryOptions {
  scope: 'failed' | 'failed-edited' | 'all';
  includeFewShot: boolean;
  selectedExamples: FewShotExample[];
  fewShotCount: number;
  model?: Model;
  provider?: ModelProvider;
  /** Web search configuration (enabled state is preserved from original) */
  webSearch?: WebSearchConfig;
  temperature?: number;
  maxTokens?: number;
}

type RetryScope = 'failed' | 'failed-edited' | 'all';

/**
 * Convert column IDs in prompt to display names
 */
function convertPromptIdsToNames(
  prompt: string,
  columnIdToNameMap: Map<string, string>
): string {
  let result = prompt;

  // Replace {{column_id}} with {{display_name}}
  const regex = /\{\{([^}]+)\}\}/g;
  result = result.replace(regex, (match, columnId) => {
    const displayName = columnIdToNameMap.get(columnId);
    return displayName ? `{{${displayName}}}` : match;
  });

  return result;
}

/**
 * Extract column IDs referenced in the prompt
 */
function extractReferencedColumns(prompt: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const matches = [];
  let match;

  while ((match = regex.exec(prompt)) !== null) {
    matches.push(match[1]);
  }

  return matches;
}

/**
 * Build preview text with prompt and few-shot examples
 */
function buildPreviewWithExamples(
  prompt: string,
  examples: FewShotExample[],
  includeFewShot: boolean,
  columnIdToNameMap?: Map<string, string>
): string {
  // Convert column IDs to display names in prompt
  let previewText = columnIdToNameMap
    ? convertPromptIdsToNames(prompt, columnIdToNameMap)
    : prompt;

  // Add few-shot examples if enabled
  if (includeFewShot && examples.length > 0) {
    const referencedColumns = extractReferencedColumns(prompt);

    previewText += '\n\n─────────────────────────────────────────────────\n';
    previewText += 'Few-Shot Examples:\n\n';
    previewText += 'ℹ️ These examples show incorrect outputs and their corrections.\n';
    previewText += '   Generate outputs that match the correction pattern.\n\n';

    examples.slice(0, 3).forEach((ex, idx) => {
      previewText += `Example ${idx + 1}:\n`;

      // Show only referenced columns
      referencedColumns.forEach(columnId => {
        const value = ex.input[columnId];
        if (value === undefined) return;

        const displayName = columnIdToNameMap?.get(columnId) || columnId;
        const valueStr = String(value);

        // For multi-line values, indent continuation lines
        const lines = valueStr.split('\n');
        previewText += `${displayName}:\n`;
        lines.forEach((line, lineIdx) => {
          const displayLine = line.length > 200 ? line.substring(0, 200) + '...' : line;
          previewText += `  ${displayLine}\n`;
        });
      });

      // Show incorrect output
      if (ex.originalOutput) {
        const incorrectLines = String(ex.originalOutput).split('\n');
        previewText += `\nIncorrect Output:\n`;
        incorrectLines.forEach(line => {
          const displayLine = line.length > 200 ? line.substring(0, 200) + '...' : line;
          previewText += `  ${displayLine}\n`;
        });
      }

      // Show correct output
      const correctLines = String(ex.output).split('\n');
      previewText += `\nCorrect Output:\n`;
      correctLines.forEach(line => {
        const displayLine = line.length > 200 ? line.substring(0, 200) + '...' : line;
        previewText += `  ${displayLine}\n`;
      });

      previewText += `\n`;
    });

    if (examples.length > 3) {
      previewText += `... and ${examples.length - 3} more example${examples.length - 3 !== 1 ? 's' : ''}`;
      if (examples.length > 10) {
        previewText += ' (10 will be randomly selected)';
      }
      previewText += '\n';
    }
  }

  return previewText;
}

export function RetryModal({
  isOpen,
  onClose,
  onRetry,
  columnName,
  columnPrompt,
  columnIdToNameMap,
  stats,
  examples,
  hasRateLimitErrors = false,
  currentModel,
  currentProvider,
  webSearchConfig,
  temperature: initialTemperature = 0.7,
  maxTokens: initialMaxTokens = 500,
}: RetryModalProps) {
  const [scope, setScope] = useState<RetryScope>('failed');
  const [includeFewShot, setIncludeFewShot] = useState(true);
  const [fewShotCount, setFewShotCount] = useState(10);
  const [isRetrying, setIsRetrying] = useState(false);
  const [changeModel, setChangeModel] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | undefined>(currentModel);
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider | undefined>(currentProvider);
  const [providerConfig, setProviderConfig] = useState<ProviderSettings | null>(null);

  // Generation settings (web search enabled state is locked)
  const [temperature, setTemperature] = useState(initialTemperature);
  const [maxTokens, setMaxTokens] = useState(initialMaxTokens);
  const [currentWebSearchConfig, setCurrentWebSearchConfig] = useState<WebSearchConfig>(
    webSearchConfig || { enabled: false, contextSize: 'medium' }
  );

  const webSearchEnabled = webSearchConfig?.enabled ?? false;

  // Load provider configuration
  useEffect(() => {
    loadProviderSettings()
      .then(setProviderConfig)
      .catch(error => {
        console.error('Failed to load provider config:', error);
        setProviderConfig(null);
      });
  }, []);

  // Reset model selection when provider changes
  useEffect(() => {
    if (selectedProvider && selectedModel) {
      // Check if current model is compatible with new provider
      const isCompatible = selectedModel.provider === selectedProvider.id;
      if (!isCompatible) {
        setSelectedModel(undefined);
      }
    }
  }, [selectedProvider, selectedModel]);

  const enabledProviders = providerConfig ? getEnabledProviders(providerConfig) : [];
  const hasEnabledProviders = enabledProviders.length > 0;

  const handleRetry = async () => {
    // Determine which model and provider to use
    const modelToUse = changeModel ? selectedModel : currentModel;
    const providerToUse = changeModel ? selectedProvider : currentProvider;

    // Validate that we have model and provider
    if (!modelToUse || !providerToUse) {
      // If no model/provider available, force user to select one
      if (!changeModel) {
        setChangeModel(true);
      }
      return;
    }

    setIsRetrying(true);
    try {
      // Limit examples to user-configured count
      const limitedExamples = includeFewShot
        ? examples.slice(0, fewShotCount)
        : [];

      await onRetry({
        scope: changeModel ? 'all' : scope,
        includeFewShot,
        selectedExamples: limitedExamples,
        fewShotCount,
        model: modelToUse,
        provider: providerToUse,
        webSearch: webSearchEnabled ? currentWebSearchConfig : undefined,
        temperature,
        maxTokens,
      });
      onClose();
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const getCellCount = () => {
    if (changeModel) {
      return stats.total;
    }
    switch (scope) {
      case 'failed':
        return stats.failed;
      case 'failed-edited':
        return stats.failed + stats.edited;
      case 'all':
        return stats.total;
      default:
        return 0;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[80vw] h-[80vh] max-w-none overflow-auto">
        <DialogHeader>
          <DialogTitle>Regenerate Column: {columnName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Status:</h3>
            <ul className="text-sm space-y-1">
              <li>• {stats.failed} cells failed</li>
              <li>• {stats.edited} cells manually edited</li>
              <li>• {stats.succeeded} cells succeeded</li>
            </ul>
          </div>

          {/* Rate limit warning */}
          {hasRateLimitErrors && (
            <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning rounded-md">
              <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Rate limit errors detected</p>
                <p className="text-muted-foreground">
                  Some cells failed due to rate limits. Wait before retrying or switch providers.
                </p>
              </div>
            </div>
          )}

          {/* Model/Provider Change */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="change-model"
                checked={changeModel}
                onCheckedChange={(checked) => {
                  setChangeModel(checked === true)
                  if (checked) {
                    setScope('all') // Force full column regeneration when changing model
                  }
                }}
              />
              <Label htmlFor="change-model" className="text-sm font-medium cursor-pointer">
                Change model/provider
              </Label>
            </div>

            {changeModel && (
              <div className="pl-6 space-y-3">
                <div className="p-3 bg-warning/10 border border-warning rounded-md text-sm">
                  ⚠️ Changing the model will regenerate the entire column to avoid mixed provenance.
                </div>

                <div className="space-y-3">
                  {currentModel && currentProvider && (
                    <div className="text-xs text-muted-foreground">
                      Current: {currentProvider.name} - {currentModel.name}
                    </div>
                  )}

                  {/* Provider Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm">Provider</Label>
                    <ProviderSelector
                      selectedProvider={selectedProvider}
                      onProviderSelect={setSelectedProvider}
                    />
                  </div>

                  {/* Model Selection */}
                  {selectedProvider && (
                    <div className="space-y-2">
                      <Label className="text-sm">Model</Label>
                      <ModelSelector
                        selectedModel={selectedModel}
                        onModelSelect={setSelectedModel}
                        filterByProvider={selectedProvider.id}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Generation Settings */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Generation Settings:</h3>

            {/* Web Search Status (locked) */}
            {webSearchEnabled && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  Web search enabled
                </span>
                <Lock className="h-3 w-3 text-blue-500 dark:text-blue-400 ml-auto" />
                <span className="text-xs text-blue-500 dark:text-blue-400">
                  Cannot be changed
                </span>
              </div>
            )}

            {/* Generation Settings Component */}
            <div className="border rounded-md p-4">
              <GenerationSettings
                temperature={temperature}
                maxTokens={maxTokens}
                webSearchEnabled={webSearchEnabled}
                webSearchConfig={currentWebSearchConfig}
                onTemperatureChange={setTemperature}
                onMaxTokensChange={setMaxTokens}
                onWebSearchConfigChange={setCurrentWebSearchConfig}
              />
            </div>
          </div>

          {/* Few-shot examples */}
          {examples.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="few-shot"
                  checked={includeFewShot}
                  onCheckedChange={(checked) => setIncludeFewShot(checked === true)}
                />
                <Label htmlFor="few-shot" className="text-sm font-medium cursor-pointer">
                  Include manual edits as examples
                </Label>
              </div>

              {includeFewShot && (
                <div className="pl-6 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {Math.min(examples.length, fewShotCount)} of {examples.length} {examples.length === 1 ? 'edit' : 'edits'} will be used to improve generation
                  </p>

                  {/* Few-shot count input */}
                  {examples.length > 1 && (
                    <div className="flex items-center gap-3">
                      <Label htmlFor="few-shot-count" className="text-sm whitespace-nowrap">
                        Examples to use:
                      </Label>
                      <input
                        type="number"
                        id="few-shot-count"
                        min={1}
                        max={Math.min(examples.length, 20)}
                        value={fewShotCount}
                        onChange={(e) => setFewShotCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                        className="w-16 px-2 py-1 text-sm border rounded-md bg-background"
                      />
                      <span className="text-xs text-muted-foreground">
                        (max 20)
                      </span>
                    </div>
                  )}

                  {examples.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Preview:</p>
                      <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
                        {examples.slice(0, Math.min(3, fewShotCount)).map((ex, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-muted-foreground">Row {ex.rowIndex + 1}:</span>
                            <span className="font-mono text-foreground">&ldquo;{ex.output}&rdquo;</span>
                          </div>
                        ))}
                        {Math.min(examples.length, fewShotCount) > 3 && (
                          <p className="text-muted-foreground italic">
                            ... and {Math.min(examples.length, fewShotCount) - 3} more
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Prompt Preview Accordion */}
          {columnPrompt && (
            <Accordion type="single" collapsible>
              <AccordionItem value="preview">
                <AccordionTrigger className="text-sm">
                  Preview Interpolated Prompt
                </AccordionTrigger>
                <AccordionContent>
                  <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-x-auto whitespace-pre-wrap">
                    {buildPreviewWithExamples(
                      columnPrompt,
                      examples,
                      includeFewShot,
                      columnIdToNameMap
                    )}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* Scope selection */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Regenerate scope:</h3>
            {changeModel ? (
              <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
                Scope automatically set to <span className="font-medium text-foreground">Entire column ({stats.total} cells)</span> when changing model
              </div>
            ) : (
              <RadioGroup value={scope} onValueChange={(v) => setScope(v as RetryScope)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="failed" id="scope-failed" />
                  <Label htmlFor="scope-failed" className="cursor-pointer">
                    Only failed cells ({stats.failed} cells)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="failed-edited" id="scope-failed-edited" />
                  <Label htmlFor="scope-failed-edited" className="cursor-pointer">
                    Failed + edited cells ({stats.failed + stats.edited} cells)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="scope-all" />
                  <Label htmlFor="scope-all" className="cursor-pointer">
                    Entire column ({stats.total} cells)
                  </Label>
                </div>
              </RadioGroup>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isRetrying}>
            Cancel
          </Button>
          <Button onClick={handleRetry} disabled={isRetrying}>
            {isRetrying ? 'Regenerating...' : `Regenerate ${getCellCount()} cells`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
