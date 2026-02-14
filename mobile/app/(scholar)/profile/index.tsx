import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../src/hooks/useAuth";
import { useStripeStatus } from "../../../src/hooks/usePayouts";
import ScoreStars from "../../../src/components/ScoreStars";
import ProgressBar from "../../../src/components/ProgressBar";
import { getTierLabel, getTierColor } from "../../../src/constants/scoring";

export default function ProfileScreen() {
  const { profile, signOutUser } = useAuth();
  const router = useRouter();
  const { payoutsEnabled, bankLast4 } = useStripeStatus(profile?.uid);

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOutUser },
    ]);
  };

  if (!profile) return null;

  const tier = profile.tier || "new";
  const payScore = profile.payScore ?? 5.0;
  const tierColor = getTierColor(tier);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Profile header */}
      <View style={styles.profileCard}>
        <View style={[styles.avatar, { borderColor: tierColor }]}>
          <Ionicons name="person" size={36} color={tierColor} />
        </View>
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.phone}>{profile.phoneNumber || profile.email}</Text>
        <View style={[styles.tierBadge, { backgroundColor: tierColor + "20" }]}>
          <Text style={[styles.tierText, { color: tierColor }]}>
            {getTierLabel(tier)}
          </Text>
        </View>
      </View>

      {/* Pay Score */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pay Score</Text>
          <TouchableOpacity
            onPress={() => router.push("/(scholar)/profile/score-history" as any)}
          >
            <Text style={styles.viewAll}>View History</Text>
          </TouchableOpacity>
        </View>
        <ScoreStars score={payScore} tier={tier} size="large" />
        <Text style={styles.scoreDesc}>
          Your Pay Score determines your tier and job priority. Keep it high with quality work!
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statistics</Text>
        <View style={styles.statsGrid}>
          <StatItem
            icon="briefcase"
            label="Jobs Completed"
            value={String(profile.totalJobsCompleted || 0)}
          />
          <StatItem
            icon="cash"
            label="Total Earnings"
            value={`$${(profile.totalEarnings || 0).toLocaleString()}`}
          />
          <StatItem
            icon="checkmark-circle"
            label="Acceptance Rate"
            value={`${profile.acceptanceRate || 0}%`}
            color={
              (profile.acceptanceRate || 0) >= 90
                ? "#10b981"
                : (profile.acceptanceRate || 0) >= 70
                ? "#f59e0b"
                : "#ef4444"
            }
          />
          <StatItem
            icon="close-circle"
            label="Cancellation Rate"
            value={`${profile.cancellationRate || 0}%`}
            color={
              (profile.cancellationRate || 0) <= 5
                ? "#10b981"
                : (profile.cancellationRate || 0) <= 15
                ? "#f59e0b"
                : "#ef4444"
            }
          />
        </View>
      </View>

      {/* Payments */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payments</Text>
        <TouchableOpacity
          style={paymentStyles.row}
          onPress={() => router.push("/(scholar)/profile/payment-setup" as any)}
        >
          <Ionicons
            name={payoutsEnabled ? "checkmark-circle" : "alert-circle"}
            size={20}
            color={payoutsEnabled ? "#10b981" : "#f59e0b"}
          />
          <View style={paymentStyles.info}>
            <Text style={paymentStyles.label}>Bank Account</Text>
            <Text style={paymentStyles.value}>
              {payoutsEnabled
                ? `Connected (****${bankLast4 || ""})`
                : "Set up direct deposit"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#64748b" />
        </TouchableOpacity>
        <TouchableOpacity
          style={paymentStyles.row}
          onPress={() => router.push("/(scholar)/profile/payments" as any)}
        >
          <Ionicons name="wallet-outline" size={20} color="#14b8a6" />
          <View style={paymentStyles.info}>
            <Text style={paymentStyles.label}>Payment History</Text>
            <Text style={paymentStyles.value}>View all payouts</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Tier progress */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tier Progress</Text>
        <TierProgress currentScore={payScore} currentTier={tier} />
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function StatItem({
  icon,
  label,
  value,
  color = "#f8fafc",
}: {
  icon: string;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={statStyles.card}>
      <Ionicons name={icon as any} size={20} color="#14b8a6" />
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

function TierProgress({
  currentScore,
  currentTier,
}: {
  currentScore: number;
  currentTier: string;
}) {
  const tiers = [
    { key: "new", label: "New", min: 0, color: "#64748b" },
    { key: "standard", label: "Standard", min: 2.5, color: "#3b82f6" },
    { key: "elite", label: "Elite", min: 3.5, color: "#8b5cf6" },
    { key: "top_hustler", label: "Top Hustler", min: 4.5, color: "#f59e0b" },
  ];

  return (
    <View>
      {tiers.map((tier, i) => {
        const isActive = currentTier === tier.key;
        const isReached = currentScore >= tier.min;
        const nextTier = tiers[i + 1];
        const progress = nextTier
          ? Math.min(100, ((currentScore - tier.min) / (nextTier.min - tier.min)) * 100)
          : 100;

        return (
          <View key={tier.key} style={tierStyles.row}>
            <View
              style={[
                tierStyles.dot,
                { backgroundColor: isReached ? tier.color : "#334155" },
                isActive && tierStyles.dotActive,
              ]}
            />
            <View style={tierStyles.info}>
              <Text
                style={[
                  tierStyles.label,
                  isActive && { color: tier.color, fontWeight: "800" },
                ]}
              >
                {tier.label}
                {isActive && " (Current)"}
              </Text>
              <Text style={tierStyles.minScore}>Score: {tier.min}+</Text>
              {isActive && nextTier && (
                <ProgressBar
                  progress={Math.max(0, progress)}
                  label={`Next: ${nextTier.label}`}
                  color={nextTier.color}
                />
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1b2d" },
  scroll: { padding: 16, paddingBottom: 40 },
  profileCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#0f1b2d",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    marginBottom: 12,
  },
  name: { fontSize: 22, fontWeight: "800", color: "#f8fafc", marginBottom: 2 },
  phone: { fontSize: 14, color: "#94a3b8", marginBottom: 8 },
  tierBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tierText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  section: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  viewAll: { color: "#14b8a6", fontWeight: "700", fontSize: 13 },
  scoreDesc: { color: "#64748b", fontSize: 13, marginTop: 8, lineHeight: 18 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#ef444440",
    marginTop: 4,
  },
  signOutText: { color: "#ef4444", fontWeight: "700", fontSize: 15 },
});

const statStyles = StyleSheet.create({
  card: {
    width: "48%" as any,
    backgroundColor: "#0f1b2d",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  value: { fontSize: 20, fontWeight: "800" },
  label: { fontSize: 11, color: "#64748b", fontWeight: "600", textAlign: "center" },
});

const tierStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, marginTop: 3 },
  dotActive: { borderWidth: 2, borderColor: "#f8fafc" },
  info: { flex: 1 },
  label: { fontSize: 14, fontWeight: "600", color: "#cbd5e1" },
  minScore: { fontSize: 12, color: "#64748b", marginBottom: 4 },
});

const paymentStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#0f1b2d",
  },
  info: { flex: 1 },
  label: { fontSize: 14, fontWeight: "700", color: "#f8fafc" },
  value: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
});
