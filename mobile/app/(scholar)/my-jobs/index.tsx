import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../../src/lib/firebase";
import { useAuth } from "../../../src/hooks/useAuth";
import { useMyJobs } from "../../../src/hooks/useJobs";
import { COLLECTIONS } from "../../../src/constants/collections";
import JobCard from "../../../src/components/JobCard";
import { StaggeredItem, SkeletonBox, FadeInView } from "../../../src/components/AnimatedComponents";
import type { ServiceJob } from "../../../src/types";

type TabKey = "active" | "completed";

const TABS: { key: TabKey; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
];

export default function MyJobsScreen() {
  const { user } = useAuth();
  const { jobs, loading } = useMyJobs(user?.uid);
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("active");
  const [cancelJob, setCancelJob] = useState<ServiceJob | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const activeStatuses = ["UPCOMING", "IN_PROGRESS", "REVIEW_PENDING"];
  const active = jobs.filter((j) => activeStatuses.includes(j.status));
  const completed = jobs.filter(
    (j) => j.status === "COMPLETED" || j.status === "CANCELLED"
  );
  const display = tab === "active" ? active : completed;

  const onJobPress = (job: ServiceJob) => {
    if (job.status === "UPCOMING") {
      router.push(`/(scholar)/my-jobs/${job.id}/checkin` as any);
    } else if (job.status === "IN_PROGRESS") {
      router.push(`/(scholar)/my-jobs/${job.id}/checkout` as any);
    } else {
      router.push(`/(scholar)/jobs/${job.id}` as any);
    }
  };

  const onJobLongPress = (job: ServiceJob) => {
    if (job.status !== "UPCOMING") return;
    Alert.alert("Job Actions", `${job.title}`, [
      { text: "Check In", onPress: () => router.push(`/(scholar)/my-jobs/${job.id}/checkin` as any) },
      {
        text: "Cancel Job",
        style: "destructive",
        onPress: () => {
          setCancelJob(job);
          setCancelReason("");
        },
      },
      { text: "Close", style: "cancel" },
    ]);
  };

  const handleCancelJob = async () => {
    if (!cancelJob || !cancelReason.trim() || !user) return;
    setCancelling(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.JOBS, cancelJob.id), {
        status: "CANCELLED",
        cancellationReason: cancelReason.trim(),
        cancelledAt: serverTimestamp(),
        cancelledBy: user.uid,
        updatedAt: serverTimestamp(),
      });
      setCancelJob(null);
      Alert.alert("Cancelled", "The job has been cancelled.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to cancel job.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.tabRow}>
          <View style={[styles.tab, styles.tabActive]}><SkeletonBox width={50} height={14} /></View>
          <View style={styles.tab}><SkeletonBox width={70} height={14} /></View>
        </View>
        {[0, 1, 2].map((i) => (
          <FadeInView key={i} delay={i * 100} style={{ paddingHorizontal: 12, paddingTop: 8 }}>
            <View style={{ backgroundColor: '#1e293b', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#334155' }}>
              <SkeletonBox width={80} height={20} style={{ marginBottom: 10 }} />
              <SkeletonBox width="70%" height={17} style={{ marginBottom: 8 }} />
              <SkeletonBox width="50%" height={13} />
            </View>
          </FadeInView>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
              {t.key === "active" && active.length > 0 && (
                <Text style={styles.badge}> {active.length}</Text>
              )}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {display.length === 0 ? (
        <View style={styles.center}>
          <Ionicons
            name={tab === "active" ? "calendar-outline" : "checkmark-done-outline"}
            size={48}
            color="#334155"
          />
          <Text style={styles.emptyText}>
            {tab === "active" ? "No active jobs" : "No completed jobs yet"}
          </Text>
          <Text style={styles.emptySubtext}>
            {tab === "active"
              ? "Claim a job from the Jobs tab to get started"
              : "Completed jobs will appear here"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={display}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <StaggeredItem index={index}>
              <JobCard
                job={item}
                onPress={() => onJobPress(item)}
                onLongPress={() => onJobLongPress(item)}
                showStatus
              />
            </StaggeredItem>
          )}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Cancel Job Modal */}
      <Modal visible={!!cancelJob} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Cancel Job</Text>
            <Text style={styles.modalSub}>{cancelJob?.title}</Text>
            <Text style={styles.modalLabel}>Reason for cancellation <Text style={{ color: "#ef4444" }}>*</Text></Text>
            <TextInput
              style={styles.cancelInput}
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Please explain why you need to cancel..."
              placeholderTextColor="#475569"
              multiline
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setCancelJob(null)}>
                <Text style={styles.modalCancelText}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, (!cancelReason.trim() || cancelling) && { opacity: 0.5 }]}
                onPress={handleCancelJob}
                disabled={!cancelReason.trim() || cancelling}
              >
                <Text style={styles.modalConfirmText}>{cancelling ? "Cancelling..." : "Cancel Job"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1b2d" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
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
  tabActive: {
    backgroundColor: "#14b8a6",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
  },
  tabTextActive: {
    color: "#fff",
  },
  badge: {
    fontWeight: "800",
  },
  list: {
    padding: 12,
    paddingTop: 8,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f8fafc",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 6,
    textAlign: "center",
  },

  // Cancel Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalSheet: {
    backgroundColor: "#1e293b",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#475569",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#f8fafc", marginBottom: 4 },
  modalSub: { fontSize: 14, color: "#94a3b8", marginBottom: 16 },
  modalLabel: { fontSize: 13, fontWeight: "600", color: "#94a3b8", marginBottom: 8 },
  cancelInput: {
    backgroundColor: "#0f1b2d",
    borderRadius: 10,
    padding: 12,
    color: "#f8fafc",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#334155",
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  modalActions: { flexDirection: "row", gap: 8 },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: "#0f1b2d",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  modalCancelText: { color: "#94a3b8", fontSize: 15, fontWeight: "700" },
  modalConfirmBtn: {
    flex: 2,
    backgroundColor: "#ef4444",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalConfirmText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
