# Voice Client - Local Testing Guide

Short guide to test the voice client against your local backend.

Prerequisites

- Backend (NestJS) running (e.g. npm run start:dev). Default backend port expected: 3001.
- Ensure .env keys for Azure Voice Live are set (AZURE_VOICE_LIVE_ENDPOINT, AZURE_VOICE_LIVE_API_KEY, etc.)

Steps

1. Start your backend: npm run start:dev
2. Serve the static file or open it directly:
   - Recommended: visit http://localhost:3001/voice-test.html (serve `public` folder from your Nest app)
   - Or open `project_ava/public/voice-test.html` in a browser (script uses CDN fallback for socket.io)
3. Login using your backend auth (or use saved token in localStorage)
4. Click "Start Voice Session" — the page connects to the `/voice` namespace, creates a voice session and begins streaming microphone audio in real-time (PCM 24kHz, 16-bit).
5. Speak — you should receive real-time transcript events and AI audio responses.

Troubleshooting

- If you get no audio, ensure server expects PCM 24000Hz 16-bit little-endian (this client down-samples to 24kHz).
- If the session ends and duration is wrong, ensure the backend session startTime is set (this repo saves it automatically).
- If socket.io doesn't load, the page falls back to CDN.

Notes

- This client sends binary PCM as base64 chunks with { audio, timestamp, sessionId }.
- Use this as a reference for FE integration and adapt to your app’s audio pipeline / UX.
