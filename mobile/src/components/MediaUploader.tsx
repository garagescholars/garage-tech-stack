import { useState, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../lib/firebase";
import ProgressBar from "./ProgressBar";

type MediaFile = {
  uri: string;
  type: "image" | "video";
};

type Props = {
  files: MediaFile[];
  storagePath: string;
  onProgress: (percent: number) => void;
  onComplete: (urls: string[]) => void;
  onError: (error: string) => void;
};

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function uploadSingleFile(
  file: MediaFile,
  storagePath: string,
  index: number,
  onFileProgress: (index: number, percent: number) => void
): Promise<string> {
  const ext = file.type === "video" ? "mp4" : "jpg";
  const filename = `${file.type}_${index}_${Date.now()}.${ext}`;
  const fullPath = `${storagePath}${filename}`;

  const response = await fetch(file.uri);
  const blob = await response.blob();
  const storageRef = ref(storage, fullPath);

  return new Promise<string>((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, blob);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onFileProgress(index, percent);
      },
      (error) => {
        reject(error);
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

async function uploadWithRetry(
  file: MediaFile,
  storagePath: string,
  index: number,
  onFileProgress: (index: number, percent: number) => void
): Promise<string> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await uploadSingleFile(file, storagePath, index, onFileProgress);
    } catch (err: any) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error("Upload failed after retries");
}

export default function MediaUploader({
  files,
  storagePath,
  onProgress,
  onComplete,
  onError,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [overallPercent, setOverallPercent] = useState(0);
  const [statusText, setStatusText] = useState("");

  const startUpload = useCallback(async () => {
    if (files.length === 0) {
      onComplete([]);
      return;
    }

    setUploading(true);
    setOverallPercent(0);
    setStatusText(`Uploading 0/${files.length}...`);

    const fileProgress: number[] = new Array(files.length).fill(0);

    const updateOverall = (index: number, percent: number) => {
      fileProgress[index] = percent;
      const total =
        fileProgress.reduce((sum, p) => sum + p, 0) / files.length;
      setOverallPercent(total);
      onProgress(total);
    };

    try {
      const urls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        setStatusText(`Uploading ${i + 1}/${files.length}...`);
        const url = await uploadWithRetry(
          files[i],
          storagePath,
          i,
          updateOverall
        );
        urls.push(url);
      }

      setStatusText("Upload complete");
      setOverallPercent(100);
      onProgress(100);
      onComplete(urls);
    } catch (err: any) {
      const message = err?.message || "Upload failed";
      setStatusText(`Error: ${message}`);
      onError(message);
    } finally {
      setUploading(false);
    }
  }, [files, storagePath, onProgress, onComplete, onError]);

  // Auto-start on mount if files are provided
  // The parent should render this component only when ready to upload
  useState(() => {
    if (files.length > 0) {
      startUpload();
    }
  });

  if (!uploading && overallPercent === 0 && !statusText) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ProgressBar
        progress={overallPercent}
        label="Uploading media"
        color="#14b8a6"
        showPercent
      />
      {statusText ? (
        <Text style={styles.statusText}>{statusText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statusText: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
  },
});
