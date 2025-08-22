import {
  GraphBuilder,
  GraphTypes,
  RemoteLLMChatNode
} from '@inworld/runtime/graph'
import { renderJinja } from '@inworld/runtime/primitives/llm'
import { v4 as uuidv4 } from 'uuid'
import { config } from '../config'
import { fluxApiService } from '../services/flux-api.service'
import { sessionManager } from '../services/session-manager.service'
import { ImageMetadata } from '../types/session'
import { logger } from '../utils/logger'

/**
 * Image Generation Graph Configuration
 *
 * This graph orchestrates the complete image generation workflow:
 * 1. Prompt Enhancement (using Inworld Runtime LLM)
 * 2. Image Generation (using Flux API)
 * 3. Session Storage (updating user session)
 * 4. Response Generation (contextual user response)
 */

export interface ImageGenerationRequest {
  prompt: string
  sessionId: string
  model?: string
  width?: number
  height?: number
  style?: string
  quality?: 'fast' | 'balanced' | 'high'
}

export interface ImageGenerationResult {
  success: boolean
  imageMetadata?: ImageMetadata
  enhancedPrompt?: string
  generationTime?: number
  error?: string
  suggestions?: string[]
}

export interface ImageGenerationGraphConfig {
  promptEnhancementEnabled: boolean
  provider: string
  modelName: string
  temperature: number
  maxTokens: number
}

export const DEFAULT_IMAGE_GENERATION_CONFIG: ImageGenerationGraphConfig = {
  promptEnhancementEnabled: true,
  provider: 'openai',
  modelName: 'gpt-4o-mini',
  temperature: 0.8, // Higher creativity for prompt enhancement
  maxTokens: 200
}

export class ImageGenerationGraph {
  private graph: any = null
  private promptEnhancerNode: RemoteLLMChatNode | null = null
  private config: ImageGenerationGraphConfig
  private isInitialized = false

  constructor(graphConfig: Partial<ImageGenerationGraphConfig> = {}) {
    this.config = { ...DEFAULT_IMAGE_GENERATION_CONFIG, ...graphConfig }
  }

  /**
   * Builds the image generation graph
   * Architecture: Prompt Enhancement LLM → Flux API → Session Storage → Response Generation
   */
  async build(): Promise<void> {
    try {
      logger.info('Building image generation graph', {
        promptEnhancementEnabled: this.config.promptEnhancementEnabled,
        provider: this.config.provider,
        model: this.config.modelName
      })

      // Only create prompt enhancement node if enabled
      if (this.config.promptEnhancementEnabled) {
        this.promptEnhancerNode = new RemoteLLMChatNode({
          id: 'prompt_enhancer_llm',
          provider: 'openai',
          modelName: 'gpt-4o-mini',
          stream: false, // We want complete enhanced prompts
          textGenerationConfig: {
            maxNewTokens: 300,
            temperature: 0.8
          }
        })

        // Build the graph with prompt enhancement
        this.graph = new GraphBuilder({
          id: 'image_generation_graph',
          apiKey: config.inworld.apiKey,
          enableRemoteConfig: true // Enable for A/B testing
        })
          .addNode(this.promptEnhancerNode)
          .setStartNode(this.promptEnhancerNode)
          .setEndNode(this.promptEnhancerNode)
          .build()
      }

      this.isInitialized = true
      logger.info('Image generation graph built successfully')
    } catch (error) {
      logger.error('Failed to build image generation graph:', error)
      throw error
    }
  }

  /**
   * Executes the complete image generation workflow
   */
  async execute(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const startTime = Date.now()

    try {
      if (!this.isInitialized) {
        await this.build()
      }

      logger.info('Starting image generation workflow', {
        sessionId: request.sessionId,
        prompt: request.prompt.substring(0, 50),
        model: request.model,
        promptEnhancement: this.config.promptEnhancementEnabled
      })

      // Step 1: Enhance prompt using Inworld Runtime LLM (if enabled)
      let enhancedPrompt = request.prompt
      if (this.config.promptEnhancementEnabled && this.graph && this.promptEnhancerNode) {
        enhancedPrompt = await this.enhancePrompt(request.prompt, request.sessionId)
        logger.info('Prompt enhanced successfully', {
          original: request.prompt.substring(0, 50),
          enhanced: enhancedPrompt.substring(0, 50)
        })
      }

      // Step 2: Generate image using Flux API
      const fluxResult = await fluxApiService.generateImage({
        prompt: enhancedPrompt,
        model: request.model || this.getOptimalModel(request.quality),
        width: request.width || 1024,
        height: request.height || 1024,
        output_format: 'jpeg'
      })

      if (fluxResult.status !== 'completed' || !fluxResult.result?.images?.[0]) {
        throw new Error(`Image generation failed: ${fluxResult.error?.message || 'No image returned'}`)
      }

      const generatedImage = fluxResult.result.images[0]

      // Step 3: Create image metadata
      const imageMetadata: ImageMetadata = {
        id: uuidv4(),
        originalName: `generated-${Date.now()}.${generatedImage.content_type.split('/')[1]}`,
        mimeType: generatedImage.content_type,
        size: 0, // We don't have size info from URL
        uploadedAt: new Date(),
        storageUrl: generatedImage.url,
        description: enhancedPrompt,
        generatedBy: 'flux_generation'
      }

      // Step 4: Store in session
      await sessionManager.addImage(request.sessionId, imageMetadata)

      // Step 5: Generate follow-up suggestions
      const suggestions = await this.generateFollowUpSuggestions(enhancedPrompt, imageMetadata)

      const generationTime = Date.now() - startTime

      logger.info('Image generation workflow completed successfully', {
        sessionId: request.sessionId,
        imageId: imageMetadata.id,
        generationTime: `${generationTime}ms`,
        mode: config.flux.useMock ? 'MOCK' : 'REAL'
      })

      return {
        success: true,
        imageMetadata,
        enhancedPrompt,
        generationTime,
        suggestions
      }

    } catch (error) {
      const generationTime = Date.now() - startTime
      logger.error('Image generation workflow failed:', error, {
        sessionId: request.sessionId,
        prompt: request.prompt.substring(0, 50),
        generationTime: `${generationTime}ms`
      })

      return {
        success: false,
        error: error.message || 'Unknown error during image generation',
        generationTime
      }
    }
  }

  /**
   * Enhances prompt using Inworld Runtime LLM
   */
  private async enhancePrompt(originalPrompt: string, sessionId: string): Promise<string> {
    try {
      // Get user's recent conversation for context
      const session = await sessionManager.getSession(sessionId)
      const recentContext = session?.conversationHistory.slice(-3).map(turn =>
        `User: ${turn.userInput}\nAssistant: ${typeof turn.response === 'object' && 'content' in turn.response ? turn.response.content : turn.response}`
      ).join('\n') || ''

      const template = this.getPromptEnhancementTemplate()
      const enhancementPrompt = await renderJinja(template, {
        originalPrompt,
        conversationContext: recentContext || null
      })

      const graphInput = {
        messages: [
          {
            role: 'user',
            content: enhancementPrompt
          }
        ]
      }

      const outputStream = await this.graph.start(new GraphTypes.LLMChatRequest(graphInput), uuidv4())

      let enhancedPrompt = originalPrompt // Fallback to original

      for await (const result of outputStream) {
        await result.processResponse({
          Content: (response: any) => {
            enhancedPrompt = response.content || originalPrompt
          },
          ContentStream: async (stream: any) => {
            let streamContent = ''
            for await (const chunk of stream) {
              if (chunk.text) {
                streamContent += chunk.text
              }
            }
            enhancedPrompt = streamContent || originalPrompt
          },
          string: (text: string) => {
            enhancedPrompt = text || originalPrompt
          },
          default: (data: any) => {
            logger.warn('Unprocessed prompt enhancement response:', data)
          }
        })
      }

      return enhancedPrompt.trim() || originalPrompt

    } catch (error) {
      logger.warn('Failed to enhance prompt, using original:', error.message)
      return originalPrompt
    }
  }

  /**
   * Gets the Jinja template for prompt enhancement
   */
  private getPromptEnhancementTemplate(): string {
    return `You are an expert AI prompt engineer specializing in image generation. Your task is to enhance user prompts to create more detailed, visually compelling, and technically optimized prompts for image generation AI.

ENHANCEMENT GUIDELINES:
1. Add artistic style details (photography, digital art, painting, etc.)
2. Include lighting and composition details (cinematic, dramatic, soft lighting, etc.)
3. Specify quality and technical aspects (4K, detailed, high resolution, etc.)
4. Add atmospheric and mood elements
5. Include relevant artistic techniques or references
6. Keep the core subject and intent intact
7. Make it concise but descriptive (under 200 words)

{% if conversationContext %}
CONVERSATION CONTEXT:
{{ conversationContext }}
{% endif %}

EXAMPLES:
Input: "sunset"
Output: "A breathtaking sunset over rolling hills, golden hour lighting, vibrant orange and pink clouds, cinematic landscape photography, detailed and atmospheric, 4K quality"

Input: "cat"
Output: "A majestic domestic cat with striking green eyes, soft natural lighting, detailed fur texture, portrait photography style, shallow depth of field, high resolution"

ORIGINAL PROMPT: "{{ originalPrompt }}"

RESPOND WITH ONLY THE ENHANCED PROMPT. Do not include explanations or additional text.`
  }

  /**
   * Determines optimal model based on quality preference
   */
  private getOptimalModel(quality?: string): string {
    switch (quality) {
      case 'fast':
        return 'flux-1-schnell'
      case 'high':
        return 'flux-1-pro'
      case 'balanced':
      default:
        return 'flux-1-dev'
    }
  }

  /**
   * Generates contextual follow-up suggestions
   */
  private async generateFollowUpSuggestions(prompt: string, imageMetadata: ImageMetadata): Promise<string[]> {
    const suggestions = [
      'Generate a variation of this image',
      'Edit this image to make it brighter',
      'Create a similar image in a different style',
      'Generate another image with the same theme'
    ]

    // Add context-specific suggestions based on prompt
    if (prompt.toLowerCase().includes('landscape') || prompt.toLowerCase().includes('nature')) {
      suggestions.push('Generate this scene in different weather conditions')
    }

    if (prompt.toLowerCase().includes('portrait') || prompt.toLowerCase().includes('person')) {
      suggestions.push('Generate this portrait in different lighting')
    }

    return suggestions.slice(0, 3) // Return top 3 suggestions
  }

  /**
   * Check if graph is ready for execution
   */
  isReady(): boolean {
    if (!this.config.promptEnhancementEnabled) {
      return this.isInitialized
    }
    return this.isInitialized && this.graph !== null && this.promptEnhancerNode !== null
  }

  /**
   * Cleanup graph resources
   */
  async destroy(): Promise<void> {
    if (this.graph) {
      this.graph.cleanupAllExecutions()
      this.graph.destroy()
      this.graph = null
    }
    this.promptEnhancerNode = null
    this.isInitialized = false
    logger.info('Image generation graph destroyed')
  }

  /**
   * Get current configuration
   */
  getConfig(): ImageGenerationGraphConfig {
    return { ...this.config }
  }
}
