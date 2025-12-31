# Voice Live Chat Testing Guide

This guide explains how to test the WebSocket-based voice chat functionality.

## Features Implemented

✅ **WebSocket Implementation**: Real-time voice communication via Socket.IO
✅ **Authentication**: JWT-based user authentication with signup/login
✅ **Session Management**: Sessions stored in MongoDB with start/end times
✅ **Message Storage**: User and assistant messages saved with timestamps
✅ **Audio Processing**: Real-time voice recording and playback
✅ **Voice Selection**: Multiple Azure voices available
✅ **Session Statistics**: Track usage and conversation history

## Testing the Voice Chat

### 1. Start the Backend Server

```bash
cd project_ava
npm run dev
```

The server will run on `http://localhost:3001`

### 2. Open the Test Interface

Navigate to: `http://localhost:3001/voice-test.html`

### 3. Test Authentication

1. **Sign Up**: Create a new account with email/password
2. **Verify Email**: Check your email for OTP and enter it
3. **Login**: Use your credentials to log in

### 4. Test Voice Chat

1. **Configure Settings**: Select your preferred voice
2. **Start Voice Session**: Click "Start Voice Session"
3. **Speak**: Talk into your microphone - speech will be transcribed
4. **Listen**: AI responses will be played back as audio
5. **View History**: Messages are saved and can be retrieved later

### 5. Check Stored Data

Use the API endpoints to verify data persistence:

```bash
# Get your sessions
GET /api/sessions

# Get messages for a specific session
GET /api/sessions/{sessionId}/messages

# Get usage statistics
GET /api/sessions/stats
```

## API Endpoints

### Authentication

- `POST /api/auth/signup-otp` - Register new user
- `POST /api/auth/verify-otp-registration` - Verify email
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user profile

### Voice Sessions

- `GET /api/sessions` - List user's sessions
- `GET /api/sessions/{sessionId}/messages` - Get session messages
- `GET /api/sessions/stats` - Get usage statistics

### WebSocket Events

#### Client → Server

- `voice:connect` - Initialize voice session
- `voice:audio` - Send audio data (base64 encoded)
- `voice:text-input` - Send text message
- `voice:disconnect` - End voice session

#### Server → Client

- `voice:connected` - Session established
- `voice:audio` - Receive audio data for playback
- `voice:user-transcript` - User speech transcription
- `voice:assistant-transcript` - AI response text
- `voice:speech-started/stopped` - Speech detection events
- `voice:session-ended` - Session terminated
- `voice:error` - Error messages

## Database Schema

### Sessions Collection

```javascript
{
  sessionId: String,
  userId: String,
  startTime: Date,
  endTime: Date,
  status: "active" | "ended" | "error",
  userPreferences: Object,
  duration: Number,
  metadata: Object
}
```

### Messages Collection

```javascript
{
  sessionId: String,
  userId: String,
  role: "user" | "assistant",
  content: String,
  timestamp: Date,
  emotionData: Object,
  crisisIndicators: Object,
  metadata: Object
}
```

## Troubleshooting

### Audio Issues

- Ensure microphone permissions are granted
- Check browser console for WebRTC errors
- Verify Azure credentials in environment variables

### Connection Issues

- Check server logs for WebSocket errors
- Verify JWT token is valid
- Ensure MongoDB connection is working

### Data Not Saving

- Check MongoDB connection status
- Verify user authentication
- Check server logs for database errors

## Environment Variables Required

```env
# Database
MONGODB_URI=mongodb://localhost:27017/ava

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Azure Voice Live
AZURE_VOICE_LIVE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_VOICE_LIVE_API_KEY=your-api-key
AZURE_VOICE_LIVE_API_VERSION=2025-05-01-preview

# Email (for OTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

## Next Steps

- Add emotion detection integration
- Implement crisis detection alerts
- Add session recording/audio storage
- Create admin dashboard for monitoring
- Add real-time collaboration features
