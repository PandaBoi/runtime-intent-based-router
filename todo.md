# Intent-Based Routing Chat Application - Comprehensive Todo List

## Project Overview
Build a minimal intent-based routing chat application using Inworld Runtime with server-client architecture. The application will feature three core AI services: text chatbot, image generation, and image editing, with intelligent intent detection to route user requests appropriately.

## Phase 1: Research and Setup

### Research Tasks
- [ ] **Study Inworld Runtime SDK Documentation**
  - Review @inworld/nodejs-sdk API reference
  - Understand character creation and management
  - Research authentication and session handling
  - Explore available events and message types

- [ ] **Research Intent Detection Strategies**
  - Evaluate keyword-based vs ML-based approaches
  - Study text classification for intent routing
  - Research confidence threshold strategies
  - Plan fallback mechanisms for unknown intents

- [ ] **Investigate Image Processing APIs**
  - Research Black Forest Labs Flux API (https://docs.bfl.ai/)
  - Study FLUX.1 Kontext for advanced editing + generation
  - Study FLUX.1 Fill for targeted image editing/inpainting
  - Compare FLUX1.1 [pro] models for text-to-image generation
  - Document BFL API integration patterns and authentication

### Environment Setup
- [ ] **Configure Development Environment**
  - Ensure Node.js LTS is installed
  - Set up npm/yarn package management
  - Configure VS Code/Cursor with TypeScript support
  - Install necessary development extensions

- [ ] **Create Environment Configuration**
  - Create .env.example with all required variables
  - Document Inworld Studio setup requirements
  - List required API keys and credentials
  - Set up development vs production configurations

## Phase 2: Configuration Files

### Package Configuration
- [ ] **Server package.json Setup**
  - Add Express.js and TypeScript (minimal setup)
  - Include @inworld/nodejs-sdk
  - Add ts-node for development
  - Configure basic build and dev scripts

- [ ] **Client package.json Setup**
  - Use vanilla HTML/CSS/JS (no frameworks)
  - Add basic TypeScript compilation
  - Include only fetch API for HTTP requests
  - Minimal styling with basic CSS

### TypeScript Configuration
- [ ] **Server tsconfig.json**
  - Configure strict TypeScript settings
  - Set up module resolution
  - Configure output directory and build options
  - Add path mapping for clean imports

- [ ] **Client tsconfig.json**
  - Configure for frontend development
  - Set up DOM type definitions
  - Configure JSX settings if using React
  - Add appropriate compiler options

### Build Configuration
- [ ] **Server Build Setup**
  - Configure TypeScript compilation
  - Set up nodemon for development
  - Create production build scripts
  - Configure source maps for debugging

- [ ] **Client Build Setup**
  - Configure webpack or Vite
  - Set up development server
  - Configure production optimizations
  - Set up hot module replacement

## Phase 3: Server Implementation

### Core Server Foundation
- [ ] **Express.js Application Setup**
  - Create main Express application
  - Configure middleware (CORS, body parser, etc.)
  - Set up error handling middleware
  - Configure logging with Winston or similar

- [ ] **Health Check Endpoint**
  - Implement /health route
  - Check Inworld Runtime connection status
  - Verify external API connectivity
  - Return service status information

### Inworld Runtime Integration
- [ ] **SDK Connection Setup**
  - Initialize Inworld Runtime client
  - Implement authentication flow
  - Handle connection lifecycle events
  - Configure reconnection logic

- [ ] **Character Management**
  - Create character configuration
  - Implement character session handling
  - Handle character responses and events
  - Manage conversation context

- [ ] **Event Handling System**
  - Process incoming text messages
  - Handle audio events if needed
  - Manage session state changes
  - Implement proper cleanup

### Intent Detection System
- [ ] **Intent Classification Engine**
  - Create intent categories (chat, generate-image, edit-image)
  - Implement keyword-based classification
  - Add confidence scoring system
  - Create intent routing logic

- [ ] **Intent Types and Interfaces**
  - Define Intent enum/types
  - Create IntentResult interface
  - Type detection parameters
  - Define routing configuration

- [ ] **Intent Router Service**
  - Implement main routing logic
  - Handle intent confidence thresholds
  - Add fallback mechanisms
  - Log intent detection results

### Service Layer Implementation
- [ ] **Text Chatbot Service**
  - Integrate with Inworld Runtime character
  - Handle conversation context
  - Process text responses
  - Implement error handling

- [ ] **Image Generation Service**
  - Integrate Black Forest Labs Flux API for image generation (FLUX1.1 [pro])
  - Handle prompt processing
  - Manage API rate limits
  - Implement result caching

- [ ] **Image Editing Service**
  - Integrate Black Forest Labs Flux API for image editing (FLUX.1 Kontext/Fill)
  - Handle file upload/download
  - Process editing commands
  - Manage temporary file storage

### API Routes
- [ ] **Chat Routes**
  - POST /api/chat - Send message and get response
  - GET /api/chat/history - Retrieve chat history
  - DELETE /api/chat/session - Clear session

- [ ] **Image Routes**
  - POST /api/image/generate - Generate new image
  - POST /api/image/edit - Edit existing image
  - GET /api/image/:id - Retrieve image
  - DELETE /api/image/:id - Delete image

- [ ] **Intent Routes**
  - POST /api/intent/detect - Classify user input
  - GET /api/intent/types - List available intents
  - POST /api/intent/route - Process and route request

### Data Models and Types
- [ ] **Core Interfaces**
  - ChatMessage interface
  - User interface
  - Session interface
  - Intent interface

- [ ] **Service Types**
  - ImageGenerationRequest/Response
  - ImageEditingRequest/Response
  - IntentDetectionResult
  - ServiceResponse generic type

- [ ] **Error Types**
  - Custom error classes
  - API error responses
  - Validation error types
  - Service-specific errors

### Utility Functions
- [ ] **Error Handling Utilities**
  - Global error handler middleware
  - Service-specific error processors
  - User-friendly error messages
  - Error logging utilities

- [ ] **Validation Utilities**
  - Input validation functions
  - File validation for images
  - Request sanitization
  - Schema validation

- [ ] **Logger Configuration**
  - Structured logging setup
  - Different log levels
  - Service-specific loggers
  - Production logging configuration

## Phase 4: Client Implementation

### Foundation Setup
- [ ] **Client Application Bootstrap**
  - Set up main application structure
  - Configure routing if needed
  - Set up state management
  - Initialize styling system

- [ ] **Communication Layer**
  - Implement HTTP client for API calls
  - Add WebSocket support if needed
  - Handle connection states
  - Implement retry logic

### User Interface Components
- [ ] **Chat Interface**
  - Message display component
  - Message input component
  - Chat history scrolling
  - Loading states

- [ ] **Image Display Components**
  - Generated image viewer
  - Image editing preview
  - Image upload interface
  - Progress indicators

- [ ] **Navigation and Layout**
  - Main application layout
  - Service selection interface
  - Error message display
  - Status indicators

### Service Integration
- [ ] **Chat Service Client**
  - Send messages to chat API
  - Handle real-time responses
  - Manage conversation history
  - Display typing indicators

- [ ] **Image Service Client**
  - Image generation requests
  - Image editing requests
  - File upload handling
  - Progress tracking

- [ ] **Intent Detection Client**
  - Automatic intent classification
  - Manual service selection
  - Intent confidence display
  - Service routing feedback

### State Management
- [ ] **Application State**
  - Current service state
  - Chat history state
  - Image gallery state
  - Loading and error states

- [ ] **Session Management**
  - User session tracking
  - Service authentication
  - Connection status
  - Session persistence

### User Experience Features
- [ ] **Loading States**
  - Message sending indicators
  - Image generation progress
  - Service connection status
  - Operation feedback

- [ ] **Error Handling**
  - Network error display
  - Service error messages
  - Retry mechanisms
  - Graceful degradation

- [ ] **Responsive Design**
  - Mobile-friendly interface
  - Desktop optimization
  - Touch interactions
  - Accessibility features

## Phase 5: Integration and Testing

### System Integration
- [ ] **End-to-End Flow Testing**
  - Test complete chat workflow
  - Verify image generation pipeline
  - Test image editing workflow
  - Validate intent detection accuracy

- [ ] **Service Communication**
  - Test server-client communication
  - Verify WebSocket connections
  - Test API error handling
  - Validate data serialization

- [ ] **External API Integration**
  - Test Inworld Runtime connection
  - Verify image service APIs
  - Test rate limit handling
  - Validate error responses

### Performance Testing
- [ ] **Load Testing**
  - Test concurrent user handling
  - Verify memory usage patterns
  - Test API rate limits
  - Monitor response times

- [ ] **Resource Optimization**
  - Optimize bundle sizes
  - Implement caching strategies
  - Minimize API calls
  - Optimize image handling

### Error Scenario Testing
- [ ] **Network Failure Handling**
  - Test offline scenarios
  - Verify reconnection logic
  - Test timeout handling
  - Validate error recovery

- [ ] **API Failure Testing**
  - Test Inworld Runtime disconnection
  - Test image service failures
  - Verify fallback mechanisms
  - Test graceful degradation

### Security Testing
- [ ] **Input Validation**
  - Test XSS prevention
  - Verify input sanitization
  - Test file upload security
  - Validate API parameter checking

- [ ] **Authentication Testing**
  - Test API key protection
  - Verify session security
  - Test rate limiting
  - Validate CORS configuration

## Phase 6: Finalization and Documentation

### Code Quality
- [ ] **Code Review and Cleanup**
  - Review all TypeScript code
  - Ensure consistent formatting
  - Remove debug code and logs
  - Verify no emojis or excessive comments

- [ ] **Type Safety Verification**
  - Ensure all types are properly defined
  - Fix any TypeScript warnings
  - Verify strict mode compliance
  - Test type inference

### Documentation
- [ ] **API Documentation**
  - Document all endpoints
  - Provide request/response examples
  - Document error codes
  - Create integration examples

- [ ] **Setup Instructions**
  - Update README with setup steps
  - Document environment variables
  - Provide troubleshooting guide
  - Add deployment instructions

### Deployment Preparation
- [ ] **Production Configuration**
  - Configure production builds
  - Set up environment variables
  - Configure logging for production
  - Set up health monitoring

- [ ] **Deployment Scripts**
  - Create build scripts
  - Set up deployment automation
  - Configure CI/CD if needed
  - Test production deployment

### Final Testing
- [ ] **User Acceptance Testing**
  - Test all three service workflows
  - Verify intent detection accuracy
  - Test error handling scenarios
  - Validate user experience flow

- [ ] **Performance Validation**
  - Measure response times
  - Test under load
  - Verify resource usage
  - Validate scalability

## Technical Architecture Summary

### Server Stack
- **Framework**: Express.js with TypeScript
- **AI Integration**: @inworld/nodejs-sdk
- **Intent Detection**: Custom classification engine
- **Services**: Text chat, Image generation, Image editing
- **Communication**: REST API with optional WebSocket

### Client Stack
- **Frontend**: Vanilla HTML/CSS/JavaScript (minimal approach)
- **Language**: TypeScript
- **Communication**: Fetch API for HTTP requests
- **State Management**: Simple DOM manipulation
- **UI**: Basic HTML/CSS styling

### Key Features
- Intelligent intent-based routing
- Three distinct AI service integrations
- Real-time chat capabilities
- Image generation and editing
- Comprehensive error handling
- TypeScript throughout
- Clean, minimal codebase

## Success Criteria
- [ ] All three services (chat, image generation, image editing) working
- [ ] Intent detection routing requests correctly
- [ ] Clean, minimal UI with good UX
- [ ] Proper error handling throughout
- [ ] No emojis or excessive comments in code
- [ ] TypeScript strict mode compliance
- [ ] Production-ready deployment configuration