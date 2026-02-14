import { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { VIDEO_MIN_SECONDS, VIDEO_MAX_SECONDS } from "../constants/urgency";

type Props = {
  onVideoRecorded: (uri: string) => void;
  label?: string;
};

export default function VideoRecorder({ onVideoRecorded, label = "Record Video" }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recorded, setRecorded] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    if (!cameraRef.current) return;
    setRecording(true);
    setElapsed(0);

    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= VIDEO_MAX_SECONDS) {
          stopRecording();
        }
        return next;
      });
    }, 1000);

    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: VIDEO_MAX_SECONDS,
      });
      if (video?.uri) {
        onVideoRecorded(video.uri);
        setRecorded(true);
      }
    } catch (err: any) {
      Alert.alert("Recording Error", err.message || "Failed to record video");
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (elapsed < VIDEO_MIN_SECONDS) {
      Alert.alert("Too Short", `Video must be at least ${VIDEO_MIN_SECONDS} seconds.`);
      cameraRef.current?.stopRecording();
      setRecording(false);
      return;
    }

    setRecording(false);
    cameraRef.current?.stopRecording();
  };

  if (!permission) {
    return <View style={styles.container}><Text style={styles.label}>Loading camera...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Camera access needed</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (recorded) {
    return (
      <View style={styles.doneContainer}>
        <Ionicons name="checkmark-circle" size={32} color="#10b981" />
        <Text style={styles.doneText}>Video recorded ({elapsed}s)</Text>
        <TouchableOpacity onPress={() => setRecorded(false)}>
          <Text style={styles.retakeText}>Retake</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.cameraWrapper}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          mode="video"
          facing="back"
        />
        {recording && (
          <View style={styles.timerOverlay}>
            <View style={styles.recDot} />
            <Text style={styles.timerText}>
              {elapsed}s / {VIDEO_MAX_SECONDS}s
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.recordBtn, recording && styles.recordBtnActive]}
        onPress={recording ? stopRecording : startRecording}
      >
        <Ionicons
          name={recording ? "stop" : "videocam"}
          size={22}
          color="#fff"
        />
        <Text style={styles.recordText}>
          {recording ? `Stop (min ${VIDEO_MIN_SECONDS}s)` : "Start Recording"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#94a3b8",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cameraWrapper: {
    borderRadius: 12,
    overflow: "hidden",
    height: 240,
    marginBottom: 10,
    position: "relative",
  },
  camera: { flex: 1 },
  timerOverlay: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ef4444",
  },
  timerText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  recordBtn: {
    backgroundColor: "#14b8a6",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  recordBtnActive: { backgroundColor: "#ef4444" },
  recordText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  permBtn: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
    alignSelf: "center",
  },
  permText: { color: "#14b8a6", fontWeight: "700", fontSize: 14 },
  doneContainer: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  doneText: { color: "#f8fafc", fontSize: 15, fontWeight: "600" },
  retakeText: { color: "#14b8a6", fontSize: 14, fontWeight: "700", marginTop: 4 },
});
