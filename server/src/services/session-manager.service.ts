import { v4 as uuidv4 } from 'uuid'
import { IntentType } from '../types'
import {
  ContextReference,
  ConversationTurn,
  ImageMetadata,
  SessionContextAnalyzer,
  SessionManager,
  SessionState,
  SessionStats
} from '../types/session'
import { logger } from '../utils/logger'

/**
 * In-memory session manager implementation
 * In production, this would be backed by Redis or a database
 */
export class InMemorySessionManager implements SessionManager, SessionContextAnalyzer {
  private sessions = new Map<string, SessionState>()
  private readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000 // 24 hours
  private readonly MAX_CONVERSATION_HISTORY = 50
  private readonly MAX_ACTIVE_IMAGES = 10
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Clean up expired sessions every hour
    this.cleanupInterval = setInterval(() => this.cleanupExpiredSessions(), 60 * 60 * 1000)
  }

  async createSession(userId?: string): Promise<SessionState> {
    const sessionId = uuidv4()
    const now = new Date()

    const session: SessionState = {
      sessionId,
      createdAt: now,
      lastActivity: now,
      conversationHistory: [],
      currentContext: {
        lastIntent: null,
        activeImages: [],
        pendingAction: null
      },
      uploadedImages: new Map(),
      generatedImages: new Map(),
      preferences: {},
      metadata: {
        totalMessages: 0,
        totalImagesUploaded: 0,
        totalImagesGenerated: 0
      }
    }

    this.sessions.set(sessionId, session)

    logger.info('New session created', {
      sessionId,
      userId: userId || 'anonymous'
    })

    return session
  }

  async getSession(sessionId: string): Promise<SessionState | null> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return null
    }

    // Check if session is expired
    const isExpired = Date.now() - session.lastActivity.getTime() > this.SESSION_TIMEOUT
    if (isExpired) {
      this.sessions.delete(sessionId)
      logger.info('Session expired and removed', { sessionId })
      return null
    }

    return session
  }

  async updateSession(sessionId: string, updates: Partial<SessionState>): Promise<void> {
    const session = await this.getSession(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    // Merge updates
    Object.assign(session, updates, { lastActivity: new Date() })

    logger.debug('Session updated', { sessionId, updateKeys: Object.keys(updates) })
  }

  async addConversationTurn(sessionId: string, turn: ConversationTurn): Promise<void> {
    const session = await this.getSession(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    session.conversationHistory.push(turn)
    session.currentContext.lastIntent = turn.detectedIntent
    session.metadata.totalMessages++
    session.lastActivity = new Date()

    // Limit conversation history size
    if (session.conversationHistory.length > this.MAX_CONVERSATION_HISTORY) {
      session.conversationHistory = session.conversationHistory.slice(-this.MAX_CONVERSATION_HISTORY)
    }

    logger.debug('Conversation turn added', {
      sessionId,
      intent: turn.detectedIntent,
      confidence: turn.confidence
    })
  }

  async addImage(sessionId: string, image: ImageMetadata): Promise<void> {
    const session = await this.getSession(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    if (image.generatedBy === 'user_upload') {
      session.uploadedImages.set(image.id, image)
      session.metadata.totalImagesUploaded++
    } else {
      session.generatedImages.set(image.id, image)
      session.metadata.totalImagesGenerated++
    }

    // Add to active images if not too many
    if (session.currentContext.activeImages.length < this.MAX_ACTIVE_IMAGES) {
      session.currentContext.activeImages.push(image.id)
    }

    session.lastActivity = new Date()

    logger.info('Image added to session', {
      sessionId,
      imageId: image.id,
      type: image.generatedBy
    })
  }

  async getSessionImages(sessionId: string): Promise<ImageMetadata[]> {
    const session = await this.getSession(sessionId)
    if (!session) {
      return []
    }

    const allImages = [
      ...Array.from(session.uploadedImages.values()),
      ...Array.from(session.generatedImages.values())
    ]

    return allImages.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
  }

  async getActiveImages(sessionId: string): Promise<ImageMetadata[]> {
    const session = await this.getSession(sessionId)
    if (!session) {
      return []
    }

    const activeImages: ImageMetadata[] = []

    for (const imageId of session.currentContext.activeImages) {
      const image = session.uploadedImages.get(imageId) || session.generatedImages.get(imageId)
      if (image) {
        activeImages.push(image)
      }
    }

    return activeImages
  }

  async setActiveImages(sessionId: string, imageIds: string[]): Promise<void> {
    const session = await this.getSession(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    session.currentContext.activeImages = imageIds.slice(0, this.MAX_ACTIVE_IMAGES)
    session.lastActivity = new Date()

    logger.debug('Active images updated', { sessionId, activeImageCount: imageIds.length })
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const existed = this.sessions.has(sessionId)
    this.sessions.delete(sessionId)

    if (existed) {
      logger.info('Session deleted', { sessionId })
    }

    return existed
  }

  async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now()
    let cleanedCount = 0

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity.getTime() > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired sessions', { count: cleanedCount })
    }
  }

  async getSessionStats(sessionId: string): Promise<SessionStats> {
    const session = await this.getSession(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    const sessionDuration = (session.lastActivity.getTime() - session.createdAt.getTime()) / (1000 * 60)

    const intentDistribution: Record<IntentType, number> = {
      [IntentType.CHAT]: 0,
      [IntentType.GENERATE_IMAGE]: 0,
      [IntentType.EDIT_IMAGE]: 0,
      [IntentType.UNKNOWN]: 0
    }

    let totalResponseTime = 0
    session.conversationHistory.forEach(turn => {
      intentDistribution[turn.detectedIntent]++
      // Assuming response time calculation would be added
    })

    return {
      sessionDuration,
      messageCount: session.conversationHistory.length,
      intentDistribution,
      imageCount: session.uploadedImages.size + session.generatedImages.size,
      averageResponseTime: session.conversationHistory.length > 0 ? totalResponseTime / session.conversationHistory.length : 0
    }
  }

  // Context Analysis Methods

  async analyzeContext(sessionId: string, userInput: string): Promise<ContextReference[]> {
    const session = await this.getSession(sessionId)
    if (!session) {
      return []
    }

    const references: ContextReference[] = []
    const inputLower = userInput.toLowerCase()

    // Check for image references
    const imageKeywords = ['this image', 'that picture', 'the photo', 'my image', 'last image']
    if (imageKeywords.some(keyword => inputLower.includes(keyword))) {
      const activeImages = await this.getActiveImages(sessionId)
      activeImages.forEach(image => {
        references.push({
          type: 'image',
          id: image.id,
          relevance: 0.9,
          timestamp: image.uploadedAt
        })
      })
    }

    // Check for conversation references
    const conversationKeywords = ['what i said', 'my previous', 'earlier', 'before']
    if (conversationKeywords.some(keyword => inputLower.includes(keyword))) {
      const recentTurns = session.conversationHistory.slice(-3)
      recentTurns.forEach(turn => {
        references.push({
          type: 'message',
          id: turn.id,
          relevance: 0.7,
          timestamp: turn.timestamp
        })
      })
    }

    return references.sort((a, b) => b.relevance - a.relevance)
  }

  async findRelevantImages(sessionId: string, query: string): Promise<ImageMetadata[]> {
    const images = await this.getSessionImages(sessionId)
    const queryLower = query.toLowerCase()

    // Simple text matching - in production, use vector similarity
    return images.filter(image => {
      return image.description?.toLowerCase().includes(queryLower) ||
             image.originalName.toLowerCase().includes(queryLower)
    })
  }

  async determineImageEditTarget(sessionId: string, editInstruction: string): Promise<ImageMetadata | null> {
    const session = await this.getSession(sessionId)
    if (!session) {
      return null
    }

    // Priority: Active images > Recent uploads > Recent generations
    const activeImages = await this.getActiveImages(sessionId)
    if (activeImages.length > 0) {
      return activeImages[0] // Most recent active image
    }

    // If no active images, use most recent uploaded image
    const allImages = await this.getSessionImages(sessionId)
    const uploadedImages = allImages.filter(img => img.generatedBy === 'user_upload')

    return uploadedImages.length > 0 ? uploadedImages[0] : null
  }

  async suggestFollowUpActions(sessionId: string): Promise<string[]> {
    const session = await this.getSession(sessionId)
    if (!session) {
      return []
    }

    const suggestions: string[] = []
    const lastIntent = session.currentContext.lastIntent

    switch (lastIntent) {
      case IntentType.GENERATE_IMAGE:
        suggestions.push(
          'Would you like to edit this generated image?',
          'Generate a variation of this image?',
          'Create another image with different style?'
        )
        break

      case IntentType.EDIT_IMAGE:
        suggestions.push(
          'Apply another edit to this image?',
          'Try a different editing approach?',
          'Generate a new image instead?'
        )
        break

      case IntentType.CHAT:
        if (session.uploadedImages.size > 0 || session.generatedImages.size > 0) {
          suggestions.push(
            'Would you like to edit any of your images?',
            'Generate a new image based on our conversation?'
          )
        }
        break
    }

    return suggestions
  }

  /**
   * Cleanup method for tests - clears the interval to prevent Jest hanging
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

// Singleton instance
export const sessionManager = new InMemorySessionManager()
