"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  FileText,
  ImageIcon,
  KeyRound,
  Network,
  Scan,
  Shield,
  Sparkles,
  type LucideIcon,
} from "lucide-react"

type ProviderKey = "huggingface" | "google" | "cohere" | "mistral" | "anthropic" | "openai" | "local"
type Capability = "columnGeneration" | "text" | "image" | "embedding" | "mmEmbedding"

type ProviderSupport = {
  text: boolean
  image: boolean
  embedding: boolean
  mmEmbedding: boolean
}

type ProviderMeta = {
  label: string
  freeTier: boolean
  needsApiKey: boolean
  supports: ProviderSupport
}

type ProviderState = {
  apiKey: string
  draftKey: string
  enabled: Record<Capability, boolean>
}

type ProvidersState = Record<ProviderKey, ProviderState>

type CapabilityMeta = {
  label: string
  description: string
}

const PROVIDERS_META: Record<ProviderKey, ProviderMeta> = {
  huggingface: {
    label: "HuggingFace",
    freeTier: true,
    needsApiKey: true,
    supports: { text: true, image: true, embedding: true, mmEmbedding: true },
  },
  google: {
    label: "Google AI",
    freeTier: true,
    needsApiKey: true,
    supports: { text: true, image: true, embedding: true, mmEmbedding: true },
  },
  cohere: {
    label: "Cohere",
    freeTier: true,
    needsApiKey: true,
    supports: { text: true, image: false, embedding: true, mmEmbedding: false },
  },
  mistral: {
    label: "Mistral",
    freeTier: true,
    needsApiKey: true,
    supports: { text: true, image: false, embedding: true, mmEmbedding: false },
  },
  anthropic: {
    label: "Anthropic",
    freeTier: false,
    needsApiKey: true,
    supports: { text: true, image: false, embedding: false, mmEmbedding: false },
  },
  openai: {
    label: "OpenAI",
    freeTier: false,
    needsApiKey: true,
    supports: { text: true, image: true, embedding: true, mmEmbedding: false },
  },
  local: {
    label: "Local LLM",
    freeTier: false,
    needsApiKey: false,
    supports: { text: true, image: false, embedding: false, mmEmbedding: false },
  },
}

const DEFAULT_CAPABILITIES: Record<Capability, boolean> = {
  columnGeneration: false,
  text: false,
  image: false,
  embedding: false,
  mmEmbedding: false,
}

const CAPABILITY_META: Record<Capability, CapabilityMeta> = {
  columnGeneration: {
    label: "Column Generation",
    description: "Map intelligence outputs into structured columns for exports and BI syncs.",
  },
  text: {
    label: "Text Generation",
    description: "Draft recaps, follow-ups, or insights alongside each dataset row.",
  },
  image: {
    label: "Image Generation",
    description: "Create supporting visuals or UI mockups for presentations.",
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
  { title: "Data Augmentation & Evaluation", capabilities: ["text", "image"] },
  { title: "Embeddings for Pattern Analysis", capabilities: ["embedding", "mmEmbedding"] },
]

const CAPABILITY_ICON: Record<Capability, LucideIcon> = {
  columnGeneration: Sparkles,
  text: FileText,
  image: ImageIcon,
  embedding: Network,
  mmEmbedding: Scan,
}

const CAPABILITY_BADGE_STYLES: Record<Capability, string> = {
  text: "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200",
  image: "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200",
  embedding: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200",
  mmEmbedding: "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200",
  columnGeneration: "bg-primary/10 text-primary",
}

function createDefaultState(): ProvidersState {
  return Object.keys(PROVIDERS_META).reduce((acc, key) => {
    const provider = key as ProviderKey
    acc[provider] = {
      apiKey: "",
      draftKey: "",
      enabled: { ...DEFAULT_CAPABILITIES },
    }
    return acc
  }, {} as ProvidersState)
}

function maskKey(key: string) {
  if (!key) return ""
  const visible = key.slice(-4)
  return "•".repeat(Math.max(0, key.length - 4)) + visible
}

export function AIProviderConfigDemo({ className }: { className?: string }) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderKey>("huggingface")
  const [providers, setProviders] = useState<ProvidersState>(() => createDefaultState())
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    setShowKey(false)
  }, [selectedProvider])

  const meta = PROVIDERS_META[selectedProvider]
  const providerState = providers[selectedProvider]

  const connected = useMemo(() => {
    if (!meta.needsApiKey) return true
    return providerState.apiKey.trim().length > 0
  }, [meta.needsApiKey, providerState.apiKey])

  const reasonForCapability = (capability: Capability) => {
    if (capability === "columnGeneration") {
      if (!meta.supports.text) return "Needs Data Intelligence: Text Generation"
      if (meta.needsApiKey && !connected) return "Save an API key to enable"
      return null
    }

    const supported = meta.supports[capability as keyof ProviderSupport]
    if (!supported) return "Not available with this provider"
    if (meta.needsApiKey && !connected) return "Save an API key to enable"

    return null
  }

  const updateProvider = (key: ProviderKey, updater: (state: ProviderState) => ProviderState) => {
    setProviders((prev) => ({
      ...prev,
      [key]: updater(prev[key]),
    }))
  }

  const handleSaveKey = () => {
    updateProvider(selectedProvider, (state) => {
      const trimmed = state.draftKey.trim()
      return {
        ...state,
        apiKey: trimmed,
        draftKey: trimmed,
      }
    })
    setShowKey(false)
  }

  const handleClearKey = () => {
    updateProvider(selectedProvider, () => ({
      apiKey: "",
      draftKey: "",
      enabled: { ...DEFAULT_CAPABILITIES },
    }))
    setShowKey(false)
  }

  const toggleCapability = (capability: Capability) => {
    if (reasonForCapability(capability)) return

    updateProvider(selectedProvider, (state) => ({
      ...state,
      enabled: {
        ...state.enabled,
        [capability]: !state.enabled[capability],
      },
    }))
  }

  return (
    <TooltipProvider>
      <Card className={cn(className, "border-primary/20 shadow-sm h-fit") }>
        {/* <CardHeader className="space-y-2">
          <CardTitle>Provider Controls</CardTitle>
          <CardDescription>
            Decide which vendors power FluffyViz insights and unlock the Data Intelligence features used across projects.
          </CardDescription>
        </CardHeader> */}
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/40 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Setup checklist</p>
            <ul className="mt-2 space-y-1">
              <li>1. Pick the provider you want to use</li>
              <li>2. Set the API key, which is stored locally</li>
              <li>3. Enable the Data Intelligence toggles your workflow needs</li>
            </ul>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[260px_1fr]">
            <div className="rounded-lg border bg-background divide-y">
              {Object.entries(PROVIDERS_META).map(([providerKey, providerMeta]) => {
                const key = providerKey as ProviderKey
                const state = providers[key]
                const isSelected = selectedProvider === key
                const isConnected = providerMeta.needsApiKey ? state.apiKey.trim().length > 0 : true

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedProvider(key)}
                    className={cn(
                      "w-full px-4 py-3 text-left transition",
                      isSelected ? "bg-primary/5" : "hover:bg-muted/50",
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
                {/* <p className="text-sm text-muted-foreground">
                  Control how FluffyViz routes augmentation requests through {meta.label}.
                </p> */}
              </div>
              <div className="flex flex-col items-end gap-2 text-xs">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-3 py-1",
                    connected
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground",
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
                {/* {meta.needsApiKey ? (
                  <span className="text-muted-foreground">
                    Saved key: {maskKey(providerState.apiKey) || "—"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                    Runs locally
                  </span>
                )} */}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(Object.keys(meta.supports) as Array<keyof ProviderSupport>).map((capability) => {
                const CapIcon = CAPABILITY_ICON[capability as Capability]
                const supported = meta.supports[capability]
                return (
                  <Badge
                    key={capability}
                    variant="outline"
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                      supported
                        ? cn("border-none", CAPABILITY_BADGE_STYLES[capability as Capability])
                        : "border-dashed border-muted-foreground/40 text-muted-foreground",
                    )}
                  >
                    {CapIcon && <CapIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                    {CAPABILITY_META[capability as Capability].label}
                  </Badge>
                )
              })}
            </div>

            {meta.needsApiKey && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                <Label htmlFor={`${selectedProvider}-api-key`} className="flex items-center gap-2 text-sm font-medium">
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  API key
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 basis-64 max-w-md">
                    <Input
                      id={`${selectedProvider}-api-key`}
                      type={showKey ? "text" : "password"}
                      value={providerState.draftKey}
                      onChange={(event) =>
                        updateProvider(selectedProvider, (state) => ({ ...state, draftKey: event.target.value }))
                      }
                      placeholder={`Paste your ${meta.label} key`}
                      className="bg-background pr-12 read-only:cursor-not-allowed read-only:bg-muted"
                      readOnly={Boolean(providerState.apiKey)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={showKey ? "Hide API key" : "Show API key"}
                      onClick={() => setShowKey((prev) => !prev)}
                      className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground"
                    >
                      {showKey ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </Button>
                  </div>
                  <Button
                    onClick={handleSaveKey}
                    disabled={!providerState.draftKey.trim() || Boolean(providerState.apiKey)}
                  >
                    Save key
                  </Button>
                  <Button variant="ghost" onClick={handleClearKey}>
                    Clear
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Keys stay in-browser only. Clearing a key resets all toggles for this provider.
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
                      const enabled = providerState.enabled[capability]
                      const disabledReason = reasonForCapability(capability)

                      const button = (
                        <Button
                          key={capability}
                          size="sm"
                          variant={enabled ? "default" : "outline"}
                          className="gap-2"
                          aria-pressed={enabled}
                          onClick={() => toggleCapability(capability)}
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

            {/* <Separator /> */}

            {/* <div className="grid gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                Column generation builds on Data Intelligence outputs. Keep the relevant toggles active for exports.
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
                Toggle states are stored locally to match how the live app treats provider preferences.
              </div>
            </div> */}
          </div>
        </div>

        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
