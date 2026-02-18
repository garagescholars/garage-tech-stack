import { View, Text, FlatList, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import ViewerCount from "./ViewerCount";
import type { ServiceJob } from "../types";

type Props = {
  jobs: ServiceJob[];
  onJobPress: (jobId: string) => void;
};

function HotJobCard({ job, onPress }: { job: ServiceJob; onPress: () => void }) {
  const payout = (job.payout || 0) + (job.rushBonus || 0);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={styles.card}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.96, { damping: 15, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
      >
        <View style={styles.payoutRow}>
          <Text style={styles.payout}>${payout}</Text>
          {job.rushBonus ? (
            <Text style={styles.bonus}>+${job.rushBonus}</Text>
          ) : null}
        </View>

        <Text style={styles.title} numberOfLines={1}>{job.title}</Text>

        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={12} color="#94a3b8" />
          <Text style={styles.infoText} numberOfLines={1}>{job.address}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={12} color="#94a3b8" />
          <Text style={styles.infoText}>{job.scheduledDate}</Text>
        </View>

        <View style={styles.footer}>
          <ViewerCount count={job.currentViewers || 0} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function HotJobsCarousel({ jobs, onJobPress }: Props) {
  // Filter for "hot" jobs: rush/same_day, high payout, or many viewers
  const hotJobs = jobs.filter(
    (j) =>
      j.urgencyLevel === "rush" ||
      j.urgencyLevel === "same_day" ||
      (j.payout || 0) + (j.rushBonus || 0) >= 200 ||
      (j.currentViewers || 0) >= 5
  ).slice(0, 5);

  if (hotJobs.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="flame" size={18} color="#ef4444" />
        <Text style={styles.headerText}>Hot Jobs</Text>
      </View>
      <FlatList
        data={hotJobs}
        keyExtractor={(item) => `hot-${item.id}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <HotJobCard job={item} onPress={() => onJobPress(item.id)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  headerText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f8fafc",
  },
  list: {
    paddingRight: 12,
    gap: 10,
  },
  card: {
    width: 200,
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#f59e0b40",
  },
  payoutRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginBottom: 6,
  },
  payout: {
    fontSize: 24,
    fontWeight: "800",
    color: "#10b981",
  },
  bonus: {
    fontSize: 13,
    fontWeight: "700",
    color: "#f59e0b",
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  infoText: {
    fontSize: 11,
    color: "#94a3b8",
    flex: 1,
  },
  footer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
});
