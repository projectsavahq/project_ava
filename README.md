# AVA - Voice-Driven AI Companion

![AVA Logo](https://img.shields.io/badge/AVA-Voice%20AI%20Companion-blue?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square&logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript)
![Express](https://img.shields.io/badge/Express-4.18+-lightgrey?style=flat-square&logo=express)

AVA is a voice-driven AI companion designed for emotional support, resilience coaching, and crisis intervention. Built with privacy-first principles and real-time voice interaction capabilities.

## 🎯 Project Overview

AVA provides:

- **Voice-first interaction** through natural speech input/output
- **Crisis-aware design** with immediate, structured guidance
- **Personalization** that adapts based on user history and emotional state
- **Privacy-first architecture** with end-to-end encryption
- **Scalable microservices** built for millions of concurrent users

## 🏗️ Architecture

```
User (Voice)
   ↓
Speech-to-Text Engine (ASR)
   ↓
Natural Language Processing + Emotion Detection
   ↓
AI Core (Dialogue Manager + Coaching Models)
   ↓
Response Generation (Support Prompts, Resilience Coaching)
   ↓
Text-to-Speech (TTS)
   ↓
User (Voice Output)
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- TypeScript knowledge

### Installation

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd ava
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment setup**

   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

4. **Build the project**

   ```bash
   npm run build
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3001`

## 📁 Project Structure

```
ava/
├── src/
│   ├── index.ts              # Main application entry point
│   ├── services/             # Core business logic
│   │   ├── speechToText.ts   # Audio → Text conversion
│   │   ├── textToSpeech.ts   # Text → Audio conversion
│   │   ├── emotionDetection.ts # Emotion analysis
│   │   ├── crisisDetection.ts  # Crisis intervention
│   │   └── dialogueManager.ts  # Conversation orchestration
│   ├── routes/               # API endpoints
│   │   ├── voice.ts         # Voice processing endpoints
│   │   ├── conversation.ts  # Chat/conversation management
│   │   ├── crisis.ts        # Crisis intervention endpoints
│   │   └── health.ts        # Health checks
│   ├── models/               # Data models and database
│   │   ├── types.ts         # TypeScript interfaces
│   │   └── database.ts      # Database operations (mock)
│   ├── middleware/           # Express middleware
│   │   ├── errorHandler.ts  # Error handling
│   │   └── rateLimiter.ts   # Rate limiting
│   ├── types/               # Type definitions
│   └── utils/               # Utility functions
├── tests/                    # Test suites
├── dist/                     # Compiled JavaScript
├── package.json
├── tsconfig.json
├── jest.config.json
└── README.md
```

## 🔧 API Endpoints

### Voice Processing

- `POST /api/voice/process-audio` - Process audio input and get AI response
- `POST /api/voice/speech-to-text` - Convert speech to text
- `POST /api/voice/text-to-speech` - Convert text to speech
- `GET /api/voice/voices` - Get available voice options

### Conversation Management

- `POST /api/conversation/start` - Start new conversation session
- `POST /api/conversation/message` - Send text message
- `GET /api/conversation/history/:sessionId` - Get conversation history
- `POST /api/conversation/analyze-emotion` - Analyze text emotion
- `POST /api/conversation/coaching-prompt` - Get coaching prompts

### Crisis Intervention

- `POST /api/crisis/analyze` - Analyze text for crisis indicators
- `GET /api/crisis/resources` - Get emergency resources
- `POST /api/crisis/escalate` - Manual crisis escalation
- `GET /api/crisis/status/:userId` - Check user crisis status

### System Health

- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Detailed system status
- `GET /api/health/database` - Database connectivity

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

Test files are located in the `tests/` directory and follow the naming convention `*.test.ts`.

## 🔒 Security Features

- **Rate Limiting**: Protects against abuse with intelligent rate limiting
- **Input Validation**: All inputs are validated and sanitized
- **Error Handling**: Comprehensive error handling with no data leakage
- **Crisis Detection**: Real-time crisis detection with escalation protocols
- **Privacy Protection**: No persistent storage of sensitive voice data

## 🎭 Emotion Detection

AVA can detect and respond to various emotional states:

- **Sadness** - Provides empathetic support and validation
- **Anxiety** - Offers grounding techniques and breathing exercises
- **Anger** - Helps process and channel emotions constructively
- **Stress** - Suggests coping strategies and prioritization
- **Hope** - Reinforces positive emotions and progress
- **Calm** - Maintains supportive presence

## 🚨 Crisis Intervention

AVA includes sophisticated crisis detection with multiple severity levels:

- **Critical**: Immediate intervention required (suicide ideation)
- **High**: Urgent support needed (panic attacks, severe distress)
- **Medium**: Enhanced support recommended (persistent hopelessness)
- **Low**: Standard monitoring and support

### Crisis Response Protocol

1. **Detection**: Real-time analysis of text for crisis indicators
2. **Assessment**: Severity classification and confidence scoring
3. **Response**: Immediate supportive response with resources
4. **Escalation**: Alert systems and emergency contact protocols
5. **Follow-up**: Continued monitoring and support

## 🔮 Roadmap

### Phase 1 - MVP (Current)

- [x] Core voice processing pipeline
- [x] Basic emotion detection
- [x] Crisis detection system
- [x] RESTful API structure
- [ ] WebSocket real-time communication

### Phase 2 - Beta (3-6 months)

- [ ] Advanced ML emotion detection
- [ ] Persistent user sessions
- [ ] Music/wellness integration
- [ ] Mobile app integration
- [ ] Advanced crisis protocols

### Phase 3 - Scale (6-12 months)

- [ ] Real-time voice processing
- [ ] Multi-language support
- [ ] Professional dashboard
- [ ] Analytics and insights
- [ ] Healthcare integrations

## 🛠️ Configuration

Key environment variables:

```env
NODE_ENV=development
PORT=3001
GOOGLE_CLOUD_API_KEY=your_api_key
ELEVENLABS_API_KEY=your_api_key
OPENAI_API_KEY=your_api_key
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=your_secret_key
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Important Disclaimers

- **AVA is not a replacement for professional mental health care**
- **In crisis situations, always contact emergency services (911) or crisis hotlines**
- **All conversations are confidential but emergency protocols may override privacy in life-threatening situations**

## 📞 Emergency Resources

- **National Suicide Prevention Lifeline**: 988
- **Crisis Text Line**: Text HOME to 741741
- **Emergency Services**: 911

## 👥 Support

For technical support or questions:

- Create an issue on GitHub
- Contact the development team
- Check the documentation wiki

---

**Built with ❤️ for mental health support and crisis intervention**
