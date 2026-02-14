import { View, Text, StyleSheet } from "react-native";

type Props = {
  progress: number; // 0-100
  label?: string;
  color?: string;
  showPercent?: boolean;
};

export default function ProgressBar({
  progress,
  label,
  color = "#14b8a6",
  showPercent = true,
}: Props) {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <View style={styles.container}>
      {(label || showPercent) && (
        <View style={styles.header}>
          {label && <Text style={styles.label}>{label}</Text>}
          {showPercent && (
            <Text style={[styles.percent, { color }]}>{Math.round(clamped)}%</Text>
          )}
        </View>
      )}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 8 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  label: { fontSize: 13, color: "#94a3b8", fontWeight: "600" },
  percent: { fontSize: 13, fontWeight: "800" },
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
});
