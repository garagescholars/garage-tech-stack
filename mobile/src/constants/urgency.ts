import type { UrgencyLevel } from "../types";

export const URGENCY_CONFIG: Record<UrgencyLevel, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  same_day: {
    label: "SAME DAY",
    color: "#dc2626",
    bgColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  rush: {
    label: "RUSH",
    color: "#ea580c",
    bgColor: "#fff7ed",
    borderColor: "#fed7aa",
  },
  standard: {
    label: "",
    color: "#6b7280",
    bgColor: "#f9fafb",
    borderColor: "#e5e7eb",
  },
};

// Claim confirmation window
export const CLAIM_CONFIRMATION_MINUTES = 15;

// Geofence radius for check-in (meters)
export const GEOFENCE_RADIUS_METERS = 500;

// Push notification proximity radius (miles)
export const NEARBY_JOB_RADIUS_MILES = 25;

// Video recording limits (seconds)
export const VIDEO_MIN_SECONDS = 15;
export const VIDEO_MAX_SECONDS = 60;

// Minimum photos required
export const MIN_BEFORE_PHOTOS = 2;
export const MIN_AFTER_PHOTOS = 2;
