# Runtime Intent-Based Router

A minimal chat interface that automatically routes user requests to specialized AI services based on detected intent. Built with Inworld Runtime to showcase multi-modal AI capabilities.

## Features

🤖 **Text Chat** - General conversation and text-based queries  
🎨 **Image Generation** - Create images from text descriptions  
✏️ **Image Editing** - Modify existing images with text instructions  

## Quick Start

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies  
cd ../client
npm install

# Set up environment variables
cd ../server
cp .env.example .env
# Add your API keys to .env

# Start the server
npm run dev

# In another terminal, start the client
cd ../client
npm start
```

## Architecture

**Server-Client Structure:**
```
Client (Simple Chat UI) ↔ Server (Intent Router + AI Services)
```

**Request Flow:**
```
User Input → Server → Intent Detection → Service Router → AI Service → Response
```

### Intent Detection (Server)
- Keyword-based detection for reliability
- Image attachment automatically triggers editing mode
- Fallback to text chat for general queries

### Services (Server)
- **Text Service**: Powered by LLM for general conversation
- **Image Generation**: Text-to-image generation
- **Image Editing**: Image + text instruction processing

## Environment Variables

```env
# server/.env
INWORLD_API_KEY=your_api_key
INWORLD_SCENE_ID=your_scene_id
IMAGE_GEN_API_KEY=your_image_gen_key
IMAGE_EDIT_API_KEY=your_image_edit_key
PORT=3001
```

## Usage Examples

**Text Chat:**
```
"What is machine learning?"
"Tell me a joke"
```

**Image Generation:**
```
"Generate an image of a sunset over mountains"
"Create a picture of a futuristic city"
```

**Image Editing:**
```
[Upload image] "Make this image brighter"
[Upload image] "Add a rainbow to the sky"
```

## Development

### Project Structure
```
server/
├── src/
│   ├── routes/         # API endpoints
│   ├── services/       # AI service integrations
│   ├── utils/          # Intent detection & routing
│   └── types/          # TypeScript definitions
├── package.json
└── .env

client/
├── src/
│   ├── components/     # Simple chat components
│   └── services/       # API client
├── package.json
└── public/
```

### Adding New Services
1. Define new intent type in `server/src/types/intent.ts`
2. Add detection logic in `server/src/utils/intentDetector.ts`
3. Implement service in `server/src/services/`
4. Update router in `server/src/utils/serviceRouter.ts`

## Tech Stack

- **Server**: Node.js + Express + TypeScript
- **Client**: Simple HTML/CSS/JS (minimal setup)
- **Runtime**: Inworld AI Runtime

## Contributing

This project showcases Inworld Runtime capabilities. Feel free to extend with additional services and intents.

## License

MIT