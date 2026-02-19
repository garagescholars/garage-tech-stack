import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { db } from "../../src/lib/firebase";
import { COLLECTIONS } from "../../src/constants/collections";
import AdminPageWrapper from "../../src/components/AdminPageWrapper";

const CONFIG_DOC = "mobileApp";

export default function ShareAppScreen() {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, COLLECTIONS.PLATFORM_CONFIG, CONFIG_DOC))
      .then((snap) => {
        if (snap.exists() && snap.data().downloadUrl) {
          setDownloadUrl(snap.data().downloadUrl);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = async () => {
    if (!downloadUrl) return;
    try {
      await Clipboard.setStringAsync(downloadUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert("Copy failed", downloadUrl);
    }
  };

  const handleSaveUrl = async () => {
    if (!editUrl.trim()) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, COLLECTIONS.PLATFORM_CONFIG, CONFIG_DOC),
        { downloadUrl: editUrl.trim(), updatedAt: serverTimestamp() },
        { merge: true }
      );
      setDownloadUrl(editUrl.trim());
    } finally {
      setSaving(false);
    }
  };

  const needsSetup = !loading && !downloadUrl;

  return (
    <AdminPageWrapper>
      {/* Header */}
      <View style={styles.headerSection}>
        <Text style={styles.headerTitle}>Share App</Text>
        <Text style={styles.headerSubtitle}>
          Show this QR code to scholars so they can download the app
        </Text>
      </View>

      {/* Setup required banner */}
      {needsSetup && (
        <View style={styles.setupCard}>
          <View style={styles.setupHeader}>
            <Ionicons name="warning-outline" size={22} color="#eab308" />
            <Text style={styles.setupTitle}>Setup Required</Text>
          </View>
          <Text style={styles.setupText}>
            To generate a working QR code, you need to set the Expo Go URL.
          </Text>
          <View style={styles.setupSteps}>
            <Step number={1} text='Run "npx expo start" on your computer' />
            <Step number={2} text="Copy the exp:// URL shown in the terminal (e.g. exp://192.168.1.5:8081)" />
            <Step number={3} text="Paste it below and tap Save URL" />
          </View>
          <Text style={styles.setupNote}>
            Later, when the app is in the App Store, replace this with the App Store link.
          </Text>
        </View>
      )}

      {/* QR Code Card - only show when URL is configured */}
      {downloadUrl && (
        <View style={styles.qrCard}>
          <View style={styles.qrWrapper}>
            <QRCode
              value={downloadUrl}
              size={250}
              backgroundColor="#ffffff"
              color="#0f1b2d"
            />
          </View>

          <Text style={styles.scanText}>Scan to get the Garage Scholars app</Text>

          <Text style={styles.currentUrl} numberOfLines={1}>
            {downloadUrl}
          </Text>

          {/* Copy button */}
          <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
            <Ionicons
              name={copied ? "checkmark" : "copy-outline"}
              size={16}
              color="#fff"
            />
            <Text style={styles.copyBtnText}>
              {copied ? "Copied!" : "Copy Link"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Onboarding Instructions */}
      <View style={styles.instructionsCard}>
        <View style={styles.instructionsHeader}>
          <Ionicons name="phone-portrait-outline" size={20} color="#60a5fa" />
          <Text style={styles.instructionsTitle}>Scholar Onboarding Steps</Text>
        </View>
        <Text style={styles.instructionsIntro}>
          Walk new scholars through these steps when onboarding:
        </Text>
        <Step number={1} text='Download "Expo Go" from the App Store (iPhone) or Google Play (Android)' />
        <Step number={2} text="Open their phone camera and scan the QR code above" />
        <Step number={3} text="Tap the link that appears — the app will open in Expo Go" />
        <Step number={4} text='Tap "Sign Up" and create an account with their name, email, and a password' />
        <Step number={5} text="An admin will approve their account before they can access jobs" />
      </View>

      {/* Admin notes */}
      <View style={styles.adminNoteCard}>
        <View style={styles.instructionsHeader}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#14b8a6" />
          <Text style={[styles.instructionsTitle, { color: "#14b8a6" }]}>Admin Notes</Text>
        </View>
        <Step number={1} text='For testing: run "npx expo start" on your computer and paste the exp:// URL above' />
        <Step number={2} text="For production: replace with the App Store / Google Play link once published" />
        <Step number={3} text="The QR code updates automatically when you save a new URL" />
      </View>

      {/* Edit URL - always visible */}
      <View style={styles.editPanel}>
        <Text style={styles.editLabel}>
          {downloadUrl ? "Change Download URL" : "Set Download URL"}
        </Text>
        <Text style={styles.editHint}>
          Paste the exp:// URL from "npx expo start", or the App Store link when published.
        </Text>
        <TextInput
          style={styles.editInput}
          value={editUrl}
          onChangeText={setEditUrl}
          placeholder="exp://192.168.1.5:8081"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.saveBtn, !editUrl.trim() && styles.saveBtnDisabled]}
          onPress={handleSaveUrl}
          disabled={saving || !editUrl.trim()}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Saving..." : "Save URL"}
          </Text>
        </TouchableOpacity>
      </View>
    </AdminPageWrapper>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Step({ number, text }: { number: number; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepCircle}>
        <Text style={styles.stepNumber}>{number}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  headerSection: { marginBottom: 20 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#f8fafc" },
  headerSubtitle: { fontSize: 13, color: "#94a3b8", marginTop: 4 },

  // Setup card
  setupCard: {
    backgroundColor: "#eab30810",
    borderWidth: 1,
    borderColor: "#eab30830",
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  setupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  setupTitle: { fontSize: 16, fontWeight: "700", color: "#eab308" },
  setupText: { fontSize: 13, color: "#94a3b8", lineHeight: 19, marginBottom: 12 },
  setupSteps: { marginBottom: 12 },
  setupNote: { fontSize: 12, color: "#64748b", fontStyle: "italic", lineHeight: 17 },

  // QR card
  qrCard: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  qrWrapper: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  scanText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f8fafc",
    textAlign: "center",
    marginBottom: 16,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#14b8a6",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  copyBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  currentUrl: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 12,
    textAlign: "center",
  },

  // Instructions
  instructionsCard: {
    backgroundColor: "#60a5fa10",
    borderWidth: 1,
    borderColor: "#60a5fa25",
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  instructionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  instructionsTitle: { fontSize: 14, fontWeight: "700", color: "#60a5fa" },
  instructionsIntro: { fontSize: 13, color: "#94a3b8", marginBottom: 14, lineHeight: 19 },

  // Admin notes
  adminNoteCard: {
    backgroundColor: "#14b8a610",
    borderWidth: 1,
    borderColor: "#14b8a625",
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#14b8a620",
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumber: { fontSize: 12, fontWeight: "800", color: "#14b8a6" },
  stepText: { fontSize: 13, color: "#94a3b8", flex: 1, lineHeight: 19 },

  // Edit URL
  editPanel: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  editLabel: { fontSize: 14, fontWeight: "700", color: "#f8fafc", marginBottom: 4 },
  editHint: { fontSize: 12, color: "#64748b", marginBottom: 12, lineHeight: 17 },
  editInput: {
    backgroundColor: "#0f1b2d",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 12,
    fontSize: 14,
    color: "#f8fafc",
  },
  saveBtn: {
    backgroundColor: "#14b8a6",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 10,
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  saveBtnDisabled: { opacity: 0.5 },
});
