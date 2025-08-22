import { imageGenerationService } from '../../services/image-generation.service'
import { sessionManager } from '../../services/session-manager.service'

describe('ImageGenerationService', () => {
  let testSessionId: string

  beforeEach(async () => {
    // Create a test session
    const session = await sessionManager.createSession()
    testSessionId = session.sessionId
  })

  afterEach(() => {
    // Clean up session
    sessionManager.deleteSession(testSessionId)
  })

  describe('Service Initialization', () => {
    test('should initialize successfully', async () => {
      const result = await imageGenerationService.initialize()
      expect(result).toBeUndefined() // No return value expected
    })

    test('should have correct service info', () => {
      const info = imageGenerationService.getServiceInfo()
      expect(info).toHaveProperty('initialized')
      expect(info).toHaveProperty('graphReady')
      expect(info).toHaveProperty('config')
      expect(info).toHaveProperty('capabilities')
      expect(info.capabilities).toHaveProperty('promptEnhancement', true)
      expect(info.capabilities).toHaveProperty('multipleModels', true)
    })

    test('should pass health check after initialization', async () => {
      await imageGenerationService.initialize()
      const isHealthy = await imageGenerationService.healthCheck()
      expect(isHealthy).toBe(true)
    })
  })

  describe('Image Generation', () => {
    beforeEach(async () => {
      await imageGenerationService.initialize()
    })

    test('should generate image with basic prompt', async () => {
      const result = await imageGenerationService.generateImage(
        'A beautiful sunset over mountains',
        testSessionId
      )

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.imageMetadata).toBeDefined()
      expect(result.data?.enhancedPrompt).toBeDefined()
      expect(result.data?.generationTime).toBeGreaterThan(0)
    }, 30000) // 30 second timeout for mock generation

    test('should generate image with quality options', async () => {
      const result = await imageGenerationService.generateImage(
        'A wise old wizard',
        testSessionId,
        { quality: 'fast', width: 512, height: 512 }
      )

      expect(result.success).toBe(true)
      expect(result.data?.imageMetadata).toBeDefined()
      // Fast quality should be relatively quick
      expect(result.data?.generationTime).toBeLessThan(15000)
    }, 20000)

    test('should handle invalid session ID', async () => {
      const result = await imageGenerationService.generateImage(
        'Test prompt',
        'invalid-session-id'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid session ID')
    })

    test('should handle empty prompt', async () => {
      const result = await imageGenerationService.generateImage(
        '',
        testSessionId
      )

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Session Image Management', () => {
    beforeEach(async () => {
      await imageGenerationService.initialize()
    })

    test('should return empty images for new session', async () => {
      const result = await imageGenerationService.getSessionImages(testSessionId)

      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })

    test('should track images after generation', async () => {
      // Generate an image
      await imageGenerationService.generateImage(
        'Test image',
        testSessionId
      )

      // Check session images
      const result = await imageGenerationService.getSessionImages(testSessionId)

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
      expect(result.data?.[0]).toHaveProperty('id')
      expect(result.data?.[0]).toHaveProperty('url')
      expect(result.data?.[0]).toHaveProperty('description')
    }, 30000)

    test('should handle non-existent session', async () => {
      const result = await imageGenerationService.getSessionImages('non-existent')

      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })
  })

  describe('Suggestions', () => {
    test('should provide image generation suggestions', async () => {
      const result = await imageGenerationService.getImageGenerationSuggestions(testSessionId)

      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data?.length).toBeGreaterThan(0)
    })

    test('should provide default suggestions for new session', async () => {
      const result = await imageGenerationService.getImageGenerationSuggestions(testSessionId)

      expect(result.success).toBe(true)
      expect(result.data).toContain('Generate a landscape image')
    })
  })

  describe('Service Lifecycle', () => {
    test('should disconnect gracefully', async () => {
      await imageGenerationService.initialize()
      await imageGenerationService.disconnect()

      const info = imageGenerationService.getServiceInfo()
      expect(info.initialized).toBe(false)
    })
  })
})
