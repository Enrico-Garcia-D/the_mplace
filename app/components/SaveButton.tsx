import React, { useState, useEffect } from "react";
import { TouchableOpacity, ActivityIndicator, Alert, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db, auth } from "../../services/firebase"; // Adjust this path to your firebase config

interface SaveButtonProps {
  listingId: string;
  style?: ViewStyle;
}

export const SaveButton = ({ listingId, style }: SaveButtonProps) => {
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    checkIfSaved();
  }, [listingId, user]);

  const checkIfSaved = async () => {
    if (!user || !listingId) return;
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const savedItems = userDoc.data().savedItems || [];
        setIsSaved(savedItems.includes(listingId));
      }
    } catch (error) {
      console.error("Error checking saved status:", error);
    }
  };

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
      style={[styles.button, style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#0f766e" />
      ) : (
        <Ionicons 
          name={isSaved ? "heart" : "heart-outline"} 
          size={24} 
          color={isSaved ? "#ef4444" : "#1f2937"} 
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
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
});