import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../src/hooks/useAuth";
import { useScoreHistory } from "../../../src/hooks/useScholarStats";
import ScoreStars from "../../../src/components/ScoreStars";
import { SCORE_WEIGHTS } from "../../../src/constants/scoring";
import type { JobQualityScore } from "../../../src/types";

export default function ScoreHistoryScreen() {
  const { user } = useAuth();
  const { scores, loading } = useScoreHistory(user?.uid);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  if (scores.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="star-outline" size={48} color="#334155" />
        <Text style={styles.emptyText}>No scores yet</Text>
        <Text style={styles.emptySubtext}>
          Complete your first job to see your quality scores
        </Text>
      </View>
    );
  }

  const renderScore = ({ item }: { item: JobQualityScore }) => {
    const final = item.finalScore ?? 0;
    const isLocked = item.scoreLocked;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.jobId}>Job #{item.jobId.slice(0, 8)}</Text>
          {isLocked ? (
            <View style={styles.lockedBadge}>
              <Ionicons name="lock-closed" size={12} color="#10b981" />
              <Text style={styles.lockedText}>Final</Text>
            </View>
          ) : (
            <View style={styles.pendingBadge}>
              <Ionicons name="time" size={12} color="#f59e0b" />
              <Text style={styles.pendingText}>Under Review</Text>
            </View>
          )}
        </View>

        <View style={styles.scoreRow}>
          <ScoreStars score={final} size="large" />
        </View>

        {/* Score breakdown */}
        <View style={styles.breakdown}>
          <BreakdownRow
            label="Photo Quality"
            score={item.photoQualityScore}
            weight={SCORE_WEIGHTS.photo_quality}
          />
          <BreakdownRow
            label="Completion"
            score={item.completionScore}
            weight={SCORE_WEIGHTS.completion}
          />
          <BreakdownRow
            label="Timeliness"
            score={item.timelinessScore}
            weight={SCORE_WEIGHTS.timeliness}
          />
        </View>

        {item.customer_complaint && (
          <View style={styles.complaintBanner}>
            <Ionicons name="warning" size={16} color="#ef4444" />
            <Text style={styles.complaintText}>
              Customer complaint: {item.complaint_details || "Filed"}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={scores}
        keyExtractor={(item) => item.id}
        renderItem={renderScore}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

function BreakdownRow({
  label,
  score,
  weight,
}: {
  label: string;
  score: number;
  weight: number;
}) {
  const color =
    score >= 4 ? "#10b981" : score >= 3 ? "#f59e0b" : "#ef4444";

  return (
    <View style={breakdownStyles.row}>
      <Text style={breakdownStyles.label}>{label}</Text>
      <Text style={breakdownStyles.weight}>({(weight * 100).toFixed(0)}%)</Text>
      <View style={breakdownStyles.bar}>
        <View
          style={[
            breakdownStyles.fill,
            { width: `${(score / 5) * 100}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={[breakdownStyles.score, { color }]}>{score.toFixed(1)}</Text>
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
  emptyText: { fontSize: 18, fontWeight: "700", color: "#f8fafc", marginTop: 16 },
  emptySubtext: { fontSize: 14, color: "#64748b", marginTop: 6, textAlign: "center" },
  list: { padding: 12, paddingBottom: 32 },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  jobId: { fontSize: 13, fontWeight: "700", color: "#94a3b8" },
  lockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#10b98120",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  lockedText: { fontSize: 11, fontWeight: "700", color: "#10b981" },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f59e0b20",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pendingText: { fontSize: 11, fontWeight: "700", color: "#f59e0b" },
  scoreRow: { marginBottom: 14 },
  breakdown: { gap: 8 },
  complaintBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ef444420",
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  complaintText: { color: "#ef4444", fontSize: 13, fontWeight: "600", flex: 1 },
});

const breakdownStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontSize: 12, color: "#94a3b8", width: 90 },
  weight: { fontSize: 10, color: "#475569", width: 32 },
  bar: {
    flex: 1,
    height: 6,
    backgroundColor: "#334155",
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 3 },
  score: { fontSize: 13, fontWeight: "800", width: 28, textAlign: "right" },
});
