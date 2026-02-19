import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type MenuItem = {
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: string;
};

const MENU_ITEMS: MenuItem[] = [
  {
    label: "Dashboard",
    subtitle: "Approvals, job review, notifications",
    icon: "grid-outline",
    path: "/(admin)/dashboard",
  },
  {
    label: "Leads & SOPs",
    subtitle: "Lead management, SOP generation",
    icon: "document-text-outline",
    path: "/(admin)/leads",
  },
  {
    label: "Payouts",
    subtitle: "Track and manage payments",
    icon: "cash-outline",
    path: "/(admin)/payouts",
  },
  {
    label: "Social Media",
    subtitle: "Monitor automated posts, retry failures",
    icon: "megaphone-outline",
    path: "/(admin)/social-media",
  },
  {
    label: "Share App",
    subtitle: "QR code for scholars to download",
    icon: "qr-code-outline",
    path: "/(admin)/share-app",
  },
  {
    label: "Settings",
    subtitle: "Create users, manage accounts",
    icon: "settings-outline",
    path: "/(admin)/settings",
  },
  {
    label: "Business Dashboard",
    subtitle: "Unified overview of all operations",
    icon: "bar-chart-outline",
    path: "/(admin)/unified",
  },
];

export default function MoreScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.heading}>Admin Tools</Text>
      {MENU_ITEMS.map((item) => (
        <TouchableOpacity
          key={item.path}
          style={styles.menuItem}
          onPress={() => router.push(item.path as any)}
          activeOpacity={0.7}
        >
          <View style={styles.iconWrap}>
            <Ionicons name={item.icon} size={22} color="#14b8a6" />
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#64748b" />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1b2d" },
  scroll: { padding: 16, paddingBottom: 40 },
  heading: {
    fontSize: 14,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    gap: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#14b8a610",
    justifyContent: "center",
    alignItems: "center",
  },
  textWrap: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: "700", color: "#f8fafc" },
  menuSubtitle: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
});
