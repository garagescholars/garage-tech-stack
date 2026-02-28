import { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { signOut } from "firebase/auth";
import { auth } from "../../src/lib/firebase";
import { useAuth } from "../../src/hooks/useAuth";

export default function PendingApprovalScreen() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  // If the user is already approved, redirect them
  useEffect(() => {
    if (loading) return;
    if (!profile) return;

    if (profile.role === "admin") {
      router.replace("/(admin)/jobs");
      return;
    }
    if (profile.status === "active") {
      router.replace("/(scholar)/jobs");
    }
  }, [profile, loading]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace("/(auth)/email-login");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  // Show loading while checking auth state
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  // If user is approved or admin, render nothing while redirect happens
  if (
    profile?.role === "admin" ||
    profile?.status === "active"
  ) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Icon */}
        <View style={styles.iconCircle}>
          <Ionicons name="hourglass-outline" size={48} color="#14b8a6" />
        </View>

        {/* Title */}
        <Text style={styles.title}>Request Submitted</Text>

        {/* Description */}
        <Text style={styles.description}>
          Your account is pending admin approval. You will be able to log in
          once an administrator has reviewed and approved your request.
        </Text>

        {/* Status badge */}
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Pending Review</Text>
        </View>

        {/* User email display */}
        {user?.email && (
          <View style={styles.emailContainer}>
            <Ionicons name="mail-outline" size={16} color="#5a6a80" />
            <Text style={styles.emailText}>{user.email}</Text>
          </View>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Info text */}
        <View style={styles.infoRow}>
          <Ionicons name="information-circle-outline" size={18} color="#5a6a80" />
          <Text style={styles.infoText}>
            This usually takes less than 24 hours. You will receive an email
            notification when your account is approved.
          </Text>
        </View>

        {/* Sign out button */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.signOutText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f1a",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#1a2332",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2a3545",
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(20, 184, 166, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#f1f5f9",
    marginBottom: 12,
    textAlign: "center",
  },
  description: {
    fontSize: 15,
    color: "#8b9bb5",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.25)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fbbf24",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fbbf24",
  },
  emailContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
  },
  emailText: {
    fontSize: 13,
    color: "#5a6a80",
  },
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "#2a3545",
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#5a6a80",
    lineHeight: 19,
  },
  signOutButton: {
    width: "100%",
    backgroundColor: "#14b8a6",
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  signOutText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
