import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import { db } from "../../src/lib/firebase";
import { useAuth } from "../../src/hooks/useAuth";
import { COLLECTIONS } from "../../src/constants/collections";

const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState(profile?.name || "");
  const [submitting, setSubmitting] = useState(false);

  // Permission states
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);

  const goNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const requestNotifications = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      const granted = status === "granted";
      setNotifGranted(granted);
      if (!granted) {
        Alert.alert(
          "Notifications Disabled",
          "You can enable notifications later in your device settings."
        );
      }
    } catch {
      setNotifGranted(false);
    }
    goNext();
  };

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === "granted";
      setLocationGranted(granted);
      if (!granted) {
        Alert.alert(
          "Location Disabled",
          "Location is needed for job check-ins. You can enable it later in settings."
        );
      }
    } catch {
      setLocationGranted(false);
    }
    // Don't goNext here -- we finalize onboarding
    await completeOnboarding();
  };

  const completeOnboarding = async () => {
    if (!user) return;
    setSubmitting(true);

    try {
      const trimmedName = fullName.trim() || "Scholar";

      // Update gs_profiles with the name
      await updateDoc(doc(db, COLLECTIONS.PROFILES, user.uid), {
        fullName: trimmedName,
        updatedAt: serverTimestamp(),
      });

      // Update gs_scholarProfiles with onboardingComplete and name
      await updateDoc(doc(db, COLLECTIONS.SCHOLAR_PROFILES, user.uid), {
        onboardingComplete: true,
        scholarName: trimmedName,
        updatedAt: serverTimestamp(),
      });

      router.replace("/(scholar)/jobs");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not complete onboarding.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step renderers ──

  const renderStepName = () => (
    <View style={styles.stepContent}>
      <View style={styles.iconCircle}>
        <Ionicons name="person-outline" size={40} color="#14b8a6" />
      </View>
      <Text style={styles.stepTitle}>What's your name?</Text>
      <Text style={styles.stepSubtitle}>
        This will be shown to customers and other scholars.
      </Text>
      <TextInput
        style={styles.input}
        value={fullName}
        onChangeText={setFullName}
        placeholder="Full Name"
        placeholderTextColor="#64748b"
        autoFocus
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={goNext}
      />
      <TouchableOpacity
        style={[styles.primaryBtn, !fullName.trim() && styles.btnDisabled]}
        onPress={goNext}
        disabled={!fullName.trim()}
      >
        <Text style={styles.primaryBtnText}>Continue</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderStepAvatar = () => (
    <View style={styles.stepContent}>
      <View style={styles.avatarPlaceholder}>
        <Ionicons name="person-circle-outline" size={96} color="#334155" />
      </View>
      <Text style={styles.stepTitle}>Profile Picture</Text>
      <Text style={styles.stepSubtitle}>
        You can add a profile picture later from your profile settings.
      </Text>
      <TouchableOpacity style={styles.secondaryBtn} disabled>
        <Ionicons name="camera-outline" size={20} color="#64748b" />
        <Text style={styles.secondaryBtnText}>Coming Soon</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.primaryBtn} onPress={goNext}>
        <Text style={styles.primaryBtnText}>Skip for Now</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderStepNotifications = () => (
    <View style={styles.stepContent}>
      <View style={styles.iconCircle}>
        <Ionicons name="notifications-outline" size={40} color="#14b8a6" />
      </View>
      <Text style={styles.stepTitle}>Stay in the Loop</Text>
      <Text style={styles.stepSubtitle}>
        Get notified when new jobs are posted, when you receive transfers, and
        when your goals are reached.
      </Text>
      {notifGranted === true ? (
        <View style={styles.grantedRow}>
          <Ionicons name="checkmark-circle" size={24} color="#10b981" />
          <Text style={styles.grantedText}>Notifications enabled</Text>
        </View>
      ) : null}
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={requestNotifications}
      >
        <Ionicons name="notifications" size={18} color="#fff" />
        <Text style={styles.primaryBtnText}>
          {notifGranted === null ? "Enable Notifications" : "Continue"}
        </Text>
      </TouchableOpacity>
      {notifGranted === null && (
        <TouchableOpacity style={styles.skipBtn} onPress={goNext}>
          <Text style={styles.skipBtnText}>Skip</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderStepLocation = () => (
    <View style={styles.stepContent}>
      <View style={styles.iconCircle}>
        <Ionicons name="location-outline" size={40} color="#14b8a6" />
      </View>
      <Text style={styles.stepTitle}>Location Access</Text>
      <Text style={styles.stepSubtitle}>
        Location is required to verify you're at the job site when checking in.
        This ensures accurate attendance tracking.
      </Text>
      {locationGranted === true ? (
        <View style={styles.grantedRow}>
          <Ionicons name="checkmark-circle" size={24} color="#10b981" />
          <Text style={styles.grantedText}>Location enabled</Text>
        </View>
      ) : null}
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={requestLocation}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="location" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>
              {locationGranted === null
                ? "Enable Location"
                : "Complete Setup"}
            </Text>
          </>
        )}
      </TouchableOpacity>
      {locationGranted === null && !submitting && (
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={completeOnboarding}
        >
          <Text style={styles.skipBtnText}>Skip & Finish</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 1:
        return renderStepName();
      case 2:
        return renderStepAvatar();
      case 3:
        return renderStepNotifications();
      case 4:
        return renderStepLocation();
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Step indicator dots */}
      <View style={styles.dotsRow}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i + 1 === step && styles.dotActive,
              i + 1 < step && styles.dotComplete,
            ]}
          />
        ))}
      </View>

      {/* Step counter */}
      <Text style={styles.stepCounter}>
        Step {step} of {TOTAL_STEPS}
      </Text>

      {/* Back button */}
      {step > 1 && (
        <TouchableOpacity style={styles.backBtn} onPress={goBack}>
          <Ionicons name="arrow-back" size={22} color="#94a3b8" />
        </TouchableOpacity>
      )}

      {/* Step content */}
      {renderStep()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f1b2d",
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#334155",
  },
  dotActive: {
    backgroundColor: "#14b8a6",
    width: 28,
    borderRadius: 5,
  },
  dotComplete: {
    backgroundColor: "#10b981",
  },
  stepCounter: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 24,
  },
  backBtn: {
    position: "absolute",
    top: 48,
    left: 16,
    padding: 8,
    zIndex: 10,
  },
  stepContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 80,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  avatarPlaceholder: {
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#f8fafc",
    textAlign: "center",
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  input: {
    width: "100%",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: "#f8fafc",
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 20,
    textAlign: "center",
  },
  primaryBtn: {
    width: "100%",
    backgroundColor: "#14b8a6",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  secondaryBtn: {
    width: "100%",
    backgroundColor: "#1e293b",
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 12,
    opacity: 0.5,
  },
  secondaryBtnText: {
    color: "#64748b",
    fontSize: 15,
    fontWeight: "600",
  },
  skipBtn: {
    marginTop: 16,
    paddingVertical: 10,
  },
  skipBtnText: {
    color: "#64748b",
    fontSize: 15,
    fontWeight: "600",
  },
  grantedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
    backgroundColor: "#1e293b",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  grantedText: {
    color: "#10b981",
    fontSize: 15,
    fontWeight: "600",
  },
});
