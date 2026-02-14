import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScoreStars from "./ScoreStars";
import type { ScholarTier } from "../types";

type Props = {
  rank: number;
  name: string;
  score: number;
  tier?: ScholarTier;
  jobsCompleted: number;
  isCurrentUser?: boolean;
};

const RANK_COLORS: Record<number, string> = {
  1: "#f59e0b",
  2: "#94a3b8",
  3: "#b45309",
};

export default function LeaderboardRow({
  rank,
  name,
  score,
  tier,
  jobsCompleted,
  isCurrentUser,
}: Props) {
  const rankColor = RANK_COLORS[rank] || "#64748b";
  const isTopThree = rank <= 3;

  return (
    <View style={[styles.row, isCurrentUser && styles.currentUser]}>
      <View style={[styles.rankBadge, isTopThree && { backgroundColor: rankColor + "30" }]}>
        {isTopThree ? (
          <Ionicons name="trophy" size={16} color={rankColor} />
        ) : (
          <Text style={styles.rankText}>{rank}</Text>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
          {isCurrentUser ? " (You)" : ""}
        </Text>
        <ScoreStars score={score} tier={tier} />
      </View>

      <View style={styles.stats}>
        <Text style={styles.jobCount}>{jobsCompleted}</Text>
        <Text style={styles.jobLabel}>jobs</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    gap: 12,
  },
  currentUser: {
    backgroundColor: "#14b8a620",
    borderLeftWidth: 3,
    borderLeftColor: "#14b8a6",
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1e293b",
  },
  rankText: { color: "#64748b", fontWeight: "800", fontSize: 14 },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontWeight: "700", color: "#f8fafc" },
  stats: { alignItems: "center" },
  jobCount: { fontSize: 18, fontWeight: "800", color: "#14b8a6" },
  jobLabel: { fontSize: 10, color: "#64748b", fontWeight: "600" },
});
