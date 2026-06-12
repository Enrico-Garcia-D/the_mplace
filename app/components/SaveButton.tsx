import React, { useState, useEffect } from "react";
import { TouchableOpacity, ActivityIndicator, Alert, StyleSheet, ViewStyle, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db, auth } from "../../services/firebase"; // Adjust this path to your firebase config
import { useTheme } from "../theme";

interface SaveButtonProps {
  listingId: string;
  style?: ViewStyle;
}

export const SaveButton = ({ listingId, style }: SaveButtonProps) => {
  const theme = useTheme();
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    let cancelled = false;

    const loadSavedStatus = async () => {
      if (!user || !listingId) return;
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!cancelled && userDoc.exists()) {
          const savedItems = userDoc.data().savedItems || [];
          setIsSaved(savedItems.includes(listingId));
        }
      } catch (error) {
        console.error("Error checking saved status:", error);
      }
    };

    void loadSavedStatus();

    return () => {
      cancelled = true;
    };
  }, [listingId, user]);

  const toggleSave = async () => {
    if (!user) {
      Alert.alert("Sign in required", "Please sign in to save listings.");
      return;
    }

    setLoading(true);
    const userRef = doc(db, "users", user.uid);

    try {
      if (isSaved) {
        await updateDoc(userRef, { savedItems: arrayRemove(listingId) });
        setIsSaved(false);
      } else {
        await updateDoc(userRef, { savedItems: arrayUnion(listingId) });
        setIsSaved(true);
      }
    } catch (error) {
      console.error("Error updating saved items:", error);
      Alert.alert("Error", "Could not update saved items.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity 
      onPress={toggleSave} 
      disabled={loading} 
      style={[
        styles.button,
        { backgroundColor: theme.surface, borderColor: theme.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.primary} />
      ) : (
        <Ionicons 
          name={isSaved ? "heart" : "heart-outline"} 
          size={24} 
          color={isSaved ? "#ef4444" : theme.text} 
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 3,
        }
      : {}),
  },
});
