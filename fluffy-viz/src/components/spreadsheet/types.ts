import { Model, ModelProvider } from '@/types/models'

export interface Column {
  id: string
  name: string
  type: string
  visible: boolean
  model?: Model
  provider?: ModelProvider
  prompt?: string
  searchWeb?: boolean
}

export interface SpreadsheetData {
  [key: string]: any
}
