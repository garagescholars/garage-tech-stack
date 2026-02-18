import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  count: number;
  floor?: number;
};

export default function ViewerCount({ count, floor = 0 }: Props) {
  const displayCount = Math.max(count || 0, floor);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isHot = displayCount >= 7;
  const isMedium = displayCount >= 4;

  useEffect(() => {
    if (displayCount > 3) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: isHot ? 1.2 : 1.15,
            duration: isHot ? 400 : 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: isHot ? 400 : 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [displayCount, isHot]);

  if (displayCount <= 0) return null;

  const color = isHot ? "#ef4444" : isMedium ? "#f59e0b" : "#64748b";
  const icon: keyof typeof Ionicons.glyphMap = isHot ? "flame" : "eye";

  return (
    <Animated.View
      style={[
        styles.container,
        displayCount > 3 && { transform: [{ scale: pulseAnim }] },
      ]}
    >
      <Ionicons name={icon} size={isHot ? 14 : 12} color={color} />
      {isHot && <Text style={[styles.hotLabel, { color }]}>HOT</Text>}
      <Text style={[styles.text, { color }]}>
        {displayCount} viewing
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
  },
  hotLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
