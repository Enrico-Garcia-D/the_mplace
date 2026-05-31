import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VerificationOverlayProps {
  status: string | null;
  theme: any;
  router: any; 
  onClose?: () => void;
}

export function VerificationOverlay({ status, theme, router, onClose }: VerificationOverlayProps) {
  const isPending = status === 'pending';
  
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: 24 }]}>
      <View style={{ backgroundColor: theme.surface, padding: 24, borderRadius: 20, width: '100%', alignItems: 'center' }}>
        
        {/* DISMISS BUTTON */}
        <TouchableOpacity 
          onPress={onClose} 
          style={{ position: 'absolute', top: 15, right: 15 }}
        >
          <Ionicons name="close" size={24} color={theme.subtext} />
        </TouchableOpacity>

        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Ionicons name={isPending ? "hourglass-outline" : "alert-circle-outline" as any} size={32} color={theme.primary} />
        </View>
        
        <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text, textAlign: 'center', marginBottom: 8 }}>
          {isPending ? "Verification in Progress" : "Identity Check Required"}
        </Text>
        
        <Text style={{ fontSize: 14, color: theme.subtext, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
          {isPending 
            ? "We are currently reviewing your ID. You'll be able to message sellers once approved (24-48h)." 
            : "To keep our community safe, you must submit a valid ID before messaging sellers."}
        </Text>

        <TouchableOpacity 
          style={{ backgroundColor: theme.primary, paddingVertical: 14, borderRadius: 12, width: '100%', alignItems: 'center' }}
          onPress={() => isPending ? router.push('/profile') : router.push('/id-upload')}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>
            {isPending ? "View Status" : "Verify My ID Now"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}