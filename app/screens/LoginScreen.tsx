import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getGoogleSignInErrorMessage, signInWithGoogle } from '../../services/auth';
import { useTheme } from '../theme';

export default function LoginScreen() {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (error) {
      Alert.alert('Sign in failed', getGoogleSignInErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoMark}>
          <Ionicons name="storefront" size={34} color={theme.primary} />
        </View>
        <Text style={styles.appName}>The MarketPlace</Text>
        <Text style={styles.tagline}>Buy and sell safely with verified people nearby.</Text>
      </View>

      <View style={styles.securePanel}>
        <View style={styles.secureHeader}>
          <Ionicons name="shield-checkmark" size={22} color={theme.primary} />
          <Text style={styles.secureText}>ID-verified community</Text>
        </View>
        <Text style={styles.secureSubText}>
          Every account submits a valid government ID before joining the local marketplace.
        </Text>
        <View style={styles.checkRow}>
          <Ionicons name="checkmark-circle" size={17} color={theme.primary} />
          <Text style={styles.checkText}>Helps reduce fake buyers and sellers</Text>
        </View>
        <View style={styles.checkRow}>
          <Ionicons name="checkmark-circle" size={17} color={theme.primary} />
          <Text style={styles.checkText}>Review usually completes in 24-48 hours</Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <TouchableOpacity
          style={[styles.googleButton, loading && styles.googleButtonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color="#fff" />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          By signing in, you agree to submit a valid government ID for verification.
        </Text>
      </View>
    </View>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      paddingHorizontal: 24,
      justifyContent: 'space-between',
      paddingTop: 82,
      paddingBottom: 38,
    },
    header: {
      alignItems: 'center',
      gap: 9,
    },
    logoMark: {
      width: 68,
      height: 68,
      borderRadius: 8,
      backgroundColor: theme.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    appName: {
      fontSize: 42,
      fontWeight: '800',
      color: theme.text,
    },
    tagline: {
      fontSize: 15,
      color: theme.subtext,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 290,
    },
    securePanel: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.primarySoft,
      gap: 12,
    },
    secureHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    secureText: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.primary,
    },
    secureSubText: {
      fontSize: 14,
      color: theme.subtext,
      textAlign: 'center',
      lineHeight: 21,
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    checkText: {
      flex: 1,
      fontSize: 13,
      color: theme.text,
      lineHeight: 18,
    },
    bottom: {
      gap: 15,
    },
    googleButton: {
      minHeight: 56,
      backgroundColor: theme.primary,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 9,
    },
    googleButtonDisabled: {
      backgroundColor: theme.secondary,
    },
    googleButtonText: {
      color: theme.primaryText,
      fontSize: 16,
      fontWeight: '800',
    },
    disclaimer: {
      fontSize: 12,
      color: theme.subtext,
      textAlign: 'center',
      lineHeight: 18,
    },
  });
