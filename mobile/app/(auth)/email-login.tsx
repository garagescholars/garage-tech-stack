import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/hooks/useAuth";

export default function EmailLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const router = useRouter();
  const { signInWithEmail } = useAuth();

  const handleLogin = async () => {
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmail(email.trim().toLowerCase(), password);
      // Navigate to index which routes based on role
      router.replace("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed.";
      // Clean up Firebase error messages for display
      if (message.includes("auth/invalid-credential") || message.includes("auth/wrong-password")) {
        setError("Invalid email or password. Please try again.");
      } else if (message.includes("auth/user-not-found")) {
        setError("No account found with this email address.");
      } else if (message.includes("auth/too-many-requests")) {
        setError("Too many failed attempts. Please try again later.");
      } else if (message.includes("auth/invalid-email")) {
        setError("Please enter a valid email address.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="lock-closed-outline" size={40} color="#14b8a6" />
            </View>
            <Text style={styles.title}>Log In</Text>
            <Text style={styles.subtitle}>
              Access the Garage Scholars platform
            </Text>
          </View>

          {/* Error message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color="#f87171" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <View style={[styles.inputWrapper, emailFocused && styles.inputWrapperFocused]}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={emailFocused ? "#14b8a6" : "#5a6a80"}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#5a6a80"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                returnKeyType="next"
                editable={!loading}
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputWrapper, passwordFocused && styles.inputWrapperFocused]}>
              <Ionicons
                name="key-outline"
                size={20}
                color={passwordFocused ? "#14b8a6" : "#5a6a80"}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#5a6a80"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#5a6a80"
                />
              </TouchableOpacity>
            </View>

            {/* Login button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <View style={styles.buttonContent}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.buttonText}>Signing in...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons name="log-in-outline" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Log In</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Create account link */}
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.push("/(auth)/create-account")}
            disabled={loading}
          >
            <Text style={styles.linkText}>
              Need access?{" "}
              <Text style={styles.linkTextAccent}>Request an account</Text>
            </Text>
          </TouchableOpacity>

          {/* Phone login link (non-web only) */}
          {Platform.OS !== "web" && (
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.push("/(auth)/login")}
              disabled={loading}
            >
              <Text style={styles.linkText}>
                Scholar?{" "}
                <Text style={styles.linkTextAccent}>Sign in with phone</Text>
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f1a",
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#1a2332",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#f1f5f9",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#8b9bb5",
    textAlign: "center",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: "#f87171",
    lineHeight: 20,
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#cbd5e1",
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a2332",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a3545",
    marginBottom: 16,
  },
  inputWrapperFocused: {
    borderColor: "#14b8a6",
  },
  inputIcon: {
    marginLeft: 14,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 16,
    color: "#f1f5f9",
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  button: {
    backgroundColor: "#14b8a6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  linkText: {
    fontSize: 14,
    color: "#8b9bb5",
  },
  linkTextAccent: {
    color: "#14b8a6",
    fontWeight: "600",
  },
});
