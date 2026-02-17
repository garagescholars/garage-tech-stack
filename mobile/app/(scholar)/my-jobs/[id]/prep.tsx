import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../../../src/lib/firebase";
import { COLLECTIONS } from "../../../../src/constants/collections";
import { useAuth } from "../../../../src/hooks/useAuth";
import { useJobPrep } from "../../../../src/hooks/useJobPrep";
import {
  GYM_EQUIPMENT_CATALOG,
  MANUFACTURER_SUPPORT,
} from "../../../../src/constants/productCatalog";

export default function PrepScreen() {
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { prep, loading, allConfirmed, confirmedCount, totalCount } = useJobPrep(
    jobId,
    user?.uid,
  );
  const [confirming, setConfirming] = useState<string | null>(null);

  const handleConfirm = useCallback(
    async (equipmentId: string) => {
      if (!prep || !user) return;

      setConfirming(equipmentId);
      try {
        const docId = `${jobId}_${user.uid}`;
        const updatedConfirmations = prep.videoConfirmations.map((v) =>
          v.equipmentId === equipmentId
            ? { ...v, confirmedAt: Timestamp.now() }
            : v,
        );

        const allDone = updatedConfirmations.every((v) => v.confirmedAt !== null);

        await updateDoc(doc(db, COLLECTIONS.JOB_PREP, docId), {
          videoConfirmations: updatedConfirmations,
          allConfirmed: allDone,
          updatedAt: serverTimestamp(),
        });

        if (allDone) {
          Alert.alert(
            "All Videos Confirmed!",
            "You're ready to check in. Good luck on the job!",
            [{ text: "OK" }],
          );
        }
      } catch (err: any) {
        Alert.alert("Error", err.message || "Failed to confirm.");
      } finally {
        setConfirming(null);
      }
    },
    [prep, user, jobId],
  );

  const handleWatchVideo = (url: string) => {
    if (!url || url === "N/A") {
      Alert.alert("No Manual Available", "This item has no assembly manual. Check the included instructions.");
      return;
    }
    Linking.openURL(url).catch(() =>
      Alert.alert("Error", "Could not open the manual link."),
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  if (!prep) {
    return (
      <View style={styles.center}>
        <Ionicons name="checkmark-circle" size={48} color="#10b981" />
        <Text style={styles.emptyText}>No video homework required for this job</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progressPercent = totalCount > 0 ? (confirmedCount / totalCount) * 100 : 100;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Progress header */}
      <View style={styles.progressCard}>
        <Text style={styles.progressTitle}>
          {allConfirmed ? "All Videos Confirmed!" : "Watch Before Your Job"}
        </Text>
        <Text style={styles.progressSubtitle}>
          {confirmedCount}/{totalCount} videos confirmed
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${progressPercent}%` },
              allConfirmed && styles.progressComplete,
            ]}
          />
        </View>
        {!allConfirmed && (
          <Text style={styles.progressWarning}>
            Check-in is blocked until all videos are confirmed
          </Text>
        )}
      </View>

      {/* Equipment list */}
      {prep.videoConfirmations.map((vc) => {
        const isConfirmed = vc.confirmedAt !== null;
        const catItem = GYM_EQUIPMENT_CATALOG.find((e) => e.id === vc.equipmentId);
        const support = catItem?.brand === "rep"
          ? MANUFACTURER_SUPPORT.rep
          : catItem?.brand === "rogue"
            ? MANUFACTURER_SUPPORT.rogue
            : null;

        return (
          <View key={vc.equipmentId} style={styles.equipCard}>
            <View style={styles.equipHeader}>
              <Ionicons
                name={isConfirmed ? "checkbox" : "square-outline"}
                size={24}
                color={isConfirmed ? "#10b981" : "#64748b"}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.equipName, isConfirmed && styles.equipNameDone]}>
                  {vc.equipmentName}
                </Text>
                {catItem && (
                  <Text style={styles.equipMeta}>
                    {catItem.assemblyTime} assembly | {catItem.crewSize}+ crew
                  </Text>
                )}
              </View>
            </View>

            {/* Action buttons */}
            <View style={styles.equipActions}>
              <TouchableOpacity
                style={styles.watchBtn}
                onPress={() => handleWatchVideo(vc.manualUrl)}
              >
                <Ionicons name="play-circle" size={18} color="#fff" />
                <Text style={styles.watchBtnText}>
                  {vc.manualUrl?.endsWith(".pdf") ? "View Manual" : "Watch Video"}
                </Text>
              </TouchableOpacity>

              {!isConfirmed && (
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={() => handleConfirm(vc.equipmentId)}
                  disabled={confirming === vc.equipmentId}
                >
                  {confirming === vc.equipmentId ? (
                    <ActivityIndicator size="small" color="#10b981" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#10b981" />
                      <Text style={styles.confirmBtnText}>I've Watched This</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Support tip */}
            {support && (
              <Text style={styles.supportTip}>
                Need help? Call {support.name}: {support.phone}
              </Text>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1b2d" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  emptyText: { color: "#94a3b8", fontSize: 16, marginTop: 12, textAlign: "center" },
  backBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#1e293b",
  },
  backBtnText: { color: "#14b8a6", fontWeight: "700" },
  scroll: { padding: 16 },
  progressCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  progressTitle: { fontSize: 18, fontWeight: "800", color: "#f8fafc", marginBottom: 4 },
  progressSubtitle: { fontSize: 14, color: "#94a3b8", marginBottom: 12 },
  progressBar: {
    height: 8,
    backgroundColor: "#334155",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    backgroundColor: "#f59e0b",
    borderRadius: 4,
  },
  progressComplete: { backgroundColor: "#10b981" },
  progressWarning: {
    fontSize: 12,
    color: "#f59e0b",
    fontWeight: "700",
    marginTop: 8,
  },
  equipCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  equipHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  equipName: { fontSize: 15, fontWeight: "700", color: "#f8fafc" },
  equipNameDone: { color: "#64748b", textDecorationLine: "line-through" },
  equipMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  equipActions: { flexDirection: "row", gap: 10 },
  watchBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#3b82f6",
  },
  watchBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  confirmBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#10b98140",
  },
  confirmBtnText: { fontSize: 13, fontWeight: "700", color: "#10b981" },
  supportTip: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 8,
    fontStyle: "italic",
  },
});
