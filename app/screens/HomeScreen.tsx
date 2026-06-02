import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from '../../services/auth';
import { useTheme } from '../theme';
import { SignOutConfirmation } from '../components/SignOutConfirmation';

export default function HomeScreen() {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignOut = () => {
    setShowConfirm(true);
  };

  const handleConfirmSignOut = async () => {
    try {
      setLoading(true);
      console.log('Home screen sign-out pressed');
      await signOut();
      console.log('Home screen sign-out: signOut() returned');
    } catch (error) {
      console.error('Sign out failed:', error);
      setShowConfirm(false);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="checkmark-circle" size={46} color={theme.primary} />
      </View>
      <Text style={styles.title}>Welcome to The MarketPlace</Text>
      <Text style={styles.subtitle}>
        Your account is verified. You can now buy and sell with trusted people nearby.
      </Text>
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.82}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
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
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      gap: 14,
    },
    iconWrap: {
      width: 82,
      height: 82,
      borderRadius: 8,
      backgroundColor: theme.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: theme.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      color: theme.subtext,
      textAlign: 'center',
      lineHeight: 23,
    },
    signOutButton: {
      marginTop: 14,
      paddingVertical: 13,
      paddingHorizontal: 34,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    signOutText: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '800',
    },
  });
