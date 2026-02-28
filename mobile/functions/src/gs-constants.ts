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
  // Payment collections
  PAYOUTS: "gs_payouts",
  CUSTOMER_PAYMENTS: "gs_customerPayments",
  PAYMENT_PERIODS: "gs_paymentPeriods",
  STRIPE_ACCOUNTS: "gs_stripeAccounts",
  PLATFORM_CONFIG: "gs_platformConfig",
  // Escalation & prep collections
  ESCALATIONS: "gs_escalations",
  JOB_PREP: "gs_jobPrep",
  // Activity feed
  ACTIVITY_FEED: "gs_activityFeed",
  // Social media & review campaigns
  SOCIAL_CONTENT_QUEUE: "gs_socialContentQueue",
  REVIEW_CAMPAIGNS: "gs_reviewCampaigns",
  // Resale, donation & gym install
  RESALE_DONATION_ITEMS: "gs_resale_donation_items",
  DONATION_RECEIPTS: "gs_donation_receipts",
  GYM_INSTALL_PHOTOS: "gs_gym_install_photos",
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

// ── Payment Constants ──

/** Hours after checkout before second payout is released */
export const PAYMENT_RELEASE_HOURS = 72;

/** Minimum quality score to auto-release completion payout */
export const MINIMUM_SCORE_FOR_PAYMENT = 2.0;

/** First split percentage (paid on check-in) */
export const CHECKIN_SPLIT_PERCENT = 50;

/** Second split percentage (paid after quality window) */
export const COMPLETION_SPLIT_PERCENT = 50;

/** 1099-NEC filing threshold */
export const TAX_1099_THRESHOLD = 600;

/** Days of month when biweekly pay periods start */
export const PAY_PERIOD_BOUNDARIES = [1, 16] as const;

/** Convenience fee percentage for card payments */
export const CONVENIENCE_FEE_PERCENT = 3.0;
