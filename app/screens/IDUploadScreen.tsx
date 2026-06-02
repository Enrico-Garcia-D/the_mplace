import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { doc, setDoc } from "firebase/firestore";
import { db, auth } from "@/services/firebase";
import { uploadGovernmentIdImages } from "@/services/storage";
import { verifyIDWithVerihubs } from "@/services/verificationService";
import { useTheme } from "../theme";

export default function IDUploadScreen() {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeStep, setActiveStep] = useState<"front" | "back">("front");

  const pickImage = async (side: "front" | "back") => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please allow access to your photo library.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      if (side === "front") {
        setFrontImage(result.assets[0].uri);
        if (!backImage) setActiveStep("back");
      } else {
        setBackImage(result.assets[0].uri);
      }
    }
  };

  const takePhoto = async (side: "front" | "back") => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your camera.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      if (side === "front") {
        setFrontImage(result.assets[0].uri);
        if (!backImage) setActiveStep("back");
      } else {
        setBackImage(result.assets[0].uri);
      }
    }
  };

  const uploadID = async () => {
    if (!frontImage || !backImage || !auth.currentUser) return;

    try {
      setUploading(true);

      const uid = auth.currentUser.uid;
      
      // Upload images to storage
      const { frontURL, backURL } = await uploadGovernmentIdImages(
        uid,
        frontImage,
        backImage,
      );

      // Verify ID with Verihubs API
      const verificationResult = await verifyIDWithVerihubs(frontImage, backImage);

      // Save verification data to Firestore
      await setDoc(
        doc(db, "users", uid),
        {
          idPhotoURLFront: frontURL,
          idPhotoURLBack: backURL,
          verificationData: verificationResult,
          status: verificationResult.verified ? "verified" : "pending",
          idUploadedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      Alert.alert(
        verificationResult.verified
          ? "ID verified!"
          : "ID submitted for review",
        verificationResult.verified
          ? `Welcome, ${verificationResult.name}! Your account is now fully verified.`
          : "Your ID has been submitted for manual review. You will get access within 24-48 hours.",
        [
          {
            text: "OK",
            onPress: () => {
              if (verificationResult.verified) {
                router.replace("/(tabs)");
              } else {
                router.replace("/pending");
              }
            },
          },
        ],
      );
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert(
        "Verification failed",
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.brandMark}>
          <Ionicons name="shield-checkmark" size={30} color="#0f766e" />
        </View>
        <Text style={styles.kicker}>M-Place verification</Text>
        <Text style={styles.title}>Secure your local marketplace account</Text>
        <Text style={styles.subtitle}>
          Upload both sides of your government ID so buyers and sellers know they are
          dealing with a verified neighbor.
        </Text>
      </View>

      <View style={styles.trustRow}>
        <View style={styles.trustItem}>
          <Ionicons name="lock-closed" size={18} color="#0f766e" />
          <Text style={styles.trustText}>Instant verification</Text>
        </View>
        <View style={styles.trustDivider} />
        <View style={styles.trustItem}>
          <Ionicons name="time" size={18} color="#0f766e" />
          <Text style={styles.trustText}>~5 minutes</Text>
        </View>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressStep}>
          <View
            style={frontImage ? styles.stepNumberComplete : styles.stepNumber}
          >
            {frontImage ? (
              <Ionicons name="checkmark" size={16} color="#fff" />
            ) : (
              <Text style={styles.stepNumberText}>1</Text>
            )}
          </View>
          <Text style={styles.stepLabel}>Front side</Text>
        </View>

        <View style={styles.progressLine} />

        <View style={styles.progressStep}>
          <View
            style={backImage ? styles.stepNumberComplete : styles.stepNumber}
          >
            {backImage ? (
              <Ionicons name="checkmark" size={16} color="#fff" />
            ) : (
              <Text style={styles.stepNumberText}>2</Text>
            )}
          </View>
          <Text style={styles.stepLabel}>Back side</Text>
        </View>
      </View>

      {/* Front Image Section */}
      <View style={styles.idSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Front of ID</Text>
          {frontImage && (
            <Ionicons name="checkmark-circle" size={20} color="#0f766e" />
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.previewBox,
            activeStep === "front" && styles.previewBoxActive,
          ]}
          onPress={() => setActiveStep("front")}
          activeOpacity={0.85}
        >
          {frontImage ? (
            <>
              <Image source={{ uri: frontImage }} style={styles.previewImage} />
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setFrontImage(null)}
              >
                <Ionicons name="close-circle" size={28} color="#ef4444" />
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.placeholder}>
              <View style={styles.placeholderIcon}>
                <Ionicons name="id-card" size={42} color="#64748b" />
              </View>
              <Text style={styles.placeholderTitle}>Upload front side</Text>
              <Text style={styles.placeholderText}>
                Show the front of your ID clearly
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {!frontImage && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => pickImage("front")}
              activeOpacity={0.82}
            >
              <Ionicons name="images" size={20} color="#1f2937" />
              <Text style={styles.optionButtonText}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => takePhoto("front")}
              activeOpacity={0.82}
            >
              <Ionicons name="camera" size={20} color="#1f2937" />
              <Text style={styles.optionButtonText}>Camera</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Back Image Section */}
      <View style={styles.idSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Back of ID</Text>
          {backImage && (
            <Ionicons name="checkmark-circle" size={20} color="#0f766e" />
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.previewBox,
            activeStep === "back" && styles.previewBoxActive,
          ]}
          onPress={() => setActiveStep("back")}
          activeOpacity={0.85}
        >
          {backImage ? (
            <>
              <Image source={{ uri: backImage }} style={styles.previewImage} />
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setBackImage(null)}
              >
                <Ionicons name="close-circle" size={28} color="#ef4444" />
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.placeholder}>
              <View style={styles.placeholderIcon}>
                <Ionicons name="id-card" size={42} color="#64748b" />
              </View>
              <Text style={styles.placeholderTitle}>Upload back side</Text>
              <Text style={styles.placeholderText}>
                Show the back of your ID clearly
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {!backImage && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => pickImage("back")}
              activeOpacity={0.82}
            >
              <Ionicons name="images" size={20} color="#1f2937" />
              <Text style={styles.optionButtonText}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => takePhoto("back")}
              activeOpacity={0.82}
            >
              <Ionicons name="camera" size={20} color="#1f2937" />
              <Text style={styles.optionButtonText}>Camera</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.guidelines}>
        <Text style={styles.guidelinesTitle}>Quality requirements</Text>
        <View style={styles.guidelineItem}>
          <Ionicons name="checkmark" size={16} color="#0f766e" />
          <Text style={styles.guidelineText}>
            PhilSys ID, driver license, passport, UMID, or PRC ID
          </Text>
        </View>
        <View style={styles.guidelineItem}>
          <Ionicons name="checkmark" size={16} color="#0f766e" />
          <Text style={styles.guidelineText}>
            Full ID inside the frame with no blur or glare
          </Text>
        </View>
        <View style={styles.guidelineItem}>
          <Ionicons name="checkmark" size={16} color="#0f766e" />
          <Text style={styles.guidelineText}>
            Good lighting and readable text
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.submitButton,
          (!frontImage || !backImage || uploading) &&
            styles.submitButtonDisabled,
        ]}
        onPress={uploadID}
        disabled={!frontImage || !backImage || uploading}
        activeOpacity={0.85}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="cloud-upload" size={20} color="#fff" />
            <Text style={styles.submitButtonText}>Verify with Verihubs</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.securityNote}>
        <Ionicons name="lock-closed-outline" size={16} color="#64748b" />
        <Text style={styles.note}>
          Your ID is processed securely by Verihubs and only your verified information is stored.
        </Text>
      </View>
    </ScrollView>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    content: {
      paddingHorizontal: 24,
      paddingTop: 62,
      paddingBottom: 32,
      gap: 16,
    },
    header: { gap: 10 },
    brandMark: {
      width: 58,
      height: 58,
      borderRadius: 8,
      backgroundColor: theme.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    kicker: {
      color: theme.primary,
      fontSize: 13,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    title: { color: theme.text, fontSize: 30, fontWeight: "800", lineHeight: 36 },
    subtitle: { color: theme.subtext, fontSize: 15, lineHeight: 23 },
    trustRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.primarySoft,
      backgroundColor: theme.surface,
      borderRadius: 8,
      paddingVertical: 13,
      paddingHorizontal: 14,
    },
    trustItem: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
    },
    trustDivider: { width: 1, height: 22, backgroundColor: theme.primary },
    trustText: { color: theme.primary, fontSize: 13, fontWeight: "700" },

    // Progress Indicator Styles
    progressContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 16,
      paddingHorizontal: 8,
    },
    progressStep: {
      alignItems: "center",
      gap: 6,
    },
    stepNumber: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    stepNumberComplete: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    stepNumberText: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.text,
    },
    stepLabel: {
      fontSize: 12,
      color: theme.subtext,
      fontWeight: "600",
    },
    progressLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.border,
      marginHorizontal: 8,
    },

    // ID Section Styles
    idSection: {
      gap: 12,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 4,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "800",
    },

    previewBox: {
      width: "100%",
      height: 200,
      borderRadius: 8,
      overflow: "hidden",
      borderWidth: 2,
      borderColor: theme.border,
      borderStyle: "dashed",
      backgroundColor: theme.surface,
    },
    previewBoxActive: {
      borderColor: theme.primary,
      borderWidth: 2,
    },
    previewImage: { width: "100%", height: "100%", resizeMode: "cover" },
    clearButton: {
      position: "absolute",
      top: 10,
      right: 10,
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: 2,
    },
    placeholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
      gap: 8,
    },
    placeholderIcon: {
      width: 76,
      height: 76,
      borderRadius: 8,
      backgroundColor: theme.card,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    placeholderTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    placeholderText: {
      color: theme.subtext,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
    },

    actionRow: { flexDirection: "row", gap: 12 },
    optionButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    optionButtonText: { fontSize: 14, color: theme.text, fontWeight: "800" },

    guidelines: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 16,
      gap: 10,
    },
    guidelinesTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
    guidelineItem: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    guidelineText: { flex: 1, color: theme.subtext, fontSize: 13, lineHeight: 19 },

    submitButton: {
      minHeight: 56,
      borderRadius: 8,
      backgroundColor: theme.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    submitButtonDisabled: { backgroundColor: theme.secondary },
    submitButtonText: { color: theme.primaryText, fontSize: 16, fontWeight: "800" },

    securityNote: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "center",
      gap: 7,
      paddingHorizontal: 8,
    },
    note: {
      flex: 1,
      fontSize: 12,
      color: theme.subtext,
      textAlign: "center",
      lineHeight: 18,
    },
  });
