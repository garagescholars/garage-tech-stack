import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInLeft } from "react-native-reanimated";
import ScoreStars from "./ScoreStars";
import type { ScholarTier } from "../types";

type Props = {
  rank: number;
  name: string;
  score: number;
  tier?: ScholarTier;
  jobsCompleted: number;
  isCurrentUser?: boolean;
  index?: number;
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
  index = 0,
}: Props) {
  const rankColor = RANK_COLORS[rank] || "#64748b";
  const isTopThree = rank <= 3;

  return (
    <Animated.View
      entering={FadeInLeft.delay(index * 60).duration(300).springify()}
      style={[styles.row, isCurrentUser && styles.currentUser]}
    >
      <View style={[styles.rankBadge, isTopThree && { backgroundColor: rankColor + "30" }]}>
        {isTopThree ? (
          <Ionicons name="trophy" size={16} color={rankColor} />
        ) : (
          <Text style={styles.rankText}>{rank}</Text>
        )}
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, isCurrentUser && styles.currentName]} numberOfLines={1}>
          {name}
          {isCurrentUser ? " (You)" : ""}
        </Text>
        <ScoreStars score={score} tier={tier} />
      </View>

      <View style={styles.stats}>
        <Text style={[styles.jobCount, isCurrentUser && styles.currentCount]}>{jobsCompleted}</Text>
        <Text style={styles.jobLabel}>jobs</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    gap: 12,
  },
  currentUser: {
    backgroundColor: "#14b8a615",
    borderLeftWidth: 3,
    borderLeftColor: "#14b8a6",
  },
  currentName: {
    color: "#14b8a6",
  },
  currentCount: {
    color: "#2dd4bf",
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1e293b",
  },
  rankText: { color: "#64748b", fontWeight: "800", fontSize: 14 },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontWeight: "700", color: "#f1f5f9" },
  stats: { alignItems: "center" },
  jobCount: { fontSize: 18, fontWeight: "800", color: "#14b8a6" },
  jobLabel: { fontSize: 10, color: "#5a6a80", fontWeight: "600" },
});
