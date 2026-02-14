import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useOpenJobs } from "../../../src/hooks/useJobs";
import JobCard from "../../../src/components/JobCard";
import RecentClaimsBanner from "../../../src/components/RecentClaimsBanner";

export default function JobFeedScreen() {
  const { jobs, loading } = useOpenJobs();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const filtered = search.trim()
    ? jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(search.toLowerCase()) ||
          j.address.toLowerCase().includes(search.toLowerCase())
      )
    : jobs;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Firestore onSnapshot auto-updates; just simulate refresh
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color="#64748b" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search jobs..."
          placeholderTextColor="#64748b"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="briefcase-outline" size={48} color="#334155" />
          <Text style={styles.emptyText}>
            {search ? "No matching jobs" : "No open jobs right now"}
          </Text>
          <Text style={styles.emptySubtext}>
            {search
              ? "Try a different search"
              : "Check back soon — new jobs post daily"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={<RecentClaimsBanner />}
          renderItem={({ item }) => (
            <JobCard
              job={item}
              onPress={() =>
                router.push(`/(scholar)/jobs/${item.id}` as any)
              }
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#14b8a6"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f1b2d",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    margin: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 15,
  },
  list: {
    padding: 12,
    paddingTop: 8,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f8fafc",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 6,
    textAlign: "center",
  },
});
