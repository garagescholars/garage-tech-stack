import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
} from "react-native";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../src/lib/firebase";
import { COLLECTIONS } from "../../src/constants/collections";
import { useResponsive } from "../../src/lib/responsive";
import { downloadCSV } from "../../src/lib/csvExport";
import AdminPageWrapper from "../../src/components/AdminPageWrapper";
import FormInput from "../../src/components/FormInput";
import FormSelect from "../../src/components/FormSelect";
import FormButton from "../../src/components/FormButton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Payout = {
  id: string;
  jobId: string;
  scholarId: string;
  scholarName: string;
  scholarEmail: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt?: string;
  paymentMethod?: string;
  transactionNote?: string;
  approvedBy?: string;
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonBlock({ width, height, style }: { width: number | string; height: number; style?: any }) {
  return (
    <View
      style={[
        {
          width: width as any,
          height,
          backgroundColor: "#1e293b",
          borderRadius: 8,
        },
        style,
      ]}
    />
  );
}

function PayoutsSkeleton() {
  return (
    <AdminPageWrapper>
      {/* Header skeleton */}
      <View style={skeletonStyles.headerRow}>
        <View style={{ gap: 8 }}>
          <SkeletonBlock width={180} height={22} />
          <SkeletonBlock width={240} height={14} />
        </View>
        <SkeletonBlock width={130} height={40} />
      </View>

      {/* Summary card skeletons */}
      <View style={skeletonStyles.summaryRow}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={skeletonStyles.summaryCard}>
            <SkeletonBlock width={80} height={12} />
            <SkeletonBlock width={100} height={26} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>

      {/* List item skeletons */}
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={skeletonStyles.listCard}>
          <View style={skeletonStyles.listRow}>
            <SkeletonBlock width={80} height={14} />
            <SkeletonBlock width={60} height={22} />
          </View>
          <SkeletonBlock width={140} height={14} style={{ marginTop: 8 }} />
          <View style={[skeletonStyles.listRow, { marginTop: 8 }]}>
            <SkeletonBlock width={70} height={14} />
            <SkeletonBlock width={90} height={30} />
          </View>
        </View>
      ))}
    </AdminPageWrapper>
  );
}

const skeletonStyles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
  },
  listCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    pending: { bg: "#f59e0b20", text: "#f59e0b" },
    paid: { bg: "#10b98120", text: "#10b981" },
    failed: { bg: "#ef444420", text: "#ef4444" },
  };
  const c = colors[status] || colors.pending;
  return (
    <View style={[badgeStyles.badge, { backgroundColor: c.bg }]}>
      <Text style={[badgeStyles.text, { color: c.text }]}>
        {status.toUpperCase()}
      </Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  text: { fontSize: 11, fontWeight: "700" },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

const PAYMENT_METHODS = [
  { label: "Venmo", value: "Venmo" },
  { label: "Zelle", value: "Zelle" },
  { label: "Cash", value: "Cash" },
  { label: "Check", value: "Check" },
];

export default function PayoutsScreen() {
  const { isDesktop, isMobile } = useResponsive();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mark-as-paid modal state
  const [markPaidModal, setMarkPaidModal] = useState<Payout | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("Venmo");
  const [transactionNote, setTransactionNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // ---------- Real-time listener ----------
  useEffect(() => {
    if (!db) {
      setError("Firestore not initialized.");
      setLoading(false);
      return;
    }

    const payoutsQuery = query(
      collection(db, COLLECTIONS.PAYOUTS),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      payoutsQuery,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, any>;
          return {
            id: docSnap.id,
            jobId: data.jobId || "",
            scholarId: data.scholarId || "",
            scholarName: data.recipientName || data.scholarName || "Unknown",
            scholarEmail: data.scholarEmail || "",
            amount: data.amount || 0,
            status: data.status || "pending",
            createdAt: data.createdAt || "",
            paidAt: data.paidAt,
            paymentMethod: data.paymentMethod,
            transactionNote: data.notes || data.transactionNote,
            approvedBy: data.approvedBy,
          } as Payout;
        });
        setPayouts(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message || "Failed to load payouts.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ---------- Mark as Paid ----------
  const handleMarkAsPaid = useCallback(async () => {
    if (!markPaidModal || !db) return;

    setBusyId(markPaidModal.id);
    try {
      await updateDoc(doc(db, COLLECTIONS.PAYOUTS, markPaidModal.id), {
        status: "paid",
        paidAt: new Date().toISOString(),
        paymentMethod: `manual_${paymentMethod.toLowerCase()}`,
        notes: transactionNote,
      });
      setMarkPaidModal(null);
      setPaymentMethod("Venmo");
      setTransactionNote("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to mark as paid.";
      if (Platform.OS === "web") {
        setError(message);
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setBusyId(null);
    }
  }, [markPaidModal, paymentMethod, transactionNote]);

  // ---------- Export CSV ----------
  const handleExportCSV = useCallback(async () => {
    const currentYear = new Date().getFullYear();

    const yearPayouts = payouts.filter((p) => {
      const payoutYear = new Date(p.paidAt || p.createdAt).getFullYear();
      return payoutYear === currentYear && p.status === "paid";
    });

    // Group by scholar
    const scholarTotals = yearPayouts.reduce(
      (acc, payout) => {
        if (!acc[payout.scholarId]) {
          acc[payout.scholarId] = {
            name: payout.scholarName,
            email: payout.scholarEmail || "",
            total: 0,
          };
        }
        acc[payout.scholarId].total += payout.amount;
        return acc;
      },
      {} as Record<string, { name: string; email: string; total: number }>
    );

    // Filter scholars > $600 (1099 threshold)
    const rows = Object.values(scholarTotals)
      .filter((scholar) => scholar.total > 600)
      .map((scholar) =>
        [scholar.name, scholar.email, scholar.total.toFixed(2), ""].join(",")
      );

    const csv = [
      "Scholar Name,Scholar Email,Total Paid (Year-to-Date),Tax ID",
      ...rows,
    ].join("\n");

    await downloadCSV(csv, `1099-data-${currentYear}.csv`);
  }, [payouts]);

  // ---------- Computed values ----------
  const pendingTotal = payouts
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.amount, 0);

  const paidTotal = payouts
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);

  // ---------- Loading ----------
  if (loading) {
    return <PayoutsSkeleton />;
  }

  // ---------- Render helpers ----------
  const renderSummaryCards = () => (
    <View style={[styles.summaryRow, isDesktop && styles.summaryRowDesktop]}>
      <View style={[styles.summaryCard, isDesktop && styles.summaryCardDesktop]}>
        <Text style={styles.summaryLabel}>Pending</Text>
        <Text style={[styles.summaryValue, { color: "#f59e0b" }]}>
          ${pendingTotal.toFixed(2)}
        </Text>
      </View>
      <View style={[styles.summaryCard, isDesktop && styles.summaryCardDesktop]}>
        <Text style={styles.summaryLabel}>Paid (YTD)</Text>
        <Text style={[styles.summaryValue, { color: "#10b981" }]}>
          ${paidTotal.toFixed(2)}
        </Text>
      </View>
      <View style={[styles.summaryCard, isDesktop && styles.summaryCardDesktop]}>
        <Text style={styles.summaryLabel}>Total Payouts</Text>
        <Text style={[styles.summaryValue, { color: "#f8fafc" }]}>
          {payouts.length}
        </Text>
      </View>
    </View>
  );

  // --- Desktop table row ---
  const renderDesktopRow = ({ item }: { item: Payout }) => (
    <View style={styles.tableRow}>
      <Text style={[styles.tableCell, styles.cellMono, { flex: 1.2 }]}>
        {item.id.slice(0, 8)}...
      </Text>
      <Text style={[styles.tableCell, styles.cellBold, { flex: 1.5 }]}>
        {item.scholarName}
      </Text>
      <Text style={[styles.tableCell, styles.cellMono, { flex: 1.2 }]}>
        {item.jobId ? `${item.jobId.slice(0, 8)}...` : "-"}
      </Text>
      <Text style={[styles.tableCell, styles.cellAmount, { flex: 1 }]}>
        ${item.amount.toFixed(2)}
      </Text>
      <View style={{ flex: 1, paddingHorizontal: 8 }}>
        <StatusBadge status={item.status} />
      </View>
      <View style={{ flex: 1.2, paddingHorizontal: 8 }}>
        {item.status === "pending" ? (
          <TouchableOpacity
            style={styles.markPaidBtnSmall}
            onPress={() => setMarkPaidModal(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark-circle" size={14} color="#fff" />
            <Text style={styles.markPaidBtnSmallText}>Mark as Paid</Text>
          </TouchableOpacity>
        ) : item.status === "paid" ? (
          <View>
            {item.paymentMethod ? (
              <View style={styles.paidInfo}>
                <Ionicons name="checkmark-circle" size={12} color="#10b981" />
                <Text style={styles.paidInfoText}>{item.paymentMethod}</Text>
              </View>
            ) : null}
            {item.paidAt ? (
              <Text style={styles.paidDate}>
                {new Date(item.paidAt).toLocaleDateString()}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );

  // --- Mobile card ---
  const renderMobileCard = ({ item }: { item: Payout }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardId}>{item.id.slice(0, 8)}...</Text>
        <StatusBadge status={item.status} />
      </View>
      <Text style={styles.cardScholar}>{item.scholarName}</Text>
      <View style={styles.cardDetailsRow}>
        <View style={styles.cardDetailItem}>
          <Text style={styles.cardDetailLabel}>Amount</Text>
          <Text style={styles.cardDetailAmount}>${item.amount.toFixed(2)}</Text>
        </View>
        <View style={styles.cardDetailItem}>
          <Text style={styles.cardDetailLabel}>Job ID</Text>
          <Text style={styles.cardDetailValue}>
            {item.jobId ? `${item.jobId.slice(0, 8)}...` : "-"}
          </Text>
        </View>
      </View>

      {item.status === "pending" ? (
        <TouchableOpacity
          style={styles.markPaidBtn}
          onPress={() => setMarkPaidModal(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="checkmark-circle" size={16} color="#fff" />
          <Text style={styles.markPaidBtnText}>Mark as Paid</Text>
        </TouchableOpacity>
      ) : item.status === "paid" ? (
        <View style={styles.paidInfoRow}>
          {item.paymentMethod ? (
            <View style={styles.paidInfo}>
              <Ionicons name="checkmark-circle" size={12} color="#10b981" />
              <Text style={styles.paidInfoText}>{item.paymentMethod}</Text>
            </View>
          ) : null}
          {item.paidAt ? (
            <Text style={styles.paidDate}>
              {new Date(item.paidAt).toLocaleDateString()}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  // ---------- Empty state ----------
  const renderEmpty = () => (
    <View style={styles.empty}>
      <Ionicons name="cash-outline" size={48} color="#334155" />
      <Text style={styles.emptyTitle}>No payouts yet</Text>
      <Text style={styles.emptySubtitle}>
        Payouts will appear here when scholars complete jobs
      </Text>
    </View>
  );

  return (
    <AdminPageWrapper scrollable={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Payout Management</Text>
          <Text style={styles.headerSubtitle}>
            Track and manage scholar payments
          </Text>
        </View>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={handleExportCSV}
          activeOpacity={0.7}
        >
          <Ionicons name="download-outline" size={16} color="#fff" />
          <Text style={styles.exportBtnText}>Export for Taxes</Text>
        </TouchableOpacity>
      </View>

      {/* Error banner */}
      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Summary cards */}
      {renderSummaryCards()}

      {/* Desktop table header */}
      {isDesktop && payouts.length > 0 && (
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Payout ID</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Scholar</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Job ID</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Amount</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Status</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Action</Text>
        </View>
      )}

      {/* Payout list */}
      <FlatList
        data={payouts}
        keyExtractor={(item) => item.id}
        renderItem={isDesktop ? renderDesktopRow : renderMobileCard}
        contentContainerStyle={
          payouts.length === 0 ? { flexGrow: 1 } : undefined
        }
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={Platform.OS === "web"}
      />

      {/* Mark as Paid Modal */}
      <Modal
        visible={markPaidModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setMarkPaidModal(null);
          setPaymentMethod("Venmo");
          setTransactionNote("");
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            if (busyId) return;
            setMarkPaidModal(null);
            setPaymentMethod("Venmo");
            setTransactionNote("");
          }}
        >
          <View
            style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}
            // Prevent closing when tapping inside modal
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>Confirm Payment</Text>

            {markPaidModal && (
              <Text style={styles.modalDescription}>
                Confirm payment of{" "}
                <Text style={{ fontWeight: "700", color: "#10b981" }}>
                  ${markPaidModal.amount.toFixed(2)}
                </Text>{" "}
                to{" "}
                <Text style={{ fontWeight: "700", color: "#f8fafc" }}>
                  {markPaidModal.scholarName}
                </Text>
              </Text>
            )}

            <FormSelect
              label="Payment Method"
              value={paymentMethod}
              onValueChange={setPaymentMethod}
              options={PAYMENT_METHODS}
            />

            <FormInput
              label="Transaction ID / Note"
              value={transactionNote}
              onChangeText={setTransactionNote}
              placeholder="e.g., Venmo ID or confirmation #"
            />

            <View style={styles.modalActions}>
              <FormButton
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  setMarkPaidModal(null);
                  setPaymentMethod("Venmo");
                  setTransactionNote("");
                }}
                disabled={busyId === markPaidModal?.id}
                style={{ flex: 1 }}
              />
              <FormButton
                title={
                  busyId === markPaidModal?.id
                    ? "Processing..."
                    : "Confirm Payment"
                }
                variant="primary"
                onPress={handleMarkAsPaid}
                loading={busyId === markPaidModal?.id}
                disabled={
                  busyId === markPaidModal?.id || !transactionNote.trim()
                }
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </AdminPageWrapper>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    gap: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f8fafc",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#10b981",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  exportBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },

  // Error
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ef444420",
    borderWidth: 1,
    borderColor: "#ef444440",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
    flex: 1,
  },

  // Summary cards
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  summaryRowDesktop: {
    gap: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
  },
  summaryCardDesktop: {
    padding: 18,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: 6,
  },

  // Desktop table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#0f1b2d",
  },
  tableCell: {
    fontSize: 13,
    color: "#94a3b8",
    paddingHorizontal: 8,
  },
  cellMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
  },
  cellBold: {
    fontWeight: "700",
    color: "#f8fafc",
  },
  cellAmount: {
    fontWeight: "700",
    color: "#10b981",
  },

  // Mobile card
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardId: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#64748b",
  },
  cardScholar: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 10,
  },
  cardDetailsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  cardDetailItem: {
    gap: 2,
  },
  cardDetailLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  cardDetailAmount: {
    fontSize: 16,
    fontWeight: "800",
    color: "#10b981",
  },
  cardDetailValue: {
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#94a3b8",
  },

  // Buttons
  markPaidBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#10b981",
    paddingVertical: 10,
    borderRadius: 10,
  },
  markPaidBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  markPaidBtnSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#10b981",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  markPaidBtnSmallText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },

  // Paid info
  paidInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  paidInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  paidInfoText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  paidDate: {
    fontSize: 11,
    color: "#64748b",
  },

  // Empty
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#94a3b8",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    maxWidth: 260,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#334155",
    maxWidth: 460,
    width: "100%",
    alignSelf: "center",
  },
  modalContentDesktop: {
    padding: 28,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 20,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
});
