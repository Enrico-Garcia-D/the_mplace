import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuthRedirect } from './hooks/useAuthRedirect';
import { ThemeModeProvider, useTheme } from './theme';
import DefaultBackground from './components/DefaultBackground';

import { addNotificationResponseHandler, configureNotifications } from '../services/notificationService';

const rootStackScreenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: 'transparent' },
  animation: 'slide_from_right' as const,
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
  animationMatchesGesture: true,
};

type NotificationResponseData = {
  type?: string;
  conversationId?: string;
  listingId?: string;
  listingTitle?: string;
  listingImage?: string;
  listingPrice?: string;
  otherUid?: string;
  senderName?: string;
  otherName?: string;
};

function toNotificationResponseData(data: Record<string, unknown>): NotificationResponseData {
  return {
    type: typeof data.type === 'string' ? data.type : undefined,
    conversationId: typeof data.conversationId === 'string' ? data.conversationId : undefined,
    listingId: typeof data.listingId === 'string' ? data.listingId : undefined,
    listingTitle: typeof data.listingTitle === 'string' ? data.listingTitle : undefined,
    listingImage: typeof data.listingImage === 'string' ? data.listingImage : undefined,
    listingPrice: typeof data.listingPrice === 'string' ? data.listingPrice : undefined,
    otherUid: typeof data.otherUid === 'string' ? data.otherUid : undefined,
    senderName: typeof data.senderName === 'string' ? data.senderName : undefined,
    otherName: typeof data.otherName === 'string' ? data.otherName : undefined,
  };
}

export default function RootLayout() {
  const isReady = useAuthRedirect();
  const router = useRouter();

  useEffect(() => {
    try {
      configureNotifications();
      if (__DEV__) {
        console.log("[App] Notifications configured on startup");
      }
    } catch (error) {
      console.error("[App] Failed to configure notifications:", error);
    }
  }, []);

  useEffect(() => {
    if (__DEV__) {
      console.log("[App] Setting up notification response handler");
    }
    return addNotificationResponseHandler((data) => {
      const payload = toNotificationResponseData(data);
      // Avoid dumping full payload into logs.
      if (__DEV__) {
        console.log("[App] Notification response received:", { type: payload.type, conversationId: payload.conversationId });
      }

      if (payload.type === 'new_message' && payload.conversationId) {
        if (__DEV__) {
          console.log("[App] Navigating to chat screen");
        }
        router.push({
          pathname: '/chat',
          params: {
            conversationId: payload.conversationId,
            listingId: payload.listingId ?? '',
            listingTitle: payload.listingTitle ?? '',
            listingImage: payload.listingImage ?? '',
            listingPrice: payload.listingPrice ?? '',
            otherUid: payload.otherUid ?? '',
            otherName: payload.senderName || payload.otherName || 'User',
          },
        });
      } else if (payload.type === 'new_review') {
        if (__DEV__) {
          console.log("[App] Navigating to reviews screen");
        }
        router.push('/reviews');
      } else {
        console.warn("[App] Unknown notification type:", payload.type);
      }
    });
  }, [router]);

  return (
    <ThemeModeProvider>
      <RootShell isReady={isReady} />
    </ThemeModeProvider>
  );
}

function RootShell({ isReady }: { isReady: boolean }) {
  const theme = useTheme();

  if (!isReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <DefaultBackground>
      <Stack screenOptions={rootStackScreenOptions}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="home" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="listing" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="chat" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="reviews" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="saved-listings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="visual-search" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="id-upload" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="pending" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="my-listings" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </DefaultBackground>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
