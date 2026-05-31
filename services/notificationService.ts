import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { db } from "./firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from "firebase/firestore";

let notificationsConfigured = false;

export function configureNotifications() {
  if (notificationsConfigured) return;
  notificationsConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export function addNotificationResponseHandler(
  onResponse: (data: Record<string, any>) => void,
) {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    onResponse(
      (response.notification.request.content.data ?? {}) as Record<string, any>,
    );
  });

  return () => subscription.remove();
}

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("default", {
    name: "Messages",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#0f766e",
  });
}

function getExpoProjectId() {
  return (
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId
  );
}

export async function registerPushToken(uid: string): Promise<void> {
  configureNotifications();
  await ensureAndroidNotificationChannel();

  if (!Device.isDevice) {
    console.warn("Push notifications require a physical device.");
    return;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    await updateDoc(doc(db, "users", uid), {
      pushNotificationsEnabled: false,
      pushPermissionStatus: finalStatus,
    });
    return;
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    console.warn(
      "Expo projectId is missing. Add extra.eas.projectId to app.json for reliable push tokens.",
    );
  }

  const tokenData = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const pushToken = tokenData.data;

  await updateDoc(doc(db, "users", uid), {
    pushToken,
    expoPushToken: pushToken,
    pushNotificationsEnabled: true,
    pushPermissionStatus: finalStatus,
    pushTokenUpdatedAt: serverTimestamp(),
  });
}

export async function triggerNotification({ recipientId, type, title, body, data = {} }: any) {
  try {
    // A. Create In-App Notification (For the Bell Screen)
    await addDoc(collection(db, "notifications", recipientId, "items"), {
      type,
      title,
      body,
      data,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("In-app notification write failed:", err);
  }

  try {
    const userSnap = await getDoc(doc(db, "users", recipientId));
    const token = userSnap.data()?.expoPushToken ?? userSnap.data()?.pushToken;

    if (token) {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: token,
          title,
          body,
          data: { ...data, type },
          sound: "default",
          channelId: "default",
          priority: "high",
        }),
      });

      const result = await response.json();
      const pushError = Array.isArray(result?.data)
        ? result.data.find((item: any) => item.status === "error")
        : result?.data?.status === "error"
          ? result.data
          : null;

      if (!response.ok || pushError) {
        console.error("Expo push notification failed:", result);
      }
    } else {
      console.warn("No Expo push token found for recipient:", recipientId);
    }
  } catch (err) {
    console.error("Push notification failed:", err);
  }
}

export async function notifyNewMessage({
  recipientUid,
  senderName,
  messageText,
  conversationId,
  listingId,
  listingTitle,
  listingImage,
  listingPrice,
  otherUid,
}: any) {
  return triggerNotification({
    recipientId: recipientUid,
    type: "new_message",
    title: senderName,
    body: messageText,
    data: {
      conversationId,
      senderName,
      listingId,
      listingTitle,
      listingImage,
      listingPrice,
      otherUid,
    },
  });
}
