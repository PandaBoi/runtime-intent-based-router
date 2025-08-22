import axios, { AxiosInstance } from 'axios'
import { config } from '../config'
import { logger } from '../utils/logger'
import { fluxMockService, FluxMockService } from './flux-mock.service'

export interface FluxImageGenerationRequest {
  prompt: string
  model?: string
  width?: number
  height?: number
  num_inference_steps?: number
  guidance_scale?: number
  seed?: number
  output_format?: 'jpeg' | 'png' | 'webp'
}

export interface FluxImageEditingRequest {
  imageUrl: string
  instruction: string
  editType?: 'inpaint' | 'outpaint' | 'enhance' | 'style_transfer' | 'variant'
  maskData?: string // Base64 encoded mask for inpainting
  strength?: number // 0.1-1.0 for edit strength
  guidance?: number // Guidance scale for editing
  model?: string
  output_format?: 'jpeg' | 'png' | 'webp'
}

export interface FluxImageEditingResponse {
  success: boolean
  imageUrl?: string
  size?: number
  editType?: string
  processingTime?: number
  error?: string
}

export interface FluxImageGenerationResponse {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result?: {
    images: Array<{
      url: string
      width: number
      height: number
      content_type: string
    }>
  }
  error?: {
    message: string
    code: string
  }
  created_at: string
  completed_at?: string
}

export interface FluxModels {
  'flux-1-pro': {
    description: 'Highest quality, slower generation'
    maxResolution: '2048x2048'
    typical_time: '60-120s'
  }
  'flux-1-dev': {
    description: 'Balanced quality and speed'
    maxResolution: '1024x1024'
    typical_time: '15-30s'
  }
  'flux-1-schnell': {
    description: 'Fastest generation, good quality'
    maxResolution: '1024x1024'
    typical_time: '5-10s'
  }
}

export class FluxApiService {
  private client: AxiosInstance
  private isConfigured = false
  private mockService: FluxMockService

  constructor() {
    this.mockService = fluxMockService
    this.client = axios.create({
      baseURL: config.flux.baseUrl,
      timeout: 120000, // 2 minutes timeout for image generation
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.flux.apiKey}`
      }
    })

    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Flux API request:', {
          method: config.method,
          url: config.url,
          data: config.data ? JSON.stringify(config.data).substring(0, 200) : undefined
        })
        return config
      },
      (error) => {
        logger.error('Flux API request error:', error)
        return Promise.reject(error)
      }
    )

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Flux API response:', {
          status: response.status,
          data: response.data ? JSON.stringify(response.data).substring(0, 200) : undefined
        })
        return response
      },
      (error) => {
        logger.error('Flux API response error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        })
        return Promise.reject(error)
      }
    )
  }

  async initialize(): Promise<void> {
    try {
      if (config.flux.useMock) {
        await this.mockService.initialize()
        this.isConfigured = true
        logger.info('Flux API service initialized in MOCK mode (no credits used)')
        return
      }

      if (!config.flux.apiKey) {
        throw new Error('Flux API key not configured')
      }

      // Test API connection with a simple request
      await this.getModels()

      this.isConfigured = true
      logger.info('Flux API service initialized successfully with REAL API')
    } catch (error) {
      logger.error('Failed to initialize Flux API service:', error)
      throw error
    }
  }

  async generateImage(request: FluxImageGenerationRequest): Promise<FluxImageGenerationResponse> {
    try {
      if (!this.isConfigured) {
        await this.initialize()
      }

      // Use mock service if configured
      if (config.flux.useMock) {
        const result = await this.mockService.generateImage(request)

        // If mock returns pending/processing, poll for completion
        if (result.status === 'pending' || result.status === 'processing') {
          return await this.pollForCompletion(result.id, 30) // Shorter polling for mocks
        }

        return result
      }

      const payload = {
        prompt: request.prompt,
        model: request.model || config.flux.defaultModel,
        width: request.width || 1024,
        height: request.height || 1024,
        num_inference_steps: request.num_inference_steps || 50,
        guidance_scale: request.guidance_scale || 7.5,
        seed: request.seed,
        output_format: request.output_format || 'jpeg'
      }

      logger.info('Generating image with Flux API', {
        model: payload.model,
        prompt: payload.prompt.substring(0, 100),
        dimensions: `${payload.width}x${payload.height}`,
        mode: 'REAL API'
      })

      const response = await this.client.post('/v1/images/generations', payload)

      // Handle both synchronous and asynchronous responses
      if (response.data.status === 'completed') {
        logger.info('Image generation completed immediately', {
          id: response.data.id,
          imageCount: response.data.result?.images?.length || 0
        })
      } else if (response.data.status === 'pending' || response.data.status === 'processing') {
        logger.info('Image generation started, polling for completion', {
          id: response.data.id,
          status: response.data.status
        })

        // Poll for completion
        return await this.pollForCompletion(response.data.id)
      }

      return response.data
    } catch (error) {
      logger.error('Failed to generate image:', error)
      throw new Error(`Image generation failed: ${error.response?.data?.message || error.message}`)
    }
  }

  private async pollForCompletion(generationId: string, maxAttempts = 60): Promise<FluxImageGenerationResponse> {
    let attempts = 0

    while (attempts < maxAttempts) {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds

        let result: FluxImageGenerationResponse

        // Use appropriate service based on configuration
        if (config.flux.useMock) {
          result = await this.mockService.getGenerationStatus(generationId)
        } else {
          const response = await this.client.get(`/v1/images/generations/${generationId}`)
          result = response.data
        }

        logger.debug('Polling image generation status', {
          id: generationId,
          status: result.status,
          attempt: attempts + 1,
          mode: config.flux.useMock ? 'MOCK' : 'REAL'
        })

        if (result.status === 'completed') {
          logger.info('Image generation completed', {
            id: generationId,
            imageCount: result.result?.images?.length || 0,
            attempts: attempts + 1,
            mode: config.flux.useMock ? 'MOCK' : 'REAL'
          })
          return result
        } else if (result.status === 'failed') {
          throw new Error(`Image generation failed: ${result.error?.message || 'Unknown error'}`)
        }

        attempts++
      } catch (error) {
        if (attempts >= maxAttempts - 1) {
          throw error
        }
        logger.warn('Error polling for completion, retrying...', {
          error: error.message,
          attempt: attempts + 1
        })
        attempts++
      }
    }

    throw new Error(`Image generation timed out after ${maxAttempts} attempts`)
  }

  async getModels(): Promise<FluxModels> {
    try {
      if (config.flux.useMock) {
        return await this.mockService.getModels()
      }

      // For now, return static model information
      // In a real implementation, this might call an API endpoint
      return {
        'flux-1-pro': {
          description: 'Highest quality, slower generation',
          maxResolution: '2048x2048',
          typical_time: '60-120s'
        },
        'flux-1-dev': {
          description: 'Balanced quality and speed',
          maxResolution: '1024x1024',
          typical_time: '15-30s'
        },
        'flux-1-schnell': {
          description: 'Fastest generation, good quality',
          maxResolution: '1024x1024',
          typical_time: '5-10s'
        }
      }
    } catch (error) {
      logger.error('Failed to get models:', error)
      throw error
    }
  }

  async editImage(request: FluxImageEditingRequest): Promise<FluxImageEditingResponse> {
    const startTime = Date.now()

    try {
      if (!this.isConfigured) {
        await this.initialize()
      }

      logger.info('Starting image editing with Flux API', {
        editType: request.editType || 'enhance',
        instruction: request.instruction.substring(0, 100),
        hasImage: !!request.imageUrl,
        hasMask: !!request.maskData,
        mode: config.flux.useMock ? 'MOCK' : 'REAL'
      })

      // Use mock service if configured
      if (config.flux.useMock) {
        const result = await this.mockService.editImage(request)
        return {
          ...result,
          processingTime: Date.now() - startTime
        }
      }

      // For real API, we would implement different endpoints based on edit type
      // For now, use a generic editing approach
      const payload = {
        image_url: request.imageUrl,
        instruction: request.instruction,
        edit_type: request.editType || 'enhance',
        mask_data: request.maskData,
        strength: request.strength || 0.7,
        guidance_scale: request.guidance || 7.5,
        model: request.model || config.flux.defaultModel,
        output_format: request.output_format || 'jpeg'
      }

      const response = await this.client.post('/v1/images/edit', payload)

      if (response.data.success) {
        logger.info('Image editing completed successfully', {
          editType: request.editType,
          processingTime: Date.now() - startTime,
          mode: 'REAL API'
        })

        return {
          success: true,
          imageUrl: response.data.image_url,
          size: response.data.size,
          editType: request.editType,
          processingTime: Date.now() - startTime
        }
      } else {
        return {
          success: false,
          error: response.data.error || 'Image editing failed',
          processingTime: Date.now() - startTime
        }
      }

    } catch (error) {
      logger.error('Failed to edit image:', error)
      return {
        success: false,
        error: `Image editing failed: ${error.response?.data?.message || error.message}`,
        processingTime: Date.now() - startTime
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        return false
      }

      if (config.flux.useMock) {
        return await this.mockService.healthCheck()
      }

      await this.getModels()
      return true
    } catch (error) {
      logger.error('Flux API health check failed:', error)
      return false
    }
  }

  getDefaultParameters(): Partial<FluxImageGenerationRequest> {
    return {
      model: config.flux.defaultModel,
      width: 1024,
      height: 1024,
      num_inference_steps: 50,
      guidance_scale: 7.5,
      output_format: 'jpeg'
    }
  }
}

export const fluxApiService = new FluxApiService()
