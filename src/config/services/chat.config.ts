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

export const CHAT_CONFIG_PRESETS = {
  creative: {
    ...DEFAULT_CHAT_CONFIG,
    temperature: 0.9,
    maxTokens: 600,
    systemPrompt: 'You are a creative and engaging AI assistant. Use vivid language and be helpful while maintaining an interesting conversation style.'
  },
  
  concise: {
    ...DEFAULT_CHAT_CONFIG,
    temperature: 0.5,
    maxTokens: 300,
    systemPrompt: 'You are a concise AI assistant. Provide direct, brief, and accurate responses. Be helpful but keep answers short and to the point.'
  },
  
  technical: {
    ...DEFAULT_CHAT_CONFIG,
    temperature: 0.3,
    maxTokens: 700,
    systemPrompt: 'You are a technical AI assistant. Provide detailed, accurate, and well-structured responses. Include code examples and technical explanations when relevant.'
  }
}
