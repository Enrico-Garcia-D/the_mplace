import React, { ReactNode, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { ThemeColors, useThemeMode } from "../theme";

export default function DefaultBackground({ children }: { children: ReactNode }) {
  const { theme, isDarkMode } = useThemeMode();
  const styles = useMemo(() => getStyles(theme), [theme]);

  if (isDarkMode) {
    return <View style={styles.bgDark}>{children}</View>;
  }

  return <View style={styles.bgSolid}>{children}</View>;
}

const getStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    bgSolid: {
      flex: 1,
      backgroundColor: theme.background,
    },
    bgDark: {
      flex: 1,
      backgroundColor: "#000000",
    },
  });
