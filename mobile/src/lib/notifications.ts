import * as Notifications from "expo-notifications";
import * as Device from "expo-constants";
import { Platform } from "react-native";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "../constants/collections";

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register for push notifications and return the Expo push token.
 * Saves token to the user's Firestore profile.
 */
export async function registerForPushNotifications(
  userId: string
): Promise<string | null> {
  if (!Device.default.isDevice) {
    console.warn("Push notifications require a physical device");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("Push notification permission denied");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0f1b2d",
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  // Save to Firestore
  try {
    await updateDoc(doc(db, COLLECTIONS.PROFILES, userId), { pushToken: token });
  } catch {
    console.warn("Failed to save push token to Firestore");
  }

  return token;
}

/**
 * Schedule a local notification.
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data },
    trigger: null, // immediate
  });
}
