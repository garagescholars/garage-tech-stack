import { View, Text, StyleSheet } from "react-native";
import { URGENCY_CONFIG } from "../constants/urgency";
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
        <View style={[styles.badge, { backgroundColor: "#fef3c7", borderColor: "#fcd34d" }]}>
          <Text style={[styles.text, { color: "#92400e" }]}>REOPENED</Text>
        </View>
      )}
      {config.label ? (
        <View
          style={[
            styles.badge,
            { backgroundColor: config.bgColor, borderColor: config.borderColor },
          ]}
        >
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  text: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
