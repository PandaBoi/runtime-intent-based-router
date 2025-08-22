import 'dotenv/config'
import { imageGenerationService } from '../../services/image-generation.service'
import { sessionManager } from '../../services/session-manager.service'

async function testImageGeneration() {
  console.log('🎨 Testing Image Generation System')
  console.log('==================================')

  try {
    // Test 1: Service Information
    console.log('📋 Getting service information...')
    const serviceInfo = imageGenerationService.getServiceInfo()
    console.log('✅ Service Info:', JSON.stringify(serviceInfo, null, 2))

    // Test 2: Health Check
    console.log('\n🏥 Health check...')
    const isHealthy = await imageGenerationService.healthCheck()
    console.log(isHealthy ? '✅ Service healthy' : '⚠️ Service not initialized')

    // Test 3: Initialize service
    console.log('\n🚀 Initializing image generation service...')
    await imageGenerationService.initialize()
    console.log('✅ Service initialized successfully')

    // Test 4: Create test session
    console.log('\n📝 Creating test session...')
    const testSession = await sessionManager.createSession()
    console.log('✅ Test session created:', testSession.sessionId)

    // Test 5: Simple image generation
    console.log('\n🎨 Testing simple image generation...')
    const simpleResult = await imageGenerationService.generateImage(
      'A beautiful sunset over mountains',
      testSession.sessionId
    )

    if (simpleResult.success) {
      console.log('✅ Simple generation successful:', {
        imageId: simpleResult.data?.imageMetadata?.id,
        url: simpleResult.data?.imageMetadata?.storageUrl,
        enhancedPrompt: simpleResult.data?.enhancedPrompt?.substring(0, 100),
        generationTime: `${simpleResult.data?.generationTime}ms`,
        suggestions: simpleResult.data?.suggestions
      })
    } else {
      console.log('❌ Simple generation failed:', simpleResult.error)
    }

    // Test 6: Advanced image generation with options
    console.log('\n⚙️ Testing advanced image generation...')
    const advancedResult = await imageGenerationService.generateImage(
      'Portrait of a wise old wizard',
      testSession.sessionId,
      {
        quality: 'high',
        width: 512,
        height: 768,
        model: 'flux-1-pro'
      }
    )

    if (advancedResult.success) {
      console.log('✅ Advanced generation successful:', {
        imageId: advancedResult.data?.imageMetadata?.id,
        dimensions: `${advancedResult.data?.imageMetadata?.storageUrl}`,
        quality: 'high',
        model: 'flux-1-pro'
      })
    } else {
      console.log('❌ Advanced generation failed:', advancedResult.error)
    }

    // Test 7: Get session images
    console.log('\n📸 Getting session images...')
    const sessionImages = await imageGenerationService.getSessionImages(testSession.sessionId)

    if (sessionImages.success) {
      console.log('✅ Session images retrieved:', {
        imageCount: sessionImages.data?.length,
        images: sessionImages.data?.map(img => ({
          id: img.id,
          description: img.description?.substring(0, 50)
        }))
      })
    } else {
      console.log('❌ Failed to get session images:', sessionImages.error)
    }

    // Test 8: Get suggestions
    console.log('\n💡 Getting generation suggestions...')
    const suggestions = await imageGenerationService.getImageGenerationSuggestions(testSession.sessionId)

    if (suggestions.success) {
      console.log('✅ Suggestions retrieved:', suggestions.data)
    } else {
      console.log('❌ Failed to get suggestions:', suggestions.error)
    }

    // Test 9: Session context check
    console.log('\n📊 Checking session context...')
    const session = await sessionManager.getSession(testSession.sessionId)
    if (session) {
      console.log('✅ Session context:', {
        conversationLength: session.conversationHistory.length,
        imageCount: session.uploadedImages.size + session.generatedImages.size,
        lastIntent: session.currentContext.lastIntent,
        activeImages: session.currentContext.activeImages.length
      })
    }

    // Test 10: Performance timing
    console.log('\n⏱️ Performance test...')
    const perfStart = Date.now()
    const perfResult = await imageGenerationService.generateImage(
      'Quick test image',
      testSession.sessionId,
      { quality: 'fast' }
    )
    const perfTime = Date.now() - perfStart

    console.log('✅ Performance result:', {
      totalTime: `${perfTime}ms`,
      generationTime: `${perfResult.data?.generationTime}ms`,
      mode: 'MOCK' // Since we're using mock by default
    })

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    if (error.stack) {
      console.error('Stack trace:', error.stack)
    }
  } finally {
    // Cleanup
    try {
      await imageGenerationService.disconnect()
      console.log('\n🧹 Service disconnected')
    } catch (error) {
      console.warn('Warning during cleanup:', error.message)
    }
  }

  console.log('\n✅ Image generation test completed')
}

testImageGeneration()
  .catch(console.error)
  .finally(() => {
    console.log('Test finished')
  })
