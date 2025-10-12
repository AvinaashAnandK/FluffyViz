import { serializePrompt, hydrateDocumentFromTemplate, extractVariables } from '../prompt-serializer'
import { ColumnMeta } from '../prompt-serializer'

describe('prompt-serializer', () => {
  describe('hydrateDocumentFromTemplate', () => {
    it('should create empty document for empty template', () => {
      const doc = hydrateDocumentFromTemplate('', [])
      expect(doc.type).toBe('doc')
      expect(doc.content).toHaveLength(1)
      expect(doc.content?.[0].type).toBe('paragraph')
    })

    it('should parse template with single variable', () => {
      const template = 'Translate {{input}} to English'
      const variables = [
        {
          id: 'input',
          display_name: 'Input Text',
          slug: 'input',
          tooltip: 'Text to translate',
          required: true,
        },
      ]

      const doc = hydrateDocumentFromTemplate(template, variables)
      expect(doc.type).toBe('doc')
      expect(doc.content).toHaveLength(1)

      const paragraph = doc.content?.[0]
      expect(paragraph?.type).toBe('paragraph')
      expect(paragraph?.content).toHaveLength(3) // text + variable + text

      expect(paragraph?.content?.[0].type).toBe('text')
      expect(paragraph?.content?.[0].text).toBe('Translate ')
      expect(paragraph?.content?.[1].type).toBe('variableNode')
      expect(paragraph?.content?.[2].type).toBe('text')
      expect(paragraph?.content?.[2].text).toBe(' to English')
    })

    it('should parse template with multiple variables', () => {
      const template = 'Classify {{input}} into {{categories}}.'
      const variables = [
        {
          id: 'input',
          display_name: 'Input',
          slug: 'input',
          tooltip: 'Text to classify',
          required: true,
        },
        {
          id: 'categories',
          display_name: 'Categories',
          slug: 'categories',
          tooltip: 'List of categories',
          required: true,
        },
      ]

      const doc = hydrateDocumentFromTemplate(template, variables)
      const paragraph = doc.content?.[0]
      expect(paragraph?.content).toHaveLength(5) // text + var + text + var + text
      expect(paragraph?.content?.[4].text).toBe('.')
    })
  })

  describe('serializePrompt', () => {
    it('should serialize document with mapped variables', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Translate ' },
              {
                type: 'variableNode',
                attrs: {
                  id: 'var1',
                  displayName: 'Input',
                  tooltip: 'Input text',
                  required: true,
                  defaultValue: null,
                  mappedColumnId: 'col1',
                  mappedColumnName: 'User Message',
                  mappedColumnSlug: 'user_message',
                },
              },
            ],
          },
        ],
      }

      const mappings: Record<string, ColumnMeta> = {
        var1: {
          id: 'col1',
          slug: 'user_message',
          displayName: 'User Message',
          preview: 'Hello',
        },
      }

      const result = serializePrompt(doc, mappings)
      expect(result.prompt).toBe('Translate {{user_message}}')
      expect(result.unmappedVariables).toHaveLength(0)
      expect(result.isValid).toBe(true)
      expect(result.mappedVariableCount).toBe(1)
      expect(result.totalVariableCount).toBe(1)
    })

    it('should detect unmapped variables', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'variableNode',
                attrs: {
                  id: 'var1',
                  displayName: 'Input',
                  tooltip: 'Input text',
                  required: true,
                  defaultValue: null,
                  mappedColumnId: null,
                  mappedColumnName: null,
                  mappedColumnSlug: null,
                },
              },
            ],
          },
        ],
      }

      const result = serializePrompt(doc, {})
      expect(result.unmappedVariables).toHaveLength(1)
      expect(result.unmappedVariables[0].displayName).toBe('Input')
      expect(result.isValid).toBe(false)
      expect(result.mappedVariableCount).toBe(0)
      expect(result.totalVariableCount).toBe(1)
    })

    it('should handle multiline prompts', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Line 1' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Line 2' }],
          },
        ],
      }

      const result = serializePrompt(doc, {})
      expect(result.prompt).toBe('Line 1\nLine 2')
      expect(result.totalVariableCount).toBe(0)
      expect(result.mappedVariableCount).toBe(0)
    })

    it('should preserve hard breaks inside paragraphs', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'First line' },
              { type: 'hardBreak' },
              { type: 'text', text: 'Second line' },
            ],
          },
        ],
      }

      const result = serializePrompt(doc, {})
      expect(result.prompt).toBe('First line\nSecond line')
      expect(result.totalVariableCount).toBe(0)
    })

    it('should fall back to default values for optional variables', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Translate to ' },
              {
                type: 'variableNode',
                attrs: {
                  id: 'var1',
                  displayName: 'Language',
                  tooltip: 'Target language',
                  required: false,
                  defaultValue: 'English',
                  mappedColumnId: null,
                  mappedColumnName: 'English',
                  mappedColumnSlug: null,
                },
              },
            ],
          },
        ],
      }

      const result = serializePrompt(doc, {})
      expect(result.prompt).toBe('Translate to English')
      expect(result.unmappedVariables).toHaveLength(0)
      expect(result.isValid).toBe(true)
      expect(result.mappedVariableCount).toBe(0)
      expect(result.totalVariableCount).toBe(1)
    })
  })

  describe('extractVariables', () => {
    it('should extract all variable nodes from document', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'variableNode',
                attrs: {
                  id: 'var1',
                  displayName: 'Var 1',
                  tooltip: 'First variable',
                  mappedColumnId: null,
                  mappedColumnName: null,
                },
              },
              {
                type: 'variableNode',
                attrs: {
                  id: 'var2',
                  displayName: 'Var 2',
                  tooltip: 'Second variable',
                  mappedColumnId: null,
                  mappedColumnName: null,
                },
              },
            ],
          },
        ],
      }

      const variables = extractVariables(doc)
      expect(variables).toHaveLength(2)
      expect(variables[0].id).toBe('var1')
      expect(variables[1].id).toBe('var2')
    })
  })
})
