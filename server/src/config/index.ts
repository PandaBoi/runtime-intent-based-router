import dotenv from 'dotenv'
import { z } from 'zod'
import {
  DEFAULT_CHAT_CONFIG,
  DEFAULT_INTENT_DETECTION_CONFIG,
  DEFAULT_IMAGE_GENERATION_CONFIG,
  DEFAULT_IMAGE_EDITING_CONFIG
} from './services/index'

dotenv.config()

const configSchema = z.object({
  port: z.number().default(3001),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  corsOrigin: z.string().default('http://localhost:3000'),
  inworld: z.object({
    apiKey: z.string(),
    apiSecret: z.string(),
    sceneId: z.string(),
    characterId: z.string()
  }),
  openai: z.object({
    apiKey: z.string()
  }),
  imageEdit: z.object({
    apiKey: z.string(),
    baseUrl: z.string()
  }),
  flux: z.object({
    apiKey: z.string(),
    baseUrl: z.string().default('https://api.bfl.ai'),
    defaultModel: z.string().default('flux-dev'),
    useMock: z.boolean().default(true) // Use mock by default to save API credits
  }),
  images: z.object({
    storagePath: z.string().default('./storage/images'),
    maxSize: z.string().default('10MB'),
    thumbnailSize: z.number().default(300)
  }),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    filePath: z.string().default('./logs/app.log')
  }),
  rateLimit: z.object({
    windowMs: z.number().default(900000),
    maxRequests: z.number().default(100)
  }),
  session: z.object({
    timeoutMs: z.number().default(1800000)
  }),
  llm: z.object({
    provider: z.string().default(DEFAULT_CHAT_CONFIG.provider),
    defaultModel: z.string().default(DEFAULT_CHAT_CONFIG.modelName),
    chat: z.object({
      temperature: z.number().default(DEFAULT_CHAT_CONFIG.temperature),
      maxTokens: z.number().default(DEFAULT_CHAT_CONFIG.maxTokens),
      stream: z.boolean().default(DEFAULT_CHAT_CONFIG.stream)
    }),
    intentDetection: z.object({
      temperature: z.number().default(DEFAULT_INTENT_DETECTION_CONFIG.temperature),
      maxTokens: z.number().default(DEFAULT_INTENT_DETECTION_CONFIG.maxTokens),
      stream: z.boolean().default(DEFAULT_INTENT_DETECTION_CONFIG.stream)
    }),
    imageGeneration: z.object({
      promptEnhancement: z.object({
        temperature: z.number().default(DEFAULT_IMAGE_GENERATION_CONFIG.promptEnhancement.temperature),
        maxTokens: z.number().default(DEFAULT_IMAGE_GENERATION_CONFIG.promptEnhancement.maxTokens),
        stream: z.boolean().default(DEFAULT_IMAGE_GENERATION_CONFIG.promptEnhancement.stream)
      })
    }),
    imageEditing: z.object({
      contextAnalysis: z.object({
        temperature: z.number().default(DEFAULT_IMAGE_EDITING_CONFIG.contextAnalysis.temperature),
        maxTokens: z.number().default(DEFAULT_IMAGE_EDITING_CONFIG.contextAnalysis.maxTokens),
        stream: z.boolean().default(DEFAULT_IMAGE_EDITING_CONFIG.contextAnalysis.stream)
      }),
      instructionEnhancement: z.object({
        temperature: z.number().default(DEFAULT_IMAGE_EDITING_CONFIG.instructionEnhancement.temperature),
        maxTokens: z.number().default(DEFAULT_IMAGE_EDITING_CONFIG.instructionEnhancement.maxTokens),
        stream: z.boolean().default(DEFAULT_IMAGE_EDITING_CONFIG.instructionEnhancement.stream)
      })
    })
  })
})

const parseConfig = () => {
  try {
    return configSchema.parse({
      port: Number(process.env.PORT) || 3001,
      nodeEnv: process.env.NODE_ENV || 'development',
      corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      inworld: {
        apiKey: process.env.INWORLD_API_KEY || '',
        apiSecret: process.env.INWORLD_API_SECRET || '',
        sceneId: process.env.INWORLD_SCENE_ID || '',
        characterId: process.env.INWORLD_CHARACTER_ID || ''
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY || ''
      },
      imageEdit: {
        apiKey: process.env.IMAGE_EDIT_API_KEY || '',
        baseUrl: process.env.IMAGE_EDIT_BASE_URL || ''
      },
      flux: {
        apiKey: process.env.FLUX_API_KEY || '',
        baseUrl: process.env.FLUX_API_BASE_URL || 'https://api.bfl.ai',
        defaultModel: process.env.FLUX_DEFAULT_MODEL || 'flux-dev',
        useMock: process.env.FLUX_USE_MOCK !== 'false' // Default to mock unless explicitly set to false
      },
      images: {
        storagePath: process.env.IMAGE_STORAGE_PATH || './storage/images',
        maxSize: process.env.IMAGE_MAX_SIZE || '10MB',
        thumbnailSize: Number(process.env.IMAGE_THUMBNAIL_SIZE) || 300
      },
      logging: {
        level: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
        filePath: process.env.LOG_FILE_PATH || './logs/app.log'
      },
      rateLimit: {
        windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
        maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
      },
      session: {
        timeoutMs: Number(process.env.SESSION_TIMEOUT_MS) || 1800000
      },
      llm: {
        provider: process.env.LLM_PROVIDER || 'openai',
        defaultModel: process.env.LLM_DEFAULT_MODEL || 'gpt-4o-mini',
        chat: {
          temperature: Number(process.env.LLM_CHAT_TEMPERATURE) || 0.7,
          maxTokens: Number(process.env.LLM_CHAT_MAX_TOKENS) || 500,
          stream: process.env.LLM_CHAT_STREAM !== 'false'
        },
        intentDetection: {
          temperature: Number(process.env.LLM_INTENT_TEMPERATURE) || 0.1,
          maxTokens: Number(process.env.LLM_INTENT_MAX_TOKENS) || 150,
          stream: process.env.LLM_INTENT_STREAM === 'true'
        },
        imageGeneration: {
          promptEnhancement: {
            temperature: Number(process.env.LLM_IMAGE_GEN_TEMPERATURE) || 0.8,
            maxTokens: Number(process.env.LLM_IMAGE_GEN_MAX_TOKENS) || 300,
            stream: process.env.LLM_IMAGE_GEN_STREAM === 'true'
          }
        },
        imageEditing: {
          contextAnalysis: {
            temperature: Number(process.env.LLM_IMAGE_EDIT_CONTEXT_TEMPERATURE) || 0.3,
            maxTokens: Number(process.env.LLM_IMAGE_EDIT_CONTEXT_MAX_TOKENS) || 400,
            stream: process.env.LLM_IMAGE_EDIT_CONTEXT_STREAM === 'true'
          },
          instructionEnhancement: {
            temperature: Number(process.env.LLM_IMAGE_EDIT_INSTRUCTION_TEMPERATURE) || 0.8,
            maxTokens: Number(process.env.LLM_IMAGE_EDIT_INSTRUCTION_MAX_TOKENS) || 300,
            stream: process.env.LLM_IMAGE_EDIT_INSTRUCTION_STREAM === 'true'
          }
        }
      }
    })
  } catch (error) {
    console.error('Configuration validation failed:', error)
    process.exit(1)
  }
}

export const config = parseConfig()
export type Config = z.infer<typeof configSchema>