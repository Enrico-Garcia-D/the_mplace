import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../services/firebase";
import ImageViewing from "react-native-image-viewing";

// Internal Imports
import { useTheme } from "../theme";
import { VerificationOverlay } from "../components/VerificationOverlay";
import { SaveButton } from "../components/SaveButton";

export default function ListingDetail() {
  const theme = useTheme();
  const { id } = useLocalSearchParams();
  const router = useRouter();

  // Listing Data States
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [imageVisible, setImageVisible] = useState(false);

  // Verification Status States
  const [userStatus, setUserStatus] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [showBlocker, setShowBlocker] = useState(false);

  // 1. Fetch User Verification Status on Mount
  useEffect(() => {
    const fetchUserStatus = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      setStatusLoading(true);
      try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
          // Defaults to 'unverified' if status field is missing
          setUserStatus(userDoc.data().status || "unverified");
        } else {
          setUserStatus("unverified");
        }
      } catch (err) {
        console.error("Error fetching user status:", err);
      } finally {
        setStatusLoading(false);
      }
    };
    fetchUserStatus();
  }, []);

  // 2. Fetch Listing Details
  useEffect(() => {
    let mounted = true;

    const fetchListing = async () => {
      setLoading(true);
      try {
        const listingId = Array.isArray(id) ? id[0] : id;
        if (!listingId) {
          if (mounted) setListing(null);
          return;
        }

        const docRef = doc(db, "listings", listingId as string);
        const docSnap = await getDoc(docRef);

        if (!mounted) return;

        if (docSnap.exists()) {
          setListing({ id: docSnap.id, ...docSnap.data() });
        } else {
          setListing(null);
        }
      } catch (error) {
        console.error("Failed to fetch listing:", error);
        if (mounted) Alert.alert("Error", "Failed to load listing details.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchListing();
    return () => {
      mounted = false;
    };
  }, [id]);

  const isOwner = listing?.sellerUID === auth.currentUser?.uid;
  const isLoggedIn = !!auth.currentUser;

  // 3. Handle Messaging (with verification check)
  const handleMessageSeller = () => {
    if (!isLoggedIn) {
      Alert.alert("Sign in required", "Please sign in to message the seller.");
      return;
    }

    // Wait for verification status to load if user just opened the app
    if (statusLoading) return;

    // BLOCKER LOGIC
    if (userStatus !== "verified") {
      setShowBlocker(true);
      return;
    }

    if (isOwner) {
      Alert.alert("This is your listing", "You cannot message yourself.");
      return;
    }

    const qs = new URLSearchParams({
      listingId: listing.id,
      listingTitle: listing.title ?? "",
      listingImage: listing.imageURL ?? "",
      listingPrice: listing.price != null ? String(listing.price) : "",
      sellerUid: listing.sellerUID ?? "",
      sellerName: listing.sellerName ?? "Seller",
      otherUid: listing.sellerUID ?? "",
      otherName: listing.sellerName ?? "Seller",
    }).toString();

    router.push(`/chat?${qs}` as any);
  };

  const handleEditListing = () => {
    if (!listing?.id) return;
    router.push(`/sell?id=${listing.id}`);
  };

  const handleLeaveReview = () => {
    if (!isLoggedIn) {
      Alert.alert("Sign in required", "Please sign in to leave a review.");
      return;
    }
    router.push({
      pathname: "/listing/leave-review",
      params: {
        listingId: listing.id,
        listingTitle: listing.title ?? "",
        sellerId: listing.sellerUID,
        sellerName: listing.sellerName ?? "Seller",
      },
    } as any);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.notFound}>Listing not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Verification Blocker Overlay */}
      {showBlocker && (
        <VerificationOverlay
          status={userStatus}
          theme={theme}
          router={router}
          onClose={() => setShowBlocker(false)}
        />
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Main Image */}
        <View style={styles.imageBox}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => listing.imageURL && setImageVisible(true)}
            style={{ flex: 1 }}
          >
            {listing.imageURL ? (
              <Image source={{ uri: listing.imageURL }} style={styles.image} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={52} color="#cbd5e1" />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color="#1f2937" />
          </TouchableOpacity>

          {!isOwner && (
            <SaveButton
              listingId={Array.isArray(id) ? id[0] : id}
              style={styles.detailSaveButton}
            />
          )}

          {listing.imageURL && (
            <View style={styles.expandHint}>
              <Ionicons name="expand" size={16} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{listing.title}</Text>
            <Text style={styles.price}>
              ₱{listing.price ? Number(listing.price).toLocaleString() : "N/A"}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={14} color="#64748b" />
              <Text style={styles.metaText}>{listing.location}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="pricetag-outline" size={14} color="#64748b" />
              <Text style={styles.metaText}>{listing.category}</Text>
            </View>
          </View>

          {listing.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{listing.description}</Text>
            </View>
          )}

          {/* Seller Card */}
          <View style={styles.sellerCard}>
            <View style={styles.sellerAvatar}>
              {listing.sellerPhoto ? (
                <Image
                  source={{ uri: listing.sellerPhoto }}
                  style={styles.sellerAvatarImage}
                />
              ) : (
                <Ionicons name="person" size={22} color="#0f766e" />
              )}
            </View>
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerLabel}>Seller</Text>
              <Text style={styles.sellerName}>
                {listing.sellerName ?? "Unknown"}
              </Text>
            </View>
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#0f766e" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          </View>

          {/* Review Action */}
          {!isOwner && isLoggedIn && (
            <TouchableOpacity
              style={styles.reviewButton}
              onPress={handleLeaveReview}
            >
              <Ionicons name="star-outline" size={18} color="#0f766e" />
              <Text style={styles.reviewButtonText}>Leave a Review</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Fullscreen Viewer */}
      {listing.imageURL && (
        <ImageViewing
          images={[{ uri: listing.imageURL }]}
          imageIndex={0}
          visible={imageVisible}
          onRequestClose={() => setImageVisible(false)}
        />
      )}

      {/* Footer Actions */}
      <View style={styles.bottomBar}>
        {isOwner ? (
          <TouchableOpacity
            style={styles.messageButton}
            onPress={handleEditListing}
          >
            <Ionicons name="pencil" size={20} color="#fff" />
            <Text style={styles.messageButtonText}>Edit Listing</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.messageButton}
            onPress={handleMessageSeller}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
            <Text style={styles.messageButtonText}>Message Seller</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  notFound: { fontSize: 16, color: "#64748b" },
  imageBox: { width: "100%", height: 300, backgroundColor: "#f1f5f9" },
  image: { width: "100%", height: "100%", resizeMode: "cover" },
  imagePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  backButton: {
    position: "absolute",
    top: 48,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  expandHint: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 20, gap: 16 },
  titleRow: { gap: 6 },
  title: { fontSize: 22, fontWeight: "800", color: "#111827", lineHeight: 28 },
  price: { fontSize: 24, fontWeight: "800", color: "#0f766e" },
  metaRow: { flexDirection: "row", gap: 16 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 13, color: "#64748b" },
  section: { gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#111827" },
  description: { fontSize: 14, color: "#475569", lineHeight: 22 },
  sellerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.12)",
    padding: 14,
    gap: 12,
  },
  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#ccfbf1",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  sellerAvatarImage: { width: 48, height: 48, borderRadius: 24 },
  sellerInfo: { flex: 1, gap: 2 },
  sellerLabel: { fontSize: 11, color: "#94a3b8", fontWeight: "600" },
  sellerName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  verifiedText: { fontSize: 12, color: "#0f766e", fontWeight: "700" },
  reviewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#0f766e",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#f0fdf9",
  },
  reviewButtonText: { fontSize: 15, fontWeight: "700", color: "#0f766e" },
  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  messageButton: {
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: "#0f766e",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  messageButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  detailSaveButton: {
  position: "absolute",
  top: 48,
  right: 16,
},
});
