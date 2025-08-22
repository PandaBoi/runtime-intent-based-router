import { Router, Request, Response, NextFunction } from 'express'
import { inworldRuntimeService } from '../services/inworld-runtime.service'
import { intentDetectionService } from '../services/intent-detection.service'
import { imageGenerationService } from '../services/image-generation.service'
import { AppError } from '../types'
import { logger } from '../utils/logger'

const router = Router()

// Test Inworld Runtime service
router.post('/inworld/initialize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Testing Inworld Runtime service initialization')
    
    await inworldRuntimeService.initialize()
    const connectionState = inworldRuntimeService.getConnectionState()
    
    res.json({
      success: true,
      data: {
        initialized: true,
        connectionState,
        timestamp: new Date()
      }
    })
  } catch (error) {
    logger.error('Inworld Runtime initialization test failed:', error)
    next(error)
  }
})

router.post('/inworld/message', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, sessionId = 'test-session' } = req.body
    
    if (!message) {
      throw new AppError('Message is required', 400)
    }

    logger.info('Testing Inworld Runtime message processing', { 
      message: message.substring(0, 50),
      sessionId 
    })

    const response = await inworldRuntimeService.sendMessage(message, sessionId)
    
    res.json({
      success: true,
      data: response,
      timestamp: new Date()
    })
  } catch (error) {
    logger.error('Inworld Runtime message test failed:', error)
    next(error)
  }
})

router.get('/inworld/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isHealthy = await inworldRuntimeService.healthCheck()
    const connectionState = inworldRuntimeService.getConnectionState()
    
    res.json({
      success: true,
      data: {
        healthy: isHealthy,
        connectionState,
        timestamp: new Date()
      }
    })
  } catch (error) {
    logger.error('Inworld Runtime health check failed:', error)
    next(error)
  }
})

// Test Intent Detection service
router.post('/intent/initialize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Testing Intent Detection service initialization')
    
    await intentDetectionService.initialize()
    const isHealthy = await intentDetectionService.healthCheck()
    
    res.json({
      success: true,
      data: {
        initialized: true,
        healthy: isHealthy,
        timestamp: new Date()
      }
    })
  } catch (error) {
    logger.error('Intent Detection initialization test failed:', error)
    next(error)
  }
})

router.post('/intent/detect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { input } = req.body
    
    if (!input) {
      throw new AppError('Input text is required', 400)
    }

    // Initialize intent detection service if not already initialized
    const isHealthy = await intentDetectionService.healthCheck()
    if (!isHealthy) {
      logger.info('Initializing intent detection service...')
      await intentDetectionService.initialize()
    }

    logger.info('Testing Intent Detection', { 
      input: input.substring(0, 50)
    })

    const result = await intentDetectionService.detectIntent(input)
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date()
    })
  } catch (error) {
    logger.error('Intent Detection test failed:', error)
    next(error)
  }
})

// Test various intent patterns
router.get('/intent/test-patterns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const testInputs = [
      'Hello, how are you today?',
      'Generate an image of a sunset over mountains',
      'Create a picture of a red sports car',
      'Edit this image to make it brighter',
      'Remove the background from the photo',
      'What is the weather like?',
      'Can you help me with my homework?'
    ]

    logger.info('Testing intent detection with multiple patterns')

    const results = []
    for (const input of testInputs) {
      const result = await intentDetectionService.detectIntent(input)
      results.push({
        input,
        result: result.data
      })
    }

    res.json({
      success: true,
      data: {
        testResults: results,
        timestamp: new Date()
      }
    })
  } catch (error) {
    logger.error('Intent pattern testing failed:', error)
    next(error)
  }
})

// Combined service test
router.post('/combined/flow', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { input, sessionId = 'test-session' } = req.body
    
    if (!input) {
      throw new AppError('Input text is required', 400)
    }

    logger.info('Testing combined service flow', { 
      input: input.substring(0, 50),
      sessionId 
    })

    // Initialize intent detection service if not already initialized
    const isHealthy = await intentDetectionService.healthCheck()
    if (!isHealthy) {
      logger.info('Initializing intent detection service...')
      await intentDetectionService.initialize()
    }

    // Step 1: Detect intent
    const intentResult = await intentDetectionService.detectIntent(input)
    
    if (!intentResult.success) {
      throw new AppError('Intent detection failed', 500)
    }

    // Step 2: Route based on intent (for now, only chat is implemented)
    let serviceResponse = null
    
    if (intentResult.data?.intent === 'chat') {
      serviceResponse = await inworldRuntimeService.sendMessage(input, sessionId)
    } else {
      serviceResponse = {
        success: true,
        data: {
          message: `Intent '${intentResult.data?.intent}' detected but service not implemented yet`,
          intent: intentResult.data?.intent,
          confidence: intentResult.data?.confidence
        },
        timestamp: new Date()
      }
    }

    res.json({
      success: true,
      data: {
        intentDetection: intentResult.data,
        serviceResponse: serviceResponse.data,
        timestamp: new Date()
      }
    })
  } catch (error) {
    logger.error('Combined flow test failed:', error)
    next(error)
  }
})

/**
 * POST /api/test/image/generate
 * Test image generation
 */
router.post('/image/generate', async (req, res) => {
  try {
    const { prompt, sessionId, ...options } = req.body

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required and must be a string',
        timestamp: new Date()
      })
    }

    logger.info('Testing image generation', { 
      prompt: prompt.substring(0, 50),
      sessionId,
      options 
    })

    const result = await imageGenerationService.generateImage(prompt, sessionId, options)

    res.json({
      success: true,
      data: result,
      timestamp: new Date()
    })

  } catch (error) {
    logger.error('Image generation test failed:', error)
    res.status(500).json({
      success: false,
      error: 'Image generation test failed',
      timestamp: new Date()
    })
  }
})

/**
 * GET /api/test/image/service-info
 * Get image generation service information
 */
router.get('/image/service-info', async (req, res) => {
  try {
    const serviceInfo = imageGenerationService.getServiceInfo()
    const healthStatus = await imageGenerationService.healthCheck()

    res.json({
      success: true,
      data: {
        ...serviceInfo,
        healthy: healthStatus
      },
      timestamp: new Date()
    })

  } catch (error) {
    logger.error('Failed to get image service info:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get service information',
      timestamp: new Date()
    })
  }
})

/**
 * GET /api/test/image/session/:sessionId/images
 * Get images for a session
 */
router.get('/image/session/:sessionId/images', async (req, res) => {
  try {
    const { sessionId } = req.params
    const result = await imageGenerationService.getSessionImages(sessionId)

    res.json({
      success: true,
      data: result,
      timestamp: new Date()
    })

  } catch (error) {
    logger.error('Failed to get session images:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get session images',
      timestamp: new Date()
    })
  }
})

export { router as testRoutes }
