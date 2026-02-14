/**
 * Garage Scholars Mobile App — Server-Side Constants
 * Mirror of mobile/src/constants/collections.ts for Cloud Functions
 */

export const GS_COLLECTIONS = {
  PROFILES: "gs_profiles",
  SCHOLAR_PROFILES: "gs_scholarProfiles",
  JOBS: "gs_jobs",
  RECENT_CLAIMS: "gs_recentClaims",
  JOB_CHECKINS: "gs_jobCheckins",
  JOB_QUALITY_SCORES: "gs_jobQualityScores",
  SCHOLAR_GOALS: "gs_scholarGoals",
  SCHOLAR_ACHIEVEMENTS: "gs_scholarAchievements",
  JOB_TRANSFERS: "gs_jobTransfers",
  JOB_RESCHEDULES: "gs_jobReschedules",
  SCHOLAR_ANALYTICS: "gs_scholarAnalytics",
} as const;

/** Quality score weights — must total 1.0 */
export const SCORING_WEIGHTS = {
  PHOTO_QUALITY: 0.4,
  COMPLETION: 0.3,
  TIMELINESS: 0.3,
} as const;

/** Score lock window in hours */
export const SCORE_LOCK_HOURS = 48;

/** Direct transfer expiry in minutes */
export const TRANSFER_EXPIRY_MINUTES = 15;

/** Scholar tier thresholds (payScore) */
export const TIER_THRESHOLDS = {
  new: 0,
  standard: 2.5,
  elite: 3.5,
  top_hustler: 4.5,
} as const;

/** Max recent claims to keep */
export const MAX_RECENT_CLAIMS = 50;
