import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import UrgencyBadge from "./UrgencyBadge";
import CountdownTimer from "./CountdownTimer";
import ViewerCount from "./ViewerCount";
import type { ServiceJob } from "../types";

type Props = {
  job: ServiceJob;
  onPress: () => void;
  showStatus?: boolean;
};

export default function JobCard({ job, onPress, showStatus }: Props) {
  const payout = (job.payout || 0) + (job.rushBonus || 0);

  const statusColors: Record<string, { bg: string; text: string }> = {
    UPCOMING: { bg: "#dbeafe", text: "#1d4ed8" },
    IN_PROGRESS: { bg: "#dcfce7", text: "#16a34a" },
    REVIEW_PENDING: { bg: "#fef9c3", text: "#a16207" },
    COMPLETED: { bg: "#d1fae5", text: "#059669" },
    CANCELLED: { bg: "#fee2e2", text: "#dc2626" },
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
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
        <CountdownTimer deadline={undefined} />
        <ViewerCount count={job.currentViewers || 0} />
      </View>
    </TouchableOpacity>
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
