import { Timestamp } from "firebase/firestore";

// ── Roles & Enums ──

export type Role = "admin" | "scholar" | "customer";
export type UserStatus = "active" | "disabled" | "pending";
export type ScholarTier = "new" | "standard" | "elite" | "top_hustler";
export type UrgencyLevel = "standard" | "rush" | "same_day";

export type JobStatus =
  | "LEAD"
  | "INTAKE_SUBMITTED"
  | "SOP_NEEDS_REVIEW"
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
  // Payment fields
  stripeAccountId?: string;
  stripeOnboardingComplete?: boolean;
  bankLinked?: boolean;
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

  // Payment tracking
  firstPayoutId?: string;
  secondPayoutId?: string;
  paymentStatus?: "unpaid" | "first_paid" | "held" | "fully_paid";

  // Phase X: Client intake & SOP fields
  clientEmail?: string;
  clientPhone?: string;
  estimatedHours?: number;
  clientPrice?: number;
  accessConstraints?: string;
  resaleConcierge?: boolean;
  donationOptIn?: boolean;
  productSelections?: Record<string, any>;
  package?: string;
  packageTier?: string;
  generatedSOP?: string;
  sopApprovedBy?: string;
  sopApprovedAt?: string;
  inventoryExtracted?: boolean;
  extractedItemIds?: string[];
  intakeImageUrls?: string[];

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

// ── Payouts (gs_payouts) ──

export type PayoutSplitType = "checkin_50" | "completion_50" | "resale" | "full";
export type PayoutStatus = "pending" | "processing" | "paid" | "failed" | "held";
export type PayoutMethod = "stripe_ach" | "manual_zelle" | "manual_venmo" | "manual_cash" | "manual_check";

export type GsPayout = {
  id: string;
  jobId: string;
  scholarId?: string;
  customerId?: string;
  recipientName?: string;
  amount: number;
  splitType: PayoutSplitType;
  status: PayoutStatus;
  stripeTransferId?: string;
  paymentMethod: PayoutMethod;
  releaseEligibleAt?: Timestamp;
  qualityScoreAtRelease?: number;
  complaintWindowPassed: boolean;
  holdReason?: string;
  taxYear: number;
  notes?: string;
  createdAt?: Timestamp;
  paidAt?: Timestamp;
};

/** @deprecated Use GsPayout instead */
export type Payout = GsPayout;

// ── Customer Payments (gs_customerPayments) ──

export type CustomerPaymentType = "package" | "one_off" | "retention_monthly";
export type CustomerPaymentMethod = "ach" | "card";
export type CustomerPaymentStatus = "pending" | "processing" | "succeeded" | "failed" | "refunded";

export type GsCustomerPayment = {
  id: string;
  customerId: string;
  customerName: string;
  jobId?: string;
  amount: number;
  type: CustomerPaymentType;
  stripePaymentIntentId?: string;
  stripeSubscriptionId?: string;
  paymentMethod: CustomerPaymentMethod;
  convenienceFee: number;
  totalCharged: number;
  status: CustomerPaymentStatus;
  description?: string;
  createdAt?: Timestamp;
  paidAt?: Timestamp;
};

// ── Payment Periods (gs_paymentPeriods) ──

export type PaymentPeriodStatus = "open" | "closed" | "reported";

export type ScholarPeriodBreakdown = {
  scholarId: string;
  scholarName: string;
  jobCount: number;
  totalPaid: number;
  payoutIds: string[];
};

export type GsPaymentPeriod = {
  id: string;
  periodType: "biweekly";
  startDate: string;
  endDate: string;
  totalPayouts: number;
  totalAmount: number;
  scholarBreakdowns: ScholarPeriodBreakdown[];
  cpaReportSentAt?: Timestamp;
  status: PaymentPeriodStatus;
  createdAt?: Timestamp;
};

// ── Stripe Accounts (gs_stripeAccounts) ──

export type StripeAccountType = "scholar" | "resale_customer";

export type GsStripeAccount = {
  id: string;
  userId: string;
  stripeAccountId: string;
  accountType: StripeAccountType;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
  bankLast4?: string;
  taxIdProvided: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

// ── Platform Config (gs_platformConfig/payments) ──

export type GsPaymentConfig = {
  stripeEnabled: boolean;
  checkinSplitPercent: number;
  completionSplitPercent: number;
  paymentReleaseWindowHours: number;
  minimumScoreForRelease: number;
  cpaEmail: string;
  cpaAutoEmailEnabled: boolean;
  cpaReportFrequency: "biweekly";
  convenienceFeePercent: number;
  achPreferred: boolean;
};

// ── SOP Types ──

export type SopSection = {
  title: string;
  body: string;
};

export type SopSectionStep = {
  id: string;
  text: string;
  isCompleted: boolean;
  status: "pending" | "approved" | "rejected";
};

export type SopRequiredPhoto = {
  id: string;
  label: string;
  phase: string;
};

// ── Client (Phase X) ──

export type Client = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  stats?: {
    totalRevenue: number;
    totalJobs: number;
  };
  createdAt?: Timestamp;
};

// ── Property (Phase X) ──

export type Property = {
  id: string;
  clientId: string;
  address: string;
  type?: string;
  notes?: string;
  createdAt?: Timestamp;
};

// ── Inventory Item ──

export type InventoryItem = {
  id: string;
  title: string;
  description?: string;
  price: number;
  condition: "new" | "used";
  platform: string;
  status: "Pending" | "Active" | "Sold" | "Removed";
  imageUrls: string[];
  clientId?: string;
  clientName?: string;
  propertyId?: string;
  sourceServiceJobId?: string;
  dateListed?: string;
  lastUpdated?: Timestamp;
  createdAt?: Timestamp;
};

// ── Signup Request ──

export type SignupRequest = {
  id: string;
  fullName: string;
  email: string;
  role: "scholar" | "customer";
  status: "pending" | "approved" | "declined";
  createdAt?: Timestamp;
};

// ── Admin Notification ──

export type AdminNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  unread: boolean;
  createdAt?: Timestamp;
};
