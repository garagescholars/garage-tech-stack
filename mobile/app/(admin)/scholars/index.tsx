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
import ScoreStars from "../../../src/components/ScoreStars";
import { getTierLabel, getTierColor } from "../../../src/constants/scoring";
import type { ScholarTier } from "../../../src/types";

type Scholar = {
  uid: string;
  name: string;
  scholarName: string;
  phoneNumber: string;
  email: string;
  isActive: boolean;
  tier: ScholarTier;
  payScore: number;
  totalJobsCompleted: number;
  totalEarnings: number;
};

export default function ScholarsScreen() {
  const router = useRouter();
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.SCHOLAR_PROFILES),
      orderBy("scholarName", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          name: (data.scholarName as string) || (data.name as string) || "Scholar",
          scholarName: (data.scholarName as string) || "",
          phoneNumber: (data.phoneNumber as string) || "",
          email: (data.email as string) || "",
          isActive: data.isActive !== false,
          tier: (data.tier as ScholarTier) || "new",
          payScore: (data.payScore as number) || 0,
          totalJobsCompleted: (data.totalJobsCompleted as number) || 0,
          totalEarnings: (data.totalEarnings as number) || 0,
        };
      });
      setScholars(items);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filtered = search.trim()
    ? scholars.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.scholarName.toLowerCase().includes(search.toLowerCase()) ||
          s.email.toLowerCase().includes(search.toLowerCase()) ||
          s.phoneNumber.includes(search)
      )
    : scholars;

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
        <Ionicons name="search" size={18} color="#5a6a80" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search scholars..."
          placeholderTextColor="#5a6a80"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNum}>{scholars.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNum}>
            {scholars.filter((s) => s.isActive).length}
          </Text>
          <Text style={styles.summaryLabel}>Active</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNum}>
            {scholars.filter((s) => s.tier === "elite" || s.tier === "top_hustler").length}
          </Text>
          <Text style={styles.summaryLabel}>Elite+</Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => {
          const tierColor = getTierColor(item.tier);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(admin)/scholars/${item.uid}` as any)}
            >
              <View style={styles.cardTop}>
                <View style={[styles.avatar, { borderColor: tierColor }]}>
                  <Ionicons name="person" size={20} color={tierColor} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.contact}>
                    {item.phoneNumber || item.email}
                  </Text>
                </View>
                <View style={[styles.tierBadge, { backgroundColor: tierColor + "20" }]}>
                  <Text style={[styles.tierText, { color: tierColor }]}>
                    {getTierLabel(item.tier)}
                  </Text>
                </View>
              </View>
              <View style={styles.cardBottom}>
                <ScoreStars score={item.payScore} size="small" />
                <Text style={styles.stat}>{item.totalJobsCompleted} jobs</Text>
                <Text style={styles.stat}>
                  ${item.totalEarnings.toLocaleString()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No scholars found</Text>
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
  summaryRow: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#1a2332",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  summaryNum: { fontSize: 22, fontWeight: "800", color: "#14b8a6" },
  summaryLabel: { fontSize: 11, color: "#5a6a80", fontWeight: "600" },
  list: { padding: 12, paddingTop: 0 },
  card: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0a0f1a",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  cardInfo: { flex: 1 },
  name: { fontSize: 15, fontWeight: "700", color: "#f1f5f9" },
  contact: { fontSize: 12, color: "#5a6a80" },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tierText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#2a3545",
    paddingTop: 8,
  },
  stat: { fontSize: 12, color: "#8b9bb5", fontWeight: "600" },
  empty: { padding: 32, alignItems: "center" },
  emptyText: { color: "#5a6a80", fontSize: 16 },
});
