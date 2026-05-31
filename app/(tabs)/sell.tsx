import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { auth, db } from "../../services/firebase";
import { collection, addDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { compressAndConvertToBase64 } from "../../services/storage";
import { useTheme } from "../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAFT_KEY = "sell_draft";

const CATEGORIES = ["Electronics", "Clothing", "Furniture", "Food", "Vehicles", "Others"];
const LOCATIONS = ["Quezon City", "Manila", "Makati", "Taguig", "Pasig"];
const CONDITIONS = [
  { id: "new", label: "New", color: "#10b981" },
  { id: "like_new", label: "Like New", color: "#3b82f6" },
  { id: "good", label: "Good", color: "#f59e0b" },
  { id: "fair", label: "Fair", color: "#f97316" },
  { id: "for_parts", label: "For Parts", color: "#ef4444" },
];

interface FormState {
  title: string;
  price: string;
  negotiable: boolean;
  description: string;
  category: string;
  condition: string;
  location: string;
  image: string | null;
}

const EMPTY_FORM: FormState = {
  title: "",
  price: "",
  negotiable: false,
  description: "",
  category: "",
  condition: "",
  location: "Quezon City",
  image: null,
};

// ── Verification Overlay ──────────────────────────────────────────────────────
function VerificationOverlay({ status, theme, router }: { status: string, theme: any, router: any }) {
  const isPending = status === 'pending';
  
  return (
    <View style={[StyleSheet.absoluteFill, { 
      backgroundColor: 'rgba(255,255,255,0.85)', 
      justifyContent: 'center', 
      alignItems: 'center',
      zIndex: 999,
      padding: 24
    }]}>
      <View style={{ 
        backgroundColor: theme.surface, 
        padding: 24, 
        borderRadius: 20, 
        width: '100%',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: theme.primarySoft
      }}>
        <View style={{ 
          width: 64, 
          height: 64, 
          borderRadius: 32, 
          backgroundColor: theme.primarySoft, 
          alignItems: 'center', 
          justifyContent: 'center',
          marginBottom: 16 
        }}>
          <Ionicons name={isPending ? "hourglass" : "alert-circle-outline"} size={32} color={theme.primary} />
        </View>
        
        <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text, textAlign: 'center', marginBottom: 8 }}>
          {isPending ? "Verification in Progress" : "Verification Required"}
        </Text>
        
        <Text style={{ fontSize: 14, color: theme.subtext, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
          {isPending 
            ? "Your account is being reviewed. You'll be able to post listings once your ID is approved." 
            : "You must verify your ID before you can sell items on M-Place."}
        </Text>

        <TouchableOpacity 
          style={{ 
            backgroundColor: theme.primary, 
            paddingVertical: 14, 
            paddingHorizontal: 24, 
            borderRadius: 12, 
            width: '100%',
            alignItems: 'center' 
          }}
          onPress={() => isPending ? router.push('/profile') : router.push('/id-upload')}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>
            {isPending ? "Check Status in Profile" : "Verify My ID"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Success Screen ────────────────────────────────────────────────────────────
function SuccessScreen({ onDone }: { onDone: () => void }) {
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, bounciness: 12 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={successStyles.container}>
      <Animated.View style={[successStyles.iconWrap, { transform: [{ scale: scaleAnim }] }]}>
        <Ionicons name="checkmark-circle" size={80} color="#0f766e" />
      </Animated.View>
      <Animated.View style={{ opacity: fadeAnim, alignItems: "center", gap: 8 }}>
        <Text style={successStyles.title}>Listed!</Text>
        <Text style={successStyles.subtitle}>Your item is now live for buyers to find.</Text>
        <TouchableOpacity style={successStyles.button} onPress={onDone} activeOpacity={0.85}>
          <Text style={successStyles.buttonText}>Done</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const successStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0fdf9", alignItems: "center", justifyContent: "center", gap: 24, padding: 32 },
  iconWrap: { marginBottom: 8 },
  title: { fontSize: 32, fontWeight: "900", color: "#0f766e" },
  subtitle: { fontSize: 16, color: "#475569", textAlign: "center", lineHeight: 24 },
  button: { marginTop: 16, backgroundColor: "#0f766e", borderRadius: 14, paddingHorizontal: 40, paddingVertical: 16 },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});

// ── Preview Modal ─────────────────────────────────────────────────────────────
function PreviewModal({
  visible,
  form,
  onClose,
  onConfirm,
  submitting,
  theme,
}: {
  visible: boolean;
  form: FormState;
  onClose: () => void;
  onConfirm: () => void;
  submitting: boolean;
  theme: any;
}) {
  const condition = CONDITIONS.find((c) => c.id === form.condition);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Image */}
          <View style={{ width: "100%", height: 280, backgroundColor: theme.surface }}>
            {form.image ? (
              <Image source={{ uri: form.image }} style={{ width: "100%", height: "100%", resizeMode: "cover" }} />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="image-outline" size={52} color="#cbd5e1" />
              </View>
            )}
            <TouchableOpacity
              onPress={onClose}
              style={{ position: "absolute", top: 48, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 3 }}
            >
              <Ionicons name="arrow-back" size={22} color="#1f2937" />
            </TouchableOpacity>
            <View style={{ position: "absolute", top: 48, right: 16, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>PREVIEW</Text>
            </View>
          </View>

          <View style={{ padding: 20, gap: 16 }}>
            {/* Title + Price */}
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 22, fontWeight: "800", color: theme.text }}>{form.title || "Untitled"}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 24, fontWeight: "800", color: "#0f766e" }}>
                  ₱{form.price ? Number(form.price).toLocaleString() : "0"}
                </Text>
                {form.negotiable && (
                  <View style={{ backgroundColor: "#fef3c7", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#d97706" }}>NEGOTIABLE</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Meta */}
            <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
              {form.location ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="location-outline" size={14} color="#64748b" />
                  <Text style={{ fontSize: 13, color: "#64748b" }}>{form.location}</Text>
                </View>
              ) : null}
              {form.category ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="pricetag-outline" size={14} color="#64748b" />
                  <Text style={{ fontSize: 13, color: "#64748b" }}>{form.category}</Text>
                </View>
              ) : null}
              {condition ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: condition.color + "20", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: condition.color }} />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: condition.color }}>{condition.label}</Text>
                </View>
              ) : null}
            </View>

            {/* Description */}
            {form.description ? (
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: theme.text }}>Description</Text>
                <Text style={{ fontSize: 14, color: "#475569", lineHeight: 22 }}>{form.description}</Text>
              </View>
            ) : null}

            {/* Seller */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(15,118,110,0.12)" }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#ccfbf1", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="person" size={20} color="#0f766e" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: "#94a3b8", fontWeight: "600" }}>Seller</Text>
                <Text style={{ fontSize: 15, fontWeight: "700", color: theme.text }}>{auth.currentUser?.displayName ?? "You"}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="shield-checkmark" size={14} color="#0f766e" />
                <Text style={{ fontSize: 12, color: "#0f766e", fontWeight: "700" }}>Verified</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Post button */}
        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.background }}>
          <TouchableOpacity
            style={{ minHeight: 54, borderRadius: 12, backgroundColor: "#0f766e", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: submitting ? 0.7 : 1 }}
            onPress={onConfirm}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={20} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>Confirm & Post</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function SellTab() {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [userStatus, setUserStatus] = useState<string | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  const update = useCallback((key: keyof FormState, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Fetch Verification Status
  useEffect(() => {
    const fetchStatus = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
          setUserStatus(userDoc.data().status || 'unverified');
        }
      } catch (e) {
        console.error("Status fetch error:", e);
      }
    };
    fetchStatus();
  }, []);

  // Load existing listing for edit mode
  useEffect(() => {
    if (!id) return;
    const fetchListing = async () => {
      try {
        const docRef = doc(db, "listings", id as string);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        if (data.sellerUID !== auth.currentUser?.uid) {
          Alert.alert("Cannot edit", "You can only edit your own listings.");
          router.back();
          return;
        }
        setForm({
          title: data.title ?? "",
          price: data.price ? String(data.price) : "",
          negotiable: data.negotiable ?? false,
          description: data.description ?? "",
          category: data.category ?? "",
          condition: data.condition ?? "",
          location: data.location ?? "Quezon City",
          image: data.imageURL ?? null,
        });
        setEditing(true);
      } catch (error) {
        console.error("Load listing error:", error);
      }
    };
    fetchListing();
  }, [id]);

  // Load draft on mount (only for new listings)
  useEffect(() => {
    if (id) return;
    AsyncStorage.getItem(DRAFT_KEY).then((raw) => {
      if (!raw) return;
      const draft = JSON.parse(raw) as FormState;
      const hasContent = draft.title || draft.price || draft.description;
      if (!hasContent) return;
      Alert.alert("Resume draft?", "You have an unsaved draft. Want to continue?", [
        { text: "Discard", style: "destructive", onPress: () => AsyncStorage.removeItem(DRAFT_KEY) },
        { text: "Resume", onPress: () => setForm(draft) },
      ]);
    }).catch(() => {});
  }, []);

  const saveDraft = async () => {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
  };

  const clearDraft = () => AsyncStorage.removeItem(DRAFT_KEY);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.3,
    });
    if (!result.canceled) update("image", result.assets[0].uri);
  };

  const getReverseGeocodedLocation = async (coords: Location.LocationObjectCoords) => {
    const [address] = await Location.reverseGeocodeAsync({ latitude: coords.latitude, longitude: coords.longitude });
    const city = address.city || address.subregion || address.region || address.district;
    const barangay = address.name || address.street;
    if (barangay && city && barangay !== city) return `${barangay}, ${city}`;
    return city || barangay || "Current Location";
  };

  const fetchCurrentLocation = async () => {
    setLocationError("");
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocationError("GPS permission denied."); return; }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const label = await getReverseGeocodedLocation(position.coords);
      update("location", label);
      setLocationOpen(false);
      setLocationSearch("");
    } catch {
      setLocationError("Unable to get current location.");
    } finally {
      setGpsLoading(false);
    }
  };

  const validate = () => {
    if (!form.title || !form.price || !form.category || !form.location) {
      Alert.alert("Missing fields", "Please fill in title, price, category, and location.");
      return false;
    }
    return true;
  };

  const handlePreview = () => {
    if (!validate()) return;
    setPreviewVisible(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let imageBase64 = null;
      if (form.image) {
        imageBase64 = form.image.startsWith("data:image/")
          ? form.image
          : await compressAndConvertToBase64(form.image);
      }

      if (editing && id) {
        await updateDoc(doc(db, "listings", id as string), {
          title: form.title,
          price: Number(form.price),
          negotiable: form.negotiable,
          description: form.description,
          category: form.category.toLowerCase(),
          condition: form.condition,
          imageURL: imageBase64,
          location: form.location,
          updatedAt: new Date().toISOString(),
        });
        setPreviewVisible(false);
        Alert.alert("Updated!", "Your listing has been updated.", [
          { text: "OK", onPress: () => router.replace("/home") },
        ]);
        return;
      }

      await addDoc(collection(db, "listings"), {
        title: form.title,
        price: Number(form.price),
        negotiable: form.negotiable,
        description: form.description,
        category: form.category.toLowerCase(),
        condition: form.condition,
        imageURL: imageBase64,
        sellerUID: auth.currentUser?.uid,
        sellerName: auth.currentUser?.displayName,
        sellerPhoto: auth.currentUser?.photoURL,
        location: form.location,
        status: "active",
        createdAt: new Date().toISOString(),
      });

      await clearDraft();
      setPreviewVisible(false);
      setShowSuccess(true);
    } catch (error) {
      console.error("Submit error:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessDone = () => {
    setForm(EMPTY_FORM);
    setShowSuccess(false);
    router.replace("/home");
  };

  if (showSuccess) return <SuccessScreen onDone={handleSuccessDone} />;

  return (
    <View style={{ flex: 1 }}>
      {/* Verification Overlay */}
      {userStatus !== 'verified' && userStatus !== null && (
        <VerificationOverlay status={userStatus} theme={theme} router={router} />
      )}

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{editing ? "Edit Listing" : "Post a Listing"}</Text>
          <Text style={styles.headerSubtitle}>
            {editing ? "Update your item details" : "Sell something to your neighbors"}
          </Text>
        </View>

        {/* Photo Section */}
        <View style={styles.photoBox}>
          {form.image ? (
            <>
              <Image source={{ uri: form.image }} style={styles.photoPreview} />
              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.photoActionBtn} onPress={pickImage} activeOpacity={0.8}>
                  <Ionicons name="swap-horizontal" size={16} color="#fff" />
                  <Text style={styles.photoActionText}>Replace</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.photoActionBtn, styles.photoRemoveBtn]} onPress={() => update("image", null)} activeOpacity={0.8}>
                  <Ionicons name="trash-outline" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity style={styles.photoPlaceholder} onPress={pickImage} activeOpacity={0.8}>
              <View style={styles.photoIconWrap}>
                <Ionicons name="camera" size={28} color="#0f766e" />
              </View>
              <Text style={styles.photoPlaceholderText}>Add a photo</Text>
              <Text style={styles.photoPlaceholderSub}>Tap to upload from gallery</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.form}>
          {/* Title */}
          <View style={styles.field}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. iPhone 13 Pro Max"
              placeholderTextColor={theme.muted}
              value={form.title}
              onChangeText={(v) => update("title", v)}
            />
          </View>

          {/* Price */}
          <View style={styles.field}>
            <Text style={styles.label}>Price (₱)</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={[styles.input, styles.priceInput]}
                placeholder="e.g. 35000"
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
                value={form.price}
                onChangeText={(v) => update("price", v)}
              />
              <TouchableOpacity
                style={[styles.negotiableToggle, form.negotiable && styles.negotiableToggleActive]}
                onPress={() => update("negotiable", !form.negotiable)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={form.negotiable ? "checkmark-circle" : "ellipse-outline"}
                  size={16}
                  color={form.negotiable ? "#fff" : theme.subtext}
                />
                <Text style={[styles.negotiableText, form.negotiable && styles.negotiableTextActive]}>
                  Negotiable
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Category */}
          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.chipGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, form.category === cat && styles.chipActive]}
                  onPress={() => update("category", cat)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, form.category === cat && styles.chipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Condition */}
          <View style={styles.field}>
            <Text style={styles.label}>Condition</Text>
            <View style={styles.chipGrid}>
              {CONDITIONS.map((cond) => (
                <TouchableOpacity
                  key={cond.id}
                  style={[
                    styles.conditionChip,
                    form.condition === cond.id && { backgroundColor: cond.color, borderColor: cond.color },
                  ]}
                  onPress={() => update("condition", cond.id)}
                  activeOpacity={0.8}
                >
                  {form.condition === cond.id && (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" }} />
                  )}
                  <Text style={[
                    styles.conditionChipText,
                    form.condition === cond.id && { color: "#fff" },
                  ]}>
                    {cond.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Location */}
          <View style={[styles.field, styles.locationField]}>
            <Text style={styles.label}>Location</Text>
            <TouchableOpacity
              style={styles.locationSelector}
              onPress={() => setLocationOpen((prev) => !prev)}
              activeOpacity={0.8}
            >
              <Text style={styles.locationSelectorText}>{form.location || "Select location"}</Text>
              <Ionicons name={locationOpen ? "chevron-up" : "chevron-down"} size={18} color={theme.primary} />
            </TouchableOpacity>
            {locationOpen && (
              <View style={styles.locationDropdown}>
                <TouchableOpacity style={styles.locationAction} activeOpacity={0.8} onPress={fetchCurrentLocation}>
                  <Text style={styles.locationActionText}>
                    {gpsLoading ? "Getting GPS..." : "Use GPS location"}
                  </Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.locationSearchInput}
                  placeholder="Search locations"
                  placeholderTextColor={theme.muted}
                  value={locationSearch}
                  onChangeText={setLocationSearch}
                />
                <ScrollView style={styles.locationList} nestedScrollEnabled>
                  {LOCATIONS.filter((loc) => loc.toLowerCase().includes(locationSearch.toLowerCase())).map((loc) => (
                    <TouchableOpacity
                      key={loc}
                      style={[styles.locationItem, form.location === loc && styles.locationItemActive]}
                      onPress={() => { update("location", loc); setLocationOpen(false); }}
                    >
                      <Text style={[styles.locationItemText, form.location === loc && styles.locationItemTextActive]}>{loc}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Description */}
          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Description</Text>
              <Text style={styles.charCount}>{form.description.length}/500</Text>
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your item..."
              placeholderTextColor={theme.muted}
              multiline
              maxLength={500}
              value={form.description}
              onChangeText={(v) => update("description", v)}
            />
          </View>

          {/* Post Button */}
          <View style={styles.actionRow}>
            {!editing && (
              <TouchableOpacity style={styles.draftButton} onPress={saveDraft} activeOpacity={0.8}>
                <Ionicons name={draftSaved ? "checkmark" : "save-outline"} size={18} color={theme.primary} />
                <Text style={styles.draftButtonText}>{draftSaved ? "Saved!" : "Save Draft"}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.previewButton} onPress={handlePreview} activeOpacity={0.85}>
              <Ionicons name="eye-outline" size={18} color="#fff" />
              <Text style={styles.previewButtonText}>Preview & Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Preview Modal */}
      <PreviewModal
        visible={previewVisible}
        form={form}
        onClose={() => setPreviewVisible(false)}
        onConfirm={handleSubmit}
        submitting={submitting}
        theme={theme}
      />
    </View>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, gap: 4 },
    headerTitle: { fontSize: 26, fontWeight: "800", color: theme.text },
    headerSubtitle: { fontSize: 14, color: theme.subtext },

    // Photo
    photoBox: {
      marginHorizontal: 16,
      height: 200,
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 20,
      backgroundColor: theme.surface,
    },
    photoPreview: { width: "100%", height: "100%", resizeMode: "cover" },
    photoActions: { position: "absolute", bottom: 10, right: 10, flexDirection: "row", gap: 8 },
    photoActionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(0,0,0,0.6)",
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    photoRemoveBtn: { paddingHorizontal: 10 },
    photoActionText: { color: "#fff", fontSize: 13, fontWeight: "700" },
    photoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    photoIconWrap: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: "#f0fdf9",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: "#0f766e",
      borderStyle: "dashed",
    },
    photoPlaceholderText: { fontSize: 15, fontWeight: "700", color: theme.text },
    photoPlaceholderSub: { fontSize: 12, color: theme.subtext },

    // Form
    form: { paddingHorizontal: 16, gap: 20, paddingBottom: 40 },
    field: { gap: 8 },
    labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    label: { fontSize: 14, fontWeight: "700", color: theme.text },
    charCount: { fontSize: 12, color: theme.subtext },
    input: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: theme.text,
    },
    textArea: { height: 110, textAlignVertical: "top" },

    // Price
    priceRow: { flexDirection: "row", gap: 10, alignItems: "center" },
    priceInput: { flex: 1 },
    negotiableToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: theme.surface,
    },
    negotiableToggleActive: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
    negotiableText: { fontSize: 13, fontWeight: "700", color: theme.subtext },
    negotiableTextActive: { color: "#fff" },

    // Chips
    chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    chipText: { fontSize: 13, fontWeight: "700", color: theme.subtext },
    chipTextActive: { color: theme.surface },

    // Condition
    conditionChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    conditionChipText: { fontSize: 13, fontWeight: "700", color: theme.subtext },

    // Location
    locationField: { position: "relative", zIndex: 10 },
    locationSelector: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
    locationSelectorText: { fontSize: 15, color: theme.primary, fontWeight: "700" },
    locationDropdown: {
      position: "absolute",
      top: 46,
      left: 0,
      right: 0,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
      zIndex: 1000,
      elevation: 6,
    },
    locationAction: { paddingHorizontal: 14, paddingVertical: 14, backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.border },
    locationActionText: { fontSize: 14, color: theme.primary, fontWeight: "700" },
    locationSearchInput: { backgroundColor: theme.background, paddingHorizontal: 14, paddingVertical: 12, color: theme.text, fontSize: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
    locationList: { maxHeight: 180 },
    locationItem: { paddingHorizontal: 14, paddingVertical: 12 },
    locationItemActive: { backgroundColor: theme.primary },
    locationItemText: { fontSize: 14, color: theme.text },
    locationItemTextActive: { color: theme.surface },

    // Actions
    actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
    draftButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.primary,
      backgroundColor: theme.surface,
    },
    draftButtonText: { fontSize: 14, fontWeight: "700", color: theme.primary },
    previewButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      minHeight: 52,
      borderRadius: 12,
      backgroundColor: "#0f766e",
    },
    previewButtonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  });
}