import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import path from 'path'
import { config } from './config'
import { chatRoutes } from './routes/chat'
import { healthRoutes } from './routes/health'
import imageUploadRoutes from './routes/image-upload'
import { testRoutes } from './routes/test'
import { unifiedChatRoutes } from './routes/unified-chat'
import { errorHandler } from './utils/error-handler'
import { logger } from './utils/logger'

const app = express()

app.use(helmet())
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Pretty print JSON responses in development
if (config.nodeEnv === 'development') {
  app.set('json spaces', 2)
}

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

app.use('/api/health', healthRoutes)
app.use('/api/chat', unifiedChatRoutes) // New unified API
app.use('/api/chat/images', imageUploadRoutes) // Image upload and management
app.use('/api/chat/legacy', chatRoutes) // Legacy routes for backwards compatibility
app.use('/api/test', testRoutes)

app.use(errorHandler)

const server = app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`)
})

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  server.close(() => {
    logger.info('Process terminated')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully')
  server.close(() => {
    logger.info('Process terminated')
    process.exit(0)
  })
})

export default app