import crypto from 'crypto'
import 'dotenv/config'

// Copy the exact pattern from the examples
import {
    GraphBuilder,
    GraphTypes,
    RemoteLLMChatNode,
} from '@inworld/runtime/graph'

async function testBasicLLM() {
  console.log('🧪 Testing Basic LLM Chat (following exact example pattern)')
  console.log('========================================================')

  const apiKey = process.env.INWORLD_API_KEY || ''
  if (!apiKey) {
    throw new Error('INWORLD_API_KEY environment variable not set')
  }

  console.log('✅ API Key found')

  // Follow the exact pattern from node_llm_chat.ts
  const llmNode = new RemoteLLMChatNode({
    stream: true, // Enable streaming like in examples
    provider: 'inworld',
    modelName: 'gpt-3.5-turbo',
    textGenerationConfig: {
      maxNewTokens: 50,
    },
  })

  const graph = new GraphBuilder({
    id: 'basic_llm_test_graph',
    enableRemoteConfig: false,
    apiKey,
  })
    .addNode(llmNode)
    .setStartNode(llmNode)
    .setEndNode(llmNode)
    .build()

  // Follow exact graphInput pattern from examples
  const graphInput = {
    messages: [
      {
        role: 'user',
        content: 'Say exactly "SUCCESS" if you can hear me.'
      }
    ]
  }

  console.log('📤 Starting graph with LLMChatRequest...')

  try {
    // This is the correct pattern used in our working graphs
    const outputStream = graph.start(
      new GraphTypes.LLMChatRequest(graphInput),
      crypto.randomUUID()
    )

    console.log('✅ Got outputStream, starting iteration...')

    for await (const result of outputStream) {
      console.log('📥 Got result from stream')

      await result.processResponse({
        Content: (response: GraphTypes.Content) => {
          console.log('📥 LLM Chat Response:')
          console.log('  Content:', response.content)
        },
        ContentStream: async (stream: GraphTypes.ContentStream) => {
          console.log('📡 LLM Chat Response Stream:')
          let streamContent = ''
          for await (const chunk of stream) {
            if (chunk.text) {
              streamContent += chunk.text
              process.stdout.write(chunk.text)
            }
          }
          console.log(`\n✅ Stream complete: "${streamContent}"`)
        },
        default: (data: any) => {
          console.error('❓ Unprocessed response:', data)
        },
      })
    }

    console.log('🎉 Test completed successfully!')

  } catch (error) {
    console.error('💥 Error:', error instanceof Error ? error.message : String(error))
    throw error
  }
}

testBasicLLM().then(() => {
  console.log('✅ Basic LLM test complete')
}).catch(err => {
  console.error('❌ Basic LLM test failed:', err)
  process.exit(1)
})
