import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  getReviewSummary,
  SellerReview,
  subscribeToSellerReviews,
} from "./hooks/useReviews";
import { useAuthUid } from "./hooks/useAuthUid";
import { useTheme } from "./theme";

export default function ReviewsScreen() {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const uid = useAuthUid();
  const [reviews, setReviews] = useState<SellerReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;

    return subscribeToSellerReviews(uid, (nextReviews) => {
      setReviews(nextReviews);
      setLoading(false);
    });
  }, [uid]);

  const isLoading = uid ? loading : false;
  const summary = getReviewSummary(reviews);

  const starCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Reviews</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0f766e" />
        </View>
      ) : reviews.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="star-outline" size={52} color={theme.subtext} />
          <Text style={styles.emptyTitle}>No reviews yet</Text>
          <Text style={styles.emptySubtitle}>
            Reviews from buyers will appear here after transactions.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryLeft}>
              <Text style={styles.avgNumber}>{summary.averageLabel}</Text>
              <View style={styles.summaryStars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name="star"
                    size={18}
                    color={
                      star <= Math.round(summary.average ?? 0)
                        ? "#F59E0B"
                        : "#E5E7EB"
                    }
                  />
                ))}
              </View>
              <Text style={styles.totalCount}>
                {summary.reviewCount}{" "}
                {summary.reviewCount === 1 ? "review" : "reviews"}
              </Text>
            </View>

            {/* Star breakdown bars */}
            <View style={styles.barsContainer}>
              {starCounts.map(({ star, count }) => (
                <View key={star} style={styles.barRow}>
                  <Text style={styles.barLabel}>{star}</Text>
                  <Ionicons name="star" size={11} color="#F59E0B" />
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width:
                            summary.reviewCount > 0
                              ? `${(count / summary.reviewCount) * 100}%`
                              : "0%",
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barCount}>{count}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Reviews List */}
          <View style={styles.listContainer}>
            {reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewerAvatar}>
                    <Ionicons name="person" size={18} color="#0f766e" />
                  </View>
                  <View style={styles.reviewerInfo}>
                    <Text style={styles.reviewerName}>{review.buyerName}</Text>
                    {review.listingTitle ? (
                      <Text style={styles.listingTitle} numberOfLines={1}>
                        {review.listingTitle}
                      </Text>
                    ) : null}
                    <View style={styles.reviewStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name="star"
                          size={13}
                          color={star <= review.rating ? "#F59E0B" : "#E5E7EB"}
                        />
                      ))}
                    </View>
                  </View>
                  {review.createdAt?.seconds && (
                    <Text style={styles.reviewDate}>
                      {new Date(
                        review.createdAt.seconds * 1000,
                      ).toLocaleDateString("default", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                  )}
                </View>
                {review.comment ? (
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                ) : (
                  <Text style={styles.noComment}>No comment left.</Text>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 56,
      paddingBottom: 16,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    headerTitle: { fontSize: 20, fontWeight: "800", color: theme.text },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      padding: 40,
    },
    emptyTitle: { fontSize: 18, fontWeight: "800", color: theme.text },
    emptySubtitle: {
      fontSize: 14,
      color: theme.subtext,
      textAlign: "center",
      lineHeight: 20,
    },
    summaryCard: {
      flexDirection: "row",
      margin: 16,
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 20,
      gap: 20,
      alignItems: "center",
    },
    summaryLeft: { alignItems: "center", gap: 6 },
    avgNumber: {
      fontSize: 48,
      fontWeight: "800",
      color: theme.text,
      lineHeight: 52,
    },
    summaryStars: { flexDirection: "row", gap: 3 },
    totalCount: { fontSize: 12, color: theme.subtext, fontWeight: "600" },
    barsContainer: { flex: 1, gap: 6 },
    barRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    barLabel: {
      fontSize: 12,
      color: theme.subtext,
      width: 10,
      textAlign: "right",
    },
    barTrack: {
      flex: 1,
      height: 6,
      backgroundColor: theme.border,
      borderRadius: 3,
      overflow: "hidden",
    },
    barFill: { height: "100%", backgroundColor: "#F59E0B", borderRadius: 3 },
    barCount: {
      fontSize: 12,
      color: theme.subtext,
      width: 16,
      textAlign: "right",
    },
    listContainer: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
    reviewCard: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      gap: 10,
    },
    reviewHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    reviewerAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: "#ccfbf1",
      alignItems: "center",
      justifyContent: "center",
    },
    reviewerInfo: { flex: 1, gap: 3 },
    reviewerName: { fontSize: 14, fontWeight: "700", color: theme.text },
    listingTitle: { fontSize: 12, color: theme.primary, fontWeight: "600" },
    reviewStars: { flexDirection: "row", gap: 2 },
    reviewDate: { fontSize: 11, color: theme.subtext },
    reviewComment: { fontSize: 14, color: theme.subtext, lineHeight: 20 },
    noComment: { fontSize: 13, color: theme.subtext, fontStyle: "italic" },
  });
