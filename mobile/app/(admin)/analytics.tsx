import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { collection, onSnapshot } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../src/lib/firebase";
import { COLLECTIONS } from "../../src/constants/collections";
import ProgressBar from "../../src/components/ProgressBar";

type Stats = {
  totalJobs: number;
  openJobs: number;
  activeJobs: number;
  completedJobs: number;
  cancelledJobs: number;
  reviewPending: number;
  totalScholars: number;
  activeScholars: number;
  totalRevenue: number;
  avgScore: number;
};

export default function AnalyticsScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to jobs
    const jobsUnsub = onSnapshot(collection(db, COLLECTIONS.JOBS), (snap) => {
      const jobs = snap.docs.map((d) => d.data());
      const statuses = jobs.reduce<Record<string, number>>((acc, j) => {
        const s = j.status as string;
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {});

      const totalRevenue = jobs
        .filter((j) => j.status === "COMPLETED")
        .reduce((sum, j) => sum + ((j.payout as number) || 0), 0);

      setStats((prev) => ({
        ...(prev || {
          totalScholars: 0,
          activeScholars: 0,
          avgScore: 0,
        }),
        totalJobs: jobs.length,
        openJobs: (statuses["APPROVED_FOR_POSTING"] || 0) + (statuses["REOPENED"] || 0),
        activeJobs: (statuses["UPCOMING"] || 0) + (statuses["IN_PROGRESS"] || 0),
        completedJobs: statuses["COMPLETED"] || 0,
        cancelledJobs: statuses["CANCELLED"] || 0,
        reviewPending: statuses["REVIEW_PENDING"] || 0,
        totalRevenue,
      }));
      setLoading(false);
    });

    // Subscribe to scholars (gs_scholarProfiles — all docs are scholars)
    const scholarsUnsub = onSnapshot(collection(db, COLLECTIONS.SCHOLAR_PROFILES), (snap) => {
      const scholars = snap.docs.map((d) => d.data());
      const active = scholars.filter((s) => s.isActive !== false);
      const scores = scholars
        .map((s) => s.payScore as number)
        .filter((s) => s > 0);
      const avgScore =
        scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : 0;

      setStats((prev) => ({
        ...(prev || {
          totalJobs: 0,
          openJobs: 0,
          activeJobs: 0,
          completedJobs: 0,
          cancelledJobs: 0,
          reviewPending: 0,
          totalRevenue: 0,
        }),
        totalScholars: scholars.length,
        activeScholars: active.length,
        avgScore,
      }));
    });

    return () => {
      jobsUnsub();
      scholarsUnsub();
    };
  }, []);

  if (loading || !stats) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  const completionRate =
    stats.totalJobs > 0
      ? (stats.completedJobs / stats.totalJobs) * 100
      : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Revenue */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Total Revenue (Completed)</Text>
        <Text style={styles.heroValue}>
          ${stats.totalRevenue.toLocaleString()}
        </Text>
      </View>

      {/* Job stats */}
      <Text style={styles.sectionTitle}>Jobs Overview</Text>
      <View style={styles.grid}>
        <StatCard icon="briefcase" label="Total Jobs" value={stats.totalJobs} color="#14b8a6" />
        <StatCard icon="radio-button-on" label="Open" value={stats.openJobs} color="#3b82f6" />
        <StatCard icon="play-circle" label="Active" value={stats.activeJobs} color="#f59e0b" />
        <StatCard icon="time" label="In Review" value={stats.reviewPending} color="#8b5cf6" />
        <StatCard icon="checkmark-circle" label="Completed" value={stats.completedJobs} color="#10b981" />
        <StatCard icon="close-circle" label="Cancelled" value={stats.cancelledJobs} color="#ef4444" />
      </View>

      <View style={styles.section}>
        <Text style={styles.progressLabel}>Completion Rate</Text>
        <ProgressBar
          progress={completionRate}
          color={completionRate >= 80 ? "#10b981" : completionRate >= 50 ? "#f59e0b" : "#ef4444"}
        />
      </View>

      {/* Scholar stats */}
      <Text style={styles.sectionTitle}>Scholars</Text>
      <View style={styles.grid}>
        <StatCard icon="people" label="Total" value={stats.totalScholars} color="#14b8a6" />
        <StatCard icon="person" label="Active" value={stats.activeScholars} color="#10b981" />
        <StatCard icon="star" label="Avg Score" value={Number(stats.avgScore.toFixed(1))} color="#f59e0b" />
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={cardStyles.card}>
      <Ionicons name={icon as any} size={22} color={color} />
      <Text style={[cardStyles.value, { color }]}>{value}</Text>
      <Text style={cardStyles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1b2d" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: 16 },
  heroCard: {
    backgroundColor: "#14b8a620",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#14b8a640",
  },
  heroLabel: { fontSize: 13, fontWeight: "700", color: "#94a3b8", marginBottom: 4 },
  heroValue: { fontSize: 36, fontWeight: "800", color: "#10b981" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  section: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94a3b8",
    marginBottom: 8,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    width: "31%" as any,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  value: { fontSize: 22, fontWeight: "800" },
  label: { fontSize: 10, color: "#64748b", fontWeight: "600", textAlign: "center" },
});
