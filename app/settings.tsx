import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useThemeMode } from "./theme";

const THEME_OPTIONS = [
  { key: "automatic", label: "Automatic", description: "Match your device theme", icon: "phone-portrait" },
  { key: "light", label: "Light", description: "Always use the light theme", icon: "sunny" },
  { key: "dark", label: "Dark", description: "Always use the dark theme", icon: "moon" },
] as const;

export default function SettingsScreen() {
  const router = useRouter();
  const { theme, mode, setMode } = useThemeMode();
  const styles = useMemo(() => getStyles(theme), [theme]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.8} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>Manage how the app looks and feels.</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="color-palette-outline" size={18} color={theme.primary} />
            <Text style={styles.cardTitle}>Theme</Text>
          </View>
          <Text style={styles.cardSubtitle}>Choose the app appearance.</Text>

          <View style={styles.options}>
            {THEME_OPTIONS.map((option) => {
              const selected = mode === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.option, selected && styles.optionActive]}
                  activeOpacity={0.85}
                  onPress={() => setMode(option.key)}
                >
                  <View style={styles.optionIconWrap}>
                    <Ionicons
                      name={option.icon as any}
                      size={18}
                      color={selected ? theme.primary : theme.secondary}
                    />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, selected && styles.optionLabelActive]}>
                      {option.label}
                    </Text>
                    <Text style={styles.optionDescription}>{option.description}</Text>
                  </View>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function getStyles(theme: any) {
  const isDark = theme.background === "#061224";
  const glassBg = isDark ? "rgba(11,29,54,0.92)" : "rgba(255,255,255,0.86)";
  const glassBorder = isDark ? "rgba(91,183,255,0.18)" : "rgba(203,213,225,0.92)";

  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: "transparent" },
    content: { padding: 16, paddingTop: 56, gap: 16 },
    header: { flexDirection: "row", alignItems: "center", gap: 12 },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: glassBg,
      borderWidth: 0.5,
      borderColor: glassBorder,
    },
    headerText: { flex: 1, gap: 2 },
    title: { fontSize: 28, fontWeight: "900", color: theme.text },
    subtitle: { fontSize: 13, color: theme.secondary },
    card: {
      backgroundColor: glassBg,
      borderRadius: 22,
      borderWidth: 0.5,
      borderColor: glassBorder,
      padding: 16,
      gap: 12,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    cardTitle: { fontSize: 18, fontWeight: "800", color: theme.text },
    cardSubtitle: { fontSize: 13, color: theme.secondary, marginTop: -4 },
    options: { gap: 10 },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: 0.5,
      borderColor: glassBorder,
      backgroundColor: theme.background,
    },
    optionActive: {
      borderColor: theme.primary,
      backgroundColor: isDark ? "rgba(91,183,255,0.10)" : theme.primarySoft,
    },
    optionIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "rgba(91,183,255,0.10)" : "rgba(15,118,110,0.08)",
    },
    optionText: { flex: 1, gap: 2 },
    optionLabel: { fontSize: 15, fontWeight: "800", color: theme.text },
    optionLabelActive: { color: theme.primary },
    optionDescription: { fontSize: 12, color: theme.secondary },
  });
}
