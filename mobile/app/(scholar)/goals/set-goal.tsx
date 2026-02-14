import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../src/hooks/useAuth";
import { setMonthlyGoal } from "../../../src/hooks/useGoals";

type GoalType = "jobs" | "money";

export default function SetGoalScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [goalType, setGoalType] = useState<GoalType>("jobs");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    const value = parseInt(target, 10);
    if (!value || value <= 0) {
      Alert.alert("Invalid Target", "Please enter a valid number greater than 0.");
      return;
    }

    setSaving(true);
    try {
      await setMonthlyGoal(user.uid, goalType, value);
      Alert.alert("Goal Set!", `Your ${goalType} goal has been set to ${goalType === "money" ? "$" : ""}${value}.`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to set goal");
    } finally {
      setSaving(false);
    }
  };

  const now = new Date();
  const monthName = now.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.heading}>Set {monthName} Goal</Text>
        <Text style={styles.subheading}>
          Track your progress throughout the month
        </Text>

        {/* Goal type selector */}
        <Text style={styles.label}>Goal Type</Text>
        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[styles.typeBtn, goalType === "jobs" && styles.typeBtnActive]}
            onPress={() => setGoalType("jobs")}
          >
            <Ionicons
              name="briefcase"
              size={20}
              color={goalType === "jobs" ? "#fff" : "#64748b"}
            />
            <Text
              style={[styles.typeText, goalType === "jobs" && styles.typeTextActive]}
            >
              Jobs Completed
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeBtn, goalType === "money" && styles.typeBtnActive]}
            onPress={() => setGoalType("money")}
          >
            <Ionicons
              name="cash"
              size={20}
              color={goalType === "money" ? "#fff" : "#64748b"}
            />
            <Text
              style={[styles.typeText, goalType === "money" && styles.typeTextActive]}
            >
              Earnings ($)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Target input */}
        <Text style={styles.label}>Target</Text>
        <View style={styles.inputRow}>
          {goalType === "money" && <Text style={styles.prefix}>$</Text>}
          <TextInput
            style={styles.input}
            placeholder={goalType === "jobs" ? "e.g. 10" : "e.g. 2000"}
            placeholderTextColor="#475569"
            keyboardType="number-pad"
            value={target}
            onChangeText={setTarget}
          />
        </View>

        {/* Quick presets */}
        <View style={styles.presetRow}>
          {(goalType === "jobs" ? [5, 10, 15, 20] : [500, 1000, 2000, 3000]).map(
            (val) => (
              <TouchableOpacity
                key={val}
                style={styles.preset}
                onPress={() => setTarget(String(val))}
              >
                <Text style={styles.presetText}>
                  {goalType === "money" ? "$" : ""}
                  {val}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Saving..." : "Set Goal"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1b2d" },
  content: { padding: 20 },
  heading: { fontSize: 24, fontWeight: "800", color: "#f8fafc", marginBottom: 4 },
  subheading: { fontSize: 14, color: "#64748b", marginBottom: 24 },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  typeRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
  },
  typeBtnActive: {
    backgroundColor: "#14b8a6",
    borderColor: "#14b8a6",
  },
  typeText: { fontSize: 14, fontWeight: "700", color: "#64748b" },
  typeTextActive: { color: "#fff" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 12,
  },
  prefix: { fontSize: 20, fontWeight: "700", color: "#10b981", marginRight: 4 },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: "700",
    color: "#f8fafc",
  },
  presetRow: { flexDirection: "row", gap: 8, marginBottom: 32 },
  preset: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#1e293b",
    alignItems: "center",
  },
  presetText: { color: "#94a3b8", fontWeight: "700", fontSize: 13 },
  saveBtn: {
    backgroundColor: "#14b8a6",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 17, fontWeight: "800", color: "#fff" },
});
