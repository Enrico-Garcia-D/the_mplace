import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { db } from "./firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from "firebase/firestore";

let notificationsConfigured = false;

export type NotificationPayload = {
  recipientId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

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

  if (__DEV__) {
    console.log("[Notifications] Handler configured for platform:", Platform.OS);
  }
}

export function addNotificationResponseHandler(
  onResponse: (data: Record<string, unknown>) => void,
) {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    onResponse(
      (response.notification.request.content.data ?? {}) as Record<string, unknown>,
    );
  });

  return () => subscription.remove();
}

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== "android") return;

  try {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Messages",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0f766e",
    });
    if (__DEV__) {
      console.log("[Notifications] Android notification channel created");
    }
  } catch (error) {
    console.error("[Notifications] Failed to set Android channel:", error);
  }
}

function getExpoProjectId() {
  return Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
}

export async function registerPushToken(uid: string): Promise<void> {
  if (__DEV__) {
    console.log("[Notifications] Starting push token registration for uid:", uid);
  }

  try {
    configureNotifications();
    await ensureAndroidNotificationChannel();

    if (!Device.isDevice) {
      console.warn("[Notifications] Not a physical device - push notifications unavailable");
      return;
    }

    if (__DEV__) {
      console.log("[Notifications] Physical device detected - requesting permissions");
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (__DEV__) {
      console.log("[Notifications] Current permission status:", existing);
    }

    if (existing !== "granted") {
      if (__DEV__) {
        console.log("[Notifications] Permissions not granted, requesting...");
      }
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
      if (__DEV__) {
        console.log("[Notifications] Permission request result:", finalStatus);
      }
    }

    if (finalStatus !== "granted") {
      console.warn("[Notifications] Permissions denied - push notifications disabled");
      await updateDoc(doc(db, "users", uid), {
        pushNotificationsEnabled: false,
        pushPermissionStatus: finalStatus,
        pushTokenUpdatedAt: serverTimestamp(),
      });
      return;
    }

    const projectId = getExpoProjectId();
    if (__DEV__) {
      console.log("[Notifications] Expo project ID:", projectId ? "configured" : "missing");
    }

    if (!projectId) {
      console.warn(
        "[Notifications] WARNING: Expo projectId is missing. Add extra.eas.projectId to app.json so push notifications can work reliably.",
      );
    }

    if (__DEV__) {
      console.log("[Notifications] Requesting Expo push token...");
    }
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const pushToken = tokenData.data;

    if (__DEV__) {
      console.log("[Notifications] Successfully obtained push token:", pushToken.substring(0, 20) + "...");
    }

    await updateDoc(doc(db, "users", uid), {
      pushToken,
      expoPushToken: pushToken,
      pushNotificationsEnabled: true,
      pushPermissionStatus: finalStatus,
      pushTokenUpdatedAt: serverTimestamp(),
    });

    if (__DEV__) {
      console.log("[Notifications] Push token registered successfully");
    }
  } catch (err) {
    console.error("[Notifications] Push token registration failed:", err);
    try {
      await updateDoc(doc(db, "users", uid), {
        pushNotificationsEnabled: false,
        pushNotificationError: String(err),
        pushTokenUpdatedAt: serverTimestamp(),
      });
    } catch (updateErr) {
      console.error("[Notifications] Failed to update user doc with error:", updateErr);
    }
  }
}

export async function triggerNotification({
  recipientId,
  type,
  title,
  body,
  data = {},
}: NotificationPayload) {
    // Avoid logging recipient identifiers in production.
    if (__DEV__) {
      console.log(`[Notifications] Triggering ${type} notification`);
    }


  try {
    if (__DEV__) {
      console.log("[Notifications] Writing in-app notification to Firebase...");
    }
    await addDoc(collection(db, "notifications", recipientId, "items"), {
      type,
      title,
      body,
      data,
      read: false,
      createdAt: serverTimestamp(),
    });
    if (__DEV__) {
      console.log("[Notifications] In-app notification saved");
    }
  } catch (err) {
    console.error("[Notifications] In-app notification write failed:", err);
  }

  try {
    if (__DEV__) {
      console.log("[Notifications] Fetching push token for recipient...");
    }
    const userSnap = await getDoc(doc(db, "users", recipientId));
    const token = userSnap.data()?.expoPushToken ?? userSnap.data()?.pushToken;

    if (!token) {
      console.warn("[Notifications] No push token found for recipient:", recipientId);
      return;
    }

    if (__DEV__) {
      console.log("[Notifications] Found push token, sending to Expo API...");
    }
    // Minimize sensitive data in push payload.
    // Keep only what the client needs to navigate.
    const minimizedData: Record<string, unknown> = {
      type,
      conversationId: (data as any)?.conversationId,
      listingId: (data as any)?.listingId,
      // Do NOT include messageText / senderName / IDs beyond what navigation requires.
    };

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: token,
        title,
        body,
        data: minimizedData,
        sound: "default",
        channelId: "default",
        priority: "high",
      }),
    });


    const result = await response.json();
    const pushError = Array.isArray(result?.data)
      ? result.data.find((item: { status?: string }) => item.status === "error")
      : result?.data?.status === "error"
        ? result.data
        : null;

    if (!response.ok || pushError) {
      console.error("[Notifications] Expo push API error:", {
        status: response.status,
        error: pushError || result,
      });
    } else {
      if (__DEV__) {
        console.log("[Notifications] Push notification sent successfully");
      }
    }
  } catch (err) {
    console.error("[Notifications] Push notification failed:", err);
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
}: {
  recipientUid: string;
  senderName: string;
  messageText: string;
  conversationId: string;
  listingId?: string;
  listingTitle?: string;
  listingImage?: string;
  listingPrice?: string | number;
  otherUid?: string;
}) {
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
