import { v4 as uuidv4 } from 'uuid'
import { logger } from '../utils/logger'
import {
    FluxImageEditingRequest,
    FluxImageEditingResponse,
    FluxImageGenerationRequest,
    FluxImageGenerationResponse,
    FluxModels
} from './flux-api.service'

/**
 * Mock Flux API Service for development and testing
 * Simulates realistic API behavior without using actual credits
 */
export class FluxMockService {
  private static readonly MOCK_IMAGES = [
    'https://picsum.photos/1024/1024?random=1',
    'https://picsum.photos/1024/1024?random=2',
    'https://picsum.photos/1024/1024?random=3',
    'https://picsum.photos/1024/1024?random=4',
    'https://picsum.photos/1024/1024?random=5'
  ]

  private pendingGenerations = new Map<string, {
    request: FluxImageGenerationRequest
    startTime: number
    expectedDuration: number
  }>()

  private static readonly EDITING_TYPES = [
    'enhance', 'inpaint', 'outpaint', 'style_transfer', 'variant'
  ]

  async initialize(): Promise<void> {
    logger.info('Mock Flux API service initialized (no credits used)')
    return Promise.resolve()
  }

  async generateImage(request: FluxImageGenerationRequest): Promise<FluxImageGenerationResponse> {
    const generationId = uuidv4()
    const now = Date.now()

    // Simulate different generation times based on model
    const modelTimes = {
      'flux-1-pro': 90000,     // 90 seconds
      'flux-dev': 20000,     // 20 seconds
      'flux-1-schnell': 8000   // 8 seconds
    }

    const model = request.model || 'flux-dev'
    const expectedDuration = modelTimes[model as keyof typeof modelTimes] || 20000

    // Store generation info for polling
    this.pendingGenerations.set(generationId, {
      request,
      startTime: now,
      expectedDuration
    })

    logger.info('Mock image generation started', {
      id: generationId,
      model,
      prompt: request.prompt.substring(0, 50),
      expectedDuration: `${expectedDuration / 1000}s`
    })

    // Return pending status initially (simulating async behavior)
    return {
      id: generationId,
      status: 'pending',
      created_at: new Date(now).toISOString()
    }
  }

  async getGenerationStatus(generationId: string): Promise<FluxImageGenerationResponse> {
    const generation = this.pendingGenerations.get(generationId)

    if (!generation) {
      return {
        id: generationId,
        status: 'failed',
        error: {
          message: 'Generation not found',
          code: 'GENERATION_NOT_FOUND'
        },
        created_at: new Date().toISOString()
      }
    }

    const elapsed = Date.now() - generation.startTime
    const { request, expectedDuration } = generation

    // Simulate processing stages
    if (elapsed < expectedDuration * 0.1) {
      return {
        id: generationId,
        status: 'pending',
        created_at: new Date(generation.startTime).toISOString()
      }
    } else if (elapsed < expectedDuration) {
      return {
        id: generationId,
        status: 'processing',
        created_at: new Date(generation.startTime).toISOString()
      }
    } else {
      // Generation completed
      this.pendingGenerations.delete(generationId)

      // Select a mock image based on prompt hash for consistency
      const promptHash = this.simpleHash(request.prompt)
      const imageIndex = promptHash % FluxMockService.MOCK_IMAGES.length
      const mockImageUrl = FluxMockService.MOCK_IMAGES[imageIndex]

      logger.info('Mock image generation completed', {
        id: generationId,
        prompt: request.prompt.substring(0, 50),
        duration: `${elapsed / 1000}s`
      })

      return {
        id: generationId,
        status: 'completed',
        result: {
          images: [{
            url: mockImageUrl,
            width: request.width || 1024,
            height: request.height || 1024,
            content_type: `image/${request.output_format || 'jpeg'}`
          }]
        },
        created_at: new Date(generation.startTime).toISOString(),
        completed_at: new Date().toISOString()
      }
    }
  }

  async getModels(): Promise<FluxModels> {
    return {
      'flux-pro-1.1': {
        description: 'Latest FLUX 1.1 pro model' as const,
        maxResolution: '2048x2048' as const,
        typical_time: '60-120s' as const
      },
      'flux-pro': {
        description: 'FLUX.1 pro model' as const,
        maxResolution: '2048x2048' as const,
        typical_time: '30-60s' as const
      },
      'flux-dev': {
        description: 'FLUX.1 dev model for testing' as const,
        maxResolution: '1440x1440' as const,
        typical_time: '10-20s' as const
      }
    }
  }

  async editImage(request: FluxImageEditingRequest): Promise<FluxImageEditingResponse> {
    const startTime = Date.now()

    try {
      // Simulate processing time based on edit type
      const editTypeTimes = {
        'enhance': 3000,      // 3 seconds
        'inpaint': 8000,      // 8 seconds
        'outpaint': 10000,    // 10 seconds
        'style_transfer': 12000, // 12 seconds
        'variant': 5000       // 5 seconds
      }

      const editType = request.editType || 'enhance'
      const processingTime = editTypeTimes[editType as keyof typeof editTypeTimes] || 5000

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, processingTime))

      // Generate a mock edited image URL (different from the original)
      const randomImageIndex = Math.floor(Math.random() * FluxMockService.MOCK_IMAGES.length)
      const editedImageUrl = `${FluxMockService.MOCK_IMAGES[randomImageIndex]}&edit=${editType}&t=${Date.now()}`

      // Simulate different file sizes based on edit type
      const mockSizes = {
        'enhance': 1536000,     // 1.5MB (enhanced quality)
        'inpaint': 1024000,     // 1MB (similar size)
        'outpaint': 2048000,    // 2MB (larger canvas)
        'style_transfer': 1280000, // 1.3MB (style processing)
        'variant': 1152000      // 1.1MB (variation)
      }

      const mockSize = mockSizes[editType as keyof typeof mockSizes] || 1024000

      logger.info('Mock image editing completed', {
        editType,
        instruction: request.instruction.substring(0, 50),
        processingTime: Date.now() - startTime,
        mockSize
      })

      return {
        success: true,
        imageUrl: editedImageUrl,
        size: mockSize,
        editType,
        processingTime: Date.now() - startTime
      }

    } catch (error) {
      logger.error('Mock image editing failed', { error: error instanceof Error ? error.message : String(error) })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    return true // Mock is always healthy
  }

  getDefaultParameters(): Partial<FluxImageGenerationRequest> {
    return {
      model: 'flux-dev',
      width: 1024,
      height: 1024,
      num_inference_steps: 50,
      guidance_scale: 7.5,
      output_format: 'jpeg'
    }
  }

  /**
   * Simple hash function for consistent mock image selection
   */
  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }

  /**
   * Clean up expired pending generations (optional cleanup)
   */
  cleanup(): void {
    const now = Date.now()
    const maxAge = 5 * 60 * 1000 // 5 minutes

    for (const [id, generation] of this.pendingGenerations.entries()) {
      if (now - generation.startTime > maxAge) {
        this.pendingGenerations.delete(id)
        logger.debug('Cleaned up expired mock generation', { id })
      }
    }
  }
}

export const fluxMockService = new FluxMockService()
