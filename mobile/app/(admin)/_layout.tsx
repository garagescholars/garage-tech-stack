import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function AdminLayout() {
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
          headerTitle: "All Jobs",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scholars/index"
        options={{
          title: "Scholars",
          headerTitle: "Scholar Management",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="transfers"
        options={{
          title: "Transfers",
          headerTitle: "Transfers & Reschedules",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="swap-horizontal-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          headerTitle: "Analytics",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Hide non-tab screens */}
      <Tabs.Screen name="jobs/create" options={{ href: null, headerTitle: "Create Job" }} />
      <Tabs.Screen name="jobs/[id]" options={{ href: null, headerTitle: "Job Details" }} />
      <Tabs.Screen name="scholars/[id]" options={{ href: null, headerTitle: "Scholar Details" }} />
    </Tabs>
  );
}
