import { View, Text, StyleSheet } from "react-native";
import { URGENCY_CONFIG } from "../constants/urgency";
import { colors, radius } from "../constants/theme";
import type { UrgencyLevel } from "../types";

type Props = {
  level: UrgencyLevel;
  reopened?: boolean;
};

export default function UrgencyBadge({ level, reopened }: Props) {
  const config = URGENCY_CONFIG[level];

  return (
    <View style={styles.row}>
      {reopened && (
        <View style={[styles.badge, { backgroundColor: "#92400e20" }]}>
          <View style={[styles.dot, { backgroundColor: colors.accent.amber }]} />
          <Text style={[styles.text, { color: colors.accent.amber }]}>REOPENED</Text>
        </View>
      )}
      {config.label ? (
        <View
          style={[
            styles.badge,
            { backgroundColor: `${config.color}15` },
          ]}
        >
          <View style={[styles.dot, { backgroundColor: config.color }]} />
          <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 6,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  text: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
});
