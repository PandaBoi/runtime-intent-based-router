import { ImageGenerationGraph } from '../../graphs/image-generation.graph'
import { sessionManager } from '../../services/session-manager.service'

describe('ImageGenerationGraph', () => {
  let graph: ImageGenerationGraph
  let testSessionId: string

  beforeEach(async () => {
    graph = new ImageGenerationGraph()
    const session = await sessionManager.createSession()
    testSessionId = session.sessionId
  })

  afterEach(async () => {
    await graph.destroy()
    await sessionManager.deleteSession(testSessionId)
  })

  describe('Graph Construction', () => {
    test('should build graph successfully', async () => {
      await graph.build()
      expect(graph.isReady()).toBe(true)
    })

    test('should have correct default configuration', () => {
      const config = graph.getConfig()
      expect(config.promptEnhancementEnabled).toBe(true)
      expect(config.provider).toBe('openai')
      expect(config.modelName).toBe('gpt-4o-mini')
      expect(config.temperature).toBe(0.8)
      expect(config.maxTokens).toBe(300)
    })

    test('should accept custom configuration', () => {
      const customGraph = new ImageGenerationGraph({
        promptEnhancementEnabled: false,
        temperature: 0.5
      })

      const config = customGraph.getConfig()
      expect(config.promptEnhancementEnabled).toBe(false)
      expect(config.temperature).toBe(0.5)
      expect(config.provider).toBe('openai') // Should keep defaults for unspecified
    })
  })

  describe('Graph Execution', () => {
    beforeEach(async () => {
      await graph.build()
    })

    test('should execute image generation workflow', async () => {
      const request = {
        prompt: 'A beautiful sunset over mountains',
        sessionId: testSessionId,
        quality: 'balanced' as const
      }

      const result = await graph.execute(request)

      expect(result.success).toBe(true)
      expect(result.imageMetadata).toBeDefined()
      expect(result.enhancedPrompt).toBeDefined()
      expect(result.generationTime).toBeGreaterThan(0)
      expect(result.suggestions).toBeDefined()
    }, 30000) // Allow time for mock generation

    test('should handle prompt enhancement', async () => {
      const request = {
        prompt: 'cat',
        sessionId: testSessionId
      }

      const result = await graph.execute(request)

      expect(result.success).toBe(true)
      expect(result.enhancedPrompt).toBeDefined()
      expect(result.enhancedPrompt?.length).toBeGreaterThan(request.prompt.length)
    }, 30000)

    test('should work with different quality settings', async () => {
      const fastRequest = {
        prompt: 'Quick test image',
        sessionId: testSessionId,
        quality: 'fast' as const
      }

      const result = await graph.execute(fastRequest)

      expect(result.success).toBe(true)
      expect(result.generationTime).toBeLessThan(25000) // Fast should be reasonably quick
    }, 30000)

    test('should handle errors gracefully', async () => {
      const invalidRequest = {
        prompt: 'Test image',
        sessionId: 'invalid-session-id' // Invalid session should cause error
      }

      const result = await graph.execute(invalidRequest)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.generationTime).toBeGreaterThan(0) // Should still track timing
    })
  })

  describe('Graph Configuration', () => {
    test('should disable prompt enhancement when configured', async () => {
      const simpleGraph = new ImageGenerationGraph({
        promptEnhancementEnabled: false
      })

      await simpleGraph.build()

      const request = {
        prompt: 'simple test',
        sessionId: testSessionId
      }

      const result = await simpleGraph.execute(request)

      expect(result.success).toBe(true)
      expect(result.enhancedPrompt).toBe(request.prompt) // Should be unchanged

      await simpleGraph.destroy()
    }, 30000)
  })

  describe('Graph Lifecycle', () => {
    test('should initialize graph only once', async () => {
      expect(graph.isReady()).toBe(false)

      await graph.build()
      expect(graph.isReady()).toBe(true)

      // Building again should not cause issues
      await graph.build()
      expect(graph.isReady()).toBe(true)
    })

    test('should cleanup resources on destroy', async () => {
      await graph.build()
      expect(graph.isReady()).toBe(true)

      await graph.destroy()
      expect(graph.isReady()).toBe(false)
    })
  })
})
