import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { COLUMN_TEMPLATES } from '@/config/ai-column-templates'
import type { PromptConfig } from '@/config/ai-column-templates'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params
    const template = COLUMN_TEMPLATES[templateId]

    if (!template) {
      return NextResponse.json(
        { error: `Template ${templateId} not found` },
        { status: 404 }
      )
    }

    // Remove leading slash from promptFile if present
    const promptFilePath = template.promptFile.startsWith('/')
      ? template.promptFile.substring(1)
      : template.promptFile
    const yamlPath = path.join(process.cwd(), 'src', promptFilePath)
    const fileContents = fs.readFileSync(yamlPath, 'utf8')
    const config = yaml.load(fileContents) as PromptConfig

    return NextResponse.json(config)
  } catch (error) {
    console.error('Error loading prompt config:', error)
    return NextResponse.json(
      { error: 'Failed to load prompt configuration' },
      { status: 500 }
    )
  }
}
