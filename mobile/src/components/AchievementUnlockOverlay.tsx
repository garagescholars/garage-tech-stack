import { useEffect, useRef, useCallback } from "react";
import { StyleSheet, Text, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import type { ScholarAchievement } from "../types";

// Same icon map as AchievementBadge
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

type Props = {
  achievement: ScholarAchievement;
  onDismiss: () => void;
};

export default function AchievementUnlockOverlay({ achievement, onDismiss }: Props) {
  const overlayOpacity = useSharedValue(0);
  const badgeScale = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);

  const mapping = ICON_MAP[achievement.achievementType] || {
    icon: "ribbon" as keyof typeof Ionicons.glyphMap,
    color: "#14b8a6",
  };

  const dismissTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const handleDismiss = useCallback(() => {
    onDismissRef.current();
  }, []);

  useEffect(() => {
    overlayOpacity.value = withTiming(1, { duration: 300 });

    badgeScale.value = withDelay(
      200,
      withSequence(
        withSpring(1.2, { damping: 8, stiffness: 180 }),
        withSpring(1, { damping: 12, stiffness: 200 })
      )
    );

    titleOpacity.value = withDelay(500, withTiming(1, { duration: 300 }));
    subtitleOpacity.value = withDelay(700, withTiming(1, { duration: 300 }));

    // Auto-dismiss after 3.5s
    const timer = setTimeout(() => {
      overlayOpacity.value = withTiming(0, { duration: 300 });
      dismissTimer.current = setTimeout(handleDismiss, 350);
    }, 3500);

    return () => {
      clearTimeout(timer);
      clearTimeout(dismissTimer.current);
    };
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <Pressable style={styles.pressArea} onPress={onDismiss}>
        <Animated.View
          style={[
            styles.badgeCircle,
            { backgroundColor: mapping.color + "20", borderColor: mapping.color },
            badgeStyle,
          ]}
        >
          <Ionicons name={mapping.icon} size={56} color={mapping.color} />
        </Animated.View>

        <Animated.Text style={[styles.unlockTitle, titleStyle]}>
          Achievement Unlocked!
        </Animated.Text>

        <Animated.Text style={[styles.achievementName, { color: mapping.color }, titleStyle]}>
          {achievement.title}
        </Animated.Text>

        {achievement.description && (
          <Animated.Text style={[styles.description, subtitleStyle]}>
            {achievement.description}
          </Animated.Text>
        )}

        <Animated.Text style={[styles.tapHint, subtitleStyle]}>
          Tap to dismiss
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 27, 45, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 200,
  },
  pressArea: {
    alignItems: "center",
    padding: 32,
  },
  badgeCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  unlockTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
  },
  achievementName: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  description: {
    fontSize: 15,
    color: "#cbd5e1",
    textAlign: "center",
    marginBottom: 24,
  },
  tapHint: {
    fontSize: 12,
    color: "#475569",
  },
});
