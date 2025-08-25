/**
 * Intent Detection Service Configuration
 * 
 * Default LLM settings optimized for classification tasks
 * Low temperature for consistent, reliable intent detection
 */

export interface IntentDetectionServiceConfig {
  provider: string
  modelName: string
  temperature: number
  maxTokens: number
  stream: boolean
  confidenceThreshold: number
}

export const DEFAULT_INTENT_DETECTION_CONFIG: IntentDetectionServiceConfig = {
  provider: 'openai',
  modelName: 'gpt-4o-mini',
  temperature: 0.1,        // Very low for consistent classification
  maxTokens: 150,          // Short responses for classification
  stream: false,           // Complete responses needed for parsing
  confidenceThreshold: 0.8 // Minimum confidence for intent routing
}
