import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { getGoogleSignInErrorMessage, signInWithGoogle } from '../../services/auth';
import { useThemeMode } from '../theme';
import DefaultBackground from '../components/DefaultBackground';

const TMLogo = require('../../assets/images/TM-Logo.png');

export default function LoginScreen() {
  const { theme, isDarkMode } = useThemeMode();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [loading, setLoading] = useState(false);
  const panelBackground = isDarkMode ? 'rgba(13, 36, 69, 0.88)' : theme.card;
  const panelBorder = isDarkMode ? 'rgba(91, 183, 255, 0.18)' : 'rgba(15, 118, 110, 0.14)';
  const logoBackground = isDarkMode ? 'rgba(13, 36, 69, 0.84)' : theme.surface;
  const actionBackground = theme.primary;
  const actionBorder = isDarkMode ? 'rgba(140, 210, 255, 0.28)' : theme.primary;
  const actionText = theme.primaryText;


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
    <DefaultBackground>
      <View style={styles.screen}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={[styles.logoMark, { backgroundColor: logoBackground, borderColor: panelBorder }]}>
              <Image source={TMLogo} style={styles.logoImage} />
            </View>
            <Text style={styles.appName}>The MarketPlace</Text>
            <Text style={styles.tagline}>
              Buy and sell safely with verified people nearby.
            </Text>
          </View>

          <View
            style={[
              styles.securePanel,
              {
                backgroundColor: panelBackground,
                borderColor: panelBorder,
              },
            ]}
          >
            <View style={styles.idTopRow}>
              <Ionicons name="shield-checkmark" size={22} color={theme.primary} />
              <Text style={styles.idTopText}>ID-VERIFIED</Text>
            </View>

            <View style={styles.idCenterBlock}>
              <Text style={styles.secureSubText}>
                Every account submits a valid government ID before joining the local marketplace.
              </Text>
            </View>

            <View style={styles.idBottomChecklist}>
              <View style={styles.checkRow}>
                <View style={styles.checkIndex}>
                  <Text style={styles.checkIndexText}>1</Text>
                </View>
                <Ionicons name="checkmark-circle" size={17} color={theme.primary} />
                <Text style={styles.checkText}>Helps reduce fake buyers and sellers</Text>
              </View>

              <View style={styles.checkRow}>
                <View style={styles.checkIndex}>
                  <Text style={styles.checkIndexText}>2</Text>
                </View>
                <Ionicons name="checkmark-circle" size={17} color={theme.primary} />
                <Text style={styles.checkText}>Review usually completes in 24-48 hours</Text>
              </View>
            </View>
          </View>

          <View style={styles.bottom}>
            <TouchableOpacity
              style={[
                styles.googleButton,
                {
                  backgroundColor: actionBackground,
                  borderColor: actionBorder,
                },
                loading && styles.googleButtonDisabled,
              ]}
              onPress={handleGoogleSignIn}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={actionText} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color={actionText} />
                  <Text style={[styles.googleButtonText, { color: actionText }]}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              By signing in, you agree to submit a valid government ID for verification.
            </Text>
          </View>
        </View>
      </View>
    </DefaultBackground>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    screen: {
      flex: 1,
    },
    container: {
      flex: 1,
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
      width: 112,
      height: 112,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
      borderWidth: 0.5,
      ...(Platform.OS === 'ios'
        ? {
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
          }
        : {}),
    },
    logoImage: {
      width: 84,
      height: 84,
      resizeMode: 'contain',
    },
    appName: {
      fontSize: 38,
      fontWeight: '900',
      color: theme.text,
      letterSpacing: -0.5,
    },
    tagline: {
      fontSize: 15,
      color: theme.subtext,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 290,
    },
    securePanel: {
      borderRadius: 16,
      padding: 18,
      borderWidth: 0.5,
      gap: 14,
      ...(Platform.OS === 'ios'
        ? {
            shadowColor: '#000',
            shadowOpacity: 0.07,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 10 },
          }
        : {}),
      overflow: 'hidden',
    },
    idTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      zIndex: 1,
    },
    idTopText: {
      fontSize: 14,
      fontWeight: '900',
      color: theme.primary,
      letterSpacing: 0.6,
    },
    idCenterBlock: {
      paddingHorizontal: 6,
      zIndex: 1,
    },
    secureSubText: {
      fontSize: 13,
      color: theme.subtext,
      textAlign: 'center',
      lineHeight: 20,
    },
    idBottomChecklist: {
      gap: 10,
      zIndex: 1,
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingTop: 2,
    },
    checkIndex: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.primarySoft,
      borderWidth: 1,
      borderColor: theme.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkIndexText: {
      fontSize: 11,
      fontWeight: '900',
      color: theme.primary,
    },
    checkText: {
      flex: 1,
      fontSize: 12,
      color: theme.text,
      lineHeight: 18,
      fontWeight: '700',
    },

    bottom: {
      gap: 15,
    },
    googleButton: {
      minHeight: 56,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 9,
      borderWidth: 0.5,
    },
    googleButtonDisabled: {
      opacity: 0.88,
    },
    googleButtonText: {
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
