import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../src/lib/firebase";
import { COLLECTIONS } from "../../src/constants/collections";
import type { JobTransfer, JobReschedule } from "../../src/types";

type TabKey = "transfers" | "reschedules";

export default function TransfersScreen() {
  const [tab, setTab] = useState<TabKey>("transfers");
  const [transfers, setTransfers] = useState<JobTransfer[]>([]);
  const [reschedules, setReschedules] = useState<JobReschedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tQ = query(
      collection(db, COLLECTIONS.JOB_TRANSFERS),
      orderBy("createdAt", "desc")
    );
    const rQ = query(
      collection(db, COLLECTIONS.JOB_RESCHEDULES),
      orderBy("createdAt", "desc")
    );

    const unsub1 = onSnapshot(tQ, (snap) => {
      setTransfers(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })) as JobTransfer[]
      );
      setLoading(false);
    });

    const unsub2 = onSnapshot(rQ, (snap) => {
      setReschedules(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })) as JobReschedule[]
      );
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  const handleRescheduleAction = (id: string, action: "approved" | "declined") => {
    Alert.alert(
      action === "approved" ? "Approve Reschedule" : "Decline Reschedule",
      "Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              await updateDoc(doc(db, COLLECTIONS.JOB_RESCHEDULES, id), {
                status: action,
                approvedAt: serverTimestamp(),
              });
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  const pendingTransfers = transfers.filter((t) => t.status === "pending");
  const pendingReschedules = reschedules.filter((r) => r.status === "pending");

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === "transfers" && styles.tabActive]}
          onPress={() => setTab("transfers")}
        >
          <Text style={[styles.tabText, tab === "transfers" && styles.tabTextActive]}>
            Transfers{pendingTransfers.length > 0 ? ` (${pendingTransfers.length})` : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "reschedules" && styles.tabActive]}
          onPress={() => setTab("reschedules")}
        >
          <Text style={[styles.tabText, tab === "reschedules" && styles.tabTextActive]}>
            Reschedules{pendingReschedules.length > 0 ? ` (${pendingReschedules.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === "transfers" ? (
        <FlatList
          data={transfers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardType}>
                  {item.transferType === "direct" ? "Direct Transfer" : "Requeue"}
                </Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.cardDetail}>Job: {item.jobId.slice(0, 12)}...</Text>
              {item.reason && (
                <Text style={styles.cardReason}>Reason: {item.reason}</Text>
              )}
            </View>
          )}
          ListEmptyComponent={
            <EmptyState text="No transfers yet" icon="swap-horizontal-outline" />
          }
        />
      ) : (
        <FlatList
          data={reschedules}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardType}>
                  Reschedule Request ({item.requesterRole})
                </Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.cardDetail}>
                {item.originalDate} {item.originalTimeStart} → {item.newDate}{" "}
                {item.newTimeStart}
              </Text>
              {item.status === "pending" && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => handleRescheduleAction(item.id, "approved")}
                  >
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.actionText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.declineBtn]}
                    onPress={() => handleRescheduleAction(item.id, "declined")}
                  >
                    <Ionicons name="close" size={16} color="#fff" />
                    <Text style={styles.actionText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <EmptyState text="No reschedule requests" icon="calendar-outline" />
          }
        />
      )}
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    pending: { bg: "#f59e0b20", text: "#f59e0b" },
    accepted: { bg: "#10b98120", text: "#10b981" },
    approved: { bg: "#10b98120", text: "#10b981" },
    declined: { bg: "#ef444420", text: "#ef4444" },
    expired: { bg: "#64748b20", text: "#64748b" },
  };
  const c = colors[status] || colors.pending;
  return (
    <View style={[badgeStyles.badge, { backgroundColor: c.bg }]}>
      <Text style={[badgeStyles.text, { color: c.text }]}>{status}</Text>
    </View>
  );
}

function EmptyState({ text, icon }: { text: string; icon: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon as any} size={48} color="#334155" />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  text: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1b2d" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  tabRow: {
    flexDirection: "row",
    margin: 12,
    marginBottom: 4,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  tabActive: { backgroundColor: "#14b8a6" },
  tabText: { fontSize: 13, fontWeight: "700", color: "#64748b" },
  tabTextActive: { color: "#fff" },
  list: { padding: 12 },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardType: { fontSize: 14, fontWeight: "700", color: "#f8fafc" },
  cardDetail: { fontSize: 13, color: "#94a3b8" },
  cardReason: { fontSize: 12, color: "#64748b", marginTop: 4, fontStyle: "italic" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
  },
  approveBtn: { backgroundColor: "#10b981" },
  declineBtn: { backgroundColor: "#ef4444" },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  empty: { padding: 40, alignItems: "center", gap: 12 },
  emptyText: { color: "#64748b", fontSize: 16 },
});
