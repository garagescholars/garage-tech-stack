import { useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const CONFETTI_COUNT = 35;
const CONFETTI_COLORS = [
  "#14b8a6", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#3b82f6", "#ef4444", "#22d3ee",
];

type Props = {
  payout: number;
  jobTitle: string;
  onComplete: () => void;
};

// Pre-compute random values per confetti piece so they're stable across re-renders
const CONFETTI_SEEDS = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
  distance: 100 + ((i * 7 + 13) % 200),
  size: 6 + ((i * 11 + 3) % 8),
  isCircle: i % 3 === 0,
  rotateDir: i % 2 === 0 ? 1 : -1,
}));

function ConfettiPiece({ index }: { index: number }) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(0);

  const seed = CONFETTI_SEEDS[index];

  useEffect(() => {
    const angle = (index / CONFETTI_COUNT) * Math.PI * 2;
    const targetX = Math.cos(angle) * seed.distance;
    const targetY = Math.sin(angle) * seed.distance - 100; // bias upward

    opacity.value = withDelay(
      100 + index * 15,
      withSequence(
        withTiming(1, { duration: 100 }),
        withDelay(800, withTiming(0, { duration: 600 }))
      )
    );

    scale.value = withDelay(
      100 + index * 15,
      withSpring(1, { damping: 8, stiffness: 200 })
    );

    translateX.value = withDelay(
      100 + index * 15,
      withSpring(targetX, { damping: 12, stiffness: 80 })
    );

    translateY.value = withDelay(
      100 + index * 15,
      withSequence(
        withSpring(targetY, { damping: 12, stiffness: 80 }),
        withTiming(targetY + 300, { duration: 800, easing: Easing.in(Easing.quad) })
      )
    );

    rotate.value = withDelay(
      100 + index * 15,
      withTiming(360 * seed.rotateDir, { duration: 1500 })
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: seed.size,
          height: seed.isCircle ? seed.size : seed.size * 1.5,
          backgroundColor: color,
          borderRadius: seed.isCircle ? seed.size / 2 : 2,
        },
        style,
      ]}
    />
  );
}

export default function ClaimCelebration({ payout, jobTitle, onComplete }: Props) {
  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const payoutScale = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);

  const triggerComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const dismissTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Overlay fade in
    overlayOpacity.value = withTiming(1, { duration: 200 });

    // Checkmark springs in
    checkOpacity.value = withDelay(200, withTiming(1, { duration: 200 }));
    checkScale.value = withDelay(200, withSpring(1, { damping: 10, stiffness: 200 }));

    // Payout text
    payoutScale.value = withDelay(500, withSpring(1, { damping: 12, stiffness: 180 }));

    // Job title
    textOpacity.value = withDelay(700, withTiming(1, { duration: 300 }));

    // Auto-dismiss after 2.5s
    const timer = setTimeout(() => {
      overlayOpacity.value = withTiming(0, { duration: 300 });
      dismissTimer.current = setTimeout(triggerComplete, 350);
    }, 2500);

    return () => {
      clearTimeout(timer);
      clearTimeout(dismissTimer.current);
    };
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
  }));

  const payoutStyle = useAnimatedStyle(() => ({
    transform: [{ scale: payoutScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      {/* Confetti burst */}
      <View style={styles.confettiContainer}>
        {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
          <ConfettiPiece key={i} index={i} />
        ))}
      </View>

      {/* Center content */}
      <Animated.View style={[styles.checkContainer, checkStyle]}>
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark" size={48} color="#fff" />
        </View>
      </Animated.View>

      <Animated.Text style={[styles.payoutText, payoutStyle]}>
        ${Math.round(payout)} Claimed!
      </Animated.Text>

      <Animated.Text style={[styles.jobTitleText, textStyle]} numberOfLines={2}>
        {jobTitle}
      </Animated.Text>

      <Animated.Text style={[styles.subtitleText, textStyle]}>
        Added to your schedule
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 27, 45, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  confettiContainer: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.4,
    left: SCREEN_WIDTH / 2,
    width: 0,
    height: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  checkContainer: {
    marginBottom: 24,
  },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#10b981",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
  payoutText: {
    fontSize: 36,
    fontWeight: "800",
    color: "#10b981",
    marginBottom: 8,
  },
  jobTitleText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f8fafc",
    textAlign: "center",
    paddingHorizontal: 32,
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 14,
    color: "#94a3b8",
  },
});
