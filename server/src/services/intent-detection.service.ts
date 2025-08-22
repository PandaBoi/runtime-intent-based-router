import {
  GraphBuilder,
  GraphTypes,
  RemoteLLMChatNode
} from '@inworld/runtime/graph'
import { config } from '../config'
import {
  IntentDetectionError,
  IntentResult,
  IntentType,
  ServiceResponse
} from '../types'
import { logger } from '../utils/logger'

export class IntentDetectionService {
  private graph: any = null
  private llmNode: RemoteLLMChatNode | null = null
  private isInitialized = false

  private readonly INTENT_DETECTION_PROMPT = `You are an intelligent intent classifier for a chat application that routes user requests to different AI services.

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

Now classify this user input:`

  async initialize(): Promise<void> {
    try {
      if (!config.inworld.apiKey) {
        throw new IntentDetectionError('Inworld API key not provided')
      }

      // Create RemoteLLMChatNode for intent classification
      logger.info('Creating RemoteLLMChatNode with configuration', {
        provider: 'inworld',
        modelName: 'gpt-3.5-turbo',
        stream: false,
        maxNewTokens: 100,
        temperature: 0.1
      })

      this.llmNode = new RemoteLLMChatNode({
        id: 'intent_detection_service_llm',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        stream: false, // We want a complete response for classification
        textGenerationConfig: {
          maxNewTokens: 100,
          temperature: 0.1 // Low temperature for consistent classification
        }
      })

      logger.info('RemoteLLMChatNode created successfully')

      // Build the graph with the LLM node
      logger.info('Building graph with configuration', {
        id: 'intent_detection_graph',
        hasApiKey: !!config.inworld.apiKey,
        apiKeyLength: config.inworld.apiKey?.length,
        enableRemoteConfig: false
      })

      this.graph = new GraphBuilder({
        id: 'intent_detection_graph',
        apiKey: config.inworld.apiKey,
        enableRemoteConfig: false
      })
        .addNode(this.llmNode)
        .setStartNode(this.llmNode)
        .setEndNode(this.llmNode)
        .build()

      logger.info('Graph built successfully', {
        graphId: this.graph?.id || 'unknown',
        hasGraph: !!this.graph
      })

      this.isInitialized = true
      logger.info('Intent detection service initialized with graph-based LLM classification')

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to initialize intent detection service:', errorMsg)
      throw new IntentDetectionError(`Initialization failed: ${errorMsg}`)
    }
  }

  async detectIntent(input: string): Promise<ServiceResponse<IntentResult>> {
    try {
      if (!this.isInitialized || !this.graph) {
        throw new IntentDetectionError('Service not initialized')
      }

      // Create the prompt with the user input
      const fullPrompt = `${this.INTENT_DETECTION_PROMPT}\n\nUser: "${input}"\nResponse:`

      // Create the graph input using the LLMChatRequest format
      const graphInput = {
        messages: [
          {
            role: 'system',
            content: this.INTENT_DETECTION_PROMPT
          },
          {
            role: 'user',
            content: `Classify this input: "${input}"`
          }
        ]
      }

      logger.info('Sending intent classification request to graph', {
        input: input.substring(0, 50),
        hasGraph: !!this.graph,
        graphInput: {
          messagesCount: graphInput.messages?.length,
          firstMessageRole: graphInput.messages?.[0]?.role,
          secondMessageRole: graphInput.messages?.[1]?.role
        }
      })

      // Start the graph execution
      let outputStream
      try {
        // The graph.start() method returns a GraphOutputStream directly
        outputStream = this.graph.start(new GraphTypes.LLMChatRequest(graphInput), crypto.randomUUID())
        logger.info('Graph start() called successfully', {
          hasOutputStream: !!outputStream,
          type: typeof outputStream,
          isIterable: outputStream && typeof outputStream[Symbol.asyncIterator] === 'function'
        })
      } catch (error) {
        logger.error('Error calling graph.start()', { error: error.message, stack: error.stack })
        throw error
      }

      if (!outputStream || typeof outputStream[Symbol.asyncIterator] !== 'function') {
        throw new IntentDetectionError('Graph start() did not return an iterable stream')
      }

      // Process the response
      let responseText = ''
      let intentResult: IntentResult | null = null
      let resultCount = 0

      logger.info('Starting to iterate over outputStream')

      for await (const result of outputStream) {
        resultCount++
        logger.info('Processing output stream result', {
          resultCount,
          resultType: typeof result,
          resultKeys: result ? Object.keys(result) : [],
          hasProcessResponse: typeof result?.processResponse === 'function'
        })

        await result.processResponse({
          Content: (response: GraphTypes.Content) => {
            responseText = response.content || ''
            logger.info('Received Content response for intent detection', {
              input: input.substring(0, 50),
              rawResponse: responseText,
              responseLength: responseText.length,
              hasContent: !!response.content
            })

            // Parse the LLM response
            intentResult = this.parseLLMResponse(responseText.trim(), input)
          },
          ContentStream: async (stream: GraphTypes.ContentStream) => {
            logger.info('Received ContentStream response for intent detection')
            let streamContent = ''
            for await (const chunk of stream) {
              if (chunk.text) {
                streamContent += chunk.text
              }
            }
            responseText = streamContent
            logger.info('Completed ContentStream processing', {
              input: input.substring(0, 50),
              rawResponse: responseText,
              responseLength: responseText.length
            })

            // Parse the LLM response
            intentResult = this.parseLLMResponse(responseText.trim(), input)
          },
          string: (text: string) => {
            logger.info('Received string response for intent detection', { text })
            responseText = text
            intentResult = this.parseLLMResponse(text.trim(), input)
          },
          default: (data: any) => {
            logger.warn('Unprocessed response in intent detection:', {
              data: JSON.stringify(data).substring(0, 200),
              dataType: typeof data
            })
          }
        })
      }

      logger.info('Completed outputStream iteration', {
        totalResults: resultCount,
        hasIntentResult: !!intentResult,
        responseTextLength: responseText.length,
        responseTextPreview: responseText.substring(0, 100)
      })

      if (!intentResult) {
        logger.error('No intentResult created', {
          responseText,
          resultCount,
          fallbackReason: 'LLM did not provide valid response'
        })
        throw new IntentDetectionError('No valid response received from LLM')
      }

      logger.info('Intent detected via graph-based LLM', {
        input: input.substring(0, 50),
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        llmResponse: responseText.substring(0, 100)
      })

      return {
        success: true,
        data: intentResult,
        timestamp: new Date()
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Intent detection failed:', errorMsg)

      // Fallback to CHAT intent if LLM fails
      return {
        success: true,
        data: {
          intent: IntentType.CHAT,
          confidence: 0.5,
          extractedParams: { prompt: input }
        },
        timestamp: new Date()
      }
    }
  }

  private parseLLMResponse(responseText: string, originalInput: string): IntentResult {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[^}]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])

        // Validate the response format
        if (parsed.intent && parsed.confidence !== undefined) {
          const intent = this.validateIntent(parsed.intent)
          const confidence = Math.max(0, Math.min(1, parsed.confidence))

          return {
            intent,
            confidence,
            extractedParams: this.extractParameters(originalInput, intent)
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to parse LLM response as JSON:', error)
    }

    // Fallback: try to extract intent from response text
    const responseUpper = responseText.toUpperCase()

    if (responseUpper.includes('GENERATE_IMAGE') || responseUpper.includes('GENERATE IMAGE')) {
      return {
        intent: IntentType.GENERATE_IMAGE,
        confidence: 0.7,
        extractedParams: this.extractParameters(originalInput, IntentType.GENERATE_IMAGE)
      }
    }

    if (responseUpper.includes('EDIT_IMAGE') || responseUpper.includes('EDIT IMAGE')) {
      return {
        intent: IntentType.EDIT_IMAGE,
        confidence: 0.7,
        extractedParams: this.extractParameters(originalInput, IntentType.EDIT_IMAGE)
      }
    }

    // Default to CHAT
    return {
      intent: IntentType.CHAT,
      confidence: 0.6,
      extractedParams: this.extractParameters(originalInput, IntentType.CHAT)
    }
  }

  private validateIntent(intentString: string): IntentType {
    const upperIntent = intentString.toUpperCase()

    switch (upperIntent) {
      case 'GENERATE_IMAGE':
      case 'GENERATE IMAGE':
        return IntentType.GENERATE_IMAGE
      case 'EDIT_IMAGE':
      case 'EDIT IMAGE':
        return IntentType.EDIT_IMAGE
      case 'CHAT':
        return IntentType.CHAT
      default:
        return IntentType.CHAT
    }
  }

  private extractParameters(input: string, intent: IntentType): any {
    switch (intent) {
      case IntentType.GENERATE_IMAGE:
        return {
          prompt: this.cleanPrompt(input, ['generate', 'create', 'make', 'draw', 'image', 'picture'])
        }

      case IntentType.EDIT_IMAGE:
        return {
          editInstructions: this.cleanPrompt(input, ['edit', 'modify', 'change', 'adjust'])
        }

      case IntentType.CHAT:
      default:
        return { prompt: input }
    }
  }

  private cleanPrompt(input: string, triggerWords: string[]): string {
    let cleaned = input.toLowerCase()

    // Remove trigger words
    for (const word of triggerWords) {
      cleaned = cleaned.replace(new RegExp(`\\b${word}\\b`, 'gi'), '')
    }

    // Remove common phrases
    cleaned = cleaned.replace(/\b(an? )?(image|picture|photo) of\b/gi, '')
    cleaned = cleaned.replace(/\bthe (image|picture|photo)\b/gi, '')

    // Clean up extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim()

    return cleaned || input
  }

  async healthCheck(): Promise<boolean> {
    return this.isInitialized && this.graph !== null
  }

  async disconnect(): Promise<void> {
    try {
      if (this.graph) {
        // Clean up the graph execution
        this.graph.cleanupAllExecutions()
        this.graph.destroy()
        this.graph = null
      }
      this.llmNode = null
      this.isInitialized = false
      logger.info('Intent detection service disconnected')
    } catch (error) {
      logger.error('Error during intent detection service disconnect:', error)
    }
  }
}

export const intentDetectionService = new IntentDetectionService()
