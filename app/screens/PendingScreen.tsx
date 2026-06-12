import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router'; // Added
import { signOut } from '../../services/auth';
import { useTheme } from '../theme';
import { SignOutConfirmation } from '../components/SignOutConfirmation';

export default function PendingScreen() {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter(); // Added
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignOut = () => {
    setShowConfirm(true);
  };

  const handleConfirmSignOut = async () => {
    try {
      setLoading(true);
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
      setShowConfirm(false);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="hourglass" size={42} color={theme.primary} />
      </View>
      
      <Text style={styles.title}>Verification pending</Text>
      <Text style={styles.message}>
        Your ID is being reviewed. This usually takes 24-48 hours. 
        You can browse the marketplace in the meantime, but selling features will be limited.
      </Text>

      <View style={styles.statusPanel}>
        <View style={styles.statusRow}>
          <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
          <Text style={styles.statusText}>ID submitted securely</Text>
        </View>
        <View style={styles.statusRow}>
          <Ionicons name="time" size={18} color={theme.primary} />
          <Text style={styles.statusText}>Manual review in progress</Text>
        </View>
      </View>

      <View style={styles.buttonGroup}>
        {/* Primary Action */}
        <TouchableOpacity 
          style={styles.continueButton} 
          onPress={() => router.replace('/(tabs)')} 
          activeOpacity={0.82}
        >
          <Text style={styles.continueText}>Continue to The MarketPlace</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>

        {/* Secondary Action */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.82}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
      <SignOutConfirmation
        visible={showConfirm}
        theme={theme}
        onConfirm={handleConfirmSignOut}
        onCancel={() => setShowConfirm(false)}
        loading={loading}
      />
    </View>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      gap: 15,
    },
    iconWrap: {
      width: 82,
      height: 82,
      borderRadius: 8,
      backgroundColor: theme.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 5,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.text,
      textAlign: 'center',
    },
    message: {
      fontSize: 15,
      color: theme.subtext,
      textAlign: 'center',
      lineHeight: 23,
    },
    statusPanel: {
      alignSelf: 'stretch',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.primarySoft,
      backgroundColor: theme.surface,
      padding: 16,
      gap: 10,
      marginTop: 4,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    statusText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    buttonGroup: {
      width: '100%',
      gap: 12,
      marginTop: 20,
    },
    continueButton: {
      height: 56,
      backgroundColor: theme.primary,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    continueText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '800',
    },
    signOutButton: {
      height: 50,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signOutText: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '800',
    },
  });
