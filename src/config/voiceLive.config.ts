/**
 * EXPLANATION: Voice Live Configuration
 * 
 * Centralized configuration for Azure Voice Live integration.
 * All environment variables are validated here.
 * 
 * This ensures:
 * 1. Required config exists before startup
 * 2. Clear error messages if config is missing
 * 3. Easy to change config in one place
 * 4. Type safety with TypeScript
 */

import { logInfo, logError } from '../utils/logger';

export interface VoiceLiveConfig {
  azureEndpoint: string;
  apiKey: string;
  apiVersion: string;
  model: string;
  // Optional settings
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  sessionTimeout?: number; // minutes
  audioSampleRate?: number;
  audioChannels?: number;
}

/**
 * EXPLANATION: Load and validate Voice Live configuration
 * 
 * Checks for required environment variables:
 * - AZURE_VOICE_LIVE_ENDPOINT
 * - AZURE_VOICE_LIVE_API_KEY
 * - AZURE_VOICE_LIVE_MODEL
 * 
 * Returns configuration object or throws error
 */
export function loadVoiceLiveConfig(): VoiceLiveConfig {
  logInfo('[VoiceLiveConfig] Loading Azure Voice Live configuration...');

  // EXPLANATION: Check required environment variables
  const endpoint = process.env.AZURE_VOICE_LIVE_ENDPOINT;
  const apiKey = process.env.AZURE_VOICE_LIVE_API_KEY;
  const model = process.env.AZURE_VOICE_LIVE_MODEL;
  const apiVersion = process.env.AZURE_VOICE_LIVE_API_VERSION;

  // Validate endpoint
  if (!endpoint) {
    const error =
      'AZURE_VOICE_LIVE_ENDPOINT environment variable is not set. ' +
      'Expected format: https://your-resource.cognitiveservices.azure.com';
    logError('[VoiceLiveConfig]', new Error(error));
    throw new Error(error);
  }

  // Validate API key
  if (!apiKey) {
    const error =
      'AZURE_VOICE_LIVE_API_KEY environment variable is not set. ' +
      'Get your API key from Azure Portal > Cognitive Services > Keys and Endpoint';
    logError('[VoiceLiveConfig]', new Error(error));
    throw new Error(error);
  }

  // Validate model
  if (!model) {
    const error =
      'AZURE_VOICE_LIVE_MODEL environment variable is not set. ' +
      'Recommended: gpt-4o (or gpt-4-turbo for older setup)';
    logError('[VoiceLiveConfig]', new Error(error));
    throw new Error(error);
  }

  // Use default API version if not provided
  const version = apiVersion || '2025-05-01-preview';

  // Validate endpoint format
  if (!endpoint.startsWith('https://') && !endpoint.startsWith('http://')) {
    const error = 'AZURE_VOICE_LIVE_ENDPOINT must start with https:// or http://';
    logError('[VoiceLiveConfig]', new Error(error));
    throw new Error(error);
  }

  const config: VoiceLiveConfig = {
    azureEndpoint: endpoint,
    apiKey: apiKey,
    apiVersion: version,
    model: model,
    // Optional with defaults
    maxReconnectAttempts: parseInt(
      process.env.VOICE_LIVE_MAX_RECONNECT_ATTEMPTS || '3'
    ),
    reconnectDelay: parseInt(process.env.VOICE_LIVE_RECONNECT_DELAY || '1000'), // milliseconds
    sessionTimeout: parseInt(process.env.VOICE_LIVE_SESSION_TIMEOUT || '30'), // minutes
    audioSampleRate: parseInt(process.env.VOICE_LIVE_SAMPLE_RATE || '24000'),
    audioChannels: parseInt(process.env.VOICE_LIVE_CHANNELS || '1'),
  };

  logInfo('[VoiceLiveConfig] Configuration loaded successfully');
  logInfo(`[VoiceLiveConfig] Azure Endpoint: ${config.azureEndpoint}`);
  logInfo(`[VoiceLiveConfig] Model: ${config.model}`);
  logInfo(`[VoiceLiveConfig] API Version: ${config.apiVersion}`);
  logInfo(`[VoiceLiveConfig] Session Timeout: ${config.sessionTimeout} minutes`);

  return config;
}

/**
 * EXPLANATION: Validate runtime configuration
 * 
 * Called during server startup to ensure everything is properly configured.
 * Fails fast if there are issues.
 */
export function validateVoiceLiveConfiguration(): boolean {
  try {
    loadVoiceLiveConfig();
    return true;
  } catch (error) {
    logError('[VoiceLiveConfig] Configuration validation failed', error);
    return false;
  }
}

/**
 * EXPLANATION: Get configuration summary (for logging)
 * 
 * Useful for troubleshooting - shows what's configured
 * WITHOUT revealing the API key
 */
export function getConfigSummary(): object {
  try {
    const config = loadVoiceLiveConfig();
    return {
      endpoint: config.azureEndpoint,
      model: config.model,
      apiVersion: config.apiVersion,
      apiKeyConfigured: !!config.apiKey,
      apiKeyLength: config.apiKey?.length || 0,
      sessionTimeout: config.sessionTimeout,
      audioConfig: {
        sampleRate: config.audioSampleRate,
        channels: config.audioChannels,
      },
    };
  } catch (error) {
    return {
      error: 'Configuration not available',
      message: String(error),
    };
  }
}

/**
 * EXPLANATION: Example .env file content
 * 
 * Shows users what they need to set up
 */
export const ENV_EXAMPLE = `
# Azure Voice Live API Configuration
# Get these values from Azure Portal

# Your Azure Cognitive Services endpoint
# Format: https://{region}.cognitiveservices.azure.com
AZURE_VOICE_LIVE_ENDPOINT=https://your-resource.cognitiveservices.azure.com

# Your API key (get from Azure Portal > Keys)
AZURE_VOICE_LIVE_API_KEY=your-api-key-here

# Model to use for conversation
# Recommended: gpt-4o (latest and best)
# Alternative: gpt-4-turbo
AZURE_VOICE_LIVE_MODEL=gpt-4o

# API version (optional, defaults to 2025-05-01-preview)
AZURE_VOICE_LIVE_API_VERSION=2025-05-01-preview

# Optional: Voice Live specific settings
# Reconnection attempts on failure
VOICE_LIVE_MAX_RECONNECT_ATTEMPTS=3

# Delay between reconnection attempts (milliseconds)
VOICE_LIVE_RECONNECT_DELAY=1000

# Session timeout (minutes) - idle sessions will be closed
VOICE_LIVE_SESSION_TIMEOUT=30

# Audio configuration (these are Azure Voice Live standards)
VOICE_LIVE_SAMPLE_RATE=24000     # Hz (do not change)
VOICE_LIVE_CHANNELS=1             # Mono (do not change)
`;

/**
 * EXPLANATION: Helper to show setup instructions
 */
export function showSetupInstructions(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║          Azure Voice Live API - Setup Instructions              ║
╚══════════════════════════════════════════════════════════════════╝

To get started with AVA's voice conversation feature:

1. Create a .env file in your project root with:

${ENV_EXAMPLE}

2. Get your Azure credentials:
   - Go to Azure Portal (https://portal.azure.com)
   - Create a "Cognitive Services" resource
   - Select region (e.g., East US, West US)
   - Copy your endpoint and key
   - Paste into .env file

3. Restart the server for config to load

4. Test connection using client:
   - Client calls: io.emit('voice:connect', { userId: '123' })
   - Server responds: 'voice:connected' event
   - Client can now send audio: io.emit('voice:audio', { audio: buffer })

╔══════════════════════════════════════════════════════════════════╗
║                    Troubleshooting                              ║
╚══════════════════════════════════════════════════════════════════╝

❌ Error: "AZURE_VOICE_LIVE_ENDPOINT environment variable is not set"
✅ Solution: Add AZURE_VOICE_LIVE_ENDPOINT to .env file

❌ Error: "AZURE_VOICE_LIVE_API_KEY environment variable is not set"
✅ Solution: Add AZURE_VOICE_LIVE_API_KEY to .env file

❌ Error: "WebSocket connection failed"
✅ Solution: Check that endpoint and API key are correct

❌ Error: "Turn detection timeout"
✅ Solution: This is normal - means silence detected. Adjust:
           silence_duration_ms in voiceLiveService.buildSessionConfig()
  `);
}
