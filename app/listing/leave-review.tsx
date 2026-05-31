import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { submitReview } from "../hooks/useReviews";
import { auth } from "../../services/firebase";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onChange(star)} activeOpacity={0.7}>
          <Ionicons
            name={star <= value ? "star" : "star-outline"}
            size={40}
            color={star <= value ? "#F59E0B" : "#D1D5DB"}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function LeaveReviewScreen() {
  const params = useLocalSearchParams<{
    listingId?: string;
    listingTitle?: string;
    sellerId?: string;
    sellerName?: string;
  }>();
  const listingId = firstParam(params.listingId)?.trim();
  const listingTitle = firstParam(params.listingTitle)?.trim();
  const sellerId = firstParam(params.sellerId)?.trim();
  const sellerName = firstParam(params.sellerName)?.trim();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const user = auth.currentUser;

  async function handleSubmit() {
    if (rating === 0) {
      Alert.alert("Select a rating", "Please tap a star before submitting.");
      return;
    }
    if (!user) {
      Alert.alert("Not signed in", "Please sign in to leave a review.");
      return;
    }
    if (!sellerId || !listingId || sellerId === "undefined") {
      Alert.alert("Missing details", "Could not find the transaction to review.");
      return;
    }
    setLoading(true);
    try {
      await submitReview({
        sellerId: sellerId as string,
        listingId: listingId as string,
        listingTitle,
        buyerId: user.uid,
        buyerName: user.displayName ?? "Buyer",
        rating,
        comment,
      });
      Alert.alert("Review submitted!", "Thanks for your feedback.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#1f2937" />
      </TouchableOpacity>

      <Text style={styles.title}>Rate your experience</Text>
      {sellerName ? (
        <Text style={styles.subtitle}>How was your transaction with {sellerName}?</Text>
      ) : null}

      {/* Stars */}
      <View style={styles.starsContainer}>
        <StarRating value={rating} onChange={setRating} />
        <Text style={styles.ratingLabel}>
          {rating === 0 && "Tap to rate"}
          {rating === 1 && "Poor"}
          {rating === 2 && "Fair"}
          {rating === 3 && "Good"}
          {rating === 4 && "Great"}
          {rating === 5 && "Excellent!"}
        </Text>
      </View>

      {/* Comment */}
      <Text style={styles.inputLabel}>Leave a comment (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Share your experience with this seller..."
        placeholderTextColor="#9CA3AF"
        value={comment}
        onChangeText={setComment}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
      />

      {/* Submit */}
      <TouchableOpacity
        style={[styles.button, (rating === 0 || loading) && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={rating === 0 || loading}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>
          {loading ? "Submitting..." : "Submit Review"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 24, gap: 16 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 8,
  },
  title: { fontSize: 24, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: -8 },
  starsContainer: { alignItems: "center", gap: 8, paddingVertical: 8 },
  stars: { flexDirection: "row", gap: 8 },
  ratingLabel: { fontSize: 14, fontWeight: "600", color: "#64748b", height: 20 },
  inputLabel: { fontSize: 14, fontWeight: "700", color: "#374151" },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#fff",
    minHeight: 120,
  },
  button: {
    backgroundColor: "#0f766e",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
