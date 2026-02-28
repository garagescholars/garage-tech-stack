import { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Timestamp } from "firebase/firestore";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import UrgencyBadge from "./UrgencyBadge";
import CountdownTimer from "./CountdownTimer";
import ViewerCount from "./ViewerCount";
import { colors, spacing, radius, typography, getCategoryBorderColor } from "../constants/theme";
import type { ServiceJob } from "../types";

/** Compute a claim deadline = job start time minus 2 hours */
function getClaimDeadline(job: ServiceJob): Timestamp | undefined {
  if (!job.scheduledDate || !job.scheduledTimeStart) return undefined;
  try {
    const dateStr = `${job.scheduledDate} ${job.scheduledTimeStart}`;
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return undefined;
    const deadline = new Date(parsed.getTime() - 2 * 60 * 60 * 1000);
    if (deadline.getTime() <= Date.now()) return undefined;
    return Timestamp.fromDate(deadline);
  } catch {
    return undefined;
  }
}

type Props = {
  job: ServiceJob;
  onPress: () => void;
  onLongPress?: () => void;
  showStatus?: boolean;
  actionLabel?: string;
  onAction?: () => void;
};

export default function JobCard({ job, onPress, onLongPress, showStatus, actionLabel, onAction }: Props) {
  const payout = (job.payout || 0) + (job.rushBonus || 0);
  const scale = useSharedValue(1);
  const claimDeadline = useMemo(() => getClaimDeadline(job), [job.scheduledDate, job.scheduledTimeStart]);
  const borderColor = getCategoryBorderColor(job.urgencyLevel);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const statusColors: Record<string, { bg: string; text: string }> = {
    UPCOMING: { bg: "#1d4ed820", text: "#60a5fa" },
    IN_PROGRESS: { bg: "#16a34a20", text: "#4ade80" },
    REVIEW_PENDING: { bg: "#a1620720", text: "#fbbf24" },
    COMPLETED: { bg: "#05966920", text: "#34d399" },
    CANCELLED: { bg: "#dc262620", text: "#f87171" },
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={[styles.card, { borderLeftColor: borderColor }]}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 15, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
      >
        <View style={styles.topRow}>
          <View style={styles.badges}>
            <UrgencyBadge
              level={job.urgencyLevel || "standard"}
              reopened={(job.reopenCount || 0) > 0}
            />
            {showStatus && job.status && (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusColors[job.status]?.bg || "#47556920" },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: statusColors[job.status]?.text || colors.text.secondary },
                  ]}
                >
                  {job.status.replace(/_/g, " ")}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.payout}>
            ${payout.toFixed(0)}
            {job.rushBonus ? (
              <Text style={styles.bonus}> +${job.rushBonus}</Text>
            ) : null}
          </Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {job.title}
        </Text>

        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={14} color={colors.text.muted} />
          <Text style={styles.infoText} numberOfLines={1}>
            {job.address}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.text.muted} />
          <Text style={styles.infoText}>
            {job.scheduledDate} at {job.scheduledTimeStart}
            {job.scheduledTimeEnd ? ` - ${job.scheduledTimeEnd}` : ""}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.bottomLeft}>
            <CountdownTimer deadline={claimDeadline} />
            <ViewerCount count={job.currentViewers || 0} />
          </View>
          {actionLabel && onAction && (
            <Pressable style={styles.actionButton} onPress={onAction}>
              <Text style={styles.actionText}>{actionLabel}</Text>
              <Ionicons name="arrow-forward" size={14} color="#ffffff" />
            </Pressable>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.category.default,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  badges: {
    flexDirection: "row",
    gap: 6,
    flexShrink: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  payout: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.status.success,
    letterSpacing: -0.5,
  },
  bonus: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accent.amber,
  },
  title: {
    ...typography.heading3,
    color: colors.text.heading,
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 5,
  },
  infoText: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
  },
  bottomLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brand.teal,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  actionText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
});
