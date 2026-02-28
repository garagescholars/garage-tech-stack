import { Platform } from "react-native";

export const AppStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      return localStorage.getItem(key);
    }
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      localStorage.setItem(key, value);
      return;
    }
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    return AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
      return;
    }
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    return AsyncStorage.removeItem(key);
  },
};
