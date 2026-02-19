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

// Firebase config is public (same as in .env — safe to embed in client-side code)
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBPOosKjdOrj1dMLmgs1bH2Z9FoqqrZQI8",
  authDomain: "garage-scholars-v2.firebaseapp.com",
  projectId: "garage-scholars-v2",
};

function buildHtml(phone: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Verify</title>
  <style>
    body { margin:0; background:#0f1b2d; color:#f8fafc; font-family:sans-serif;
           display:flex; justify-content:center; align-items:center; min-height:100vh; }
    #status { text-align:center; padding:20px; font-size:16px; }
    .spinner { border:3px solid #1e293b; border-top:3px solid #14b8a6; border-radius:50%;
               width:32px; height:32px; animation:spin .8s linear infinite; margin:16px auto; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .error { color:#ef4444; }
  </style>
</head>
<body>
  <div id="status">
    <div class="spinner"></div>
    <p>Sending verification code...</p>
  </div>
  <div id="recaptcha-container"></div>

  <script src="https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/11.0.1/firebase-auth-compat.js"></script>
  <script>
    var config = ${JSON.stringify(FIREBASE_CONFIG)};
    var phone = ${JSON.stringify(phone)};

    firebase.initializeApp(config);
    var auth = firebase.auth();

    // Use device language for SMS
    auth.useDeviceLanguage();

    try {
      var verifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        size: 'invisible',
        callback: function() {
          // reCAPTCHA solved — will proceed with signInWithPhoneNumber
        },
        'expired-callback': function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'error', message: 'reCAPTCHA expired. Please try again.'
          }));
        }
      });

      auth.signInWithPhoneNumber(phone, verifier)
        .then(function(confirmationResult) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'verificationId',
            verificationId: confirmationResult.verificationId
          }));
        })
        .catch(function(error) {
          var msg = error.message || 'Failed to send verification code.';
          if (error.code === 'auth/too-many-requests') {
            msg = 'Too many attempts. Please wait a few minutes and try again.';
          } else if (error.code === 'auth/invalid-phone-number') {
            msg = 'Invalid phone number format.';
          } else if (error.code === 'auth/captcha-check-failed') {
            msg = 'reCAPTCHA verification failed. Please try again.';
          }
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'error', message: msg
          }));
        });
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error', message: e.message || 'Failed to initialize verification.'
      }));
    }
  </script>
</body>
</html>`;
}

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

          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html: buildHtml(phoneNumber) }}
            onMessage={handleMessage}
            style={styles.webview}
            javaScriptEnabled
            domStorageEnabled
          />

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
