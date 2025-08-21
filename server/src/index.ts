import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { config } from './config'
import { logger } from './utils/logger'
import { errorHandler } from './utils/error-handler'
import { chatRoutes } from './routes/chat'
import { healthRoutes } from './routes/health'

const app = express()

app.use(helmet())
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/health', healthRoutes)
app.use('/api/chat', chatRoutes)

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