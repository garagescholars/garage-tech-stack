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

const DEFAULT_URL = "https://expo.dev";
const CONFIG_DOC = "mobileApp";

export default function ShareAppScreen() {
  const [downloadUrl, setDownloadUrl] = useState(DEFAULT_URL);
  const [editUrl, setEditUrl] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getDoc(doc(db, COLLECTIONS.PLATFORM_CONFIG, CONFIG_DOC)).then((snap) => {
      if (snap.exists() && snap.data().downloadUrl) {
        setDownloadUrl(snap.data().downloadUrl);
      }
    });
  }, []);

  const handleCopy = async () => {
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
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageWrapper>
      {/* Header */}
      <View style={styles.headerSection}>
        <Text style={styles.headerTitle}>Share App</Text>
        <Text style={styles.headerSubtitle}>
          Show this QR code to scholars so they can download the app
        </Text>
      </View>

      {/* QR Code Card */}
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

      {/* Instructions */}
      <View style={styles.instructionsCard}>
        <View style={styles.instructionsHeader}>
          <Ionicons name="information-circle" size={20} color="#60a5fa" />
          <Text style={styles.instructionsTitle}>How to Install</Text>
        </View>
        <Step number={1} text='Download "Expo Go" from the App Store or Google Play' />
        <Step number={2} text="Open your phone camera and scan the QR code above" />
        <Step number={3} text="The app will open in Expo Go automatically" />
        <Step number={4} text="Log in with your credentials" />
      </View>

      {/* Edit URL */}
      <TouchableOpacity
        style={styles.editToggle}
        onPress={() => {
          setEditing(!editing);
          setEditUrl(downloadUrl);
        }}
      >
        <Ionicons name="link-outline" size={16} color="#94a3b8" />
        <Text style={styles.editToggleText}>
          {editing ? "Cancel" : "Change Download URL"}
        </Text>
      </TouchableOpacity>

      {editing && (
        <View style={styles.editPanel}>
          <Text style={styles.editLabel}>Download URL</Text>
          <Text style={styles.editHint}>
            Use your Expo Go URL during development, then update to the App
            Store link when published.
          </Text>
          <TextInput
            style={styles.editInput}
            value={editUrl}
            onChangeText={setEditUrl}
            placeholder="https://..."
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSaveUrl}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>
              {saving ? "Saving..." : "Save URL"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
  editToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    marginBottom: 4,
  },
  editToggleText: { fontSize: 13, color: "#94a3b8" },
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
});
