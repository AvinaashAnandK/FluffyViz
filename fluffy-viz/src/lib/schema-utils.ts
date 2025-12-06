/**
 * Utilities for building Zod schemas and formatting schemas for prompts
 */

import { z } from 'zod'
import type { FieldSchema, OutputSchema } from '@/types/structured-output'

/**
 * Build a Zod schema from field definitions
 */
export function buildZodSchema(fields: FieldSchema[]): z.ZodObject<any> {
  const schemaObject: Record<string, z.ZodTypeAny> = {}

  fields.forEach(field => {
    let fieldSchema: z.ZodTypeAny

    switch (field.type) {
      case 'string':
        fieldSchema = z.string()
        if (field.description) {
          fieldSchema = fieldSchema.describe(field.description)
        }
        break

      case 'number':
        fieldSchema = z.number()
        if (field.description) {
          fieldSchema = fieldSchema.describe(field.description)
        }
        break

      case 'boolean':
        fieldSchema = z.boolean()
        if (field.description) {
          fieldSchema = fieldSchema.describe(field.description)
        }
        break

      case 'array_string':
        fieldSchema = z.array(z.string())
        if (field.minItems !== undefined) {
          fieldSchema = (fieldSchema as z.ZodArray<z.ZodString>).min(field.minItems)
        }
        if (field.maxItems !== undefined) {
          fieldSchema = (fieldSchema as z.ZodArray<z.ZodString>).max(field.maxItems)
        }
        if (field.description) {
          fieldSchema = fieldSchema.describe(field.description)
        }
        break

      case 'array_number':
        fieldSchema = z.array(z.number())
        if (field.minItems !== undefined) {
          fieldSchema = (fieldSchema as z.ZodArray<z.ZodNumber>).min(field.minItems)
        }
        if (field.maxItems !== undefined) {
          fieldSchema = (fieldSchema as z.ZodArray<z.ZodNumber>).max(field.maxItems)
        }
        if (field.description) {
          fieldSchema = fieldSchema.describe(field.description)
        }
        break

      case 'array_object':
        // For array of objects, we use a flexible record type
        fieldSchema = z.array(z.record(z.string(), z.unknown()))
        if (field.minItems !== undefined) {
          fieldSchema = (fieldSchema as z.ZodArray<any>).min(field.minItems)
        }
        if (field.maxItems !== undefined) {
          fieldSchema = (fieldSchema as z.ZodArray<any>).max(field.maxItems)
        }
        if (field.description) {
          fieldSchema = fieldSchema.describe(field.description)
        }
        break

      case 'object':
        fieldSchema = z.record(z.string(), z.unknown())
        if (field.description) {
          fieldSchema = fieldSchema.describe(field.description)
        }
        break

      case 'enum':
        if (!field.enumOptions || field.enumOptions.length === 0) {
          throw new Error(`Enum field "${field.name}" requires at least one option`)
        }
        fieldSchema = z.enum(field.enumOptions as [string, ...string[]])
        if (field.description) {
          fieldSchema = fieldSchema.describe(field.description)
        }
        break

      default:
        fieldSchema = z.string()
    }

    // Make optional if not required
    if (!field.required) {
      fieldSchema = fieldSchema.optional()
    }

    schemaObject[field.name] = fieldSchema
  })

  return z.object(schemaObject)
}

/**
 * Generate a human-readable schema format for the prompt
 */
export function schemaToPromptFormat(fields: FieldSchema[]): string {
  const formatField = (field: FieldSchema): string => {
    let typeStr: string
    const constraints: string[] = []

    switch (field.type) {
      case 'string':
        typeStr = 'string'
        break
      case 'number':
        typeStr = 'number'
        break
      case 'boolean':
        typeStr = 'boolean'
        break
      case 'array_string':
        typeStr = '["string", ...]'
        if (field.minItems !== undefined || field.maxItems !== undefined) {
          const min = field.minItems !== undefined ? `min: ${field.minItems}` : ''
          const max = field.maxItems !== undefined ? `max: ${field.maxItems}` : ''
          const arrayConstraint = [min, max].filter(Boolean).join(', ')
          constraints.push(arrayConstraint)
        }
        break
      case 'array_number':
        typeStr = '[number, ...]'
        if (field.minItems !== undefined || field.maxItems !== undefined) {
          const min = field.minItems !== undefined ? `min: ${field.minItems}` : ''
          const max = field.maxItems !== undefined ? `max: ${field.maxItems}` : ''
          const arrayConstraint = [min, max].filter(Boolean).join(', ')
          constraints.push(arrayConstraint)
        }
        break
      case 'array_object':
        typeStr = '[{...}, ...]'
        if (field.minItems !== undefined || field.maxItems !== undefined) {
          const min = field.minItems !== undefined ? `min: ${field.minItems}` : ''
          const max = field.maxItems !== undefined ? `max: ${field.maxItems}` : ''
          const arrayConstraint = [min, max].filter(Boolean).join(', ')
          constraints.push(arrayConstraint)
        }
        break
      case 'object':
        typeStr = '{...}'
        break
      case 'enum':
        if (field.enumOptions && field.enumOptions.length > 0) {
          typeStr = field.enumOptions.map(o => `"${o}"`).join(' | ')
        } else {
          typeStr = 'enum'
        }
        break
      default:
        typeStr = 'unknown'
    }

    // Build the final type string with constraints
    const constraintStr = constraints.length > 0 ? ` (${constraints.join(', ')})` : ''
    const optionalStr = field.required ? '' : ' (optional)'

    return `  "${field.name}": ${typeStr}${constraintStr}${optionalStr}`
  }

  const fieldLines = fields.map(formatField)

  let result = `{
${fieldLines.join(',\n')}
}`

  // Add field descriptions section if any fields have descriptions
  const fieldsWithDescriptions = fields.filter(f => f.description && f.description.trim())
  if (fieldsWithDescriptions.length > 0) {
    const descriptionLines = fieldsWithDescriptions.map(
      f => `- ${f.name}: ${f.description}`
    )
    result += `

Field descriptions:
${descriptionLines.join('\n')}`
  }

  return result
}

/**
 * Generate the full prompt suffix with expected output format
 */
export function generateSchemaPromptSuffix(fields: FieldSchema[]): string {
  const schemaFormat = schemaToPromptFormat(fields)

  return `

Respond with a valid JSON object in exactly this format:
${schemaFormat}

Do not include any text before or after the JSON object.`
}

/**
 * Validate structured output against schema
 */
export function validateStructuredOutput(
  data: unknown,
  schema: z.ZodSchema
): { success: true; data: any } | { success: false; error: string } {
  try {
    const result = schema.safeParse(data)
    if (result.success) {
      return { success: true, data: result.data }
    } else {
      const errorMessages = result.error.issues
        .map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`)
        .join('; ')
      return { success: false, error: errorMessages }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown validation error'
    }
  }
}

/**
 * Parse JSON from LLM response, handling common edge cases
 */
export function parseJSONFromResponse(response: string): { success: true; data: any } | { success: false; error: string } {
  try {
    // Try direct parse first
    const parsed = JSON.parse(response)
    return { success: true, data: parsed }
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim())
        return { success: true, data: parsed }
      } catch {
        // Continue to next approach
      }
    }

    // Try to find JSON object in the response
    const objectMatch = response.match(/\{[\s\S]*\}/)
    if (objectMatch) {
      try {
        const parsed = JSON.parse(objectMatch[0])
        return { success: true, data: parsed }
      } catch {
        // Continue to error
      }
    }

    return {
      success: false,
      error: 'Failed to parse JSON from response'
    }
  }
}

/**
 * Check if an output schema is valid for use
 */
export function isValidOutputSchema(schema: OutputSchema): boolean {
  if (schema.mode !== 'structured') return true
  if (schema.fields.length === 0) return false

  return schema.fields.every(field => {
    if (!field.name || !field.name.trim()) return false
    if (field.type === 'enum' && (!field.enumOptions || field.enumOptions.length === 0)) return false
    return true
  })
}

/**
 * Format a field value for storage in a DuckDB column
 * Arrays are kept as JSON strings for dropdown filtering support
 */
export function formatFieldValueForColumn(value: any, fieldType: FieldSchema['type']): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null
  }

  switch (fieldType) {
    case 'string':
    case 'enum':
      return String(value)

    case 'number':
      return typeof value === 'number' ? value : parseFloat(value) || 0

    case 'boolean':
      return Boolean(value)

    case 'array_string':
    case 'array_number':
      // Keep arrays as JSON strings for DuckDB dropdown filtering
      return JSON.stringify(value)

    case 'array_object':
    case 'object':
      // Stringify complex objects
      return JSON.stringify(value)

    default:
      return String(value)
  }
}

/**
 * Extract field values from a structured output object
 * Returns a map of field names to formatted values
 */
export function extractFieldValues(
  structuredData: Record<string, any>,
  fields: FieldSchema[]
): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {}

  fields.forEach(field => {
    const rawValue = structuredData[field.name]
    result[field.name] = formatFieldValueForColumn(rawValue, field.type)
  })

  return result
}

/**
 * Generate column names for expanded fields
 * Uses the pattern: {baseColumnName}_{fieldName}
 */
export function generateExpandedColumnNames(
  baseColumnName: string,
  fields: FieldSchema[]
): Record<string, string> {
  const columnNames: Record<string, string> = {}

  fields.forEach(field => {
    columnNames[field.name] = `${baseColumnName}_${field.name}`
  })

  return columnNames
}
