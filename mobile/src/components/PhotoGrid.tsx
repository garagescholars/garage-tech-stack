import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  photos: string[];
  onPhotosChanged: (photos: string[]) => void;
  minPhotos: number;
  label?: string;
  maxPhotos?: number;
};

export default function PhotoGrid({
  photos,
  onPhotosChanged,
  minPhotos,
  label = "Photos",
  maxPhotos = 8,
}: Props) {
  const [loading, setLoading] = useState(false);

  const takePhoto = async () => {
    if (photos.length >= maxPhotos) {
      Alert.alert("Maximum Reached", `You can upload up to ${maxPhotos} photos.`);
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Needed", "Camera access is required to take photos.");
      return;
    }

    setLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        onPhotosChanged([...photos, result.assets[0].uri]);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to take photo");
    } finally {
      setLoading(false);
    }
  };

  const pickFromGallery = async () => {
    if (photos.length >= maxPhotos) {
      Alert.alert("Maximum Reached", `You can upload up to ${maxPhotos} photos.`);
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Needed", "Photo library access is required.");
      return;
    }

    setLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: maxPhotos - photos.length,
      });

      if (!result.canceled && result.assets.length > 0) {
        const newPhotos = result.assets.map((a) => a.uri);
        onPhotosChanged([...photos, ...newPhotos].slice(0, maxPhotos));
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to pick photos");
    } finally {
      setLoading(false);
    }
  };

  const removePhoto = (index: number) => {
    const updated = photos.filter((_, i) => i !== index);
    onPhotosChanged(updated);
  };

  const isValid = photos.length >= minPhotos;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.count, isValid ? styles.countValid : styles.countInvalid]}>
          {photos.length}/{minPhotos} min
        </Text>
      </View>

      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
          {photos.map((uri, i) => (
            <View key={i} style={styles.photoWrapper}>
              <Image source={{ uri }} style={styles.photo} />
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => removePhoto(i)}
              >
                <Ionicons name="close-circle" size={22} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.addBtn} onPress={takePhoto} disabled={loading}>
          <Ionicons name="camera" size={20} color="#14b8a6" />
          <Text style={styles.addText}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={pickFromGallery} disabled={loading}>
          <Ionicons name="images" size={20} color="#14b8a6" />
          <Text style={styles.addText}>Gallery</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  count: { fontSize: 13, fontWeight: "700" },
  countValid: { color: "#10b981" },
  countInvalid: { color: "#f59e0b" },
  scroll: { marginBottom: 10 },
  photoWrapper: {
    marginRight: 8,
    position: "relative",
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 10,
    backgroundColor: "#1e293b",
  },
  removeBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#0f1b2d",
    borderRadius: 11,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
  },
  addBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1e293b",
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#334155",
    borderStyle: "dashed",
  },
  addText: {
    color: "#14b8a6",
    fontWeight: "700",
    fontSize: 14,
  },
});
