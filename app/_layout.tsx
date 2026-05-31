import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthRedirect } from './hooks/useAuthRedirect';
import { useTheme } from './theme';
import {
  addNotificationResponseHandler,
  configureNotifications,
} from '../services/notificationService';

configureNotifications();

export default function RootLayout() {
  const isReady = useAuthRedirect();
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    return addNotificationResponseHandler((data) => {
      if (data.type === 'new_message' && data.conversationId) {
        router.push({
          pathname: '/chat',
          params: {
            conversationId: data.conversationId,
            listingId: data.listingId || '',
            listingTitle: data.listingTitle || '',
            listingImage: data.listingImage || '',
            listingPrice: data.listingPrice || '',
            otherUid: data.otherUid || '',
            otherName: data.senderName || data.otherName || 'User',
          },
        } as any);
      } else if (data.type === 'new_review') {
        router.push('/reviews' as any);
      }
    });
  }, [router]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="listing" />
      <Stack.Screen name="screens" />
      <Stack.Screen name="my-listings" />
    </Stack>
  );
}
