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
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { db, storage } from "../../../../src/lib/firebase";
import { useAuth } from "../../../../src/hooks/useAuth";
import { COLLECTIONS } from "../../../../src/constants/collections";
import type { ServiceJob, GsResaleDonationItem } from "../../../../src/types";

export default function DonationReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [donationItems, setDonationItems] = useState<GsResaleDonationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [donationCenter, setDonationCenter] = useState("");

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    // Load job
    const jobSnap = await getDoc(doc(db, COLLECTIONS.JOBS, id));
    if (jobSnap.exists()) {
      setJob({ id: jobSnap.id, ...jobSnap.data() } as ServiceJob);
    }

    // Load donation items for this job
    const q = query(
      collection(db, COLLECTIONS.RESALE_DONATION_ITEMS),
      where("jobId", "==", id),
      where("type", "==", "donation")
    );
    const snap = await getDocs(q);
    const items: GsResaleDonationItem[] = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() } as GsResaleDonationItem));
    setDonationItems(items);

    setLoading(false);
  };

  const takeReceiptPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Needed", "Camera access is required to take the receipt photo.");
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setReceiptUri(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to take photo");
    }
  };

  const handleSubmit = async () => {
    if (!receiptUri || !donationCenter.trim() || !id || !user || !job) return;

    setSubmitting(true);
    try {
      // Upload receipt photo
      const response = await fetch(receiptUri);
      const blob = await response.blob();
      const storagePath = `gs_donation_receipts/${id}/receipt_${Date.now()}.jpg`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, blob);
      const receiptUrl = await getDownloadURL(storageRef);

      // Determine email recipients
      const customerEmail = job.clientEmail || "";
      const adminEmail = "admin@garagescholars.com";
      const emailSentTo = [adminEmail];
      if (customerEmail) emailSentTo.push(customerEmail);

      // Save donation receipt to Firestore
      const receiptDocRef = doc(collection(db, COLLECTIONS.DONATION_RECEIPTS));
      await setDoc(receiptDocRef, {
        jobId: id,
        donationCenter: donationCenter.trim(),
        receiptPhotoUrl: receiptUrl,
        itemIds: donationItems.map((i) => i.id),
        emailSentTo,
        uploadedAt: serverTimestamp(),
        uploadedBy: user.uid,
      });

      // Update job donation status
      await updateDoc(doc(db, COLLECTIONS.JOBS, id), {
        donationStatus: "receipt_uploaded",
        updatedAt: serverTimestamp(),
      });

      Alert.alert(
        "Receipt Uploaded!",
        "The donation receipt has been saved. An email with tax benefit information will be sent to the customer and admin.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to upload receipt");
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

  if (job.donationStatus === "receipt_uploaded") {
    return (
      <View style={styles.container}>
        <View style={styles.doneCard}>
          <Ionicons name="checkmark-circle" size={48} color="#10b981" />
          <Text style={styles.doneTitle}>Receipt Already Uploaded</Text>
          <Text style={styles.doneSubtitle}>
            The donation receipt for this job has been submitted and the customer has been notified.
          </Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const canSubmit = receiptUri && donationCenter.trim() && !submitting;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>Upload Donation Receipt</Text>
        <Text style={styles.pageSubtitle}>
          Take a photo of the donation receipt from the drop-off center. This will be emailed to the customer for tax benefit documentation.
        </Text>

        {/* Donation items summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Donated Items ({donationItems.length})</Text>
          {donationItems.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Ionicons name="heart" size={16} color="#a855f7" />
              <Text style={styles.itemText}>
                {item.workerConfirmed?.name || "Unnamed item"}
              </Text>
            </View>
          ))}
        </View>

        {/* Donation center */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Donation Center Name</Text>
          <TextInput
            style={styles.input}
            value={donationCenter}
            onChangeText={setDonationCenter}
            placeholder="e.g. Goodwill, Salvation Army, ARC..."
            placeholderTextColor="#475569"
          />
        </View>

        {/* Receipt photo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Receipt Photo</Text>
          {receiptUri ? (
            <View>
              <Image source={{ uri: receiptUri }} style={styles.receiptImage} />
              <TouchableOpacity style={styles.retakeBtn} onPress={takeReceiptPhoto}>
                <Ionicons name="camera-reverse-outline" size={16} color="#f59e0b" />
                <Text style={styles.retakeText}>Retake Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.captureBtn} onPress={takeReceiptPhoto}>
              <Ionicons name="camera" size={24} color="#a855f7" />
              <Text style={styles.captureBtnText}>Take Receipt Photo</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Submit */}
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
              <Ionicons name="cloud-upload" size={20} color="#fff" />
              <Text style={styles.submitText}>Upload Receipt</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1a" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { color: "#ef4444", fontSize: 16 },
  scroll: { padding: 16 },
  pageTitle: { fontSize: 22, fontWeight: "800", color: "#f1f5f9", marginBottom: 4 },
  pageSubtitle: { fontSize: 14, color: "#8b9bb5", marginBottom: 20, lineHeight: 20 },
  section: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8b9bb5",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  itemText: { color: "#f1f5f9", fontSize: 15 },
  input: {
    backgroundColor: "#0a0f1a",
    borderRadius: 10,
    padding: 12,
    color: "#f1f5f9",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#2a3545",
  },
  receiptImage: {
    width: "100%",
    height: 300,
    borderRadius: 12,
    backgroundColor: "#2a3545",
  },
  retakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    alignSelf: "flex-end",
  },
  retakeText: { color: "#f59e0b", fontSize: 13, fontWeight: "700" },
  captureBtn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 40,
    borderRadius: 12,
    backgroundColor: "#0a0f1a",
    borderWidth: 2,
    borderColor: "#a855f740",
    borderStyle: "dashed",
  },
  captureBtnText: { color: "#a855f7", fontSize: 15, fontWeight: "700" },
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
    backgroundColor: "#a855f7",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { fontSize: 17, fontWeight: "800", color: "#fff" },
  // Done state
  doneCard: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  doneTitle: { color: "#f1f5f9", fontSize: 20, fontWeight: "800" },
  doneSubtitle: { color: "#8b9bb5", fontSize: 15, textAlign: "center", lineHeight: 22 },
  backBtn: {
    backgroundColor: "#1a2332",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  backBtnText: { color: "#14b8a6", fontSize: 15, fontWeight: "700" },
});
