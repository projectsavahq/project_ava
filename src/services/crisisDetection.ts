import { CrisisDetectionResult } from "../types";

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
    // EXPLANATION: Implement crisis escalation
    // Based on Python script's crisis handling
    // Steps:
    // 1. Log crisis event for audit trail
    // 2. Alert monitoring system/dashboard
    // 3. Prepare emergency resources to show user
    // 4. Optionally notify emergency contacts (with consent)
    // 5. Update user record with crisis status

    console.log(`[CrisisDetection] Crisis detected for user ${userId}:`, crisisResult);

    // Log crisis event with timestamp and severity
    const crisisEvent = {
      userId,
      severity: crisisResult.severity,
      keywords: crisisResult.keywords,
      confidence: crisisResult.confidence,
      timestamp: new Date(),
      context: crisisResult.reasoning,
    };

    // TODO: Store in CrisisEvent collection in MongoDB
    // await CrisisEvent.create(crisisEvent);

    // Alert based on severity
    if (crisisResult.severity === 'critical') {
      console.log('[CrisisDetection] ⚠️  CRITICAL CRISIS ALERT - Immediate intervention required');
      // TODO: Send real-time alert to crisis management dashboard
      // TODO: Trigger SMS notification to on-call counselor
      // TODO: Prepare for immediate escalation
    } else if (crisisResult.severity === 'high') {
      console.log('[CrisisDetection] ⚠️  HIGH severity crisis detected');
      // TODO: Alert crisis team via dashboard
      // TODO: Prepare resources for quick response
    } else if (crisisResult.severity === 'medium') {
      console.log('[CrisisDetection] ℹ️  Medium severity crisis detected - monitoring');
      // TODO: Log for monitoring but don't interrupt conversation
    }

    // Prepare emergency resources message for user
    // EXPLANATION: Show appropriate resources based on severity
    // Similar to how Python script shows crisis resources
    const resourceMessages = {
      critical: `🚨 CRISIS SUPPORT AVAILABLE IMMEDIATELY 🚨
      
National Suicide Prevention Lifeline: 988 (available 24/7)
Crisis Text Line: Text HOME to 741741
International Association for Suicide Prevention: https://www.iasp.info/resources/Crisis_Centres/

Emergency: Call 911 or your local emergency number

You are not alone. Help is available right now.`,

      high: `⚠️  CRISIS SUPPORT RESOURCES ⚠️

National Suicide Prevention Lifeline: 988
Crisis Text Line: Text HOME to 741741
SAMHSA National Helpline: 1-800-662-4357 (free, confidential, 24/7)

A counselor can speak with you immediately.`,

      medium: `We care about your wellbeing.

Consider reaching out to:
• A trusted friend or family member
• A mental health professional
• Crisis Text Line: Text HOME to 741741
• Your therapist or counselor

You deserve support.`,
    };

    const messageLevel = crisisResult.severity as keyof typeof resourceMessages;
    const message = resourceMessages[messageLevel] || resourceMessages.medium;

    // TODO: Emit crisis alert to client with resources
    // await this.emitCrisisAlertToClient(userId, crisisResult, message);

    // Update user record if crisis escalates
    if (crisisResult.severity === 'critical' || crisisResult.severity === 'high') {
      // TODO: Update User collection with crisis status
      // await User.findByIdAndUpdate(userId, {
      //   crisisStatus: crisisResult.severity,
      //   lastCrisisDetection: new Date(),
      //   needsIntervention: true,
      // });
    }
  }
}
