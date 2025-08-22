import dotenv from 'dotenv'
import { z } from 'zod'

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
    baseUrl: z.string().default('https://api.fluxapi.ai'),
    defaultModel: z.string().default('flux-1-dev'),
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
        baseUrl: process.env.FLUX_API_BASE_URL || 'https://api.fluxapi.ai',
        defaultModel: process.env.FLUX_DEFAULT_MODEL || 'flux-1-dev',
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
      }
    })
  } catch (error) {
    console.error('Configuration validation failed:', error)
    process.exit(1)
  }
}

export const config = parseConfig()
export type Config = z.infer<typeof configSchema>