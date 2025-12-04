import { CrisisDetectionService } from "../../src/services/crisisDetection";

describe("CrisisDetectionService", () => {
  let crisisService: CrisisDetectionService;

  beforeEach(() => {
    crisisService = new CrisisDetectionService();
  });

  describe("detectCrisis", () => {
    test("should detect critical crisis keywords", async () => {
      const text = "I want to kill myself, there's no point living";
      const result = await crisisService.detectCrisis(text);

      expect(result.isCrisis).toBe(true);
      expect(result.severity).toBe("critical");
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.keywords.length).toBeGreaterThan(0);
      expect(result.recommendedAction).toBe("IMMEDIATE_INTERVENTION_REQUIRED");
    });

    test("should detect high severity crisis indicators", async () => {
      const text = "I'm having a panic attack and losing control";
      const result = await crisisService.detectCrisis(text);

      expect(result.severity).toBe("high");
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.keywords.length).toBeGreaterThan(0);
      expect(result.recommendedAction).toBe("URGENT_SUPPORT_NEEDED");
    });

    test("should detect medium severity warning signs", async () => {
      const text = "I feel hopeless and worthless, like I'm trapped";
      const result = await crisisService.detectCrisis(text);

      expect(result.severity).toBe("medium");
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.keywords.length).toBeGreaterThan(0);
      expect(result.recommendedAction).toBe("ENHANCED_SUPPORT_RECOMMENDED");
    });

    test("should not flag normal conversation as crisis", async () => {
      const text = "I had a good day today, went for a walk";
      const result = await crisisService.detectCrisis(text);

      expect(result.isCrisis).toBe(false);
      expect(result.severity).toBe("low");
      expect(result.keywords.length).toBe(0);
    });

    test("should handle empty text", async () => {
      const text = "";
      const result = await crisisService.detectCrisis(text);

      expect(result.isCrisis).toBe(false);
      expect(result.severity).toBe("low");
      expect(result.keywords.length).toBe(0);
    });
  });

  describe("getEmergencyResources", () => {
    test("should return crisis hotlines and emergency contacts", () => {
      const resources = crisisService.getEmergencyResources();

      expect(resources).toHaveProperty("crisis_hotlines");
      expect(resources).toHaveProperty("emergency");
      expect(resources.crisis_hotlines).toHaveProperty(
        "National Suicide Prevention Lifeline"
      );
      expect(resources.emergency).toHaveProperty("Emergency Services");
    });
  });
});
