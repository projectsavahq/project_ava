// Simple test script to reproduce Azure Voice Live WebSocket handshake
// Usage: node scripts/testAzureWsConnection.js

require('dotenv').config();
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const azureEndpoint = process.env.AZURE_VOICE_LIVE_ENDPOINT;
const apiKey = process.env.AZURE_VOICE_LIVE_API_KEY;
const apiVersion = process.env.AZURE_VOICE_LIVE_API_VERSION || '2025-05-01-preview';
const model = process.env.AZURE_VOICE_LIVE_MODEL || 'gpt-4o';

if (!azureEndpoint || !apiKey) {
  console.error('Missing AZURE_VOICE_LIVE_ENDPOINT or AZURE_VOICE_LIVE_API_KEY in environment');
  process.exit(1);
}

const wsEndpoint = azureEndpoint.replace('https://', 'wss://').replace('http://', 'ws://').replace(/\/$/, '');
const url = `${wsEndpoint}/voice-live/realtime?api-version=${apiVersion}&model=${model}`;

console.log('Attempting WebSocket to:', url);
console.log('Using header api-key with length:', apiKey.length);

const headers = {
  'api-key': apiKey,
  'x-ms-client-request-id': uuidv4(),
};

const ws = new WebSocket(url, { headers, perMessageDeflate: false });

ws.on('open', () => {
  console.log('[test] open');
  // send a lightweight JSON ping (not required) then close
  try {
    ws.send(JSON.stringify({ type: 'ping', event_id: uuidv4() }));
  } catch (e) {
    console.error('[test] send error', e && (e.stack || e));
  }
  // leave open a few seconds to observe server behavior
  setTimeout(() => {
    console.log('[test] closing connection');
    ws.close(1000, 'test complete');
  }, 3000);
});

ws.on('message', (data) => {
  console.log('[test] message:', data.toString().slice(0, 1000));
});

ws.on('error', (err) => {
  console.error('[test] error:', err && (err.stack || err));
});

ws.on('close', (code, reason) => {
  console.log('[test] closed', { code, reason: reason ? reason.toString() : undefined });
  process.exit(0);
});

// capture unexpected-response if possible
if ((ws).on) {
  try {
    ws.on('unexpected-response', (req, res) => {
      console.error('[test] unexpected-response:', res && res.statusCode, res && res.headers);
      process.exit(1);
    });
  } catch (e) {
    // ignore
  }
}
