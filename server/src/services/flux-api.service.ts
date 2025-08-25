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
  editType?: 'inpaint' | 'outpaint' | 'enhance' | 'style_transfer' | 'variant' | 'expand'
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
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'Ready' | 'Error'
  result?: {
    images?: Array<{
      url: string
      width: number
      height: number
      content_type: string
    }>
    sample?: string  // BFL API uses 'sample' for single image URL
    width?: number   // BFL API includes dimensions at result level
    height?: number
  }
  error?: {
    message: string
    code: string
  }
  created_at: string
  completed_at?: string
}

export interface FluxModels {
  'flux-pro-1.1': {
    description: 'Latest FLUX 1.1 pro model'
    maxResolution: '2048x2048'
    typical_time: '60-120s'
  }
  'flux-pro': {
    description: 'FLUX.1 pro model'
    maxResolution: '2048x2048'
    typical_time: '30-60s'
  }
  'flux-dev': {
    description: 'FLUX.1 dev model for testing'
    maxResolution: '1440x1440'
    typical_time: '10-20s'
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
        'x-key': config.flux.apiKey
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

      const model = request.model || config.flux.defaultModel
      const payload = {
        prompt: request.prompt,
        width: request.width || 1024,
        height: request.height || 1024,
        steps: request.num_inference_steps || 28,
        guidance: request.guidance_scale || 3,
        seed: request.seed,
        output_format: request.output_format || 'jpeg',
        prompt_upsampling: false,
        safety_tolerance: 2
      }

      logger.info('Generating image with Flux API', {
        model: model,
        prompt: payload.prompt.substring(0, 100),
        dimensions: `${payload.width}x${payload.height}`,
        mode: 'REAL API'
      })

      // Use the model-specific endpoint for BFL API
      const endpoint = `/v1/${model}`
      const response = await this.client.post(endpoint, payload)

      // BFL API returns a polling URL for asynchronous requests
      if (response.data.id) {
        logger.info('Image generation started, polling for completion', {
          id: response.data.id
        })

        // Poll for completion using the returned ID
        return await this.pollForCompletion(response.data.id)
      }

      // If response contains direct result (unlikely with BFL), return it
      return response.data
    } catch (error) {
      const errorMessage = error instanceof Error
        ? `Image generation failed: ${(error as any).response?.data?.message || error.message}`
        : 'Image generation failed'
      logger.error('Failed to generate image:', { error: errorMessage })
      throw new Error(errorMessage)
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
          const response = await this.client.get(`/v1/get_result?id=${generationId}`)
          result = response.data
        }

        logger.debug('Polling image generation status', {
          id: generationId,
          status: result.status,
          attempt: attempts + 1,
          mode: config.flux.useMock ? 'MOCK' : 'REAL'
        })

        if (result.status === 'Ready' || result.status === 'completed') {
          logger.info('Image generation completed', {
            id: generationId,
            imageUrl: result.result?.sample || result.result?.images?.[0]?.url || 'No URL',
            attempts: attempts + 1,
            mode: config.flux.useMock ? 'MOCK' : 'REAL'
          })

          // Convert BFL response format to our expected format
          const convertedResult: FluxImageGenerationResponse = {
            id: generationId,
            status: 'completed',
            result: {
              images: [{
                url: result.result?.sample || result.result?.images?.[0]?.url || '',
                width: result.result?.width || result.result?.images?.[0]?.width || 1024,
                height: result.result?.height || result.result?.images?.[0]?.height || 1024,
                content_type: 'image/jpeg'
              }]
            },
            created_at: result.created_at || new Date().toISOString(),
            completed_at: new Date().toISOString()
          }

          return convertedResult
        } else if (result.status === 'Error' || result.status === 'failed') {
          const errorMsg = (result as any).error?.message || 'Unknown error'
          throw new Error(`Image generation failed: ${errorMsg}`)
        }

        attempts++
      } catch (error) {
        if (attempts >= maxAttempts - 1) {
          throw error
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        logger.warn('Error polling for completion, retrying...', {
          error: errorMessage,
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

      // Return BFL static model information
      return {
        'flux-pro-1.1': {
          description: 'Latest FLUX 1.1 pro model',
          maxResolution: '2048x2048',
          typical_time: '60-120s'
        },
        'flux-pro': {
          description: 'FLUX.1 pro model',
          maxResolution: '2048x2048',
          typical_time: '30-60s'
        },
        'flux-dev': {
          description: 'FLUX.1 dev model for testing',
          maxResolution: '1440x1440',
          typical_time: '10-20s'
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

      // Use appropriate BFL API endpoint based on edit type
      let endpoint: string
      let payload: any

      switch (request.editType) {
        case 'inpaint':
          // Use FLUX.1 Fill for inpainting with mask
          endpoint = '/v1/flux-pro-1.0-fill'
          payload = {
            prompt: request.instruction,
            image: request.imageUrl, // BFL expects base64 or URL
            mask: request.maskData,
            steps: 50,
            guidance: request.guidance || 30,
            output_format: request.output_format || 'jpeg',
            safety_tolerance: 2
          }
          break

        case 'outpaint':
        case 'expand':
          // Use expand endpoint for outpainting
          endpoint = '/v1/flux-expand'
          payload = {
            image: request.imageUrl,
            prompt: request.instruction,
            top: 512, // Default expansion
            bottom: 512,
            left: 512,
            right: 512,
            steps: 50,
            guidance: request.guidance || 50,
            output_format: request.output_format || 'jpeg',
            safety_tolerance: 2
          }
          break

        default:
          // Use Kontext Pro for general editing
          endpoint = '/v1/flux-kontext-pro'
          payload = {
            prompt: request.instruction,
            input_image: request.imageUrl,
            seed: Math.floor(Math.random() * 1000000),
            aspect_ratio: '1:1',
            output_format: request.output_format || 'jpeg',
            safety_tolerance: 2,
            prompt_upsampling: false
          }
      }

      const response = await this.client.post(endpoint, payload)

      // BFL API returns a polling URL for asynchronous requests
      if (response.data.id) {
        logger.info('Image editing started, polling for completion', {
          id: response.data.id,
          editType: request.editType,
          endpoint
        })

        // Poll for completion using the same mechanism as image generation
        const result = await this.pollForCompletion(response.data.id)

        // Convert polling result to editing response format
        return {
          success: result.status === 'completed',
          imageUrl: result.result?.sample || result.result?.images?.[0]?.url,
          size: result.result?.images?.[0]?.width && result.result?.images?.[0]?.height
            ? result.result.images[0].width * result.result.images[0].height
            : undefined,
          editType: request.editType,
          processingTime: Date.now() - startTime,
          error: result.status === 'failed' ? result.error?.message : undefined
        }
      }

      // Handle direct response (shouldn't happen with BFL API)
      if (response.data.success) {
        logger.info('Image editing completed immediately', {
          editType: request.editType,
          processingTime: Date.now() - startTime,
          mode: 'REAL API'
        })

        return {
          success: true,
          imageUrl: response.data.image_url || response.data.result?.sample,
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
      const errorMessage = error instanceof Error
        ? `Image editing failed: ${(error as any).response?.data?.message || error.message}`
        : 'Image editing failed'
      logger.error('Failed to edit image:', { error: errorMessage })
      return {
        success: false,
        error: errorMessage,
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
      num_inference_steps: 28,
      guidance_scale: 3,
      output_format: 'jpeg'
    }
  }
}

export const fluxApiService = new FluxApiService()
