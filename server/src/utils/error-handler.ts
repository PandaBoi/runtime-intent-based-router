import { Request, Response, NextFunction } from 'express'
import { logger } from './logger'

export class AppError extends Error {
  public readonly statusCode: number
  public readonly isOperational: boolean

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational

    Error.captureStackTrace(this, this.constructor)
  }
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500
  let message = 'Internal Server Error'
  let isOperational = false

  if (error instanceof AppError) {
    statusCode = error.statusCode
    message = error.message
    isOperational = error.isOperational
  }

  logger.error('Error occurred', {
    error: {
      message: error.message,
      stack: error.stack,
      statusCode,
      isOperational
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body
    }
  })

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    }
  })
}