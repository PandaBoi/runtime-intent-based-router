/**
 * Chat Service Configuration
 * 
 * Default LLM settings optimized for conversational AI
 * Higher temperature for creative, engaging responses
 */

export interface ChatServiceConfig {
  provider: string
  modelName: string
  temperature: number
  maxTokens: number
  stream: boolean
  systemPrompt: string
}

export const DEFAULT_CHAT_CONFIG: ChatServiceConfig = {
  provider: 'openai',
  modelName: 'gpt-4o-mini',
  temperature: 0.7,        // Higher for creativity in conversation
  maxTokens: 500,          // Sufficient for detailed responses
  stream: true,            // Enable streaming for real-time feel
  systemPrompt: 'You are a helpful AI assistant. Provide clear, concise, and friendly responses to user questions and requests.'
}