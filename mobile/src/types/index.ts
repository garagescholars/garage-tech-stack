import { Timestamp } from "firebase/firestore";

// ── Roles & Enums ──

export type Role = "admin" | "scholar" | "customer";
export type UserStatus = "active" | "disabled" | "pending";
export type ScholarTier = "new" | "standard" | "elite" | "top_hustler";
export type UrgencyLevel = "standard" | "rush" | "same_day";

export type JobStatus =
  | "APPROVED_FOR_POSTING"
  | "UPCOMING"
  | "IN_PROGRESS"
  | "REVIEW_PENDING"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED"
  | "REOPENED";

// ── Profiles (gs_profiles) ──

export type GsProfile = {
  uid: string;
  role: Role;
  fullName: string;
  phone: string;
  email: string;
  avatarUrl?: string;
  pushToken?: string;
  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

// ── Scholar Profiles (gs_scholarProfiles) ──

export type GsScholarProfile = {
  scholarId: string;
  scholarName: string;
  monthlyJobGoal: number;
  monthlyMoneyGoal: number;
  totalJobsCompleted: number;
  totalEarnings: number;
  payScore: number;
  cancellationRate: number;
  acceptanceRate: number;
  tier: ScholarTier;
  showOnLeaderboard: boolean;
  onboardingComplete?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

// Backward-compatible merged profile used by useAuth
export type UserProfile = {
  uid: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  phoneNumber?: string;
  avatarUrl?: string;
  pushToken?: string;
  // Scholar-specific (from gs_scholarProfiles)
  monthlyJobGoal?: number;
  monthlyMoneyGoal?: number;
  payScore?: number;
  tier?: ScholarTier;
  totalJobsCompleted?: number;
  totalEarnings?: number;
  cancellationRate?: number;
  acceptanceRate?: number;
  showOnLeaderboard?: boolean;
  onboardingComplete?: boolean;
};

// ── Jobs (gs_jobs) ──

export type GsJob = {
  id: string;
  title: string;
  description?: string;
  address: string;
  lat?: number;
  lng?: number;

  // Scheduling
  scheduledDate: string;
  scheduledTimeStart: string;
  scheduledTimeEnd?: string;

  // Pricing
  payout: number;
  urgencyLevel: UrgencyLevel;
  rushBonus: number;

  // Status
  status: JobStatus;

  // Social proof
  currentViewers: number;
  viewerFloor: number;
  totalViews: number;

  // Assignments
  claimedBy?: string | null;
  claimedByName?: string | null;
  claimedAt?: Timestamp | null;

  // Client / Customer
  clientName?: string;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  customerNotes?: string;

  // Reopened tracking
  reopenedAt?: Timestamp | null;
  reopenCount: number;

  // SOP / checklist
  sopContent?: string;
  checklist?: ChecklistItem[];

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

// Keep backward-compat alias
export type ServiceJob = GsJob;

export type ChecklistItem = {
  id: string;
  text: string;
  completed: boolean;
  approvalStatus?: "pending" | "approved" | "rejected";
};

// ── Recent Claims (gs_recentClaims) ──

export type GsRecentClaim = {
  id: string;
  jobId: string;
  jobTitle: string;
  scholarName: string;
  payout: number;
  claimedAt: Timestamp;
};

// ── Job Checkins (gs_jobCheckins) ──

export type GsJobCheckin = {
  id: string;
  jobId: string;
  scholarId: string;

  // Check-in
  checkinTime?: Timestamp | null;
  checkinVideoUrl?: string;
  checkinLat?: number;
  checkinLng?: number;
  checkinGeofenceValid: boolean;
  freightReceiptUrl?: string;

  // Check-out
  checkoutTime?: Timestamp | null;
  checkoutVideoUrl?: string;
  checkoutLat?: number;
  checkoutLng?: number;

  // Photos
  beforePhotos: string[];
  afterPhotos: string[];

  createdAt?: Timestamp;
};

// ── Quality Scores (gs_jobQualityScores) ──

export type JobQualityScore = {
  id: string;
  jobId: string;
  scholarId: string;
  photoQualityScore: number;
  completionScore: number;
  timelinessScore: number;
  complaintWindowEnd?: Timestamp;
  customerComplaint: boolean;
  complaintDetails?: string;
  complaintPhotos?: string[];
  finalScore?: number | null;
  scoreLocked: boolean;
  scoreLockedAt?: Timestamp | null;
  createdAt?: Timestamp;
};

// ── Scholar Goals (gs_scholarGoals) ──

export type ScholarGoal = {
  id: string;
  scholarId: string;
  month: number;
  year: number;
  goalType: "jobs" | "money";
  goalTarget: number;
  currentProgress: number;
  goalMet: boolean;
  notifiedAt90: boolean;
  notifiedAt100: boolean;
  createdAt?: Timestamp;
};

// ── Scholar Achievements (gs_scholarAchievements) ──

export type ScholarAchievement = {
  id: string;
  scholarId: string;
  achievementType: string;
  title: string;
  description?: string;
  month?: number;
  year?: number;
  createdAt?: Timestamp;
};

// ── Job Transfers (gs_jobTransfers) ──

export type JobTransfer = {
  id: string;
  jobId: string;
  jobTitle?: string;
  fromScholarId: string;
  fromScholarName?: string;
  toScholarId?: string | null;
  toScholarName?: string | null;
  reason?: string;
  transferType: "direct" | "requeue";
  status: "pending" | "accepted" | "declined" | "expired";
  expiresAt?: Timestamp;
  createdAt?: Timestamp;
};

// ── Job Reschedules (gs_jobReschedules) ──

export type JobReschedule = {
  id: string;
  jobId: string;
  jobTitle?: string;
  requestedBy: string;
  requestedByName?: string;
  requesterRole: "scholar" | "customer" | "admin";
  originalDate: string;
  originalTimeStart: string;
  newDate: string;
  newTimeStart: string;
  newTimeEnd?: string;
  status: "pending" | "approved" | "declined";
  approvedBy?: string | null;
  approvedAt?: Timestamp | null;
  createdAt?: Timestamp;
};

// ── Scholar Analytics (gs_scholarAnalytics) ──

export type GsScholarAnalytics = {
  scholarId: string;
  scholarName: string;
  jobsThisMonth: number;
  earningsThisMonth: number;
  avgPayScoreThisMonth: number;
  jobsLast30Days: number;
  jobsLast90Days: number;
  earningsLast30Days: number;
  earningsLast90Days: number;
  avgClaimResponseMinutes: number;
  cancellationsThisMonth: number;
  reschedulesThisMonth: number;
  jobsTrend: "increasing" | "stable" | "declining";
  earningsTrend: "increasing" | "stable" | "declining";
  totalJobsAllTime: number;
  totalEarningsAllTime: number;
  memberSince?: Timestamp;
  lastUpdated?: Timestamp;
};

// ── Payouts ──

export type Payout = {
  id: string;
  scholarId: string;
  serviceJobId: string;
  amount: number;
  status: "pending" | "paid" | "failed";
  paymentMethod?: string;
  notes?: string;
  createdAt?: Timestamp;
};
