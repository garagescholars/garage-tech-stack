import { useEffect, useRef, useState, useMemo } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRecentClaims } from "../hooks/useJobs";
import { useActivityFeed } from "../hooks/useActivityFeed";

type BannerItem = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  borderColor: string;
  content: React.ReactNode;
};

const ICON_MAP: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  claim: { icon: "flash", color: "#f59e0b" },
  goal_met: { icon: "flag", color: "#10b981" },
  achievement: { icon: "trophy", color: "#8b5cf6" },
  milestone: { icon: "star", color: "#14b8a6" },
};

/**
 * Activity banner showing recent claims + activity feed items.
 * Auto-cycles through items every 4 seconds.
 */
export default function RecentClaimsBanner() {
  const { claims } = useRecentClaims();
  const { items: activityItems } = useActivityFeed(8);
  const [currentIndex, setCurrentIndex] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Merge claims and activity feed items into a unified list
  const bannerItems: BannerItem[] = useMemo(() => {
    const items: BannerItem[] = [];

    // Add recent claims
    for (const claim of claims.slice(0, 5)) {
      const firstName = (claim.scholarName || "Someone").split(" ")[0];
      items.push({
        id: `claim-${claim.id}`,
        icon: "flash",
        iconColor: "#f59e0b",
        borderColor: "#f59e0b30",
        content: (
          <Text style={styles.text} numberOfLines={1}>
            <Text style={styles.name}>{firstName}</Text> just claimed{" "}
            <Text style={styles.job}>{claim.jobTitle}</Text> —{" "}
            <Text style={styles.payout}>${claim.payout}</Text>
          </Text>
        ),
      });
    }

    // Add activity feed items
    for (const item of activityItems) {
      const mapping = ICON_MAP[item.type] || ICON_MAP.milestone;
      const firstName = (item.scholarName || "Someone").split(" ")[0];
      items.push({
        id: `activity-${item.id}`,
        icon: (item.icon as keyof typeof Ionicons.glyphMap) || mapping.icon,
        iconColor: item.accentColor || mapping.color,
        borderColor: (item.accentColor || mapping.color) + "30",
        content: (
          <Text style={styles.text} numberOfLines={1}>
            <Text style={styles.name}>{firstName}</Text>{" "}
            <Text style={[styles.activityMsg, { color: item.accentColor || mapping.color }]}>
              {item.message}
            </Text>
          </Text>
        ),
      });
    }

    return items;
  }, [claims, activityItems]);

  const bannerLengthRef = useRef(bannerItems.length);
  bannerLengthRef.current = bannerItems.length;

  useEffect(() => {
    if (bannerItems.length === 0) return;

    const interval = setInterval(() => {
      Animated.timing(slideAnim, {
        toValue: -1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        const len = bannerLengthRef.current;
        if (len > 0) {
          setCurrentIndex((prev) => (prev + 1) % len);
        }
        slideAnim.setValue(1);
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [bannerItems.length]);

  if (bannerItems.length === 0) return null;

  const current = bannerItems[currentIndex % bannerItems.length];
  if (!current) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { borderColor: current.borderColor },
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
      <Ionicons name={current.icon} size={16} color={current.iconColor} />
      {current.content}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a2332",
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
    color: "#8b9bb5",
  },
  name: {
    fontWeight: "700",
    color: "#f1f5f9",
  },
  job: {
    fontWeight: "600",
    color: "#cbd5e1",
  },
  payout: {
    fontWeight: "800",
    color: "#10b981",
  },
  activityMsg: {
    fontWeight: "600",
  },
});
