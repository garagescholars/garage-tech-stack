import { Platform } from "react-native";

export async function downloadCSV(csv: string, filename: string) {
  if (Platform.OS === "web") {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const FileSystem = require("expo-file-system");
    const Sharing = require("expo-sharing");
    const uri = FileSystem.documentDirectory + filename;
    await FileSystem.writeAsStringAsync(uri, csv);
    await Sharing.shareAsync(uri, { mimeType: "text/csv" });
  }
}
