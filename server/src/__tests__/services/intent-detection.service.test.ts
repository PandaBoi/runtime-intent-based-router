import { intentDetectionService } from '../../services/intent-detection.service'
import { IntentType } from '../../types'

describe('IntentDetectionService', () => {
  beforeAll(async () => {
    // Only initialize if we have API key for integration tests
    if (process.env.INWORLD_API_KEY) {
      await intentDetectionService.initialize()
    }
  })

  afterAll(async () => {
    await intentDetectionService.disconnect()
  })

  describe('Chat Intent Detection', () => {
    const chatInputs = [
      'Hello, how are you?',
      'What is the weather like today?',
      'Can you help me with something?',
      'Tell me a joke',
      'What time is it?'
    ]

    test.each(chatInputs)('should detect chat intent for: "%s"', async (input) => {
      if (!process.env.INWORLD_API_KEY) {
        console.log('Skipping integration test - no INWORLD_API_KEY'); return
      }

      const result = await intentDetectionService.detectIntent(input)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.intent).toBe(IntentType.CHAT)
      expect(result.data.confidence).toBeGreaterThan(0.8)
      expect(result.data.extractedParams.prompt).toBe(input)
    })
  })

  describe('Image Generation Intent Detection', () => {
    const imageGenInputs = [
      'Generate an image of a sunset',
      'Create a picture of a cat',
      'Make an artwork of a mountain',
      'Draw a house by the lake',
      'Generate a photo of flowers'
    ]

    test.each(imageGenInputs)('should detect generate-image intent for: "%s"', async (input) => {
      if (!process.env.INWORLD_API_KEY) {
        console.log('Skipping integration test - no INWORLD_API_KEY'); return
      }

      const result = await intentDetectionService.detectIntent(input)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.intent).toBe(IntentType.GENERATE_IMAGE)
      expect(result.data.confidence).toBeGreaterThan(0.8)
      expect(result.data.extractedParams.prompt).toContain('of')
    })
  })

  describe('Image Editing Intent Detection', () => {
    const imageEditInputs = [
      'Make this photo brighter',
      'Enhance the colors in this image',
      'Crop this picture',
      'Remove the background from this photo',
      'Blur the edges of this image'
    ]

    test.each(imageEditInputs)('should detect edit-image intent for: "%s"', async (input) => {
      if (!process.env.INWORLD_API_KEY) {
        console.log('Skipping integration test - no INWORLD_API_KEY'); return
      }

      const result = await intentDetectionService.detectIntent(input)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.intent).toBe(IntentType.EDIT_IMAGE)
      expect(result.data.confidence).toBeGreaterThan(0.8)
      expect(result.data.extractedParams.editInstructions).toBeDefined()
    })
  })

  describe('Service Health', () => {
    test('should report healthy status when initialized', async () => {
      if (!process.env.INWORLD_API_KEY) {
        console.log('Skipping integration test - no INWORLD_API_KEY'); return
      }

      const isHealthy = await intentDetectionService.healthCheck()
      expect(isHealthy).toBe(true)
    })

    test('should handle initialization errors gracefully', async () => {
      // Test with invalid configuration
      const tempApiKey = process.env.INWORLD_API_KEY
      delete process.env.INWORLD_API_KEY

      await expect(intentDetectionService.initialize()).rejects.toThrow()

      // Restore for other tests
      if (tempApiKey) {
        process.env.INWORLD_API_KEY = tempApiKey
      }
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty input', async () => {
      if (!process.env.INWORLD_API_KEY) {
        console.log('Skipping integration test - no INWORLD_API_KEY')
        return
      }

      const result = await intentDetectionService.detectIntent('')

      expect(result.success).toBe(true)
      expect(result.data.intent).toBe(IntentType.CHAT) // Should fallback to chat
    })

    test('should handle very long input', async () => {
      if (!process.env.INWORLD_API_KEY) {
        console.log('Skipping integration test - no INWORLD_API_KEY')
        return
      }

      const longInput = 'Generate an image '.repeat(100) + 'of a sunset'
      const result = await intentDetectionService.detectIntent(longInput)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    test('should handle ambiguous input', async () => {
      if (!process.env.INWORLD_API_KEY) {
        console.log('Skipping integration test - no INWORLD_API_KEY')
        return
      }

      const ambiguousInput = 'Show me'
      const result = await intentDetectionService.detectIntent(ambiguousInput)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      // Any intent is acceptable for ambiguous input
      expect(Object.values(IntentType)).toContain(result.data.intent)
    })
  })
})
