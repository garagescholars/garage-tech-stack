import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Ionicons } from "@expo/vector-icons";
import { db, storage } from "../../../../src/lib/firebase";
import { useAuth } from "../../../../src/hooks/useAuth";
import { COLLECTIONS } from "../../../../src/constants/collections";
import { getCurrentLocation } from "../../../../src/lib/geofence";
import VideoRecorder from "../../../../src/components/VideoRecorder";
import PhotoGrid from "../../../../src/components/PhotoGrid";
import { MIN_AFTER_PHOTOS } from "../../../../src/constants/urgency";
import type { ServiceJob } from "../../../../src/types";

export default function CheckOutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Media state
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);

  // Checklist
  const [checklist, setChecklist] = useState<{ id: string; text: string; completed: boolean }[]>([]);

  useEffect(() => {
    loadJob();
  }, [id]);

  const loadJob = async () => {
    if (!id) return;
    const snap = await getDoc(doc(db, COLLECTIONS.JOBS, id));
    if (snap.exists()) {
      const data = { id: snap.id, ...snap.data() } as ServiceJob;
      setJob(data);
      if (data.checklist) {
        setChecklist(data.checklist.map((c) => ({ ...c })));
      }
    }
    setLoading(false);
  };

  const toggleChecklist = (itemId: string) => {
    setChecklist((prev) =>
      prev.map((c) => (c.id === itemId ? { ...c, completed: !c.completed } : c))
    );
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
        checkoutLat = loc.coords.latitude;
        checkoutLng = loc.coords.longitude;
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
  if (job.checkInTime) {
    const elapsed = Date.now() - (job.checkInTime as Timestamp).toMillis();
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

        {/* Checklist */}
        {checklist.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completion Checklist</Text>
            {checklist.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.checkItem}
                onPress={() => toggleChecklist(item.id)}
              >
                <Ionicons
                  name={item.completed ? "checkbox" : "square-outline"}
                  size={22}
                  color={item.completed ? "#10b981" : "#64748b"}
                />
                <Text
                  style={[
                    styles.checkText,
                    item.completed && styles.checkTextDone,
                  ]}
                >
                  {item.text}
                </Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.checkSummary}>
              {checklist.filter((c) => c.completed).length}/{checklist.length} completed
            </Text>
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
});
