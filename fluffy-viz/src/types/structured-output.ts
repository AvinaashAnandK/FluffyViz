/**
 * Type definitions for structured output feature
 */

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array_string'
  | 'array_number'
  | 'array_object'
  | 'object'
  | 'enum'

export interface FieldSchema {
  id: string
  name: string
  type: FieldType
  description?: string
  required: boolean
  enumOptions?: string[]
  minItems?: number
  maxItems?: number
}

export type ColumnExpansionMode = 'single' | 'expanded' | 'both'

export interface OutputSchema {
  mode: 'text' | 'structured'
  fields: FieldSchema[]
  expansionMode?: ColumnExpansionMode // How to create columns from structured output
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  string: 'String',
  number: 'Number',
  boolean: 'Boolean',
  array_string: 'Array of Strings',
  array_number: 'Array of Numbers',
  array_object: 'Array of Objects',
  object: 'Object',
  enum: 'Enum'
}

export const FIELD_TYPE_DESCRIPTIONS: Record<FieldType, string> = {
  string: 'A text value',
  number: 'A numeric value (integer or decimal)',
  boolean: 'True or false',
  array_string: 'A list of text values',
  array_number: 'A list of numbers',
  array_object: 'A list of objects',
  object: 'A nested object structure',
  enum: 'One of a predefined set of values'
}
