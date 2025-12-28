/**
 * API route for cluster labeling using LLM
 * Generates title, labels, and description for a cluster based on sample conversations
 * Supports multiple prompt types: cluster_label, super_topic_label, super_topic_validation
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { generateCompletion } from '@/lib/ai-inference'
import {
  getProviderApiKey,
  isProviderEnabled,
  type ProviderKey,
} from '@/config/provider-settings'
import { loadProviderSettingsServer } from '@/lib/provider-config-server'
import { loadModelRegistryServer, getModelById } from '@/lib/model-registry-server'

// Types for cluster labeling
export interface ClusterSample {
  user_message: string
  assistant_message: string
}

export interface ClusterLabelRequest {
  clusterId: number
  samples: ClusterSample[]
  providerId?: string  // Default: 'openai'
  modelId?: string     // Default: 'gpt-5.2'
  promptType?: 'cluster_label' | 'super_topic_label' | 'super_topic_validation' | 'singleton_analysis'
  // Additional context for super-topic prompts
  context?: {
    threshold?: number
    linkage?: string
    clusterCount?: number
    clusterSummaries?: string
    clusterDetails?: string
    samplesByCluster?: string
    superTopicId?: number
    superTopics?: string
    clusterTitle?: string
    clusterLabels?: string
    clusterDescription?: string
    clusterSize?: number
  }
}

export interface ClusterLabelResult {
  title: string
  labels: string[]
  description: string
}

// Prompt configuration from YAML
interface PromptConfig {
  name: string
  description: string
  temperature: number
  max_tokens: number
  prompt: string
}

interface ClusterLabelingPrompts {
  cluster_label: PromptConfig
  super_topic_label: PromptConfig
  super_topic_validation: PromptConfig
  singleton_analysis: PromptConfig
}

// Cache for loaded prompts
let promptsCache: ClusterLabelingPrompts | null = null

async function loadPrompts(): Promise<ClusterLabelingPrompts> {
  if (promptsCache) {
    return promptsCache
  }

  const promptsPath = path.join(process.cwd(), 'src/config/prompts/cluster-labeling.yaml')
  const fileContents = await fs.readFile(promptsPath, 'utf8')
  const config = yaml.load(fileContents) as ClusterLabelingPrompts

  promptsCache = config
  return config
}

function formatSamples(samples: ClusterSample[]): string {
  return samples.map((sample, index) =>
    `### Sample ${index + 1}
User: ${sample.user_message}
Assistant: ${sample.assistant_message}`
  ).join('\n\n')
}

function interpolatePrompt(
  template: string,
  clusterId: number,
  samples: ClusterSample[],
  context?: ClusterLabelRequest['context']
): string {
  let prompt = template
    .replace(/\{\{SAMPLE_COUNT\}\}/g, String(samples.length))
    .replace(/\{\{CLUSTER_ID\}\}/g, String(clusterId))
    .replace(/\{\{SAMPLES\}\}/g, formatSamples(samples))

  // Interpolate additional context if provided
  if (context) {
    if (context.threshold !== undefined) {
      prompt = prompt.replace(/\{\{THRESHOLD\}\}/g, String(context.threshold))
    }
    if (context.linkage) {
      prompt = prompt.replace(/\{\{LINKAGE\}\}/g, context.linkage)
    }
    if (context.clusterCount !== undefined) {
      prompt = prompt.replace(/\{\{CLUSTER_COUNT\}\}/g, String(context.clusterCount))
    }
    if (context.clusterSummaries) {
      prompt = prompt.replace(/\{\{CLUSTER_SUMMARIES\}\}/g, context.clusterSummaries)
    }
    if (context.clusterDetails) {
      prompt = prompt.replace(/\{\{CLUSTER_DETAILS\}\}/g, context.clusterDetails)
    }
    if (context.samplesByCluster) {
      prompt = prompt.replace(/\{\{SAMPLES_BY_CLUSTER\}\}/g, context.samplesByCluster)
    }
    if (context.superTopicId !== undefined) {
      prompt = prompt.replace(/\{\{SUPER_TOPIC_ID\}\}/g, String(context.superTopicId))
    }
    if (context.superTopics) {
      prompt = prompt.replace(/\{\{SUPER_TOPICS\}\}/g, context.superTopics)
    }
    if (context.clusterTitle) {
      prompt = prompt.replace(/\{\{CLUSTER_TITLE\}\}/g, context.clusterTitle)
    }
    if (context.clusterLabels) {
      prompt = prompt.replace(/\{\{CLUSTER_LABELS\}\}/g, context.clusterLabels)
    }
    if (context.clusterDescription) {
      prompt = prompt.replace(/\{\{CLUSTER_DESCRIPTION\}\}/g, context.clusterDescription)
    }
    if (context.clusterSize !== undefined) {
      prompt = prompt.replace(/\{\{CLUSTER_SIZE\}\}/g, String(context.clusterSize))
    }
  }

  return prompt
}

export async function POST(req: NextRequest) {
  try {
    const {
      clusterId,
      samples,
      providerId = 'openai',
      modelId = 'gpt-5.2',
      promptType = 'cluster_label',
      context,
    }: ClusterLabelRequest = await req.json()

    console.log('[Cluster Label] Request:', {
      clusterId,
      sampleCount: samples?.length,
      providerId,
      modelId,
      promptType,
    })

    // Validate required fields
    if (clusterId === undefined || !samples || !Array.isArray(samples)) {
      return NextResponse.json(
        { error: 'Missing required fields: clusterId, samples' },
        { status: 400 }
      )
    }

    if (samples.length === 0) {
      return NextResponse.json(
        { error: 'samples must be a non-empty array' },
        { status: 400 }
      )
    }

    // Load prompts from YAML
    const prompts = await loadPrompts()
    const promptConfig = prompts[promptType]

    if (!promptConfig) {
      return NextResponse.json(
        { error: `Unknown prompt type: ${promptType}` },
        { status: 400 }
      )
    }

    // Load provider config (server-side)
    const config = await loadProviderSettingsServer()

    // Load model registry (server-side)
    await loadModelRegistryServer()

    // Validate provider is enabled
    if (!isProviderEnabled(config, providerId as ProviderKey)) {
      return NextResponse.json(
        { error: `Provider ${providerId} is not enabled or configured` },
        { status: 400 }
      )
    }

    // Get API key
    const apiKey = getProviderApiKey(config, providerId as ProviderKey)
    if (!apiKey) {
      return NextResponse.json(
        { error: `No API key configured for provider ${providerId}` },
        { status: 400 }
      )
    }

    // Get model config
    const modelConfig = getModelById(modelId)
    if (!modelConfig) {
      console.warn(`[Cluster Label] Model ${modelId} not found in registry, using defaults`)
    }

    // Build the prompt from YAML template
    const prompt = interpolatePrompt(promptConfig.prompt, clusterId, samples, context)

    console.log('[Cluster Label] Calling LLM with prompt length:', prompt.length)

    // Call the LLM
    const result = await generateCompletion({
      model: { id: modelId, name: modelId },
      provider: { id: providerId, name: providerId, displayName: providerId, apiKey },
      prompt,
      temperature: promptConfig.temperature,
      maxTokens: promptConfig.max_tokens,
    }, modelConfig)

    if (result.error) {
      console.error('[Cluster Label] LLM error:', result.error)
      return NextResponse.json(
        { error: result.error, errorType: result.errorType },
        { status: 500 }
      )
    }

    // Parse the JSON response
    try {
      // Clean up the response (remove markdown code fences if present)
      let content = result.content.trim()
      if (content.startsWith('```json')) {
        content = content.slice(7)
      } else if (content.startsWith('```')) {
        content = content.slice(3)
      }
      if (content.endsWith('```')) {
        content = content.slice(0, -3)
      }
      content = content.trim()

      const labelResult = JSON.parse(content)

      // Validate the structure based on prompt type
      if (promptType === 'cluster_label') {
        if (!labelResult.title || !Array.isArray(labelResult.labels) || !labelResult.description) {
          throw new Error('Invalid response structure: missing title, labels, or description')
        }
      }

      console.log('[Cluster Label] Success:', {
        promptType,
        title: labelResult.title,
        labelCount: labelResult.labels?.length,
      })

      return NextResponse.json({
        clusterId,
        promptType,
        ...labelResult,
      })
    } catch (parseError) {
      console.error('[Cluster Label] Failed to parse LLM response:', result.content)
      return NextResponse.json(
        { error: 'Failed to parse LLM response as JSON', raw: result.content },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[Cluster Label] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
