import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { PhoneAuthProvider, ApplicationVerifier } from "firebase/auth";
import { auth } from "../../src/lib/firebase";

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const formatPhone = (input: string) => {
    const digits = input.replace(/\D/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handleSendCode = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      Alert.alert("Invalid Phone", "Please enter a valid 10-digit US phone number.");
      return;
    }

    setLoading(true);
    try {
      const fullPhone = `+1${digits}`;
      // In production, you'd use a reCAPTCHA verifier or Firebase's built-in
      // phone auth. For Expo, firebase-recaptcha or expo-firebase-recaptcha
      // handles this. For now, we'll navigate to verify with the phone number.
      // The actual verification setup requires native config (google-services.json).
      router.push({
        pathname: "/(auth)/verify",
        params: { phone: fullPhone },
      });
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send verification code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.emoji}>🔧</Text>
          <Text style={styles.title}>Garage Scholars</Text>
          <Text style={styles.subtitle}>Enter your phone number to get started</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.phoneRow}>
            <View style={styles.countryCode}>
              <Text style={styles.countryCodeText}>+1</Text>
            </View>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={(t) => setPhone(formatPhone(t))}
              placeholder="(555) 123-4567"
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
              maxLength={14}
              autoFocus
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSendCode}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Sending..." : "Send Verification Code"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          By continuing, you agree to receive SMS messages for verification.
          Standard messaging rates may apply.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f1b2d",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#94a3b8",
    textAlign: "center",
  },
  form: {
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#cbd5e1",
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: "row",
    marginBottom: 20,
  },
  countryCode: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  countryCodeText: {
    color: "#cbd5e1",
    fontSize: 16,
    fontWeight: "600",
  },
  input: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: "#f8fafc",
    borderWidth: 1,
    borderColor: "#334155",
    letterSpacing: 0.5,
  },
  button: {
    backgroundColor: "#14b8a6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  disclaimer: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
