"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CheckCircle2, Circle, FileText, ImageIcon, Network, Scan, KeyRound, Shield } from "lucide-react"

import {
  PROVIDERS_META,
  type ProviderKey,
  type Capability,
  type ProviderSupport,
  useProviderConfig,
  maskKey,
} from "./use-provider-config"

// Capability to icon mapping
const CAPABILITY_ICON: Record<"text" | "image" | "embedding" | "mmEmbedding", any> = {
  text: FileText,
  image: ImageIcon,
  embedding: Network,
  mmEmbedding: Scan,
}

function CapabilityPills({ supports }: { supports: ProviderSupport }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {Object.entries(supports).map(([key, supported]) => {
        const k = key as keyof ProviderSupport
        const label =
          k === "text"
            ? "Text"
            : k === "image"
              ? "Image"
              : k === "embedding"
                ? "Text Embedding"
                : "Multimodal Embedding"
        const IconComponent = CAPABILITY_ICON[k]
        return (
          <TooltipProvider key={k}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs",
                    supported ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
                  )}
                  aria-label={`${label} ${supported ? "supported" : "not supported"}`}
                >
                  {IconComponent && <IconComponent className="size-4" aria-hidden="true" />}
                  <span className="leading-none">{label}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">{supported ? "Supported" : "Not supported"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      })}
    </div>
  )
}

function ProviderRow({ provider }: { provider: ProviderKey }) {
  const { state, setApiKey, clearApiKey, setCapability, isConnected } = useProviderConfig()
  const meta = PROVIDERS_META[provider]
  const config = state[provider]
  const connected = isConnected(provider)

  const [tempKey, setTempKey] = useState<string>(config?.apiKey || "")

  const toggles: Array<{ key: Capability; label: string }> = useMemo(
    () => [
      { key: "columnGeneration", label: "Column Generation" },
      { key: "text", label: "Text Generation" },
      { key: "image", label: "Image Generation" },
      { key: "embedding", label: "Text Embedding" },
      { key: "mmEmbedding", label: "Multimodal Embedding" },
    ],
    [],
  )

  const saveKey = () => {
    if (!meta.needsApiKey) return
    setApiKey(provider, tempKey.trim())
  }

  const disabledReason = (cap: Capability) => {
    // toggle disabled if provider doesn't support or lacks key (for key-based providers)
    if (cap === "columnGeneration") {
      // columnGeneration is an app-level feature built on text gen; require text support & connection
      if (!meta.supports.text) return "Requires text generation support"
      if (meta.needsApiKey && !connected) return "Enter API key first"
      return null
    }
    const supported = meta.supports[cap as keyof ProviderSupport] ?? false
    if (!supported) return "Not supported by this provider"
    if (meta.needsApiKey && !connected) return "Enter API key first"
    return null
  }

  return (
    <AccordionItem value={provider}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex w-full items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{meta.label}</span>
              {meta.freeTier && (
                <Badge variant="secondary" className="rounded px-2 py-0.5">
                  Free Tier
                </Badge>
              )}
            </div>
            <div className="mt-2">
              <CapabilityPills supports={meta.supports} />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {connected ? (
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-green-600" aria-hidden="true" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Circle className="size-4" aria-hidden="true" />
                Not connected
              </span>
            )}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <Card className="border-border bg-card text-card-foreground p-4">
          {meta.needsApiKey ? (
            <div className="flex flex-col gap-3">
              <div className="grid gap-2">
                <Label htmlFor={`${provider}-key`} className="flex items-center gap-2">
                  <KeyRound className="size-4" aria-hidden="true" />
                  API Key
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`${provider}-key`}
                    type="password"
                    placeholder="Enter API key"
                    value={tempKey}
                    onChange={(e) => setTempKey(e.target.value)}
                    className="bg-background"
                    aria-label={`${meta.label} API Key`}
                  />
                  <Button variant="secondary" onClick={saveKey} disabled={!tempKey.trim()}>
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setTempKey("")
                      clearApiKey(provider)
                    }}
                  >
                    Clear
                  </Button>
                </div>
                {config?.apiKey && (
                  <p className="text-xs text-muted-foreground">Stored locally as: {maskKey(config.apiKey)}</p>
                )}
              </div>
              <Separator />
              {!connected ? (
                <div className="text-sm text-muted-foreground">Save your API key to configure activities.</div>
              ) : (
                <div className="grid gap-3">
                  <span className="text-sm font-medium">Enable activities</span>
                  {/* Generation row: Text, Image */}
                  <div className="flex flex-wrap items-center gap-2">
                    {(["text", "image"] as Capability[]).map((key) => {
                      const label = key === "text" ? "Text Generation" : "Image Generation"
                      const reason = disabledReason(key)
                      const disabled = Boolean(reason)
                      const enabled = Boolean(config?.enabled?.[key])

                      const ButtonInner = (
                        <Button
                          key={key}
                          size="sm"
                          variant={enabled ? "default" : "outline"}
                          aria-pressed={enabled}
                          aria-label={`${label} button`}
                          disabled={disabled}
                          onClick={() => setCapability(provider, key, !enabled)}
                        >
                          {label}
                        </Button>
                      )

                      return disabled ? (
                        <TooltipProvider key={key}>
                          <Tooltip>
                            <TooltipTrigger asChild>{ButtonInner}</TooltipTrigger>
                            <TooltipContent side="top">{reason}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        ButtonInner
                      )
                    })}
                  </div>

                  {/* Embeddings row: Text Embedding, Multimodal Embedding */}
                  <div className="flex flex-wrap items-center gap-2">
                    {(["embedding", "mmEmbedding"] as Capability[]).map((key) => {
                      const label = key === "embedding" ? "Text Embedding" : "Multimodal Embedding"
                      const reason = disabledReason(key)
                      const disabled = Boolean(reason)
                      const enabled = Boolean(config?.enabled?.[key])

                      const ButtonInner = (
                        <Button
                          key={key}
                          size="sm"
                          variant={enabled ? "default" : "outline"}
                          aria-pressed={enabled}
                          aria-label={`${label} button`}
                          disabled={disabled}
                          onClick={() => setCapability(provider, key, !enabled)}
                        >
                          {label}
                        </Button>
                      )

                      return disabled ? (
                        <TooltipProvider key={key}>
                          <Tooltip>
                            <TooltipTrigger asChild>{ButtonInner}</TooltipTrigger>
                            <TooltipContent side="top">{reason}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        ButtonInner
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Shield className="size-4" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  Local providers do not require API keys. Configure capabilities based on your local setup.
                </p>
              </div>
              <Separator />
              <div className="grid gap-3">
                <span className="text-sm font-medium">Enable activities</span>
                {/* Generation row */}
                <div className="flex flex-wrap items-center gap-4">
                  {(["text", "image"] as Capability[]).map((cap) => {
                    const label = cap === "text" ? "Text Generation" : "Image Generation"
                    const supported = PROVIDERS_META[provider].supports[cap as keyof ProviderSupport] ?? false
                    const disabled = !supported
                    const enabled = Boolean(state[provider]?.enabled?.[cap])

                    const ButtonInner = (
                      <Button
                        key={cap}
                        size="sm"
                        variant={enabled ? "default" : "outline"}
                        aria-pressed={enabled}
                        aria-label={`${label} button`}
                        disabled={disabled}
                        onClick={() => setCapability(provider, cap, !enabled)}
                      >
                        {label}
                      </Button>
                    )

                    return disabled ? (
                      <TooltipProvider key={cap}>
                        <Tooltip>
                          <TooltipTrigger asChild>{ButtonInner}</TooltipTrigger>
                          <TooltipContent side="top">{disabledReason(cap)}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      ButtonInner
                    )
                  })}
                </div>
                {/* Embeddings row */}
                <div className="flex flex-wrap items-center gap-4">
                  {(["embedding", "mmEmbedding"] as Capability[]).map((cap) => {
                    const label = cap === "embedding" ? "Text Embedding" : "Multimodal Embedding"
                    const supported = PROVIDERS_META[provider].supports[cap as keyof ProviderSupport] ?? false
                    const disabled = !supported
                    const enabled = Boolean(state[provider]?.enabled?.[cap])

                    const ButtonInner = (
                      <Button
                        key={cap}
                        size="sm"
                        variant={enabled ? "default" : "outline"}
                        aria-pressed={enabled}
                        aria-label={`${label} button`}
                        disabled={disabled}
                        onClick={() => setCapability(provider, cap, !enabled)}
                      >
                        {label}
                      </Button>
                    )

                    return disabled ? (
                      <TooltipProvider key={cap}>
                        <Tooltip>
                          <TooltipTrigger asChild>{ButtonInner}</TooltipTrigger>
                          <TooltipContent side="top">{disabledReason(cap)}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      ButtonInner
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </Card>
      </AccordionContent>
    </AccordionItem>
  )
}

export function AIProviderConfigButton({ className }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className={cn("bg-primary text-primary-foreground hover:opacity-90", className)}>
          Configure AI Providers
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl bg-popover text-popover-foreground">
        <DialogHeader>
          <DialogTitle className="text-balance">Configure AI Providers</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              <p className="text-pretty">
                Connect your preferred AI providers and enable the capabilities you want to use.
              </p>
              <div className="rounded-md bg-muted p-3 text-sm">
                <ul className="list-disc pl-5 space-y-1">
                  <li>Your API keys are stored locally in your browser.</li>
                  <li>API keys are never sent to our servers.</li>
                  <li>All processing happens directly between your browser and the AI provider.</li>
                </ul>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Accordion type="single" collapsible className="w-full">
            {(Object.keys(PROVIDERS_META) as ProviderKey[]).map((p) => (
              <ProviderRow key={p} provider={p} />
            ))}
          </Accordion>
        </div>

        <DialogFooter className="sm:justify-between">
          <div className="text-xs text-muted-foreground">
            Providers with a free tier: HuggingFace, Google AI, Cohere, Mistral
          </div>
          <Button variant="secondary">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
