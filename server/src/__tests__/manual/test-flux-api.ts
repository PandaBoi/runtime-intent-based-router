import 'dotenv/config'
import { fluxApiService } from './services/flux-api.service'

async function testFluxApi() {
  console.log('🧪 Testing Flux API Service')
  console.log('============================')

  try {
    // Test 1: Check configuration
    console.log('📋 Testing configuration...')
    const models = await fluxApiService.getModels()
    console.log('✅ Available models:', Object.keys(models))

    // Test 2: Get default parameters
    console.log('\n⚙️ Default parameters:')
    const defaults = fluxApiService.getDefaultParameters()
    console.log(defaults)

    // Test 3: Health check (will fail without API key, but tests structure)
    console.log('\n🏥 Health check...')
    const isHealthy = await fluxApiService.healthCheck()
    console.log(isHealthy ? '✅ Service healthy' : '⚠️ Service not configured (expected without API key)')

    // Test 4: Mock image generation (safe - no credits used)
    console.log('\n🎨 Testing mock image generation...')
    const result = await fluxApiService.generateImage({
      prompt: 'A beautiful sunset over mountains',
      model: 'flux-1-schnell', // Fastest model for testing
      width: 512,
      height: 512
    })

    console.log('✅ Mock image generated:', {
      id: result.id,
      status: result.status,
      imageUrl: result.result?.images?.[0]?.url,
      dimensions: `${result.result?.images?.[0]?.width}x${result.result?.images?.[0]?.height}`
    })

    if (process.env.FLUX_API_KEY && process.env.FLUX_USE_MOCK === 'false') {
      console.log('\n⚠️ Real API mode detected (FLUX_USE_MOCK=false)')
      console.log('   This would use actual API credits!')
      console.log('   Set FLUX_USE_MOCK=true to use mock mode')
    } else {
      console.log('\n✅ Running in safe MOCK mode - no API credits used')
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }

  console.log('\n✅ Flux API test completed')
}

testFluxApi()
  .catch(console.error)
  .finally(() => {
    console.log('Test finished')
  })
