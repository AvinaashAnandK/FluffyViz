'use client'

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import type { WebSearchConfig, SearchContextSize } from '@/types/web-search'

interface GenerationSettingsProps {
  temperature: number
  maxTokens: number
  webSearchEnabled: boolean
  webSearchConfig: WebSearchConfig
  onTemperatureChange: (value: number) => void
  onMaxTokensChange: (value: number) => void
  onWebSearchConfigChange: (config: WebSearchConfig) => void
  /** Show location settings even when webSearchEnabled is false (for built-in search providers like Perplexity) */
  showLocationForBuiltInSearch?: boolean
}

export function GenerationSettings({
  temperature,
  maxTokens,
  webSearchEnabled,
  webSearchConfig,
  onTemperatureChange,
  onMaxTokensChange,
  onWebSearchConfigChange,
  showLocationForBuiltInSearch = false,
}: GenerationSettingsProps) {
  // Show location settings if web search is enabled OR for built-in search providers
  const showLocationSettings = webSearchEnabled || showLocationForBuiltInSearch
  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
        Generation Settings
      </div>

      {/* Temperature */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Temperature</Label>
          <span className="text-sm text-muted-foreground">{temperature.toFixed(1)}</span>
        </div>
        <Slider
          value={[temperature]}
          onValueChange={([v]) => onTemperatureChange(v)}
          min={0}
          max={2}
          step={0.1}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Higher = more creative, lower = more focused
        </p>
      </div>

      {/* Max Tokens */}
      <div className="space-y-2">
        <Label className="text-sm">Max Tokens</Label>
        <Input
          type="number"
          value={maxTokens}
          onChange={(e) => onMaxTokensChange(Math.max(1, Math.min(8192, Number(e.target.value) || 500)))}
          min={1}
          max={8192}
          className="h-8"
        />
        <p className="text-xs text-muted-foreground">
          Maximum length of generated response (1-8192)
        </p>
      </div>

      {/* Web Search Settings - Shown when enabled OR for built-in search providers */}
      {showLocationSettings && (
        <>
          <Separator />
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            {showLocationForBuiltInSearch && !webSearchEnabled
              ? 'Search Location (built-in search)'
              : 'Web Search Settings'}
          </div>

          {/* Search Context Size - Only for non-built-in search */}
          {webSearchEnabled && !showLocationForBuiltInSearch && (
            <div className="space-y-2">
              <Label className="text-sm">Search Context Size</Label>
              <Select
                value={webSearchConfig.contextSize}
                onValueChange={(value: SearchContextSize) =>
                  onWebSearchConfigChange({ ...webSearchConfig, contextSize: value })
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (faster, cheaper)</SelectItem>
                  <SelectItem value="medium">Medium (balanced)</SelectItem>
                  <SelectItem value="high">High (comprehensive)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Controls how much search context is included
              </p>
            </div>
          )}

          {/* User Location (optional) */}
          <div className="space-y-2">
            <Label className="text-sm">Location (optional)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="City"
                value={webSearchConfig.userLocation?.city || ''}
                onChange={(e) =>
                  onWebSearchConfigChange({
                    ...webSearchConfig,
                    userLocation: {
                      type: 'approximate',
                      ...webSearchConfig.userLocation,
                      city: e.target.value || undefined,
                    },
                  })
                }
                className="h-8"
              />
              <Input
                placeholder="Region/State"
                value={webSearchConfig.userLocation?.region || ''}
                onChange={(e) =>
                  onWebSearchConfigChange({
                    ...webSearchConfig,
                    userLocation: {
                      type: 'approximate',
                      ...webSearchConfig.userLocation,
                      region: e.target.value || undefined,
                    },
                  })
                }
                className="h-8"
              />
            </div>
            <Input
              placeholder="Country (e.g., IN, US)"
              value={webSearchConfig.userLocation?.country || ''}
              onChange={(e) =>
                onWebSearchConfigChange({
                  ...webSearchConfig,
                  userLocation: {
                    type: 'approximate',
                    ...webSearchConfig.userLocation,
                    country: e.target.value || undefined,
                  },
                })
              }
              className="h-8 mt-2"
            />
            <p className="text-xs text-muted-foreground">
              Country must be ISO code (e.g., IN for India, US for United States, GB for UK)
            </p>
          </div>
        </>
      )}
    </div>
  )
}
