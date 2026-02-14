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
import { useMyJobs } from "../../../src/hooks/useJobs";
import JobCard from "../../../src/components/JobCard";
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#14b8a6" />
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
          renderItem={({ item }) => (
            <JobCard job={item} onPress={() => onJobPress(item)} showStatus />
          )}
          contentContainerStyle={styles.list}
        />
      )}
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
});
