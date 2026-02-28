import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
  ActivityIndicator,
  TextInput,
  StyleSheet,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { httpsCallable } from "firebase/functions";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc,
  where,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { db, storage, functions } from "../../src/lib/firebase";
import { COLLECTIONS } from "../../src/constants/collections";
import { useAuth } from "../../src/hooks/useAuth";
import AdminPageWrapper from "../../src/components/AdminPageWrapper";

// ── Local Types ──

type SignupRequest = {
  id: string;
  email: string;
  name: string;
  roleRequested: string;
  status: "pending" | "approved" | "declined";
  createdAt?: { seconds?: number };
};

type AdminNotification = {
  id: string;
  message: string;
  unread: boolean;
  createdAt?: { seconds?: number };
};

type JobForReview = {
  id: string;
  clientName: string;
  pay: number;
  assigneeName?: string;
  scholarId?: string;
  checkInTime?: string;
  checkOutTime?: string;
  checkInMedia?: { photoFrontOfHouse: string };
  checkOutMedia?: { photoFrontOfHouse: string; videoGarage: string };
  checklist: { id: string; text: string; isCompleted: boolean }[];
  status: string;
};

type CompletedJob = {
  id: string;
  clientName: string;
  address: string;
  date: string;
  inventoryExtracted: boolean;
  extractedItemIds?: string[];
};

// ── Job Status Constants ──

const JobStatus = {
  REVIEW_PENDING: "REVIEW_PENDING" as const,
  COMPLETED: "COMPLETED" as const,
};

// ── Skeleton Loader ──

function SkeletonBlock({
  width,
  height,
  style,
}: {
  width: number | string;
  height: number;
  style?: object;
}) {
  return (
    <View
      style={[
        {
          width: width as any,
          height,
          backgroundColor: "rgba(255,255,255,0.06)",
          borderRadius: 8,
        },
        style,
      ]}
    />
  );
}

function SectionSkeleton() {
  return (
    <View style={styles.card}>
      <SkeletonBlock width="40%" height={14} />
      <View style={{ marginTop: 16, gap: 10 }}>
        <SkeletonBlock width="100%" height={56} />
        <SkeletonBlock width="100%" height={56} />
      </View>
    </View>
  );
}

// ── Empty State ──

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name={icon} size={36} color="#2a3545" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

// ── Badge ──

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count}</Text>
    </View>
  );
}

// ── Review Modal ──

function ReviewModal({
  job,
  onClose,
  onApprove,
  onRequestChanges,
  busy,
}: {
  job: JobForReview;
  onClose: () => void;
  onApprove: () => void;
  onRequestChanges: (notes: string) => void;
  busy: boolean;
}) {
  const [adminNotes, setAdminNotes] = useState("");
  const [showChangesForm, setShowChangesForm] = useState(false);
  const [checkInPhotoUrl, setCheckInPhotoUrl] = useState<string | null>(null);
  const [checkOutPhotoUrl, setCheckOutPhotoUrl] = useState<string | null>(null);
  const [checkOutVideoUrl, setCheckOutVideoUrl] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const getUrl = async (path: string): Promise<string> => {
      if (!path || path === "") return "";
      if (path.startsWith("data:")) return path;
      if (storage && !path.startsWith("http")) {
        return await getDownloadURL(storageRef(storage, path));
      }
      return path;
    };

    const loadMedia = async () => {
      try {
        if (job.checkInMedia?.photoFrontOfHouse) {
          const url = await getUrl(job.checkInMedia.photoFrontOfHouse);
          if (!cancelled && url) setCheckInPhotoUrl(url);
        }

        if (job.checkOutMedia) {
          const checkOutPhoto =
            (job.checkOutMedia as any).photoAfter ||
            job.checkOutMedia.photoFrontOfHouse;
          if (checkOutPhoto) {
            const url = await getUrl(checkOutPhoto);
            if (!cancelled && url) setCheckOutPhotoUrl(url);
          }

          if (job.checkOutMedia.videoGarage) {
            const url = await getUrl(job.checkOutMedia.videoGarage);
            if (!cancelled && url) setCheckOutVideoUrl(url);
          }
        }
      } catch (err) {
        console.error("Failed to load media:", err);
      } finally {
        if (!cancelled) setMediaLoading(false);
      }
    };

    loadMedia();
    return () => {
      cancelled = true;
    };
  }, [job]);

  const workDuration =
    job.checkInTime && job.checkOutTime
      ? Math.round(
          (new Date(job.checkOutTime).getTime() -
            new Date(job.checkInTime).getTime()) /
            (1000 * 60)
        )
      : null;

  const halfPay = (job.pay / 2).toFixed(2);

  const renderVideoPlayer = () => {
    if (!checkOutVideoUrl) {
      return (
        <View style={[modalStyles.mediaPlaceholder, { borderColor: "#f87171" }]}>
          <Ionicons name="warning-outline" size={24} color="#f87171" />
          <Text style={[modalStyles.mediaPlaceholderText, { color: "#f87171" }]}>
            Video not uploaded - Required for QA
          </Text>
        </View>
      );
    }

    if (Platform.OS === "web") {
      // On web, render an HTML video element via dangerouslySetInnerHTML workaround
      // We use a simple approach: Image component won't play video, so we use a View placeholder
      // and instruct user to open in browser. For true web playback, use a WebView or html video.
      return (
        <TouchableOpacity
          style={modalStyles.videoContainer}
          onPress={() => {
            if (typeof window !== "undefined" && checkOutVideoUrl) {
              window.open(checkOutVideoUrl, "_blank");
            }
          }}
          activeOpacity={0.7}
        >
          <View style={modalStyles.videoPlayOverlay}>
            <Ionicons name="play-circle" size={48} color="#14b8a6" />
            <Text style={modalStyles.videoPlayText}>Tap to play video</Text>
          </View>
        </TouchableOpacity>
      );
    }

    // Native: use expo-av Video
    try {
      const { Video, ResizeMode } = require("expo-av");
      return (
        <Video
          source={{ uri: checkOutVideoUrl }}
          style={modalStyles.video}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={false}
        />
      );
    } catch {
      return (
        <View style={modalStyles.mediaPlaceholder}>
          <Text style={modalStyles.mediaPlaceholderText}>
            Video player unavailable
          </Text>
        </View>
      );
    }
  };

  return (
    <Modal
      visible
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          {/* Header */}
          <View style={modalStyles.header}>
            <Text style={modalStyles.headerTitle} numberOfLines={1}>
              Review: {job.clientName}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color="#8b9bb5" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={modalStyles.scrollBody}
            contentContainerStyle={{ paddingBottom: 32 }}
            showsVerticalScrollIndicator={Platform.OS === "web"}
          >
            {/* Job Info */}
            <View style={modalStyles.infoBox}>
              <Text style={modalStyles.infoLabel}>
                Scholar:{" "}
                <Text style={modalStyles.infoValue}>
                  {job.assigneeName || "Unknown"}
                </Text>
              </Text>
              <Text style={modalStyles.infoLabel}>
                Total Payout:{" "}
                <Text style={[modalStyles.infoValue, { color: "#10b981" }]}>
                  ${job.pay}
                </Text>
                <Text style={modalStyles.infoMuted}>
                  {"  "}(${halfPay} now + ${halfPay} after 24h)
                </Text>
              </Text>
              {workDuration !== null && (
                <Text style={modalStyles.infoLabel}>
                  Work Duration:{" "}
                  <Text style={modalStyles.infoValue}>
                    {workDuration} minutes
                  </Text>
                </Text>
              )}
            </View>

            {/* Payment Policy */}
            <View style={modalStyles.policyBox}>
              <Text style={modalStyles.policyText}>
                <Text style={{ fontWeight: "700" }}>Payment Policy:</Text> 50%
                paid immediately upon approval. Remaining 50% automatically
                released 24 hours after job completion if no client complaints
                are filed.
              </Text>
            </View>

            {/* Media */}
            <Text style={modalStyles.sectionLabel}>Check-In Photo</Text>
            {mediaLoading ? (
              <View style={modalStyles.mediaPlaceholder}>
                <ActivityIndicator size="small" color="#14b8a6" />
              </View>
            ) : checkInPhotoUrl ? (
              <Image
                source={{ uri: checkInPhotoUrl }}
                style={modalStyles.photo}
                resizeMode="cover"
              />
            ) : (
              <View style={modalStyles.mediaPlaceholder}>
                <Text style={modalStyles.mediaPlaceholderText}>
                  No check-in photo
                </Text>
              </View>
            )}

            <Text style={[modalStyles.sectionLabel, { marginTop: 16 }]}>
              Check-Out Photo
            </Text>
            {mediaLoading ? (
              <View style={modalStyles.mediaPlaceholder}>
                <ActivityIndicator size="small" color="#14b8a6" />
              </View>
            ) : checkOutPhotoUrl ? (
              <Image
                source={{ uri: checkOutPhotoUrl }}
                style={modalStyles.photo}
                resizeMode="cover"
              />
            ) : (
              <View style={modalStyles.mediaPlaceholder}>
                <Text style={modalStyles.mediaPlaceholderText}>
                  No check-out photo
                </Text>
              </View>
            )}

            <Text style={[modalStyles.sectionLabel, { marginTop: 16 }]}>
              Check-Out Video (Garage Walkthrough)
            </Text>
            {mediaLoading ? (
              <View style={modalStyles.mediaPlaceholder}>
                <ActivityIndicator size="small" color="#14b8a6" />
              </View>
            ) : (
              renderVideoPlayer()
            )}

            {/* Checklist */}
            <Text style={[modalStyles.sectionLabel, { marginTop: 16 }]}>
              Checklist
            </Text>
            {job.checklist.length === 0 ? (
              <Text style={modalStyles.infoMuted}>No checklist items</Text>
            ) : (
              <View style={{ gap: 8 }}>
                {job.checklist.map((task) => (
                  <View key={task.id} style={modalStyles.checklistRow}>
                    <Ionicons
                      name={
                        task.isCompleted
                          ? "checkmark-circle"
                          : "ellipse-outline"
                      }
                      size={18}
                      color={task.isCompleted ? "#10b981" : "#475569"}
                    />
                    <Text
                      style={[
                        modalStyles.checklistText,
                        !task.isCompleted && { color: "#5a6a80" },
                      ]}
                    >
                      {task.text}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Actions */}
            {!showChangesForm ? (
              <View style={modalStyles.actionRow}>
                <TouchableOpacity
                  style={[modalStyles.approveBtn, busy && { opacity: 0.5 }]}
                  onPress={onApprove}
                  disabled={busy}
                  activeOpacity={0.7}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={modalStyles.approveBtnText}>
                      Approve & Pay ${halfPay} (50%)
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[modalStyles.changesBtn, busy && { opacity: 0.5 }]}
                  onPress={() => setShowChangesForm(true)}
                  disabled={busy}
                  activeOpacity={0.7}
                >
                  <Text style={modalStyles.changesBtnText}>
                    Request Changes
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ marginTop: 20, gap: 12 }}>
                <TextInput
                  style={modalStyles.notesInput}
                  placeholder="Describe what needs to be changed..."
                  placeholderTextColor="#475569"
                  multiline
                  numberOfLines={3}
                  value={adminNotes}
                  onChangeText={setAdminNotes}
                  textAlignVertical="top"
                />
                <View style={modalStyles.actionRow}>
                  <TouchableOpacity
                    style={modalStyles.cancelBtn}
                    onPress={() => setShowChangesForm(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={modalStyles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      modalStyles.changesBtn,
                      (!adminNotes.trim() || busy) && { opacity: 0.5 },
                    ]}
                    onPress={() => onRequestChanges(adminNotes)}
                    disabled={!adminNotes.trim() || busy}
                    activeOpacity={0.7}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={modalStyles.changesBtnText}>
                        Submit Changes Request
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ──

export default function AdminDashboardScreen() {
  const { profile, loading: authLoading } = useAuth();

  // Signup requests
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  // Admin notifications
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);

  // Jobs pending review
  const [jobsForReview, setJobsForReview] = useState<JobForReview[]>([]);
  const [jobsReviewLoading, setJobsReviewLoading] = useState(true);
  const [jobsReviewError, setJobsReviewError] = useState<string | null>(null);

  // Completed jobs for inventory
  const [completedJobs, setCompletedJobs] = useState<CompletedJob[]>([]);
  const [completedJobsLoading, setCompletedJobsLoading] = useState(true);

  // UI state
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewModalJob, setReviewModalJob] = useState<JobForReview | null>(null);

  // ── Real-time Listeners ──

  useEffect(() => {
    if (!db) {
      setRequestsError("Firestore not initialized.");
      setNotificationsError("Firestore not initialized.");
      setJobsReviewError("Firestore not initialized.");
      setRequestsLoading(false);
      setNotificationsLoading(false);
      setJobsReviewLoading(false);
      setCompletedJobsLoading(false);
      return;
    }

    // 1. Signup Requests
    const reqQuery = query(
      collection(db, COLLECTIONS.SIGNUP_REQUESTS),
      orderBy("createdAt", "desc")
    );
    const unsubRequests = onSnapshot(
      reqQuery,
      (snap) => {
        const rows = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<SignupRequest, "id">),
        }));
        setRequests(rows);
        setRequestsError(null);
        setRequestsLoading(false);
      },
      (err) => {
        setRequestsError(err.message || "Failed to load signup requests.");
        setRequestsLoading(false);
      }
    );

    // 2. Admin Notifications
    const notifQuery = query(
      collection(db, COLLECTIONS.ADMIN_NOTIFICATIONS),
      orderBy("createdAt", "desc")
    );
    const unsubNotifs = onSnapshot(
      notifQuery,
      (snap) => {
        const rows = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<AdminNotification, "id">),
        }));
        setNotifications(rows);
        setNotificationsError(null);
        setNotificationsLoading(false);
      },
      (err) => {
        setNotificationsError(err.message || "Failed to load notifications.");
        setNotificationsLoading(false);
      }
    );

    // 3. Jobs Pending Review
    const jobsQuery = query(
      collection(db, COLLECTIONS.JOBS),
      where("status", "==", JobStatus.REVIEW_PENDING)
    );
    const unsubJobs = onSnapshot(
      jobsQuery,
      (snap) => {
        const rows = snap.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, any>;
          return {
            id: docSnap.id,
            clientName: data.title || data.clientName || "Unknown",
            pay: data.payout ?? data.pay ?? 0,
            assigneeName: data.claimedByName || data.assigneeName,
            scholarId: data.claimedBy,
            checkInTime: data.checkInTime,
            checkOutTime: data.checkOutTime,
            checkInMedia: data.checkInMedia,
            checkOutMedia: data.checkOutMedia,
            checklist: Array.isArray(data.checklist)
              ? data.checklist.map((item: any) => ({
                  id: item.id,
                  text: item.text,
                  isCompleted: item.completed ?? item.isCompleted ?? false,
                }))
              : [],
            status: data.status,
          };
        });
        setJobsForReview(rows);
        setJobsReviewError(null);
        setJobsReviewLoading(false);
      },
      (err) => {
        setJobsReviewError(err.message || "Failed to load jobs for review.");
        setJobsReviewLoading(false);
      }
    );

    // 4. Completed Jobs for Inventory Extraction
    const completedJobsQuery = query(
      collection(db, COLLECTIONS.JOBS),
      where("status", "==", JobStatus.COMPLETED),
      orderBy("scheduledDate", "desc")
    );
    const unsubCompletedJobs = onSnapshot(
      completedJobsQuery,
      (snap) => {
        const jobs = snap.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, any>;
          return {
            id: docSnap.id,
            clientName: data.title || data.clientName || "Unknown",
            address: data.address || "",
            date: data.scheduledDate || data.date || "",
            inventoryExtracted: data.inventoryExtracted || false,
            extractedItemIds: data.extractedItemIds,
          };
        });
        setCompletedJobs(jobs);
        setCompletedJobsLoading(false);
      },
      (err) => {
        console.error("Failed to load completed jobs:", err);
        setCompletedJobsLoading(false);
      }
    );

    return () => {
      unsubRequests();
      unsubNotifs();
      unsubJobs();
      unsubCompletedJobs();
    };
  }, []);

  // ── Actions ──

  const showAlert = useCallback(
    (title: string, message: string) => {
      if (Platform.OS === "web") {
        window.alert(`${title}\n${message}`);
      } else {
        Alert.alert(title, message);
      }
    },
    []
  );

  const handleDecision = useCallback(
    async (requestId: string, action: "approve" | "decline") => {
      if (!functions) {
        setError("Functions not initialized.");
        return;
      }
      setError(null);
      setBusyId(requestId);
      try {
        const callable = httpsCallable(
          functions,
          action === "approve" ? "approveSignup" : "declineSignup"
        );
        await callable({ requestId });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Action failed.";
        setError(message);
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  const markNotificationRead = useCallback(async (id: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.ADMIN_NOTIFICATIONS, id), {
        unread: false,
      });
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
  }, []);

  const handleApproveAndPay = useCallback(
    async (job: JobForReview) => {
      if (!db) {
        setError("Firestore not initialized.");
        return;
      }
      setError(null);
      setBusyId(job.id);
      try {
        // Update job status to COMPLETED
        await updateDoc(doc(db, COLLECTIONS.JOBS, job.id), {
          status: JobStatus.COMPLETED,
          approvedAt: new Date().toISOString(),
          firstPayoutProcessed: true,
          secondPayoutDue: new Date(
            Date.now() + 24 * 60 * 60 * 1000
          ).toISOString(),
        });

        // Create payout record for FIRST HALF (50%)
        const firstHalfAmount = job.pay / 2;
        const payoutData = {
          jobId: job.id,
          scholarId: job.scholarId || "",
          recipientName: job.assigneeName || "Unknown",
          amount: firstHalfAmount,
          splitType: "checkin_50",
          status: "pending",
          paymentMethod: "stripe_ach",
          complaintWindowPassed: false,
          taxYear: new Date().getFullYear(),
          createdAt: serverTimestamp(),
        };

        await setDoc(
          doc(db, COLLECTIONS.PAYOUTS, `${job.id}_first`),
          payoutData
        );

        setReviewModalJob(null);
        showAlert(
          "Job Approved",
          `First payout of $${firstHalfAmount.toFixed(2)} created. Second half will be released in 24 hours if no complaints.`
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Approval failed.";
        setError(message);
      } finally {
        setBusyId(null);
      }
    },
    [showAlert]
  );

  const handleRequestChanges = useCallback(
    async (job: JobForReview, adminNotes: string) => {
      if (!db) {
        setError("Firestore not initialized.");
        return;
      }
      setError(null);
      setBusyId(job.id);
      try {
        await updateDoc(doc(db, COLLECTIONS.JOBS, job.id), {
          status: "CHANGES_REQUESTED",
          adminNotes,
          changesRequestedAt: new Date().toISOString(),
        });
        setReviewModalJob(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Request failed.";
        setError(message);
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  const handleExtractInventory = useCallback(
    (job: CompletedJob) => {
      showAlert(
        "Extract Inventory",
        `Inventory extraction for "${job.clientName}" will be available in a future update.`
      );
    },
    [showAlert]
  );

  // ── Derived ──

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const unreadNotifications = notifications.filter((n) => n.unread);
  const awaitingExtraction = completedJobs.filter(
    (j) => !j.inventoryExtracted
  );

  // ── Loading State ──

  if (authLoading) {
    return (
      <AdminPageWrapper>
        <View style={{ gap: 16 }}>
          <SkeletonBlock width="50%" height={28} />
          <SkeletonBlock width="30%" height={14} style={{ marginBottom: 8 }} />
          <SectionSkeleton />
          <SectionSkeleton />
          <SectionSkeleton />
        </View>
      </AdminPageWrapper>
    );
  }

  // ── Render ──

  return (
    <AdminPageWrapper>
      {/* Header */}
      <View style={styles.headerSection}>
        <Text style={styles.headerLabel}>ADMIN DASHBOARD</Text>
        <Text style={styles.headerTitle}>
          {profile?.name || "Admin"}
        </Text>
        <Text style={styles.headerSubtitle}>
          Manage scholars, jobs, and account requests.
        </Text>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statBadge, { backgroundColor: "#14b8a620" }]}>
          <Ionicons name="clipboard-outline" size={16} color="#14b8a6" />
          <Text style={[styles.statBadgeText, { color: "#14b8a6" }]}>
            {jobsForReview.length} Review
          </Text>
        </View>
        <View style={[styles.statBadge, { backgroundColor: "#3b82f620" }]}>
          <Ionicons name="person-add-outline" size={16} color="#3b82f6" />
          <Text style={[styles.statBadgeText, { color: "#3b82f6" }]}>
            {pendingRequests.length} Signups
          </Text>
        </View>
        <View style={[styles.statBadge, { backgroundColor: "#f59e0b20" }]}>
          <Ionicons name="notifications-outline" size={16} color="#f59e0b" />
          <Text style={[styles.statBadgeText, { color: "#f59e0b" }]}>
            {unreadNotifications.length} Unread
          </Text>
        </View>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color="#fca5a5" />
          <Text style={styles.errorBannerText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)} hitSlop={8}>
            <Ionicons name="close" size={16} color="#fca5a5" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Section: Jobs Pending Review ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Ionicons name="clipboard-outline" size={18} color="#14b8a6" />
            <Text style={styles.cardTitle}>Jobs Pending Review</Text>
          </View>
          <Badge count={jobsForReview.length} />
        </View>

        {jobsReviewLoading ? (
          <View style={{ gap: 10 }}>
            <SkeletonBlock width="100%" height={60} />
            <SkeletonBlock width="100%" height={60} />
          </View>
        ) : jobsReviewError ? (
          <Text style={styles.errorText}>{jobsReviewError}</Text>
        ) : jobsForReview.length === 0 ? (
          <EmptyState
            icon="checkmark-done-outline"
            title="No jobs awaiting review"
            subtitle="Submitted jobs will appear here for approval"
          />
        ) : (
          <View style={{ gap: 8 }}>
            {jobsForReview.map((job) => (
              <View key={job.id} style={styles.listItem}>
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemTitle}>{job.clientName}</Text>
                  <Text style={styles.listItemSubtitle}>
                    Scholar: {job.assigneeName || "Unknown"} {" \u2022 "} $
                    {job.pay}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.reviewBtn}
                  onPress={() => setReviewModalJob(job)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.reviewBtnText}>Review</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Section: Pending Signup Requests ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Ionicons name="person-add-outline" size={18} color="#3b82f6" />
            <Text style={styles.cardTitle}>Pending Signup Requests</Text>
          </View>
          <Badge count={pendingRequests.length} />
        </View>

        {requestsLoading ? (
          <View style={{ gap: 10 }}>
            <SkeletonBlock width="100%" height={60} />
            <SkeletonBlock width="100%" height={60} />
          </View>
        ) : requestsError ? (
          <Text style={styles.errorText}>{requestsError}</Text>
        ) : pendingRequests.length === 0 ? (
          <EmptyState
            icon="person-add-outline"
            title="No pending requests"
            subtitle="New signup requests will appear here"
          />
        ) : (
          <View style={{ gap: 8 }}>
            {pendingRequests.map((request) => (
              <View key={request.id} style={styles.listItem}>
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemTitle}>{request.name}</Text>
                  <Text style={styles.listItemSubtitle}>{request.email}</Text>
                  {request.roleRequested && (
                    <Text style={styles.listItemMeta}>
                      Role: {request.roleRequested}
                    </Text>
                  )}
                </View>
                <View style={styles.decisionBtns}>
                  <TouchableOpacity
                    style={[
                      styles.approveSmallBtn,
                      busyId === request.id && { opacity: 0.5 },
                    ]}
                    onPress={() => handleDecision(request.id, "approve")}
                    disabled={busyId === request.id}
                    activeOpacity={0.7}
                  >
                    {busyId === request.id ? (
                      <ActivityIndicator size={12} color="#fff" />
                    ) : (
                      <Text style={styles.smallBtnText}>Approve</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.declineSmallBtn,
                      busyId === request.id && { opacity: 0.5 },
                    ]}
                    onPress={() => handleDecision(request.id, "decline")}
                    disabled={busyId === request.id}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.smallBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Section: Admin Notifications ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Ionicons name="notifications-outline" size={18} color="#f59e0b" />
            <Text style={styles.cardTitle}>Admin Notifications</Text>
          </View>
          <Badge count={unreadNotifications.length} />
        </View>

        {notificationsLoading ? (
          <View style={{ gap: 10 }}>
            <SkeletonBlock width="100%" height={48} />
            <SkeletonBlock width="100%" height={48} />
          </View>
        ) : notificationsError ? (
          <Text style={styles.errorText}>{notificationsError}</Text>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon="notifications-off-outline"
            title="No notifications"
            subtitle="System alerts and updates will appear here"
          />
        ) : (
          <View style={{ gap: 8 }}>
            {notifications.slice(0, 20).map((notif) => (
              <View
                key={notif.id}
                style={[
                  styles.notifItem,
                  notif.unread && styles.notifItemUnread,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifMessage}>{notif.message}</Text>
                  {notif.createdAt?.seconds && (
                    <Text style={styles.notifTime}>
                      {new Date(
                        notif.createdAt.seconds * 1000
                      ).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                {notif.unread && (
                  <TouchableOpacity
                    onPress={() => markNotificationRead(notif.id)}
                    style={styles.markReadBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.markReadText}>Mark read</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Section: Completed Jobs - Extract Inventory ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Ionicons name="cube-outline" size={18} color="#10b981" />
            <Text style={styles.cardTitle}>Completed Jobs - Inventory</Text>
          </View>
          <Text style={styles.cardHeaderCount}>
            {awaitingExtraction.length} awaiting
          </Text>
        </View>

        {completedJobsLoading ? (
          <View style={{ gap: 10 }}>
            <SkeletonBlock width="100%" height={60} />
            <SkeletonBlock width="100%" height={60} />
          </View>
        ) : completedJobs.length === 0 ? (
          <EmptyState
            icon="cube-outline"
            title="No completed jobs yet"
            subtitle="Completed jobs will appear here for inventory extraction"
          />
        ) : (
          <View style={{ gap: 8 }}>
            {completedJobs.slice(0, 10).map((job) => (
              <View key={job.id} style={styles.listItem}>
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemTitle}>{job.clientName}</Text>
                  <Text style={styles.listItemSubtitle}>
                    {job.address}
                    {job.date
                      ? ` \u2022 ${new Date(job.date).toLocaleDateString()}`
                      : ""}
                  </Text>
                  {job.inventoryExtracted && (
                    <View style={styles.extractedTag}>
                      <Ionicons
                        name="checkmark-circle"
                        size={12}
                        color="#10b981"
                      />
                      <Text style={styles.extractedTagText}>
                        Extracted ({job.extractedItemIds?.length || 0} items)
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={[
                    styles.extractBtn,
                    job.inventoryExtracted && styles.extractBtnDisabled,
                  ]}
                  onPress={() => handleExtractInventory(job)}
                  disabled={job.inventoryExtracted}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="cube-outline"
                    size={14}
                    color={job.inventoryExtracted ? "#475569" : "#fff"}
                  />
                  <Text
                    style={[
                      styles.extractBtnText,
                      job.inventoryExtracted && { color: "#475569" },
                    ]}
                  >
                    {job.inventoryExtracted ? "Extracted" : "Extract"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Bottom spacer */}
      <View style={{ height: 40 }} />

      {/* Review Modal */}
      {reviewModalJob && (
        <ReviewModal
          job={reviewModalJob}
          onClose={() => setReviewModalJob(null)}
          onApprove={() => handleApproveAndPay(reviewModalJob)}
          onRequestChanges={(notes) =>
            handleRequestChanges(reviewModalJob, notes)
          }
          busy={busyId === reviewModalJob.id}
        />
      )}
    </AdminPageWrapper>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  // Header
  headerSection: {
    marginBottom: 20,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#5a6a80",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#f1f5f9",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#8b9bb5",
  },

  // Quick Stats
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  statBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Error banner
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#7f1d1d",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#fca5a5",
  },

  // Cards
  card: {
    backgroundColor: "#1a2332",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f1f5f9",
  },
  cardHeaderCount: {
    fontSize: 11,
    color: "#8b9bb5",
    fontWeight: "600",
  },

  // Badge
  badge: {
    backgroundColor: "#14b8a6",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
  },

  // List items
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0a0f1a",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2a3545",
  },
  listItemContent: {
    flex: 1,
    marginRight: 12,
  },
  listItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f1f5f9",
  },
  listItemSubtitle: {
    fontSize: 12,
    color: "#8b9bb5",
    marginTop: 2,
  },
  listItemMeta: {
    fontSize: 11,
    color: "#5a6a80",
    marginTop: 2,
  },

  // Review button
  reviewBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reviewBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },

  // Signup decision buttons
  decisionBtns: {
    flexDirection: "row",
    gap: 6,
  },
  approveSmallBtn: {
    backgroundColor: "#10b981",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 32,
    alignItems: "center",
  },
  declineSmallBtn: {
    backgroundColor: "#ef4444",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },

  // Notification items
  notifItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0a0f1a",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2a3545",
  },
  notifItemUnread: {
    borderColor: "#3b82f6",
    backgroundColor: "#1e3a5f",
  },
  notifMessage: {
    fontSize: 13,
    color: "#f1f5f9",
  },
  notifTime: {
    fontSize: 11,
    color: "#5a6a80",
    marginTop: 2,
  },
  markReadBtn: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  markReadText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#3b82f6",
  },

  // Extract inventory buttons
  extractBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#10b981",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  extractBtnDisabled: {
    backgroundColor: "#1a2332",
    borderWidth: 1,
    borderColor: "#2a3545",
  },
  extractBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  extractedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  extractedTagText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#10b981",
  },

  // Empty state
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8b9bb5",
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#5a6a80",
    textAlign: "center",
  },

  // Error text
  errorText: {
    fontSize: 13,
    color: "#ef4444",
    padding: 8,
  },
});

// ── Modal Styles ──

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  container: {
    backgroundColor: "#0a0f1a",
    borderRadius: 16,
    width: "100%",
    maxWidth: 600,
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: "#1a2332",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1a2332",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f1f5f9",
    flex: 1,
    marginRight: 12,
  },
  scrollBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  // Info box
  infoBox: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 14,
    gap: 6,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 13,
    color: "#8b9bb5",
  },
  infoValue: {
    fontWeight: "700",
    color: "#f1f5f9",
  },
  infoMuted: {
    fontSize: 11,
    color: "#5a6a80",
  },

  // Policy box
  policyBox: {
    backgroundColor: "#1e3a5f",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#3b82f640",
  },
  policyText: {
    fontSize: 12,
    color: "#93c5fd",
    lineHeight: 18,
  },

  // Section labels
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8b9bb5",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Media
  photo: {
    width: "100%",
    height: 200,
    borderRadius: 10,
    backgroundColor: "#1a2332",
  },
  mediaPlaceholder: {
    width: "100%",
    height: 160,
    backgroundColor: "#1a2332",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2a3545",
    gap: 8,
  },
  mediaPlaceholderText: {
    fontSize: 12,
    color: "#5a6a80",
    textAlign: "center",
  },

  // Video
  video: {
    width: "100%",
    height: 240,
    borderRadius: 10,
    backgroundColor: "#000",
  },
  videoContainer: {
    width: "100%",
    height: 200,
    backgroundColor: "#1a2332",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2a3545",
  },
  videoPlayOverlay: {
    alignItems: "center",
    gap: 8,
  },
  videoPlayText: {
    fontSize: 12,
    color: "#8b9bb5",
  },

  // Checklist
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checklistText: {
    fontSize: 13,
    color: "#f1f5f9",
    flex: 1,
  },

  // Action buttons
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: "#10b981",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  approveBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  changesBtn: {
    flex: 1,
    backgroundColor: "#f59e0b",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  changesBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#2a3545",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f1f5f9",
    textAlign: "center",
  },

  // Notes input
  notesInput: {
    backgroundColor: "#1a2332",
    borderRadius: 10,
    padding: 14,
    color: "#f1f5f9",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#2a3545",
    minHeight: 80,
    textAlignVertical: "top",
  },
});
