import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Platform,
} from "react-native";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  setDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../src/lib/firebase";
import { COLLECTIONS } from "../../src/constants/collections";
import AdminPageWrapper from "../../src/components/AdminPageWrapper";
import type { GsSocialContentItem, SocialContentStatus, SocialContentType } from "../../src/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type FilterTab = "all" | SocialContentStatus;
type ContentTypeFilter = "all" | SocialContentType;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "processing", label: "Processing" },
  { key: "posted", label: "Posted" },
  { key: "failed", label: "Failed" },
  { key: "permanently_failed", label: "Perm Failed" },
];

const CONTENT_TYPE_TABS: { key: ContentTypeFilter; label: string; color: string }[] = [
  { key: "all", label: "All Types", color: "#8b9bb5" },
  { key: "before_after", label: "Before/After", color: "#14b8a6" },
  { key: "resale", label: "Resale", color: "#f59e0b" },
  { key: "donation", label: "Donation", color: "#a855f7" },
  { key: "gym_install", label: "Gym Install", color: "#ef4444" },
];

const CONTENT_TYPE_COLORS: Record<SocialContentType, string> = {
  before_after: "#14b8a6",
  resale: "#f59e0b",
  donation: "#a855f7",
  gym_install: "#ef4444",
};

const CONTENT_TYPE_LABELS: Record<SocialContentType, string> = {
  before_after: "Before/After",
  resale: "Resale",
  donation: "Donation",
  gym_install: "Gym Install",
};

const CONTENT_TYPE_ICONS: Record<SocialContentType, keyof typeof Ionicons.glyphMap> = {
  before_after: "swap-horizontal",
  resale: "pricetag",
  donation: "heart",
  gym_install: "barbell",
};

const STATUS_COLORS: Record<SocialContentStatus, string> = {
  pending: "#eab308",
  processing: "#3b82f6",
  posted: "#10b981",
  failed: "#ef4444",
  permanently_failed: "#991b1b",
};

const STATUS_LABELS: Record<SocialContentStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  posted: "Posted",
  failed: "Failed",
  permanently_failed: "Perm Failed",
};

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function SocialMediaScreen() {
  const [items, setItems] = useState<GsSocialContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [contentFilter, setContentFilter] = useState<ContentTypeFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [captionPrompt, setCaptionPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);

  // Subscribe to social content queue
  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.SOCIAL_CONTENT_QUEUE),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as GsSocialContentItem[];
      setItems(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Load caption prompt config
  useEffect(() => {
    if (!showConfig) return;
    setPromptLoading(true);
    getDoc(doc(db, COLLECTIONS.PLATFORM_CONFIG, "socialMediaPrompt"))
      .then((snap) => {
        if (snap.exists()) {
          setCaptionPrompt(snap.data().prompt || "");
        }
      })
      .finally(() => setPromptLoading(false));
  }, [showConfig]);

  const filteredItems = items.filter((i) => {
    if (filter !== "all" && i.status !== filter) return false;
    if (contentFilter !== "all") {
      const type = i.contentType || "before_after";
      if (type !== contentFilter) return false;
    }
    return true;
  });

  const counts = items.reduce(
    (acc, i) => {
      acc[i.status] = (acc[i.status] || 0) + 1;
      acc.total++;
      return acc;
    },
    { total: 0 } as Record<string, number>
  );

  const handleRetry = async (item: GsSocialContentItem) => {
    await updateDoc(doc(db, COLLECTIONS.SOCIAL_CONTENT_QUEUE, item.id), {
      status: "pending",
      error: null,
      retryCount: 0,
      failedAt: null,
    });
  };

  const handleSavePrompt = async () => {
    setPromptLoading(true);
    try {
      await setDoc(
        doc(db, COLLECTIONS.PLATFORM_CONFIG, "socialMediaPrompt"),
        { prompt: captionPrompt, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setPromptSaved(true);
      setTimeout(() => setPromptSaved(false), 2000);
    } finally {
      setPromptLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminPageWrapper>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#14b8a6" />
        </View>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      {/* Header */}
      <View style={styles.headerSection}>
        <Text style={styles.headerTitle}>Social Media</Text>
        <Text style={styles.headerSubtitle}>
          Monitor and manage automated posts
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatBadge label="Total" value={counts.total || 0} color="#8b9bb5" />
        <StatBadge label="Posted" value={counts.posted || 0} color="#10b981" />
        <StatBadge
          label="Pending"
          value={(counts.pending || 0) + (counts.processing || 0)}
          color="#eab308"
        />
        <StatBadge
          label="Failed"
          value={(counts.failed || 0) + (counts.permanently_failed || 0)}
          color="#ef4444"
        />
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
            onPress={() => setFilter(tab.key)}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === tab.key && styles.filterTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content type filter */}
      <View style={styles.filterRow}>
        {CONTENT_TYPE_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.filterTab,
              contentFilter === tab.key && { backgroundColor: tab.color },
            ]}
            onPress={() => setContentFilter(tab.key)}
          >
            <Text
              style={[
                styles.filterTabText,
                contentFilter === tab.key && styles.filterTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Config toggle */}
      <TouchableOpacity
        style={styles.configToggle}
        onPress={() => setShowConfig(!showConfig)}
      >
        <Ionicons
          name="settings-outline"
          size={16}
          color="#8b9bb5"
        />
        <Text style={styles.configToggleText}>Caption Prompt Settings</Text>
        <Ionicons
          name={showConfig ? "chevron-up" : "chevron-down"}
          size={16}
          color="#8b9bb5"
        />
      </TouchableOpacity>

      {/* Config panel */}
      {showConfig && (
        <View style={styles.configPanel}>
          <Text style={styles.configLabel}>Custom Caption Prompt</Text>
          <Text style={styles.configHint}>
            Leave empty to use the default prompt. The AI will use this to
            generate captions for social media posts.
          </Text>
          {promptLoading && !captionPrompt ? (
            <ActivityIndicator
              size="small"
              color="#14b8a6"
              style={{ marginVertical: 12 }}
            />
          ) : (
            <>
              <TextInput
                style={styles.configInput}
                value={captionPrompt}
                onChangeText={setCaptionPrompt}
                placeholder="Enter custom caption prompt..."
                placeholderTextColor="#5a6a80"
                multiline
                numberOfLines={4}
              />
              <TouchableOpacity
                style={styles.configSaveBtn}
                onPress={handleSavePrompt}
                disabled={promptLoading}
              >
                {promptSaved ? (
                  <Text style={styles.configSaveBtnText}>Saved!</Text>
                ) : (
                  <Text style={styles.configSaveBtnText}>
                    {promptLoading ? "Saving..." : "Save Prompt"}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Items list */}
      {filteredItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="megaphone-outline" size={40} color="#2a3545" />
          <Text style={styles.emptyText}>
            {filter === "all"
              ? "No social media posts yet"
              : `No ${filter} posts`}
          </Text>
        </View>
      ) : (
        filteredItems.map((item) => (
          <SocialContentCard
            key={item.id}
            item={item}
            expanded={expandedId === item.id}
            onToggle={() =>
              setExpandedId(expandedId === item.id ? null : item.id)
            }
            onRetry={() => handleRetry(item)}
          />
        ))
      )}
    </AdminPageWrapper>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.statBadge}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SocialContentCard({
  item,
  expanded,
  onToggle,
  onRetry,
}: {
  item: GsSocialContentItem;
  expanded: boolean;
  onToggle: () => void;
  onRetry: () => void;
}) {
  const statusColor = STATUS_COLORS[item.status];
  const canRetry = item.status === "failed" || item.status === "permanently_failed";
  const ts = item.createdAt
    ? new Date((item.createdAt as any).seconds * 1000).toLocaleDateString()
    : "";
  const contentType: SocialContentType = item.contentType || "before_after";
  const typeColor = CONTENT_TYPE_COLORS[contentType];
  const typeLabel = CONTENT_TYPE_LABELS[contentType];
  const typeIcon = CONTENT_TYPE_ICONS[contentType];

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        {/* Thumbnail */}
        <View style={styles.thumbnailRow}>
          {item.compositeUrl ? (
            <Image
              source={{ uri: item.compositeUrl }}
              style={[styles.thumbnail, { borderWidth: 2, borderColor: typeColor }]}
            />
          ) : item.beforePhotoUrl ? (
            <Image
              source={{ uri: item.beforePhotoUrl }}
              style={styles.thumbnail}
            />
          ) : item.itemPhotos?.[0] ? (
            <Image
              source={{ uri: item.itemPhotos[0] }}
              style={[styles.thumbnail, { borderWidth: 2, borderColor: typeColor }]}
            />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
              <Ionicons name={typeIcon} size={20} color={typeColor} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.itemName || item.jobTitle || "Untitled Job"}
          </Text>
          <Text style={styles.cardAddress} numberOfLines={1}>
            {item.address || "No address"}
          </Text>
          <View style={styles.cardMeta}>
            <View
              style={[styles.statusBadge, { backgroundColor: typeColor + "20" }]}
            >
              <Ionicons name={typeIcon} size={10} color={typeColor} />
              <Text style={[styles.statusText, { color: typeColor }]}>
                {typeLabel}
              </Text>
            </View>
            <View
              style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}
            >
              <View
                style={[styles.statusDot, { backgroundColor: statusColor }]}
              />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {STATUS_LABELS[item.status]}
              </Text>
            </View>
            {ts ? <Text style={styles.cardDate}>{ts}</Text> : null}
          </View>
        </View>

        {/* Expand chevron */}
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color="#5a6a80"
        />
      </TouchableOpacity>

      {/* Expanded details */}
      {expanded && (
        <View style={styles.cardExpanded}>
          {/* Content type & item details */}
          {item.itemName ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Item</Text>
              <Text style={styles.detailText}>{item.itemName}</Text>
            </View>
          ) : null}

          {/* Item photos grid */}
          {item.itemPhotos && item.itemPhotos.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Item Photos</Text>
              <View style={styles.photoRow}>
                {item.itemPhotos.map((url, i) => (
                  <Image
                    key={i}
                    source={{ uri: url }}
                    style={[styles.photoThumb, { borderWidth: 1, borderColor: typeColor }]}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Caption */}
          {item.caption ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Caption</Text>
              <Text style={styles.detailText}>{item.caption}</Text>
            </View>
          ) : null}

          {/* Error */}
          {item.error ? (
            <View style={styles.detailSection}>
              <Text style={[styles.detailLabel, { color: "#ef4444" }]}>
                Error
              </Text>
              <Text style={[styles.detailText, { color: "#fca5a5" }]}>
                {item.error}
              </Text>
            </View>
          ) : null}

          {/* Retry count */}
          {(item.retryCount ?? 0) > 0 && (
            <Text style={styles.retryCount}>
              Retry attempts: {item.retryCount}
            </Text>
          )}

          {/* Platform links */}
          <View style={styles.platformRow}>
            {item.fbPostId && (
              <View style={styles.platformBadge}>
                <Ionicons name="logo-facebook" size={14} color="#3b82f6" />
                <Text style={styles.platformText}>Facebook</Text>
              </View>
            )}
            {item.igPostId && (
              <View style={styles.platformBadge}>
                <Ionicons name="logo-instagram" size={14} color="#e879f9" />
                <Text style={styles.platformText}>Instagram</Text>
              </View>
            )}
            {!item.fbPostId && !item.igPostId && (
              <Text style={styles.noPlatform}>Not yet posted</Text>
            )}
          </View>

          {/* Before / After thumbnails (for before_after type) */}
          {(item.beforePhotoUrl || item.afterPhotoUrl || item.compositeUrl) && (
            <View style={styles.photoRow}>
              {item.beforePhotoUrl ? (
                <View style={styles.photoContainer}>
                  <Text style={styles.photoLabel}>Before</Text>
                  <Image
                    source={{ uri: item.beforePhotoUrl }}
                    style={styles.photoThumb}
                  />
                </View>
              ) : null}
              {item.afterPhotoUrl ? (
                <View style={styles.photoContainer}>
                  <Text style={styles.photoLabel}>After</Text>
                  <Image
                    source={{ uri: item.afterPhotoUrl }}
                    style={styles.photoThumb}
                  />
                </View>
              ) : null}
              {item.compositeUrl ? (
                <View style={styles.photoContainer}>
                  <Text style={styles.photoLabel}>Composite</Text>
                  <Image
                    source={{ uri: item.compositeUrl }}
                    style={styles.photoThumb}
                  />
                </View>
              ) : null}
            </View>
          )}

          {/* Retry button */}
          {canRetry && (
            <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={styles.retryBtnText}>Retry Post</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header
  headerSection: { marginBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#f1f5f9" },
  headerSubtitle: { fontSize: 13, color: "#8b9bb5", marginTop: 4 },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  statBadge: {
    flex: 1,
    backgroundColor: "#1a2332",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  statValue: { fontSize: 20, fontWeight: "800" },
  statLabel: { fontSize: 11, color: "#8b9bb5", marginTop: 2, fontWeight: "600" },

  // Filters
  filterRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#1a2332",
  },
  filterTabActive: {
    backgroundColor: "#14b8a6",
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8b9bb5",
  },
  filterTabTextActive: {
    color: "#fff",
  },

  // Config
  configToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
    paddingVertical: 8,
  },
  configToggleText: {
    fontSize: 13,
    color: "#8b9bb5",
    flex: 1,
  },
  configPanel: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  configLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 4,
  },
  configHint: {
    fontSize: 12,
    color: "#5a6a80",
    marginBottom: 12,
    lineHeight: 17,
  },
  configInput: {
    backgroundColor: "#0a0f1a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a3545",
    padding: 12,
    fontSize: 14,
    color: "#f1f5f9",
    minHeight: 80,
    textAlignVertical: "top",
  },
  configSaveBtn: {
    backgroundColor: "#14b8a6",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 10,
  },
  configSaveBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: "#5a6a80",
  },

  // Card
  card: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    marginBottom: 8,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  thumbnailRow: {},
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#0a0f1a",
  },
  thumbnailPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#f1f5f9" },
  cardAddress: { fontSize: 12, color: "#8b9bb5", marginTop: 2 },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardDate: { fontSize: 11, color: "#5a6a80" },

  // Expanded
  cardExpanded: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: "#2a3545",
    paddingTop: 12,
  },
  detailSection: { marginBottom: 10 },
  detailLabel: { fontSize: 12, fontWeight: "700", color: "#8b9bb5", marginBottom: 4 },
  detailText: { fontSize: 13, color: "#cbd5e1", lineHeight: 19 },
  retryCount: { fontSize: 12, color: "#5a6a80", marginBottom: 8 },

  // Platform badges
  platformRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  platformBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#0a0f1a",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  platformText: { fontSize: 12, color: "#8b9bb5", fontWeight: "600" },
  noPlatform: { fontSize: 12, color: "#5a6a80", fontStyle: "italic" },

  // Photos
  photoRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  photoContainer: { alignItems: "center", gap: 4 },
  photoLabel: { fontSize: 10, color: "#5a6a80", fontWeight: "600" },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#0a0f1a",
  },

  // Retry
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#14b8a6",
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 4,
  },
  retryBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
