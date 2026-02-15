import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Platform,
} from "react-native";

type Option = {
  label: string;
  value: string;
};

type Props = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  error?: string;
};

export default function FormSelect({
  label,
  value,
  onValueChange,
  options,
  error,
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const selectedOption = options.find((o) => o.value === value);

  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.selectWrapper, error ? styles.selectError : undefined]}>
          <select
            value={value}
            onChange={(e: any) => onValueChange(e.target.value)}
            style={{
              backgroundColor: "#1e293b",
              color: value ? "#f8fafc" : "#475569",
              border: "none",
              outline: "none",
              fontSize: 15,
              padding: 14,
              borderRadius: 10,
              width: "100%",
              cursor: "pointer",
              appearance: "none" as any,
              WebkitAppearance: "none" as any,
            }}
          >
            <option value="" style={{ color: "#475569" }}>
              Select...
            </option>
            {options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                style={{ backgroundColor: "#1e293b", color: "#f8fafc" }}
              >
                {opt.label}
              </option>
            ))}
          </select>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.trigger, error ? styles.triggerError : undefined]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.triggerText,
            !selectedOption && styles.triggerPlaceholder,
          ]}
        >
          {selectedOption ? selectedOption.label : "Select..."}
        </Text>
        <Text style={styles.chevron}>&#x25BC;</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.optionRow,
                    item.value === value && styles.optionRowSelected,
                  ]}
                  onPress={() => {
                    onValueChange(item.value);
                    setModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      item.value === value && styles.optionTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.value === value && (
                    <Text style={styles.checkmark}>&#x2713;</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94a3b8",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  selectWrapper: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    overflow: "hidden",
  },
  selectError: {
    borderColor: "#ef4444",
  },
  trigger: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#334155",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  triggerError: {
    borderColor: "#ef4444",
  },
  triggerText: {
    color: "#f8fafc",
    fontSize: 15,
    flex: 1,
  },
  triggerPlaceholder: {
    color: "#475569",
  },
  chevron: {
    color: "#64748b",
    fontSize: 10,
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 4,
    marginLeft: 4,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    maxHeight: "70%",
    borderWidth: 1,
    borderColor: "#334155",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f8fafc",
  },
  modalClose: {
    fontSize: 15,
    fontWeight: "700",
    color: "#14b8a6",
  },
  optionRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#253448",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionRowSelected: {
    backgroundColor: "#14b8a620",
  },
  optionText: {
    fontSize: 15,
    color: "#f8fafc",
  },
  optionTextSelected: {
    color: "#14b8a6",
    fontWeight: "700",
  },
  checkmark: {
    color: "#14b8a6",
    fontSize: 16,
    fontWeight: "700",
  },
});
