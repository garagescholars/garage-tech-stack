import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../src/hooks/useAuth";
import { usePayouts } from "../../../src/hooks/usePayouts";
import type { GsPayout } from "../../../src/types";

type TabKey = "all" | "pending" | "paid" | "held";

export default function PaymentsScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const { payouts, loading } = usePayouts(profile?.uid);
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  const filteredPayouts =
    activeTab === "all"
      ? payouts
      : payouts.filter((p) => {
          if (activeTab === "pending")
            return p.status === "pending" || p.status === "processing";
          if (activeTab === "paid") return p.status === "paid";
          if (activeTab === "held") return p.status === "held" || p.status === "failed";
          return true;
        });

  // Calculate totals
  const totalEarned = payouts
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalPending = payouts
    .filter((p) => p.status === "pending" || p.status === "processing")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#f1f5f9" />
        </TouchableOpacity>
        <Text style={styles.title}>Payment History</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderColor: "#10b98140" }]}>
          <Text style={styles.summaryLabel}>Total Earned</Text>
          <Text style={[styles.summaryValue, { color: "#10b981" }]}>
            ${totalEarned.toFixed(2)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: "#f59e0b40" }]}>
          <Text style={styles.summaryLabel}>Pending</Text>
          <Text style={[styles.summaryValue, { color: "#f59e0b" }]}>
            ${totalPending.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(["all", "pending", "paid", "held"] as TabKey[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Payout List */}
      <FlatList
        data={filteredPayouts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <PayoutCard payout={item} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="wallet-outline" size={48} color="#2a3545" />
            <Text style={styles.emptyText}>No payouts yet</Text>
            <Text style={styles.emptySubtext}>
              Complete jobs to start earning
            </Text>
          </View>
        }
      />
    </View>
  );
}

function PayoutCard({ payout }: { payout: GsPayout }) {
  const statusConfig = {
    pending: { icon: "time-outline", color: "#f59e0b", label: "Pending" },
    processing: { icon: "sync-outline", color: "#3b82f6", label: "Processing" },
    paid: { icon: "checkmark-circle", color: "#10b981", label: "Paid" },
    failed: { icon: "alert-circle", color: "#ef4444", label: "Failed" },
    held: { icon: "pause-circle", color: "#ef4444", label: "Held" },
  };

  const splitLabels = {
    checkin_50: "Check-in (50%)",
    completion_50: "Completion (50%)",
    resale: "Resale Payout",
    full: "Full Payout",
  };

  const status = statusConfig[payout.status] || statusConfig.pending;
  const splitLabel = splitLabels[payout.splitType] || payout.splitType;

  const date = payout.createdAt
    ? new Date((payout.createdAt as any).seconds * 1000).toLocaleDateString()
    : "";

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.left}>
        <Ionicons name={status.icon as any} size={20} color={status.color} />
      </View>
      <View style={cardStyles.center}>
        <Text style={cardStyles.splitType}>{splitLabel}</Text>
        <Text style={cardStyles.date}>{date}</Text>
        {payout.holdReason && (
          <Text style={cardStyles.holdReason}>{payout.holdReason}</Text>
        )}
      </View>
      <View style={cardStyles.right}>
        <Text style={[cardStyles.amount, { color: status.color }]}>
          ${(payout.amount || 0).toFixed(2)}
        </Text>
        <Text style={[cardStyles.status, { color: status.color }]}>
          {status.label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1a" },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0a0f1a",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#f1f5f9" },
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#5a6a80",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: { fontSize: 22, fontWeight: "800", marginTop: 4 },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#1a2332",
  },
  tabActive: { backgroundColor: "#14b8a6" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#8b9bb5" },
  tabTextActive: { color: "#fff" },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyText: { fontSize: 16, fontWeight: "700", color: "#5a6a80" },
  emptySubtext: { fontSize: 13, color: "#475569" },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  left: { width: 28, alignItems: "center" },
  center: { flex: 1 },
  right: { alignItems: "flex-end" },
  splitType: { fontSize: 14, fontWeight: "700", color: "#f1f5f9" },
  date: { fontSize: 12, color: "#5a6a80", marginTop: 2 },
  holdReason: { fontSize: 11, color: "#ef4444", marginTop: 4 },
  amount: { fontSize: 18, fontWeight: "800" },
  status: { fontSize: 11, fontWeight: "600", marginTop: 2 },
});
