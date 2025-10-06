import { interpolatePromptForRow } from '../ai-inference'

describe('ai-inference', () => {
  describe('interpolatePromptForRow', () => {
    it('should replace single variable with row value', () => {
      const template = 'Translate {{user_message}} to English'
      const row = { user_message: 'Bonjour' }

      const result = interpolatePromptForRow(template, row)
      expect(result).toBe('Translate Bonjour to English')
    })

    it('should replace multiple variables with row values', () => {
      const template = 'Classify {{text}} into {{categories}}'
      const row = {
        text: 'This is great!',
        categories: 'positive, negative, neutral',
      }

      const result = interpolatePromptForRow(template, row)
      expect(result).toBe('Classify This is great! into positive, negative, neutral')
    })

    it('should handle null values', () => {
      const template = 'Process {{data}}'
      const row = { data: null }

      const result = interpolatePromptForRow(template, row)
      expect(result).toBe('Process (empty)')
    })

    it('should handle undefined values', () => {
      const template = 'Process {{missing}}'
      const row = {}

      const result = interpolatePromptForRow(template, row)
      expect(result).toBe('Process (empty)')
    })

    it('should handle numeric values', () => {
      const template = 'The score is {{score}}'
      const row = { score: 95 }

      const result = interpolatePromptForRow(template, row)
      expect(result).toBe('The score is 95')
    })

    it('should handle boolean values', () => {
      const template = 'Is active: {{active}}'
      const row = { active: true }

      const result = interpolatePromptForRow(template, row)
      expect(result).toBe('Is active: true')
    })

    it('should handle multiline templates', () => {
      const template = `Translate the following text:

{{input}}

Target language: {{language}}`
      const row = {
        input: 'Hello world',
        language: 'Spanish',
      }

      const result = interpolatePromptForRow(template, row)
      expect(result).toContain('Hello world')
      expect(result).toContain('Spanish')
    })

    it('should not replace variables with single braces', () => {
      const template = 'Use {single} braces but {{double}} works'
      const row = { single: 'X', double: 'Y' }

      const result = interpolatePromptForRow(template, row)
      expect(result).toBe('Use {single} braces but Y works')
    })
  })
})
