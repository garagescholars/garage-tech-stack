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
import type { ServiceJob } from "../types";

/** Compute a claim deadline = job start time minus 2 hours */
function getClaimDeadline(job: ServiceJob): Timestamp | undefined {
  if (!job.scheduledDate || !job.scheduledTimeStart) return undefined;
  try {
    // scheduledDate format: "2026-02-20" or "Feb 20, 2026"
    // scheduledTimeStart format: "9:00 AM" or "14:00"
    const dateStr = `${job.scheduledDate} ${job.scheduledTimeStart}`;
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return undefined;
    // Subtract 2 hours as claim buffer
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
};

export default function JobCard({ job, onPress, onLongPress, showStatus }: Props) {
  const payout = (job.payout || 0) + (job.rushBonus || 0);
  const scale = useSharedValue(1);
  const claimDeadline = useMemo(() => getClaimDeadline(job), [job.scheduledDate, job.scheduledTimeStart]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const statusColors: Record<string, { bg: string; text: string }> = {
    UPCOMING: { bg: "#dbeafe", text: "#1d4ed8" },
    IN_PROGRESS: { bg: "#dcfce7", text: "#16a34a" },
    REVIEW_PENDING: { bg: "#fef9c3", text: "#a16207" },
    COMPLETED: { bg: "#d1fae5", text: "#059669" },
    CANCELLED: { bg: "#fee2e2", text: "#dc2626" },
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={styles.card}
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
                  {
                    backgroundColor: statusColors[job.status]?.bg || "#f1f5f9",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: statusColors[job.status]?.text || "#475569" },
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
          <Ionicons name="location-outline" size={14} color="#64748b" />
          <Text style={styles.infoText} numberOfLines={1}>
            {job.address}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={14} color="#64748b" />
          <Text style={styles.infoText}>
            {job.scheduledDate} at {job.scheduledTimeStart}
            {job.scheduledTimeEnd ? ` - ${job.scheduledTimeEnd}` : ""}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <CountdownTimer deadline={claimDeadline} />
          <ViewerCount count={job.currentViewers || 0} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#334155",
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
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  payout: {
    fontSize: 22,
    fontWeight: "800",
    color: "#10b981",
  },
  bonus: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f59e0b",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: "#94a3b8",
    flex: 1,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
});
