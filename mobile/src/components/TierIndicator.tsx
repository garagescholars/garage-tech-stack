import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getTierLabel,
  getTierColor,
  TIER_THRESHOLDS,
} from "../constants/scoring";
import type { ScholarTier } from "../types";

type Props = {
  tier: ScholarTier;
  score: number;
  size?: "small" | "large";
};

/** Return the next tier threshold above the current tier, or null if already top. */
function getNextTierThreshold(tier: ScholarTier): number | null {
  switch (tier) {
    case "new":
      return TIER_THRESHOLDS.standard; // 2.5
    case "standard":
      return TIER_THRESHOLDS.elite; // 3.5
    case "elite":
      return TIER_THRESHOLDS.top_hustler; // 4.5
    case "top_hustler":
      return null; // already at top
  }
}

/** Return the lower bound for the current tier. */
function getCurrentTierFloor(tier: ScholarTier): number {
  switch (tier) {
    case "new":
      return 0;
    case "standard":
      return TIER_THRESHOLDS.standard;
    case "elite":
      return TIER_THRESHOLDS.elite;
    case "top_hustler":
      return TIER_THRESHOLDS.top_hustler;
  }
}

function getNextTierLabel(tier: ScholarTier): string | null {
  switch (tier) {
    case "new":
      return "Standard";
    case "standard":
      return "Elite";
    case "elite":
      return "Top Hustler";
    case "top_hustler":
      return null;
  }
}

const TIER_ICONS: Record<ScholarTier, keyof typeof Ionicons.glyphMap> = {
  new: "leaf",
  standard: "shield-checkmark",
  elite: "flash",
  top_hustler: "trophy",
};

export default function TierIndicator({ tier, score, size = "small" }: Props) {
  const isLarge = size === "large";
  const color = getTierColor(tier);
  const label = getTierLabel(tier);
  const icon = TIER_ICONS[tier];

  const nextThreshold = getNextTierThreshold(tier);
  const floor = getCurrentTierFloor(tier);
  const nextLabel = getNextTierLabel(tier);

  // Progress percentage toward next tier
  let progressPct = 100;
  if (nextThreshold !== null) {
    const range = nextThreshold - floor;
    const progress = score - floor;
    progressPct = Math.min(100, Math.max(0, (progress / range) * 100));
  }

  return (
    <View style={[styles.container, isLarge && styles.containerLarge]}>
      {/* Badge circle */}
      <View
        style={[
          styles.badge,
          isLarge ? styles.badgeLarge : styles.badgeSmall,
          { borderColor: color },
        ]}
      >
        <Ionicons
          name={icon}
          size={isLarge ? 24 : 16}
          color={color}
        />
      </View>

      {/* Info section */}
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={[styles.label, isLarge && styles.labelLarge, { color }]}>
            {label}
          </Text>
          <Text style={[styles.score, isLarge && styles.scoreLarge]}>
            {score.toFixed(2)}
          </Text>
        </View>

        {/* Progress bar to next tier (large only) */}
        {isLarge && (
          <View style={styles.progressSection}>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${progressPct}%`,
                    backgroundColor: color,
                  },
                ]}
              />
            </View>
            {nextThreshold !== null && nextLabel ? (
              <Text style={styles.nextTierText}>
                {(nextThreshold - score).toFixed(2)} pts to {nextLabel}
              </Text>
            ) : (
              <Text style={[styles.nextTierText, { color }]}>
                Max tier reached
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  containerLarge: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  badge: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    backgroundColor: "#0f1b2d",
  },
  badgeSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  badgeLarge: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  info: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  labelLarge: {
    fontSize: 16,
  },
  score: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f8fafc",
  },
  scoreLarge: {
    fontSize: 18,
  },
  progressSection: {
    marginTop: 10,
  },
  track: {
    height: 6,
    backgroundColor: "#334155",
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
  },
  nextTierText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 4,
  },
});
