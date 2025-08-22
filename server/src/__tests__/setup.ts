import 'dotenv/config'
import { logger } from '../utils/logger'

// Set test environment
process.env.NODE_ENV = 'test'

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

// This is a setup file, not a test file
describe('Test Setup', () => {
  test('should be configured correctly', () => {
    expect(process.env.NODE_ENV).toBe('test')
  })
})
