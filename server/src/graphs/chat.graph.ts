import {
  GraphBuilder,
  GraphTypes,
  RemoteLLMChatNode
} from '@inworld/runtime/graph'
import { config } from '../config'
import { logger } from '../utils/logger'

/**
 * Chat Graph Configuration
 *
 * This graph handles general conversation using Inworld Runtime LLM
 */

export interface ChatGraphConfig {
  provider: string
  modelName: string
  temperature: number
  maxTokens: number
  systemPrompt?: string
}

export const DEFAULT_CHAT_CONFIG: ChatGraphConfig = {
  provider: 'openai',
  modelName: 'gpt-4o-mini',
  temperature: 0.7, // Higher temperature for more creative responses
  maxTokens: 500,
  systemPrompt: `You are a helpful AI assistant. Provide clear, concise, and friendly responses to user questions and requests.`
}

export class ChatGraph {
  private graph: any = null
  private llmNode: RemoteLLMChatNode | null = null
  private config: ChatGraphConfig
  private conversationHistory: Array<{ role: string; content: string }> = []

  constructor(graphConfig: Partial<ChatGraphConfig> = {}) {
    this.config = { ...DEFAULT_CHAT_CONFIG, ...graphConfig }
  }

  /**
   * Builds the chat graph
   * Architecture: LLM Node (with conversation context)
   */
  async build(): Promise<void> {
    try {
      logger.info('Building chat graph', {
        provider: this.config.provider,
        model: this.config.modelName
      })

      // Create the LLM node for chat
      this.llmNode = new RemoteLLMChatNode({
        id: 'chat_llm',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        stream: true, // Enable streaming for real-time responses
        textGenerationConfig: {
          maxNewTokens: 500,
          temperature: 0.7
        }
      })

      // Build the graph
      this.graph = new GraphBuilder({
        id: 'chat_graph',
        apiKey: config.inworld.apiKey,
        enableRemoteConfig: true // Enable for A/B testing
      })
        .addNode(this.llmNode)
        .setStartNode(this.llmNode)
        .setEndNode(this.llmNode)
        .build()

      logger.info('Chat graph built successfully')
    } catch (error) {
      logger.error('Failed to build chat graph:', error)
      throw error
    }
  }

  /**
   * Executes the chat graph with user input and conversation history
   */
  async execute(userInput: string, sessionId: string): Promise<AsyncGenerator<any, void, unknown>> {
    if (!this.graph) {
      throw new Error('Graph not built. Call build() first.')
    }

    // Add user message to conversation history
    this.conversationHistory.push({
      role: 'user',
      content: userInput
    })

    // Build messages with system prompt and conversation history
    const messages = [
      {
        role: 'system',
        content: this.config.systemPrompt!
      },
      ...this.conversationHistory.slice(-10) // Keep last 10 messages for context
    ]

    const graphInput = { messages }

    logger.debug('Executing chat graph', {
      input: userInput.substring(0, 50),
      sessionId,
      historyLength: this.conversationHistory.length,
      messagesCount: messages.length
    })

    // Start graph execution
    const outputStream = this.graph.start(new GraphTypes.LLMChatRequest(graphInput), crypto.randomUUID())

    if (!outputStream || typeof outputStream[Symbol.asyncIterator] !== 'function') {
      throw new Error('Graph execution did not return a valid output stream')
    }

    return outputStream
  }

  /**
   * Add assistant response to conversation history
   */
  addAssistantResponse(response: string): void {
    this.conversationHistory.push({
      role: 'assistant',
      content: response
    })

    // Keep conversation history manageable
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-16)
    }
  }

  /**
   * Clear conversation history for new session
   */
  clearHistory(): void {
    this.conversationHistory = []
    logger.debug('Chat conversation history cleared')
  }

  /**
   * Get current conversation history
   */
  getHistory(): Array<{ role: string; content: string }> {
    return [...this.conversationHistory]
  }

  /**
   * Cleanup graph resources
   */
  async destroy(): Promise<void> {
    if (this.graph) {
      this.graph.cleanupAllExecutions()
      this.graph.destroy()
      this.graph = null
    }
    this.llmNode = null
    this.conversationHistory = []
    logger.info('Chat graph destroyed')
  }

  /**
   * Check if graph is ready for execution
   */
  isReady(): boolean {
    return this.graph !== null && this.llmNode !== null
  }
}
