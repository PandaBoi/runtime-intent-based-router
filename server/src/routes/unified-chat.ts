import { NextFunction, Request, Response, Router } from 'express'
import { ChatService } from '../services/chat-service'
import { imageEditingService } from '../services/image-editing.service'
import { imageGenerationService } from '../services/image-generation.service'
import { sessionManager } from '../services/session-manager.service'
import { IntentType } from '../types'
import { AppError } from '../utils/error-handler'
import { logger } from '../utils/logger'

const router = Router()
const chatService = new ChatService()

// Initialize services when routes are loaded
chatService.initialize().catch(error => {
  logger.error('Failed to initialize unified chat service:', error)
})

imageEditingService.initialize().catch(error => {
  logger.error('Failed to initialize image editing service:', error)
})

/**
 * POST /api/chat
 * Unified chat endpoint that handles all conversation types
 * Automatically detects intent and routes to appropriate services
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      message,
      sessionId,
      skipIntentDetection = false,
      imageOptions = {}
    } = req.body

    if (!message || typeof message !== 'string') {
      throw new AppError('Message is required and must be a string', 400)
    }

    logger.info('Processing unified chat request', {
      message: message.substring(0, 100),
      sessionId: sessionId || 'new',
      skipIntentDetection,
      hasImageOptions: Object.keys(imageOptions).length > 0
    })

    // Process message through chat service (which handles intent routing)
    const responseMessage = await chatService.processMessage(message, sessionId, skipIntentDetection)

    // Get session context after processing
    const context = await chatService.getSessionContext(responseMessage.sessionId)

    // Enhance response with additional context
    const enhancedResponse = {
      success: true,
      data: {
        message: responseMessage,
        sessionId: responseMessage.sessionId,
        detectedIntent: context?.lastIntent || IntentType.CHAT,
        context: {
          conversationLength: context?.conversationLength || 0,
          hasImages: context?.hasImages || false,
          imageCount: context?.stats?.imageCount || 0,
          activeImages: context?.stats?.imageCount || 0,
          sessionDuration: context?.stats?.sessionDuration || 0
        },
        capabilities: {
          imageGeneration: true,
          imageEditing: true, // Now available!
          conversationHistory: true,
          sessionPersistence: true
        },
        suggestions: undefined as string[] | undefined
      },
      timestamp: new Date()
    }

    // Add suggestions based on the last intent
    if (context?.lastIntent === IntentType.GENERATE_IMAGE) {
      const suggestions = await imageGenerationService.getImageGenerationSuggestions(responseMessage.sessionId)
      if (suggestions.success) {
        enhancedResponse.data.suggestions = suggestions.data
      }
    } else if (context?.lastIntent === IntentType.EDIT_IMAGE) {
      const suggestions = await imageEditingService.getEditingSuggestions(responseMessage.sessionId)
      enhancedResponse.data.suggestions = suggestions
    }

    res.json(enhancedResponse)

  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/chat/sessions
 * Create a new chat session
 */
router.post('/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Session creation endpoint called')
    const sessionId = await chatService.createSession()
    logger.info('Session created successfully', { sessionId })

    res.json({
      success: true,
      data: {
        sessionId: sessionId,
        message: 'Session created successfully',
        capabilities: {
          imageGeneration: true,
          imageEditing: true,
          conversationHistory: true,
          sessionPersistence: true
        }
      },
      timestamp: new Date()
    })
  } catch (error) {
    logger.error('Session creation failed', { error: error instanceof Error ? error.message : String(error) })
    next(error)
  }
})

/**
 * GET /api/chat/sessions/:sessionId
 * Get session information and history
 */
router.get('/sessions/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params

    // Get conversation history
    const history = await chatService.getSessionHistory(sessionId)

    // Get session context
    const context = await chatService.getSessionContext(sessionId)

    // Get session images
    const imagesResult = await imageGenerationService.getSessionImages(sessionId)

    res.json({
      success: true,
      data: {
        sessionId,
        history,
        context,
        images: imagesResult.success ? imagesResult.data : [],
        stats: {
          messageCount: history.length,
          imageCount: imagesResult.success ? imagesResult.data?.length || 0 : 0,
          lastActivity: history[history.length - 1]?.timestamp || new Date(),
          intents: [...new Set(history.map(h => h.detectedIntent).filter(Boolean))]
        }
      },
      timestamp: new Date()
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/chat/sessions/:sessionId/context
 * Get current session context and statistics
 */
router.get('/sessions/:sessionId/context', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params
    const context = await chatService.getSessionContext(sessionId)

    res.json({
      success: true,
      data: context,
      timestamp: new Date()
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/chat/sessions/:sessionId/images
 * Get all images for a session with metadata
 */
router.get('/sessions/:sessionId/images', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params
    const result = await imageGenerationService.getSessionImages(sessionId)

    if (result.success) {
      res.json({
        success: true,
        data: {
          sessionId,
          images: result.data,
          count: result.data?.length || 0
        },
        timestamp: new Date()
      })
    } else {
      throw new AppError(result.error || 'Failed to get session images', 500)
    }
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/chat/images/generate
 * Direct image generation endpoint (bypasses intent detection)
 */
router.post('/images/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      prompt,
      sessionId,
      model,
      quality = 'balanced',
      width,
      height,
      style
    } = req.body

    if (!prompt || typeof prompt !== 'string') {
      throw new AppError('Prompt is required and must be a string', 400)
    }

    if (!sessionId) {
      throw new AppError('Session ID is required for image generation', 400)
    }

    logger.info('Direct image generation request', {
      prompt: prompt.substring(0, 50),
      sessionId,
      quality,
      model
    })

    const result = await imageGenerationService.generateImage(prompt, sessionId, {
      model,
      quality,
      width,
      height,
      style
    })

    if (result.success) {
      res.json({
        success: true,
        data: {
          image: result.data?.imageMetadata,
          enhancedPrompt: result.data?.enhancedPrompt,
          generationTime: result.data?.generationTime,
          suggestions: result.data?.suggestions,
          sessionId
        },
        timestamp: new Date()
      })
    } else {
      throw new AppError(result.error || 'Image generation failed', 500)
    }
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/chat/suggestions/:sessionId
 * Get contextual suggestions for the user
 */
router.get('/suggestions/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params

    // Get image generation suggestions
    const imageGenSuggestions = await imageGenerationService.getImageGenerationSuggestions(sessionId)

    // Get session context for more suggestions
    const context = await chatService.getSessionContext(sessionId)

    const suggestions = []

    // Add image-related suggestions
    if (imageGenSuggestions.success && imageGenSuggestions.data) {
      suggestions.push(...imageGenSuggestions.data)
    }

    // Add context-based suggestions
    if (context?.hasImages) {
      suggestions.push('Tell me about the images in this session')
      suggestions.push('Generate a variation of the last image')
    }

    if (context?.conversationLength > 0) {
      suggestions.push('Summarize our conversation')
      suggestions.push('Continue our discussion')
    }

    // Default suggestions
    if (suggestions.length === 0) {
      suggestions.push(
        'Generate a beautiful landscape image',
        'Create a portrait of someone interesting',
        'Help me brainstorm some creative ideas'
      )
    }

    res.json({
      success: true,
      data: {
        suggestions: suggestions.slice(0, 6), // Limit to 6 suggestions
        sessionId,
        contextAware: context?.conversationLength > 0
      },
      timestamp: new Date()
    })
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /api/chat/sessions/:sessionId
 * Close and cleanup a session
 */
router.delete('/sessions/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params

    await chatService.closeSession(sessionId)

    res.json({
      success: true,
      message: 'Session closed successfully',
      sessionId,
      timestamp: new Date()
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/chat/health
 * Health check for all chat services
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = {
      chatService: true, // Chat service doesn't have a health check method
      imageGeneration: await imageGenerationService.healthCheck(),
      imageEditing: await imageEditingService.healthCheck(),
      sessionManager: sessionManager.getSession('test') !== undefined, // Basic check
      timestamp: new Date()
    }

    const isHealthy = Object.values(health).every(status => status === true || typeof status === 'object')

    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      data: health,
      timestamp: new Date()
    })
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Health check failed',
      timestamp: new Date()
    })
  }
})

export { router as unifiedChatRoutes }
