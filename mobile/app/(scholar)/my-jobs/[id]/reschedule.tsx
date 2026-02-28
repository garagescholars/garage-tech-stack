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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../../../src/lib/firebase";
import { useAuth } from "../../../../src/hooks/useAuth";
import { COLLECTIONS } from "../../../../src/constants/collections";
import { requestReschedule } from "../../../../src/hooks/useTransfers";
import type { ServiceJob } from "../../../../src/types";

export default function RescheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuth();
  const router = useRouter();

  const [job, setJob] = useState<ServiceJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [newDate, setNewDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [reason, setReason] = useState("");

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

  const validateDate = (dateStr: string): boolean => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    const parsed = new Date(dateStr + "T00:00:00");
    return !isNaN(parsed.getTime());
  };

  const handleSubmit = async () => {
    if (!id || !user || !job) return;

    // Validate new date
    if (!newDate.trim()) {
      Alert.alert("Date Required", "Please enter a new date.");
      return;
    }
    if (!validateDate(newDate.trim())) {
      Alert.alert(
        "Invalid Date",
        "Please enter a valid date in YYYY-MM-DD format."
      );
      return;
    }

    // Validate new start time
    if (!newStartTime.trim()) {
      Alert.alert("Start Time Required", "Please enter a new start time.");
      return;
    }

    setSubmitting(true);
    try {
      await requestReschedule(
        id,
        user.uid,
        "scholar",
        job.scheduledDate,
        job.scheduledTimeStart,
        newDate.trim(),
        newStartTime.trim(),
        newEndTime.trim() || undefined
      );

      Alert.alert(
        "Reschedule Requested",
        "Your reschedule request has been submitted. An admin will review it shortly.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not submit reschedule request.");
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
    newDate.trim().length > 0 &&
    newStartTime.trim().length > 0 &&
    !submitting;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Job summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.jobTitle}>{job.title}</Text>
          <Text style={styles.jobAddress}>{job.address}</Text>
        </View>

        {/* Current schedule */}
        <Text style={styles.sectionTitle}>Current Schedule</Text>
        <View style={styles.currentSchedule}>
          <View style={styles.scheduleRow}>
            <Ionicons name="calendar-outline" size={18} color="#5a6a80" />
            <Text style={styles.scheduleLabel}>Date</Text>
            <Text style={styles.scheduleValue}>{job.scheduledDate}</Text>
          </View>
          <View style={styles.scheduleRow}>
            <Ionicons name="time-outline" size={18} color="#5a6a80" />
            <Text style={styles.scheduleLabel}>Start</Text>
            <Text style={styles.scheduleValue}>
              {job.scheduledTimeStart}
            </Text>
          </View>
          {job.scheduledTimeEnd && (
            <View style={styles.scheduleRow}>
              <Ionicons name="time-outline" size={18} color="#5a6a80" />
              <Text style={styles.scheduleLabel}>End</Text>
              <Text style={styles.scheduleValue}>
                {job.scheduledTimeEnd}
              </Text>
            </View>
          )}
        </View>

        {/* New schedule form */}
        <Text style={styles.sectionTitle}>New Schedule</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>New Date *</Text>
          <TextInput
            style={styles.input}
            value={newDate}
            onChangeText={setNewDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#5a6a80"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>New Start Time *</Text>
          <TextInput
            style={styles.input}
            value={newStartTime}
            onChangeText={setNewStartTime}
            placeholder="e.g. 9:00 AM"
            placeholderTextColor="#5a6a80"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>New End Time (Optional)</Text>
          <TextInput
            style={styles.input}
            value={newEndTime}
            onChangeText={setNewEndTime}
            placeholder="e.g. 12:00 PM"
            placeholderTextColor="#5a6a80"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Reason</Text>
          <TextInput
            style={[styles.input, styles.reasonInput]}
            value={reason}
            onChangeText={setReason}
            placeholder="Why do you need to reschedule?"
            placeholderTextColor="#5a6a80"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

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
              <Ionicons name="calendar" size={20} color="#fff" />
              <Text style={styles.submitText}>Request Reschedule</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1a" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0f1a",
  },
  errorText: { color: "#ef4444", fontSize: 16 },
  scroll: { padding: 16 },
  summaryCard: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  jobTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f1f5f9",
    marginBottom: 4,
  },
  jobAddress: { fontSize: 14, color: "#8b9bb5" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 12,
  },
  currentSchedule: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2a3545",
  },
  scheduleLabel: {
    fontSize: 14,
    color: "#5a6a80",
    fontWeight: "600",
    width: 50,
  },
  scheduleValue: {
    fontSize: 15,
    color: "#f1f5f9",
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#cbd5e1",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#2a3545",
  },
  reasonInput: {
    minHeight: 90,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: "#0a0f1a",
    borderTopWidth: 1,
    borderTopColor: "#1a2332",
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
