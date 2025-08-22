export interface ChatMessage {
  id: string
  content: string
  timestamp: Date
  role: 'user' | 'assistant'
  sessionId: string
}

export interface User {
  id: string
  sessionId: string
  lastActivity: Date
}

export interface Session {
  id: string
  userId: string
  createdAt: Date
  lastActivity: Date
  isActive: boolean
}

export enum IntentType {
  CHAT = 'chat',
  GENERATE_IMAGE = 'generate-image',
  EDIT_IMAGE = 'edit-image',
  UNKNOWN = 'unknown'
}

export interface IntentResult {
  intent: IntentType
  confidence: number
  extractedParams?: {
    prompt?: string
    imageUrl?: string
    editInstructions?: string
  }
}

export interface ImageGenerationRequest {
  prompt: string
  sessionId: string
  model?: string
  width?: number
  height?: number
}

export interface ImageGenerationResponse {
  id: string
  url: string
  prompt: string
  model: string
  createdAt: Date
}

export interface ImageEditingRequest {
  imageUrl: string
  instructions: string
  sessionId: string
  model?: string
}

export interface ImageEditingResponse {
  id: string
  originalUrl: string
  editedUrl: string
  instructions: string
  model: string
  createdAt: Date
}

export interface ServiceResponse<T> {
  success: boolean
  data?: T
  error?: string
  timestamp: Date
}

export interface InworldConnectionState {
  isConnected: boolean
  sessionId?: string
  characterId?: string
  lastActivity?: Date
}

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class InworldError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 500, code)
    this.name = 'InworldError'
  }
}

export class IntentDetectionError extends AppError {
  constructor(message: string) {
    super(message, 400, 'INTENT_DETECTION_ERROR')
    this.name = 'IntentDetectionError'
  }
}

export class ImageServiceError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 500, code)
    this.name = 'ImageServiceError'
  }
}
