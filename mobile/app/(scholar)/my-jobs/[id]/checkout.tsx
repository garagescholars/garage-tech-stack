import { useState, useEffect, useCallback } from "react";
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
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter, Link } from "expo-router";
import { doc, getDoc, updateDoc, setDoc, collection, serverTimestamp, Timestamp, arrayUnion } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Ionicons } from "@expo/vector-icons";
import { httpsCallable } from "firebase/functions";
import { db, storage, functions } from "../../../../src/lib/firebase";
import { useAuth } from "../../../../src/hooks/useAuth";
import { COLLECTIONS } from "../../../../src/constants/collections";
import { getCurrentLocation } from "../../../../src/lib/geofence";
import { useJobEscalations } from "../../../../src/hooks/useEscalations";
import VideoRecorder from "../../../../src/components/VideoRecorder";
import PhotoGrid from "../../../../src/components/PhotoGrid";
import GuidedItemCapture, {
  RESALE_ANGLES,
  DONATION_ANGLES,
  GYM_INSTALL_ANGLES,
} from "../../../../src/components/GuidedItemCapture";
import { MIN_AFTER_PHOTOS } from "../../../../src/constants/urgency";
import type { ServiceJob, GsResaleDonationItem } from "../../../../src/types";

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

  // Resale / Donation / Gym states
  const [resaleChoice, setResaleChoice] = useState<"pending" | "has_items" | "none">("pending");
  const [donationChoice, setDonationChoice] = useState<"pending" | "has_items" | "none">("pending");
  const [gymChoice, setGymChoice] = useState<"pending" | "has_items" | "none">("pending");

  const [resaleItems, setResaleItems] = useState<Array<{
    id: string;
    photos: Record<string, string>;
    photoUrls: Record<string, string>;
    name: string;
    description: string;
    condition: string;
    estimatedPrice: string;
    category: string;
    confirmed: boolean;
    analyzing: boolean;
  }>>([]);
  const [donationItems, setDonationItems] = useState<Array<{
    id: string;
    photos: Record<string, string>;
    photoUrls: Record<string, string>;
    name: string;
    description: string;
    confirmed: boolean;
    analyzing: boolean;
  }>>([]);
  const [gymPhotos, setGymPhotos] = useState<Record<string, string>>({});
  const [gymPhotoUrls, setGymPhotoUrls] = useState<string[]>([]);
  const [gymEquipmentList, setGymEquipmentList] = useState<string[]>([]);

  const [showResaleCapture, setShowResaleCapture] = useState(false);
  const [showDonationCapture, setShowDonationCapture] = useState(false);
  const [showGymCapture, setShowGymCapture] = useState(false);
  const [uploadingItems, setUploadingItems] = useState(false);

  // Editing item state (for AI review)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCondition, setEditCondition] = useState("");
  const [editPrice, setEditPrice] = useState("");

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
      // Auto-detect gym equipment from productSelections
      const ps = data.productSelections as any;
      if (ps?.gymEquipment && Array.isArray(ps.gymEquipment) && ps.gymEquipment.length > 0) {
        setGymEquipmentList(ps.gymEquipment.map((e: any) => e.customName || e.id || "Equipment"));
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

  const uploadItemPhotos = async (photos: Record<string, string>, folder: string): Promise<Record<string, string>> => {
    const urls: Record<string, string> = {};
    for (const [key, uri] of Object.entries(photos)) {
      const path = `gs_item_photos/${id}/${folder}/${key}_${Date.now()}.jpg`;
      urls[key] = await uploadFile(uri, path);
    }
    return urls;
  };

  const analyzeItemWithAI = async (
    photoUrls: Record<string, string>,
    itemType: "resale" | "donation"
  ): Promise<{ name: string; description: string; condition: string; estimatedPrice?: number; category: string } | null> => {
    try {
      const analyzeItem = httpsCallable(functions, "gsAnalyzeItem");
      const result = await analyzeItem({ photoUrls: Object.values(photoUrls), itemType });
      return (result.data as any) || null;
    } catch (err) {
      console.error("AI analysis failed:", err);
      return null;
    }
  };

  const handleResalePhotosComplete = async (photos: Record<string, string>) => {
    setShowResaleCapture(false);
    const itemId = `resale_${Date.now()}`;
    const newItem = {
      id: itemId,
      photos,
      photoUrls: {} as Record<string, string>,
      name: "",
      description: "",
      condition: "good",
      estimatedPrice: "",
      category: "",
      confirmed: false,
      analyzing: true,
    };
    setResaleItems((prev) => [...prev, newItem]);

    try {
      const urls = await uploadItemPhotos(photos, `resale/${itemId}`);
      const ai = await analyzeItemWithAI(urls, "resale");
      setResaleItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                photoUrls: urls,
                name: ai?.name || "",
                description: ai?.description || "",
                condition: ai?.condition || "good",
                estimatedPrice: ai?.estimatedPrice?.toString() || "",
                category: ai?.category || "",
                analyzing: false,
              }
            : item
        )
      );
    } catch {
      setResaleItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, analyzing: false } : item))
      );
    }
  };

  const handleDonationPhotosComplete = async (photos: Record<string, string>) => {
    setShowDonationCapture(false);
    const itemId = `donation_${Date.now()}`;
    const newItem = {
      id: itemId,
      photos,
      photoUrls: {} as Record<string, string>,
      name: "",
      description: "",
      confirmed: false,
      analyzing: true,
    };
    setDonationItems((prev) => [...prev, newItem]);

    try {
      const urls = await uploadItemPhotos(photos, `donation/${itemId}`);
      const ai = await analyzeItemWithAI(urls, "donation");
      setDonationItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                photoUrls: urls,
                name: ai?.name || "",
                description: ai?.description || "",
                analyzing: false,
              }
            : item
        )
      );
    } catch {
      setDonationItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, analyzing: false } : item))
      );
    }
  };

  const handleGymPhotosComplete = async (photos: Record<string, string>) => {
    setShowGymCapture(false);
    setGymPhotos(photos);
    try {
      const urls = await uploadItemPhotos(photos, "gym_install");
      setGymPhotoUrls(Object.values(urls));
    } catch {
      Alert.alert("Error", "Failed to upload gym photos. Please try again.");
    }
  };

  const confirmResaleItem = (itemId: string) => {
    const item = resaleItems.find((i) => i.id === itemId);
    if (!item) return;
    Alert.alert(
      "Confirm Item",
      `List as "${item.name}" for ~$${item.estimatedPrice}?\n\nCondition: ${item.condition}`,
      [
        { text: "Edit", onPress: () => startEditingItem(itemId, "resale") },
        {
          text: "Confirm",
          onPress: () => {
            setResaleItems((prev) =>
              prev.map((i) => (i.id === itemId ? { ...i, confirmed: true } : i))
            );
          },
        },
      ]
    );
  };

  const confirmDonationItem = (itemId: string) => {
    const item = donationItems.find((i) => i.id === itemId);
    if (!item) return;
    Alert.alert(
      "Confirm Donation Item",
      `Donate "${item.name}"?\n\n${item.description}`,
      [
        { text: "Edit", onPress: () => startEditingItem(itemId, "donation") },
        {
          text: "Confirm",
          onPress: () => {
            setDonationItems((prev) =>
              prev.map((i) => (i.id === itemId ? { ...i, confirmed: true } : i))
            );
          },
        },
      ]
    );
  };

  const startEditingItem = (itemId: string, type: "resale" | "donation") => {
    if (type === "resale") {
      const item = resaleItems.find((i) => i.id === itemId);
      if (!item) return;
      setEditName(item.name);
      setEditDescription(item.description);
      setEditCondition(item.condition);
      setEditPrice(item.estimatedPrice);
    } else {
      const item = donationItems.find((i) => i.id === itemId);
      if (!item) return;
      setEditName(item.name);
      setEditDescription(item.description);
      setEditCondition("");
      setEditPrice("");
    }
    setEditingItemId(itemId);
  };

  const saveEditedItem = () => {
    if (!editingItemId) return;
    if (editingItemId.startsWith("resale_")) {
      setResaleItems((prev) =>
        prev.map((i) =>
          i.id === editingItemId
            ? { ...i, name: editName, description: editDescription, condition: editCondition, estimatedPrice: editPrice }
            : i
        )
      );
    } else {
      setDonationItems((prev) =>
        prev.map((i) =>
          i.id === editingItemId
            ? { ...i, name: editName, description: editDescription }
            : i
        )
      );
    }
    setEditingItemId(null);
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

    // Validate resale/donation/gym sections addressed
    if (resaleChoice === "pending") {
      Alert.alert("Resale Required", "Please indicate if there are resale items or select 'No resale items'.");
      return;
    }
    if (donationChoice === "pending") {
      Alert.alert("Donation Required", "Please indicate if there are donation items or select 'No donation items'.");
      return;
    }
    if (gymChoice === "pending") {
      Alert.alert("Gym Install Required", "Please indicate if a gym was installed or select 'No gym installation'.");
      return;
    }

    // Validate all resale items confirmed
    if (resaleChoice === "has_items") {
      const unconfirmed = resaleItems.filter((i) => !i.confirmed);
      if (unconfirmed.length > 0) {
        Alert.alert("Confirm Items", "Please confirm all resale items before checking out.");
        return;
      }
      if (resaleItems.length === 0) {
        Alert.alert("No Items", "Please add at least one resale item or select 'No resale items'.");
        return;
      }
    }

    // Validate all donation items confirmed
    if (donationChoice === "has_items") {
      const unconfirmed = donationItems.filter((i) => !i.confirmed);
      if (unconfirmed.length > 0) {
        Alert.alert("Confirm Items", "Please confirm all donation items before checking out.");
        return;
      }
      if (donationItems.length === 0) {
        Alert.alert("No Items", "Please add at least one donation item or select 'No donation items'.");
        return;
      }
    }

    // Validate gym photos
    if (gymChoice === "has_items" && Object.keys(gymPhotos).length === 0) {
      Alert.alert("Gym Photos Required", "Please capture gym installation photos.");
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

      // Save resale items to Firestore
      if (resaleChoice === "has_items") {
        for (const item of resaleItems) {
          const itemDocRef = doc(collection(db, COLLECTIONS.RESALE_DONATION_ITEMS));
          await setDoc(itemDocRef, {
            jobId: id,
            type: "resale",
            photos: item.photoUrls,
            aiSuggestion: {
              name: item.name,
              description: item.description,
              condition: item.condition,
              estimatedPrice: parseFloat(item.estimatedPrice) || 0,
              category: item.category,
            },
            workerConfirmed: {
              name: item.name,
              description: item.description,
              condition: item.condition,
              estimatedPrice: parseFloat(item.estimatedPrice) || 0,
              confirmedAt: serverTimestamp(),
            },
            status: "worker_confirmed",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      // Save donation items to Firestore
      if (donationChoice === "has_items") {
        for (const item of donationItems) {
          const itemDocRef = doc(collection(db, COLLECTIONS.RESALE_DONATION_ITEMS));
          await setDoc(itemDocRef, {
            jobId: id,
            type: "donation",
            photos: item.photoUrls,
            aiSuggestion: {
              name: item.name,
              description: item.description,
              condition: "good",
              category: "donation",
            },
            workerConfirmed: {
              name: item.name,
              description: item.description,
              condition: "good",
              confirmedAt: serverTimestamp(),
            },
            status: "worker_confirmed",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      // Save gym install photos to Firestore
      if (gymChoice === "has_items" && gymPhotoUrls.length > 0) {
        const gymDocRef = doc(collection(db, COLLECTIONS.GYM_INSTALL_PHOTOS));
        await setDoc(gymDocRef, {
          jobId: id,
          photos: gymPhotoUrls,
          equipmentInstalled: gymEquipmentList,
          capturedAt: serverTimestamp(),
          capturedBy: scholarId,
        });
      }

      // Update the existing gs_jobCheckins document with checkout data
      await updateDoc(doc(db, COLLECTIONS.JOB_CHECKINS, checkinDocId), {
        checkoutTime: serverTimestamp(),
        checkoutLat,
        checkoutLng,
        checkoutVideoUrl: videoUrl || "",
        afterPhotos: photoUrls,
      });

      // Update job status to REVIEW_PENDING with checkout tracking
      await updateDoc(doc(db, COLLECTIONS.JOBS, id), {
        status: "REVIEW_PENDING",
        checklist,
        resaleStatus: resaleChoice === "has_items" ? "captured" : "not_applicable",
        donationStatus: donationChoice === "has_items" ? "captured" : "not_applicable",
        gymInstallStatus: gymChoice === "has_items" ? "captured" : "not_applicable",
        updatedAt: serverTimestamp(),
      });

      const hasDonation = donationChoice === "has_items";
      Alert.alert(
        "Checked Out!",
        hasDonation
          ? "Great work! Your job is under review. Remember to drop off donation items and upload the receipt."
          : "Great work! Your job is now under review. The 48-hour quality window has started.",
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

  const resaleReady = resaleChoice === "none" || (resaleChoice === "has_items" && resaleItems.length > 0 && resaleItems.every((i) => i.confirmed));
  const donationReady = donationChoice === "none" || (donationChoice === "has_items" && donationItems.length > 0 && donationItems.every((i) => i.confirmed));
  const gymReady = gymChoice === "none" || (gymChoice === "has_items" && Object.keys(gymPhotos).length > 0);
  const allSectionsReady = resaleChoice !== "pending" && donationChoice !== "pending" && gymChoice !== "pending" && resaleReady && donationReady && gymReady;
  const canSubmit = afterPhotos.length >= MIN_AFTER_PHOTOS && allSectionsReady && !submitting;

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
                    color={isRejected ? "#475569" : item.completed ? "#10b981" : "#5a6a80"}
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
                  <Ionicons name="close" size={18} color="#8b9bb5" />
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

        {/* ─── RESALE ITEMS ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Step 3: Resale Items</Text>
            {resaleChoice === "none" && <Ionicons name="checkmark-circle" size={20} color="#10b981" />}
            {resaleChoice === "has_items" && resaleReady && <Ionicons name="checkmark-circle" size={20} color="#10b981" />}
            {resaleChoice === "pending" && <Ionicons name="ellipse" size={12} color="#f59e0b" />}
          </View>

          {resaleChoice === "pending" && (
            <View style={styles.choiceRow}>
              <TouchableOpacity style={styles.choiceBtn} onPress={() => setResaleChoice("has_items")}>
                <Ionicons name="pricetag-outline" size={20} color="#f59e0b" />
                <Text style={styles.choiceBtnText}>Customer has resale items</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.choiceBtnAlt} onPress={() => setResaleChoice("none")}>
                <Ionicons name="close-circle-outline" size={20} color="#8b9bb5" />
                <Text style={styles.choiceBtnAltText}>No resale items</Text>
              </TouchableOpacity>
            </View>
          )}

          {resaleChoice === "none" && (
            <View style={styles.noneSelected}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.noneText}>No resale items for this job</Text>
              <TouchableOpacity onPress={() => setResaleChoice("pending")}>
                <Text style={styles.changeText}>Change</Text>
              </TouchableOpacity>
            </View>
          )}

          {resaleChoice === "has_items" && (
            <View>
              {/* List of captured resale items */}
              {resaleItems.map((item) => (
                <View key={item.id} style={styles.itemCard}>
                  {item.photos.front && (
                    <Image source={{ uri: item.photos.front }} style={styles.itemThumb} />
                  )}
                  <View style={styles.itemInfo}>
                    {item.analyzing ? (
                      <View style={styles.analyzingRow}>
                        <ActivityIndicator size="small" color="#14b8a6" />
                        <Text style={styles.analyzingText}>AI analyzing item...</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.itemName}>{item.name || "Unnamed item"}</Text>
                        <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
                        {item.estimatedPrice ? (
                          <Text style={styles.itemPrice}>~${item.estimatedPrice} · {item.condition}</Text>
                        ) : null}
                      </>
                    )}
                  </View>
                  {!item.analyzing && !item.confirmed && (
                    <View style={styles.itemActions}>
                      <TouchableOpacity onPress={() => startEditingItem(item.id, "resale")}>
                        <Ionicons name="create-outline" size={20} color="#8b9bb5" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => confirmResaleItem(item.id)}>
                        <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                      </TouchableOpacity>
                    </View>
                  )}
                  {item.confirmed && (
                    <Ionicons name="checkmark-done" size={22} color="#10b981" />
                  )}
                </View>
              ))}

              <TouchableOpacity style={styles.addItemBtn} onPress={() => setShowResaleCapture(true)}>
                <Ionicons name="add-circle-outline" size={20} color="#f59e0b" />
                <Text style={styles.addItemText}>Add Resale Item</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.changeLinkRow} onPress={() => { setResaleChoice("pending"); setResaleItems([]); }}>
                <Text style={styles.changeText}>Change to "No resale items"</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ─── DONATION ITEMS ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Step 4: Donation Items</Text>
            {donationChoice === "none" && <Ionicons name="checkmark-circle" size={20} color="#10b981" />}
            {donationChoice === "has_items" && donationReady && <Ionicons name="checkmark-circle" size={20} color="#10b981" />}
            {donationChoice === "pending" && <Ionicons name="ellipse" size={12} color="#f59e0b" />}
          </View>

          {donationChoice === "pending" && (
            <View style={styles.choiceRow}>
              <TouchableOpacity style={styles.choiceBtn} onPress={() => setDonationChoice("has_items")}>
                <Ionicons name="heart-outline" size={20} color="#a855f7" />
                <Text style={styles.choiceBtnText}>Customer has donation items</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.choiceBtnAlt} onPress={() => setDonationChoice("none")}>
                <Ionicons name="close-circle-outline" size={20} color="#8b9bb5" />
                <Text style={styles.choiceBtnAltText}>No donation items</Text>
              </TouchableOpacity>
            </View>
          )}

          {donationChoice === "none" && (
            <View style={styles.noneSelected}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.noneText}>No donation items for this job</Text>
              <TouchableOpacity onPress={() => setDonationChoice("pending")}>
                <Text style={styles.changeText}>Change</Text>
              </TouchableOpacity>
            </View>
          )}

          {donationChoice === "has_items" && (
            <View>
              {donationItems.map((item) => (
                <View key={item.id} style={styles.itemCard}>
                  {item.photos.items && (
                    <Image source={{ uri: item.photos.items }} style={styles.itemThumb} />
                  )}
                  <View style={styles.itemInfo}>
                    {item.analyzing ? (
                      <View style={styles.analyzingRow}>
                        <ActivityIndicator size="small" color="#a855f7" />
                        <Text style={styles.analyzingText}>AI analyzing items...</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.itemName}>{item.name || "Unnamed donation"}</Text>
                        <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
                      </>
                    )}
                  </View>
                  {!item.analyzing && !item.confirmed && (
                    <View style={styles.itemActions}>
                      <TouchableOpacity onPress={() => startEditingItem(item.id, "donation")}>
                        <Ionicons name="create-outline" size={20} color="#8b9bb5" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => confirmDonationItem(item.id)}>
                        <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                      </TouchableOpacity>
                    </View>
                  )}
                  {item.confirmed && (
                    <Ionicons name="checkmark-done" size={22} color="#10b981" />
                  )}
                </View>
              ))}

              <TouchableOpacity style={styles.addItemBtn} onPress={() => setShowDonationCapture(true)}>
                <Ionicons name="add-circle-outline" size={20} color="#a855f7" />
                <Text style={[styles.addItemText, { color: "#a855f7" }]}>Add Donation Items</Text>
              </TouchableOpacity>

              <View style={styles.donationNote}>
                <Ionicons name="information-circle" size={16} color="#8b9bb5" />
                <Text style={styles.donationNoteText}>
                  After checkout, drop off donations and upload the receipt for tax benefit documentation.
                </Text>
              </View>

              <TouchableOpacity style={styles.changeLinkRow} onPress={() => { setDonationChoice("pending"); setDonationItems([]); }}>
                <Text style={styles.changeText}>Change to "No donation items"</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ─── GYM INSTALLATION ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Step 5: Gym Installation</Text>
            {gymChoice === "none" && <Ionicons name="checkmark-circle" size={20} color="#10b981" />}
            {gymChoice === "has_items" && gymReady && <Ionicons name="checkmark-circle" size={20} color="#10b981" />}
            {gymChoice === "pending" && <Ionicons name="ellipse" size={12} color="#f59e0b" />}
          </View>

          {gymChoice === "pending" && (
            <View style={styles.choiceRow}>
              <TouchableOpacity style={styles.choiceBtn} onPress={() => setGymChoice("has_items")}>
                <Ionicons name="barbell-outline" size={20} color="#ef4444" />
                <Text style={styles.choiceBtnText}>Gym equipment was installed</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.choiceBtnAlt} onPress={() => setGymChoice("none")}>
                <Ionicons name="close-circle-outline" size={20} color="#8b9bb5" />
                <Text style={styles.choiceBtnAltText}>No gym installation</Text>
              </TouchableOpacity>
            </View>
          )}

          {gymChoice === "none" && (
            <View style={styles.noneSelected}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.noneText}>No gym installation for this job</Text>
              <TouchableOpacity onPress={() => setGymChoice("pending")}>
                <Text style={styles.changeText}>Change</Text>
              </TouchableOpacity>
            </View>
          )}

          {gymChoice === "has_items" && (
            <View>
              {gymEquipmentList.length > 0 && (
                <View style={styles.equipmentList}>
                  <Text style={styles.equipmentLabel}>Equipment installed:</Text>
                  {gymEquipmentList.map((name, i) => (
                    <Text key={i} style={styles.equipmentItem}>• {name}</Text>
                  ))}
                </View>
              )}

              {Object.keys(gymPhotos).length > 0 ? (
                <View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gymPhotoScroll}>
                    {Object.values(gymPhotos).map((uri, i) => (
                      <Image key={i} source={{ uri }} style={styles.gymThumb} />
                    ))}
                  </ScrollView>
                  <TouchableOpacity style={styles.retakeGymBtn} onPress={() => { setGymPhotos({}); setGymPhotoUrls([]); setShowGymCapture(true); }}>
                    <Ionicons name="camera-reverse-outline" size={16} color="#f59e0b" />
                    <Text style={styles.retakeGymText}>Retake gym photos</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.addItemBtn} onPress={() => setShowGymCapture(true)}>
                  <Ionicons name="camera-outline" size={20} color="#ef4444" />
                  <Text style={[styles.addItemText, { color: "#ef4444" }]}>Capture Gym Installation Photos</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.changeLinkRow} onPress={() => { setGymChoice("pending"); setGymPhotos({}); setGymPhotoUrls([]); }}>
                <Text style={styles.changeText}>Change to "No gym installation"</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* GuidedItemCapture Modals */}
      <Modal visible={showResaleCapture} animationType="slide">
        <GuidedItemCapture
          angles={RESALE_ANGLES}
          title="Resale Item Photos"
          onComplete={handleResalePhotosComplete}
          onCancel={() => setShowResaleCapture(false)}
        />
      </Modal>

      <Modal visible={showDonationCapture} animationType="slide">
        <GuidedItemCapture
          angles={DONATION_ANGLES}
          title="Donation Item Photos"
          onComplete={handleDonationPhotosComplete}
          onCancel={() => setShowDonationCapture(false)}
        />
      </Modal>

      <Modal visible={showGymCapture} animationType="slide">
        <GuidedItemCapture
          angles={GYM_INSTALL_ANGLES}
          title="Gym Installation Photos"
          allowExtra
          onComplete={handleGymPhotosComplete}
          onCancel={() => setShowGymCapture(false)}
        />
      </Modal>

      {/* Edit Item Modal */}
      <Modal visible={!!editingItemId} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <Text style={styles.editModalTitle}>Edit Item Details</Text>
            <Text style={styles.editLabel}>Name</Text>
            <TextInput style={styles.editInput} value={editName} onChangeText={setEditName} placeholder="Item name" placeholderTextColor="#475569" />
            <Text style={styles.editLabel}>Description</Text>
            <TextInput style={[styles.editInput, { height: 80 }]} value={editDescription} onChangeText={setEditDescription} placeholder="Item description" placeholderTextColor="#475569" multiline />
            {editingItemId?.startsWith("resale_") && (
              <>
                <Text style={styles.editLabel}>Condition</Text>
                <View style={styles.conditionRow}>
                  {["like_new", "good", "fair", "poor"].map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.conditionBtn, editCondition === c && styles.conditionBtnActive]}
                      onPress={() => setEditCondition(c)}
                    >
                      <Text style={[styles.conditionText, editCondition === c && styles.conditionTextActive]}>
                        {c.replace("_", " ")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.editLabel}>Estimated Price ($)</Text>
                <TextInput style={styles.editInput} value={editPrice} onChangeText={setEditPrice} placeholder="0.00" placeholderTextColor="#475569" keyboardType="numeric" />
              </>
            )}
            <View style={styles.editBtnRow}>
              <TouchableOpacity style={styles.editCancelBtn} onPress={() => setEditingItemId(null)}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editSaveBtn} onPress={saveEditedItem}>
                <Text style={styles.editSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  container: { flex: 1, backgroundColor: "#0a0f1a" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { color: "#ef4444", fontSize: 16 },
  scroll: { padding: 16 },
  summaryCard: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  jobTitle: { fontSize: 18, fontWeight: "800", color: "#f1f5f9", marginBottom: 4 },
  jobAddress: { fontSize: 14, color: "#8b9bb5", marginBottom: 6 },
  durationRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  durationText: { color: "#14b8a6", fontWeight: "700", fontSize: 14 },
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
    marginBottom: 12,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2a3545",
  },
  checkText: { fontSize: 15, color: "#f1f5f9", flex: 1 },
  checkTextDone: { color: "#5a6a80", textDecorationLine: "line-through" },
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
    backgroundColor: "#0a0f1a",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#f1f5f9",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#2a3545",
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
    backgroundColor: "#1a2332",
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
    color: "#5a6a80",
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
    backgroundColor: "#0a0f1a",
    borderTopWidth: 1,
    borderTopColor: "#1a2332",
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
    backgroundColor: "#1a2332",
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
    backgroundColor: "#1a2332",
    borderWidth: 1,
    borderColor: "#14b8a640",
  },
  escalationsBtnText: { fontSize: 14, fontWeight: "700", color: "#14b8a6" },
  // Resale / Donation / Gym styles
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  choiceRow: { gap: 8 },
  choiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#0a0f1a",
    borderWidth: 1,
    borderColor: "#2a3545",
    marginBottom: 8,
  },
  choiceBtnText: { color: "#f1f5f9", fontSize: 15, fontWeight: "600" },
  choiceBtnAlt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#0a0f1a",
    borderWidth: 1,
    borderColor: "#1a2332",
  },
  choiceBtnAltText: { color: "#8b9bb5", fontSize: 15, fontWeight: "600" },
  noneSelected: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  noneText: { color: "#8b9bb5", fontSize: 14, flex: 1 },
  changeText: { color: "#14b8a6", fontSize: 13, fontWeight: "700" },
  changeLinkRow: { marginTop: 12, alignItems: "center" },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    backgroundColor: "#0a0f1a",
    borderRadius: 10,
    marginBottom: 8,
  },
  itemThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: "#2a3545",
  },
  itemInfo: { flex: 1 },
  itemName: { color: "#f1f5f9", fontSize: 15, fontWeight: "700" },
  itemDesc: { color: "#8b9bb5", fontSize: 13, marginTop: 2 },
  itemPrice: { color: "#10b981", fontSize: 13, fontWeight: "600", marginTop: 2 },
  itemActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  analyzingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  analyzingText: { color: "#14b8a6", fontSize: 13, fontWeight: "600" },
  addItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#0a0f1a",
    borderWidth: 1,
    borderColor: "#2a3545",
    borderStyle: "dashed",
    marginTop: 4,
  },
  addItemText: { color: "#f59e0b", fontSize: 14, fontWeight: "700" },
  donationNote: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    padding: 10,
    backgroundColor: "#0a0f1a",
    borderRadius: 8,
    alignItems: "flex-start",
  },
  donationNoteText: { color: "#8b9bb5", fontSize: 12, flex: 1, lineHeight: 17 },
  equipmentList: { marginBottom: 12 },
  equipmentLabel: { color: "#8b9bb5", fontSize: 13, fontWeight: "700", marginBottom: 4 },
  equipmentItem: { color: "#cbd5e1", fontSize: 14, marginLeft: 8 },
  gymPhotoScroll: { marginBottom: 8 },
  gymThumb: {
    width: 100,
    height: 100,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: "#2a3545",
  },
  retakeGymBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-end",
  },
  retakeGymText: { color: "#f59e0b", fontSize: 13, fontWeight: "700" },
  // Edit modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 20,
  },
  editModal: {
    backgroundColor: "#1a2332",
    borderRadius: 16,
    padding: 20,
  },
  editModalTitle: { color: "#f1f5f9", fontSize: 18, fontWeight: "800", marginBottom: 16 },
  editLabel: { color: "#8b9bb5", fontSize: 12, fontWeight: "700", textTransform: "uppercase", marginBottom: 4, marginTop: 10 },
  editInput: {
    backgroundColor: "#0a0f1a",
    borderRadius: 8,
    padding: 10,
    color: "#f1f5f9",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#2a3545",
  },
  conditionRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  conditionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#0a0f1a",
    borderWidth: 1,
    borderColor: "#2a3545",
  },
  conditionBtnActive: { borderColor: "#14b8a6", backgroundColor: "#14b8a620" },
  conditionText: { color: "#8b9bb5", fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
  conditionTextActive: { color: "#14b8a6" },
  editBtnRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  editCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#0a0f1a",
    alignItems: "center",
  },
  editCancelText: { color: "#8b9bb5", fontSize: 15, fontWeight: "700" },
  editSaveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#14b8a6",
    alignItems: "center",
  },
  editSaveText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
