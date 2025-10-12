import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { validateProviderConfig } from '@/config/provider-settings'

const CONFIG_FILE = 'provider-config.json'

/**
 * Get the path to the provider config file (in project root)
 */
function getConfigPath(): string {
  return path.join(process.cwd(), CONFIG_FILE)
}

/**
 * GET /api/provider-config
 * Read provider configuration from filesystem
 */
export async function GET() {
  try {
    const configPath = getConfigPath()

    // Check if file exists
    try {
      await fs.access(configPath)
    } catch {
      // File doesn't exist, return 404
      return NextResponse.json(
        {
          error: 'Provider configuration not found',
          message: `Copy ${CONFIG_FILE}.example to ${CONFIG_FILE} and add your API keys`,
        },
        { status: 404 }
      )
    }

    // Read and parse config file
    const fileContents = await fs.readFile(configPath, 'utf8')
    const config = JSON.parse(fileContents)

    // Validate structure
    validateProviderConfig(config)

    return NextResponse.json(config)
  } catch (error) {
    console.error('Error reading provider config:', error)

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in provider configuration file' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to read provider configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/provider-config
 * Write provider configuration to filesystem
 */
export async function POST(request: NextRequest) {
  try {
    const config = await request.json()

    // Validate configuration
    validateProviderConfig(config)

    // Write to file with pretty printing
    const configPath = getConfigPath()
    const jsonContent = JSON.stringify(config, null, 2)
    await fs.writeFile(configPath, jsonContent, 'utf8')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error writing provider config:', error)

    return NextResponse.json(
      {
        error: 'Failed to save provider configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/provider-config
 * Reset configuration by deleting the file
 */
export async function DELETE() {
  try {
    const configPath = getConfigPath()

    try {
      await fs.unlink(configPath)
      return NextResponse.json({ success: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, that's fine
        return NextResponse.json({ success: true })
      }
      throw error
    }
  } catch (error) {
    console.error('Error deleting provider config:', error)

    return NextResponse.json(
      {
        error: 'Failed to delete provider configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
