/**
 * Chat Service Configuration
 *
 * Default LLM settings optimized for conversational AI
 * Higher temperature for creative, engaging responses
 */

import {
    CONCISE_CHAT_SYSTEM_PROMPT,
    CREATIVE_CHAT_SYSTEM_PROMPT,
    DEFAULT_CHAT_SYSTEM_PROMPT,
    TECHNICAL_CHAT_SYSTEM_PROMPT
} from '../../prompts/chat'

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
  systemPrompt: DEFAULT_CHAT_SYSTEM_PROMPT
}

export const CHAT_CONFIG_PRESETS = {
  creative: {
    ...DEFAULT_CHAT_CONFIG,
    temperature: 0.9,
    maxTokens: 600,
    systemPrompt: CREATIVE_CHAT_SYSTEM_PROMPT
  },

  concise: {
    ...DEFAULT_CHAT_CONFIG,
    temperature: 0.5,
    maxTokens: 300,
    systemPrompt: CONCISE_CHAT_SYSTEM_PROMPT
  },

  technical: {
    ...DEFAULT_CHAT_CONFIG,
    temperature: 0.3,
    maxTokens: 700,
    systemPrompt: TECHNICAL_CHAT_SYSTEM_PROMPT
  }
}