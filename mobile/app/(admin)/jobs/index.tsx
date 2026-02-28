import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../../src/lib/firebase";
import { COLLECTIONS } from "../../../src/constants/collections";
import JobCard from "../../../src/components/JobCard";
import type { ServiceJob } from "../../../src/types";

export default function AdminJobsScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.JOBS),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ServiceJob[];
      setJobs(items);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const statusCounts = jobs.reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] || 0) + 1;
    return acc;
  }, {});

  const filtered = jobs.filter((j) => {
    if (statusFilter && j.status !== statusFilter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return (
        j.title.toLowerCase().includes(s) ||
        j.address.toLowerCase().includes(s) ||
        (j.claimedByName || "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  const STATUS_FILTERS = [
    { key: null, label: "All" },
    { key: "APPROVED_FOR_POSTING", label: "Open" },
    { key: "UPCOMING", label: "Upcoming" },
    { key: "IN_PROGRESS", label: "Active" },
    { key: "REVIEW_PENDING", label: "Review" },
    { key: "COMPLETED", label: "Done" },
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color="#5a6a80" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search jobs..."
          placeholderTextColor="#5a6a80"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Status filter pills */}
      <FlatList
        horizontal
        data={STATUS_FILTERS}
        keyExtractor={(item) => item.key || "all"}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterPill,
              statusFilter === item.key && styles.filterPillActive,
            ]}
            onPress={() => setStatusFilter(item.key)}
          >
            <Text
              style={[
                styles.filterText,
                statusFilter === item.key && styles.filterTextActive,
              ]}
            >
              {item.label}
              {item.key && statusCounts[item.key]
                ? ` (${statusCounts[item.key]})`
                : item.key === null
                ? ` (${jobs.length})`
                : ""}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Create button */}
      <TouchableOpacity
        style={styles.createBtn}
        onPress={() => router.push("/(admin)/jobs/create" as any)}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.createText}>Create Job</Text>
      </TouchableOpacity>

      {/* Job list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <JobCard
            job={item}
            onPress={() => router.push(`/(admin)/jobs/${item.id}` as any)}
            showStatus
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No jobs found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1a" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a2332",
    margin: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a3545",
    gap: 8,
  },
  searchInput: { flex: 1, color: "#f1f5f9", fontSize: 15 },
  filterRow: { paddingHorizontal: 12, gap: 6, marginBottom: 8 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#1a2332",
    borderWidth: 1,
    borderColor: "#2a3545",
  },
  filterPillActive: { backgroundColor: "#14b8a6", borderColor: "#14b8a6" },
  filterText: { fontSize: 12, fontWeight: "700", color: "#8b9bb5" },
  filterTextActive: { color: "#fff" },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: "#14b8a6",
    borderRadius: 12,
    paddingVertical: 12,
  },
  createText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  list: { padding: 12, paddingTop: 0 },
  empty: { padding: 32, alignItems: "center" },
  emptyText: { color: "#5a6a80", fontSize: 16 },
});
