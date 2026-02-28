import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../src/lib/firebase";
import { COLLECTIONS } from "../../src/constants/collections";
import { useResponsive } from "../../src/lib/responsive";
import AdminPageWrapper from "../../src/components/AdminPageWrapper";
import type {
  GsJob,
  InventoryItem,
  Client,
  Property,
} from "../../src/types";

// ── View Tabs ──

type ActiveView = "overview" | "jobs" | "inventory";

// ── Status badge helpers ──

function jobStatusColor(status: string): { bg: string; text: string } {
  switch (status) {
    case "COMPLETED":
      return { bg: "#064e3b", text: "#34d399" };
    case "REVIEW_PENDING":
      return { bg: "#78350f", text: "#fbbf24" };
    case "IN_PROGRESS":
      return { bg: "#1e3a5f", text: "#60a5fa" };
    case "CANCELLED":
      return { bg: "#4c0519", text: "#fb7185" };
    case "UPCOMING":
      return { bg: "#312e81", text: "#a5b4fc" };
    default:
      return { bg: "#2a3545", text: "#8b9bb5" };
  }
}

function inventoryStatusColor(status: string): { bg: string; text: string } {
  switch (status) {
    case "Active":
      return { bg: "#064e3b", text: "#34d399" };
    case "Pending":
      return { bg: "#78350f", text: "#fbbf24" };
    case "Sold":
      return { bg: "#1e3a5f", text: "#60a5fa" };
    case "Removed":
      return { bg: "#4c0519", text: "#fb7185" };
    default:
      return { bg: "#2a3545", text: "#8b9bb5" };
  }
}

function formatDate(raw?: string): string {
  if (!raw) return "--";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return raw;
  }
}

function formatCurrency(value: number): string {
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── Skeleton placeholder ──

function SkeletonBlock({ width, height = 14 }: { width: number | string; height?: number }) {
  return (
    <View
      style={{
        width: width as any,
        height,
        borderRadius: 6,
        backgroundColor: "#1a2332",
      }}
    />
  );
}

function SkeletonCard() {
  return (
    <View style={[metricStyles.card, { gap: 10 }]}>
      <SkeletonBlock width="60%" height={12} />
      <SkeletonBlock width="40%" height={28} />
      <SkeletonBlock width="50%" height={10} />
    </View>
  );
}

function SkeletonRow() {
  return (
    <View style={[listStyles.row, { gap: 8 }]}>
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonBlock width="70%" height={14} />
        <SkeletonBlock width="50%" height={10} />
      </View>
      <SkeletonBlock width={60} height={20} />
    </View>
  );
}

// ── Main Screen ──

export default function UnifiedDashboardScreen() {
  const { isMobile, isDesktop } = useResponsive();

  // Data
  const [serviceJobs, setServiceJobs] = useState<GsJob[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("overview");

  // Real-time listeners
  useEffect(() => {
    if (!db) {
      setError("Firestore not initialized.");
      setLoading(false);
      return;
    }

    const unsubscribers: (() => void)[] = [];
    let loadedCount = 0;
    const TOTAL_LISTENERS = 4;

    const markLoaded = () => {
      loadedCount += 1;
      if (loadedCount >= TOTAL_LISTENERS) setLoading(false);
    };

    try {
      // 1. Service Jobs
      const jobsQuery = query(
        collection(db, COLLECTIONS.JOBS),
        orderBy("scheduledDate", "desc"),
        limit(20),
      );
      const unsubJobs = onSnapshot(
        jobsQuery,
        (snapshot) => {
          const jobs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<GsJob, "id">),
          }));
          setServiceJobs(jobs);
          markLoaded();
        },
        (err) => {
          console.error("Jobs subscription error:", err);
          setError(err.message);
          markLoaded();
        },
      );
      unsubscribers.push(unsubJobs);

      // 2. Inventory
      const inventoryQuery = query(
        collection(db, COLLECTIONS.INVENTORY),
        orderBy("lastUpdated", "desc"),
        limit(20),
      );
      const unsubInventory = onSnapshot(
        inventoryQuery,
        (snapshot) => {
          const items = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<InventoryItem, "id">),
          }));
          setInventory(items);
          markLoaded();
        },
        (err) => {
          console.error("Inventory subscription error:", err);
          markLoaded();
        },
      );
      unsubscribers.push(unsubInventory);

      // 3. Clients
      const clientsQuery = query(collection(db, COLLECTIONS.CLIENTS));
      const unsubClients = onSnapshot(
        clientsQuery,
        (snapshot) => {
          const list = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<Client, "id">),
          }));
          setClients(list);
          markLoaded();
        },
        (err) => {
          console.error("Clients subscription error:", err);
          markLoaded();
        },
      );
      unsubscribers.push(unsubClients);

      // 4. Properties
      const propertiesQuery = query(collection(db, COLLECTIONS.PROPERTIES));
      const unsubProperties = onSnapshot(
        propertiesQuery,
        (snapshot) => {
          const list = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<Property, "id">),
          }));
          setProperties(list);
          markLoaded();
        },
        (err) => {
          console.error("Properties subscription error:", err);
          markLoaded();
        },
      );
      unsubscribers.push(unsubProperties);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load data.";
      setError(message);
      setLoading(false);
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);

  // ── Derived metrics ──

  const totalRevenue = clients.reduce(
    (sum, c) => sum + (c.stats?.totalRevenue || 0),
    0,
  );
  const activeInventoryCount = inventory.filter(
    (i) => i.status === "Active",
  ).length;
  const pendingJobs = serviceJobs.filter(
    (j) => j.status === "REVIEW_PENDING",
  ).length;

  // ── Renderers ──

  const renderJobRow = useCallback(
    ({ item }: { item: GsJob }) => {
      const colors = jobStatusColor(item.status);
      return (
        <View style={listStyles.row}>
          <View style={{ flex: 1 }}>
            <Text style={listStyles.primary} numberOfLines={1}>
              {item.clientName || "Unknown Client"}
            </Text>
            <Text style={listStyles.secondary} numberOfLines={1}>
              {item.address}
            </Text>
            <Text style={listStyles.tertiary}>
              {formatDate(item.scheduledDate)}
            </Text>
          </View>
          {!isMobile && (
            <Text style={listStyles.payout}>
              {formatCurrency(item.payout || 0)}
            </Text>
          )}
          <View style={[listStyles.badge, { backgroundColor: colors.bg }]}>
            <Text style={[listStyles.badgeText, { color: colors.text }]}>
              {item.status}
            </Text>
          </View>
        </View>
      );
    },
    [isMobile],
  );

  const renderInventoryRow = useCallback(
    ({ item }: { item: InventoryItem }) => {
      const colors = inventoryStatusColor(item.status);
      return (
        <View style={listStyles.row}>
          <View style={{ flex: 1 }}>
            <Text style={listStyles.primary} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={listStyles.secondary} numberOfLines={1}>
              {item.platform}
            </Text>
            {item.clientName ? (
              <Text style={listStyles.tertiary}>{item.clientName}</Text>
            ) : null}
          </View>
          <Text style={listStyles.payout}>
            {formatCurrency(item.price || 0)}
          </Text>
          <View style={[listStyles.badge, { backgroundColor: colors.bg }]}>
            <Text style={[listStyles.badgeText, { color: colors.text }]}>
              {item.status}
            </Text>
          </View>
        </View>
      );
    },
    [],
  );

  const jobKeyExtractor = useCallback((item: GsJob) => item.id, []);
  const inventoryKeyExtractor = useCallback(
    (item: InventoryItem) => item.id,
    [],
  );

  // ── Loading state ──

  if (loading) {
    return (
      <AdminPageWrapper>
        <Text style={styles.title}>Business Dashboard</Text>
        <Text style={styles.subtitle}>Loading business data...</Text>

        {/* Skeleton metric cards */}
        <View
          style={[
            styles.metricsGrid,
            isDesktop && styles.metricsGridDesktop,
          ]}
        >
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>

        {/* Skeleton rows */}
        <View style={styles.card}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>

        <View style={{ alignItems: "center", marginTop: 24 }}>
          <ActivityIndicator size="large" color="#14b8a6" />
        </View>
      </AdminPageWrapper>
    );
  }

  // ── Error state ──

  if (error) {
    return (
      <AdminPageWrapper>
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle" size={22} color="#fb7185" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </AdminPageWrapper>
    );
  }

  // ── Main render ──

  return (
    <AdminPageWrapper>
      {/* Header */}
      <Text style={styles.title}>Business Dashboard</Text>
      <Text style={styles.subtitle}>
        Phase X: Complete business overview
      </Text>

      {/* Metric cards */}
      <View
        style={[styles.metricsGrid, isDesktop && styles.metricsGridDesktop]}
      >
        <MetricCard
          title="Total Clients"
          value={clients.length}
          icon="people"
          iconColor="#3b82f6"
          subtitle={`${properties.length} properties`}
        />
        <MetricCard
          title="Service Jobs"
          value={serviceJobs.length}
          icon="briefcase"
          iconColor="#a855f7"
          subtitle={`${pendingJobs} pending review`}
          highlight={pendingJobs > 0}
        />
        <MetricCard
          title="Active Inventory"
          value={activeInventoryCount}
          icon="cube"
          iconColor="#10b981"
          subtitle={`${inventory.length} total items`}
        />
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          icon="cash"
          iconColor="#f59e0b"
          subtitle="All-time sales"
        />
      </View>

      {/* View tabs */}
      <View style={styles.tabBar}>
        <TabButton
          label="Overview"
          icon="bar-chart"
          active={activeView === "overview"}
          onPress={() => setActiveView("overview")}
        />
        <TabButton
          label="Jobs"
          icon="briefcase"
          active={activeView === "jobs"}
          onPress={() => setActiveView("jobs")}
        />
        <TabButton
          label="Inventory"
          icon="cube"
          active={activeView === "inventory"}
          onPress={() => setActiveView("inventory")}
        />
      </View>

      {/* ── Overview ── */}
      {activeView === "overview" && (
        <View
          style={[
            styles.overviewGrid,
            isDesktop && styles.overviewGridDesktop,
          ]}
        >
          {/* Recent Jobs */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Recent Service Jobs</Text>
              <TouchableOpacity onPress={() => setActiveView("jobs")}>
                <View style={styles.viewAllRow}>
                  <Text style={styles.viewAllText}>View All</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={12}
                    color="#3b82f6"
                  />
                </View>
              </TouchableOpacity>
            </View>
            {serviceJobs.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons
                  name="briefcase-outline"
                  size={32}
                  color="#2a3545"
                />
                <Text style={styles.emptyText}>No jobs yet</Text>
              </View>
            ) : (
              <FlatList
                data={serviceJobs.slice(0, 5)}
                keyExtractor={jobKeyExtractor}
                renderItem={renderJobRow}
                scrollEnabled={false}
              />
            )}
          </View>

          {/* Recent Inventory */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Recent Inventory</Text>
              <TouchableOpacity
                onPress={() => setActiveView("inventory")}
              >
                <View style={styles.viewAllRow}>
                  <Text style={[styles.viewAllText, { color: "#10b981" }]}>
                    View All
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={12}
                    color="#10b981"
                  />
                </View>
              </TouchableOpacity>
            </View>
            {inventory.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="cube-outline" size={32} color="#2a3545" />
                <Text style={styles.emptyText}>No inventory items</Text>
              </View>
            ) : (
              <FlatList
                data={inventory.slice(0, 5)}
                keyExtractor={inventoryKeyExtractor}
                renderItem={renderInventoryRow}
                scrollEnabled={false}
              />
            )}
          </View>
        </View>
      )}

      {/* ── Jobs View ── */}
      {activeView === "jobs" && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              All Service Jobs ({serviceJobs.length})
            </Text>
          </View>
          {serviceJobs.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons
                name="briefcase-outline"
                size={32}
                color="#2a3545"
              />
              <Text style={styles.emptyText}>No jobs found</Text>
            </View>
          ) : (
            <FlatList
              data={serviceJobs}
              keyExtractor={jobKeyExtractor}
              renderItem={renderJobRow}
              scrollEnabled={false}
            />
          )}
        </View>
      )}

      {/* ── Inventory View ── */}
      {activeView === "inventory" && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              All Inventory ({inventory.length})
            </Text>
          </View>
          {inventory.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="cube-outline" size={32} color="#2a3545" />
              <Text style={styles.emptyText}>No inventory items</Text>
            </View>
          ) : (
            <FlatList
              data={inventory}
              keyExtractor={inventoryKeyExtractor}
              renderItem={renderInventoryRow}
              scrollEnabled={false}
            />
          )}
        </View>
      )}
    </AdminPageWrapper>
  );
}

// ── MetricCard ──

function MetricCard({
  title,
  value,
  icon,
  iconColor,
  subtitle,
  highlight,
}: {
  title: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  subtitle?: string;
  highlight?: boolean;
}) {
  return (
    <View
      style={[
        metricStyles.card,
        highlight && metricStyles.cardHighlight,
      ]}
    >
      <View style={metricStyles.headerRow}>
        <Text style={metricStyles.label}>{title}</Text>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={metricStyles.value}>{value}</Text>
      {subtitle ? (
        <Text style={metricStyles.subtitle}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

// ── TabButton ──

function TabButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[tabStyles.button, active && tabStyles.buttonActive]}
    >
      <Ionicons
        name={icon}
        size={15}
        color={active ? "#f1f5f9" : "#8b9bb5"}
      />
      <Text style={[tabStyles.label, active && tabStyles.labelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#f1f5f9",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: "#5a6a80",
    marginBottom: 20,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  metricsGridDesktop: {
    flexWrap: "nowrap",
  },
  overviewGrid: {
    gap: 16,
  },
  overviewGridDesktop: {
    flexDirection: "row",
  },
  card: {
    flex: 1,
    backgroundColor: "#1a2332",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#2a3545",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#f1f5f9",
  },
  viewAllRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3b82f6",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 4,
    gap: 4,
    marginBottom: 16,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: "#5a6a80",
    fontWeight: "600",
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#4c0519",
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  errorText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fda4af",
    flex: 1,
  },
});

const metricStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    backgroundColor: "#1a2332",
    borderRadius: 14,
    padding: 16,
    gap: 4,
  },
  cardHighlight: {
    borderWidth: 1,
    borderColor: "#fbbf2450",
    backgroundColor: "#1a2332cc",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8b9bb5",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 26,
    fontWeight: "800",
    color: "#f1f5f9",
  },
  subtitle: {
    fontSize: 11,
    color: "#5a6a80",
    fontWeight: "600",
  },
});

const tabStyles = StyleSheet.create({
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonActive: {
    backgroundColor: "#0a0f1a",
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8b9bb5",
  },
  labelActive: {
    color: "#f1f5f9",
  },
});

const listStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2a3545",
    gap: 10,
  },
  primary: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f1f5f9",
  },
  secondary: {
    fontSize: 12,
    color: "#8b9bb5",
    marginTop: 2,
  },
  tertiary: {
    fontSize: 11,
    color: "#5a6a80",
    marginTop: 2,
  },
  payout: {
    fontSize: 14,
    fontWeight: "800",
    color: "#10b981",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
