import 'dotenv/config'
import { logger } from '../utils/logger'

// Set test environment
process.env.NODE_ENV = 'test'
// Force mock usage during tests to avoid API costs and failures
process.env.FLUX_USE_MOCK = 'true'

// Mock console for cleaner test output
jest.spyOn(console, 'log').mockImplementation(() => {})
jest.spyOn(console, 'info').mockImplementation(() => {})
jest.spyOn(console, 'warn').mockImplementation(() => {})

// Configure logger for tests
logger.level = 'error'

// Global test timeout
jest.setTimeout(30000)

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks()
})

// Global cleanup after all tests
afterAll(async () => {
  // Import here to avoid module loading issues
  const { sessionManager } = require('../services/session-manager.service')
  sessionManager.destroy()

  // Give gRPC connections time to close properly
  await new Promise(resolve => setTimeout(resolve, 500))
})

// This is a setup file, not a test file
describe('Test Setup', () => {
  test('should be configured correctly', () => {
    expect(process.env.NODE_ENV).toBe('test')
  })
})
