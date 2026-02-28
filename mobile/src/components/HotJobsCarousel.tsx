import { View, Text, FlatList, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import ViewerCount from "./ViewerCount";
import { colors, spacing, radius, typography } from "../constants/theme";
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
          <Ionicons name="location-outline" size={12} color={colors.text.secondary} />
          <Text style={styles.infoText} numberOfLines={1}>{job.address}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={12} color={colors.text.secondary} />
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
        <Ionicons name="flame" size={18} color={colors.accent.coral} />
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
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    marginBottom: spacing.sm,
  },
  headerText: {
    ...typography.heading3,
    color: colors.text.heading,
  },
  list: {
    paddingRight: spacing.md,
    gap: spacing.sm + 2,
  },
  card: {
    width: 200,
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent.coral,
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
    color: colors.status.success,
    letterSpacing: -0.5,
  },
  bonus: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.accent.amber,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.heading,
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  infoText: {
    ...typography.micro,
    color: colors.text.secondary,
    flex: 1,
  },
  footer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
  },
});
