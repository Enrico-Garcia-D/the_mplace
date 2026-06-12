import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signOut } from "../../services/auth";
import { auth, db } from "../../services/firebase";
import { useThemeMode } from "../theme";
import { SignOutConfirmation } from "../components/SignOutConfirmation";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getCountFromServer,
} from "firebase/firestore";
import {
  getReviewSummary,
  SellerReview,
  subscribeToSellerReviews,
} from "../hooks/useReviews";
import { useSavedItems } from "../hooks/useSavedItems";
import { useAuthUid } from "../hooks/useAuthUid";

export default function ProfileTab() {
  const { theme, mode } = useThemeMode();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const uid = useAuthUid();
  const [user, setUser] = useState<any>(null);
  const [totalListings, setTotalListings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<SellerReview[]>([]);
  const { savedIds } = useSavedItems();
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!uid) return;

    return subscribeToSellerReviews(uid, setReviews);
  }, [uid]);

  useEffect(() => {
    let mounted = true;

    const fetchProfile = async () => {
      setLoading(true);
      try {
        if (!uid) {
          if (mounted) setLoading(false);
          return;
        }

        const userDoc = await getDoc(doc(db, "users", uid));
        if (!mounted) return;
        if (userDoc.exists()) setUser(userDoc.data());

        const listingsQuery = query(
          collection(db, "listings"),
          where("sellerUID", "==", uid),
        );
        const countSnap = await getCountFromServer(listingsQuery);
        if (mounted) setTotalListings(countSnap.data().count);
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => {
      mounted = false;
    };
  }, [uid]);

  const handleSignOut = () => {
    setShowSignOutConfirm(true);
  };

  const handleConfirmSignOut = async () => {
    try {
      setSigningOut(true);
      console.log("Profile sign-out button pressed");
      await signOut();
      console.log("Profile sign-out: signOut() returned");
    } catch (error) {
      console.error("Sign out failed:", error);
      setShowSignOutConfirm(false);
      setSigningOut(false);
    }
  };

  const getJoinedAt = (isoDate: string) => {
    if (!isoDate) return "—";
    const date = new Date(isoDate);
    return date.toLocaleString("default", { month: "long", year: "numeric" });
  };

  const reviewSummary = getReviewSummary(reviews);
  const avgRating = reviewSummary.averageLabel;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}></Text>
      </View>
    
      {/* Verification Banner - Shows only when pending */}
      {user?.status === "pending" && (
        <View style={styles.pendingBanner}>
          <Ionicons name="information-circle" size={20} color="#92400e" />
          <Text style={styles.pendingBannerText}>
            Your ID is currently being reviewed by our team.
          </Text>
        </View>
      )}

      {/* User Card */}
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={36} color={theme.primary} />
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {user?.name ?? auth.currentUser?.displayName ?? "—"}
          </Text>
          <Text style={styles.userEmail}>
            {user?.email ?? auth.currentUser?.email ?? "—"}
          </Text>

          {/* Average Rating (if exists) */}
          {avgRating && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={13} color="#F59E0B" />
              <Text style={styles.ratingText}>
                {avgRating} · {reviewSummary.reviewCount}{" "}
                {reviewSummary.reviewCount === 1 ? "review" : "reviews"}
              </Text>
            </View>
          )}

          {/* ONLY ONE STATUS BADGE HERE */}
          {user?.status === "pending" ? (
            <View style={styles.pendingBadge}>
              <Ionicons name="hourglass-outline" size={12} color="#92400e" />
              <Text style={styles.pendingBadgeText}>Verification Pending</Text>
            </View>
          ) : user?.status === "verified" ? (
            <View style={styles.verifiedBadge}>
              <Ionicons
                name="shield-checkmark"
                size={13}
                color={theme.primary}
              />
              <Text style={styles.verifiedText}>Verified member</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{totalListings}</Text>
          <Text style={styles.statLabel}>Listings</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>Sold</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{avgRating ?? "—"}</Text>
          <Text style={styles.statLabel}>Avg Rating</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{getJoinedAt(user?.createdAt)}</Text>
          <Text style={styles.statLabel}>Joined</Text>
        </View>
      </View>

      {/* Reviews Preview */}
      {reviews.length > 0 && (
        <View style={styles.reviewsCard}>
          <View style={styles.reviewsHeader}>
            <Ionicons name="star" size={16} color="#F59E0B" />
            <Text style={styles.reviewsTitle}>Recent Reviews</Text>
          </View>
          {reviews.slice(0, 3).map((review) => (
            <View key={review.id} style={styles.reviewItem}>
              <View style={styles.reviewTop}>
                <Text style={styles.reviewerName}>{review.buyerName}</Text>
                <View style={styles.reviewStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name="star"
                      size={12}
                      color={star <= review.rating ? "#F59E0B" : "#E5E7EB"}
                    />
                  ))}
                </View>
              </View>
              {review.comment ? (
                <Text style={styles.reviewComment}>{review.comment}</Text>
              ) : null}
            </View>
          ))}
          {reviews.length > 3 && (
            <TouchableOpacity
              style={styles.seeAllButton}
              activeOpacity={0.7}
              onPress={() => router.push("/reviews" as any)}
            >
              <Text style={styles.seeAllText}>
                See all {reviews.length} reviews
              </Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={theme.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Menu */}
      <View style={styles.menu}>
        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.8}
          onPress={() => router.push("/my-listings")}
        >
          <Ionicons name="list" size={20} color={theme.primary} />
          <Text style={styles.menuLabel}>My Listings</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.secondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.8}
          onPress={() => router.push("/saved-listings")}
        >
          <Ionicons name="heart" size={20} color={theme.primary} />
          <Text style={styles.menuLabel}>Saved Items</Text>
          {savedIds.length > 0 && (
            <View
              style={{
                backgroundColor: theme.primarySoft,
                paddingHorizontal: 8,
                borderRadius: 10,
                marginRight: 5,
              }}
            >
              <Text
                style={{
                  color: theme.primary,
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                {savedIds.length}
              </Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={theme.secondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.8}
          onPress={() => router.push("/reviews" as any)}
        >
          <Ionicons name="star" size={20} color={theme.primary} />
          <Text style={styles.menuLabel}>Reviews</Text>
          {reviews.length > 0 && (
            <View
              style={{
                backgroundColor: theme.primarySoft,
                paddingHorizontal: 8,
                borderRadius: 10,
                marginRight: 5,
              }}
            >
              <Text
                style={{
                  color: theme.primary,
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                {reviews.length}
              </Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={theme.secondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.8}
          onPress={() => router.push("/settings" as any)}
        >
          <Ionicons name="settings" size={20} color={theme.primary} />
          <Text style={styles.menuLabel}>Settings</Text>
          <Text style={styles.menuValue}>
            {mode === 'automatic' ? 'Automatic' : mode === 'dark' ? 'Dark' : 'Light'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={theme.secondary} />
        </TouchableOpacity>
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleSignOut}
        activeOpacity={0.8}
      >
        <Ionicons name="log-out-outline" size={20} color={theme.danger} />
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <SignOutConfirmation
        visible={showSignOutConfirm}
        theme={theme}
        onConfirm={handleConfirmSignOut}
        onCancel={() => setShowSignOutConfirm(false)}
        loading={signingOut}
      />
    </ScrollView>
  );
}

const getStyles = (theme: any) =>
  {
    const glassBg = theme.background === '#061224' ? "rgba(11,29,54,0.90)" : "rgba(255,255,255,0.82)";
    const glassBorder = theme.background === '#061224' ? "rgba(91,183,255,0.18)" : "rgba(203,213,225,0.92)";

    return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    header: { paddingHorizontal: 10, paddingTop: 56, paddingBottom: 16 },
    headerTitle: { fontSize: 26, fontWeight: "800", color: theme.text },
    userCard: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 10,
      backgroundColor: glassBg,
      borderRadius: 22,
      padding: 16,
      borderWidth: 1,
      borderColor: glassBorder,
      shadowColor: "#071a33",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      gap: 14,
      marginBottom: 12,
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.background === '#061224' ? "rgba(91,183,255,0.14)" : theme.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarImage: { width: 100, height: 100, borderRadius: 50 },
    userInfo: { flex: 1, gap: 4 },
    userName: { fontSize: 18, fontWeight: "800", color: theme.text },
    userEmail: { fontSize: 13, color: theme.subtext },
    ratingBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 2,
    },
    ratingText: { fontSize: 12, color: "#F59E0B", fontWeight: "700" },
    verifiedBadge: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start", // Important to not stretch
      gap: 4,
      marginTop: 2,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: theme.primarySoft,
    },
    verifiedText: { fontSize: 12, color: theme.primary, fontWeight: "700" },
    statsRow: {
      flexDirection: "row",
      marginHorizontal: 10,
      backgroundColor: glassBg,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: glassBorder,
      padding: 16,
      marginBottom: 12,
    },
    statItem: { flex: 1, alignItems: "center", gap: 4 },
    statNumber: { fontSize: 16, fontWeight: "800", color: theme.text },
    statLabel: { fontSize: 12, color: theme.subtext, fontWeight: "600" },
    statDivider: { width: 1, backgroundColor: theme.border },
    reviewsCard: {
      marginHorizontal: 10,
      backgroundColor: glassBg,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: glassBorder,
      padding: 16,
      marginBottom: 12,
      gap: 12,
    },
    reviewsHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    reviewsTitle: { fontSize: 15, fontWeight: "800", color: theme.text },
    reviewItem: {
      gap: 4,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    reviewTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    reviewerName: { fontSize: 13, fontWeight: "700", color: theme.text },
    reviewStars: { flexDirection: "row", gap: 2 },
    reviewComment: { fontSize: 13, color: theme.subtext, lineHeight: 18 },
    seeAllButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingTop: 4,
    },
    seeAllText: { fontSize: 13, fontWeight: "700", color: theme.primary },
    menu: {
      marginHorizontal: 10,
      backgroundColor: glassBg,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: glassBorder,
      marginBottom: 12,
      overflow: "hidden",
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.surface,
      gap: 12,
    },
    menuLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: theme.text },
    menuValue: { fontSize: 12, fontWeight: "700", color: theme.secondary, marginRight: 6 },
    reviewsBadge: { fontSize: 13, color: theme.subtext, fontWeight: "600" },
    signOutButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: 10,
      marginBottom: 32,
      padding: 16,
      borderRadius: 20,
      borderColor: theme.danger,
      backgroundColor: glassBg,
      gap: 8,
    },
    signOutText: { fontSize: 15, fontWeight: "700", color: theme.danger },
    pendingBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#fef3c7",
      marginHorizontal: 10,
      padding: 12,
      borderRadius: 12,
      gap: 10,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: "#f59e0b",
    },
    pendingBannerText: {
      flex: 1,
      fontSize: 13,
      color: "#92400e",
      fontWeight: "600",
    },
    pendingBadge: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 4,
      backgroundColor: "#fef3c7",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    pendingBadgeText: {
      fontSize: 11,
      color: "#92400e",
      fontWeight: "700",
      textTransform: "uppercase",
    },
    });
  };
