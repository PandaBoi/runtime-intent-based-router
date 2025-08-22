import { Router } from 'express'
import { chatService } from '../services/chat-service'
import { sessionManager } from '../services/session-manager.service'
import { logger } from '../utils/logger'

const router = Router()

/**
 * POST /api/chat/sessions
 * Create a new chat session
 */
router.post('/sessions', async (req, res) => {
  try {
    const sessionId = await chatService.createSession()
    
    res.status(201).json({
      success: true,
      data: {
        sessionId,
        message: 'Session created successfully'
      },
      timestamp: new Date()
    })
  } catch (error) {
    logger.error('Failed to create chat session:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create session',
      timestamp: new Date()
    })
  }
})

/**
 * POST /api/chat/message
 * Send a message in a chat session
 */
router.post('/message', async (req, res) => {
  try {
    const { message, sessionId, skipIntentDetection = false } = req.body

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message is required and must be a string',
        timestamp: new Date()
      })
    }

    // Process the message
    const response = await chatService.processMessage(
      message, 
      sessionId, 
      skipIntentDetection
    )

    // Get session context for additional info
    const context = await chatService.getSessionContext(response.sessionId)

    res.json({
      success: true,
      data: {
        message: response,
        context: {
          sessionId: response.sessionId,
          conversationLength: context?.conversationLength || 0,
          lastIntent: context?.lastIntent,
          hasImages: (context?.totalImages || 0) > 0
        }
      },
      timestamp: new Date()
    })

  } catch (error) {
    logger.error('Failed to process chat message:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to process message',
      timestamp: new Date()
    })
  }
})

/**
 * GET /api/chat/sessions/:sessionId
 * Get session information and history
 */
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params
    
    const session = await sessionManager.getSession(sessionId)
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        timestamp: new Date()
      })
    }

    const context = await chatService.getSessionContext(sessionId)
    const history = await chatService.getSessionHistory(sessionId)

    res.json({
      success: true,
      data: {
        session: context,
        history: history.map(turn => ({
          id: turn.id,
          timestamp: turn.timestamp,
          userInput: turn.userInput,
          detectedIntent: turn.detectedIntent,
          confidence: turn.confidence,
          response: typeof turn.response === 'object' && 'content' in turn.response 
            ? turn.response.content 
            : turn.response
        })),
        images: await sessionManager.getSessionImages(sessionId)
      },
      timestamp: new Date()
    })

  } catch (error) {
    logger.error('Failed to get session:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session',
      timestamp: new Date()
    })
  }
})

/**
 * GET /api/chat/sessions/:sessionId/context
 * Get session context and active images
 */
router.get('/sessions/:sessionId/context', async (req, res) => {
  try {
    const { sessionId } = req.params
    
    const session = await sessionManager.getSession(sessionId)
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        timestamp: new Date()
      })
    }

    const activeImages = await sessionManager.getActiveImages(sessionId)
    const sessionStats = await sessionManager.getSessionStats(sessionId)

    res.json({
      success: true,
      data: {
        sessionId,
        context: session.currentContext,
        activeImages,
        stats: sessionStats,
        suggestions: await sessionManager.suggestFollowUpActions(sessionId)
      },
      timestamp: new Date()
    })

  } catch (error) {
    logger.error('Failed to get session context:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session context',
      timestamp: new Date()
    })
  }
})

/**
 * DELETE /api/chat/sessions/:sessionId
 * Close a chat session
 */
router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params
    
    await chatService.closeSession(sessionId)
    
    res.json({
      success: true,
      data: {
        message: 'Session closed successfully'
      },
      timestamp: new Date()
    })

  } catch (error) {
    logger.error('Failed to close session:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to close session',
      timestamp: new Date()
    })
  }
})

/**
 * POST /api/chat/analyze
 * Analyze context for a given input (without sending message)
 */
router.post('/analyze', async (req, res) => {
  try {
    const { input, sessionId } = req.body

    if (!input || !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Input and sessionId are required',
        timestamp: new Date()
      })
    }

    const session = await sessionManager.getSession(sessionId)
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        timestamp: new Date()
      })
    }

    // Analyze context without executing
    const contextRefs = await sessionManager.analyzeContext(sessionId, input)
    const relevantImages = await sessionManager.findRelevantImages(sessionId, input)
    const editTarget = await sessionManager.determineImageEditTarget(sessionId, input)

    res.json({
      success: true,
      data: {
        contextReferences: contextRefs,
        relevantImages,
        suggestedEditTarget: editTarget,
        analysis: {
          hasImageReferences: contextRefs.some(ref => ref.type === 'image'),
          hasConversationReferences: contextRefs.some(ref => ref.type === 'message'),
          likelyImageEdit: editTarget !== null
        }
      },
      timestamp: new Date()
    })

  } catch (error) {
    logger.error('Failed to analyze context:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to analyze context',
      timestamp: new Date()
    })
  }
})

export { router as chatRoutes }