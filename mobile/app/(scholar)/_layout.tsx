import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function ScholarLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0f1b2d" },
        headerTintColor: "#f8fafc",
        headerTitleStyle: { fontWeight: "700" },
        tabBarStyle: {
          backgroundColor: "#0f1b2d",
          borderTopColor: "#1e293b",
          borderTopWidth: 1,
          paddingBottom: 4,
          height: 60,
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
    </Tabs>
  );
}
