import { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import ClaimCelebration from "../../../src/components/ClaimCelebration";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../../src/lib/firebase";
import { useAuth } from "../../../src/hooks/useAuth";
import { claimJob } from "../../../src/hooks/useJobs";
import { useViewerCount } from "../../../src/hooks/useViewerCount";
import { COLLECTIONS } from "../../../src/constants/collections";
import { SkeletonBox, FadeInView } from "../../../src/components/AnimatedComponents";
import UrgencyBadge from "../../../src/components/UrgencyBadge";
import CountdownTimer from "../../../src/components/CountdownTimer";
import ViewerCount from "../../../src/components/ViewerCount";
import type { ServiceJob } from "../../../src/types";

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuth();
  const router = useRouter();
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [claimedPayout, setClaimedPayout] = useState(0);

  // Track viewer count for FOMO social proof
  useViewerCount(id);

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

  const handleClaim = async () => {
    if (!user || !profile || !job) return;

    if (job.claimedBy) {
      Alert.alert("Already Claimed", "This job has been claimed by another scholar.");
      return;
    }

    setClaiming(true);
    try {
      await claimJob(job.id, user.uid, profile.name);
      setClaimedPayout((job.payout || 0) + (job.rushBonus || 0));
      setShowCelebration(true);
    } catch (err: any) {
      if (err.message?.includes("just taken")) {
        Alert.alert("Job was just taken!", "Another scholar claimed this job before you. Try another one.");
      } else {
        Alert.alert("Error", err.message || "Failed to claim job");
      }
    } finally {
      setClaiming(false);
    }
  };

  const openMaps = () => {
    if (!job) return;
    const addr = encodeURIComponent(job.address);
    Linking.openURL(`https://maps.google.com/?q=${addr}`);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <FadeInView delay={0}>
            <View style={{ backgroundColor: '#1a2332', borderRadius: 16, padding: 20, marginBottom: 12 }}>
              <SkeletonBox width={100} height={24} style={{ marginBottom: 12 }} />
              <SkeletonBox width="90%" height={20} style={{ marginBottom: 10 }} />
              <SkeletonBox width="70%" height={14} style={{ marginBottom: 6 }} />
              <SkeletonBox width="60%" height={14} style={{ marginBottom: 6 }} />
              <SkeletonBox width="50%" height={14} />
            </View>
          </FadeInView>
          <FadeInView delay={100}>
            <View style={{ backgroundColor: '#1a2332', borderRadius: 16, padding: 20, marginBottom: 12 }}>
              <SkeletonBox width={80} height={14} style={{ marginBottom: 10 }} />
              <SkeletonBox width="100%" height={60} style={{ marginBottom: 8 }} />
            </View>
          </FadeInView>
          <FadeInView delay={200}>
            <SkeletonBox width="100%" height={52} borderRadius={12} />
          </FadeInView>
        </ScrollView>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Job not found</Text>
      </View>
    );
  }

  const payout = (job.payout || 0) + (job.rushBonus || 0);
  const isClaimable =
    ["APPROVED_FOR_POSTING", "REOPENED"].includes(job.status) && !job.claimedBy;

  // Compute claim deadline: job start time minus 2 hours
  const claimDeadline = useMemo(() => {
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
  }, [job.scheduledDate, job.scheduledTimeStart]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <UrgencyBadge level={job.urgencyLevel || "standard"} reopened={(job.reopenCount || 0) > 0} />
          <Text style={styles.payout}>
            ${payout.toFixed(0)}
            {job.rushBonus ? (
              <Text style={styles.bonus}> +${job.rushBonus} rush</Text>
            ) : null}
          </Text>
        </View>

        <Text style={styles.title}>{job.title}</Text>

        {/* Info rows */}
        <View style={styles.infoSection}>
          <TouchableOpacity style={styles.infoRow} onPress={openMaps}>
            <Ionicons name="location" size={18} color="#14b8a6" />
            <Text style={[styles.infoText, styles.link]}>{job.address}</Text>
            <Ionicons name="open-outline" size={14} color="#14b8a6" />
          </TouchableOpacity>

          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={18} color="#14b8a6" />
            <Text style={styles.infoText}>
              {job.scheduledDate} at {job.scheduledTimeStart}
              {job.scheduledTimeEnd ? ` - ${job.scheduledTimeEnd}` : ""}
            </Text>
          </View>

          {job.clientName && (
            <View style={styles.infoRow}>
              <Ionicons name="business" size={18} color="#14b8a6" />
              <Text style={styles.infoText}>{job.clientName}</Text>
            </View>
          )}
        </View>

        {/* Countdown + viewers */}
        <View style={styles.urgencyRow}>
          <CountdownTimer deadline={claimDeadline} />
          <ViewerCount count={job.currentViewers || 0} floor={job.viewerFloor || 0} />
        </View>

        {/* Description */}
        {job.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{job.description}</Text>
          </View>
        )}

        {/* SOP Checklist */}
        {job.checklist && job.checklist.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Checklist</Text>
            {job.checklist.map((item: any) => (
              <View key={item.id} style={[styles.checkItem, item.isSubItem && { marginLeft: 24 }]}>
                <Ionicons
                  name={item.completed ? "checkbox" : "square-outline"}
                  size={item.isSubItem ? 16 : 18}
                  color={item.completed ? "#10b981" : "#5a6a80"}
                />
                <Text style={[styles.checkText, item.isSubItem && { fontSize: 13, color: "#8b9bb5" }]}>{item.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Customer notes */}
        {job.customerNotes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Notes</Text>
            <Text style={styles.description}>{job.customerNotes}</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Claim button */}
      {isClaimable && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.claimBtn, claiming && styles.claimBtnDisabled]}
            onPress={handleClaim}
            disabled={claiming}
          >
            {claiming ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="hand-right" size={20} color="#fff" />
                <Text style={styles.claimText}>Claim This Job — ${payout.toFixed(0)}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {job.claimedBy && job.claimedBy !== user?.uid && (
        <View style={styles.bottomBar}>
          <View style={styles.takenBanner}>
            <Ionicons name="lock-closed" size={18} color="#f59e0b" />
            <Text style={styles.takenText}>This job has been claimed</Text>
          </View>
        </View>
      )}

      {/* Claim celebration overlay */}
      {showCelebration && (
        <ClaimCelebration
          payout={claimedPayout}
          jobTitle={job.title}
          onComplete={() => {
            setShowCelebration(false);
            router.replace("/(scholar)/my-jobs" as any);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1a" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { color: "#ef4444", fontSize: 16, marginTop: 12 },
  scroll: { padding: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  payout: { fontSize: 28, fontWeight: "800", color: "#10b981" },
  bonus: { fontSize: 14, fontWeight: "600", color: "#f59e0b" },
  title: { fontSize: 22, fontWeight: "800", color: "#f1f5f9", marginBottom: 16 },
  infoSection: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginBottom: 12,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoText: { fontSize: 14, color: "#cbd5e1", flex: 1 },
  link: { color: "#14b8a6", textDecorationLine: "underline" },
  urgencyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  section: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8b9bb5",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  description: { fontSize: 15, color: "#cbd5e1", lineHeight: 22 },
  checkItem: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  checkText: { fontSize: 14, color: "#cbd5e1", flex: 1 },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: "#0a0f1a",
    borderTopWidth: 1,
    borderTopColor: "#1a2332",
  },
  claimBtn: {
    backgroundColor: "#14b8a6",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  claimBtnDisabled: { opacity: 0.6 },
  claimText: { fontSize: 17, fontWeight: "800", color: "#fff" },
  takenBanner: {
    backgroundColor: "#1a2332",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  takenText: { fontSize: 15, fontWeight: "700", color: "#f59e0b" },
});
