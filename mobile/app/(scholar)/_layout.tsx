import { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, View, ActivityIndicator } from "react-native";
import { useAuth } from "../../src/hooks/useAuth";
import { useAchievementUnlock } from "../../src/hooks/useAchievementUnlock";
import AchievementUnlockOverlay from "../../src/components/AchievementUnlockOverlay";

export default function ScholarLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { newAchievement, dismiss } = useAchievementUnlock(user?.uid);

  // Auth guard: redirect to login if not authenticated
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/(auth)/email-login");
    }
  }, [user, loading]);

  if (loading || !user) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f1b2d" }}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: "#0f1b2d" },
          headerTintColor: "#f8fafc",
          headerTitleStyle: { fontWeight: "700" },
          tabBarStyle: {
            backgroundColor: "#0f1b2d",
            borderTopColor: "#1e293b",
            borderTopWidth: 1,
            paddingBottom: Platform.OS === "ios" ? 20 : 4,
            height: Platform.OS === "ios" ? 80 : 60,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 8,
          },
          tabBarActiveTintColor: "#14b8a6",
          tabBarInactiveTintColor: "#64748b",
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="jobs/index"
          options={{
            title: "Jobs",
            headerTitle: "Available Jobs",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="briefcase-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="my-jobs/index"
          options={{
            title: "My Jobs",
            headerTitle: "My Jobs",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="goals/index"
          options={{
            title: "Goals",
            headerTitle: "Goals & Leaderboard",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="trophy-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile/index"
          options={{
            title: "Profile",
            headerTitle: "My Profile",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        />
        {/* Hide non-tab screens from tab bar */}
        <Tabs.Screen name="jobs/[id]" options={{ href: null, headerTitle: "Job Details" }} />
        <Tabs.Screen name="my-jobs/[id]/checkin" options={{ href: null, headerTitle: "Check In" }} />
        <Tabs.Screen name="my-jobs/[id]/checkout" options={{ href: null, headerTitle: "Check Out" }} />
        <Tabs.Screen name="my-jobs/[id]/transfer" options={{ href: null, headerTitle: "Transfer Job" }} />
        <Tabs.Screen name="my-jobs/[id]/reschedule" options={{ href: null, headerTitle: "Reschedule Job" }} />
        <Tabs.Screen name="goals/set-goal" options={{ href: null, headerTitle: "Set Goal" }} />
        <Tabs.Screen name="profile/score-history" options={{ href: null, headerTitle: "Score History" }} />
        <Tabs.Screen name="profile/payments" options={{ href: null, headerTitle: "Payment History" }} />
        <Tabs.Screen name="profile/payment-setup" options={{ href: null, headerTitle: "Bank Setup" }} />
        <Tabs.Screen name="my-jobs/[id]/escalate" options={{ href: null, headerTitle: "Report Issue" }} />
        <Tabs.Screen name="my-jobs/[id]/escalations" options={{ href: null, headerTitle: "Escalations" }} />
        <Tabs.Screen name="my-jobs/[id]/prep" options={{ href: null, headerTitle: "Video Homework" }} />
      </Tabs>

      {/* Achievement unlock overlay — renders above everything */}
      {newAchievement && (
        <AchievementUnlockOverlay
          achievement={newAchievement}
          onDismiss={dismiss}
        />
      )}
    </View>
  );
}
