import React, { useMemo, useState, useCallback } from "react";
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
import { assessIdQuality } from "@/services/idQualityService";

import { useTheme } from "../theme";
const TMLogo = require("../../assets/images/TM-Logo.png");

type Step = "front" | "back" | "review";

const STEPS: Step[] = ["front", "back", "review"];

const STEP_META: Record<
  Exclude<Step, "review">,
  {
    title: string;
    subtitle: string;
    label: string;
    icon: string;
    placeholder: string;
  }
> = {
  front: {
    title: "Front of ID",
    subtitle:
      "Position the front side so all text and the photo are clearly visible.",
    label: "Front side",
    icon: "id-card",
    placeholder: "Tap below to capture or upload the front",
  },
  back: {
    title: "Back of ID",
    subtitle: "Now flip your ID and capture the back side.",
    label: "Back side",
    icon: "id-card-outline",
    placeholder: "Tap below to capture or upload the back",
  },
};

const ACCEPTED_IDS = [
  "PhilSys National ID",
  "Driver's License",
  "Passport",
  "UMID",
  "PRC ID",
];

export default function IDUploadScreen() {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();

  const [step, setStep] = useState<Step>("front");
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const currentStepIndex = STEPS.indexOf(step);

  const requestAndPickImage = useCallback(
    async (side: "front" | "back", source: "gallery" | "camera") => {
      let result: ImagePicker.ImagePickerResult;

      if (source === "gallery") {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission needed",
            "Please allow access to your photo library.",
          );
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
          Alert.alert(
            "Permission needed",
            "Please allow access to your camera.",
          );
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.85,
        });
      }

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        if (side === "front") {
          setFrontImage(uri);
        } else {
          setBackImage(uri);
        }
      }
    },
    [],
  );

  const handleNext = () => {
    if (step === "front") setStep("back");
    else if (step === "back") setStep("review");
  };

  const handleBack = () => {
    if (step === "back") setStep("front");
    else if (step === "review") setStep("back");
  };

  const handleRetake = (side: "front" | "back") => {
    if (side === "front") {
      setFrontImage(null);
      setStep("front");
    } else {
      setBackImage(null);
      setStep("back");
    }
  };

  const uploadID = async () => {
    if (!frontImage || !backImage || !auth.currentUser) return;

    try {
      setUploading(true);
      const uid = auth.currentUser.uid;

      const { frontURL, backURL } = await uploadGovernmentIdImages(
        uid,
        frontImage,
        backImage,
      );

      const idQuality = await assessIdQuality(frontImage, backImage);

      // Prototype mode: keep everyone pending until manual review.
      await setDoc(
        doc(db, "users", uid),
        {
          idPhotoURLFront: frontURL,
          idPhotoURLBack: backURL,
          verificationData: idQuality,
          status: "pending",
          idUploadedAt: new Date().toISOString(),
          idQualityAt: new Date().toISOString(),
        },
        { merge: true },
      );

      Alert.alert(
        "ID submitted for review",
        idQuality.ok
          ? "Thanks! Your ID looks complete. It’s been submitted for manual review."
          : "We received your ID images, but something looks off (e.g., missing/unclear). It’s been submitted for manual review.",
        [
          {
            text: "OK",
            onPress: () => {
              router.replace("/pending");
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

  // ─── Step: Front / Back capture ──────────────────────────────────────────────
  const renderCaptureStep = (side: "front" | "back") => {
    const meta = STEP_META[side];
    const image = side === "front" ? frontImage : backImage;

    return (
      <>
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>{meta.title}</Text>
          <Text style={styles.stepSubtitle}>{meta.subtitle}</Text>
        </View>

        {/* ID preview / placeholder */}
        <View style={[styles.idFrame, image && styles.idFrameFilled]}>
          {image ? (
            <>
              <Image source={{ uri: image }} style={styles.idImage} />
              {/* Overlay corners for a "scan" feel */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </>
          ) : (
            <View style={styles.idPlaceholder}>
              <View style={styles.idPlaceholderIcon}>
                <Ionicons
                  name={meta.icon as any}
                  size={48}
                  color={theme.subtext}
                />
              </View>
              <Text style={styles.idPlaceholderText}>{meta.placeholder}</Text>
              <View style={styles.acceptedList}>
                {ACCEPTED_IDS.map((id) => (
                  <View key={id} style={styles.acceptedChip}>
                    <Text style={styles.acceptedChipText}>{id}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Status / retake row */}
        {image ? (
          <View style={styles.captureStatusRow}>
            <View style={styles.captureStatusBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
              <Text style={styles.captureStatusText}>Looks good</Text>
            </View>
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={() =>
                side === "front" ? setFrontImage(null) : setBackImage(null)
              }
              activeOpacity={0.75}
            >
              <Ionicons name="refresh" size={16} color={theme.primary} />
              <Text style={styles.retakeButtonText}>Retake</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.captureActions}>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={() => requestAndPickImage(side, "camera")}
              activeOpacity={0.82}
            >
              <Ionicons name="camera" size={22} color={theme.primaryText} />
              <Text style={styles.captureButtonText}>Take photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.galleryButton}
              onPress={() => requestAndPickImage(side, "gallery")}
              activeOpacity={0.82}
            >
              <Ionicons name="images" size={20} color={theme.text} />
              <Text style={styles.galleryButtonText}>Upload from gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Tips for a clear photo</Text>
          {[
            "All four corners of the ID must be visible",
            "No blur, glare, or reflections on the surface",
            "Good lighting — avoid direct sunlight",
          ].map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <Ionicons name="checkmark" size={14} color={theme.primary} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* Next / Continue */}
        <TouchableOpacity
          style={[styles.primaryButton, !image && styles.primaryButtonDisabled]}
          onPress={handleNext}
          disabled={!image}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>
            {side === "front" ? "Continue to back side" : "Review & submit"}
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </>
    );
  };

  // ─── Step: Review ─────────────────────────────────────────────────────────────
  const renderReviewStep = () => (
    <>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Review your ID</Text>
        <Text style={styles.stepSubtitle}>
          Make sure both sides are clear and fully visible before submitting.
        </Text>
      </View>

      {(["front", "back"] as const).map((side) => {
        const image = side === "front" ? frontImage : backImage;
        return (
          <View key={side} style={styles.reviewCard}>
            <View style={styles.reviewCardHeader}>
              <Text style={styles.reviewCardLabel}>
                {side === "front" ? "Front side" : "Back side"}
              </Text>
              <TouchableOpacity
                onPress={() => handleRetake(side)}
                style={styles.retakeButton}
                activeOpacity={0.75}
              >
                <Ionicons name="refresh" size={15} color={theme.primary} />
                <Text style={styles.retakeButtonText}>Retake</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.reviewImageWrap}>
              <Image source={{ uri: image! }} style={styles.reviewImage} />
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
          </View>
        );
      })}

      <TouchableOpacity
        style={[
          styles.primaryButton,
          uploading && styles.primaryButtonDisabled,
        ]}
        onPress={uploadID}
        disabled={uploading}
        activeOpacity={0.85}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="shield-checkmark" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Verify my ID</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.securityNote}>
        <Ionicons name="lock-closed-outline" size={14} color={theme.subtext} />
        <Text style={styles.securityNoteText}>
          Processed securely by Verihubs. Only verified info is stored — your ID
          photos are not retained.
        </Text>
      </View>
    </>
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.topBar}>
        {step !== "front" ? (
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backButton} />
        )}

        <View style={styles.brandRow}>
          <Image source={TMLogo} style={styles.brandLogo} />
          <Text style={styles.brandText}>M-Place Verification</Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      {/* Step progress bar */}
      <View style={styles.progressBar}>
        {STEPS.map((s, i) => (
          <View
            key={s}
            style={[
              styles.progressSegment,
              i <= currentStepIndex && styles.progressSegmentActive,
            ]}
          />
        ))}
      </View>

      <Text style={styles.progressLabel}>
        Step {currentStepIndex + 1} of {STEPS.length}
      </Text>

      {step === "front" && renderCaptureStep("front")}
      {step === "back" && renderCaptureStep("back")}
      {step === "review" && renderReviewStep()}
    </ScrollView>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    content: {
      paddingHorizontal: 20,
      paddingTop: 56,
      paddingBottom: 40,
      gap: 20,
    },

    // Top bar
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    brandLogo: {
      width: 28,
      height: 28,
      resizeMode: "contain",
    },
    brandText: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.primary,
    },

    // Progress bar
    progressBar: {
      flexDirection: "row",
      gap: 6,
      marginTop: 4,
    },
    progressSegment: {
      flex: 1,
      height: 4,
      borderRadius: 4,
      backgroundColor: theme.border,
    },
    progressSegmentActive: {
      backgroundColor: theme.primary,
    },
    progressLabel: {
      fontSize: 12,
      color: theme.subtext,
      fontWeight: "600",
      marginTop: -8,
    },

    // Step header
    stepHeader: { gap: 6, marginTop: 4 },
    stepTitle: {
      fontSize: 26,
      fontWeight: "800",
      color: theme.text,
      lineHeight: 32,
    },
    stepSubtitle: {
      fontSize: 14,
      color: theme.subtext,
      lineHeight: 21,
    },

    // ID frame (capture step)
    idFrame: {
      width: "100%",
      aspectRatio: 1.585, // standard ID card ratio
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.border,
      borderStyle: "dashed",
      backgroundColor: theme.surface,
      overflow: "hidden",
    },
    idFrameFilled: {
      borderStyle: "solid",
      borderColor: "#16a34a",
    },
    idImage: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    idPlaceholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      padding: 20,
    },
    idPlaceholderIcon: {
      width: 72,
      height: 72,
      borderRadius: 10,
      backgroundColor: theme.card,
      alignItems: "center",
      justifyContent: "center",
    },
    idPlaceholderText: {
      fontSize: 14,
      color: theme.subtext,
      textAlign: "center",
      lineHeight: 20,
    },
    acceptedList: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      justifyContent: "center",
      marginTop: 4,
    },
    acceptedChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    acceptedChipText: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.subtext,
    },

    // Corner scan overlay
    corner: {
      position: "absolute",
      width: 18,
      height: 18,
      borderColor: theme.primary,
    },
    cornerTL: { top: 10, left: 10, borderTopWidth: 3, borderLeftWidth: 3 },
    cornerTR: { top: 10, right: 10, borderTopWidth: 3, borderRightWidth: 3 },
    cornerBL: {
      bottom: 10,
      left: 10,
      borderBottomWidth: 3,
      borderLeftWidth: 3,
    },
    cornerBR: {
      bottom: 10,
      right: 10,
      borderBottomWidth: 3,
      borderRightWidth: 3,
    },

    // Capture status row
    captureStatusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 4,
    },
    captureStatusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    captureStatusText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#16a34a",
    },
    retakeButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    retakeButtonText: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.primary,
    },

    // Capture actions
    captureActions: { gap: 10 },
    captureButton: {
      minHeight: 52,
      borderRadius: 10,
      backgroundColor: theme.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    captureButtonText: {
      fontSize: 15,
      fontWeight: "800",
      color: theme.primaryText,
    },
    galleryButton: {
      minHeight: 48,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    galleryButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.text,
    },

    // Tips card
    tipsCard: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 14,
      gap: 8,
    },
    tipsTitle: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.text,
    },
    tipRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    tipText: {
      flex: 1,
      fontSize: 13,
      color: theme.subtext,
      lineHeight: 19,
    },

    // Primary CTA
    primaryButton: {
      minHeight: 54,
      borderRadius: 10,
      backgroundColor: theme.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    primaryButtonDisabled: {
      backgroundColor: theme.secondary,
    },
    primaryButtonText: {
      fontSize: 15,
      fontWeight: "800",
      color: theme.primaryText ?? "#fff",
    },

    // Review step
    reviewCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      overflow: "hidden",
    },
    reviewCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    reviewCardLabel: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.text,
    },
    reviewImageWrap: {
      width: "100%",
      aspectRatio: 1.585,
      position: "relative",
    },
    reviewImage: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },

    // Security note
    securityNote: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 7,
      paddingHorizontal: 4,
    },
    securityNoteText: {
      flex: 1,
      fontSize: 12,
      color: theme.subtext,
      lineHeight: 18,
    },
  });
