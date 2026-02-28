import { SCORE_WEIGHTS, TIMELINESS } from "../constants/scoring";

/**
 * Calculate the final weighted score from individual components.
 */
export function calculateFinalScore(
  photoQuality: number,
  completion: number,
  timeliness: number
): number {
  const weighted =
    photoQuality * SCORE_WEIGHTS.photo_quality +
    completion * SCORE_WEIGHTS.completion +
    timeliness * SCORE_WEIGHTS.timeliness;
  return Math.round(weighted * 100) / 100;
}

/**
 * Calculate timeliness score based on check-in time vs scheduled time.
 * On time or early = 5.0, deductions for lateness.
 */
export function calculateTimelinessScore(
  scheduledStartMs: number,
  actualCheckInMs: number
): number {
  const diffMinutes = (actualCheckInMs - scheduledStartMs) / 60000;

  if (diffMinutes <= 0) return TIMELINESS.onTimeScore; // On time or early

  const deduction = diffMinutes * TIMELINESS.lateDeductionPerMinute;
  return Math.max(TIMELINESS.minScore, TIMELINESS.onTimeScore - deduction);
}

/**
 * Calculate running average pay score after a new job score.
 */
export function updatePayScoreAverage(
  currentAvg: number,
  totalJobs: number,
  newScore: number
): number {
  if (totalJobs <= 0) return newScore;
  const newAvg = (currentAvg * totalJobs + newScore) / (totalJobs + 1);
  return Math.round(newAvg * 100) / 100;
}
