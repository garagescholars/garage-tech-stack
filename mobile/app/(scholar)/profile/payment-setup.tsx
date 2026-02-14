import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { httpsCallable } from "firebase/functions";
import { getFunctions } from "firebase/functions";
import { useAuth } from "../../../src/hooks/useAuth";
import { useStripeStatus } from "../../../src/hooks/usePayouts";

const functions = getFunctions();

export default function PaymentSetupScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const { stripeAccount, loading, isOnboarded, payoutsEnabled, bankLast4 } =
    useStripeStatus(profile?.uid);
  const [connecting, setConnecting] = useState(false);

  const handleSetupBank = async () => {
    if (!profile?.uid) return;

    setConnecting(true);
    try {
      const createAccount = httpsCallable(functions, "gsCreateStripeAccount");
      const result = await createAccount({
        accountType: "scholar",
        returnUrl: "garagescholars://payment-setup?status=complete",
        refreshUrl: "garagescholars://payment-setup?status=refresh",
      });

      const data = result.data as any;

      if (data.alreadyComplete) {
        Alert.alert("Already Set Up", "Your bank account is already connected.");
        return;
      }

      if (data.url) {
        await Linking.openURL(data.url);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to start bank setup.");
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#f8fafc" />
      </TouchableOpacity>

      <Text style={styles.title}>Payment Setup</Text>
      <Text style={styles.subtitle}>
        Link your bank account to receive payouts directly via ACH transfer.
      </Text>

      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Ionicons
            name={payoutsEnabled ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={payoutsEnabled ? "#10b981" : "#64748b"}
          />
          <View style={styles.statusInfo}>
            <Text style={styles.statusLabel}>Bank Account</Text>
            <Text style={styles.statusValue}>
              {payoutsEnabled
                ? `Connected (****${bankLast4 || ""})`
                : isOnboarded
                ? "Onboarding complete — awaiting verification"
                : "Not connected"}
            </Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <Ionicons
            name={isOnboarded ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={isOnboarded ? "#10b981" : "#64748b"}
          />
          <View style={styles.statusInfo}>
            <Text style={styles.statusLabel}>Identity Verified</Text>
            <Text style={styles.statusValue}>
              {isOnboarded ? "Verified" : "Not yet verified"}
            </Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <Ionicons
            name={payoutsEnabled ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={payoutsEnabled ? "#10b981" : "#64748b"}
          />
          <View style={styles.statusInfo}>
            <Text style={styles.statusLabel}>Payouts</Text>
            <Text style={styles.statusValue}>
              {payoutsEnabled ? "Enabled — auto-deposits active" : "Not enabled"}
            </Text>
          </View>
        </View>
      </View>

      {/* Action */}
      {!payoutsEnabled && (
        <TouchableOpacity
          style={styles.setupBtn}
          onPress={handleSetupBank}
          disabled={connecting}
        >
          {connecting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="link" size={20} color="#fff" />
              <Text style={styles.setupBtnText}>
                {isOnboarded ? "Complete Verification" : "Link Bank Account"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {payoutsEnabled && (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={24} color="#10b981" />
          <Text style={styles.successText}>
            Your bank account is connected. Payouts will be sent automatically
            via ACH when you complete jobs.
          </Text>
        </View>
      )}

      {/* Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How Payouts Work</Text>
        <InfoRow
          icon="cash-outline"
          text="50% is paid when you check in to a job"
        />
        <InfoRow
          icon="time-outline"
          text="The other 50% is released 72 hours after checkout if no complaints"
        />
        <InfoRow
          icon="shield-checkmark-outline"
          text="Your quality score must be 2.0+ for automatic release"
        />
        <InfoRow
          icon="wallet-outline"
          text="ACH transfers typically arrive in 1-2 business days"
        />
      </View>

      {!payoutsEnabled && (
        <Text style={styles.fallbackNote}>
          Without a linked bank account, payouts will be processed manually via
          Zelle or Venmo by an admin.
        </Text>
      )}
    </ScrollView>
  );
}

function InfoRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={infoStyles.row}>
      <Ionicons name={icon as any} size={18} color="#14b8a6" />
      <Text style={infoStyles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1b2d" },
  scroll: { padding: 16, paddingBottom: 40 },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0f1b2d",
    justifyContent: "center",
    alignItems: "center",
  },
  backBtn: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", color: "#f8fafc", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#94a3b8", marginBottom: 20, lineHeight: 20 },
  statusCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    gap: 16,
    marginBottom: 16,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusInfo: { flex: 1 },
  statusLabel: { fontSize: 14, fontWeight: "700", color: "#f8fafc" },
  statusValue: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  setupBtn: {
    backgroundColor: "#14b8a6",
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  setupBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  successBanner: {
    backgroundColor: "#10b98120",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#10b98140",
  },
  successText: { flex: 1, color: "#10b981", fontSize: 13, lineHeight: 19 },
  infoCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    gap: 14,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fallbackNote: {
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});

const infoStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  text: { flex: 1, color: "#cbd5e1", fontSize: 13, lineHeight: 19 },
});
