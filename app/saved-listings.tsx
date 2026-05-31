import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { collection, query, where, getDocs, documentId } from "firebase/firestore";
import { db } from "../services/firebase";
import { useSavedItems } from "./hooks/useSavedItems";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function SavedListings() {
  const { savedIds, loading: loadingIds } = useSavedItems();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchSavedListings = async () => {
      // If no IDs are saved, don't even talk to Firestore
      if (loadingIds) return;
      if (savedIds.length === 0) {
        setListings([]);
        setLoading(false);
        return;
      }

      try {
        // Fetch only the listings whose IDs are in our 'savedIds' list
        const q = query(
          collection(db, "listings"),
          where(documentId(), "in", savedIds.slice(0, 30)) // Firestore limit is 30
        );

        const querySnapshot = await getDocs(q);
        const fetched = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setListings(fetched);
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSavedListings();
  }, [savedIds, loadingIds]);

  if (loading || loadingIds) {
    return (
      <View style={styles.center}><ActivityIndicator size="large" color="#0f766e" /></View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Simple Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Items</Text>
        <View style={{ width: 40 }} />
      </View>

      {listings.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="heart-outline" size={48} color="#cbd5e1" />
          <Text style={styles.emptyText}>Nothing saved yet</Text>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.card}
              onPress={() => router.navigate(`/listing/${item.id}` as any)}
            >
              <Image source={{ uri: item.imageURL }} style={styles.image} />
              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.price}>₱{Number(item.price).toLocaleString()}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>
          )}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { 
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: 60, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: "#fff" 
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  card: { 
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff", 
    padding: 12, borderRadius: 12, marginBottom: 10,
    borderWidth: 1, borderColor: "#e2e8f0"
  },
  image: { width: 60, height: 60, borderRadius: 8 },
  info: { flex: 1, marginLeft: 12 },
  title: { fontSize: 15, fontWeight: "600", color: "#1f2937" },
  price: { fontSize: 14, fontWeight: "700", color: "#0f766e", marginTop: 2 },
  emptyText: { marginTop: 8, color: "#94a3b8", fontSize: 15 }
});
