/**
 * Image Editing Service Configuration
 * 
 * Default LLM settings optimized for image editing workflows
 * Separate configs for context analysis and instruction enhancement
 */

export interface ImageEditingServiceConfig {
  contextAnalysis: {
    enabled: boolean
    provider: string
    modelName: string
    temperature: number
    maxTokens: number
    stream: boolean
  }
  instructionEnhancement: {
    enabled: boolean
    provider: string
    modelName: string
    temperature: number
    maxTokens: number
    stream: boolean
  }
  flux: {
    defaultStrength: number
    defaultGuidance: number
    defaultSteps: number
  }
}

export const DEFAULT_IMAGE_EDITING_CONFIG: ImageEditingServiceConfig = {
  contextAnalysis: {
    enabled: true,
    provider: 'openai',
    modelName: 'gpt-4o-mini',
    temperature: 0.3,      // Low for analytical tasks
    maxTokens: 400,        // Detailed context analysis
    stream: false          // Complete analysis needed
  },
  instructionEnhancement: {
    enabled: true,
    provider: 'openai',
    modelName: 'gpt-4o-mini',
    temperature: 0.8,      // Higher for creative instruction improvement
    maxTokens: 300,        // Enhanced editing instructions
    stream: false          // Complete instructions needed
  },
  flux: {
    defaultStrength: 0.7,
    defaultGuidance: 7.5,
    defaultSteps: 20
  }
}

export const IMAGE_EDITING_CONFIG_PRESETS = {
  precise: {
    ...DEFAULT_IMAGE_EDITING_CONFIG,
    contextAnalysis: {
      ...DEFAULT_IMAGE_EDITING_CONFIG.contextAnalysis,
      temperature: 0.1,
      maxTokens: 500
    },
    instructionEnhancement: {
      ...DEFAULT_IMAGE_EDITING_CONFIG.instructionEnhancement,
      temperature: 0.6
    }
  },
  
  creative: {
    ...DEFAULT_IMAGE_EDITING_CONFIG,
    instructionEnhancement: {
      ...DEFAULT_IMAGE_EDITING_CONFIG.instructionEnhancement,
      temperature: 0.9,
      maxTokens: 400
    },
    flux: {
      ...DEFAULT_IMAGE_EDITING_CONFIG.flux,
      defaultStrength: 0.8
    }
  },
  
  fast: {
    ...DEFAULT_IMAGE_EDITING_CONFIG,
    contextAnalysis: {
      ...DEFAULT_IMAGE_EDITING_CONFIG.contextAnalysis,
      enabled: false  // Skip context analysis for speed
    },
    instructionEnhancement: {
      ...DEFAULT_IMAGE_EDITING_CONFIG.instructionEnhancement,
      maxTokens: 200
    },
    flux: {
      ...DEFAULT_IMAGE_EDITING_CONFIG.flux,
      defaultSteps: 15
    }
  }
}
