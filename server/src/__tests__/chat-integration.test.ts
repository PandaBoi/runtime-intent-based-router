import express from 'express'
import request from 'supertest'
import { chatRoutes } from '../routes/chat'
import { chatService } from '../services/chat-service'

describe('Session-Aware Chat Integration', () => {
  let app: express.Application
  let testSessionId: string

  beforeAll(async () => {
    // Set up Express app for testing
    app = express()
    app.use(express.json())
    app.use('/api/chat', chatRoutes)

    // Only run integration tests if we have API key
    if (!process.env.INWORLD_API_KEY) {
      console.log('Skipping chat integration tests - no INWORLD_API_KEY')
      return
    }

    // Initialize chat service
    await chatService.initialize()
  })

  afterAll(async () => {
    await chatService.disconnect()
    if (testSessionId) {
      await chatService.closeSession(testSessionId)
    }
  })

  describe('Session Management', () => {
    test('should create a new session', async () => {
      if (!process.env.INWORLD_API_KEY) {
        console.log('Skipping integration test - no INWORLD_API_KEY'); return
      }

      const response = await request(app)
        .post('/api/chat/sessions')
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.sessionId).toBeDefined()
      expect(typeof response.body.data.sessionId).toBe('string')

      testSessionId = response.body.data.sessionId
    })

    test('should send message without session ID and create one automatically', async () => {
      if (!process.env.INWORLD_API_KEY) {
        console.log('Skipping integration test - no INWORLD_API_KEY'); return
      }

      const response = await request(app)
        .post('/api/chat/message')
        .send({ message: 'Hello! This is a test message.' })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.message).toBeDefined()
      expect(response.body.data.message.content).toBeDefined()
      expect(response.body.data.message.sessionId).toBeDefined()
      expect(response.body.data.context.sessionId).toBe(response.body.data.message.sessionId)
    })

    test('should send message with existing session ID', async () => {
      if (!process.env.INWORLD_API_KEY) {
        console.log('Skipping integration test - no INWORLD_API_KEY'); return
      }

      const response = await request(app)
        .post('/api/chat/message')
        .send({
          message: 'This is a follow-up message in the same session.',
          sessionId: testSessionId
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.message.sessionId).toBe(testSessionId)
      expect(response.body.data.context.conversationLength).toBeGreaterThan(0)
    })
  })

  describe('Conversation History', () => {
    test('should maintain conversation history across messages', async () => {
      if (!process.env.INWORLD_API_KEY) {
        console.log('Skipping integration test - no INWORLD_API_KEY'); return
      }

      // Send first message
      const response1 = await request(app)
        .post('/api/chat/message')
        .send({
          message: 'My name is Test User.',
          sessionId: testSessionId
        })
        .expect(200)

      // Send follow-up message
      const response2 = await request(app)
        .post('/api/chat/message')
        .send({
          message: 'What is my name?',
          sessionId: testSessionId
        })
        .expect(200)

      expect(response2.body.data.context.conversationLength).toBeGreaterThan(
        response1.body.data.context.conversationLength
      )

      // Get session history
      const historyResponse = await request(app)
        .get(`/api/chat/sessions/${testSessionId}`)
        .expect(200)

      expect(historyResponse.body.success).toBe(true)
      expect(historyResponse.body.data.history).toBeDefined()
      expect(historyResponse.body.data.history.length).toBeGreaterThanOrEqual(2)

      const lastTurn = historyResponse.body.data.history[historyResponse.body.data.history.length - 1]
      expect(lastTurn.userInput).toBe('What is my name?')
    })
  })

  describe('Intent Detection Integration', () => {
    test('should detect and log intent but process as chat', async () => {
      if (!process.env.INWORLD_API_KEY) {
        console.log('Skipping integration test - no INWORLD_API_KEY'); return
      }

      const response = await request(app)
        .post('/api/chat/message')
        .send({
          message: 'Generate an image of a beautiful sunset',
          sessionId: testSessionId
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.message.content).toBeDefined()

      // Check session history to see intent was detected
      const historyResponse = await request(app)
        .get(`/api/chat/sessions/${testSessionId}`)
        .expect(200)

      const lastTurn = historyResponse.body.data.history[historyResponse.body.data.history.length - 1]
      expect(lastTurn.detectedIntent).toBeDefined()
      expect(['chat', 'generate-image', 'edit-image']).toContain(lastTurn.detectedIntent)
    })

    test('should skip intent detection when requested', async () => {
      if (!process.env.INWORLD_API_KEY) {
        console.log('Skipping integration test - no INWORLD_API_KEY'); return
      }

      const response = await request(app)
        .post('/api/chat/message')
        .send({
          message: 'Generate an image of a cat',
          sessionId: testSessionId,
          skipIntentDetection: true
        })
        .expect(200)

      expect(response.body.success).toBe(true)

      // Check that intent was set to chat (default when skipped)
      const historyResponse = await request(app)
        .get(`/api/chat/sessions/${testSessionId}`)
        .expect(200)

      const lastTurn = historyResponse.body.data.history[historyResponse.body.data.history.length - 1]
      expect(lastTurn.detectedIntent).toBe('chat')
    })
  })

  describe('Session Context', () => {
    test('should provide session context information', async () => {
      if (!process.env.INWORLD_API_KEY) {
        console.log('Skipping integration test - no INWORLD_API_KEY'); return
      }

      const response = await request(app)
        .get(`/api/chat/sessions/${testSessionId}/context`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.sessionId).toBe(testSessionId)
      expect(response.body.data.context).toBeDefined()
      expect(response.body.data.stats).toBeDefined()
      expect(response.body.data.suggestions).toBeDefined()
      expect(Array.isArray(response.body.data.suggestions)).toBe(true)
    })
  })

  describe('Context Analysis', () => {
    test('should analyze context without executing', async () => {
      if (!process.env.INWORLD_API_KEY) {
        console.log('Skipping integration test - no INWORLD_API_KEY'); return
      }

      const response = await request(app)
        .post('/api/chat/analyze')
        .send({
          input: 'What did I say earlier about my name?',
          sessionId: testSessionId
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.contextReferences).toBeDefined()
      expect(response.body.data.analysis).toBeDefined()
      expect(typeof response.body.data.analysis.hasConversationReferences).toBe('boolean')
    })
  })

  describe('Error Handling', () => {
    test('should handle missing message', async () => {
      const response = await request(app)
        .post('/api/chat/message')
        .send({ sessionId: testSessionId })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('Message is required')
    })

    test('should handle non-existent session for context', async () => {
      const response = await request(app)
        .get('/api/chat/sessions/non-existent-session-id')
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Session not found')
    })
  })
})
