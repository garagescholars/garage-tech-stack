import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getTierLabel, getTierColor } from "../constants/scoring";
import type { ScholarTier } from "../types";

type Props = {
  score: number; // 0-5
  tier?: ScholarTier;
  size?: "small" | "large";
};

export default function ScoreStars({ score, tier, size = "small" }: Props) {
  const isLarge = size === "large";
  const starSize = isLarge ? 22 : 16;
  const full = Math.floor(score);
  const half = score - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  const tierColor = tier ? getTierColor(tier) : "#f59e0b";

  return (
    <View style={styles.container}>
      <View style={styles.stars}>
        {Array.from({ length: full }).map((_, i) => (
          <Ionicons key={`f${i}`} name="star" size={starSize} color="#f59e0b" />
        ))}
        {half && <Ionicons name="star-half" size={starSize} color="#f59e0b" />}
        {Array.from({ length: empty }).map((_, i) => (
          <Ionicons key={`e${i}`} name="star-outline" size={starSize} color="#334155" />
        ))}
      </View>
      <Text style={[styles.score, isLarge && styles.scoreLarge]}>
        {score.toFixed(2)}
      </Text>
      {tier && (
        <View style={[styles.tierBadge, { backgroundColor: tierColor + "20" }]}>
          <Text style={[styles.tierText, { color: tierColor }]}>
            {getTierLabel(tier)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 8 },
  stars: { flexDirection: "row", gap: 2 },
  score: { fontSize: 13, fontWeight: "800", color: "#f59e0b" },
  scoreLarge: { fontSize: 18 },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tierText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
});
