import { View, Text, StyleSheet } from "react-native";
import { SCORE_WEIGHTS } from "../constants/scoring";

type Props = {
  photoQuality: number; // 0-5
  completion: number; // 0-5
  timeliness: number; // 0-5
};

type CategoryKey = "photo_quality" | "completion" | "timeliness";

const CATEGORIES: { key: CategoryKey; label: string; weight: string }[] = [
  { key: "photo_quality", label: "Photo Quality", weight: "40%" },
  { key: "completion", label: "Completion", weight: "30%" },
  { key: "timeliness", label: "Timeliness", weight: "30%" },
];

function getBarColor(score: number): string {
  if (score >= 4) return "#10b981"; // green
  if (score >= 2.5) return "#f59e0b"; // amber
  return "#ef4444"; // red
}

export default function ScoreBreakdown({
  photoQuality,
  completion,
  timeliness,
}: Props) {
  const scores: Record<CategoryKey, number> = {
    photo_quality: photoQuality,
    completion,
    timeliness,
  };

  const weightedScore =
    photoQuality * SCORE_WEIGHTS.photo_quality +
    completion * SCORE_WEIGHTS.completion +
    timeliness * SCORE_WEIGHTS.timeliness;

  return (
    <View style={styles.container}>
      {CATEGORIES.map(({ key, label, weight }) => {
        const score = scores[key];
        const pct = (score / 5) * 100;
        const color = getBarColor(score);

        return (
          <View key={key} style={styles.row}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>
                {label}{" "}
                <Text style={styles.weight}>({weight})</Text>
              </Text>
              <Text style={[styles.score, { color }]}>{score.toFixed(1)}</Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${pct}%`, backgroundColor: color },
                ]}
              />
            </View>
          </View>
        );
      })}

      <View style={styles.divider} />

      <View style={styles.finalRow}>
        <Text style={styles.finalLabel}>Weighted Score</Text>
        <Text
          style={[styles.finalScore, { color: getBarColor(weightedScore) }]}
        >
          {weightedScore.toFixed(2)}
          <Text style={styles.outOf}> / 5.00</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  row: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f8fafc",
  },
  weight: {
    fontSize: 11,
    fontWeight: "400",
    color: "#64748b",
  },
  score: {
    fontSize: 14,
    fontWeight: "800",
  },
  track: {
    height: 8,
    backgroundColor: "#334155",
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#334155",
    marginVertical: 4,
  },
  finalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  finalLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f8fafc",
  },
  finalScore: {
    fontSize: 20,
    fontWeight: "800",
  },
  outOf: {
    fontSize: 13,
    fontWeight: "400",
    color: "#64748b",
  },
});
