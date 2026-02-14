import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../../src/lib/firebase";
import { COLLECTIONS } from "../../../src/constants/collections";
import { updateJobStatus } from "../../../src/hooks/useJobs";
import UrgencyBadge from "../../../src/components/UrgencyBadge";
import type { ServiceJob, JobStatus } from "../../../src/types";

const STATUS_ACTIONS: Record<string, { label: string; next: JobStatus; color: string }[]> = {
  APPROVED_FOR_POSTING: [{ label: "Cancel Job", next: "CANCELLED", color: "#ef4444" }],
  UPCOMING: [
    { label: "Mark In Progress", next: "IN_PROGRESS", color: "#3b82f6" },
    { label: "Cancel Job", next: "CANCELLED", color: "#ef4444" },
  ],
  IN_PROGRESS: [
    { label: "Mark Review Pending", next: "REVIEW_PENDING", color: "#f59e0b" },
  ],
  REVIEW_PENDING: [
    { label: "Approve & Complete", next: "COMPLETED", color: "#10b981" },
    { label: "Dispute", next: "DISPUTED", color: "#ef4444" },
  ],
  DISPUTED: [
    { label: "Resolve & Complete", next: "COMPLETED", color: "#10b981" },
    { label: "Reopen Job", next: "REOPENED", color: "#f59e0b" },
  ],
};

export default function AdminJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, COLLECTIONS.JOBS, id), (snap) => {
      if (snap.exists()) {
        setJob({ id: snap.id, ...snap.data() } as ServiceJob);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  const handleStatusChange = (label: string, next: JobStatus) => {
    if (!job || !id) return;
    Alert.alert(label, `Change status to ${next.replace(/_/g, " ")}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            const extra: Record<string, unknown> = {};
            if (next === "REOPENED") {
              extra.reopenCount = (job.reopenCount || 0) + 1;
              extra.reopenedAt = new Date();
              extra.claimedBy = null;
              extra.claimedByName = null;
            }
            await updateJobStatus(id, next, extra);
          } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to update status");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Job not found</Text>
      </View>
    );
  }

  const actions = STATUS_ACTIONS[job.status] || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Header */}
      <View style={styles.header}>
        <UrgencyBadge level={job.urgencyLevel || "standard"} reopened={(job.reopenCount || 0) > 0} />
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{job.status.replace(/_/g, " ")}</Text>
        </View>
      </View>

      <Text style={styles.title}>{job.title}</Text>
      <Text style={styles.payout}>
        ${((job.payout || 0) + (job.rushBonus || 0)).toFixed(0)}
        {job.rushBonus ? ` (+$${job.rushBonus} rush)` : ""}
      </Text>

      {/* Details */}
      <Section title="Details">
        <DetailRow icon="location" text={job.address} />
        <DetailRow
          icon="calendar"
          text={`${job.scheduledDate} at ${job.scheduledTimeStart}${job.scheduledTimeEnd ? ` - ${job.scheduledTimeEnd}` : ""}`}
        />
        {job.clientName && <DetailRow icon="business" text={job.clientName} />}
        {job.customerName && <DetailRow icon="person" text={job.customerName} />}
        {job.customerPhone && <DetailRow icon="call" text={job.customerPhone} />}
      </Section>

      {/* Scholar */}
      {job.claimedByName && (
        <Section title="Assigned Scholar">
          <DetailRow icon="person-circle" text={job.claimedByName} />
        </Section>
      )}

      {/* Description */}
      {job.description && (
        <Section title="Description">
          <Text style={styles.desc}>{job.description}</Text>
        </Section>
      )}

      {/* Customer Notes */}
      {job.customerNotes && (
        <Section title="Customer Notes">
          <Text style={styles.desc}>{job.customerNotes}</Text>
        </Section>
      )}

      {/* Before Photos */}
      {job.beforePhotos && job.beforePhotos.length > 0 && (
        <Section title="Before Photos">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {job.beforePhotos.map((url, i) => (
              <Image key={i} source={{ uri: url }} style={styles.photo} />
            ))}
          </ScrollView>
        </Section>
      )}

      {/* After Photos */}
      {job.afterPhotos && job.afterPhotos.length > 0 && (
        <Section title="After Photos">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {job.afterPhotos.map((url, i) => (
              <Image key={i} source={{ uri: url }} style={styles.photo} />
            ))}
          </ScrollView>
        </Section>
      )}

      {/* Checklist */}
      {job.checklist && job.checklist.length > 0 && (
        <Section title="Checklist">
          {job.checklist.map((item) => (
            <View key={item.id} style={styles.checkItem}>
              <Ionicons
                name={item.completed ? "checkbox" : "square-outline"}
                size={18}
                color={item.completed ? "#10b981" : "#64748b"}
              />
              <Text style={styles.checkText}>{item.text}</Text>
            </View>
          ))}
        </Section>
      )}

      {/* Actions */}
      {actions.length > 0 && (
        <View style={styles.actions}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.next}
              style={[styles.actionBtn, { backgroundColor: action.color }]}
              onPress={() => handleStatusChange(action.label, action.next)}
            >
              <Text style={styles.actionText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon as any} size={18} color="#14b8a6" />
      <Text style={styles.detailText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1b2d" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { color: "#ef4444", fontSize: 16 },
  scroll: { padding: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "800", color: "#f8fafc", marginBottom: 4 },
  payout: { fontSize: 24, fontWeight: "800", color: "#10b981", marginBottom: 16 },
  section: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  detailText: { fontSize: 14, color: "#cbd5e1", flex: 1 },
  desc: { fontSize: 14, color: "#cbd5e1", lineHeight: 20 },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: "#334155",
  },
  checkItem: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  checkText: { fontSize: 14, color: "#cbd5e1", flex: 1 },
  actions: { gap: 8, marginTop: 4 },
  actionBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
