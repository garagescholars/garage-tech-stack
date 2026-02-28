import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../../../src/lib/firebase";
import { COLLECTIONS } from "../../../../src/constants/collections";
import { useAuth } from "../../../../src/hooks/useAuth";
import { useJobEscalations } from "../../../../src/hooks/useEscalations";
import type { GsEscalation } from "../../../../src/types";

export default function EscalationsScreen() {
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuth();
  const { escalations, loading } = useJobEscalations(jobId);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);

  const handleReply = async (escalation: GsEscalation) => {
    const text = replyTexts[escalation.id]?.trim();
    if (!text || !user) return;

    setSending(escalation.id);
    try {
      const response = {
        id: `resp-${Date.now()}`,
        authorId: user.uid,
        authorName: profile?.name || "Scholar",
        authorRole: (profile?.role || "scholar") as "scholar" | "admin",
        text,
        createdAt: new Date(),
      };

      await updateDoc(doc(db, COLLECTIONS.ESCALATIONS, escalation.id), {
        responses: arrayUnion(response),
        updatedAt: serverTimestamp(),
      });

      setReplyTexts((prev) => ({ ...prev, [escalation.id]: "" }));
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send reply.");
    } finally {
      setSending(null);
    }
  };

  const handleResolve = async (escalation: GsEscalation) => {
    if (!user) return;
    Alert.alert("Resolve Escalation", "Mark this issue as resolved?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Resolve",
        onPress: async () => {
          try {
            await updateDoc(doc(db, COLLECTIONS.ESCALATIONS, escalation.id), {
              status: "resolved",
              resolvedBy: user.uid,
              resolvedByName: profile?.name || "Scholar",
              resolvedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to resolve.");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  if (escalations.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="checkmark-circle" size={48} color="#10b981" />
        <Text style={styles.emptyText}>No escalations for this job</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {escalations.map((esc) => (
        <View key={esc.id} style={styles.card}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={[styles.statusBadge, esc.status === "resolved" && styles.resolvedBadge]}>
              <Text style={styles.statusText}>
                {esc.status === "open" ? "OPEN" : "RESOLVED"}
              </Text>
            </View>
            <Text style={styles.timestamp}>
              {esc.createdAt?.toDate?.()?.toLocaleDateString() || ""}
            </Text>
          </View>

          {/* Reporter */}
          <Text style={styles.reporter}>{esc.scholarName}</Text>
          {esc.equipmentName && (
            <Text style={styles.equipment}>{esc.equipmentName}</Text>
          )}

          {/* Description */}
          <Text style={styles.descLabel}>Problem:</Text>
          <Text style={styles.descText}>{esc.description}</Text>
          <Text style={styles.descLabel}>Already tried:</Text>
          <Text style={styles.descText}>{esc.attemptedSolutions}</Text>

          {/* Photos */}
          {esc.photoUrls?.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
              {esc.photoUrls.map((url, i) => (
                <Image key={i} source={{ uri: url }} style={styles.photo} />
              ))}
            </ScrollView>
          )}

          {/* Response thread */}
          {esc.responses?.length > 0 && (
            <View style={styles.responseSection}>
              <Text style={styles.responseTitle}>Responses:</Text>
              {esc.responses.map((resp) => (
                <View key={resp.id} style={styles.responseItem}>
                  <Text style={styles.respAuthor}>
                    {resp.authorName}
                    {resp.authorRole === "admin" && (
                      <Text style={styles.adminTag}> (Admin)</Text>
                    )}
                  </Text>
                  <Text style={styles.respText}>{resp.text}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Reply input (only for open escalations) */}
          {esc.status === "open" && (
            <View style={styles.replyRow}>
              <TextInput
                style={styles.replyInput}
                value={replyTexts[esc.id] || ""}
                onChangeText={(t) => setReplyTexts((prev) => ({ ...prev, [esc.id]: t }))}
                placeholder="Type your advice..."
                placeholderTextColor="#475569"
              />
              <TouchableOpacity
                style={[styles.replyBtn, !replyTexts[esc.id]?.trim() && { opacity: 0.4 }]}
                onPress={() => handleReply(esc)}
                disabled={!replyTexts[esc.id]?.trim() || sending === esc.id}
              >
                {sending === esc.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={16} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Resolve button */}
          {esc.status === "open" &&
            (user?.uid === esc.scholarId || profile?.role === "admin") && (
              <TouchableOpacity style={styles.resolveBtn} onPress={() => handleResolve(esc)}>
                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                <Text style={styles.resolveText}>Mark Resolved</Text>
              </TouchableOpacity>
            )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1a" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "#8b9bb5", fontSize: 16, marginTop: 12 },
  scroll: { padding: 16 },
  card: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusBadge: {
    backgroundColor: "#7f1d1d",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  resolvedBadge: { backgroundColor: "#052e16" },
  statusText: { fontSize: 10, fontWeight: "800", color: "#f1f5f9", letterSpacing: 0.5 },
  timestamp: { fontSize: 12, color: "#5a6a80" },
  reporter: { fontSize: 14, fontWeight: "700", color: "#f1f5f9", marginBottom: 2 },
  equipment: { fontSize: 13, color: "#14b8a6", marginBottom: 8 },
  descLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#5a6a80",
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 2,
  },
  descText: { fontSize: 14, color: "#cbd5e1", marginBottom: 4 },
  photoRow: { marginTop: 10, marginBottom: 6 },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: "#2a3545",
  },
  responseSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#2a3545", paddingTop: 10 },
  responseTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#5a6a80",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  responseItem: {
    backgroundColor: "#0a0f1a",
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  respAuthor: { fontSize: 12, fontWeight: "700", color: "#14b8a6", marginBottom: 2 },
  adminTag: { color: "#f59e0b" },
  respText: { fontSize: 14, color: "#e2e8f0" },
  replyRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    alignItems: "center",
  },
  replyInput: {
    flex: 1,
    backgroundColor: "#0a0f1a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#f1f5f9",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#2a3545",
  },
  replyBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#14b8a6",
    alignItems: "center",
    justifyContent: "center",
  },
  resolveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#10b98140",
  },
  resolveText: { fontSize: 14, fontWeight: "700", color: "#10b981" },
});
