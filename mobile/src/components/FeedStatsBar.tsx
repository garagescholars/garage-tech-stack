import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import type { ServiceJob } from "../types";

type Props = {
  jobs: ServiceJob[];
};

export default function FeedStatsBar({ jobs }: Props) {
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const totalViewers = jobs.reduce((sum, j) => sum + (j.currentViewers || 0), 0);
  const displayViewers = Math.max(totalViewers, jobs.length > 0 ? 2 : 0);

  return (
    <View style={styles.container}>
      <View style={styles.stat}>
        <Ionicons name="briefcase" size={14} color="#14b8a6" />
        <Text style={styles.statText}>
          <Text style={styles.statNumber}>{jobs.length}</Text> jobs available
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.stat}>
        <Ionicons name="people" size={14} color="#f59e0b" />
        <Text style={styles.statText}>
          <Text style={styles.statNumber}>{displayViewers}</Text> scholars online
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.liveIndicator}>
        <Animated.View style={[styles.liveDot, dotStyle]} />
        <Text style={styles.liveText}>Live</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e293b",
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 10,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  statNumber: {
    fontWeight: "800",
    color: "#f8fafc",
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: "#334155",
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10b981",
  },
  liveText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#10b981",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
