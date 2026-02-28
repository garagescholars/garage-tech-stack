import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getAchievementDef } from "../constants/achievements";

type Props = {
  type: string;
  title: string;
  description?: string;
  earned: boolean;
};

// Map achievement types to Ionicons names and accent colors
const ICON_MAP: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  first_job: { icon: "briefcase", color: "#14b8a6" },
  monthly_goal_met: { icon: "flag", color: "#10b981" },
  streak_3mo: { icon: "flame", color: "#f97316" },
  streak_6mo: { icon: "bonfire", color: "#ef4444" },
  perfect_score: { icon: "star", color: "#f59e0b" },
  top_hustler: { icon: "trophy", color: "#f59e0b" },
  ten_club: { icon: "rocket", color: "#8b5cf6" },
  twenty_five_club: { icon: "diamond", color: "#ec4899" },
};

const DEFAULT_ICON = { icon: "ribbon" as keyof typeof Ionicons.glyphMap, color: "#14b8a6" };

export default function AchievementBadge({ type, title, description, earned }: Props) {
  const mapping = ICON_MAP[type] || DEFAULT_ICON;
  const iconColor = earned ? mapping.color : "#475569";
  const bgColor = earned ? mapping.color + "20" : "#1e293b";
  const borderColor = earned ? mapping.color : "#334155";

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: bgColor,
            borderColor,
          },
          earned && {
            shadowColor: mapping.color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 12,
            elevation: 8,
          },
        ]}
      >
        <Ionicons name={mapping.icon} size={32} color={iconColor} />
        {!earned && (
          <View style={styles.lockOverlay}>
            <Ionicons name="lock-closed" size={14} color="#94a3b8" />
          </View>
        )}
      </View>

      <Text
        style={[styles.title, !earned && styles.titleLocked]}
        numberOfLines={2}
      >
        {title}
      </Text>

      {description ? (
        <Text
          style={[styles.description, !earned && styles.descriptionLocked]}
          numberOfLines={2}
        >
          {description}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    width: 100,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  lockOverlay: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#1e293b",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  title: {
    fontSize: 12,
    fontWeight: "700",
    color: "#f8fafc",
    textAlign: "center",
    marginBottom: 2,
  },
  titleLocked: {
    color: "#64748b",
  },
  description: {
    fontSize: 10,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 14,
  },
  descriptionLocked: {
    color: "#475569",
  },
});
