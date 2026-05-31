import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Animated,
  Pressable,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useTheme } from "../theme";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useRouter } from "expo-router";
import { registerPushToken } from "../../services/notificationService";
import { useAuthUid } from "../hooks/useAuthUid";
import { useUnreadNotifications } from "../hooks/useUnreadNotifications";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const CATEGORIES = [
  { id: "all", label: "All", icon: "grid" },
  { id: "electronics", label: "Electronics", icon: "phone-portrait" },
  { id: "clothing", label: "Clothing", icon: "shirt" },
  { id: "furniture", label: "Furniture", icon: "bed" },
  { id: "food", label: "Food", icon: "fast-food" },
  { id: "vehicles", label: "Vehicles", icon: "car" },
  { id: "others", label: "Others", icon: "ellipsis-horizontal" },
];

const LOCATION_OPTIONS = [
  "All Locations",
  "Quezon City",
  "Manila",
  "Makati",
  "Taguig",
  "Pasig",
];

const SORT_OPTIONS = [
  { id: "newest", label: "Newest first", icon: "time-outline" },
  { id: "oldest", label: "Oldest first", icon: "hourglass-outline" },
  { id: "price_asc", label: "Price: Low to High", icon: "trending-up-outline" },
  {
    id: "price_desc",
    label: "Price: High to Low",
    icon: "trending-down-outline",
  },
  { id: "title_asc", label: "Name: A to Z", icon: "text-outline" },
];

type SortId = "newest" | "oldest" | "price_asc" | "price_desc" | "title_asc";

export default function HomeTab() {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState("All Locations");
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now] = useState<number>(() => Date.now());
  const uid = useAuthUid();
  const unreadCount = useUnreadNotifications();
  const [sortBy, setSortBy] = useState<SortId>("newest");
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const openSortModal = () => {
    setSortModalVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  };

  const closeSortModal = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setSortModalVisible(false));
  };

  const handleSelectSort = (id: SortId) => {
    setSortBy(id);
    closeSortModal();
  };

  useEffect(() => {
    const setupNotifications = async () => {
      // Check if function exists before calling to prevent crash
      if (uid && typeof registerPushToken === "function") {
        try {
          await registerPushToken(uid);
        } catch (e) {
          console.warn("Push registration failed:", e);
        }
      }
    };
    setupNotifications();
  }, [uid]);

  useEffect(() => {
    const q = query(collection(db, "listings"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setListings(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
      setRefreshing(false);
    });
    return unsubscribe;
  }, []);

  const filtered = useMemo(() => {
    let result = listings.filter((item) => {
      const matchesCategory =
        selectedCategory === "all" ||
        item.category === selectedCategory.toLowerCase();
      const matchesSearch = item.title
        ?.toLowerCase()
        .includes(search.toLowerCase());
      const matchesLocation =
        selectedLocation === "All Locations" ||
        item.location === selectedLocation;
      return matchesCategory && matchesSearch && matchesLocation;
    });

    switch (sortBy) {
      case "newest":
        result = [...result].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        break;
      case "oldest":
        result = [...result].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        break;
      case "price_asc":
        result = [...result].sort(
          (a, b) => Number(a.price ?? 0) - Number(b.price ?? 0),
        );
        break;
      case "price_desc":
        result = [...result].sort(
          (a, b) => Number(b.price ?? 0) - Number(a.price ?? 0),
        );
        break;
      case "title_asc":
        result = [...result].sort((a, b) =>
          (a.title ?? "").localeCompare(b.title ?? ""),
        );
        break;
    }

    return result;
  }, [listings, selectedCategory, search, selectedLocation, sortBy]);

  const getTimeAgo = (isoDate: string) => {
    if (!now) return "";
    const diff = now - new Date(isoDate).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${mins}m ago`;
  };

  const getReverseGeocodedLocation = async (
    coords: Location.LocationObjectCoords,
  ) => {
    const [address] = await Location.reverseGeocodeAsync({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
    const city =
      address.city || address.subregion || address.region || address.district;
    const barangay = address.name || address.street;
    if (barangay && city && barangay !== city) return `${barangay}, ${city}`;
    return city || barangay || "Current Location";
  };

  const fetchCurrentLocation = async () => {
    setLocationError("");
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("GPS permission denied.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      const locationLabel = await getReverseGeocodedLocation(position.coords);
      setSelectedLocation(locationLabel);
      setLocationOpen(false);
      setLocationSearch("");
    } catch {
      setLocationError("Unable to get current location.");
    } finally {
      setGpsLoading(false);
    }
  };

  const isSortActive = sortBy !== "newest";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.locationButton}
            onPress={() => setLocationOpen((prev) => !prev)}
            activeOpacity={0.8}
          >
            <Ionicons name="location" size={14} color="#0f766e" />
            <Text style={styles.location}>{selectedLocation}</Text>
            <Ionicons
              name={locationOpen ? "chevron-up" : "chevron-down"}
              size={14}
              color="#0f766e"
            />
          </TouchableOpacity>
          // Header Title --------------------------------------
          <Text style={styles.headerTitle}>The MarketPlace</Text>
          {locationOpen && (
            <View style={styles.locationMenu}>
              <TouchableOpacity
                style={styles.locationAction}
                activeOpacity={0.8}
                onPress={fetchCurrentLocation}
              >
                <Text style={styles.locationActionText}>
                  {gpsLoading
                    ? "Getting GPS location..."
                    : "Use current GPS location"}
                </Text>
              </TouchableOpacity>
              <TextInput
                style={styles.locationSearchInput}
                placeholder="Search locations"
                placeholderTextColor="#94a3b8"
                value={locationSearch}
                onChangeText={setLocationSearch}
              />
              {locationError ? (
                <Text style={styles.locationError}>{locationError}</Text>
              ) : null}
              <ScrollView style={styles.locationList} nestedScrollEnabled>
                {LOCATION_OPTIONS.filter((loc) =>
                  loc.toLowerCase().includes(locationSearch.toLowerCase()),
                ).map((loc) => (
                  <TouchableOpacity
                    key={loc}
                    style={[
                      styles.locationOption,
                      selectedLocation === loc && styles.locationOptionActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedLocation(loc);
                      setLocationOpen(false);
                      setLocationSearch("");
                    }}
                  >
                    <Text
                      style={[
                        styles.locationOptionText,
                        selectedLocation === loc &&
                          styles.locationOptionTextActive,
                      ]}
                    >
                      {loc}
                    </Text>
                  </TouchableOpacity>
                ))}
                {locationSearch.trim().length > 0 &&
                  !LOCATION_OPTIONS.some(
                    (loc) =>
                      loc.toLowerCase() === locationSearch.trim().toLowerCase(),
                  ) && (
                    <TouchableOpacity
                      style={styles.locationOption}
                      activeOpacity={0.8}
                      onPress={() => {
                        setSelectedLocation(locationSearch.trim());
                        setLocationOpen(false);
                        setLocationSearch("");
                      }}
                    >
                      <Text style={styles.locationOptionText}>
                        Use "{locationSearch.trim()}"
                      </Text>
                    </TouchableOpacity>
                  )}
              </ScrollView>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.notifButton}
          onPress={() => router.push("/notifications" as any)}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications-outline" size={24} color={theme.text} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search + Sort */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={theme.secondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search listings..."
            placeholderTextColor={theme.placeholder}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity
          style={[styles.sortButton, isSortActive && styles.sortButtonActive]}
          onPress={openSortModal}
          activeOpacity={0.8}
        >
          <Ionicons
            name="swap-vertical-outline"
            size={18}
            color={isSortActive ? "#fff" : theme.text}
          />
          {isSortActive && (
            <Text style={styles.sortButtonText} numberOfLines={1}>
              {
                SORT_OPTIONS.find((s) => s.id === sortBy)
                  ?.label.split(":")[0]
                  .split(" ")[0]
              }
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContent}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryChip,
              selectedCategory === cat.id && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(cat.id)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={cat.icon as any}
              size={15}
              color={selectedCategory === cat.id ? "#fff" : "#475569"}
            />
            <Text
              style={[
                styles.categoryLabel,
                selectedCategory === cat.id && styles.categoryLabelActive,
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Listings */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0f766e" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => setRefreshing(true)}
              tintColor="#0f766e"
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="search-outline"
                size={42}
                color={theme.secondary}
              />
              <Text style={styles.emptyText}>No listings found</Text>
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
                  />
                ) : (
                  <Ionicons name="image-outline" size={36} color="#cbd5e1" />
                )}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.cardPrice}>
                  ₱{item.price ? Number(item.price).toLocaleString() : "N/A"}
                </Text>
                <View style={styles.cardMeta}>
                  <Ionicons
                    name="location-outline"
                    size={11}
                    color={theme.secondary}
                  />
                  <Text style={styles.cardMetaText}>{item.location}</Text>
                  <Text style={styles.cardDot}>·</Text>
                  <Text style={styles.cardMetaText}>
                    {getTimeAgo(item.createdAt)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Sort Bottom Sheet */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeSortModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeSortModal}>
          <Animated.View
            style={[
              styles.bottomSheet,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            <Pressable>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Sort by</Text>
              {SORT_OPTIONS.map((option) => {
                const isSelected = sortBy === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.sortOption,
                      isSelected && styles.sortOptionActive,
                    ]}
                    onPress={() => handleSelectSort(option.id as SortId)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.sortOptionIcon,
                        isSelected && styles.sortOptionIconActive,
                      ]}
                    >
                      <Ionicons
                        name={option.icon as any}
                        size={18}
                        color={isSelected ? "#fff" : theme.subtext}
                      />
                    </View>
                    <Text
                      style={[
                        styles.sortOptionLabel,
                        isSelected && styles.sortOptionLabelActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#0f766e"
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>) => {
  const isDark = theme.background === "#020617";
  const surfaceGlass = isDark
    ? "rgba(15,23,42,0.72)"
    : "rgba(255,255,255,0.78)";
  const softGlass = isDark ? "rgba(15,23,42,0.54)" : "rgba(255,255,255,0.58)";
  const glassBorder = isDark
    ? "rgba(255,255,255,0.16)"
    : "rgba(15,118,110,0.16)";
  const glassShadow = isDark ? "rgba(0,0,0,0.24)" : "rgba(15,118,110,0.16)";

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingHorizontal: 10,
      paddingTop: 56,
      marginBottom: 14,
    },
    headerLeft: { gap: 10, flex: 1, position: "relative" },
    locationButton: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: surfaceGlass,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: glassBorder,
      shadowColor: glassShadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.14,
      shadowRadius: 20,
      elevation: 4,
    },
    location: { fontSize: 15, color: theme.primary, fontWeight: "700" },
    locationMenu: {
      position: "absolute",
      top: 54,
      left: 0,
      width: 260,
      borderRadius: 18,
      backgroundColor: surfaceGlass,
      borderWidth: 1,
      borderColor: glassBorder,
      overflow: "hidden",
      zIndex: 1000,
      shadowColor: glassShadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.16,
      shadowRadius: 22,
      elevation: 9,
    },
    locationAction: {
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: softGlass,
      borderBottomWidth: 1,
      borderBottomColor: glassBorder,
    },
    locationActionText: {
      fontSize: 14,
      color: theme.primary,
      fontWeight: "700",
    },
    locationSearchInput: {
      backgroundColor: softGlass,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.text,
      fontSize: 14,
      borderBottomWidth: 1,
      borderBottomColor: glassBorder,
    },
    locationError: {
      color: theme.danger,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 13,
    },
    locationList: { maxHeight: 180 },
    locationOption: { paddingVertical: 10, paddingHorizontal: 14 },
    locationOptionActive: { backgroundColor: theme.primary },
    locationOptionText: { fontSize: 14, color: theme.text },
    locationOptionTextActive: { color: theme.primaryText },
    headerTitle: { fontSize: 28, fontWeight: "900", color: theme.text },
    notifButton: {
      width: 46,
      height: 46,
      borderRadius: 16,
      backgroundColor: "rgba(255,255,255,0.06)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
      shadowColor: glassShadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
      elevation: 4,
    },
    badge: {
      position: "absolute",
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: "#ef4444",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
      borderWidth: 1.5,
      borderColor: theme.background,
    },
    badgeText: { fontSize: 10, fontWeight: "800", color: "#fff" },
    searchRow: {
      paddingHorizontal: 10,
      marginBottom: 16,
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
    },
    searchBox: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.06)",
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.14)",
      paddingHorizontal: 16,
      height: 52,
      gap: 10,
      shadowColor: glassShadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 18,
      elevation: 2,
    },
    searchInput: { flex: 1, fontSize: 15, color: theme.text },
    sortButton: {
      height: 52,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.14)",
      backgroundColor: "rgba(255,255,255,0.06)",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 14,
    },
    sortButtonActive: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
    sortButtonText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#fff",
      maxWidth: 60,
    },
    categoryScroll: { flexGrow: 0, flexShrink: 0, marginBottom: 14 },
    categoryContent: { paddingHorizontal: 10, alignItems: "center", gap: 10 },
    categoryChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.06)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
    },
    categoryChipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    categoryLabel: { fontSize: 13, fontWeight: "700", color: theme.subtext },
    categoryLabelActive: { color: theme.primaryText },
    listContent: { paddingHorizontal: 10, paddingBottom: 24 },
    row: { justifyContent: "space-between", marginBottom: 10 },
    card: {
      width: "49%",
      backgroundColor: "rgba(255,255,255,0.06)",
      borderRadius: 24,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.10)",
      shadowColor: "rgba(0,0,0,0.14)",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 5,
      overflow: "hidden",
    },
    cardImage: {
      height: 130,
      backgroundColor: "rgba(255,255,255,0.05)",
      alignItems: "center",
      justifyContent: "center",
    },
    cardImg: { width: "100%", height: "100%", resizeMode: "cover" },
    cardBody: { padding: 12, gap: 4 },
    cardTitle: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.text,
      lineHeight: 18,
    },
    cardPrice: { fontSize: 15, fontWeight: "800", color: theme.primary },
    cardMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
    cardMetaText: { fontSize: 11, color: theme.secondary },
    cardDot: { fontSize: 11, color: theme.secondary },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    empty: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 60,
      gap: 10,
    },
    emptyText: { fontSize: 14, color: theme.secondary, fontWeight: "600" },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    bottomSheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingBottom: 40,
      paddingTop: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 16,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      alignSelf: "center",
      marginBottom: 20,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 16,
    },
    sortOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 14,
      marginBottom: 6,
    },
    sortOptionActive: { backgroundColor: "#f0fdf9" },
    sortOptionIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    sortOptionIconActive: { backgroundColor: "#0f766e" },
    sortOptionLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
      color: theme.text,
    },
    sortOptionLabelActive: { color: "#0f766e", fontWeight: "700" },
  });
};
