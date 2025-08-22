import { ChatMessage, IntentType } from './index'

export interface ImageMetadata {
  id: string
  originalName: string
  mimeType: string
  size: number
  uploadedAt: Date
  storageUrl: string
  thumbnailUrl?: string
  description?: string
  generatedBy?: 'user_upload' | 'flux_generation'
}

export interface ConversationTurn {
  id: string
  timestamp: Date
  userInput: string
  detectedIntent: IntentType
  confidence: number
  response: ChatMessage | ImageMetadata | string
  contextUsed?: string[] // References to previous turns or images
}

export interface SessionState {
  sessionId: string
  createdAt: Date
  lastActivity: Date
  
  // Conversation tracking
  conversationHistory: ConversationTurn[]
  currentContext: {
    lastIntent: IntentType | null
    activeImages: string[] // IDs of images in current context
    pendingAction: string | null // e.g., "waiting_for_image_upload"
  }
  
  // Image management
  uploadedImages: Map<string, ImageMetadata>
  generatedImages: Map<string, ImageMetadata>
  
  // User preferences and patterns
  preferences: {
    preferredImageStyle?: string
    commonEditingInstructions?: string[]
    chatPersonality?: string
  }
  
  // Session metadata
  metadata: {
    userAgent?: string
    ipAddress?: string
    totalMessages: number
    totalImagesUploaded: number
    totalImagesGenerated: number
  }
}

export interface SessionManager {
  createSession(userId?: string): Promise<SessionState>
  getSession(sessionId: string): Promise<SessionState | null>
  updateSession(sessionId: string, updates: Partial<SessionState>): Promise<void>
  addConversationTurn(sessionId: string, turn: ConversationTurn): Promise<void>
  addImage(sessionId: string, image: ImageMetadata): Promise<void>
  getSessionImages(sessionId: string): Promise<ImageMetadata[]>
  getActiveImages(sessionId: string): Promise<ImageMetadata[]>
  setActiveImages(sessionId: string, imageIds: string[]): Promise<void>
  cleanupExpiredSessions(): Promise<void>
  getSessionStats(sessionId: string): Promise<SessionStats>
}

export interface SessionStats {
  sessionDuration: number // in minutes
  messageCount: number
  intentDistribution: Record<IntentType, number>
  imageCount: number
  averageResponseTime: number
}

export interface ContextReference {
  type: 'image' | 'message' | 'generation'
  id: string
  relevance: number // 0-1 score
  timestamp: Date
}

export interface SessionContextAnalyzer {
  analyzeContext(sessionId: string, userInput: string): Promise<ContextReference[]>
  findRelevantImages(sessionId: string, query: string): Promise<ImageMetadata[]>
  determineImageEditTarget(sessionId: string, editInstruction: string): Promise<ImageMetadata | null>
  suggestFollowUpActions(sessionId: string): Promise<string[]>
}
