// Chat Application - Frontend JavaScript
class ChatApp {
    constructor() {
        this.API_BASE = 'http://localhost:3001/api/chat'
        this.sessionId = null
        this.messageCount = 0
        this.imageCount = 0
        this.sessionStartTime = new Date()
        this.intents = new Set()

        this.initializeElements()
        this.setupEventListeners()
        this.initializeApp()
    }

    initializeElements() {
        // Main elements
        this.messagesContainer = document.getElementById('messagesContainer')
        this.messageInput = document.getElementById('messageInput')
        this.sendBtn = document.getElementById('sendBtn')
        this.typingIndicator = document.getElementById('typingIndicator')
        this.loadingOverlay = document.getElementById('loadingOverlay')

        // Status elements
        this.connectionStatus = document.getElementById('connectionStatus')
        this.sessionInfo = document.getElementById('sessionInfo')

        // Sidebar elements
        this.sidebar = document.getElementById('sidebar')
        this.messageCountEl = document.getElementById('messageCount')
        this.imageCountEl = document.getElementById('imageCount')
        this.sessionDurationEl = document.getElementById('sessionDuration')
        this.intentsList = document.getElementById('intentsList')
        this.imagesGrid = document.getElementById('imagesGrid')

        // Quick actions
        this.quickActions = document.getElementById('quickActions')

        // Image upload elements
        this.imageUploadBtn = document.getElementById('imageUploadBtn')
        this.imageUploadInput = document.getElementById('imageUploadInput')
    }

    setupEventListeners() {
        // Send message on button click
        this.sendBtn.addEventListener('click', () => this.sendMessage())

        // Send message on Enter (Shift+Enter for new line)
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                this.sendMessage()
            }
        })

        // Image upload functionality
        this.imageUploadBtn.addEventListener('click', () => {
            this.imageUploadInput.click()
        })

        this.imageUploadInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.uploadImage(e.target.files[0])
            }
        })

        // Auto-resize textarea and enable/disable send button
        this.messageInput.addEventListener('input', () => {
            this.autoResizeTextarea()
            this.toggleSendButton()
        })

        // Update session duration every minute
        setInterval(() => this.updateSessionDuration(), 60000)
    }

    async initializeApp() {
        try {
            // Check API health
            await this.checkHealth()

            // Create session
            await this.createSession()

            this.updateConnectionStatus(true)
            console.log('Chat app initialized successfully')

        } catch (error) {
            console.error('Failed to initialize app:', error)
            this.updateConnectionStatus(false)
            this.showError('Failed to connect to server. Please refresh the page.')
        }
    }

    async checkHealth() {
        const response = await fetch('http://localhost:3001/api/health')
        if (!response.ok) {
            throw new Error('Health check failed')
        }
        const data = await response.json()
        console.log('Health check passed:', data.message)
        return data
    }

    async createSession() {
        try {
            const response = await fetch(`${this.API_BASE}/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })

            if (!response.ok) {
                throw new Error('Failed to create session')
            }

            const data = await response.json()
            this.sessionId = data.data.sessionId

            // If sessionId is undefined, we'll get it from the first message
            if (this.sessionId) {
                this.updateSessionInfo(this.sessionId)
                console.log('Session created:', this.sessionId)
            } else {
                console.log('Session ID undefined, will get from first message')
            }

        } catch (error) {
            console.error('Failed to create session:', error)
            throw error
        }
    }

    async sendMessage(messageText = null) {
        const message = messageText || this.messageInput.value.trim()
        if (!message) return

        try {
            // Clear input and show user message
            if (!messageText) {
                this.messageInput.value = ''
                this.autoResizeTextarea()
                this.toggleSendButton()
            }

                        this.addUserMessage(message)
            this.showTypingIndicator() // Always start with default text

            // Disable input during processing
            this.setInputEnabled(false)

            // Send to API
            const response = await fetch(`${this.API_BASE}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    sessionId: this.sessionId
                })
            })

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`)
            }

            // Check if this is a streaming response
            const contentType = response.headers.get('content-type')
                        console.log('Response content-type:', contentType)

            if (contentType && contentType.includes('text/plain')) {
                console.log('Detected streaming response, handling...')
                // Handle streaming response
                await this.handleStreamingResponse(response)
                // Exit early - streaming handler takes care of everything
                return
            } else {
                console.log('Detected JSON response, handling...')
                // Handle regular JSON response
                const data = await response.json()

                // Update session ID if we didn't have one
                if (!this.sessionId && data.data.sessionId) {
                    this.sessionId = data.data.sessionId
                    this.updateSessionInfo(this.sessionId)
                }

                // Add assistant response
                this.addAssistantMessage(data.data)

                // Clean up - hide typing indicator and re-enable input
                this.hideTypingIndicator()
                this.setInputEnabled(true)

                // Update stats
                this.updateStats(data.data)

                // Show quick actions if we have images
                if (this.imageCount > 0) {
                    this.showQuickActions()
                }

                console.log('Message sent successfully:', data)
            }

        } catch (error) {
            console.error('Failed to send message:', error)
            this.hideTypingIndicator()
            this.setInputEnabled(true)
            this.addErrorMessage('Sorry, I encountered an error. Please try again.')
        }
    }





    addUserMessage(message) {
        const messageEl = this.createMessageElement('user', message)
        this.appendMessage(messageEl)
        this.messageCount++
    }

    addAssistantMessage(data) {
        const message = data.message
        const intent = data.detectedIntent

        console.log('Assistant message received:', {
            content: message.content.substring(0, 100),
            intent,
            fullData: data
        })

        // Check if this is an image response (URL + optional suggestions)
        if (this.isImageResponse(message.content, intent)) {
            console.log('Detected as image response, rendering image')
            console.log('Raw suggestions from data:', data.suggestions)
            // Pass suggestions from data.suggestions if available, otherwise extract from content
            const suggestions = data.suggestions ? data.suggestions.join(' • ') : null
            console.log('Formatted suggestions:', suggestions)
            this.handleImageResponse(message.content, intent, suggestions)
        } else {
            console.log('Detected as text response, rendering text')
            // Create regular message element
            const messageEl = this.createMessageElement('assistant', message.content, intent)
            this.appendMessage(messageEl)
        }

        this.messageCount++

        // Track intent
        if (intent) {
            this.intents.add(intent)
            this.updateIntentsList()
        }
    }

        isImageResponse(content, intent) {
        // Check if content contains an image URL (more flexible detection)
        const hasImageUrl = /https?:\/\/[^\s\n]+/i.test(content.split('\n')[0])

        // Check if intent suggests this is an image response (case-insensitive and flexible)
        const intentStr = (intent || '').toLowerCase().replace(/[-_]/g, '')
        const isImageIntent = intentStr.includes('generateimage') ||
                             intentStr.includes('editimage') ||
                             intentStr.includes('image')

        console.log('Image detection:', { content: content.substring(0, 100), intent, hasImageUrl, isImageIntent })

        return hasImageUrl && isImageIntent
    }

        handleImageResponse(content, intent, passedSuggestions = null) {
        console.log('Processing image response:', content)

        // Split content by lines to get URL and suggestions
        const lines = content.split('\n').filter(line => line.trim())
        const imageUrl = lines[0].trim()

        // Use passed suggestions if available, otherwise extract from content
        const suggestions = passedSuggestions || lines.slice(1).join(' ').trim()

        console.log('Extracted image URL:', imageUrl)
        console.log('Suggestions:', suggestions)

        // Create message element with image
        const messageEl = this.createImageMessageElement(imageUrl, suggestions, intent)
        this.appendMessage(messageEl)

        this.imageCount++
        this.updateImagesGrid(imageUrl, intent === 'generate-image' ? 'Generated image' : 'Edited image')

        // Hide typing indicator and re-enable input when image is ready
        this.hideTypingIndicator()
        this.setInputEnabled(true)
    }

    createImageMessageElement(imageUrl, suggestions, intent) {
        const messageEl = document.createElement('div')
        messageEl.className = 'message assistant'

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const intentBadge = intent ? `<span class="intent-badge">${intent}</span>` : ''

        messageEl.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <span class="timestamp">${timestamp}</span>
                    ${intentBadge}
                </div>
                                <div class="image-message">
                    <div class="image-container">
                        <img src="${imageUrl}" alt="AI generated image" class="generated-image" onclick="openImageModal('${imageUrl}')">
                    </div>
                    ${suggestions ? `<div class="image-suggestions">${this.formatMessage(suggestions)}</div>` : ''}
                </div>
            </div>
        `

        return messageEl
    }

    addErrorMessage(message) {
        const messageEl = this.createMessageElement('assistant', `► ERROR: ${message}`)
        this.appendMessage(messageEl)
    }

    createMessageElement(role, content, intent = null) {
        const messageEl = document.createElement('div')
        messageEl.className = `message ${role}`

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

        let intentBadge = ''
        if (intent && role === 'assistant') {
            intentBadge = `<span class="intent-badge">${intent}</span>`
        }

        messageEl.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <span class="timestamp">${timestamp}</span>
                    ${intentBadge}
                </div>
                <div class="message-text">${this.formatMessage(content)}</div>
            </div>
        `

        return messageEl
    }

    formatMessage(content) {
        // Convert markdown-like formatting to HTML
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>')
    }

    appendMessage(messageEl) {
        // Remove welcome message if it exists
        const welcomeMessage = this.messagesContainer.querySelector('.welcome-message')
        if (welcomeMessage) {
            welcomeMessage.remove()
            // Add chatting class to enable blur effect
            document.querySelector('.app').classList.add('chatting')
        }

        this.messagesContainer.appendChild(messageEl)
        this.scrollToBottom()
    }

                                showTypingIndicator(customText = null) {
        if (!this.typingIndicator) return

        this.typingIndicator.innerHTML = '<div class="typing-bubble" id="typingBubble"><span id="dot1">●</span> <span id="dot2">●</span> <span id="dot3">●</span></div>'
        this.typingIndicator.style.display = 'flex'
        this.scrollToBottom()

        // Wait for DOM to update, then start animation
        setTimeout(() => {
            this.startTypingAnimation()
        }, 50)
    }

                    startTypingAnimation() {
        const dot1 = document.getElementById('dot1')
        const dot2 = document.getElementById('dot2')
        const dot3 = document.getElementById('dot3')

        console.log('Dots found:', dot1, dot2, dot3)

        if (!dot1 || !dot2 || !dot3) {
            console.error('Could not find dot elements')
            return
        }

        let step = 0

                        // Add smooth transitions to dots
        dot1.style.position = 'relative'
        dot1.style.transition = 'top 0.15s ease-in-out'
        dot2.style.position = 'relative'
        dot2.style.transition = 'top 0.15s ease-in-out'
        dot3.style.position = 'relative'
        dot3.style.transition = 'top 0.15s ease-in-out'

        this.typingAnimationInterval = setInterval(() => {
            // Reset all dots
            dot1.style.top = '0px'
            dot2.style.top = '0px'
            dot3.style.top = '0px'

            // Bounce one dot at a time
            const activeCase = step % 3
            if (activeCase === 0) {
                dot1.style.top = '-12px'
            } else if (activeCase === 1) {
                dot2.style.top = '-12px'
            } else {
                dot3.style.top = '-12px'
            }

            step++
        }, 200)
    }

    hideTypingIndicator() {
        this.typingIndicator.style.display = 'none'

        // Stop the animation
        if (this.typingAnimationInterval) {
            clearInterval(this.typingAnimationInterval)
            this.typingAnimationInterval = null
        }
    }

    showLoadingOverlay(show) {
        console.log('Loading overlay called with:', show)
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = show ? 'flex' : 'none'
            console.log('Loading overlay display set to:', this.loadingOverlay.style.display)
        } else {
            console.error('Loading overlay element not found!')
        }
    }

    setInputEnabled(enabled) {
        this.messageInput.disabled = !enabled
        this.sendBtn.disabled = !enabled

        if (enabled) {
            this.messageInput.style.opacity = '1'
            this.sendBtn.style.opacity = '1'
            this.messageInput.placeholder = 'Enter command...'
        } else {
            this.messageInput.style.opacity = '0.5'
            this.sendBtn.style.opacity = '0.5'
            this.messageInput.placeholder = 'Processing request...'
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight
        }, 100)
    }

    autoResizeTextarea() {
        this.messageInput.style.height = 'auto'
        this.messageInput.style.height = this.messageInput.scrollHeight + 'px'
    }

    toggleSendButton() {
        const hasText = this.messageInput.value.trim().length > 0
        this.sendBtn.disabled = !hasText
    }

    updateConnectionStatus(connected) {
        const statusEl = this.connectionStatus.querySelector('span')
        const dotEl = this.connectionStatus.querySelector('.pixel-dot')

        if (connected) {
            statusEl.textContent = 'ONLINE'
            dotEl.classList.add('active')
            dotEl.classList.remove('disconnected')
        } else {
            statusEl.textContent = 'OFFLINE'
            dotEl.classList.remove('active')
            dotEl.classList.add('disconnected')
        }
    }

    updateSessionInfo(sessionId) {
        const sessionEl = this.sessionInfo.querySelector('span')
        sessionEl.textContent = `PLAYER: ${sessionId.substring(0, 6).toUpperCase()}`
    }

    updateStats(data) {
        // Update message count
        this.messageCountEl.textContent = this.messageCount

        // Update image count
        this.imageCountEl.textContent = this.imageCount

        // Update session duration
        this.updateSessionDuration()

        // Update context if available
        if (data.context) {
            this.messageCountEl.textContent = data.context.conversationLength || this.messageCount
            this.imageCountEl.textContent = data.context.imageCount || this.imageCount
        }
    }

    updateSessionDuration() {
        const now = new Date()
        const diffMs = now - this.sessionStartTime
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMins / 60)

        let duration
        if (diffHours > 0) {
            duration = `${diffHours}h ${diffMins % 60}m`
        } else {
            duration = `${diffMins}m`
        }

        this.sessionDurationEl.textContent = duration
    }

    updateIntentsList() {
        if (!this.intentsList) return

        if (this.intents.size === 0) {
            this.intentsList.innerHTML = '<span class="no-data">No actions yet...</span>'
            return
        }

        // Convert intents to retro gaming action names
        const actionNames = {
            'chat': 'CHAT MODE',
            'generate-image': 'IMAGE GEN',
            'edit-image': 'PIXEL EDIT',
            'intent-detection': 'SCAN ACTION'
        }

        this.intentsList.innerHTML = Array.from(this.intents)
            .map(intent => `<span class="intent-tag">${actionNames[intent] || intent.toUpperCase()}</span>`)
            .join('')
    }

    updateImagesGrid(imageUrl, prompt) {
        if (!this.imagesGrid) return

        if (this.imageCount === 1) {
            // First image, clear the "no data" message
            this.imagesGrid.innerHTML = ''
        }

        const thumbnailEl = document.createElement('img')
        thumbnailEl.src = imageUrl
        thumbnailEl.alt = prompt
        thumbnailEl.className = 'thumbnail pixel-perfect'
        thumbnailEl.onclick = () => openImageModal(imageUrl)

        this.imagesGrid.appendChild(thumbnailEl)
    }

    showQuickActions() {
        this.quickActions.style.display = 'flex'
    }

    showError(message) {
        // You could implement a toast notification here
        console.error(message)
    }

    async uploadImage(file) {
        try {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                this.addMessage('system', 'Please upload a valid image file (JPEG, PNG, WebP, etc.)')
                return
            }

            // Validate file size (10MB limit)
            const maxSize = 10 * 1024 * 1024 // 10MB
            if (file.size > maxSize) {
                this.addMessage('system', 'Image file is too large. Maximum size is 10MB.')
                return
            }

            // Show upload indicator
            this.showTypingIndicator()
            this.addMessage('user', `📁 Uploading image: ${file.name}`)

            // Create session if needed
            if (!this.sessionId) {
                await this.createSession()
            }

            // Create form data
            const formData = new FormData()
            formData.append('image', file)
            formData.append('sessionId', this.sessionId)

            // Upload image
            const response = await fetch(`${this.API_BASE}/images/upload`, {
                method: 'POST',
                body: formData
            })

            const result = await response.json()

            this.hideTypingIndicator()

            if (result.success) {
                // Add success message with image
                const imageUrl = result.data.image.storageUrl
                const successMessage = `📷 Image uploaded successfully!\n\n${imageUrl}\n\n${result.data.message || 'You can now edit this image by saying things like "make it brighter" or "add a gothic style".'}`

                this.addMessage('assistant', successMessage)

                // Update image count and refresh images
                this.imageCount++
                this.updateStats()
                this.fetchSessionImages()

                // Clear the file input
                this.imageUploadInput.value = ''

            } else {
                this.addMessage('system', `Upload failed: ${result.error}`)
            }

        } catch (error) {
            this.hideTypingIndicator()
            console.error('Image upload error:', error)
            this.addMessage('system', 'Failed to upload image. Please try again.')

            // Clear the file input
            this.imageUploadInput.value = ''
        }
    }

    async handleStreamingResponse(response) {
        try {
            console.log('Handling streaming response...')

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })

                // Process complete lines
                const lines = buffer.split('\n')
                buffer = lines.pop() // Keep the incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.slice(6) // Remove 'data: ' prefix
                        if (jsonStr.trim()) {
                            try {
                                const data = JSON.parse(jsonStr)

                                if (data.type === 'acknowledgement') {
                                    console.log('Received acknowledgement:', data.data.message.content)

                                    // Update session ID if we didn't have one
                                    if (!this.sessionId && data.data.sessionId) {
                                        this.sessionId = data.data.sessionId
                                        this.updateSessionInfo(this.sessionId)
                                    }

                                    // Add acknowledgement message
                                    this.addAssistantMessage(data.data)

                                                                } else if (data.type === 'result') {
                                    console.log('Received final result')
                                    console.log('Result data:', data.data)
                                    console.log('Suggestions in result:', data.data.suggestions)

                                    // Add the final result
                                    this.addAssistantMessage(data.data)

                                    // Update stats
                                    this.updateStats(data.data)

                                    // Clean up
                                    this.hideTypingIndicator()
                                    this.setInputEnabled(true)

                                    // Show quick actions if we have images
                                    if (this.imageCount > 0) {
                                        this.showQuickActions()
                                    }
                                }
                            } catch (parseError) {
                                console.error('Failed to parse streaming data:', parseError)
                            }
                        }
                    }
                }
            }

            console.log('Streaming response completed')

        } catch (error) {
            console.error('Failed to handle streaming response:', error)
            this.hideTypingIndicator()
            this.setInputEnabled(true)
            this.addErrorMessage('Sorry, there was an error processing the response.')
        }
    }
}

// Global functions
function sendSuggestion(text) {
    if (window.chatApp) {
        window.chatApp.sendMessage(text)
    }
}

function toggleSidebar() {
    console.log('toggleSidebar called!')
    const sidebar = document.getElementById('sidebar')
    if (sidebar) {
        sidebar.classList.toggle('open')
        console.log('Sidebar toggled, open:', sidebar.classList.contains('open'))
    } else {
        console.error('Sidebar element not found!')
    }
}

function clearChat() {
    if (confirm('► PLAYER wants to start a new game? This will reset your current session!')) {
        // Remove chatting class before reload
        document.querySelector('.app').classList.remove('chatting')
        location.reload()
    }
}

function openImageModal(imageUrl) {
    // Retro Game Boy style image modal
    const modal = document.createElement('div')
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(15, 56, 15, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        cursor: pointer;
        border: 4px solid #202020;
    `

    const imageFrame = document.createElement('div')
    imageFrame.style.cssText = `
        background: #202020;
        border: 4px solid #f0f0f0;
        padding: 16px;
        max-width: 90%;
        max-height: 90%;
        box-shadow: inset -4px -4px 0px #666666;
    `

    const img = document.createElement('img')
    img.src = imageUrl
    img.style.cssText = `
        max-width: 100%;
        max-height: 100%;
        border: 2px solid #f0f0f0;
        image-rendering: pixelated;
        image-rendering: crisp-edges;
    `

    imageFrame.appendChild(img)
    modal.appendChild(imageFrame)
    modal.onclick = () => document.body.removeChild(modal)

    document.body.appendChild(modal)
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp()
})
