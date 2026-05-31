import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { useTheme } from "./theme";

export default function MyListings() {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(Boolean(auth.currentUser));

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      return;
    }

    const q = query(
      collection(db, "listings"),
      where("sellerUID", "==", uid),
      //orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setListings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete listing",
      "Are you sure you want to delete this listing?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteDoc(doc(db, "listings", id));
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace('/profile')}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={22} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Listings</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0f766e" />
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="list-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No listings yet</Text>
              <Text style={styles.emptyText}>
                Post something to sell in the Sell tab.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.navigate(`/listing/${item.id}` as any)}
            >
              <View style={styles.cardImage}>
                {item.imageURL ? (
                  <Image
                    source={{ uri: item.imageURL }}
                    style={styles.cardImg}
                    onError={() => console.warn('Failed to load card image')}
                  />
                ) : (
                  <Ionicons name="image-outline" size={32} color="#cbd5e1" />
                )}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.cardPrice}>
                  ₱{item.price ? Number(item.price).toLocaleString() : 'N/A'}
                </Text>
                <Text style={styles.cardCategory}>{item.category}</Text>
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => router.push(`/sell?id=${item.id}`)}
                >
                  <Ionicons name="pencil-outline" size={18} color="#0f766e" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(item.id)}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 56,
      paddingBottom: 16,
      gap: 12,
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
    headerTitle: { fontSize: 22, fontWeight: "800", color: theme.text },
    listContent: { paddingHorizontal: 20, paddingBottom: 32 },
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.primarySoft,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 3,
      marginBottom: 12,
      overflow: "hidden",
    },
    cardImage: {
      width: 80,
      height: 80,
      backgroundColor: theme.card,
      alignItems: "center",
      justifyContent: "center",
    },
    cardImg: { width: 80, height: 80, resizeMode: "cover" },
    cardBody: { flex: 1, padding: 12, gap: 3 },
    cardTitle: { fontSize: 14, fontWeight: "700", color: theme.text },
    cardPrice: { fontSize: 15, fontWeight: "800", color: theme.primary },
    cardCategory: { fontSize: 12, color: theme.secondary, textTransform: "capitalize" },
    actionButtons: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 12,
      padding: 12,
    },
    editButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: theme.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    deleteButton: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    empty: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 80,
      gap: 10,
    },
    emptyTitle: { fontSize: 18, fontWeight: "800", color: theme.text },
    emptyText: { fontSize: 14, color: theme.subtext, textAlign: "center" },
  });
