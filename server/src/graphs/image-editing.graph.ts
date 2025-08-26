import {
  GraphBuilder,
  GraphTypes,
  RemoteLLMChatNode
} from '@inworld/runtime/graph'
import { renderJinja } from '@inworld/runtime/primitives/llm'
import crypto from 'crypto'
import { config } from '../config'
import { CONTEXT_ANALYSIS_AND_INSTRUCTION_ENHANCEMENT_TEMPLATE } from '../prompts/image-editing'
import { fluxApiService } from '../services/flux-api.service'
import { sessionManager } from '../services/session-manager.service'
import { ImageMetadata } from '../types/session'
import { logger } from '../utils/logger'

/**
 * Image Editing Graph Configuration
 *
 * This graph orchestrates the complete image editing workflow:
 * 1. Context Analysis (identify target image and editing instructions)
 * 2. Edit Enhancement (using Inworld Runtime LLM to improve edit prompts)
 * 3. Image Editing (using Flux API inpainting/outpainting)
 * 4. Session Storage (updating user session with edited image)
 * 5. Response Generation (contextual user response)
 */

export interface ImageEditingRequest {
  editInstruction: string
  sessionId: string
  targetImageId?: string // If not provided, auto-determine from session context
  editType?: 'inpaint' | 'outpaint' | 'enhance' | 'style_transfer' | 'variant'
  maskData?: string // Base64 encoded mask for inpainting
  strength?: number // 0.1-1.0 for edit strength
  guidance?: number // Guidance scale for editing
}

export interface ImageEditingResult {
  success: boolean
  originalImageMetadata?: ImageMetadata
  editedImageMetadata?: ImageMetadata
  enhancedInstruction?: string
  editingTime?: number
  editType?: string
  error?: string
  suggestions?: string[]
}

export interface ImageEditingGraphConfig {
  contextAnalysisEnabled: boolean
  instructionEnhancementEnabled: boolean
  provider: string
  modelName: string
  temperature: number
  maxTokens: number
}

export const DEFAULT_IMAGE_EDITING_CONFIG: ImageEditingGraphConfig = {
  contextAnalysisEnabled: true,
  instructionEnhancementEnabled: true,
  provider: config.llm.provider,
  modelName: config.llm.defaultModel,
  temperature: config.llm.imageEditing.instructionEnhancement.temperature, // Use instruction enhancement as default
  maxTokens: config.llm.imageEditing.instructionEnhancement.maxTokens
}

export class ImageEditingGraph {
  private graph: any = null
  private contextAnalyzerNode: RemoteLLMChatNode | null = null
  private instructionEnhancerNode: RemoteLLMChatNode | null = null
  private config: ImageEditingGraphConfig
  private isInitialized = false

  constructor(graphConfig: Partial<ImageEditingGraphConfig> = {}) {
    this.config = { ...DEFAULT_IMAGE_EDITING_CONFIG, ...graphConfig }
  }

  /**
   * Builds the image editing graph
   * Architecture: Context Analysis → Instruction Enhancement → Flux Editing API → Session Storage → Response Generation
   */
  async build(): Promise<void> {
    try {
      logger.info('Building image editing graph', {
        contextAnalysisEnabled: this.config.contextAnalysisEnabled,
        instructionEnhancementEnabled: this.config.instructionEnhancementEnabled,
        provider: this.config.provider,
        model: this.config.modelName
      })

      // Create context analyzer node for determining target image and edit type
      if (this.config.contextAnalysisEnabled) {
        this.contextAnalyzerNode = new RemoteLLMChatNode({
          id: 'image_context_analyzer_llm',
          provider: this.config.provider,
          modelName: this.config.modelName,
          stream: config.llm.imageEditing.contextAnalysis.stream,
          textGenerationConfig: {
            maxNewTokens: config.llm.imageEditing.contextAnalysis.maxTokens,
            temperature: config.llm.imageEditing.contextAnalysis.temperature
          }
        })
      }

      // Create instruction enhancer node for improving edit prompts
      if (this.config.instructionEnhancementEnabled) {
        this.instructionEnhancerNode = new RemoteLLMChatNode({
          id: 'editing_instruction_enhancer_llm',
          provider: this.config.provider,
          modelName: this.config.modelName,
          stream: config.llm.imageEditing.instructionEnhancement.stream,
          textGenerationConfig: {
            maxNewTokens: config.llm.imageEditing.instructionEnhancement.maxTokens,
            temperature: config.llm.imageEditing.instructionEnhancement.temperature
          }
        })
      }

      // Build the graph with context analysis and instruction enhancement
      if (this.contextAnalyzerNode && this.instructionEnhancerNode) {
        this.graph = new GraphBuilder({
          id: 'image_editing_graph',
          apiKey: config.inworld.apiKey,
          enableRemoteConfig: true // Enable for A/B testing
        })
          .addNode(this.contextAnalyzerNode)
          .addNode(this.instructionEnhancerNode)
          .setStartNode(this.contextAnalyzerNode)
          .setEndNode(this.instructionEnhancerNode)
          .build()
      } else if (this.instructionEnhancerNode) {
        // Simplified graph with just instruction enhancement
        this.graph = new GraphBuilder({
          id: 'image_editing_graph',
          apiKey: config.inworld.apiKey,
          enableRemoteConfig: true // Enable for A/B testing
        })
          .addNode(this.instructionEnhancerNode)
          .setStartNode(this.instructionEnhancerNode)
          .setEndNode(this.instructionEnhancerNode)
          .build()
      } else {
        // Minimal graph for direct editing without LLM enhancement
        this.graph = new GraphBuilder({
          id: 'image_editing_graph',
          apiKey: config.inworld.apiKey,
          enableRemoteConfig: true // Enable for A/B testing
        })
          .build()
      }

      this.isInitialized = true
      logger.info('Image editing graph built successfully')

    } catch (error) {
      logger.error('Failed to build image editing graph', { error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  /**
   * Main execution method for image editing workflow
   */
  async execute(request: ImageEditingRequest): Promise<ImageEditingResult> {
    const startTime = Date.now()

    try {
      if (!this.isInitialized) {
        await this.build()
      }

      logger.info('Executing image editing workflow', {
        sessionId: request.sessionId,
        hasTargetId: !!request.targetImageId,
        editType: request.editType,
        instruction: request.editInstruction.substring(0, 100)
      })

      // Step 1: Determine target image if not provided
      let targetImageId = request.targetImageId
      if (!targetImageId) {
        const determinedImageId = await this.determineTargetImage(request.sessionId, request.editInstruction)
        targetImageId = determinedImageId || undefined
        if (!targetImageId) {
          // Get contextual error message based on session state
          const contextualError = await this.getContextualErrorMessage(request.sessionId, request.editInstruction)
          return {
            success: false,
            error: contextualError,
            suggestions: [
              'Upload an image to edit',
              'Generate an image first, then edit it',
              'Try: "Create a sunset image and then make it brighter"'
            ]
          }
        }
      }

      // Step 2: Get target image metadata
      const session = await sessionManager.getSession(request.sessionId)
      if (!session) {
        return {
          success: false,
          error: 'Session not found'
        }
      }

      const originalImage = session.uploadedImages.get(targetImageId) || session.generatedImages.get(targetImageId)
      if (!originalImage) {
        return {
          success: false,
          error: 'Target image not found in session'
        }
      }

      // Step 3: Analyze context and enhance editing instruction
      let enhancedInstruction = request.editInstruction
      let editType = request.editType || 'enhance'

      if (this.config.contextAnalysisEnabled || this.config.instructionEnhancementEnabled) {
        const analysisResult = await this.analyzeAndEnhanceInstruction(
          request.editInstruction,
          originalImage,
          session.conversationHistory
        )
        enhancedInstruction = analysisResult.enhancedInstruction
        editType = analysisResult.editType as 'enhance' | 'inpaint' | 'outpaint' | 'style_transfer' | 'variant'
      }

      // Step 4: Execute image editing
      const editingResult = await this.performImageEdit(
        originalImage,
        enhancedInstruction,
        editType,
        request
      )

      if (!editingResult.success) {
        return editingResult
      }

      // Step 5: Store edited image in session
      const editedImageMetadata: ImageMetadata = {
        id: crypto.randomUUID(),
        originalName: `edited_${originalImage.originalName}`,
        mimeType: originalImage.mimeType,
        size: editingResult.size || originalImage.size,
        uploadedAt: new Date(),
        storageUrl: editingResult.imageUrl!,
        description: `Edited: ${enhancedInstruction}`,
        generatedBy: 'flux_generation'
      }

      await sessionManager.addImage(request.sessionId, editedImageMetadata)

      // Step 6: Generate suggestions for follow-up actions
      const suggestions = this.generateEditingSuggestions(editType, enhancedInstruction)

      const totalTime = Date.now() - startTime

      logger.info('Image editing workflow completed successfully', {
        sessionId: request.sessionId,
        originalImageId: targetImageId,
        editedImageId: editedImageMetadata.id,
        editType,
        totalTime
      })

      return {
        success: true,
        originalImageMetadata: originalImage,
        editedImageMetadata,
        enhancedInstruction,
        editingTime: totalTime,
        editType,
        suggestions
      }

    } catch (error) {
      logger.error('Image editing workflow failed', {
        sessionId: request.sessionId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        editingTime: Date.now() - startTime
      }
    }
  }

  /**
   * Gets contextual error message when no images are available for editing
   */
  private async getContextualErrorMessage(sessionId: string, instruction: string): Promise<string> {
    try {
      const session = await sessionManager.getSession(sessionId)
      if (!session) {
        return 'Session not found. Please refresh and try again.'
      }

      const hasUploadedImages = session.uploadedImages.size > 0
      const hasGeneratedImages = session.generatedImages.size > 0
      const conversationHistory = session.conversationHistory

      // Analyze the instruction to provide specific guidance
      const instructionLower = instruction.toLowerCase()
      const isSpecificEdit = instructionLower.includes('gothic') ||
                            instructionLower.includes('brighter') ||
                            instructionLower.includes('style') ||
                            instructionLower.includes('color')

      if (!hasUploadedImages && !hasGeneratedImages) {
        if (isSpecificEdit) {
          return `I'd love to ${instruction.toLowerCase()}, but I don't see any images to edit yet. ` +
                 `You can either upload an image or generate one first. ` +
                 `For example, try "Generate a landscape image" first, then I can make it gothic and satanic.`
        }
        return 'No images available for editing. Please upload an image or generate one first. ' +
               'Try: "Upload an image" or "Generate a beautiful landscape"'
      }

      if (hasGeneratedImages && !hasUploadedImages) {
        return 'I found some generated images in our conversation, but they might have expired. ' +
               'Try generating a new image first, then ask me to edit it.'
      }

      if (hasUploadedImages && !hasGeneratedImages) {
        return 'I found some uploaded images in our conversation, but I\'m having trouble accessing them. ' +
               'Try uploading a new image or generating one fresh.'
      }

      // General fallback
      return 'I couldn\'t find a suitable image to edit. Please specify which image to edit or upload/generate a new one.'

    } catch (error) {
      logger.error('Error generating contextual error message', { sessionId, error: error instanceof Error ? error.message : String(error) })
      return 'Unable to find an image to edit. Please upload an image or generate one first.'
    }
  }

  /**
   * Determines the target image for editing based on context
   */
  private async determineTargetImage(sessionId: string, instruction: string): Promise<string | null> {
    try {
      const session = await sessionManager.getSession(sessionId)
      if (!session) return null

      // Priority order:
      // 1. Active images (currently in context)
      // 2. Most recent uploaded image
      // 3. Most recent generated image

      if (session.currentContext.activeImages.length > 0) {
        return session.currentContext.activeImages[0] // Most recent active image
      }

      // Get all images sorted by upload time
      const allImages = await sessionManager.getSessionImages(sessionId)
      if (allImages.length === 0) return null

      // Check for specific references in the instruction
      const instructionLower = instruction.toLowerCase()

      // Look for specific image references
      if (instructionLower.includes('last') || instructionLower.includes('recent')) {
        return allImages[0].id // Most recent image
      }

      if (instructionLower.includes('first') || instructionLower.includes('original')) {
        return allImages[allImages.length - 1].id // Oldest image
      }

      // Search by description/content
      const matchingImage = allImages.find(img => {
        const description = img.description?.toLowerCase() || ''
        const name = img.originalName.toLowerCase()
        return description.includes(instructionLower.split(' ')[0]) ||
               name.includes(instructionLower.split(' ')[0])
      })

      if (matchingImage) {
        return matchingImage.id
      }

      // Default to most recent image
      return allImages[0].id

    } catch (error) {
      logger.error('Failed to determine target image', { sessionId, error: error instanceof Error ? error.message : String(error) })
      return null
    }
  }

  /**
   * Analyzes context and enhances editing instruction using LLM
   */
  private async analyzeAndEnhanceInstruction(
    instruction: string,
    targetImage: ImageMetadata,
    conversationHistory: any[]
  ): Promise<{ enhancedInstruction: string; editType: string }> {
    try {
      if (!this.instructionEnhancerNode) {
        return {
          enhancedInstruction: instruction,
          editType: 'enhance'
        }
      }

      const conversationContext = conversationHistory.slice(-3).map(turn =>
        `User: ${turn.userInput}\nAssistant: ${typeof turn.response === 'string' ? turn.response.substring(0, 100) : '[Image/Media]'}`
      ).join('\n')

      const contextPrompt = await renderJinja(CONTEXT_ANALYSIS_AND_INSTRUCTION_ENHANCEMENT_TEMPLATE, {
        targetImage: targetImage.description || targetImage.originalName,
        instruction,
        conversationContext
      })

      const graphInput = {
        messages: [
          {
            role: 'system',
            content: contextPrompt
          }
        ]
      }

      const outputStream = this.graph.start(new GraphTypes.LLMChatRequest(graphInput), crypto.randomUUID())
      if (!outputStream) {
        throw new Error('Failed to start image editing graph')
      }

      let response = ''
      for await (const result of outputStream) {
        await result.processResponse({
          Content: (content: GraphTypes.Content) => {
            response += content.content || ''
          },
          ContentStream: async (stream: GraphTypes.ContentStream) => {
            for await (const chunk of stream) {
              if (chunk.text) {
                response += chunk.text
              }
            }
          },
          default: (data: any) => {
            console.warn('Unprocessed response in image editing:', data)
          }
        })
      }

      // Parse LLM response
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          return {
            enhancedInstruction: parsed.enhancedInstruction || instruction,
            editType: parsed.editType || 'enhance'
          }
        }
      } catch (parseError) {
        logger.warn('Failed to parse LLM enhancement response', { response })
      }

      // Fallback to original instruction
      return {
        enhancedInstruction: instruction,
        editType: 'enhance'
      }

    } catch (error) {
      logger.error('Failed to enhance editing instruction', { error: error instanceof Error ? error.message : String(error) })
      return {
        enhancedInstruction: instruction,
        editType: 'enhance'
      }
    }
  }

  /**
   * Performs the actual image editing using Flux API
   */
  private async performImageEdit(
    originalImage: ImageMetadata,
    instruction: string,
    editType: string,
    request: ImageEditingRequest
  ): Promise<{ success: boolean; imageUrl?: string; size?: number; error?: string }> {
    try {
      // For now, use the general image editing API
      // In the future, we can add specific methods for different edit types
      const result = await fluxApiService.editImage({
        imageUrl: originalImage.storageUrl,
        instruction: instruction,
        strength: request.strength || 0.7,
        guidance: request.guidance || 7.5,
        editType: editType as any
      })

      if (result.success && result.imageUrl) {
        return {
          success: true,
          imageUrl: result.imageUrl,
          size: result.size
        }
      } else {
        return {
          success: false,
          error: result.error || 'Image editing failed'
        }
      }

    } catch (error) {
      logger.error('Image editing API call failed', { error: error instanceof Error ? error.message : String(error) })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Generates contextual suggestions for follow-up editing actions
   */
  private generateEditingSuggestions(editType: string, instruction: string): string[] {
    const suggestions: string[] = []

    switch (editType) {
      case 'enhance':
        suggestions.push(
          'Try a different enhancement style?',
          'Adjust the enhancement strength?',
          'Apply additional color correction?'
        )
        break
      case 'inpaint':
        suggestions.push(
          'Edit another area of the image?',
          'Refine the current edit?',
          'Try a different object in the same area?'
        )
        break
      case 'style_transfer':
        suggestions.push(
          'Try a different artistic style?',
          'Adjust the style strength?',
          'Apply the style to a different image?'
        )
        break
      case 'variant':
        suggestions.push(
          'Generate more variations?',
          'Try a different variation style?',
          'Create variations of the edited result?'
        )
        break
      default:
        suggestions.push(
          'Apply a different edit to this image?',
          'Generate a variation of this edit?',
          'Try editing another image?'
        )
    }

    return suggestions
  }

  /**
   * Configuration and status methods
   */
  getConfig(): ImageEditingGraphConfig {
    return { ...this.config }
  }

  isReady(): boolean {
    return this.isInitialized && this.graph !== null
  }

  async destroy(): Promise<void> {
    try {
      if (this.graph) {
        await this.graph.destroy()
        this.graph = null
      }
      this.contextAnalyzerNode = null
      this.instructionEnhancerNode = null
      this.isInitialized = false

      logger.info('Image editing graph destroyed')
    } catch (error) {
      logger.error('Error destroying image editing graph', { error: error instanceof Error ? error.message : String(error) })
    }
  }
}
