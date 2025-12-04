import { ConversationContext, EmotionResult } from '../types';
import { EmotionDetectionService } from './emotionDetection';
import { CrisisDetectionService } from './crisisDetection';

export class DialogueManagerService {
  private emotionService: EmotionDetectionService;
  private crisisService: CrisisDetectionService;

  constructor() {
    this.emotionService = new EmotionDetectionService();
    this.crisisService = new CrisisDetectionService();
  }

  async processUserInput(
    text: string,
    context: ConversationContext
  ): Promise<{ response: string; updatedContext: ConversationContext }> {
    try {
      // 1. Analyze emotions in the input
      const emotion = await this.emotionService.analyzeEmotion(text);

      // 2. Check for crisis indicators
      const crisisResult = await this.crisisService.detectCrisis(text, context);

      // 3. Update conversation context
      const updatedContext = {
        ...context,
        currentEmotion: emotion,
        conversationHistory: [
          ...context.conversationHistory,
          {
            role: "user" as const,
            content: text,
            timestamp: new Date(),
            emotion,
          },
        ],
      };

      // 4. Generate appropriate response
      let response: string;

      if (crisisResult.isCrisis) {
        response = await this.handleCrisisResponse(crisisResult, context);
        await this.crisisService.escalateCrisis(context.userId, crisisResult);
      } else {
        response = await this.generateSupportiveResponse(
          text,
          emotion,
          context
        );
      }

      // 5. Add assistant response to context
      updatedContext.conversationHistory.push({
        role: "assistant",
        content: response,
        timestamp: new Date(),
      });

      return {
        response,
        updatedContext,
      };
    } catch (error) {
      console.error("Error in dialogue management:", error);
      throw new Error("Failed to process user input");
    }
  }

  private async handleCrisisResponse(
    crisisResult: any,
    context: ConversationContext
  ): Promise<string> {
    const resources = this.crisisService.getEmergencyResources();

    if (crisisResult.severity === "critical") {
      return `I'm really concerned about what you've shared. Your safety is the most important thing right now. Please reach out for immediate help:

🚨 National Suicide Prevention Lifeline: 988
🚨 Crisis Text Line: Text HOME to 741741
🚨 Or call 911 if you're in immediate danger

You don't have to go through this alone. There are people who want to help you right now. Would you like me to stay with you while you make one of these calls?`;
    }

    if (crisisResult.severity === "high") {
      return `I can hear that you're going through something really difficult right now. It takes courage to share what you're feeling. Here are some immediate support options:

📞 Crisis Text Line: Text HOME to 741741
📞 National Suicide Prevention Lifeline: 988

These are trained counselors who are available 24/7 and understand what you're going through. Would you like to talk about some coping strategies while you decide if you want to reach out to them?`;
    }

    return `I notice you might be struggling right now. It's okay to not be okay. Would you like to try some grounding techniques together, or would you prefer to talk about what's troubling you?`;
  }

  private async generateSupportiveResponse(
    text: string,
    emotion: EmotionResult,
    context: ConversationContext
  ): Promise<string> {
    // Simple response generation based on emotion
    // In production, this would use more sophisticated AI models

    const primaryEmotion = emotion.primary;

    const responses = {
      sad: [
        "I can hear the sadness in what you're sharing. It's okay to feel this way - your emotions are valid.",
        "Sadness can feel overwhelming sometimes. You don't have to carry this alone. What's been weighing on you most?",
        "I'm here with you in this moment. Sometimes just acknowledging our sadness can be the first step.",
      ],
      anxious: [
        "I notice you might be feeling anxious. Let's take a moment to breathe together. Can you tell me what's making you feel this way?",
        "Anxiety can make everything feel overwhelming. You're safe right now. What would help you feel more grounded?",
        "It sounds like anxiety is visiting you today. Remember, feelings are temporary - this will pass.",
      ],
      angry: [
        "I hear your frustration, and it makes sense that you're feeling angry. These feelings are telling us something important.",
        "Anger can be a signal that something needs attention. What's underneath this anger for you?",
        "Your anger is valid. Sometimes anger protects other feelings. What do you think it might be protecting?",
      ],
      stressed: [
        "It sounds like you're carrying a lot right now. Stress can feel overwhelming. What's the biggest thing weighing on you?",
        "When we're stressed, everything can feel urgent. Let's break this down together - what feels most manageable to start with?",
        "Stress is your mind and body telling you something. What would feel most supportive right now?",
      ],
      hopeful: [
        "I can sense some hope in your words, and that's beautiful. Hope can be a powerful companion, even in difficult times.",
        "It's wonderful to hear some optimism from you. What's bringing you this sense of hope today?",
      ],
      happy: [
        "I can feel the positive energy in what you're sharing! It's wonderful when life brings us moments of happiness.",
        "Your happiness is contagious! What's been bringing you joy lately?",
      ],
      calm: [
        "I appreciate the calm energy you're bringing to our conversation. How are you feeling in this moment?",
        "It sounds like you're in a peaceful space right now. That's wonderful. What's contributing to this sense of calm?",
      ],
    };

    const emotionResponses = responses[
      primaryEmotion as keyof typeof responses
    ] || [
      "Thank you for sharing with me. I'm here to listen and support you. What's on your mind today?",
      "I'm here with you. What would be most helpful to talk about right now?",
      "Your feelings matter, and I'm glad you're here. How can I best support you today?",
    ];

    // Add some personalization based on conversation history
    const randomResponse =
      emotionResponses[Math.floor(Math.random() * emotionResponses.length)];

    return randomResponse;
  }

  async generateCoachingPrompt(
    emotion: string,
    context: ConversationContext
  ): Promise<string> {
    // Generate resilience-building prompts based on emotion and user history
    const prompts = {
      sad: [
        "Sometimes when we're sad, it can help to remember moments when we felt different. Can you think of one small thing that brought you comfort recently?",
        "Sadness often tells us what matters to us. What does this feeling tell you about what's important to you?",
      ],
      anxious: [
        "Let's try a quick grounding exercise. Can you name 5 things you can see, 4 things you can touch, 3 things you can hear?",
        "Anxiety often lives in the future or past. What's one thing you can control right now in this moment?",
      ],
      angry: [
        "Anger has energy in it. What would it look like to channel that energy into something that serves you?",
        "What boundary might your anger be trying to help you set?",
      ],
      stressed: [
        "When everything feels urgent, sometimes we need to pause. What's one thing you could let go of, even just for today?",
        "What would you tell a good friend who was feeling exactly as you're feeling right now?",
      ],
    };

    const emotionPrompts = prompts[emotion as keyof typeof prompts] || [
      "What's one small step you could take today to care for yourself?",
      "What would self-compassion sound like for you right now?",
    ];

    return emotionPrompts[Math.floor(Math.random() * emotionPrompts.length)];
  }
}
