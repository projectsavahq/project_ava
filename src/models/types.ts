export interface User {
  id: string;
  created_at: Date;
  updated_at: Date;
  email?: string;
  preferences: UserPreferences;
  crisis_history: boolean;
  support_level: "basic" | "intermediate" | "intensive";
}

export interface UserPreferences {
  voice_preference?: string;
  language?: string;
  crisis_keywords?: string[];
  emergency_contacts?: EmergencyContact[];
  notification_settings?: NotificationSettings;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
  consent_given: boolean;
}

export interface NotificationSettings {
  crisis_alerts: boolean;
  daily_checkins: boolean;
  wellness_reminders: boolean;
}

export interface ConversationSession {
  id: string;
  user_id: string;
  created_at: Date;
  updated_at: Date;
  ended_at?: Date;
  status: "active" | "ended" | "crisis_escalated";
  summary?: string;
  total_messages: number;
  average_emotion?: string;
}

export interface ConversationMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  emotion_data?: EmotionData;
  crisis_indicators?: CrisisIndicators;
  audio_url?: string;
}

export interface EmotionData {
  primary_emotion: string;
  confidence: number;
  emotions: {
    [key: string]: number;
  };
  analysis_version: string;
}

export interface CrisisIndicators {
  severity: "low" | "medium" | "high" | "critical";
  keywords: string[];
  confidence: number;
  action_taken: string;
  escalated: boolean;
  escalation_time?: Date;
}

export interface CrisisEvent {
  id: string;
  user_id: string;
  session_id: string;
  message_id: string;
  severity: "low" | "medium" | "high" | "critical";
  detected_at: Date;
  resolved_at?: Date;
  status: "active" | "resolved" | "escalated";
  keywords: string[];
  confidence: number;
  response_actions: string[];
  escalation_log?: EscalationLog[];
}

export interface EscalationLog {
  timestamp: Date;
  action: string;
  details: string;
  automated: boolean;
  success: boolean;
}

export interface EmotionTrend {
  id: string;
  user_id: string;
  date: Date;
  primary_emotions: string[];
  emotion_scores: { [key: string]: number };
  session_count: number;
  crisis_indicators_count: number;
}

export interface WellnessMetrics {
  user_id: string;
  week_start: Date;
  total_sessions: number;
  average_session_duration: number;
  emotional_improvement_score: number;
  crisis_frequency: number;
  engagement_level: "low" | "medium" | "high";
  recommendations: string[];
}
