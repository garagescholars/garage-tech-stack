import { Tabs, useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Platform,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
} from "react-native";

const SIDEBAR_WIDTH = 240;

type NavItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Jobs", icon: "briefcase-outline", path: "/(admin)/jobs" },
  { label: "Scholars", icon: "people-outline", path: "/(admin)/scholars" },
  { label: "Dashboard", icon: "grid-outline", path: "/(admin)/dashboard" },
  { label: "Leads & SOPs", icon: "document-text-outline", path: "/(admin)/leads" },
  { label: "Payouts", icon: "cash-outline", path: "/(admin)/payouts" },
  { label: "Transfers", icon: "swap-horizontal-outline", path: "/(admin)/transfers" },
  { label: "Analytics", icon: "stats-chart-outline", path: "/(admin)/analytics" },
  { label: "Settings", icon: "settings-outline", path: "/(admin)/settings" },
];

function WebSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={sidebarStyles.container}>
      <View style={sidebarStyles.header}>
        <Ionicons name="construct" size={24} color="#14b8a6" />
        <Text style={sidebarStyles.headerText}>Garage Scholars</Text>
      </View>
      <ScrollView style={sidebarStyles.nav}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.path.replace("/(admin)", ""));
          return (
            <TouchableOpacity
              key={item.path}
              style={[sidebarStyles.navItem, isActive && sidebarStyles.navItemActive]}
              onPress={() => router.push(item.path as any)}
            >
              <Ionicons
                name={item.icon}
                size={18}
                color={isActive ? "#14b8a6" : "#94a3b8"}
              />
              <Text
                style={[sidebarStyles.navLabel, isActive && sidebarStyles.navLabelActive]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function AdminLayout() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 1024;

  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      {isDesktopWeb && <WebSidebar />}
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerStyle: { backgroundColor: "#0f1b2d" },
            headerTintColor: "#f8fafc",
            headerTitleStyle: { fontWeight: "700" },
            tabBarStyle: isDesktopWeb
              ? { display: "none" }
              : {
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
          <Tabs.Screen
            name="more"
            options={{
              title: "More",
              headerTitle: "More",
              href: isDesktopWeb ? null : undefined,
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="ellipsis-horizontal" size={size} color={color} />
              ),
            }}
          />
          {/* Hide non-tab screens */}
          <Tabs.Screen name="jobs/create" options={{ href: null, headerTitle: "Create Job" }} />
          <Tabs.Screen name="jobs/[id]" options={{ href: null, headerTitle: "Job Details" }} />
          <Tabs.Screen name="scholars/[id]" options={{ href: null, headerTitle: "Scholar Details" }} />
          <Tabs.Screen name="dashboard" options={{ href: null, headerTitle: "Dashboard" }} />
          <Tabs.Screen name="leads" options={{ href: null, headerTitle: "Leads & SOPs" }} />
          <Tabs.Screen name="payouts" options={{ href: null, headerTitle: "Payouts" }} />
          <Tabs.Screen name="settings" options={{ href: null, headerTitle: "Settings" }} />
          <Tabs.Screen name="unified" options={{ href: null, headerTitle: "Business Dashboard" }} />
        </Tabs>
      </View>
    </View>
  );
}

const sidebarStyles = StyleSheet.create({
  container: {
    width: SIDEBAR_WIDTH,
    backgroundColor: "#0f1b2d",
    borderRightWidth: 1,
    borderRightColor: "#1e293b",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  headerText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f8fafc",
  },
  nav: {
    flex: 1,
    paddingTop: 8,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: "#14b8a610",
  },
  navLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94a3b8",
  },
  navLabelActive: {
    color: "#14b8a6",
    fontWeight: "700",
  },
});
