// Single source of truth for all Firestore collection names.
// All collections prefixed with gs_ to namespace within the shared Firebase project.
export const COLLECTIONS = {
  PROFILES: 'gs_profiles',
  SCHOLAR_PROFILES: 'gs_scholarProfiles',
  JOBS: 'gs_jobs',
  RECENT_CLAIMS: 'gs_recentClaims',
  JOB_CHECKINS: 'gs_jobCheckins',
  JOB_QUALITY_SCORES: 'gs_jobQualityScores',
  SCHOLAR_GOALS: 'gs_scholarGoals',
  SCHOLAR_ACHIEVEMENTS: 'gs_scholarAchievements',
  JOB_TRANSFERS: 'gs_jobTransfers',
  JOB_RESCHEDULES: 'gs_jobReschedules',
  SCHOLAR_ANALYTICS: 'gs_scholarAnalytics',
  // Payment collections
  PAYOUTS: 'gs_payouts',
  CUSTOMER_PAYMENTS: 'gs_customerPayments',
  PAYMENT_PERIODS: 'gs_paymentPeriods',
  STRIPE_ACCOUNTS: 'gs_stripeAccounts',
  PLATFORM_CONFIG: 'gs_platformConfig',
} as const;
