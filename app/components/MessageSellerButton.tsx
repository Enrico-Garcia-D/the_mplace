import React, { useMemo, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { auth } from '../../services/firebase';
import { ChatListing } from '../../services/chatService';
import { useTheme } from '../theme';

interface Props {
  listing: ChatListing & { sellerUid: string; sellerName: string };
}

export function MessageSellerButton({ listing }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const currentUser = auth.currentUser;

  if (!currentUser || currentUser.uid === listing.sellerUid) return null;

  const handlePress = async (): Promise<void> => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        listingId: listing.id,
        listingTitle: listing.title ?? '',
        listingImage: listing.image ?? '',
        listingPrice: listing.price != null ? String(listing.price) : '',
        sellerUid: listing.sellerUid ?? '',
        sellerName: listing.sellerName ?? '',
        otherUid: listing.sellerUid ?? '',
        otherName: listing.sellerName ?? '',
      }).toString();

      router.push(`/chat?${qs}`);
    } catch (err) {
      Alert.alert('Error', 'Could not open chat. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={handlePress}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Text style={styles.btnText}>Message Seller</Text>
      )}
    </TouchableOpacity>
  );
}

export default MessageSellerButton;

const getStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    btn: {
      backgroundColor: theme.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 20,
      marginBottom: 16,
      borderWidth: 0.5,
      borderColor: theme.primary,
      ...(Platform.OS === 'ios'
        ? {
            shadowColor: theme.shadow,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.18,
            shadowRadius: 8,
          }
        : {}),
    },
    btnText: { fontSize: 16, fontWeight: '700', color: theme.primaryText, letterSpacing: 0.2 },
  });
