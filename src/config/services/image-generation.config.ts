/**
 * Image Generation Service Configuration
 * 
 * Default LLM settings optimized for prompt enhancement
 * Higher temperature for creative prompt improvements
 */

export interface ImageGenerationServiceConfig {
  promptEnhancement: {
    enabled: boolean
    provider: string
    modelName: string
    temperature: number
    maxTokens: number
    stream: boolean
  }
  flux: {
    defaultModel: string
    defaultWidth: number
    defaultHeight: number
    defaultSteps: number
    defaultGuidance: number
  }
}

export const DEFAULT_IMAGE_GENERATION_CONFIG: ImageGenerationServiceConfig = {
  promptEnhancement: {
    enabled: true,
    provider: 'openai',
    modelName: 'gpt-4o-mini',
    temperature: 0.8,      // High creativity for prompt enhancement
    maxTokens: 300,        // Sufficient for detailed prompt improvements
    stream: false          // Complete enhanced prompts needed
  },
  flux: {
    defaultModel: 'flux-dev',
    defaultWidth: 1024,
    defaultHeight: 1024,
    defaultSteps: 20,
    defaultGuidance: 7.5
  }
}

export const IMAGE_GENERATION_CONFIG_PRESETS = {
  creative: {
    ...DEFAULT_IMAGE_GENERATION_CONFIG,
    promptEnhancement: {
      ...DEFAULT_IMAGE_GENERATION_CONFIG.promptEnhancement,
      temperature: 0.95,
      maxTokens: 400
    }
  },
  
  precise: {
    ...DEFAULT_IMAGE_GENERATION_CONFIG,
    promptEnhancement: {
      ...DEFAULT_IMAGE_GENERATION_CONFIG.promptEnhancement,
      temperature: 0.6,
      maxTokens: 250
    }
  },
  
  fast: {
    ...DEFAULT_IMAGE_GENERATION_CONFIG,
    promptEnhancement: {
      ...DEFAULT_IMAGE_GENERATION_CONFIG.promptEnhancement,
      enabled: false  // Skip enhancement for speed
    },
    flux: {
      ...DEFAULT_IMAGE_GENERATION_CONFIG.flux,
      defaultSteps: 10  // Faster generation
    }
  }
}
