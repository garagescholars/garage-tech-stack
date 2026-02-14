import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { JobTransfer } from "../types";

type Props = {
  transfer: JobTransfer;
  onAccept?: () => void;
  onDecline?: () => void;
  showActions?: boolean;
};

const STATUS_CONFIG: Record<
  JobTransfer["status"],
  { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pending: { label: "Pending", color: "#f59e0b", bg: "#f59e0b20", icon: "time" },
  accepted: { label: "Accepted", color: "#10b981", bg: "#10b98120", icon: "checkmark-circle" },
  declined: { label: "Declined", color: "#ef4444", bg: "#ef444420", icon: "close-circle" },
  expired: { label: "Expired", color: "#64748b", bg: "#64748b20", icon: "alarm" },
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Expired";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function TransferCard({
  transfer,
  onAccept,
  onDecline,
  showActions = false,
}: Props) {
  const [countdown, setCountdown] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  const isDirect = transfer.transferType === "direct";
  const statusCfg = STATUS_CONFIG[transfer.status];

  // Countdown timer for direct transfers
  useEffect(() => {
    if (!isDirect || !transfer.expiresAt || transfer.status !== "pending") {
      return;
    }

    const update = () => {
      const now = Date.now();
      const end = transfer.expiresAt!.toMillis();
      const diff = end - now;

      if (diff <= 0) {
        setCountdown("Expired");
        setIsExpired(true);
      } else {
        setCountdown(formatCountdown(diff));
        setIsExpired(false);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [transfer.expiresAt, transfer.status, isDirect]);

  const actionsVisible =
    showActions && transfer.status === "pending" && !isExpired;

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.typeRow}>
          <Ionicons
            name={isDirect ? "person" : "refresh"}
            size={16}
            color="#14b8a6"
          />
          <Text style={styles.typeLabel}>
            {isDirect ? "Direct Transfer" : "Requeue"}
          </Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
          <Ionicons name={statusCfg.icon} size={12} color={statusCfg.color} />
          <Text style={[styles.statusText, { color: statusCfg.color }]}>
            {statusCfg.label}
          </Text>
        </View>
      </View>

      {/* Job title */}
      {transfer.jobTitle ? (
        <Text style={styles.jobTitle} numberOfLines={2}>
          {transfer.jobTitle}
        </Text>
      ) : null}

      {/* Details */}
      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={14} color="#64748b" />
          <Text style={styles.detailText}>
            From: <Text style={styles.detailValue}>{transfer.fromScholarName || "Unknown"}</Text>
          </Text>
        </View>

        {isDirect && transfer.toScholarName ? (
          <View style={styles.detailRow}>
            <Ionicons name="arrow-forward-outline" size={14} color="#64748b" />
            <Text style={styles.detailText}>
              To: <Text style={styles.detailValue}>{transfer.toScholarName}</Text>
            </Text>
          </View>
        ) : null}

        {transfer.reason ? (
          <View style={styles.detailRow}>
            <Ionicons name="chatbubble-outline" size={14} color="#64748b" />
            <Text style={styles.detailText} numberOfLines={2}>
              {transfer.reason}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Countdown for direct transfers */}
      {isDirect && countdown && transfer.status === "pending" && (
        <View style={styles.countdownRow}>
          <Ionicons
            name="alarm-outline"
            size={14}
            color={isExpired ? "#ef4444" : "#f59e0b"}
          />
          <Text
            style={[
              styles.countdownText,
              { color: isExpired ? "#ef4444" : "#f59e0b" },
            ]}
          >
            {isExpired ? "Transfer expired" : `Expires in ${countdown}`}
          </Text>
        </View>
      )}

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
            style={[styles.actionBtn, styles.acceptBtn]}
            onPress={onAccept}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark" size={18} color="#10b981" />
            <Text style={[styles.actionText, styles.acceptText]}>Accept</Text>
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
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  typeLabel: {
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
    marginBottom: 10,
  },
  detailsContainer: {
    gap: 6,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: "#94a3b8",
    flex: 1,
  },
  detailValue: {
    color: "#f8fafc",
    fontWeight: "600",
  },
  countdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  countdownText: {
    fontSize: 13,
    fontWeight: "700",
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
  acceptBtn: {
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
  acceptText: {
    color: "#10b981",
  },
});
