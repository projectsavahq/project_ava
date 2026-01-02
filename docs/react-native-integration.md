# React Native Integration — Voice Live (AVA)

Summary
- This doc shows a minimal, reliable path to connect a React Native app to the AVA voice-backend (/voice Socket.IO namespace) to stream microphone audio and receive real-time transcripts & audio from Azure Voice Live.
- Key constraints: audio format MUST be PCM 16-bit little-endian, mono, 24000 Hz. Send small chunks (≈50ms) to achieve low latency.

Prerequisites
- Backend running and reachable (example: http://<DEV_HOST>:3002). Serve `voice-test.html` or open endpoints to validate server.
- Add these libs in RN:
  - socket.io-client
  - @react-native-async-storage/async-storage (for tokens)
  - react-native-audio-record (or another PCM-capable recorder)
  - react-native-fs (file write)
  - react-native-sound (playback)
- Android / iOS microphone permissions configured (see Troubleshooting).

Auth flow
1. Call POST /api/auth/login (backend) from RN to get accessToken.
2. Store accessToken in AsyncStorage (secure storage recommended).
3. Pass accessToken to Socket.IO when connecting:
   const socket = io(`${API_BASE}/voice`, { auth: { token: accessToken }, transports: ['websocket'] });

Socket & Session basics (client)
- After connection, send:
  socket.emit('voice:connect', { userId, sessionId?: existing, userPreferences?: { voicePreference } });
- Keep sessionId (server returns it in voice:connected).
- Send heartbeat periodically:
  socket.emit('voice:heartbeat', { sessionId });

Events to handle (client)
- voice:connected — session ready (contains sessionId)
- voice:audio — audio chunk produced by AI (base64 PCM)
- voice:user-transcript — final user transcript
- voice:assistant-transcript — interim/final assistant transcript { transcript, isFinal, responseId }
- voice:speech-started / voice:speech-stopped
- voice:error / voice:session-ended

Recording audio (recommended)
- Use a recorder that can produce PCM16LE raw or base64 chunks (react-native-audio-record works well).
- Config example (react-native-audio-record):
  AudioRecord.init({
    sampleRate: 24000,
    channels: 1,
    bitsPerSample: 16,
    wavFile: 'temp.wav' // optional
  });

- Listen to streaming audio event (many libs emit base64 chunks):
  AudioRecord.on('data', (chunkBase64) => {
    socket.emit('voice:audio', { audio: chunkBase64, timestamp: Date.now(), sessionId });
  });

Notes on sampling/encoding
- REQUIRED: PCM 16-bit little-endian, 24000 Hz, mono.
- If your recorder uses a different sample rate, re-sample to 24kHz on native module or JS (prefer native).
- Chunk size: target ~50ms per chunk (1200 samples at 24kHz) for low latency and stable turn detection.

Playback (AI audio)
- Server emits base64 PCM chunks via voice:audio.
- On RN, one simple approach:
  1. Convert base64 -> ArrayBuffer
  2. Wrap raw PCM16 in a small WAV header (Mono, 24000 Hz, 16-bit)
  3. Save to a temp file (react-native-fs)
  4. Play via react-native-sound or native player
- Example helper (pseudo):
  function pcm16ToWav(base64Pcm, sampleRate = 24000) { /* attach WAV header */ }
  // write temp file and play

Interim assistant transcripts
- Listen for voice:assistant-transcript events.
- If isFinal === false → update a temporary assistant message in UI (identified by responseId)
- If isFinal === true → finalize message (persist if needed)

Reconnect / session lifecycle
- Use sessionId to resume after transient disconnect.
- Backend supports a reconnect grace window; on reconnect emit voice:connect with the same sessionId to reattach.
- For network instability, implement exponential backoff and surface errors to user.

Permissions (native)
- Android: Add RECORD_AUDIO permission in AndroidManifest and request at runtime.
- iOS: Add Microphone permission in Info.plist (NSMicrophoneUsageDescription).
- Remember background restrictions and do not rely on long background recording unless supported.

Troubleshooting
- No audio chunks seen in server logs:
  - Verify recorder emits base64 PCM (console log chunk sizes).
  - Confirm sampleRate and bit depth.
  - Ensure socket emits 'voice:audio' with sessionId.
- No transcripts:
  - Check server logs for 'conversation.item.input_audio_transcription.completed' and 'response.audio_transcript.delta/done'.
  - Confirm session config includes transcription in backend (voiceLiveService builds session config with transcription enabled).
- Playback crackles:
  - Ensure PCM chunk boundaries and WAV header correctness, try larger buffer sizes for playback.

Minimal RN snippets

- Connect + auth:
```js
// use AsyncStorage to save token
import io from 'socket.io-client';
const token = await AsyncStorage.getItem('accessToken');
const socket = io(`${API_BASE}/voice`, { auth: { token }, transports: ['websocket'] });
socket.on('connect_error', e => console.warn('connect_error', e));
```

- Start session:
```js
socket.emit('voice:connect', {
  userId: userIdFromToken(token),
  sessionId: null,
  userPreferences: { voicePreference: 'en-US-JennyMultilingualNeural' }
});
socket.on('voice:connected', ({ sessionId }) => { currentSessionId = sessionId; });
```

- Send audio chunk (if recorder gives base64 PCM):
```js
recorder.on('data', (base64Chunk) => {
  socket.emit('voice:audio', { audio: base64Chunk, timestamp: Date.now(), sessionId: currentSessionId });
});
```

- Receive interim assistant transcript:
```js
socket.on('voice:assistant-transcript', (d) => {
  if (!d.responseId) { if (d.isFinal) addMessage(d.transcript); return; }
  updateOrCreateInterimBubble(d.responseId, d.transcript, d.isFinal);
});
```

Recommended dependencies (installation)
- npm install socket.io-client @react-native-async-storage/async-storage react-native-audio-record react-native-fs react-native-sound
- Follow each lib's native linking / autolinking instructions.

Testing tips
- Use provided web client: open /voice-test.html (served from backend) to confirm backend behavior before mobile debugging.
- Watch server logs for session creation, audio deltas and transcript events.
- Use small, quiet test utterances at first to validate transcription.

If you want, I can:
- Add a sample RN component (TypeScript) showing full flow (auth, recording, socket lifecycle, playback).
- Provide a small utility to convert raw PCM base64 to .wav for playback on RN.

