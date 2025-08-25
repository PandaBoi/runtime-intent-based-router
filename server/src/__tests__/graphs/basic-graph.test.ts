import {
  GraphBuilder,
  GraphTypes,
  RemoteLLMChatNode
} from '@inworld/runtime/graph'
import 'dotenv/config'

describe('Test Setup', () => {
  test('should be configured correctly', () => {
    expect(process.env.NODE_ENV).toBe('test')
  })
})

describe('BasicGraphTest', () => {
  test('should execute minimal graph', async () => {
  console.log('🧪 Testing Minimal RemoteLLMChatNode Graph')
  console.log('============================================')

  try {
    const apiKey = process.env.INWORLD_API_KEY
    if (!apiKey) {
      throw new Error('INWORLD_API_KEY environment variable not set')
    }

    console.log('✅ API Key found:', apiKey.substring(0, 10) + '...')

    // Create simple LLM node
    console.log('📦 Creating RemoteLLMChatNode...')
      // Use OpenAI provider as shown in examples
  const llmNode = new RemoteLLMChatNode({
    provider: 'openai',
    modelName: 'gpt-4o-mini',
    stream: false,
    textGenerationConfig: {
      maxNewTokens: 50,
      temperature: 0.7
    }
  })
    console.log('✅ RemoteLLMChatNode created')

    // Build graph
    console.log('🔗 Building graph...')
    const graph = new GraphBuilder({
      id: 'minimal_test_graph',
      apiKey,
      enableRemoteConfig: false
    })
      .addNode(llmNode)
      .setStartNode(llmNode)
      .setEndNode(llmNode)
      .build()

    console.log('✅ Graph built successfully')

    // Test simple message
    const testMessage = 'Hello! Please respond with just "SUCCESS" if you can hear me.'

    console.log('📤 Sending test message:', testMessage)

    const graphInput = {
      messages: [
        {
          role: 'user',
          content: testMessage
        }
      ]
    }

    console.log('🚀 Starting graph execution...')
    // The graph.start() method should return a GraphOutputStream directly
    const outputStream = graph.start(new GraphTypes.LLMChatRequest(graphInput))

    console.log('🔍 Inspecting outputStream:', {
      hasOutputStream: !!outputStream,
      type: typeof outputStream,
      isIterable: outputStream && typeof outputStream[Symbol.asyncIterator] === 'function',
      keys: outputStream ? Object.keys(outputStream) : []
    })

    if (!outputStream) {
      throw new Error('Graph start() returned null/undefined')
    }

    if (typeof outputStream[Symbol.asyncIterator] !== 'function') {
      throw new Error('Graph start() did not return an iterable stream')
    }

    let responseReceived = false
    let resultCount = 0

    console.log('👂 Listening for responses...')
    console.log('📊 OutputStream info:', {
      type: typeof outputStream,
      isIterable: !!outputStream[Symbol.asyncIterator],
      keys: Object.keys(outputStream)
    })

    for await (const result of outputStream) {
      resultCount++
      console.log(`📥 Received result #${resultCount}:`, {
        type: typeof result,
        keys: Object.keys(result),
        hasProcessResponse: typeof result.processResponse === 'function'
      })

      await result.processResponse({
        Content: (response: GraphTypes.Content) => {
          console.log('✅ Content Response:', response.content)
          responseReceived = true
        },
        ContentStream: async (stream: GraphTypes.ContentStream) => {
          console.log('📡 ContentStream Response:')
          let streamContent = ''
          for await (const chunk of stream) {
            if (chunk.text) {
              streamContent += chunk.text
              process.stdout.write(chunk.text)
            }
          }
          console.log('\n✅ Stream Complete:', streamContent)
          responseReceived = true
        },
        string: (text: string) => {
          console.log('✅ String Response:', text)
          responseReceived = true
        },
        default: (data: any) => {
          console.log('❓ Unhandled Response Type:', {
            data: JSON.stringify(data).substring(0, 200),
            type: typeof data
          })
        }
      })
    }

    console.log('🏁 Stream iteration complete')
    console.log('📊 Results:', {
      totalResults: resultCount,
      responseReceived,
      success: responseReceived
    })

    // Cleanup - ensure async operations complete
    console.log('🧹 Starting cleanup...')
    await graph.cleanupAllExecutions()
    await new Promise(resolve => setTimeout(resolve, 100)) // Allow cleanup to complete
    graph.destroy()
    console.log('🧹 Cleanup complete')

    if (responseReceived) {
      console.log('🎉 SUCCESS: Graph execution working!')
      expect(responseReceived).toBe(true)
    } else {
      console.log('❌ FAILURE: No response received from graph')
      expect(responseReceived).toBe(true) // This will fail the test properly
    }

  } catch (error) {
    console.error('💥 Error during test:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error // Re-throw so Jest knows the test failed
  }
  }, 30000) // 30 second timeout
})
