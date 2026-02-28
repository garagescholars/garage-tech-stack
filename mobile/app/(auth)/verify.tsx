import { useState, useRef, useEffect } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../src/hooks/useAuth";

export default function VerifyScreen() {
  const { phone, verificationId } = useLocalSearchParams<{ phone: string; verificationId: string }>();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const { verifyPhone } = useAuth();
  const router = useRouter();

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResend = () => {
    if (resendCooldown > 0) return;
    setResendCooldown(60);
    // Navigate back to login with phone pre-filled to re-trigger reCAPTCHA
    const phoneDigits = (phone || "").replace(/\D/g, "").replace(/^1/, "");
    router.replace({
      pathname: "/(auth)/login",
      params: { resendPhone: phoneDigits },
    });
  };

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-advance to next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (index === 5 && text) {
      const fullCode = newCode.join("");
      if (fullCode.length === 6) {
        handleVerify(fullCode);
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (codeStr?: string) => {
    const fullCode = codeStr || code.join("");
    if (fullCode.length !== 6) {
      Alert.alert("Invalid Code", "Please enter the 6-digit verification code.");
      return;
    }

    if (!verificationId) {
      Alert.alert("Error", "No verification session. Please go back and try again.");
      return;
    }

    setLoading(true);
    try {
      console.log("[Verify] verificationId:", verificationId);
      console.log("[Verify] code:", fullCode);
      await verifyPhone(verificationId as string, fullCode);
      // Verification succeeded — navigate to index which routes by role
      router.replace("/");
    } catch (error: any) {
      console.error("[Verify] Error:", error.code, error.message);
      Alert.alert("Verification Failed", `${error.code || "unknown"}: ${error.message || "Invalid code. Please try again."}`);
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Verify Your Number</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to{"\n"}
            <Text style={styles.phoneHighlight}>{phone}</Text>
          </Text>
        </View>

        <View style={styles.codeRow}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => { inputRefs.current[i] = ref; }}
              style={[styles.codeInput, digit ? styles.codeInputFilled : null]}
              value={digit}
              onChangeText={(t) => handleCodeChange(t.slice(-1), i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={() => handleVerify()}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Verifying..." : "Verify"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.resendButton, resendCooldown > 0 && styles.resendDisabled]}
          onPress={handleResend}
          disabled={resendCooldown > 0}
        >
          <Text style={[styles.resendText, resendCooldown <= 0 && styles.resendTextActive]}>
            {resendCooldown > 0
              ? `Resend code in ${resendCooldown}s`
              : "Didn't get a code? Resend"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f1a",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  backButton: {
    marginBottom: 32,
  },
  backText: {
    color: "#14b8a6",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#f1f5f9",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "#8b9bb5",
    textAlign: "center",
    lineHeight: 24,
  },
  phoneHighlight: {
    color: "#14b8a6",
    fontWeight: "700",
  },
  codeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 32,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#1a2332",
    borderWidth: 2,
    borderColor: "#2a3545",
    textAlign: "center",
    fontSize: 24,
    fontWeight: "700",
    color: "#f1f5f9",
  },
  codeInputFilled: {
    borderColor: "#14b8a6",
    backgroundColor: "#0f3433",
  },
  button: {
    backgroundColor: "#14b8a6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  resendButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  resendText: {
    color: "#5a6a80",
    fontSize: 14,
  },
  resendTextActive: {
    color: "#14b8a6",
    fontWeight: "600",
  },
  resendDisabled: {
    opacity: 0.5,
  },
});
