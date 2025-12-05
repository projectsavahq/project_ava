import { CrisisDetectionService } from "./crisisDetection";
import { CrisisDetectionResult } from "../types";

export interface CrisisAnalysisResponse {
  isCrisis: boolean;
  severity: "low" | "medium" | "high" | "critical";
  keywords: string[];
  confidence: number;
  recommendedAction: string;
}

export interface EmergencyResourcesResponse {
  crisis_hotlines: Record<string, string>;
  emergency: Record<string, string>;
}

export interface CrisisEscalationResponse {
  message: string;
  resources: EmergencyResourcesResponse;
  escalated: boolean;
}

export interface CrisisStatusResponse {
  userId: string;
  inCrisis: boolean;
  lastCrisisCheck: Date;
  message: string;
}

export class CrisisService {
  private crisisDetectionService: CrisisDetectionService;

  constructor() {
    this.crisisDetectionService = new CrisisDetectionService();
  }

  /**
   * Analyze text for crisis indicators
   */
  async analyzeCrisisIndicators(
    text: string,
    userId?: string,
    context?: any
  ): Promise<CrisisAnalysisResponse> {
    const crisisResult = await this.crisisDetectionService.detectCrisis(text, context);

    // If crisis detected and userId provided, escalate
    if (crisisResult.isCrisis && userId) {
      await this.crisisDetectionService.escalateCrisis(userId, crisisResult);
    }

    return {
      isCrisis: crisisResult.isCrisis,
      severity: crisisResult.severity,
      keywords: crisisResult.keywords,
      confidence: crisisResult.confidence,
      recommendedAction: crisisResult.recommendedAction,
    };
  }

  /**
   * Get emergency resources
   */
  getEmergencyResources(): EmergencyResourcesResponse {
    return this.crisisDetectionService.getEmergencyResources();
  }

  /**
   * Manually escalate a crisis
   */
  async escalateCrisis(
    userId: string,
    severity: "low" | "medium" | "high" | "critical",
    details?: string
  ): Promise<CrisisEscalationResponse> {
    const crisisResult: CrisisDetectionResult = {
      isCrisis: true,
      severity,
      keywords: [],
      confidence: 1.0,
      recommendedAction: "MANUAL_ESCALATION",
    };

    await this.crisisDetectionService.escalateCrisis(userId, crisisResult);

    return {
      message: "Crisis escalation initiated",
      resources: this.getEmergencyResources(),
      escalated: true,
    };
  }

  /**
   * Check crisis status for a user
   */
  async getCrisisStatus(userId: string): Promise<CrisisStatusResponse> {
    // TODO: Implement database check for user crisis status
    // For now, return default status
    return {
      userId,
      inCrisis: false,
      lastCrisisCheck: new Date(),
      message: "Crisis status check not fully implemented yet",
    };
  }
}