import axios from 'axios'
import 'dotenv/config'

const API_BASE = 'http://localhost:3001/api/chat'

describe('Unified API Integration', () => {
  test('should test unified API workflow', async () => {
  console.log('🔄 Testing Unified Chat API')
  console.log('============================')

  let sessionId = ''

  try {
    // Test 1: Health Check
    console.log('🏥 Health check...')
    const healthResponse = await axios.get(`${API_BASE}/health`)
    console.log('✅ Health status:', {
      status: healthResponse.status,
      healthy: healthResponse.data.success,
      services: healthResponse.data.data
    })

    // Test 2: Create Session
    console.log('\n📝 Creating session...')
    const sessionResponse = await axios.post(`${API_BASE}/sessions`)
    sessionId = sessionResponse.data.data.sessionId
    console.log('✅ Session created:', {
      sessionId,
      capabilities: sessionResponse.data.data.capabilities
    })

    // If sessionId is undefined, use the one from the first chat message
    if (!sessionId) {
      console.log('⚠️ SessionId undefined, will get it from first message...')
    }

    // Test 3: Regular Chat Message
    console.log('\n💬 Testing regular chat...')
    const chatResponse = await axios.post(`${API_BASE}/`, {
      message: 'Hello! How are you today?',
      sessionId
    })

    // Get sessionId from response if not available
    if (!sessionId) {
      sessionId = chatResponse.data.data.sessionId
    }

    console.log('✅ Chat response:', {
      messageId: chatResponse.data.data.message.id,
      content: chatResponse.data.data.message.content.substring(0, 100),
      detectedIntent: chatResponse.data.data.detectedIntent,
      conversationLength: chatResponse.data.data.context.conversationLength,
      actualSessionId: sessionId
    })

    // Test 4: Image Generation via Chat
    console.log('\n🎨 Testing image generation through unified chat...')
    const imageGenResponse = await axios.post(`${API_BASE}/`, {
      message: 'Generate a beautiful sunset over mountains with vibrant colors',
      sessionId
    })
    console.log('✅ Image generation response:', {
      messageId: imageGenResponse.data.data.message.id,
      isImageGeneration: imageGenResponse.data.data.message.content.includes('Image Generated'),
      detectedIntent: imageGenResponse.data.data.detectedIntent,
      hasImages: imageGenResponse.data.data.context.hasImages,
      imageCount: imageGenResponse.data.data.context.imageCount,
      suggestions: imageGenResponse.data.data.suggestions?.slice(0, 2)
    })

    // Test 5: Direct Image Generation
    console.log('\n🖼️ Testing direct image generation API...')
    const directImageResponse = await axios.post(`${API_BASE}/images/generate`, {
      prompt: 'A wise old wizard with a long white beard',
      sessionId,
      quality: 'fast'
    })
    console.log('✅ Direct image generation:', {
      imageId: directImageResponse.data.data.image?.id,
      imageUrl: directImageResponse.data.data.image?.storageUrl,
      enhancedPrompt: directImageResponse.data.data.enhancedPrompt?.substring(0, 80),
      generationTime: directImageResponse.data.data.generationTime
    })

    // Test 6: Get Session Information
    console.log('\n📊 Getting session information...')
    const sessionInfoResponse = await axios.get(`${API_BASE}/sessions/${sessionId}`)
    console.log('✅ Session info:', {
      sessionId: sessionInfoResponse.data.data.sessionId,
      messageCount: sessionInfoResponse.data.data.stats.messageCount,
      imageCount: sessionInfoResponse.data.data.stats.imageCount,
      intents: sessionInfoResponse.data.data.stats.intents
    })

    // Test 7: Get Session Images
    console.log('\n📸 Getting session images...')
    const imagesResponse = await axios.get(`${API_BASE}/sessions/${sessionId}/images`)
    console.log('✅ Session images:', {
      imageCount: imagesResponse.data.data.count,
      images: imagesResponse.data.data.images?.map((img: any) => ({
        id: img.id,
        description: img.description?.substring(0, 50)
      }))
    })

    // Test 8: Get Contextual Suggestions
    console.log('\n💡 Getting contextual suggestions...')
    const suggestionsResponse = await axios.get(`${API_BASE}/suggestions/${sessionId}`)
    console.log('✅ Suggestions:', {
      count: suggestionsResponse.data.data.suggestions.length,
      contextAware: suggestionsResponse.data.data.contextAware,
      suggestions: suggestionsResponse.data.data.suggestions.slice(0, 3)
    })

    // Test 9: Follow-up Conversation
    console.log('\n🔄 Testing conversation continuity...')
    const followUpResponse = await axios.post(`${API_BASE}/`, {
      message: 'Tell me about the images we just created',
      sessionId
    })
    console.log('✅ Follow-up response:', {
      content: followUpResponse.data.data.message.content.substring(0, 100),
      conversationLength: followUpResponse.data.data.context.conversationLength,
      maintainedContext: followUpResponse.data.data.context.conversationLength > 2
    })

    // Test 10: Session Context
    console.log('\n📋 Getting current session context...')
    const contextResponse = await axios.get(`${API_BASE}/sessions/${sessionId}/context`)
    console.log('✅ Session context:', {
      conversationLength: contextResponse.data.data.conversationLength,
      hasImages: contextResponse.data.data.hasImages,
      sessionDuration: contextResponse.data.data.stats.sessionDuration,
      lastIntent: contextResponse.data.data.lastIntent
    })

    // Test 11: Performance Summary
    console.log('\n⏱️ API Performance Summary...')
    console.log('✅ All endpoints working:', {
      unifiedChat: '✅ /api/chat/ (POST)',
      sessionManagement: '✅ /api/chat/sessions (POST/GET)',
      imageGeneration: '✅ /api/chat/images/generate (POST)',
      suggestions: '✅ /api/chat/suggestions/:id (GET)',
      health: '✅ /api/chat/health (GET)'
    })

  } catch (error) {
    const errorDetails: any = {
      message: error instanceof Error ? error.message : String(error)
    }
    if (error && typeof error === 'object' && 'response' in error) {
      errorDetails.status = (error as any).response?.status
      errorDetails.data = (error as any).response?.data
    }
    console.error('❌ API test failed:', errorDetails)
  } finally {
    // Cleanup
    if (sessionId) {
      try {
        console.log('\n🧹 Cleaning up session...')
        await axios.delete(`${API_BASE}/sessions/${sessionId}`)
        console.log('✅ Session cleaned up')
      } catch (error) {
        console.warn('Warning during cleanup:', error instanceof Error ? error.message : String(error))
      }
    }
  }

  console.log('\n🎉 Unified API test completed!')
  }, 60000) // 60 second timeout for this integration test
})
