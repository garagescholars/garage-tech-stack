import { useRef } from "react";
import { Modal, View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Platform } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

type Props = {
  visible: boolean;
  phoneNumber: string; // E.164 format, e.g. +15551234567
  onVerificationId: (id: string) => void;
  onError: (msg: string) => void;
  onCancel: () => void;
};

// Hosted on Firebase Hosting — runs reCAPTCHA on an authorized domain
const AUTH_PAGE_BASE = "https://garage-scholars-scheduling.web.app/phone-auth.html";

export default function PhoneAuthWebView({ visible, phoneNumber, onVerificationId, onError, onCancel }: Props) {
  const webViewRef = useRef<WebView>(null);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "verificationId") {
        onVerificationId(data.verificationId);
      } else if (data.type === "error") {
        onError(data.message);
      }
    } catch {
      onError("Unexpected error during verification.");
    }
  };

  // On web, we can't use WebView — skip this component
  if (Platform.OS === "web") {
    return null;
  }

  const uri = `${AUTH_PAGE_BASE}?phone=${encodeURIComponent(phoneNumber)}`;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <ActivityIndicator size="small" color="#14b8a6" />
            <Text style={styles.headerText}>Sending verification code...</Text>
          </View>
          <Text style={styles.subText}>
            A reCAPTCHA check is running to verify you're not a bot.
          </Text>

          {visible && (
            <WebView
              ref={webViewRef}
              source={{ uri }}
              onMessage={handleMessage}
              style={styles.webview}
              javaScriptEnabled
              domStorageEnabled
            />
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 360,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  headerText: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
  },
  subText: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  webview: {
    height: 1,
    width: 1,
    opacity: 0,
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 8,
  },
  cancelText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "600",
  },
});
