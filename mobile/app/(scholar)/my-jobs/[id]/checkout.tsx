import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter, Link } from "expo-router";
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp, arrayUnion } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Ionicons } from "@expo/vector-icons";
import { db, storage } from "../../../../src/lib/firebase";
import { useAuth } from "../../../../src/hooks/useAuth";
import { COLLECTIONS } from "../../../../src/constants/collections";
import { getCurrentLocation } from "../../../../src/lib/geofence";
import { useJobEscalations } from "../../../../src/hooks/useEscalations";
import VideoRecorder from "../../../../src/components/VideoRecorder";
import PhotoGrid from "../../../../src/components/PhotoGrid";
import { MIN_AFTER_PHOTOS } from "../../../../src/constants/urgency";
import type { ServiceJob } from "../../../../src/types";

export default function CheckOutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [checkinTime, setCheckinTime] = useState<Timestamp | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Media state
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);

  // Checklist
  const [checklist, setChecklist] = useState<{ id: string; text: string; completed: boolean; approvalStatus?: string }[]>([]);
  const [showAdhocInput, setShowAdhocInput] = useState(false);
  const [adhocText, setAdhocText] = useState("");
  const { openCount } = useJobEscalations(id);

  useEffect(() => {
    loadJob();
  }, [id]);

  const loadJob = async () => {
    if (!id || !user) return;
    const snap = await getDoc(doc(db, COLLECTIONS.JOBS, id));
    if (snap.exists()) {
      const data = { id: snap.id, ...snap.data() } as ServiceJob;
      setJob(data);
      if (data.checklist) {
        setChecklist(data.checklist.map((c) => ({ ...c })));
      }
    }
    // Load checkin doc for duration display
    const checkinDocId = `${id}_${user.uid}`;
    const checkinSnap = await getDoc(doc(db, COLLECTIONS.JOB_CHECKINS, checkinDocId));
    if (checkinSnap.exists()) {
      setCheckinTime(checkinSnap.data()?.checkinTime || null);
    }
    setLoading(false);
  };

  const toggleChecklist = (itemId: string) => {
    setChecklist((prev) =>
      prev.map((c) => (c.id === itemId ? { ...c, completed: !c.completed } : c))
    );
  };

  const handleAddAdhocTask = async () => {
    if (!adhocText.trim() || !id) return;
    const newItem = {
      id: `adhoc-${Date.now()}`,
      text: adhocText.trim(),
      completed: false,
      approvalStatus: "pending" as const,
    };
    // Add to local state immediately
    setChecklist((prev) => [...prev, newItem]);
    setAdhocText("");
    setShowAdhocInput(false);
    // Persist to Firestore
    try {
      await updateDoc(doc(db, COLLECTIONS.JOBS, id), {
        checklist: arrayUnion(newItem),
      });
    } catch {
      // Revert on failure
      setChecklist((prev) => prev.filter((c) => c.id !== newItem.id));
      Alert.alert("Error", "Failed to add task. Please try again.");
    }
  };

  const uploadFile = async (uri: string, path: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    return getDownloadURL(storageRef);
  };

  const handleCheckOut = async () => {
    if (!job || !user || !id) return;

    if (afterPhotos.length < MIN_AFTER_PHOTOS) {
      Alert.alert("Photos Required", `Please take at least ${MIN_AFTER_PHOTOS} after photos.`);
      return;
    }

    // Warn about incomplete checklist
    const incomplete = checklist.filter((c) => !c.completed);
    if (incomplete.length > 0) {
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Incomplete Checklist",
          `${incomplete.length} item(s) unchecked. Check out anyway?`,
          [
            { text: "Go Back", onPress: () => resolve(false) },
            { text: "Check Out Anyway", onPress: () => resolve(true), style: "destructive" },
          ]
        );
      });
      if (!proceed) return;
    }

    setSubmitting(true);
    try {
      const scholarId = user.uid;
      const checkinDocId = `${id}_${scholarId}`;

      // Upload after photos
      const photoUrls = await Promise.all(
        afterPhotos.map((uri, i) =>
          uploadFile(uri, `gs_job_photos/${id}/after/after_${i}_${Date.now()}.jpg`)
        )
      );

      // Upload video if recorded
      let videoUrl: string | undefined;
      if (videoUri) {
        videoUrl = await uploadFile(videoUri, `gs_checkout_videos/${id}/video_${Date.now()}.mp4`);
      }

      // Get checkout location
      let checkoutLat: number | undefined;
      let checkoutLng: number | undefined;
      try {
        const loc = await getCurrentLocation();
        if (loc) {
          checkoutLat = loc.latitude;
          checkoutLng = loc.longitude;
        }
      } catch {
        // Non-blocking — location is optional on checkout
      }

      // Update the existing gs_jobCheckins document with checkout data
      await updateDoc(doc(db, COLLECTIONS.JOB_CHECKINS, checkinDocId), {
        checkoutTime: serverTimestamp(),
        checkoutLat,
        checkoutLng,
        checkoutVideoUrl: videoUrl || "",
        afterPhotos: photoUrls,
      });

      // Update job status to REVIEW_PENDING
      await updateDoc(doc(db, COLLECTIONS.JOBS, id), {
        status: "REVIEW_PENDING",
        checklist,
        updatedAt: serverTimestamp(),
      });

      Alert.alert(
        "Checked Out!",
        "Great work! Your job is now under review. The 48-hour quality window has started.",
        [{ text: "OK", onPress: () => router.replace("/(scholar)/my-jobs" as any) }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Check-out failed");
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

  // Duration display
  let durationText = "";
  if (checkinTime) {
    const elapsed = Date.now() - checkinTime.toMillis();
    const hours = Math.floor(elapsed / 3600000);
    const mins = Math.floor((elapsed % 3600000) / 60000);
    durationText = hours > 0 ? `${hours}h ${mins}m on site` : `${mins}m on site`;
  }

  const canSubmit = afterPhotos.length >= MIN_AFTER_PHOTOS && !submitting;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Job summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.jobTitle}>{job.title}</Text>
          <Text style={styles.jobAddress}>{job.address}</Text>
          {durationText && (
            <View style={styles.durationRow}>
              <Ionicons name="time" size={16} color="#14b8a6" />
              <Text style={styles.durationText}>{durationText}</Text>
            </View>
          )}
        </View>

        {/* Escalation actions */}
        <View style={styles.escalationRow}>
          <Link href={`/(scholar)/my-jobs/${id}/escalate` as any} asChild>
            <TouchableOpacity style={styles.reportBtn}>
              <Ionicons name="alert-circle" size={18} color="#ef4444" />
              <Text style={styles.reportBtnText}>Report Issue</Text>
            </TouchableOpacity>
          </Link>
          <Link href={`/(scholar)/my-jobs/${id}/escalations` as any} asChild>
            <TouchableOpacity style={styles.escalationsBtn}>
              <Ionicons name="chatbubbles" size={18} color="#14b8a6" />
              <Text style={styles.escalationsBtnText}>
                Escalations{openCount > 0 ? ` (${openCount})` : ""}
              </Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Checklist */}
        {checklist.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completion Checklist</Text>
            {checklist.map((item) => {
              const isRejected = item.approvalStatus === "rejected";
              const isPending = item.approvalStatus === "pending";
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.checkItem}
                  onPress={() => !isRejected && toggleChecklist(item.id)}
                  disabled={isRejected}
                >
                  <Ionicons
                    name={item.completed ? "checkbox" : "square-outline"}
                    size={22}
                    color={isRejected ? "#475569" : item.completed ? "#10b981" : "#64748b"}
                  />
                  <Text
                    style={[
                      styles.checkText,
                      item.completed && styles.checkTextDone,
                      isRejected && styles.checkTextRejected,
                    ]}
                  >
                    {item.text}
                  </Text>
                  {isPending && (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>Pending</Text>
                    </View>
                  )}
                  {isRejected && (
                    <View style={styles.rejectedBadge}>
                      <Text style={styles.rejectedBadgeText}>Rejected</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            <Text style={styles.checkSummary}>
              {checklist.filter((c) => c.completed).length}/{checklist.length} completed
            </Text>

            {/* Add adhoc task */}
            {showAdhocInput ? (
              <View style={styles.adhocRow}>
                <TextInput
                  style={styles.adhocInput}
                  value={adhocText}
                  onChangeText={setAdhocText}
                  placeholder="Describe additional task..."
                  placeholderTextColor="#475569"
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.adhocSubmit, !adhocText.trim() && { opacity: 0.4 }]}
                  onPress={handleAddAdhocTask}
                  disabled={!adhocText.trim()}
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.adhocCancel}
                  onPress={() => { setShowAdhocInput(false); setAdhocText(""); }}
                >
                  <Ionicons name="close" size={18} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addTaskBtn}
                onPress={() => setShowAdhocInput(true)}
              >
                <Ionicons name="add-circle-outline" size={16} color="#14b8a6" />
                <Text style={styles.addTaskText}>Request Additional Task</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* After photos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Step 1: After Photos</Text>
          <PhotoGrid
            photos={afterPhotos}
            onPhotosChanged={setAfterPhotos}
            minPhotos={MIN_AFTER_PHOTOS}
            label={`After Photos (min ${MIN_AFTER_PHOTOS})`}
          />
        </View>

        {/* Video */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Step 2: Check-out Video (Optional)</Text>
          <VideoRecorder onVideoRecorded={setVideoUri} label="Record finished walkthrough" />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Submit */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitDisabled]}
          onPress={handleCheckOut}
          disabled={!canSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="log-out" size={20} color="#fff" />
              <Text style={styles.submitText}>Check Out</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1b2d" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { color: "#ef4444", fontSize: 16 },
  scroll: { padding: 16 },
  summaryCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  jobTitle: { fontSize: 18, fontWeight: "800", color: "#f8fafc", marginBottom: 4 },
  jobAddress: { fontSize: 14, color: "#94a3b8", marginBottom: 6 },
  durationRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  durationText: { color: "#14b8a6", fontWeight: "700", fontSize: 14 },
  section: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  checkText: { fontSize: 15, color: "#f8fafc", flex: 1 },
  checkTextDone: { color: "#64748b", textDecorationLine: "line-through" },
  checkTextRejected: { color: "#475569", textDecorationLine: "line-through" },
  pendingBadge: {
    backgroundColor: "#78350f",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingBadgeText: { fontSize: 9, fontWeight: "700", color: "#fbbf24", textTransform: "uppercase" },
  rejectedBadge: {
    backgroundColor: "#7f1d1d",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rejectedBadgeText: { fontSize: 9, fontWeight: "700", color: "#f87171", textTransform: "uppercase" },
  adhocRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
    alignItems: "center",
  },
  adhocInput: {
    flex: 1,
    backgroundColor: "#0f1b2d",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#f8fafc",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#334155",
  },
  adhocSubmit: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#14b8a6",
    alignItems: "center",
    justifyContent: "center",
  },
  adhocCancel: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  addTaskBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 6,
  },
  addTaskText: { fontSize: 13, fontWeight: "600", color: "#14b8a6" },
  checkSummary: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "right",
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
    backgroundColor: "#f59e0b",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { fontSize: 17, fontWeight: "800", color: "#fff" },
  escalationRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  reportBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#ef444440",
  },
  reportBtnText: { fontSize: 14, fontWeight: "700", color: "#ef4444" },
  escalationsBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#14b8a640",
  },
  escalationsBtnText: { fontSize: 14, fontWeight: "700", color: "#14b8a6" },
});
