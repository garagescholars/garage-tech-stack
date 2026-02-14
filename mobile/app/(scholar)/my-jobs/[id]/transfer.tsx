import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../../../src/lib/firebase";
import { useAuth } from "../../../../src/hooks/useAuth";
import { COLLECTIONS } from "../../../../src/constants/collections";
import { createTransfer } from "../../../../src/hooks/useTransfers";
import type { ServiceJob } from "../../../../src/types";

type TransferType = "direct" | "requeue";

type ScholarOption = {
  uid: string;
  name: string;
};

export default function TransferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuth();
  const router = useRouter();

  const [job, setJob] = useState<ServiceJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Transfer form state
  const [transferType, setTransferType] = useState<TransferType | null>(null);
  const [reason, setReason] = useState("");
  const [selectedScholar, setSelectedScholar] = useState<ScholarOption | null>(
    null
  );

  // Scholars list for direct transfer
  const [scholars, setScholars] = useState<ScholarOption[]>([]);
  const [scholarsLoading, setScholarsLoading] = useState(false);

  useEffect(() => {
    loadJob();
  }, [id]);

  const loadJob = async () => {
    if (!id) return;
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.JOBS, id));
      if (snap.exists()) {
        setJob({ id: snap.id, ...snap.data() } as ServiceJob);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  };

  const loadScholars = async () => {
    if (!user) return;
    setScholarsLoading(true);
    try {
      const q = query(
        collection(db, COLLECTIONS.SCHOLAR_PROFILES),
        where("scholarId", "!=", user.uid)
      );
      const snap = await getDocs(q);
      const items: ScholarOption[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          name: (data.scholarName as string) || "Scholar",
        };
      });
      setScholars(items);
    } catch {
      Alert.alert("Error", "Could not load scholars list.");
    }
    setScholarsLoading(false);
  };

  const handleSelectType = (type: TransferType) => {
    setTransferType(type);
    setSelectedScholar(null);
    if (type === "direct") {
      loadScholars();
    }
  };

  const handleSubmit = async () => {
    if (!id || !user || !transferType) return;

    if (transferType === "direct" && !selectedScholar) {
      Alert.alert("Select a Scholar", "Please choose a scholar to send this job to.");
      return;
    }

    setSubmitting(true);
    try {
      await createTransfer(
        id,
        user.uid,
        transferType,
        reason.trim() || undefined,
        transferType === "direct" ? selectedScholar?.uid : undefined
      );

      Alert.alert(
        "Transfer Initiated",
        transferType === "direct"
          ? `Transfer request sent to ${selectedScholar?.name}. They have 15 minutes to respond.`
          : "Job has been released back to the open feed. Another scholar can claim it.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not create transfer.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Job not found</Text>
      </View>
    );
  }

  const canSubmit =
    transferType !== null &&
    (transferType === "requeue" || selectedScholar !== null) &&
    !submitting;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Job summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.jobTitle}>{job.title}</Text>
          <Text style={styles.jobAddress}>{job.address}</Text>
          <Text style={styles.jobTime}>
            {job.scheduledDate} at {job.scheduledTimeStart}
          </Text>
          <View style={styles.payoutRow}>
            <Text style={styles.payoutLabel}>Payout</Text>
            <Text style={styles.payoutValue}>
              ${job.payout.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Transfer type selection */}
        <Text style={styles.sectionTitle}>Transfer Type</Text>

        <TouchableOpacity
          style={[
            styles.optionCard,
            transferType === "direct" && styles.optionCardActive,
          ]}
          onPress={() => handleSelectType("direct")}
        >
          <View style={styles.optionIconWrap}>
            <Ionicons
              name="person-add-outline"
              size={24}
              color={transferType === "direct" ? "#14b8a6" : "#64748b"}
            />
          </View>
          <View style={styles.optionTextWrap}>
            <Text
              style={[
                styles.optionTitle,
                transferType === "direct" && styles.optionTitleActive,
              ]}
            >
              Send to Another Scholar
            </Text>
            <Text style={styles.optionDesc}>
              Choose a specific scholar to offer this job to. They'll have 15
              minutes to accept.
            </Text>
          </View>
          {transferType === "direct" && (
            <Ionicons name="checkmark-circle" size={22} color="#14b8a6" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.optionCard,
            transferType === "requeue" && styles.optionCardActive,
          ]}
          onPress={() => handleSelectType("requeue")}
        >
          <View style={styles.optionIconWrap}>
            <Ionicons
              name="globe-outline"
              size={24}
              color={transferType === "requeue" ? "#14b8a6" : "#64748b"}
            />
          </View>
          <View style={styles.optionTextWrap}>
            <Text
              style={[
                styles.optionTitle,
                transferType === "requeue" && styles.optionTitleActive,
              ]}
            >
              Release to Everyone
            </Text>
            <Text style={styles.optionDesc}>
              Release this job back to the open feed so any available scholar can
              claim it.
            </Text>
          </View>
          {transferType === "requeue" && (
            <Ionicons name="checkmark-circle" size={22} color="#14b8a6" />
          )}
        </TouchableOpacity>

        {/* Scholar picker for direct transfers */}
        {transferType === "direct" && (
          <View style={styles.scholarSection}>
            <Text style={styles.sectionTitle}>Select a Scholar</Text>
            {scholarsLoading ? (
              <ActivityIndicator
                color="#14b8a6"
                style={{ marginVertical: 20 }}
              />
            ) : scholars.length === 0 ? (
              <View style={styles.emptyScholars}>
                <Ionicons
                  name="people-outline"
                  size={32}
                  color="#334155"
                />
                <Text style={styles.emptyText}>
                  No other scholars available
                </Text>
              </View>
            ) : (
              <View style={styles.scholarList}>
                {scholars.map((s) => (
                  <TouchableOpacity
                    key={s.uid}
                    style={[
                      styles.scholarRow,
                      selectedScholar?.uid === s.uid &&
                        styles.scholarRowActive,
                    ]}
                    onPress={() => setSelectedScholar(s)}
                  >
                    <View style={styles.scholarAvatar}>
                      <Ionicons
                        name="person-circle-outline"
                        size={36}
                        color={
                          selectedScholar?.uid === s.uid
                            ? "#14b8a6"
                            : "#64748b"
                        }
                      />
                    </View>
                    <Text
                      style={[
                        styles.scholarName,
                        selectedScholar?.uid === s.uid &&
                          styles.scholarNameActive,
                      ]}
                    >
                      {s.name}
                    </Text>
                    {selectedScholar?.uid === s.uid && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#14b8a6"
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Reason */}
        {transferType !== null && (
          <View style={styles.reasonSection}>
            <Text style={styles.sectionTitle}>Reason (Optional)</Text>
            <TextInput
              style={styles.reasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder="Why are you transferring this job?"
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Submit bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="swap-horizontal" size={20} color="#fff" />
              <Text style={styles.submitText}>
                {transferType === "requeue"
                  ? "Release Job"
                  : "Send Transfer"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1b2d" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f1b2d",
  },
  errorText: { color: "#ef4444", fontSize: 16 },
  scroll: { padding: 16 },
  summaryCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  jobTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 4,
  },
  jobAddress: { fontSize: 14, color: "#94a3b8", marginBottom: 2 },
  jobTime: { fontSize: 13, color: "#64748b", marginBottom: 10 },
  payoutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#334155",
    paddingTop: 10,
  },
  payoutLabel: { fontSize: 13, color: "#64748b", fontWeight: "600" },
  payoutValue: { fontSize: 18, fontWeight: "800", color: "#14b8a6" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 12,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionCardActive: {
    borderColor: "#14b8a6",
  },
  optionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0f1b2d",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  optionTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#cbd5e1",
    marginBottom: 4,
  },
  optionTitleActive: {
    color: "#f8fafc",
  },
  optionDesc: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
  },
  scholarSection: {
    marginTop: 14,
  },
  emptyScholars: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 8,
  },
  scholarList: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    overflow: "hidden",
  },
  scholarRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  scholarRowActive: {
    backgroundColor: "#14b8a615",
  },
  scholarAvatar: {
    marginRight: 10,
  },
  scholarName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#cbd5e1",
  },
  scholarNameActive: {
    color: "#f8fafc",
  },
  reasonSection: {
    marginTop: 20,
  },
  reasonInput: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#f8fafc",
    borderWidth: 1,
    borderColor: "#334155",
    minHeight: 90,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: "#0f1b2d",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
  submitBtn: {
    backgroundColor: "#14b8a6",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { fontSize: 17, fontWeight: "800", color: "#fff" },
});
