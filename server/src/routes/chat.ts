import { Router, Request, Response, NextFunction } from 'express'
import { ChatService } from '../services/chat-service'
import { AppError } from '../utils/error-handler'
import { logger } from '../utils/logger'

const router = Router()
const chatService = new ChatService()

router.post('/message', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, sessionId } = req.body

    if (!message) {
      throw new AppError('Message is required', 400)
    }

    logger.info('Processing chat message', { 
      message: message.substring(0, 100),
      sessionId 
    })

    const response = await chatService.processMessage(message, sessionId)

    res.json({
      success: true,
      data: response
    })
  } catch (error) {
    next(error)
  }
})

router.post('/session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = await chatService.createSession()
    
    res.json({
      success: true,
      data: { sessionId }
    })
  } catch (error) {
    next(error)
  }
})

router.delete('/session/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params
    await chatService.closeSession(sessionId)
    
    res.json({
      success: true,
      message: 'Session closed successfully'
    })
  } catch (error) {
    next(error)
  }
})

export { router as chatRoutes }