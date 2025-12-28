/**
 * Test script for VoiceLiveService integration
 * Tests the complete flow: connect, send session config, handle responses
 */

require('dotenv').config();
const { VoiceLiveService } = require('../dist/services/voiceLiveService');

async function testVoiceLiveService() {
    console.log('🧪 Testing VoiceLiveService integration...');

    const service = new VoiceLiveService();

    // Set up event listeners
    service.on('message', (message) => {
        console.log('📨 Message from Azure:', message.type);
    });

    service.on('audio-delta', (message) => {
        console.log('🔊 Audio delta received, length:', message.delta?.length || 0);
    });

    service.on('transcript-delta', (message) => {
        console.log('📝 Transcript delta:', message.delta);
    });

    service.on('user-transcript', (message) => {
        console.log('👤 User transcript:', message.transcript);
    });

    service.on('speech-started', () => {
        console.log('🎤 Speech started');
    });

    service.on('speech-stopped', () => {
        console.log('🔇 Speech stopped');
    });

    service.on('error', (error) => {
        console.error('❌ Service error:', error.message);
    });

    service.on('disconnected', (data) => {
        console.log('🔌 Disconnected:', data.sessionId);
    });

    try {
        // Test connection
        console.log('🔗 Connecting to Azure Voice Live...');
        await service.connect('test-session-123', 'test-user-456');

        console.log('✅ Connected successfully!');

        // Wait a bit to receive session confirmation
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test sending some dummy audio data (this would normally come from microphone)
        console.log('🎵 Sending test audio data...');
        const dummyAudio = Buffer.alloc(2400, 0); // 100ms of silence at 24kHz mono 16-bit
        service.sendAudio(dummyAudio);

        // Wait for responses
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Test text input
        console.log('💬 Sending text input...');
        service.sendTextInput('Hello, this is a test message.');

        // Wait for responses
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Disconnect
        console.log('👋 Disconnecting...');
        service.disconnect();

        console.log('✅ Test completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testVoiceLiveService().catch(console.error);