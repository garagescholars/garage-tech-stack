import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { JobReschedule } from "../types";

type Props = {
  reschedule: JobReschedule;
  onApprove?: () => void;
  onDecline?: () => void;
  showActions?: boolean;
};

const STATUS_CONFIG: Record<
  JobReschedule["status"],
  { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pending: { label: "Pending", color: "#f59e0b", bg: "#f59e0b20", icon: "time" },
  approved: { label: "Approved", color: "#10b981", bg: "#10b98120", icon: "checkmark-circle" },
  declined: { label: "Declined", color: "#ef4444", bg: "#ef444420", icon: "close-circle" },
};

const ROLE_LABELS: Record<JobReschedule["requesterRole"], string> = {
  scholar: "Scholar",
  customer: "Customer",
  admin: "Admin",
};

export default function RescheduleCard({
  reschedule,
  onApprove,
  onDecline,
  showActions = false,
}: Props) {
  const statusCfg = STATUS_CONFIG[reschedule.status];
  const actionsVisible = showActions && reschedule.status === "pending";

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Ionicons name="calendar-outline" size={16} color="#14b8a6" />
          <Text style={styles.headerLabel}>Reschedule Request</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
          <Ionicons name={statusCfg.icon} size={12} color={statusCfg.color} />
          <Text style={[styles.statusText, { color: statusCfg.color }]}>
            {statusCfg.label}
          </Text>
        </View>
      </View>

      {/* Job title */}
      {reschedule.jobTitle ? (
        <Text style={styles.jobTitle} numberOfLines={2}>
          {reschedule.jobTitle}
        </Text>
      ) : null}

      {/* Date/time change */}
      <View style={styles.scheduleContainer}>
        {/* Original */}
        <View style={styles.dateBlock}>
          <Text style={styles.dateLabel}>Original</Text>
          <Text style={styles.dateValue}>{reschedule.originalDate}</Text>
          <Text style={styles.timeValue}>{reschedule.originalTimeStart}</Text>
        </View>

        {/* Arrow */}
        <View style={styles.arrowContainer}>
          <Ionicons name="arrow-forward" size={20} color="#14b8a6" />
        </View>

        {/* New */}
        <View style={styles.dateBlock}>
          <Text style={[styles.dateLabel, { color: "#14b8a6" }]}>New</Text>
          <Text style={[styles.dateValue, { color: "#14b8a6" }]}>
            {reschedule.newDate}
          </Text>
          <Text style={[styles.timeValue, { color: "#14b8a6" }]}>
            {reschedule.newTimeStart}
            {reschedule.newTimeEnd ? ` - ${reschedule.newTimeEnd}` : ""}
          </Text>
        </View>
      </View>

      {/* Requester info */}
      <View style={styles.requesterRow}>
        <Ionicons name="person-outline" size={14} color="#64748b" />
        <Text style={styles.requesterText}>
          Requested by{" "}
          <Text style={styles.requesterName}>
            {reschedule.requestedByName || "Unknown"}
          </Text>
          {" "}
          <Text style={styles.requesterRole}>
            ({ROLE_LABELS[reschedule.requesterRole]})
          </Text>
        </Text>
      </View>

      {/* Action buttons */}
      {actionsVisible && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.declineBtn]}
            onPress={onDecline}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={18} color="#ef4444" />
            <Text style={[styles.actionText, styles.declineText]}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn]}
            onPress={onApprove}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark" size={18} color="#10b981" />
            <Text style={[styles.actionText, styles.approveText]}>Approve</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#14b8a6",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  jobTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 12,
  },
  scheduleContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f1b2d",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  dateBlock: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f8fafc",
  },
  timeValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
    marginTop: 2,
  },
  arrowContainer: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  requesterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  requesterText: {
    fontSize: 13,
    color: "#94a3b8",
    flex: 1,
  },
  requesterName: {
    color: "#f8fafc",
    fontWeight: "600",
  },
  requesterRole: {
    color: "#64748b",
    fontWeight: "400",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  declineBtn: {
    borderColor: "#ef4444",
    backgroundColor: "#ef444410",
  },
  approveBtn: {
    borderColor: "#10b981",
    backgroundColor: "#10b98110",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "700",
  },
  declineText: {
    color: "#ef4444",
  },
  approveText: {
    color: "#10b981",
  },
});
