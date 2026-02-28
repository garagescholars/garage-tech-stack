import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../../src/lib/firebase";
import { COLLECTIONS } from "../../../src/constants/collections";
import { useMyJobs } from "../../../src/hooks/useJobs";
import { useScoreHistory } from "../../../src/hooks/useScholarStats";
import ScoreStars from "../../../src/components/ScoreStars";
import ProgressBar from "../../../src/components/ProgressBar";
import { getTierLabel, getTierColor } from "../../../src/constants/scoring";
import type { GsProfile, ScholarTier } from "../../../src/types";

export default function ScholarDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [scholar, setScholar] = useState<GsProfile | null>(null);
  const [scholarProfile, setScholarProfile] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const { jobs } = useMyJobs(id);
  const { scores } = useScoreHistory(id);

  useEffect(() => {
    if (!id) return;

    let profileLoaded = false;
    let scholarProfileLoaded = false;

    const checkDone = () => {
      if (profileLoaded && scholarProfileLoaded) setLoading(false);
    };

    // Subscribe to gs_profiles
    const unsub1 = onSnapshot(doc(db, COLLECTIONS.PROFILES, id), (snap) => {
      if (snap.exists()) {
        setScholar({ uid: snap.id, ...snap.data() } as GsProfile);
      }
      profileLoaded = true;
      checkDone();
    });

    // Subscribe to gs_scholarProfiles
    const unsub2 = onSnapshot(doc(db, COLLECTIONS.SCHOLAR_PROFILES, id), (snap) => {
      if (snap.exists()) {
        setScholarProfile({ uid: snap.id, ...snap.data() });
      }
      scholarProfileLoaded = true;
      checkDone();
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [id]);

  const toggleStatus = () => {
    if (!scholar || !id) return;
    const isActive = scholar.isActive !== false;
    const newIsActive = !isActive;
    Alert.alert(
      `${newIsActive ? "Enable" : "Disable"} Scholar`,
      `${newIsActive ? "This will allow" : "This will prevent"} ${scholar.fullName} from using the app.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              await updateDoc(doc(db, COLLECTIONS.PROFILES, id), { isActive: newIsActive });
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

  if (!scholar) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Scholar not found</Text>
      </View>
    );
  }

  // Merge data from both profiles
  const merged = { ...scholar, ...(scholarProfile || {}) } as Record<string, any>;
  const tier = (merged.tier || "new") as ScholarTier;
  const tierColor = getTierColor(tier);
  const isActive = scholar.isActive !== false;
  const activeJobs = jobs.filter((j) => ["UPCOMING", "IN_PROGRESS"].includes(j.status));
  const completedJobs = jobs.filter((j) => j.status === "COMPLETED");
  const avgScore =
    scores.length > 0
      ? scores.reduce((sum, s) => sum + (s.finalScore || 0), 0) / scores.length
      : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Profile header */}
      <View style={styles.profileCard}>
        <View style={[styles.avatar, { borderColor: tierColor }]}>
          <Ionicons name="person" size={36} color={tierColor} />
        </View>
        <Text style={styles.name}>{merged.fullName || merged.scholarName}</Text>
        <Text style={styles.contact}>
          {merged.phone || merged.email}
        </Text>
        <View style={styles.badgeRow}>
          <View style={[styles.tierBadge, { backgroundColor: tierColor + "20" }]}>
            <Text style={[styles.tierText, { color: tierColor }]}>
              {getTierLabel(tier)}
            </Text>
          </View>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isActive ? "#10b981" : "#ef4444" },
            ]}
          />
          <Text style={styles.statusLabel}>{isActive ? "active" : "disabled"}</Text>
        </View>
      </View>

      {/* Pay Score */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pay Score</Text>
        <ScoreStars score={merged.payScore || 0} tier={tier} size="large" />
        {scores.length > 0 && (
          <Text style={styles.avgText}>
            Average across {scores.length} scored jobs: {avgScore.toFixed(2)}
          </Text>
        )}
      </View>

      {/* Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statistics</Text>
        <View style={styles.statsGrid}>
          <StatBox label="Jobs Completed" value={String(merged.totalJobsCompleted || 0)} />
          <StatBox label="Total Earnings" value={`$${(merged.totalEarnings || 0).toLocaleString()}`} />
          <StatBox label="Active Jobs" value={String(activeJobs.length)} />
          <StatBox
            label="Acceptance"
            value={`${merged.acceptanceRate || 0}%`}
            color={(merged.acceptanceRate || 0) >= 90 ? "#10b981" : "#f59e0b"}
          />
          <StatBox
            label="Cancellations"
            value={`${merged.cancellationRate || 0}%`}
            color={(merged.cancellationRate || 0) <= 5 ? "#10b981" : "#ef4444"}
          />
          <StatBox label="Avg Score" value={avgScore.toFixed(1)} />
        </View>
      </View>

      {/* Recent jobs */}
      {jobs.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Jobs ({jobs.length})</Text>
          {jobs.slice(0, 5).map((job) => (
            <View key={job.id} style={styles.jobRow}>
              <View style={styles.jobInfo}>
                <Text style={styles.jobTitle} numberOfLines={1}>
                  {job.title}
                </Text>
                <Text style={styles.jobDate}>{job.scheduledDate}</Text>
              </View>
              <View style={styles.jobStatusBadge}>
                <Text style={styles.jobStatusText}>
                  {job.status.replace(/_/g, " ")}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <TouchableOpacity
        style={[
          styles.actionBtn,
          { borderColor: isActive ? "#ef4444" : "#10b981" },
        ]}
        onPress={toggleStatus}
      >
        <Ionicons
          name={isActive ? "ban" : "checkmark-circle"}
          size={18}
          color={isActive ? "#ef4444" : "#10b981"}
        />
        <Text
          style={[
            styles.actionText,
            { color: isActive ? "#ef4444" : "#10b981" },
          ]}
        >
          {isActive ? "Disable Scholar" : "Enable Scholar"}
        </Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function StatBox({
  label,
  value,
  color = "#f1f5f9",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={statStyles.box}>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1a" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { color: "#ef4444", fontSize: 16 },
  scroll: { padding: 16 },
  profileCard: {
    backgroundColor: "#1a2332",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#0a0f1a",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    marginBottom: 12,
  },
  name: { fontSize: 22, fontWeight: "800", color: "#f1f5f9", marginBottom: 2 },
  contact: { fontSize: 14, color: "#8b9bb5", marginBottom: 10 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tierBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  tierText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, color: "#8b9bb5", fontWeight: "600", textTransform: "capitalize" },
  section: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5a6a80",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  avgText: { color: "#5a6a80", fontSize: 12, marginTop: 8 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  jobRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2a3545",
  },
  jobInfo: { flex: 1 },
  jobTitle: { fontSize: 14, fontWeight: "600", color: "#f1f5f9" },
  jobDate: { fontSize: 12, color: "#5a6a80" },
  jobStatusBadge: {
    backgroundColor: "#0a0f1a",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  jobStatusText: { fontSize: 10, fontWeight: "700", color: "#8b9bb5" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#1a2332",
    borderWidth: 1,
  },
  actionText: { fontWeight: "700", fontSize: 15 },
});

const statStyles = StyleSheet.create({
  box: {
    width: "30%" as any,
    backgroundColor: "#0a0f1a",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  value: { fontSize: 16, fontWeight: "800" },
  label: { fontSize: 10, color: "#5a6a80", fontWeight: "600", textAlign: "center", marginTop: 2 },
});
