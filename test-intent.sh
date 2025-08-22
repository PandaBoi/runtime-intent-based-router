#!/bin/bash

# Pretty test script for intent detection
echo "🤖 Testing Intent-Based Routing System"
echo "======================================="

BASE_URL="http://localhost:3001"

# Function to make a pretty curl request
test_intent() {
    local input="$1"
    local description="$2"
    
    echo ""
    echo "📝 Testing: $description"
    echo "Input: \"$input\""
    echo "---"
    
    curl -s -X POST "$BASE_URL/api/test/intent/detect" \
        -H "Content-Type: application/json" \
        -d "{\"input\": \"$input\"}" | jq '.'
    
    echo ""
}

# Function to test combined flow
test_combined() {
    local input="$1"
    local description="$2"
    
    echo ""
    echo "🔄 Testing Combined Flow: $description"
    echo "Input: \"$input\""
    echo "---"
    
    curl -s -X POST "$BASE_URL/api/test/combined/flow" \
        -H "Content-Type: application/json" \
        -d "{\"input\": \"$input\"}" | jq '.'
    
    echo ""
}

# Check if server is running
echo "🏥 Checking server health..."
curl -s "$BASE_URL/api/health" | jq '.'

# Initialize services
echo ""
echo "⚡ Initializing Inworld Runtime service..."
curl -s -X POST "$BASE_URL/api/test/inworld/initialize" \
    -H "Content-Type: application/json" | jq '.data.connectionState'

echo ""
echo "🧠 Initializing Intent Detection service..."
curl -s -X POST "$BASE_URL/api/test/intent/initialize" \
    -H "Content-Type: application/json" | jq '.data'

# Test different intents
test_intent "Hello, how are you today?" "General Chat"
test_intent "What's the weather like?" "Question/Chat"
test_intent "Generate an image of a sunset over mountains" "Image Generation"
test_intent "Create a picture of a red sports car" "Image Generation"
test_intent "Draw me a fantasy castle" "Image Generation"
test_intent "Make this photo brighter" "Image Editing"
test_intent "Remove the background from this image" "Image Editing"
test_intent "Crop this picture and add a filter" "Image Editing"

# Test combined flows
test_combined "Hello there!" "Chat Flow"
test_combined "Create an image of a peaceful lake" "Image Generation Flow"

echo "✅ Testing complete!"
