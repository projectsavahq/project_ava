import { CrisisDetectionResult } from "@/types";

export class CrisisDetectionService {
  private emergencyKeywords: string[] = [
    "suicide",
    "kill myself",
    "end it all",
    "want to die",
    "hurt myself",
    "self harm",
    "cut myself",
    "overdose",
    "jump off",
    "hang myself",
    "no point living",
    "better off dead",
    "cant go on",
    "end my life",
  ];

  private urgentKeywords: string[] = [
    "panic attack",
    "cant breathe",
    "having thoughts",
    "very dark place",
    "losing control",
    "feel dangerous",
    "might hurt",
    "spiral",
    "breaking down",
  ];

  private warningKeywords: string[] = [
    "hopeless",
    "worthless",
    "trapped",
    "burden",
    "alone",
    "desperate",
    "overwhelmed",
    "cant cope",
    "giving up",
    "nothing matters",
  ];

  async detectCrisis(
    text: string,
    context?: any
  ): Promise<CrisisDetectionResult> {
    try {
      const textLower = text.toLowerCase();
      let severity: "low" | "medium" | "high" | "critical" = "low";
      let confidence = 0;
      const foundKeywords: string[] = [];

      // Check for emergency keywords (critical)
      const emergencyMatches = this.emergencyKeywords.filter((keyword) =>
        textLower.includes(keyword)
      );

      if (emergencyMatches.length > 0) {
        severity = "critical";
        confidence = 0.95;
        foundKeywords.push(...emergencyMatches);
      }

      // Check for urgent keywords (high)
      else {
        const urgentMatches = this.urgentKeywords.filter((keyword) =>
          textLower.includes(keyword)
        );

        if (urgentMatches.length > 0) {
          severity = "high";
          confidence = 0.8;
          foundKeywords.push(...urgentMatches);
        }

        // Check for warning keywords (medium)
        else {
          const warningMatches = this.warningKeywords.filter((keyword) =>
            textLower.includes(keyword)
          );

          if (warningMatches.length >= 2) {
            severity = "medium";
            confidence = 0.6;
            foundKeywords.push(...warningMatches);
          } else if (warningMatches.length === 1) {
            severity = "low";
            confidence = 0.4;
            foundKeywords.push(...warningMatches);
          }
        }
      }

      const isCrisis = severity === "critical" || severity === "high";
      const recommendedAction = this.getRecommendedAction(severity);

      return {
        isCrisis,
        severity,
        keywords: foundKeywords,
        confidence,
        recommendedAction,
      };
    } catch (error) {
      console.error("Error in crisis detection:", error);
      throw new Error("Failed to analyze crisis indicators");
    }
  }

  private getRecommendedAction(
    severity: "low" | "medium" | "high" | "critical"
  ): string {
    switch (severity) {
      case "critical":
        return "IMMEDIATE_INTERVENTION_REQUIRED";
      case "high":
        return "URGENT_SUPPORT_NEEDED";
      case "medium":
        return "ENHANCED_SUPPORT_RECOMMENDED";
      case "low":
        return "MONITOR_AND_SUPPORT";
      default:
        return "STANDARD_SUPPORT";
    }
  }

  getEmergencyResources(): any {
    return {
      crisis_hotlines: {
        "National Suicide Prevention Lifeline": "988",
        "Crisis Text Line": "Text HOME to 741741",
        "National Domestic Violence Hotline": "1-800-799-7233",
      },
      emergency: {
        "Emergency Services": "911",
        "Crisis Chat": "suicidepreventionlifeline.org/chat",
      },
    };
  }

  async escalateCrisis(
    userId: string,
    crisisResult: CrisisDetectionResult
  ): Promise<void> {
    // TODO: Implement crisis escalation
    // - Log crisis event
    // - Alert monitoring system
    // - Prepare emergency resources
    // - Potentially notify emergency contacts (with proper consent)

    console.log(`Crisis detected for user ${userId}:`, crisisResult);

    if (crisisResult.severity === "critical") {
      // In production, this would trigger immediate response protocols
      console.log("CRITICAL CRISIS ALERT - Immediate intervention required");
    }
  }
}
