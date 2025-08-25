import {
  GraphBuilder,
  GraphTypes,
  RemoteLLMChatNode
} from '@inworld/runtime/graph'
import { renderJinja } from '@inworld/runtime/primitives/llm'
import { config } from '../config'
import { logger } from '../utils/logger'

/**
 * Intent Detection Graph Configuration
 *
 * This graph classifies user input into three categories:
 * - CHAT: General conversation
 * - GENERATE_IMAGE: Image creation requests
 * - EDIT_IMAGE: Image modification requests
 */

export interface IntentDetectionGraphConfig {
  provider: string
  modelName: string
  temperature: number
  maxTokens: number
}

export const DEFAULT_INTENT_CONFIG: IntentDetectionGraphConfig = {
  provider: config.llm.provider,
  modelName: config.llm.defaultModel,
  temperature: config.llm.intentDetection.temperature,
  maxTokens: config.llm.intentDetection.maxTokens
}

export class IntentDetectionGraph {
  private graph: any = null
  private llmNode: RemoteLLMChatNode | null = null
  private config: IntentDetectionGraphConfig

  constructor(graphConfig: Partial<IntentDetectionGraphConfig> = {}) {
    this.config = { ...DEFAULT_INTENT_CONFIG, ...graphConfig }
  }

  /**
   * Builds the intent detection graph
   * Architecture: LLM Node (with system prompt for classification)
   */
  async build(): Promise<void> {
    try {
      logger.info('Building intent detection graph', {
        provider: this.config.provider,
        model: this.config.modelName
      })

      // Create the LLM node for intent classification
      this.llmNode = new RemoteLLMChatNode({
        id: 'intent_classifier_llm',
        provider: this.config.provider,
        modelName: this.config.modelName,
        stream: config.llm.intentDetection.stream,
        textGenerationConfig: {
          maxNewTokens: this.config.maxTokens,
          temperature: this.config.temperature
        }
      })

      // Build the graph
      this.graph = new GraphBuilder({
        id: 'intent_detection_graph',
        apiKey: config.inworld.apiKey,
        enableRemoteConfig: true // Enable for A/B testing
      })
        .addNode(this.llmNode)
        .setStartNode(this.llmNode)
        .setEndNode(this.llmNode)
        .build()

      logger.info('Intent detection graph built successfully')
    } catch (error) {
      logger.error('Failed to build intent detection graph:', error)
      throw error
    }
  }

  /**
   * Executes the intent detection graph with user input
   */
  async execute(userInput: string): Promise<AsyncGenerator<any, void, unknown>> {
    if (!this.graph) {
      throw new Error('Graph not built. Call build() first.')
    }

    const template = this.getIntentClassificationTemplate()
    const renderedPrompt = await renderJinja(template, {
      userInput: userInput
    })

    const graphInput = {
      messages: [
        {
          role: 'user',
          content: renderedPrompt
        }
      ]
    }

    logger.debug('Executing intent detection graph', {
      input: userInput.substring(0, 50),
      messagesCount: graphInput.messages.length
    })

    // Start graph execution and return the output stream
    const outputStream = this.graph.start(new GraphTypes.LLMChatRequest(graphInput), crypto.randomUUID())

    if (!outputStream || typeof outputStream[Symbol.asyncIterator] !== 'function') {
      throw new Error('Graph execution did not return a valid output stream')
    }

    return outputStream
  }

  /**
   * Gets the Jinja template for intent classification
   */
  private getIntentClassificationTemplate(): string {
    return `You are an intelligent intent classifier for a chat application that routes user requests to different AI services.

Available intents:
1. CHAT - General conversation, questions, help requests
2. GENERATE_IMAGE - Creating, generating, making, drawing new images or artwork
3. EDIT_IMAGE - Modifying, editing, changing existing images

Instructions:
- Analyze the user input and classify it into one of the three intents
- Respond with ONLY a JSON object in this exact format:
- {"intent": "INTENT_NAME", "confidence": 0.95, "reasoning": "brief explanation"}
- Confidence should be between 0.0 and 1.0
- Be precise and consistent

Examples:
User: "Hello, how are you?"
Response: {"intent": "CHAT", "confidence": 0.95, "reasoning": "greeting and conversation"}

User: "Generate an image of a sunset"
Response: {"intent": "GENERATE_IMAGE", "confidence": 0.98, "reasoning": "requesting image creation"}

User: "Make this photo brighter"
Response: {"intent": "EDIT_IMAGE", "confidence": 0.92, "reasoning": "requesting image modification"}

User Input: "{{ userInput }}"

Classify this input:`
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
    logger.info('Intent detection graph destroyed')
  }

  /**
   * Check if graph is ready for execution
   */
  isReady(): boolean {
    return this.graph !== null && this.llmNode !== null
  }
}
