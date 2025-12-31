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

/**
 * AudioBuffer class to handle bursty audio data from Azure
 * and provide smooth playback to Speaker
 */
class AudioBuffer {
    constructor(speaker) {
        this.buffer = [];
        this.speaker = speaker;
        this.isPlaying = false;
        this.chunkSize = 4096; // Process audio in smaller chunks
    }

    /**
     * Add audio data to the buffer
     */
    addAudio(audioBuffer) {
        this.buffer.push(audioBuffer);
        if (!this.isPlaying) {
            this.startPlayback();
        }
    }

    /**
     * Start feeding audio to speaker
     */
    startPlayback() {
        if (this.isPlaying || this.buffer.length === 0) return;

        this.isPlaying = true;
        this.feedNextChunk();
    }

    /**
     * Feed next chunk to speaker
     */
    feedNextChunk() {
        if (this.buffer.length === 0) {
            this.isPlaying = false;
            return;
        }

        const chunk = this.buffer.shift();
        const writeResult = this.speaker.write(chunk);

        // If write returns false, speaker buffer is full, wait for drain
        if (!writeResult) {
            this.speaker.once('drain', () => {
                this.feedNextChunk();
            });
        } else {
            // Continue immediately if buffer has space
            setImmediate(() => this.feedNextChunk());
        }
    }

    /**
     * Clear buffer and stop playback
     */
    clear() {
        this.buffer = [];
        this.isPlaying = false;
    }

    /**
     * Get buffer status for debugging
     */
    getStatus() {
        return {
            queued: this.buffer.length,
            isPlaying: this.isPlaying
        };
    }
}

async function testVoiceLiveService() {
    console.log('🧪 Testing VoiceLiveService integration with audio recording...');

    const service = new VoiceLiveService();
    let speaker = null;
    let audioBuffer = null;
    let micInstance = null;

    // Set up event listeners
    service.on('message', (message) => {
        console.log('📨 Message from Azure:', message.type);
    });

    service.on('audio-delta', (message) => {
        if (message.delta) {
            console.log('🔊 Audio delta received, length:', message.delta.length);
            // Play audio through speaker if available
            if (audioBuffer) {
                try {
                    const audioChunk = Buffer.from(message.delta, 'base64');
                    console.log('🔊 Decoded buffer length:', audioChunk.length, 'bytes');
                    console.log('🔊 Audio buffer status:', audioBuffer.getStatus());
                    audioBuffer.addAudio(audioChunk);
                } catch (error) {
                    console.log('🔊 Audio buffer failed:', error.message);
                }
            }
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

        // Initialize speaker for audio playback
        try {
            speaker = new Speaker({
                channels: 1,
                bitDepth: 16,
                sampleRate: SAMPLE_RATE,
                samplesPerFrame: 2048  // Try larger buffer to reduce underflow
            });
            console.log('✅ Speaker initialized with config:', {
                channels: 1,
                bitDepth: 16,
                sampleRate: SAMPLE_RATE,
                samplesPerFrame: 2048
            });

            // Create audio buffer to handle bursty audio data
            audioBuffer = new AudioBuffer(speaker);

            // Add speaker event listeners for debugging
            speaker.on('error', (err) => {
                console.log('🔊 Speaker error:', err.message);
            });

            speaker.on('finish', () => {
                console.log('🔊 Speaker finished playback');
            });

            speaker.on('close', () => {
                console.log('🔊 Speaker closed');
            });

        } catch (error) {
            console.log('🔊 Speaker initialization failed (system dependency not available):', error.message);
        }

        // Start microphone recording
        try {
            micInstance = mic({
                rate: SAMPLE_RATE.toString(),
                channels: '1',
                bitwidth: '16',
                encoding: 'signed-integer',
                endian: 'little',
                device: 'default'
            });

            const micStream = micInstance.getAudioStream();

            micStream.on('data', (chunk) => {
                if (!stopFlag) {
                    console.log('🎤 Mic chunk received, size:', chunk.length);
                    service.sendAudio(chunk);
                }
            });

            micStream.on('error', (err) => {
                console.error('🎤 Mic error:', err);
            });

            micInstance.start();
            console.log('✅ Microphone started - speak into your microphone!');
        } catch (error) {
            console.log('🎤 Microphone initialization failed (system dependency not available):', error.message);
            console.log('✅ Using text input only for testing');
        }

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
        if (micInstance) {
            try {
                micInstance.stop();
            } catch (error) {
                console.log('🎤 Mic cleanup failed:', error.message);
            }
        }
        if (audioBuffer) {
            try {
                audioBuffer.clear();
            } catch (error) {
                console.log('🔊 Audio buffer cleanup failed:', error.message);
            }
        }
        if (speaker) {
            try {
                speaker.end();
            } catch (error) {
                console.log('🔊 Speaker cleanup failed:', error.message);
            }
        }
        service.disconnect();

        console.log('✅ Test completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);

        // Cleanup on error
        if (micInstance) {
            try {
                micInstance.stop();
            } catch (error) {
                console.log('🎤 Mic cleanup failed:', error.message);
            }
        }
        if (audioBuffer) {
            try {
                audioBuffer.clear();
            } catch (error) {
                console.log('🔊 Audio buffer cleanup failed:', error.message);
            }
        }
        if (speaker) {
            try {
                speaker.end();
            } catch (error) {
                console.log('🔊 Speaker cleanup failed:', error.message);
            }
        }
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