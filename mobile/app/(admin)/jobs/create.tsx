import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../../src/lib/firebase";
import { COLLECTIONS } from "../../../src/constants/collections";
import type { UrgencyLevel } from "../../../src/types";

export default function CreateJobScreen() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTimeStart, setScheduledTimeStart] = useState("");
  const [scheduledTimeEnd, setScheduledTimeEnd] = useState("");
  const [payout, setPayout] = useState("");
  const [clientName, setClientName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [urgency, setUrgency] = useState<UrgencyLevel>("standard");
  const [rushBonus, setRushBonus] = useState("");

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert("Missing Title", "Please enter a job title.");
      return;
    }
    if (!address.trim()) {
      Alert.alert("Missing Address", "Please enter the job address.");
      return;
    }
    if (!scheduledDate.trim()) {
      Alert.alert("Missing Date", "Please enter the scheduled date (YYYY-MM-DD).");
      return;
    }
    if (!payout.trim() || isNaN(Number(payout))) {
      Alert.alert("Missing Payout", "Please enter a valid payout amount.");
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, COLLECTIONS.JOBS), {
        title: title.trim(),
        description: description.trim(),
        address: address.trim(),
        scheduledDate: scheduledDate.trim(),
        scheduledTimeStart: scheduledTimeStart.trim(),
        scheduledTimeEnd: scheduledTimeEnd.trim() || null,
        payout: Number(payout),
        clientName: clientName.trim() || null,
        customerName: customerName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        customerNotes: customerNotes.trim() || null,
        urgencyLevel: urgency,
        rushBonus: urgency !== "standard" ? Number(rushBonus || 0) : 0,
        status: "APPROVED_FOR_POSTING",
        currentViewers: 0,
        viewerFloor: 2,
        totalViews: 0,
        reopenCount: 0,
        claimedBy: null,
        claimedByName: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      Alert.alert("Job Created!", "The job is now live on the scholar feed.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to create job");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Field label="Job Title *" value={title} onChange={setTitle} placeholder="e.g. Full Garage Build-Out" />
        <Field
          label="Description"
          value={description}
          onChange={setDescription}
          placeholder="Details about the job..."
          multiline
        />
        <Field label="Address *" value={address} onChange={setAddress} placeholder="123 Main St, City, State" />
        <Field
          label="Scheduled Date *"
          value={scheduledDate}
          onChange={setScheduledDate}
          placeholder="YYYY-MM-DD"
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <Field label="Start Time" value={scheduledTimeStart} onChange={setScheduledTimeStart} placeholder="9:00 AM" />
          </View>
          <View style={styles.half}>
            <Field label="End Time" value={scheduledTimeEnd} onChange={setScheduledTimeEnd} placeholder="5:00 PM" />
          </View>
        </View>

        <Field label="Payout ($) *" value={payout} onChange={setPayout} placeholder="250" keyboard="numeric" />
        <Field label="Client Name" value={clientName} onChange={setClientName} placeholder="Company name" />
        <Field label="Customer Name" value={customerName} onChange={setCustomerName} placeholder="Homeowner name" />
        <Field label="Customer Phone" value={customerPhone} onChange={setCustomerPhone} placeholder="(555) 555-5555" keyboard="phone-pad" />
        <Field
          label="Customer Notes"
          value={customerNotes}
          onChange={setCustomerNotes}
          placeholder="Special instructions..."
          multiline
        />

        {/* Urgency */}
        <Text style={styles.fieldLabel}>Urgency Level</Text>
        <View style={styles.urgencyRow}>
          {(["standard", "rush", "same_day"] as UrgencyLevel[]).map((level) => {
            const labels = { standard: "Standard", rush: "Rush", same_day: "Same Day" };
            const colors = { standard: "#64748b", rush: "#ea580c", same_day: "#dc2626" };
            return (
              <TouchableOpacity
                key={level}
                style={[
                  styles.urgencyBtn,
                  urgency === level && { backgroundColor: colors[level] + "30", borderColor: colors[level] },
                ]}
                onPress={() => setUrgency(level)}
              >
                <Text
                  style={[
                    styles.urgencyText,
                    urgency === level && { color: colors[level] },
                  ]}
                >
                  {labels[level]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {urgency !== "standard" && (
          <Field
            label="Rush Bonus ($)"
            value={rushBonus}
            onChange={setRushBonus}
            placeholder="50"
            keyboard="numeric"
          />
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, saving && styles.submitDisabled]}
          onPress={handleCreate}
          disabled={saving}
        >
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.submitText}>
            {saving ? "Creating..." : "Create Job"}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboard?: "numeric" | "phone-pad";
}) {
  return (
    <View style={fieldStyles.container}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, multiline && fieldStyles.multiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#475569"
        multiline={multiline}
        keyboardType={keyboard || "default"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1b2d" },
  scroll: { padding: 16 },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94a3b8",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  urgencyRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  urgencyBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
  },
  urgencyText: { fontSize: 13, fontWeight: "700", color: "#64748b" },
  submitBtn: {
    backgroundColor: "#14b8a6",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { fontSize: 17, fontWeight: "800", color: "#fff" },
});

const fieldStyles = StyleSheet.create({
  container: { marginBottom: 14 },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94a3b8",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 14,
    color: "#f8fafc",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#334155",
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
});
