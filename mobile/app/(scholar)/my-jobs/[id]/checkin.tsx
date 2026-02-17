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
import { useLocalSearchParams, useRouter, Link } from "expo-router";
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Ionicons } from "@expo/vector-icons";
import { db, storage } from "../../../../src/lib/firebase";
import { useAuth } from "../../../../src/hooks/useAuth";
import { COLLECTIONS } from "../../../../src/constants/collections";
import { getCurrentLocation, validateGeofence } from "../../../../src/lib/geofence";
import VideoRecorder from "../../../../src/components/VideoRecorder";
import PhotoGrid from "../../../../src/components/PhotoGrid";
import { MIN_BEFORE_PHOTOS, GEOFENCE_RADIUS_METERS } from "../../../../src/constants/urgency";
import { useJobPrep } from "../../../../src/hooks/useJobPrep";
import type { ServiceJob } from "../../../../src/types";

export default function CheckInScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Media state
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [freightReceiptUri, setFreightReceiptUri] = useState<string | null>(null);

  // Video homework gate
  const { allConfirmed: prepDone, loading: prepLoading, confirmedCount, totalCount } = useJobPrep(id, user?.uid);

  // GPS state
  const [gpsValid, setGpsValid] = useState<boolean | null>(null);
  const [gpsChecking, setGpsChecking] = useState(false);
  const [gpsDistance, setGpsDistance] = useState<number | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    loadJob();
  }, [id]);

  const loadJob = async () => {
    if (!id) return;
    const snap = await getDoc(doc(db, COLLECTIONS.JOBS, id));
    if (snap.exists()) {
      setJob({ id: snap.id, ...snap.data() } as ServiceJob);
    }
    setLoading(false);
  };

  const checkGPS = async () => {
    if (!job?.lat || !job?.lng) {
      // No coordinates on job — skip geofence, allow check-in
      setGpsValid(true);
      return;
    }

    setGpsChecking(true);
    try {
      const location = await getCurrentLocation();
      if (!location) {
        Alert.alert("Location Error", "Could not get your location. Please enable location services.");
        return;
      }
      setCoords({ lat: location.latitude, lng: location.longitude });

      const result = validateGeofence(
        location.latitude,
        location.longitude,
        job.lat,
        job.lng,
        GEOFENCE_RADIUS_METERS
      );
      setGpsValid(result.valid);
      setGpsDistance(result.distanceMeters);

      if (!result.valid) {
        Alert.alert(
          "Too Far Away",
          `You are ${result.distanceMeters}m from the job site. You need to be within ${GEOFENCE_RADIUS_METERS}m to check in.`
        );
      }
    } catch (err: any) {
      Alert.alert("Location Error", err.message || "Could not get your location");
    } finally {
      setGpsChecking(false);
    }
  };

  const uploadFile = async (uri: string, path: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    return getDownloadURL(storageRef);
  };

  const handleCheckIn = async () => {
    if (!job || !user || !id) return;

    // Validations
    if (gpsValid === null) {
      Alert.alert("GPS Required", "Please verify your location first.");
      return;
    }
    if (!gpsValid) {
      Alert.alert("Too Far Away", "You must be within the geofence to check in.");
      return;
    }
    if (beforePhotos.length < MIN_BEFORE_PHOTOS) {
      Alert.alert("Photos Required", `Please take at least ${MIN_BEFORE_PHOTOS} before photos.`);
      return;
    }

    setSubmitting(true);
    try {
      const scholarId = user.uid;
      const checkinDocId = `${id}_${scholarId}`;

      // Upload before photos
      const photoUrls = await Promise.all(
        beforePhotos.map((uri, i) =>
          uploadFile(uri, `gs_job_photos/${id}/before/before_${i}_${Date.now()}.jpg`)
        )
      );

      // Upload video if recorded
      let videoUrl: string | undefined;
      if (videoUri) {
        videoUrl = await uploadFile(videoUri, `gs_checkin_videos/${id}/video_${Date.now()}.mp4`);
      }

      // Upload freight receipt if captured
      let receiptUrl: string | undefined;
      if (freightReceiptUri) {
        receiptUrl = await uploadFile(
          freightReceiptUri,
          `gs_freight_receipts/${id}/receipt_${Date.now()}.jpg`
        );
      }

      // Create checkin document in gs_jobCheckins with deterministic ID
      await setDoc(doc(db, COLLECTIONS.JOB_CHECKINS, checkinDocId), {
        jobId: id,
        scholarId: scholarId,
        checkinTime: serverTimestamp(),
        checkinLat: coords?.lat,
        checkinLng: coords?.lng,
        checkinGeofenceValid: gpsValid,
        checkinVideoUrl: videoUrl || "",
        freightReceiptUrl: receiptUrl || "",
        beforePhotos: photoUrls,
        afterPhotos: [],
        createdAt: serverTimestamp(),
      });

      // Update job status to IN_PROGRESS
      await updateDoc(doc(db, COLLECTIONS.JOBS, id), {
        status: "IN_PROGRESS",
        updatedAt: serverTimestamp(),
      });

      Alert.alert("Checked In!", "You're now on the clock. Good luck!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Check-in failed");
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

  // Gate: block check-in if video homework exists and isn't done
  if (!prepLoading && totalCount > 0 && !prepDone) {
    return (
      <View style={styles.container}>
        <View style={styles.gateCard}>
          <Ionicons name="videocam" size={48} color="#f59e0b" />
          <Text style={styles.gateTitle}>Video Homework Required</Text>
          <Text style={styles.gateSubtitle}>
            Watch all assembly videos before checking in.{"\n"}
            {confirmedCount}/{totalCount} confirmed.
          </Text>
          <View style={styles.gateProgressBar}>
            <View
              style={[
                styles.gateProgressFill,
                { width: `${totalCount > 0 ? (confirmedCount / totalCount) * 100 : 0}%` },
              ]}
            />
          </View>
          <Link href={`/(scholar)/my-jobs/${id}/prep` as any} asChild>
            <TouchableOpacity style={styles.gateBtn}>
              <Ionicons name="play-circle" size={20} color="#fff" />
              <Text style={styles.gateBtnText}>Watch Videos</Text>
            </TouchableOpacity>
          </Link>
          <TouchableOpacity style={styles.gateBackBtn} onPress={() => router.back()}>
            <Text style={styles.gateBackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const canSubmit =
    gpsValid === true &&
    beforePhotos.length >= MIN_BEFORE_PHOTOS &&
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
        </View>

        {/* Step 1: GPS */}
        <View style={styles.step}>
          <View style={styles.stepHeader}>
            <View style={[styles.stepNum, gpsValid && styles.stepDone]}>
              {gpsValid ? (
                <Ionicons name="checkmark" size={16} color="#fff" />
              ) : (
                <Text style={styles.stepNumText}>1</Text>
              )}
            </View>
            <Text style={styles.stepTitle}>Verify Location</Text>
          </View>

          {gpsValid === null ? (
            <TouchableOpacity
              style={styles.gpsBtn}
              onPress={checkGPS}
              disabled={gpsChecking}
            >
              {gpsChecking ? (
                <ActivityIndicator color="#14b8a6" />
              ) : (
                <>
                  <Ionicons name="navigate" size={18} color="#14b8a6" />
                  <Text style={styles.gpsBtnText}>Check My Location</Text>
                </>
              )}
            </TouchableOpacity>
          ) : gpsValid ? (
            <View style={styles.gpsSuccess}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.gpsSuccessText}>
                Location verified{gpsDistance ? ` (${Math.round(gpsDistance)}m away)` : ""}
              </Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.gpsBtn} onPress={checkGPS}>
              <Ionicons name="refresh" size={18} color="#f59e0b" />
              <Text style={[styles.gpsBtnText, { color: "#f59e0b" }]}>
                Retry ({Math.round(gpsDistance || 0)}m away)
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Step 2: Video */}
        <View style={styles.step}>
          <View style={styles.stepHeader}>
            <View style={[styles.stepNum, videoUri && styles.stepDone]}>
              {videoUri ? (
                <Ionicons name="checkmark" size={16} color="#fff" />
              ) : (
                <Text style={styles.stepNumText}>2</Text>
              )}
            </View>
            <Text style={styles.stepTitle}>Check-in Video (Optional)</Text>
          </View>
          <VideoRecorder onVideoRecorded={setVideoUri} label="Record walkthrough" />
        </View>

        {/* Step 3: Before photos */}
        <View style={styles.step}>
          <View style={styles.stepHeader}>
            <View
              style={[
                styles.stepNum,
                beforePhotos.length >= MIN_BEFORE_PHOTOS && styles.stepDone,
              ]}
            >
              {beforePhotos.length >= MIN_BEFORE_PHOTOS ? (
                <Ionicons name="checkmark" size={16} color="#fff" />
              ) : (
                <Text style={styles.stepNumText}>3</Text>
              )}
            </View>
            <Text style={styles.stepTitle}>Before Photos</Text>
          </View>
          <PhotoGrid
            photos={beforePhotos}
            onPhotosChanged={setBeforePhotos}
            minPhotos={MIN_BEFORE_PHOTOS}
            label={`Before Photos (min ${MIN_BEFORE_PHOTOS})`}
          />
        </View>

        {/* Step 4: Freight Receipt */}
        <View style={styles.step}>
          <View style={styles.stepHeader}>
            <View style={[styles.stepNum, freightReceiptUri && styles.stepDone]}>
              {freightReceiptUri ? (
                <Ionicons name="checkmark" size={16} color="#fff" />
              ) : (
                <Text style={styles.stepNumText}>4</Text>
              )}
            </View>
            <Text style={styles.stepTitle}>Freight Receipt (Optional)</Text>
          </View>
          <PhotoGrid
            photos={freightReceiptUri ? [freightReceiptUri] : []}
            onPhotosChanged={(photos) => setFreightReceiptUri(photos[0] || null)}
            minPhotos={0}
            maxPhotos={1}
            label="Freight receipt photo"
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Submit */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitDisabled]}
          onPress={handleCheckIn}
          disabled={!canSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="log-in" size={20} color="#fff" />
              <Text style={styles.submitText}>Check In</Text>
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
  jobAddress: { fontSize: 14, color: "#94a3b8", marginBottom: 2 },
  jobTime: { fontSize: 13, color: "#64748b" },
  step: { marginBottom: 20 },
  stepHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
  },
  stepDone: { backgroundColor: "#10b981" },
  stepNumText: { color: "#f8fafc", fontWeight: "700", fontSize: 13 },
  stepTitle: { fontSize: 16, fontWeight: "700", color: "#f8fafc" },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#334155",
  },
  gpsBtnText: { color: "#14b8a6", fontWeight: "700", fontSize: 15 },
  gpsSuccess: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
  },
  gpsSuccessText: { color: "#10b981", fontWeight: "600", fontSize: 14 },
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
  gateCard: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  gateTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f8fafc",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  gateSubtitle: {
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  gateProgressBar: {
    width: "80%",
    height: 8,
    backgroundColor: "#334155",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 24,
  },
  gateProgressFill: {
    height: 8,
    backgroundColor: "#f59e0b",
    borderRadius: 4,
  },
  gateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#14b8a6",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginBottom: 12,
  },
  gateBtnText: { fontSize: 17, fontWeight: "800", color: "#fff" },
  gateBackBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  gateBackText: { fontSize: 15, fontWeight: "600", color: "#64748b" },
});
