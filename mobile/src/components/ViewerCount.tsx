import { useEffect, useRef } from "react";
import { Text, StyleSheet, Animated } from "react-native";

type Props = {
  count: number;
  floor?: number;
};

export default function ViewerCount({ count, floor = 0 }: Props) {
  const displayCount = Math.max(count || 0, floor);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (displayCount > 5) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [displayCount]);

  if (displayCount <= 0) return null;

  return (
    <Animated.Text
      style={[
        styles.text,
        displayCount > 5 && { transform: [{ scale: pulseAnim }] },
      ]}
    >
      {displayCount} scholar{displayCount !== 1 ? "s" : ""} viewing
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 12,
    color: "#f59e0b",
    fontWeight: "600",
  },
});
