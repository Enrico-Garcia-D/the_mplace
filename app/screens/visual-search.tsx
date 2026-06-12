import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTheme } from "../theme";

// MVP placeholder UI.
// Next step is to wire this up to real embedding + similarity search.

export default function VisualSearchScreen() {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const params = useLocalSearchParams<{ seedImageUri?: string }>();

  const [imageUri, setImageUri] = useState<string | null>(
    (Array.isArray(params.seedImageUri)
      ? params.seedImageUri[0]
      : params.seedImageUri) ?? null,
  );
  const [picking, setPicking] = useState(false);
  const [searching, setSearching] = useState(false);

  const pickImage = async (source: "camera" | "gallery") => {
    try {
      setPicking(true);

      let result: ImagePicker.ImagePickerResult;

      if (source === "gallery") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission needed", "Please allow access to your photo library.");
          return;
        }

        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.85,
        });
      } else {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission needed", "Please allow access to your camera.");
          return;
        }

        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.85,
        });
      }

      if (!result.canceled) {
        const uri = result.assets[0]?.uri;
        if (uri) setImageUri(uri);
      }
    } finally {
      setPicking(false);
    }
  };

  const runSimilaritySearch = async () => {
    if (!imageUri) {
      Alert.alert("Pick an image first", "Choose a photo to find similar listings.");
      return;
    }

    // TODO: implement backend call:
    // 1) upload image or pass imageUrl
    // 2) server computes embedding
    // 3) server does vector similarity search over listing embeddings
    setSearching(true);
    try {
      // For now: placeholder
      Alert.alert(
        "Visual search (MVP)",
        "UI is wired. Next step is embedding + similarity search integration."
      );
    } finally {
      setSearching(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Find similar by picture</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          {imageUri ? (
            <View>
              <Image source={{ uri: imageUri }} style={styles.image} />
              <Text style={styles.helper}>
                Photo selected. Press “Search similar” to find matching listings.
              </Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Ionicons name="images-outline" size={46} color={theme.secondary} />
              <Text style={styles.emptyText}>No image selected</Text>
              <Text style={styles.helper}>
                Choose a product photo (camera or gallery).
              </Text>
            </View>
          )}

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              disabled={picking || searching}
              onPress={() => pickImage("camera")}
            >
              <Ionicons name="camera" size={18} color={theme.primary} />
              <Text style={styles.secondaryBtnText}>Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              disabled={picking || searching}
              onPress={() => pickImage("gallery")}
            >
              <Ionicons name="image-outline" size={18} color={theme.primary} />
              <Text style={styles.secondaryBtnText}>Gallery</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, (!imageUri || searching) && styles.primaryBtnOff]}
            disabled={!imageUri || searching}
            onPress={runSimilaritySearch}
          >
            {searching ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="search" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Search similar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingTop: 56,
      paddingBottom: 14,
      gap: 8,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      flex: 1,
      textAlign: "center",
      fontSize: 14,
      fontWeight: "900",
      color: theme.text,
    },
    content: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },
    card: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 14,
      gap: 12,
    },
    image: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: 12,
      backgroundColor: theme.card,
    },
    helper: {
      marginTop: 8,
      color: theme.subtext,
      fontSize: 13,
      lineHeight: 18,
    },
    emptyWrap: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 26,
    },
    emptyText: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.text,
    },
    actionsRow: { flexDirection: "row", gap: 10 },
    secondaryBtn: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      backgroundColor: theme.card,
    },
    secondaryBtnText: { fontSize: 13, fontWeight: "800", color: theme.primary },
    primaryBtn: {
      borderRadius: 12,
      backgroundColor: theme.primary,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    primaryBtnOff: {
      backgroundColor: theme.secondary,
    },
    primaryBtnText: { fontSize: 14, fontWeight: "900", color: "#fff" },
  });

