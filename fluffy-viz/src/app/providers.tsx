'use client'

import { ProviderConfigProvider } from '@/hooks/use-provider-config'
import { loadModelRegistry } from '@/config/model-registry'
import type { ReactNode } from 'react'
import { useEffect } from 'react'

export function AppProviders({ children }: { children: ReactNode }) {
  // Load model registry on app start
  useEffect(() => {
    loadModelRegistry().catch(error => {
      console.error('Failed to load model registry:', error)
    })
  }, [])

  return <ProviderConfigProvider>{children}</ProviderConfigProvider>
}
