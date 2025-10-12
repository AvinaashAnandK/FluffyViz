/**
 * API route to serve model registry
 * Loads YAML from server-side config and returns JSON
 */

import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import yaml from 'js-yaml'

export async function GET() {
  try {
    // Read YAML from server-side config directory
    const yamlPath = join(process.cwd(), 'src', 'config', 'models', 'model-registry.yaml')
    const yamlText = await readFile(yamlPath, 'utf-8')

    // Parse YAML to JSON
    const data = yaml.load(yamlText)

    // Return as JSON
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error loading model registry:', error)
    return NextResponse.json(
      {
        error: 'Failed to load model registry',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
