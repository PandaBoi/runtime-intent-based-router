import { ImageEditingGraph, ImageEditingRequest } from '../graphs/image-editing.graph'
import { ImageMetadata } from '../types/session'
import { logger } from '../utils/logger'
import { sessionManager } from './session-manager.service'

export interface ImageEditingServiceRequest {
  editInstruction: string
  sessionId: string
  targetImageId?: string
  editType?: 'inpaint' | 'outpaint' | 'enhance' | 'style_transfer' | 'variant'
  strength?: number
  guidance?: number
}

export interface ImageEditingServiceResponse {
  success: boolean
  data?: {
    originalImage: ImageMetadata
    editedImage: ImageMetadata
    enhancedInstruction: string
    editType: string
    editingTime: number
    suggestions: string[]
  }
  error?: string
}

export interface ImageEditingServiceInfo {
  initialized: boolean
  graphReady: boolean
  config: {
    contextAnalysisEnabled: boolean
    instructionEnhancementEnabled: boolean
    provider: string
    model: string
  }
  capabilities: {
    editTypes: string[]
    maxFileSize: string
    supportedFormats: string[]
    contextAware: boolean
  }
}

/**
 * Image Editing Service
 *
 * Orchestrates the complete image editing workflow:
 * 1. Context analysis and target image resolution
 * 2. Instruction enhancement via LLM
 * 3. Image editing via Flux API
 * 4. Session management and result storage
 * 5. Follow-up suggestions generation
 */
export class ImageEditingService {
  private graph: ImageEditingGraph
  private isInitialized = false

  constructor() {
    this.graph = new ImageEditingGraph()
  }

  async initialize(): Promise<void> {
    try {
      await this.graph.build()
      this.isInitialized = true

      logger.info('Image editing service initialized successfully', {
        contextAnalysis: this.graph.getConfig().contextAnalysisEnabled,
        instructionEnhancement: this.graph.getConfig().instructionEnhancementEnabled
      })
    } catch (error) {
      logger.error('Failed to initialize image editing service', { error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  async editImage(request: ImageEditingServiceRequest): Promise<ImageEditingServiceResponse> {
    try {
      if (!this.isInitialized) {
        await this.initialize()
      }

      logger.info('Starting image editing request', {
        sessionId: request.sessionId,
        instruction: request.editInstruction.substring(0, 100),
        hasTargetId: !!request.targetImageId,
        editType: request.editType
      })

      // Convert service request to graph request
      const graphRequest: ImageEditingRequest = {
        editInstruction: request.editInstruction,
        sessionId: request.sessionId,
        targetImageId: request.targetImageId,
        editType: request.editType,
        strength: request.strength,
        guidance: request.guidance
      }

      // Execute the image editing workflow
      const result = await this.graph.execute(graphRequest)

      if (!result.success) {
        logger.warn('Image editing failed', {
          sessionId: request.sessionId,
          error: result.error
        })

        return {
          success: false,
          error: result.error
        }
      }

      logger.info('Image editing completed successfully', {
        sessionId: request.sessionId,
        originalImageId: result.originalImageMetadata?.id,
        editedImageId: result.editedImageMetadata?.id,
        editType: result.editType,
        editingTime: result.editingTime
      })

      return {
        success: true,
        data: {
          originalImage: result.originalImageMetadata!,
          editedImage: result.editedImageMetadata!,
          enhancedInstruction: result.enhancedInstruction!,
          editType: result.editType!,
          editingTime: result.editingTime!,
          suggestions: result.suggestions || []
        }
      }

    } catch (error) {
      logger.error('Image editing service error', {
        sessionId: request.sessionId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Get images available for editing in a session
   */
  async getEditableImages(sessionId: string): Promise<ImageMetadata[]> {
    try {
      const images = await sessionManager.getSessionImages(sessionId)

      // Return all images (both uploaded and generated can be edited)
      return images

    } catch (error) {
      logger.error('Failed to get editable images', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      })
      return []
    }
  }

  /**
   * Get context-aware editing suggestions
   */
  async getEditingSuggestions(sessionId: string): Promise<string[]> {
    try {
      const session = await sessionManager.getSession(sessionId)
      if (!session) {
        return this.getDefaultEditingSuggestions()
      }

      const images = await sessionManager.getSessionImages(sessionId)
      if (images.length === 0) {
        return [
          'Upload an image to start editing',
          'Generate an image first, then edit it',
          'Try: "Create a sunset image and then make it brighter"'
        ]
      }

      // Context-aware suggestions based on session state
      const suggestions: string[] = []

      // Suggest editing the most recent image
      const mostRecentImage = images[0]
      if (mostRecentImage) {
        suggestions.push(
          `Edit the ${mostRecentImage.generatedBy === 'user_upload' ? 'uploaded' : 'generated'} image`,
          'Make the last image brighter',
          'Change the style of the recent image'
        )
      }

      // Suggest common editing operations
      suggestions.push(
        'Enhance the colors in this image',
        'Remove the background from this photo',
        'Make this image more vibrant',
        'Apply a vintage style to this image'
      )

      return suggestions.slice(0, 5) // Return top 5 suggestions

    } catch (error) {
      logger.error('Failed to get editing suggestions', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      })
      return this.getDefaultEditingSuggestions()
    }
  }

  private getDefaultEditingSuggestions(): string[] {
    return [
      'Upload an image to start editing',
      'Make this image brighter',
      'Change the style to vintage',
      'Remove the background',
      'Enhance the colors'
    ]
  }

  /**
   * Analyze if an instruction is likely an image editing request
   */
  isImageEditingInstruction(instruction: string): boolean {
    const editKeywords = [
      'edit', 'modify', 'change', 'alter', 'enhance', 'improve',
      'brighten', 'darken', 'colorize', 'style', 'filter',
      'remove', 'add', 'crop', 'resize', 'adjust',
      'make brighter', 'make darker', 'more vibrant', 'less saturated',
      'background', 'foreground', 'blur', 'sharpen'
    ]

    const imageReferences = [
      'image', 'photo', 'picture', 'this', 'that', 'last', 'recent'
    ]

    const instructionLower = instruction.toLowerCase()

    const hasEditKeyword = editKeywords.some(keyword => instructionLower.includes(keyword))
    const hasImageReference = imageReferences.some(ref => instructionLower.includes(ref))

    return hasEditKeyword && hasImageReference
  }

  getServiceInfo(): ImageEditingServiceInfo {
    const config = this.graph.getConfig()

    return {
      initialized: this.isInitialized,
      graphReady: this.graph.isReady(),
      config: {
        contextAnalysisEnabled: config.contextAnalysisEnabled,
        instructionEnhancementEnabled: config.instructionEnhancementEnabled,
        provider: config.provider,
        model: config.modelName
      },
      capabilities: {
        editTypes: ['enhance', 'inpaint', 'outpaint', 'style_transfer', 'variant'],
        maxFileSize: '10MB',
        supportedFormats: ['JPEG', 'PNG', 'WebP'],
        contextAware: true
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        return false
      }

      return this.graph.isReady()
    } catch (error) {
      logger.error('Image editing service health check failed', { error: error instanceof Error ? error.message : String(error) })
      return false
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.graph.destroy()
      this.isInitialized = false
      logger.info('Image editing service disconnected')
    } catch (error) {
      logger.error('Error disconnecting image editing service', { error: error instanceof Error ? error.message : String(error) })
    }
  }
}

// Singleton instance
export const imageEditingService = new ImageEditingService()
