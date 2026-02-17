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
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Ionicons } from "@expo/vector-icons";
import { db, storage } from "../../../../src/lib/firebase";
import { useAuth } from "../../../../src/hooks/useAuth";
import { COLLECTIONS } from "../../../../src/constants/collections";
import PhotoGrid from "../../../../src/components/PhotoGrid";
import {
  GYM_EQUIPMENT_CATALOG,
  MANUFACTURER_SUPPORT,
  BOLD_SERIES_SETS,
  STANDARD_SHELVING,
  OVERHEAD_STORAGE,
} from "../../../../src/constants/productCatalog";
import type { ServiceJob } from "../../../../src/types";

export default function EscalateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuth();
  const router = useRouter();
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [attemptedSolutions, setAttemptedSolutions] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

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

  // Build equipment options from job's product selections
  const equipmentOptions: { id: string; name: string; brand: string }[] = [];
  if (job?.productSelections) {
    const sel = job.productSelections as any;
    // Gym equipment
    if (sel.gymEquipment) {
      for (const item of sel.gymEquipment) {
        const cat = GYM_EQUIPMENT_CATALOG.find((e) => e.id === item.id);
        if (cat) {
          equipmentOptions.push({ id: cat.id, name: cat.name, brand: cat.brand });
        } else if (item.customName) {
          equipmentOptions.push({ id: item.id, name: item.customName, brand: "other" });
        }
      }
    }
    // Bold Series
    if (sel.boldSeriesId) {
      const bold = BOLD_SERIES_SETS.find((b) => b.id === sel.boldSeriesId);
      if (bold) {
        equipmentOptions.push({ id: bold.id, name: `Bold Series ${bold.name}`, brand: "newage" });
      }
    }
    // Shelving
    if (sel.standardShelving) {
      for (const item of sel.standardShelving) {
        const shelf = STANDARD_SHELVING.find((s) => s.id === item.id);
        if (shelf) {
          equipmentOptions.push({ id: shelf.id, name: shelf.name, brand: "other" });
        }
      }
    }
    // Overhead
    if (sel.overheadStorage) {
      for (const item of sel.overheadStorage) {
        const oh = OVERHEAD_STORAGE.find((o) => o.id === item.id);
        if (oh) {
          equipmentOptions.push({ id: oh.id, name: oh.name, brand: "other" });
        }
      }
    }
  }
  equipmentOptions.push({ id: "other", name: "Other / Not Listed", brand: "other" });

  // Get manufacturer support info for selected equipment
  const selectedEquip = GYM_EQUIPMENT_CATALOG.find((e) => e.id === selectedEquipmentId);
  const supportInfo =
    selectedEquip?.brand === "rep"
      ? MANUFACTURER_SUPPORT.rep
      : selectedEquip?.brand === "rogue"
        ? MANUFACTURER_SUPPORT.rogue
        : equipmentOptions.find((e) => e.id === selectedEquipmentId)?.brand === "newage"
          ? MANUFACTURER_SUPPORT.newage
          : null;

  const uploadFile = async (uri: string, path: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    return getDownloadURL(storageRef);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert("Required", "Please describe the problem.");
      return;
    }
    if (!attemptedSolutions.trim()) {
      Alert.alert("Required", "Please describe what you already tried.");
      return;
    }
    if (photos.length === 0) {
      Alert.alert("Required", "Please take at least 1 photo of the issue.");
      return;
    }
    if (!job || !user || !id) return;

    setSubmitting(true);
    try {
      // Create doc first to get ID for photo paths
      const escalationRef = await addDoc(collection(db, COLLECTIONS.ESCALATIONS), {
        jobId: id,
        jobTitle: job.title || "Untitled Job",
        scholarId: user.uid,
        scholarName: profile?.name || "Scholar",
        status: "open",
        description: description.trim(),
        attemptedSolutions: attemptedSolutions.trim(),
        equipmentId: selectedEquipmentId || undefined,
        equipmentName:
          equipmentOptions.find((e) => e.id === selectedEquipmentId)?.name || undefined,
        photoUrls: [], // Will update after upload
        responses: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Upload photos
      const photoUrls = await Promise.all(
        photos.map((uri, i) =>
          uploadFile(
            uri,
            `gs_escalation_photos/${escalationRef.id}/photo_${i}_${Date.now()}.jpg`,
          ),
        ),
      );

      // Update with photo URLs
      const { updateDoc: updateDocFn } = await import("firebase/firestore");
      await updateDocFn(escalationRef, { photoUrls });

      Alert.alert(
        "Help is on the way!",
        "Your issue has been reported. Admins and other scholars have been notified. Continue working on other tasks while you wait.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to submit escalation.");
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
    description.trim().length > 0 &&
    attemptedSolutions.trim().length > 0 &&
    photos.length > 0 &&
    !submitting;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Job summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.jobTitle}>{job.title}</Text>
          <Text style={styles.jobAddress}>{job.address}</Text>
        </View>

        {/* Equipment picker */}
        {equipmentOptions.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What equipment?</Text>
            {equipmentOptions.map((eq) => (
              <TouchableOpacity
                key={eq.id}
                style={[
                  styles.equipOption,
                  selectedEquipmentId === eq.id && styles.equipOptionSelected,
                ]}
                onPress={() => setSelectedEquipmentId(eq.id)}
              >
                <Ionicons
                  name={
                    selectedEquipmentId === eq.id
                      ? "radio-button-on"
                      : "radio-button-off"
                  }
                  size={20}
                  color={selectedEquipmentId === eq.id ? "#14b8a6" : "#64748b"}
                />
                <Text style={styles.equipText}>{eq.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Manufacturer support tip */}
        {supportInfo && (
          <View style={styles.tipCard}>
            <Ionicons name="call" size={18} color="#14b8a6" />
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>Try calling {supportInfo.name} first!</Text>
              <Text style={styles.tipText}>
                {supportInfo.phone} ({supportInfo.hours})
              </Text>
              <Text style={styles.tipText}>{supportInfo.note}</Text>
            </View>
          </View>
        )}

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What's the problem?</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the issue clearly..."
            placeholderTextColor="#475569"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* What they tried */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What have you already tried?</Text>
          <TextInput
            style={styles.textArea}
            value={attemptedSolutions}
            onChangeText={setAttemptedSolutions}
            placeholder="List everything you've tried so far..."
            placeholderTextColor="#475569"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Photos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos of the issue (min 1)</Text>
          <PhotoGrid
            photos={photos}
            onPhotosChanged={setPhotos}
            minPhotos={1}
            label="Issue Photos"
          />
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
              <Ionicons name="alert-circle" size={20} color="#fff" />
              <Text style={styles.submitText}>Submit Escalation</Text>
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
  jobAddress: { fontSize: 14, color: "#94a3b8" },
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
  equipOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  equipOptionSelected: {
    backgroundColor: "#14b8a610",
  },
  equipText: { fontSize: 15, color: "#f8fafc" },
  tipCard: {
    backgroundColor: "#042f2e",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#14b8a640",
  },
  tipTitle: { fontSize: 14, fontWeight: "700", color: "#14b8a6", marginBottom: 2 },
  tipText: { fontSize: 13, color: "#94a3b8" },
  textArea: {
    backgroundColor: "#0f1b2d",
    borderRadius: 8,
    padding: 12,
    color: "#f8fafc",
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#334155",
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
    backgroundColor: "#ef4444",
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
