import 'dotenv/config'
import { ChatService } from '../../services/chat-service'
import { imageGenerationService } from '../../services/image-generation.service'
import { intentDetectionService } from '../../services/intent-detection.service'
import { sessionManager } from '../../services/session-manager.service'

async function testFullIntegration() {
  console.log('🔄 Testing Complete System Integration')
  console.log('=====================================')

  const chatService = new ChatService()
  let sessionId = ''

  try {
    // Test 1: Initialize all services
    console.log('🚀 Initializing all services...')
    await chatService.initialize()
    console.log('✅ Chat service (with intent detection + image generation) initialized')

    // Test 2: Create session
    console.log('\n📝 Creating session...')
    sessionId = await chatService.createSession()
    console.log('✅ Session created:', sessionId)

    // Test 3: Regular chat message
    console.log('\n💬 Testing regular chat...')
    const chatResult = await chatService.processMessage('Hello, how are you?', sessionId)
    console.log('✅ Chat response:', {
      id: chatResult.id,
      content: chatResult.content.substring(0, 100),
      sessionId: chatResult.sessionId
    })

    // Test 4: Image generation intent
    console.log('\n🎨 Testing image generation through chat...')
    const imageGenResult = await chatService.processMessage(
      'Generate a beautiful landscape with mountains and a sunset',
      sessionId
    )
    console.log('✅ Image generation response:', {
      id: imageGenResult.id,
      isImageGeneration: imageGenResult.content.includes('Image Generated'),
      sessionId: imageGenResult.sessionId
    })

    // Test 5: Session context verification
    console.log('\n📊 Checking session context...')
    const sessionContext = await chatService.getSessionContext(sessionId)
    console.log('✅ Session context:', {
      conversationLength: sessionContext?.conversationLength,
      hasImages: sessionContext?.hasImages,
      lastIntent: sessionContext?.lastIntent,
      imageCount: sessionContext?.stats?.imageCount,
      messageCount: sessionContext?.stats?.messageCount
    })

    // Test 6: Follow-up chat after image generation
    console.log('\n🔄 Testing conversation continuity...')
    const followUpResult = await chatService.processMessage(
      'That image looks great! Can you tell me about the colors used?',
      sessionId
    )
    console.log('✅ Follow-up response:', {
      content: followUpResult.content.substring(0, 100),
      sessionId: followUpResult.sessionId
    })

    // Test 7: Another image generation request
    console.log('\n🎨 Testing second image generation...')
    const secondImageResult = await chatService.processMessage(
      'Create a portrait of a wise old wizard with a long beard',
      sessionId
    )
    console.log('✅ Second image generation:', {
      isImageGeneration: secondImageResult.content.includes('Image Generated'),
      sessionId: secondImageResult.sessionId
    })

    // Test 8: Image editing intent (should show coming soon message)
    console.log('\n✏️ Testing image editing intent...')
    const editResult = await chatService.processMessage(
      'Edit the last image to make it brighter and more colorful',
      sessionId
    )
    console.log('✅ Image editing response:', {
      content: editResult.content.substring(0, 100),
      sessionId: editResult.sessionId
    })

    // Test 9: Get session history
    console.log('\n📚 Getting session history...')
    const history = await chatService.getSessionHistory(sessionId)
    console.log('✅ Session history:', {
      totalMessages: history.length,
      intents: history.map(turn => turn.detectedIntent).filter(Boolean),
      hasImageResponses: history.some(turn =>
        typeof turn.response === 'string' && turn.response.includes('Image Generated')
      )
    })

    // Test 10: Service health checks
    console.log('\n🏥 Final health checks...')
    const healthChecks = {
      intentDetection: await intentDetectionService.healthCheck(),
      imageGeneration: await imageGenerationService.healthCheck(),
      chatService: true // Chat service is working if we got this far
    }
    console.log('✅ Health status:', healthChecks)

    // Test 11: Performance summary
    console.log('\n⏱️ Performance summary...')
    const session = await sessionManager.getSession(sessionId)
    if (session) {
      console.log('✅ Session info:', {
        sessionId: session.sessionId,
        messageCount: session.conversationHistory.length,
        created: session.createdAt,
        lastActivity: session.lastActivity
      })
    }

  } catch (error) {
    console.error('❌ Integration test failed:', error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack)
    }
  } finally {
    // Cleanup
    console.log('\n🧹 Cleanup...')
    try {
      if (sessionId) {
        await chatService.closeSession(sessionId)
        console.log('✅ Session closed')
      }

      await imageGenerationService.disconnect()
      console.log('✅ Image generation service disconnected')
    } catch (error) {
      console.warn('Warning during cleanup:', error instanceof Error ? error.message : String(error))
    }
  }

  console.log('\n🎉 Full integration test completed!')
}

// Run the test
testFullIntegration()
  .catch(console.error)
  .finally(() => {
    console.log('Integration test finished')
  })
