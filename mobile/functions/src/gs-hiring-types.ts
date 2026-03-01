/**
 * Garage Scholars — Hiring Pipeline Type Definitions
 *
 * Data model for the zero-touch applicant screening & evaluation system.
 * Replaces the Google Sheets schema from the original spec with Firestore.
 */

import { Timestamp } from "firebase-admin/firestore";

// ── Pipeline Status & Decision ──

export type HiringStatus =
  | "pending_ai"         // Application received, waiting for AI scoring
  | "video_invited"      // Passed app screen, video invite sent
  | "pending_video"      // Video invite opened but not completed
  | "video_scoring"      // Videos uploaded, AI scoring in progress
  | "zoom_invited"       // Passed video screen, Zoom invite sent
  | "zoom_scheduled"     // Candidate booked a Zoom slot via Cal.com
  | "pending_decision"   // Interview scored, waiting for decision engine
  | "hired"              // Offer sent
  | "rejected"           // Rejection sent (any stage)
  | "review_needed";     // Routed to founder manual review

export type HiringDecision = "hire" | "reject" | "review";

export type ApplicantSource = "indeed" | "handshake" | "direct" | "referral";

// ── AI Scoring Results ──

/** Claude AI application scoring output (Step 6.2) */
export interface AppScoringResult {
  skills_fit: number;        // 0-100, weight 30%
  reliability: number;       // 0-100, weight 15%
  conscientiousness: number; // 0-100, weight 25%
  problem_solving: number;   // 0-100, weight 30%
  composite_score: number;   // Weighted average
  red_flags: string[];
  pass: boolean;             // composite >= 60 AND zero red flags
  summary: string;           // 2-3 sentence AI summary
}

/** Gemini AI video scoring output — native video input (Step 6.4) */
export interface VideoScoringResult {
  communication: number;                // 0-100, weight 20%
  mechanical_aptitude: number;          // 0-100, weight 25%
  problem_solving_honesty: number;      // 0-100, weight 20%
  reliability_conscientiousness: number; // 0-100, weight 20%
  startup_fit: number;                  // 0-100, weight 15%
  composite_score: number;              // Weighted average
  red_flags: string[];
  strengths: string[];
  concerns: string[];
  pass: boolean;             // composite >= 65 AND zero red flags
  summary: string;           // 3-4 sentence AI summary
}

/** Founder Zoom interview scores (Step 6.5) — each question 1-5 */
export interface InterviewScores {
  q1_dependability: number;
  q2_problem_solving: number;
  q3_customer_interaction: number;
  q4_practical_skills: number;
  q5_coachability: number;
  q6_growth_mindset: number;
  gut_check: "yes" | "maybe" | "no";
  notes?: string;
}

// ── Main Applicant Document ──

/** Firestore document in gs_hiringApplicants/{appId} */
export interface HiringApplicant {
  // ── Identity ──
  name: string;
  email: string;
  phone: string;
  source: ApplicantSource;

  // ── Screening Answers (6 questions from Step 6.1) ──
  q1_transport: string;
  q2_tools: string;
  q3_project: string;
  q4_problem: string;
  q5_availability: string;
  q6_interest: string;

  // ── Resume (optional upload) ──
  resumePath?: string;  // Firebase Storage path to uploaded resume (PDF)

  // ── Application AI Scores (set by gsScoreHiringApplication) ──
  appScores?: AppScoringResult;

  // ── Video Screen (set by video app + gsProcessVideoCompletion) ──
  videoStoragePaths?: string[];  // Firebase Storage paths
  videoScores?: VideoScoringResult;

  // ── Zoom Interview (set by gsProcessInterviewScore) ──
  interviewScores?: InterviewScores;
  calBookingUrl?: string;

  // ── Final Decision (set by decision engine) ──
  finalComposite?: number;       // 0-100 weighted: 20% app + 30% video + 50% zoom
  status: HiringStatus;
  decision?: HiringDecision;

  // ── Timestamps ──
  appliedAt: Timestamp;
  videoInvitedAt?: Timestamp;
  videoCompletedAt?: Timestamp;
  zoomInvitedAt?: Timestamp;
  zoomScheduledAt?: Timestamp;
  decisionAt?: Timestamp;
}

// ── Event Documents (trigger separate pipeline stages) ──

/** Created by video app when candidate finishes all 5 recordings */
export interface VideoCompletionEvent {
  applicantId: string;
  storagePaths: string[];  // 5 paths in Firebase Storage
  completedAt: Timestamp;
}

/** Created when founder submits post-interview scoring form */
export interface InterviewScoreEvent {
  applicantId: string;
  scores: InterviewScores;
  submittedAt: Timestamp;
}

// ── Decision Engine Weights (Step 6.6) ──

export const DECISION_WEIGHTS = {
  APP_SCORE: 0.20,    // 20% of final composite
  VIDEO_SCORE: 0.30,  // 30% of final composite
  ZOOM_SCORE: 0.50,   // 50% of final composite
} as const;

export const DECISION_THRESHOLDS = {
  HIRE: 75,            // 75+ = auto offer
  REVIEW_MIN: 60,      // 60-74 = founder review
  REJECT_BELOW: 60,    // <60 = auto reject
} as const;

export const APP_PASS_THRESHOLD = 60;
export const VIDEO_PASS_THRESHOLD = 65;
