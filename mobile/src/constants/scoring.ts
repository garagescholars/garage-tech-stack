// Pay Score weights (must sum to 1.0)
export const SCORE_WEIGHTS = {
  photo_quality: 0.4,
  completion: 0.3,
  timeliness: 0.3,
} as const;

// Tier thresholds based on pay_score
export const TIER_THRESHOLDS = {
  top_hustler: 4.5,
  elite: 3.5,
  standard: 2.5,
  // Below 2.5 = 'new' (probation)
} as const;

export function getTierFromScore(score: number): string {
  if (score >= TIER_THRESHOLDS.top_hustler) return "top_hustler";
  if (score >= TIER_THRESHOLDS.elite) return "elite";
  if (score >= TIER_THRESHOLDS.standard) return "standard";
  return "new";
}

export function getTierLabel(tier: string): string {
  switch (tier) {
    case "top_hustler": return "Top Hustler";
    case "elite": return "Elite";
    case "standard": return "Standard";
    default: return "New";
  }
}

export function getTierColor(tier: string): string {
  switch (tier) {
    case "top_hustler": return "#f59e0b"; // amber
    case "elite": return "#8b5cf6";       // purple
    case "standard": return "#3b82f6";    // blue
    default: return "#6b7280";            // gray
  }
}

// Complaint window duration
export const COMPLAINT_WINDOW_HOURS = 48;

// Timeliness scoring
export const TIMELINESS = {
  onTimeScore: 5.0,
  lateDeductionPerMinute: 0.05, // lose 0.05 per minute late
  minScore: 0,
} as const;
