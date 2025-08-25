import { v4 as uuidv4 } from 'uuid'
import { ChatGraph } from '../graphs/chat.graph'
import { ChatMessage, IntentType } from '../types'
import { ConversationTurn } from '../types/session'
import { logger } from '../utils/logger'
import { imageEditingService } from './image-editing.service'
import { imageGenerationService } from './image-generation.service'
import { intentDetectionService } from './intent-detection.service'
import { sessionManager } from './session-manager.service'

export class ChatService {
  private chatGraph: ChatGraph
  private isInitialized = false

  constructor() {
    this.chatGraph = new ChatGraph()
  }

  async initialize(): Promise<void> {
    try {
      // Initialize intent detection service first
      const isIntentHealthy = await intentDetectionService.healthCheck()
      if (!isIntentHealthy) {
        logger.info('Initializing intent detection service...')
        await intentDetectionService.initialize()
      }

      // Initialize image generation service
      const isImageGenHealthy = await imageGenerationService.healthCheck()
      if (!isImageGenHealthy) {
        logger.info('Initializing image generation service...')
        await imageGenerationService.initialize()
      }

      // Initialize chat graph
      await this.chatGraph.build()
      this.isInitialized = true

      logger.info('Chat service initialized with graph, intent detection, and image generation')
    } catch (error) {
      logger.error('Failed to initialize chat service:', error)
      throw error
    }
  }

  async processMessage(
    message: string,
    sessionId?: string,
    skipIntentDetection = false
  ): Promise<ChatMessage> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      // Get or create session
      let session = sessionId ? await sessionManager.getSession(sessionId) : null
      if (!session) {
        session = await sessionManager.createSession()
        sessionId = session.sessionId
      }

      // At this point sessionId is guaranteed to be defined
      const finalSessionId: string = sessionId!

      let detectedIntent = IntentType.CHAT
      let confidence = 1.0

      // Detect intent unless skipped (for direct chat requests)
      if (!skipIntentDetection) {
        const intentResult = await intentDetectionService.detectIntent(message)
        if (intentResult.success && intentResult.data) {
          detectedIntent = intentResult.data.intent
          confidence = intentResult.data.confidence
        }
      }

      let responseText = ''

      // Route based on detected intent
      if (detectedIntent === IntentType.GENERATE_IMAGE && !skipIntentDetection) {
        logger.info('Routing to image generation service', { sessionId, confidence })

        try {
          const imageResult = await imageGenerationService.generateImage(
            message,
            finalSessionId,
            { quality: 'balanced' }
          )

          if (imageResult.success && imageResult.data?.imageMetadata) {
            const imageData = imageResult.data
            responseText = `**Image Generated Successfully!**\n\n` +
              `**Image URL**: ${imageData.imageMetadata!.storageUrl}\n` +
              `**Enhanced Prompt**: ${imageData.enhancedPrompt}\n` +
              `**Generation Time**: ${imageData.generationTime}ms\n` +
              `**Suggestions**: ${imageData.suggestions?.join(', ')}\n\n` +
              `Your image has been added to this session!`
          } else {
            responseText = `**Image Generation Failed**: ${imageResult.error}\n\nPlease try again with a different prompt.`
          }
        } catch (error) {
          logger.error('Image generation error in chat service:', error)
          responseText = `**Image Generation Error**: I encountered a technical issue. Please try again later.`
        }
      } else if (detectedIntent === IntentType.EDIT_IMAGE && !skipIntentDetection) {
        // Handle image editing request
        try {
                  const editingResult = await imageEditingService.editImage({
          editInstruction: message,
          sessionId: finalSessionId
        })

          if (editingResult.success && editingResult.data) {
            responseText = `**Image Edited Successfully!**\n\n${editingResult.data.enhancedInstruction}\n\n` +
              `**Edit Type**: ${editingResult.data.editType}\n` +
              `**Processing Time**: ${(editingResult.data.editingTime / 1000).toFixed(1)}s\n\n` +
              `The edited image has been saved to your session. You can view it in the image gallery.`
          } else {
            responseText = `**Image Editing Failed**: ${editingResult.error}\n\n` +
              `This could be because:\n` +
              `• No images available for editing (try uploading an image first)\n` +
              `• The editing instruction wasn't clear\n` +
              `• Technical issue with the editing service\n\n` +
              `Try: "Upload an image" or "Generate an image first"`
          }
        } catch (error) {
          logger.error('Image editing error in chat service:', error)
          responseText = `**Image Editing Error**: I encountered a technical issue. Please try again later.`
        }
      } else {
        // Process with chat graph for regular conversation
        const outputStream = await this.chatGraph.execute(message, finalSessionId)

        for await (const result of outputStream) {
          await result.processResponse({
            Content: (response: any) => {
              responseText = response.content || ''
            },
            ContentStream: async (stream: any) => {
              for await (const chunk of stream) {
                if (chunk.text) {
                  responseText += chunk.text
                }
              }
            },
            string: (text: string) => {
              responseText = text
            },
            default: (data: any) => {
              logger.warn('Unprocessed chat response:', data)
            }
          })
        }

        if (!responseText) {
          responseText = 'I apologize, but I couldn\'t generate a response. Please try again.'
        }
      }

      // Create response message
      const responseMessage: ChatMessage = {
        id: uuidv4(),
        content: responseText,
        timestamp: new Date(),
        role: 'assistant',
        sessionId: finalSessionId
      }

      // Add to chat graph conversation history
      this.chatGraph.addAssistantResponse(responseText)

      // Create conversation turn for session
      const conversationTurn: ConversationTurn = {
        id: uuidv4(),
        timestamp: new Date(),
        userInput: message,
        detectedIntent,
        confidence,
        response: responseMessage
      }

      // Add to session
      await sessionManager.addConversationTurn(finalSessionId, conversationTurn)

      logger.info('Chat message processed successfully', {
        sessionId,
        intent: detectedIntent,
        confidence,
        responseLength: responseText.length
      })

      return responseMessage

    } catch (error) {
      logger.error('Chat service error:', error)

      // Return a fallback response
      return {
        id: uuidv4(),
        content: 'I apologize, but I encountered an error processing your message. Please try again.',
        timestamp: new Date(),
        role: 'assistant',
        sessionId: sessionId || 'fallback'
      }
    }
  }

  async createSession(): Promise<string> {
    const session = await sessionManager.createSession()
    logger.info('New chat session created', { sessionId: session.sessionId })
    return session.sessionId
  }

  async getSessionHistory(sessionId: string): Promise<ConversationTurn[]> {
    const session = await sessionManager.getSession(sessionId)
    return session ? session.conversationHistory : []
  }

  async getSessionContext(sessionId: string): Promise<any> {
    const session = await sessionManager.getSession(sessionId)
    if (!session) return null

    return {
      sessionId: session.sessionId,
      conversationLength: session.conversationHistory.length,
      lastIntent: session.currentContext.lastIntent,
      activeImages: session.currentContext.activeImages,
      totalImages: session.uploadedImages.size + session.generatedImages.size,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    // Clear chat graph history for this session
    this.chatGraph.clearHistory()

    // Session cleanup is handled by sessionManager automatically
    logger.info('Chat session closed', { sessionId })
  }

  async healthCheck(): Promise<boolean> {
    return this.isInitialized && this.chatGraph.isReady()
  }

  async disconnect(): Promise<void> {
    await this.chatGraph.destroy()
    this.isInitialized = false
    logger.info('Chat service disconnected')
  }
}

export const chatService = new ChatService()