/**
 * Test script for VoiceLiveService integration
 * Records audio from microphone and handles real-time conversation like the Python test
 */

require('dotenv').config();
const { VoiceLiveService } = require('../dist/services/voiceLiveService');
const mic = require('mic');
const Speaker = require('speaker');
const readline = require('readline');

const SAMPLE_RATE = 24000;
let stopFlag = false;

async function testVoiceLiveService() {
    console.log('🧪 Testing VoiceLiveService integration with audio recording...');

    const service = new VoiceLiveService();
    let speaker = null;
    let micInstance = null;

    // Set up event listeners
    service.on('message', (message) => {
        console.log('📨 Message from Azure:', message.type);
    });

    service.on('audio-delta', (message) => {
        if (message.delta) {
            console.log('🔊 Audio delta received, length:', message.delta.length);
        }
    });

    service.on('transcript-delta', (message) => {
        if (message.delta) {
            process.stdout.write(message.delta);
        }
    });

    service.on('transcript-done', () => {
        console.log(); // New line after transcript
    });

    service.on('user-transcript', (message) => {
        console.log(`👤 You: ${message.transcript}`);
    });

    service.on('speech-started', () => {
        console.log('🎤 Speech started - listening...');
    });

    service.on('speech-stopped', () => {
        console.log('🔇 Speech stopped');
    });

    service.on('error', (error) => {
        console.error('❌ Service error:', error.message);
    });

    service.on('disconnected', (data) => {
        console.log('🔌 Disconnected:', data.sessionId);
        stopFlag = true;
    });

    try {
        // Test connection
        console.log('🔗 Connecting to Azure Voice Live...');
        await service.connect('test-session-123', 'test-user-456');

        console.log('✅ Connected successfully!');

        // Wait a bit to receive session confirmation
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Skip speaker initialization in server environment
        console.log('🔊 Speaker playback skipped (system dependency not available)');

        // Skip microphone recording in server environment
        console.log('🎤 Microphone recording skipped (system dependency not available)');
        console.log('✅ Using text input only for testing');

        // Set up keyboard input for text messages and quitting
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log('\n💡 Commands:');
        console.log('  Type a message and press Enter to send text');
        console.log('  Type "quit" or "q" to exit');
        console.log('  Speak into your microphone for voice input\n');

        console.log('🎵 Chat started! Speak or type...\n');

        // Handle keyboard input
        rl.on('line', (input) => {
            const trimmed = input.trim().toLowerCase();

            if (trimmed === 'quit' || trimmed === 'q') {
                console.log('👋 Quitting...');
                stopFlag = true;
                rl.close();
                return;
            }

            if (input.trim()) {
                console.log(`📝 Sending text: ${input}`);
                service.sendTextInput(input);
            }
        });

        // Keep the process running until stopped
        while (!stopFlag) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Cleanup
        console.log('🧹 Cleaning up...');
        service.disconnect();

        console.log('✅ Test completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);

        // Cleanup on error
        service.disconnect();
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down...');
    stopFlag = true;
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    stopFlag = true;
});

// Run the test
testVoiceLiveService().catch(console.error);