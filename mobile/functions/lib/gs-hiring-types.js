"use strict";
/**
 * Garage Scholars — Hiring Pipeline Type Definitions
 *
 * Data model for the zero-touch applicant screening & evaluation system.
 * Replaces the Google Sheets schema from the original spec with Firestore.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VIDEO_PASS_THRESHOLD = exports.APP_PASS_THRESHOLD = exports.DECISION_THRESHOLDS = exports.DECISION_WEIGHTS = void 0;
// ── Decision Engine Weights (Step 6.6) ──
exports.DECISION_WEIGHTS = {
    APP_SCORE: 0.20, // 20% of final composite
    VIDEO_SCORE: 0.30, // 30% of final composite
    ZOOM_SCORE: 0.50, // 50% of final composite
};
exports.DECISION_THRESHOLDS = {
    HIRE: 75, // 75+ = auto offer
    REVIEW_MIN: 60, // 60-74 = founder review
    REJECT_BELOW: 60, // <60 = auto reject
};
exports.APP_PASS_THRESHOLD = 60;
exports.VIDEO_PASS_THRESHOLD = 65;
