import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../src/hooks/useAuth";
import { useCurrentGoals, useAchievements, useLeaderboard } from "../../../src/hooks/useGoals";
import ProgressBar from "../../../src/components/ProgressBar";
import LeaderboardRow from "../../../src/components/LeaderboardRow";
import type { ScholarTier } from "../../../src/types";

type TabKey = "goals" | "leaderboard" | "achievements";

export default function GoalsScreen() {
  const { user, profile } = useAuth();
  const { goals, loading: goalsLoading } = useCurrentGoals(user?.uid);
  const { achievements, loading: achLoading } = useAchievements(user?.uid);
  const { scholars, loading: lbLoading } = useLeaderboard();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("goals");

  const now = new Date();
  const monthName = now.toLocaleString("default", { month: "long" });

  if (goalsLoading || achLoading || lbLoading) {
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
        {(["goals", "leaderboard", "achievements"] as TabKey[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "goals" ? "Goals" : t === "leaderboard" ? "Rankings" : "Badges"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {tab === "goals" && (
          <>
            <View style={styles.monthHeader}>
              <Text style={styles.monthTitle}>{monthName} Goals</Text>
              <TouchableOpacity
                style={styles.setBtn}
                onPress={() => router.push("/(scholar)/goals/set-goal" as any)}
              >
                <Ionicons name="add" size={18} color="#14b8a6" />
                <Text style={styles.setBtnText}>Set Goal</Text>
              </TouchableOpacity>
            </View>

            {goals.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="flag-outline" size={40} color="#334155" />
                <Text style={styles.emptyTitle}>No goals set</Text>
                <Text style={styles.emptySubtext}>
                  Set a monthly jobs or earnings goal to track your progress
                </Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => router.push("/(scholar)/goals/set-goal" as any)}
                >
                  <Text style={styles.emptyBtnText}>Set Your First Goal</Text>
                </TouchableOpacity>
              </View>
            ) : (
              goals.map((goal) => {
                const progress = goal.goalTarget > 0
                  ? (goal.currentProgress / goal.goalTarget) * 100
                  : 0;
                const icon = goal.goalType === "jobs" ? "briefcase" : "cash";
                const color = goal.goalMet ? "#10b981" : "#14b8a6";
                const prefix = goal.goalType === "money" ? "$" : "";

                return (
                  <View key={goal.id} style={styles.goalCard}>
                    <View style={styles.goalHeader}>
                      <Ionicons name={icon as any} size={20} color={color} />
                      <Text style={styles.goalLabel}>
                        {goal.goalType === "jobs" ? "Jobs" : "Earnings"} Goal
                      </Text>
                      {goal.goalMet && (
                        <View style={styles.metBadge}>
                          <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                          <Text style={styles.metText}>Met!</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.goalProgress}>
                      {prefix}{goal.currentProgress}{" "}
                      <Text style={styles.goalTarget}>
                        / {prefix}{goal.goalTarget}
                      </Text>
                    </Text>
                    <ProgressBar progress={progress} color={color} />
                    {progress >= 80 && progress < 100 && (
                      <Text style={styles.almostText}>Almost there! Keep going!</Text>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}

        {tab === "leaderboard" && (
          <>
            <Text style={styles.sectionTitle}>Scholar Rankings</Text>
            <View style={styles.lbCard}>
              {scholars.length === 0 ? (
                <Text style={styles.emptySubtext}>No scholars yet</Text>
              ) : (
                scholars.map((s, i) => (
                  <LeaderboardRow
                    key={s.uid}
                    rank={i + 1}
                    name={s.name}
                    score={s.payScore}
                    tier={s.tier as ScholarTier}
                    jobsCompleted={s.totalJobsCompleted}
                    isCurrentUser={s.uid === user?.uid}
                  />
                ))
              )}
            </View>
          </>
        )}

        {tab === "achievements" && (
          <>
            <Text style={styles.sectionTitle}>Achievements</Text>
            {achievements.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="medal-outline" size={40} color="#334155" />
                <Text style={styles.emptyTitle}>No badges yet</Text>
                <Text style={styles.emptySubtext}>
                  Complete jobs and hit goals to earn achievement badges
                </Text>
              </View>
            ) : (
              achievements.map((ach) => (
                <View key={ach.id} style={styles.achCard}>
                  <View style={styles.achIcon}>
                    <Ionicons name="medal" size={24} color="#f59e0b" />
                  </View>
                  <View style={styles.achInfo}>
                    <Text style={styles.achTitle}>{ach.title}</Text>
                    {ach.description && (
                      <Text style={styles.achDesc}>{ach.description}</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

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
  scroll: { padding: 12, paddingBottom: 32 },
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  monthTitle: { fontSize: 20, fontWeight: "800", color: "#f8fafc" },
  setBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  setBtnText: { color: "#14b8a6", fontWeight: "700", fontSize: 13 },
  goalCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  goalLabel: { fontSize: 14, fontWeight: "700", color: "#cbd5e1", flex: 1 },
  metBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  metText: { color: "#10b981", fontWeight: "800", fontSize: 12 },
  goalProgress: { fontSize: 28, fontWeight: "800", color: "#f8fafc", marginBottom: 8 },
  goalTarget: { fontSize: 16, fontWeight: "600", color: "#64748b" },
  almostText: { color: "#f59e0b", fontSize: 12, fontWeight: "700", marginTop: 6 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 12,
  },
  lbCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    overflow: "hidden",
  },
  emptyCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#f8fafc" },
  emptySubtext: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
  emptyBtn: {
    backgroundColor: "#14b8a6",
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  achCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  achIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f59e0b20",
    justifyContent: "center",
    alignItems: "center",
  },
  achInfo: { flex: 1 },
  achTitle: { fontSize: 15, fontWeight: "700", color: "#f8fafc" },
  achDesc: { fontSize: 13, color: "#94a3b8", marginTop: 2 },
});
