import { EmotionDetectionService } from "../../src/services/emotionDetection";

describe("EmotionDetectionService", () => {
  let emotionService: EmotionDetectionService;

  beforeEach(() => {
    emotionService = new EmotionDetectionService();
  });

  describe("analyzeEmotion", () => {
    test("should detect sad emotions correctly", async () => {
      const text = "I'm feeling really sad and depressed today";
      const result = await emotionService.analyzeEmotion(text);

      expect(result.primary).toBe("sad");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.emotions).toHaveProperty("sad");
      expect(result.emotions.sad).toBeGreaterThan(0);
    });

    test("should detect anxious emotions correctly", async () => {
      const text = "I'm so worried and anxious about everything";
      const result = await emotionService.analyzeEmotion(text);

      expect(result.primary).toBe("anxious");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.emotions).toHaveProperty("anxious");
      expect(result.emotions.anxious).toBeGreaterThan(0);
    });

    test("should detect happy emotions correctly", async () => {
      const text = "I'm feeling so happy and excited today!";
      const result = await emotionService.analyzeEmotion(text);

      expect(result.primary).toBe("happy");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.emotions).toHaveProperty("happy");
      expect(result.emotions.happy).toBeGreaterThan(0);
    });

    test("should default to calm for neutral text", async () => {
      const text = "The weather is nice today";
      const result = await emotionService.analyzeEmotion(text);

      expect(result.primary).toBe("calm");
      expect(result.emotions).toBeDefined();
    });

    test("should handle empty text gracefully", async () => {
      const text = "";
      const result = await emotionService.analyzeEmotion(text);

      expect(result.primary).toBe("calm");
      expect(result.emotions).toBeDefined();
    });
  });
});
