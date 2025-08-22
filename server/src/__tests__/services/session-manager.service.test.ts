import { v4 as uuidv4 } from 'uuid'
import { sessionManager } from '../../services/session-manager.service'
import { IntentType } from '../../types'

describe('SessionManagerService', () => {
  let testSessionId: string

  beforeEach(async () => {
    // Create a test session
    const session = await sessionManager.createSession()
    testSessionId = session.sessionId
  })

  afterEach(async () => {
    // Clean up session
    await sessionManager.deleteSession(testSessionId)
  })

  describe('Session Creation and Management', () => {
    test('should create session with valid structure', async () => {
      const session = await sessionManager.createSession()

      expect(session.sessionId).toBeDefined()
      expect(session.createdAt).toBeInstanceOf(Date)
      expect(session.lastActivity).toBeInstanceOf(Date)
      expect(session.conversationHistory).toEqual([])
      expect(session.uploadedImages).toBeInstanceOf(Map)
      expect(session.generatedImages).toBeInstanceOf(Map)
      expect(session.currentContext).toBeDefined()
      expect(session.preferences).toBeDefined()
      expect(session.metadata).toBeDefined()

      // Cleanup
      await sessionManager.deleteSession(session.sessionId)
    })

    test('should retrieve existing session', async () => {
      const session = await sessionManager.getSession(testSessionId)

      expect(session).toBeDefined()
      expect(session?.sessionId).toBe(testSessionId)
    })

    test('should return null for non-existent session', async () => {
      const session = await sessionManager.getSession('non-existent')

      expect(session).toBeNull()
    })

    test('should delete session successfully', async () => {
      const newSession = await sessionManager.createSession()
      const deleted = await sessionManager.deleteSession(newSession.sessionId)

      expect(deleted).toBe(true)
      expect(await sessionManager.getSession(newSession.sessionId)).toBeNull()
    })

    test('should return false when deleting non-existent session', async () => {
      const deleted = await sessionManager.deleteSession('non-existent')

      expect(deleted).toBe(false)
    })
  })

  describe('Conversation History Management', () => {
    test('should add conversation turn to history', async () => {
      const turn = {
        id: uuidv4(),
        timestamp: new Date(),
        userInput: 'Hello, how are you?',
        detectedIntent: IntentType.CHAT,
        confidence: 0.95,
        response: 'I am doing well, thank you!'
      }

      await sessionManager.addConversationTurn(testSessionId, turn)

      const session = await sessionManager.getSession(testSessionId)
      expect(session?.conversationHistory).toHaveLength(1)
      expect(session?.conversationHistory[0]).toEqual(turn)
      expect(session?.metadata.totalMessages).toBe(1)
    })
  })

  describe('Image Management', () => {
    test('should add generated image to session', async () => {
      const imageMetadata = {
        id: uuidv4(),
        originalName: 'generated-image.jpg',
        mimeType: 'image/jpeg',
        size: 1024000,
        uploadedAt: new Date(),
        storageUrl: 'https://example.com/image.jpg',
        description: 'A beautiful landscape',
        generatedBy: 'flux_generation' as const
      }

      await sessionManager.addImage(testSessionId, imageMetadata)

      const session = await sessionManager.getSession(testSessionId)
      expect(session?.generatedImages.has(imageMetadata.id)).toBe(true)
      expect(session?.currentContext.activeImages).toContain(imageMetadata.id)
      expect(session?.metadata.totalImagesGenerated).toBe(1)
    })

    test('should retrieve session images', async () => {
      const imageMetadata = {
        id: uuidv4(),
        originalName: 'test-image.jpg',
        mimeType: 'image/jpeg',
        size: 1024000,
        uploadedAt: new Date(),
        storageUrl: 'https://example.com/test.jpg',
        description: 'Test image',
        generatedBy: 'flux_generation' as const
      }

      await sessionManager.addImage(testSessionId, imageMetadata)

      const images = await sessionManager.getSessionImages(testSessionId)
      expect(images).toHaveLength(1)
      expect(images[0]).toEqual(imageMetadata)
    })
  })

  describe('Follow-up Actions', () => {
    test('should suggest follow-up actions', async () => {
      const suggestions = await sessionManager.suggestFollowUpActions(testSessionId)

      expect(Array.isArray(suggestions)).toBe(true)
      expect(suggestions.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Session Statistics', () => {
    test('should get session stats', async () => {
      const stats = await sessionManager.getSessionStats(testSessionId)

      expect(stats).toBeDefined()
      expect(stats.sessionDuration).toBeGreaterThanOrEqual(0)
      expect(stats.messageCount).toBe(0)
      expect(stats.imageCount).toBe(0)
      expect(stats.intentDistribution).toBeDefined()
    })
  })
})
