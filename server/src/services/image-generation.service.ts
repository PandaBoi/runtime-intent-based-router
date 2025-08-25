import { v4 as uuidv4 } from 'uuid'
import { ImageGenerationGraph, ImageGenerationRequest, ImageGenerationResult } from '../graphs/image-generation.graph'
import { IntentType, ServiceResponse } from '../types'
import { ConversationTurn } from '../types/session'
import { logger } from '../utils/logger'
import { sessionManager } from './session-manager.service'

export class ImageGenerationService {
  private imageGraph: ImageGenerationGraph
  private isInitialized = false

  constructor() {
    this.imageGraph = new ImageGenerationGraph()
  }

  async initialize(): Promise<void> {
    try {
      await this.imageGraph.build()
      this.isInitialized = true
      logger.info('Image generation service initialized')
    } catch (error) {
      logger.error('Failed to initialize image generation service:', error)
      throw error
    }
  }

  async generateImage(
    prompt: string,
    sessionId: string,
    options: {
      model?: string
      width?: number
      height?: number
      style?: string
      quality?: 'fast' | 'balanced' | 'high'
    } = {}
  ): Promise<ServiceResponse<ImageGenerationResult>> {
    try {
      if (!this.isInitialized) {
        await this.initialize()
      }

      // Validate session exists
      const session = await sessionManager.getSession(sessionId)
      if (!session) {
        throw new Error('Invalid session ID')
      }

      // Validate prompt is not empty
      if (!prompt || prompt.trim().length === 0) {
        return {
          success: false,
          error: 'Image prompt cannot be empty'
        }
      }

      // Prepare image generation request
      const request: ImageGenerationRequest = {
        prompt,
        sessionId,
        model: options.model,
        width: options.width,
        height: options.height,
        style: options.style,
        quality: options.quality || 'balanced'
      }

      logger.info('Processing image generation request', {
        sessionId,
        prompt: prompt.substring(0, 50),
        quality: request.quality,
        model: request.model
      })

      // Execute image generation graph
      const result = await this.imageGraph.execute(request)

      if (result.success && result.imageMetadata) {
        // Create conversation turn for session tracking
        const conversationTurn: ConversationTurn = {
          id: uuidv4(),
          timestamp: new Date(),
          userInput: prompt,
          detectedIntent: IntentType.GENERATE_IMAGE,
          confidence: 1.0, // High confidence since this is a direct image generation request
          response: result.imageMetadata
        }

        // Add to session history
        await sessionManager.addConversationTurn(sessionId, conversationTurn)

        logger.info('Image generation completed successfully', {
          sessionId,
          imageId: result.imageMetadata.id,
          generationTime: result.generationTime,
          enhancedPrompt: result.enhancedPrompt?.substring(0, 100)
        })

        return {
          success: true,
          data: result,
          timestamp: new Date()
        }
      } else {
        logger.error('Image generation failed', {
          sessionId,
          error: result.error
        })

        return {
          success: false,
          error: result.error || 'Image generation failed',
          timestamp: new Date()
        }
      }

    } catch (error) {
      logger.error('Image generation service error:', error, { sessionId, prompt: prompt.substring(0, 50) })

      return {
        success: false,
        error: `Image generation failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      }
    }
  }

  async getSessionImages(sessionId: string): Promise<ServiceResponse<any[]>> {
    try {
      const session = sessionManager.getSession(sessionId)
      if (!session) {
        return {
          success: true,
          data: [],
          timestamp: new Date()
        }
      }

      const images = await sessionManager.getSessionImages(sessionId)

      return {
        success: true,
        data: images.map(img => ({
          id: img.id,
          url: img.storageUrl,
          description: img.description,
          createdAt: img.uploadedAt,
          generatedBy: img.generatedBy,
          size: `${img.size || 'unknown'} bytes`
        })),
        timestamp: new Date()
      }
    } catch (error) {
      logger.error('Failed to get session images:', error)
      return {
        success: false,
        error: 'Failed to retrieve session images',
        timestamp: new Date()
      }
    }
  }

  async getImageGenerationSuggestions(sessionId: string): Promise<ServiceResponse<string[]>> {
    try {
      const suggestions = await sessionManager.suggestFollowUpActions(sessionId)

      // Filter for image generation related suggestions
      const imageRelatedSuggestions = suggestions.filter(suggestion =>
        suggestion.toLowerCase().includes('image') ||
        suggestion.toLowerCase().includes('generate') ||
        suggestion.toLowerCase().includes('create')
      )

      // Add default suggestions if none found
      if (imageRelatedSuggestions.length === 0) {
        imageRelatedSuggestions.push(
          'Generate a landscape image',
          'Create a portrait',
          'Generate abstract art'
        )
      }

      return {
        success: true,
        data: imageRelatedSuggestions,
        timestamp: new Date()
      }
    } catch (error) {
      logger.error('Failed to get image generation suggestions:', error)
      return {
        success: false,
        error: 'Failed to get suggestions',
        timestamp: new Date()
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      return this.isInitialized && this.imageGraph.isReady()
    } catch (error) {
      logger.error('Image generation service health check failed:', error)
      return false
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.imageGraph.destroy()
      this.isInitialized = false
      logger.info('Image generation service disconnected')
    } catch (error) {
      logger.error('Error during image generation service disconnect:', error)
    }
  }

  /**
   * Get service statistics
   */
  getServiceInfo(): any {
    return {
      initialized: this.isInitialized,
      graphReady: this.imageGraph.isReady(),
      config: this.imageGraph.getConfig(),
      capabilities: {
        promptEnhancement: true,
        multipleModels: true,
        qualityOptions: ['fast', 'balanced', 'high'],
        supportedFormats: ['jpeg', 'png'],
        maxResolution: '2048x2048'
      }
    }
  }
}

export const imageGenerationService = new ImageGenerationService()
