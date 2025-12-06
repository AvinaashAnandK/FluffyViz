'use client'

import { useEffect } from 'react'
import { completelyResetDatabase } from '@/lib/duckdb'

/**
 * Development tools component
 * Exposes utilities to the browser console for debugging
 */
export function DevTools() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Expose database reset to console
      (window as any).resetDuckDB = async () => {
        try {
          console.log('🔄 Resetting database...')
          await completelyResetDatabase()
          console.log('✅ Database reset complete! Please refresh the page.')
          // Auto refresh after 1 second
          setTimeout(() => {
            window.location.reload()
          }, 1000)
        } catch (error) {
          console.error('❌ Database reset failed:', error)
        }
      }

      console.log('🛠️ Dev Tools loaded. Available commands:')
      console.log('  - window.resetDuckDB() - Reset database and clear all data')
    }
  }, [])

  return null
}
