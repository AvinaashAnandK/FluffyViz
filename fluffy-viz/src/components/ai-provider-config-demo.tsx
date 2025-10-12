"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Network,
  Scan,
  Save,
  AlertCircle,
  type LucideIcon,
} from "lucide-react"
import { useProviderConfig } from "@/hooks/use-provider-config"
import {
  PROVIDER_META,
  type ProviderKey,
  type ProviderCapabilities,
  type ProviderConfig,
  DEFAULT_CAPABILITIES,
} from "@/config/provider-settings"

type Capability = keyof ProviderCapabilities

type CapabilityMeta = {
  label: string
  description: string
}

const CAPABILITY_META: Record<Capability, CapabilityMeta> = {
  text: {
    label: "Text Generation",
    description: "Draft recaps, follow-ups, or insights alongside each dataset row.",
  },
  embedding: {
    label: "Text Embedding",
    description: "Index transcripts for similarity search and clustering inside FluffyViz.",
  },
  mmEmbedding: {
    label: "Multimodal Embedding",
    description: "Blend visuals and transcripts for richer graph exploration.",
  },
}

const CAPABILITY_GROUPS: Array<{ title: string; capabilities: Capability[] }> = [
  { title: "Data Augmentation & Evaluation", capabilities: ["text"] },
  { title: "Embeddings for Pattern Analysis", capabilities: ["embedding", "mmEmbedding"] },
]

const CAPABILITY_ICON: Record<Capability, LucideIcon> = {
  text: FileText,
  embedding: Network,
  mmEmbedding: Scan,
}

const CAPABILITY_BADGE_STYLES: Record<Capability, string> = {
  text: "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200",
  embedding: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200",
  mmEmbedding: "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200",
}

function buildDraftProvider(provider?: ProviderConfig): ProviderConfig {
  const base: ProviderConfig = {
    apiKey: provider?.apiKey ?? "",
    enabled: provider?.enabled ?? false,
    capabilities: {
      text: provider?.capabilities.text ?? false,
      embedding: provider?.capabilities.embedding ?? false,
      mmEmbedding: provider?.capabilities.mmEmbedding ?? false,
    },
  }

  if (provider?.baseUrl) {
    base.baseUrl = provider.baseUrl
  }

  return base
}

export function AIProviderConfigDemo({ className }: { className?: string }) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderKey>("openai")
  const [showKey, setShowKey] = useState(false)
  const [draftProvider, setDraftProvider] = useState<ProviderConfig>(() => buildDraftProvider())
  const [saving, setSaving] = useState(false)

  const {
    config,
    loading,
    error,
    getProviderApiKey,
    updateProvider,
  } = useProviderConfig()

  // Reset show key when changing providers
  useEffect(() => {
    setShowKey(false)
  }, [selectedProvider])

  // Sync draft provider state with saved configuration
  useEffect(() => {
    const providerState = config?.providers[selectedProvider]
    setDraftProvider(buildDraftProvider(providerState))
  }, [config, selectedProvider])

  const meta = PROVIDER_META[selectedProvider]
  const providerState = config?.providers[selectedProvider]
  const connected = useMemo(() => {
    if (!meta.needsApiKey) return true
    const apiKey = getProviderApiKey(selectedProvider)
    return Boolean(apiKey && apiKey.trim().length > 0)
  }, [meta.needsApiKey, selectedProvider, getProviderApiKey])

  const capabilityKeys = useMemo(
    () => Object.keys(DEFAULT_CAPABILITIES) as Capability[],
    []
  )

  const supportedCapabilities = useMemo(
    () => capabilityKeys.filter((cap) => meta.supports[cap]),
    [capabilityKeys, meta.supports]
  )

  const savedProvider = useMemo(
    () => buildDraftProvider(providerState),
    [providerState]
  )

  const trimmedApiKey = draftProvider.apiKey.trim()
  const hasSelectedCapability = supportedCapabilities.some(
    (capability) => draftProvider.capabilities[capability]
  )
  const hasKeyInput = meta.needsApiKey ? trimmedApiKey.length > 0 : true

  const capabilitiesChanged = capabilityKeys.some(
    (capability) =>
      draftProvider.capabilities[capability] !== savedProvider.capabilities[capability]
  )
  const keyChanged = draftProvider.apiKey !== savedProvider.apiKey
  const baseUrlChanged = (draftProvider.baseUrl ?? "") !== (savedProvider.baseUrl ?? "")

  const hasChanges = keyChanged || baseUrlChanged || capabilitiesChanged
  const canSave = hasChanges && hasKeyInput && hasSelectedCapability && !saving

  const saveTooltip = (() => {
    if (!hasChanges) return "No changes to save"
    if (!hasKeyInput) return `Enter your ${meta.label} API key`
    if (!hasSelectedCapability) return "Select at least one capability"
    return "Save provider settings"
  })()

  const reasonForCapability = (capability: Capability): string | null => {
    const supported = meta.supports[capability]
    if (!supported) return "Not available with this provider"
    return null
  }

  const handleSaveKey = async () => {
    try {
      setSaving(true)
      const updates: Partial<ProviderConfig> = {
        apiKey: trimmedApiKey,
        enabled: hasKeyInput && hasSelectedCapability,
        capabilities: {
          ...DEFAULT_CAPABILITIES,
          ...draftProvider.capabilities,
        },
      }

      if (draftProvider.baseUrl) {
        updates.baseUrl = draftProvider.baseUrl
      }

      await updateProvider(selectedProvider, updates)
      setShowKey(false)
    } catch (err) {
      console.error("Failed to save API key:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleClearKey = async () => {
    try {
      setSaving(true)
      await updateProvider(selectedProvider, {
        apiKey: "",
        enabled: false,
        capabilities: { ...DEFAULT_CAPABILITIES },
      })
      setDraftProvider(buildDraftProvider())
      setShowKey(false)
    } catch (err) {
      console.error("Failed to clear API key:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleCapability = (capability: Capability) => {
    if (reasonForCapability(capability)) return

    setDraftProvider((prev) => ({
      ...prev,
      capabilities: {
        ...prev.capabilities,
        [capability]: !prev.capabilities[capability],
      },
    }))
  }

  if (loading) {
    return (
      <Card className={cn(className, "border-primary/20 shadow-sm h-fit")}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-muted-foreground">
            Loading configuration...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={cn(className, "border-destructive/20 shadow-sm h-fit")}>
        <CardContent className="p-6">
          <div className="flex items-start gap-3 text-sm">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-medium text-destructive">Configuration Error</p>
              <p className="text-muted-foreground">
                {error.message.includes("not found")
                  ? "Provider configuration file not found. Copy provider-config.example.json to provider-config.json to get started."
                  : error.message}
              </p>
              {error.message.includes("not found") && (
                <pre className="mt-2 text-xs bg-muted p-2 rounded">
                  cp provider-config.example.json provider-config.json
                </pre>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!config) return null

  return (
    <TooltipProvider>
      <Card className={cn(className, "border-primary/20 shadow-sm h-fit")}>
        <CardContent className="space-y-6 p-6">
          <div className="rounded-lg border bg-muted/40 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Setup checklist</p>
            <ul className="mt-2 space-y-1">
              <li>1. Pick the provider you want to use</li>
              <li>2. Set the API key (stored in provider-config.json)</li>
              <li>3. Enable the Data Intelligence toggles your workflow needs</li>
            </ul>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[260px_1fr]">
            <div className="rounded-lg border bg-background divide-y">
              {(Object.keys(PROVIDER_META) as ProviderKey[]).map((providerKey) => {
                const providerMeta = PROVIDER_META[providerKey]
                const isSelected = selectedProvider === providerKey
                const apiKey = getProviderApiKey(providerKey)
                const isConnected = providerMeta.needsApiKey ? Boolean(apiKey?.trim()) : true

                return (
                  <button
                    key={providerKey}
                    type="button"
                    onClick={() => setSelectedProvider(providerKey)}
                    className={cn(
                      "w-full px-4 py-3 text-left transition",
                      isSelected ? "bg-primary/5" : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{providerMeta.label}</span>
                      {providerMeta.freeTier && <Badge variant="secondary">Free tier</Badge>}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      {isConnected ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                          Connected
                        </>
                      ) : (
                        <>
                          <Circle className="h-3.5 w-3.5" aria-hidden="true" />
                          Not connected
                        </>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold">{meta.label}</h3>
                </div>
                <div className="flex flex-col items-end gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-3 py-1",
                        connected
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {connected ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Connected
                        </>
                      ) : (
                        <>
                          <Circle className="h-3.5 w-3.5" aria-hidden="true" />
                          Awaiting key
                        </>
                      )}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="gap-2"
                          onClick={handleSaveKey}
                          disabled={!canSave}
                        >
                          <Save className="h-4 w-4" aria-hidden="true" />
                          Save Key
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {saveTooltip}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(Object.keys(meta.supports) as Capability[]).map((capability) => {
                  const CapIcon = CAPABILITY_ICON[capability]
                  const supported = meta.supports[capability]
                  return (
                    <Badge
                      key={capability}
                      variant="outline"
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                        supported
                          ? cn("border-none", CAPABILITY_BADGE_STYLES[capability])
                          : "border-dashed border-muted-foreground/40 text-muted-foreground"
                      )}
                    >
                      {CapIcon && <CapIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                      {CAPABILITY_META[capability].label}
                    </Badge>
                  )
                })}
              </div>

              {meta.needsApiKey && (
                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                  <Label
                    htmlFor={`${selectedProvider}-api-key`}
                    className="flex items-center gap-2 text-sm font-medium"
                  >
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                    API key
                  </Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 basis-64 max-w-md">
                      <Input
                        id={`${selectedProvider}-api-key`}
                        type={showKey ? "text" : "password"}
                        value={draftProvider.apiKey}
                        onChange={(event) =>
                          setDraftProvider((prev) => ({
                            ...prev,
                            apiKey: event.target.value,
                          }))
                        }
                        placeholder={`Paste your ${meta.label} key`}
                        className="bg-background pr-12"
                        autoComplete="off"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={showKey ? "Hide API key" : "Show API key"}
                        onClick={() => setShowKey((prev) => !prev)}
                        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground"
                      >
                        {showKey ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                    <Button variant="ghost" onClick={handleClearKey}>
                      Clear
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Keys are stored in provider-config.json. Select the below toggles for this provider to save. 
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {CAPABILITY_GROUPS.map((group) => (
                  <div key={group.title} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.title}
                      </h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.capabilities.map((capability) => {
                        const capMeta = CAPABILITY_META[capability]
                        const CapIcon = CAPABILITY_ICON[capability]
                        const enabled = draftProvider.capabilities[capability]
                        const disabledReason = reasonForCapability(capability)

                        const button = (
                          <Button
                            key={capability}
                            size="sm"
                            variant={enabled ? "default" : "outline"}
                            className="gap-2"
                            aria-pressed={enabled}
                            onClick={() => handleToggleCapability(capability)}
                            disabled={Boolean(disabledReason)}
                          >
                            {CapIcon && <CapIcon className="h-4 w-4" aria-hidden="true" />}
                            {capMeta.label}
                          </Button>
                        )

                        return (
                          <Tooltip key={capability}>
                            <TooltipTrigger asChild>{button}</TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs">
                              {disabledReason ?? capMeta.description}
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
