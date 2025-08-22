import { InworldError } from '@inworld/runtime/common'
import { LLM, LLMFactory } from '@inworld/runtime/primitives/llm'
import { config } from '../config'
import {
    ChatMessage,
    InworldConnectionState,
    ServiceResponse
} from '../types'
import { logger } from '../utils/logger'

interface LLMResponse {
  text: string
  finishReason?: string
}

export class InworldRuntimeService {
  private llm: LLM | null = null
  private isInitialized = false
  private connectionState: InworldConnectionState = {
    isConnected: false
  }

  async initialize(): Promise<void> {
    try {
      if (!config.inworld.apiKey) {
        throw new InworldError('Inworld API key not provided')
      }

      // Initialize LLM primitive for chat functionality using correct API
      this.llm = await LLMFactory.createRemote({
        apiKey: config.inworld.apiKey,
        modelName: 'gpt-3.5-turbo',
        provider: 'inworld'
      })

      this.connectionState = {
        isConnected: true,
        sessionId: this.generateSessionId(),
        lastActivity: new Date()
      }

      this.isInitialized = true

      logger.info('Inworld Runtime service initialized successfully', {
        sessionId: this.connectionState.sessionId
      })

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to initialize Inworld Runtime service:', errorMsg)
      throw new InworldError(`Initialization failed: ${errorMsg}`)
    }
  }

  async sendMessage(message: string, sessionId: string): Promise<ServiceResponse<ChatMessage>> {
    try {
      if (!this.isInitialized || !this.llm) {
        throw new InworldError('Service not initialized')
      }

      // Update last activity
      this.connectionState.lastActivity = new Date()

      // Send message to LLM primitive using correct API
      const response = await this.llm.generateText({
        messages: [
          {
            role: 'user',
            content: message
          }
        ],
        config: {
          maxNewTokens: 150,
          temperature: 0.7
        }
      })

      // Get the response text from the stream
      let responseText = ''
      let chunk = await response.next()

      while (!chunk.done) {
        responseText += chunk.text || ''
        chunk = await response.next()
      }

      const responseMessage: ChatMessage = {
        id: this.generateSessionId(),
        content: responseText || 'No response generated',
        timestamp: new Date(),
        role: 'assistant',
        sessionId
      }

      logger.info('Message processed successfully', {
        sessionId,
        messageLength: message.length,
        responseLength: responseMessage.content.length
      })

      return {
        success: true,
        data: responseMessage,
        timestamp: new Date()
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to send message:', errorMsg, { sessionId })

      return {
        success: false,
        error: `Message processing failed: ${errorMsg}`,
        timestamp: new Date()
      }
    }
  }

  getConnectionState(): InworldConnectionState {
    return { ...this.connectionState }
  }

  async disconnect(): Promise<void> {
    try {
      this.connectionState.isConnected = false
      this.isInitialized = false

      if (this.llm) {
        this.llm.destroy()
        this.llm = null
      }

      logger.info('Inworld Runtime service disconnected')
    } catch (error) {
      logger.error('Error during disconnect:', error)
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      return this.isInitialized && this.connectionState.isConnected
    } catch (error) {
      logger.error('Health check failed:', error)
      return false
    }
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }
}

export const inworldRuntimeService = new InworldRuntimeService()
