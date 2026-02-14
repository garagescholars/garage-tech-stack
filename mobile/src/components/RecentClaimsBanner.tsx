import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRecentClaims } from "../hooks/useJobs";

/**
 * Animated FOMO banner showing recent job claims.
 * Auto-cycles through recent claims every 5 seconds.
 */
export default function RecentClaimsBanner() {
  const { claims } = useRecentClaims();
  const [currentIndex, setCurrentIndex] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const recentClaims = claims.slice(0, 5);

  useEffect(() => {
    if (recentClaims.length === 0) return;

    const interval = setInterval(() => {
      // Slide out
      Animated.timing(slideAnim, {
        toValue: -1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex((prev) => (prev + 1) % recentClaims.length);
        slideAnim.setValue(1);
        // Slide in
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [recentClaims.length]);

  if (recentClaims.length === 0) return null;

  const claim = recentClaims[currentIndex % recentClaims.length];
  if (!claim) return null;

  const firstName = (claim.scholarName || "Someone").split(" ")[0];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: [-40, 0, 40],
              }),
            },
          ],
          opacity: slideAnim.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [0, 1, 0],
          }),
        },
      ]}
    >
      <Ionicons name="flash" size={16} color="#f59e0b" />
      <Text style={styles.text} numberOfLines={1}>
        <Text style={styles.name}>{firstName}</Text> just claimed{" "}
        <Text style={styles.job}>{claim.jobTitle}</Text> —{" "}
        <Text style={styles.payout}>${claim.payout}</Text>
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#f59e0b30",
    gap: 8,
    overflow: "hidden",
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: "#94a3b8",
  },
  name: {
    fontWeight: "700",
    color: "#f8fafc",
  },
  job: {
    fontWeight: "600",
    color: "#cbd5e1",
  },
  payout: {
    fontWeight: "800",
    color: "#10b981",
  },
});
