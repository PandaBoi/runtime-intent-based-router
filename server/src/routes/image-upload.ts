import express from 'express'
import multer from 'multer'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { imageEditingService } from '../services/image-editing.service'
import { sessionManager } from '../services/session-manager.service'
import { ImageMetadata } from '../types/session'
import { logger } from '../utils/logger'

const router = express.Router()

// Configure Multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Store uploads in a temporary directory
    const uploadDir = path.join(process.cwd(), 'uploads')
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const fileExtension = path.extname(file.originalname)
    const uniqueFileName = `${uuidv4()}${fileExtension}`
    cb(null, uniqueFileName)
  }
})

// File filter for images only
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true)
  } else {
    cb(new Error('Only image files are allowed'))
  }
}

// Multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only one file at a time
  }
})

/**
 * POST /api/chat/images/upload
 * Upload an image for editing
 */
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const { sessionId } = req.body
    const uploadedFile = req.file

    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      })
    }

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      })
    }

    // Verify session exists
    const session = await sessionManager.getSession(sessionId)
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      })
    }

    // Create image metadata
    const imageMetadata: ImageMetadata = {
      id: uuidv4(),
      originalName: uploadedFile.originalname,
      mimeType: uploadedFile.mimetype,
      size: uploadedFile.size,
      uploadedAt: new Date(),
      storageUrl: `/uploads/${uploadedFile.filename}`, // Will serve static files
      description: `Uploaded image: ${uploadedFile.originalname}`,
      generatedBy: 'user_upload'
    }

    // Add image to session
    await sessionManager.addImage(sessionId, imageMetadata)

    logger.info('Image uploaded successfully', {
      sessionId,
      imageId: imageMetadata.id,
      originalName: uploadedFile.originalname,
      size: uploadedFile.size,
      mimeType: uploadedFile.mimetype
    })

    res.json({
      success: true,
      data: {
        image: imageMetadata,
        message: `Image "${uploadedFile.originalname}" uploaded successfully. You can now edit it by saying "edit this image" or "make it brighter".`
      }
    })

  } catch (error) {
    logger.error('Image upload failed', { error: error.message })

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large. Maximum size is 10MB.'
      })
    }

    if (error.message === 'Only image files are allowed') {
      return res.status(400).json({
        success: false,
        error: 'Only image files are allowed. Please upload a JPEG, PNG, or WebP image.'
      })
    }

    res.status(500).json({
      success: false,
      error: 'Failed to upload image'
    })
  }
})

/**
 * GET /api/chat/images/:imageId
 * Get image metadata
 */
router.get('/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params
    const { sessionId } = req.query

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      })
    }

    const session = await sessionManager.getSession(sessionId as string)
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      })
    }

    // Find image in session
    const image = session.uploadedImages.get(imageId) || session.generatedImages.get(imageId)

    if (!image) {
      return res.status(404).json({
        success: false,
        error: 'Image not found'
      })
    }

    res.json({
      success: true,
      data: {
        image
      }
    })

  } catch (error) {
    logger.error('Failed to get image metadata', { error: error.message })
    res.status(500).json({
      success: false,
      error: 'Failed to get image metadata'
    })
  }
})

/**
 * GET /api/chat/images
 * Get all images for a session
 */
router.get('/', async (req, res) => {
  try {
    const { sessionId } = req.query

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      })
    }

    const images = await sessionManager.getSessionImages(sessionId as string)

    res.json({
      success: true,
      data: {
        images,
        count: images.length
      }
    })

  } catch (error) {
    logger.error('Failed to get session images', { error: error.message })
    res.status(500).json({
      success: false,
      error: 'Failed to get session images'
    })
  }
})

/**
 * POST /api/chat/images/edit
 * Edit an existing image
 */
router.post('/edit', async (req, res) => {
  try {
    const {
      editInstruction,
      sessionId,
      targetImageId,
      editType = 'enhance',
      strength = 0.7,
      guidance = 7.5
    } = req.body

    if (!editInstruction || !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Edit instruction and session ID are required'
      })
    }

    logger.info('Direct image editing request', {
      sessionId,
      instruction: editInstruction.substring(0, 100),
      targetImageId,
      editType
    })

    // Execute image editing
    const result = await imageEditingService.editImage({
      editInstruction,
      sessionId,
      targetImageId,
      editType,
      strength,
      guidance
    })

    if (result.success) {
      res.json({
        success: true,
        data: {
          originalImage: result.data!.originalImage,
          editedImage: result.data!.editedImage,
          enhancedInstruction: result.data!.enhancedInstruction,
          editType: result.data!.editType,
          editingTime: result.data!.editingTime,
          suggestions: result.data!.suggestions,
          message: `Image edited successfully using ${result.data!.editType} editing.`
        }
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      })
    }

  } catch (error) {
    logger.error('Direct image editing failed', { error: error.message })
    res.status(500).json({
      success: false,
      error: 'Failed to edit image'
    })
  }
})

export default router
