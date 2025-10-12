/**
 * Server-side provider configuration utilities
 * DO NOT IMPORT IN CLIENT CODE - use provider-settings.ts instead
 */

import { readFile } from 'fs/promises'
import { join } from 'path'
import {
  validateProviderConfig,
  createEmptyConfig,
  ProviderConfigError,
  type ProviderSettings,
} from '@/config/provider-settings'

/**
 * Load provider configuration from filesystem (server-side only)
 * Use this in API routes and server components
 */
export async function loadProviderSettingsServer(): Promise<ProviderSettings> {
  try {
    const configPath = join(process.cwd(), 'provider-config.json')

    try {
      const fileContents = await readFile(configPath, 'utf8')
      const config = JSON.parse(fileContents)
      return validateProviderConfig(config)
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        // File doesn't exist, return empty config
        return createEmptyConfig()
      }
      throw err
    }
  } catch (error) {
    if (error instanceof ProviderConfigError) {
      throw error
    }
    throw new ProviderConfigError(
      `Failed to load provider config: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
