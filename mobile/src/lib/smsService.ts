import { Platform } from "react-native";

export interface SmsRecipient {
  name: string;
  phoneNumber: string;
}

/**
 * Request notification permissions.
 * Web: uses browser Notification API.
 * Native: uses expo-notifications.
 */
export async function requestSmsPermissions(): Promise<void> {
  if (Platform.OS === "web") {
    if ("Notification" in window && Notification.permission !== "denied") {
      await Notification.requestPermission();
    }
    return;
  }
  const Notifications = require("expo-notifications");
  await Notifications.requestPermissionsAsync();
}

/**
 * Send a notification/SMS simulation.
 * Web: browser notification.
 * Native: local push notification.
 */
export async function sendNotification(
  to: SmsRecipient,
  message: string
): Promise<boolean> {
  if (Platform.OS === "web") {
    if (
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification(`SMS to ${to.name} (${to.phoneNumber})`, {
        body: message,
      });
      return true;
    }
    console.log(`[SMS Gateway] To: ${to.phoneNumber} | Msg: ${message}`);
    return true;
  }

  const Notifications = require("expo-notifications");
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `SMS to ${to.name}`,
      body: message,
    },
    trigger: null,
  });
  return true;
}

/**
 * Broadcast a message to multiple recipients.
 */
export async function broadcastMessage(
  message: string,
  recipients: SmsRecipient[]
): Promise<{ name: string; success: boolean }[]> {
  const results = await Promise.all(
    recipients.map(async (r) => {
      const success = await sendNotification(r, message);
      return { name: r.name, success };
    })
  );
  return results;
}
