import { Model, ModelProvider } from '@/types/models'
import type { WebSearchConfig } from '@/types/web-search'

export interface Column {
  id: string
  name: string
  type: string
  visible: boolean
  model?: Model
  provider?: ModelProvider
  prompt?: string
  webSearch?: WebSearchConfig
}

export interface SpreadsheetData {
  [key: string]: any
}
