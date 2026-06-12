import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const lightTheme = {
  background: "#f4f7fb",
  surface: "#ffffff",
  card: "#eef3f8",
  text: "#0f172a",
  subtext: "#475569",
  muted: "#64748b",
  border: "#cbd5e1",
  primary: "#0f766e",
  primarySoft: "#d9f0ec",
  primaryText: "#ffffff",
  secondary: "#64748b",
  danger: "#dc2626",
  success: "#16a34a",
  placeholder: "#94a3b8",
  tabBarBackground: "#ffffff",
  tabBarBorder: "#cbd5e1",
  tabBarActive: "#0f766e",
  tabBarInactive: "#64748b",
  shadow: "#0f172a",
};

export const darkTheme = {
  background: "#061224",
  surface: "#0b1d36",
  card: "#102642",
  text: "#f8fafc",
  subtext: "#cbd5e1",
  muted: "#94a3b8",
  border: "#1f3a5f",
  primary: "#5bb7ff",
  primarySoft: "rgba(91, 183, 255, 0.14)",
  primaryText: "#071a33",
  secondary: "#94a3b8",
  danger: "#fda4af",
  success: "#4ade80",
  placeholder: "#94a3b8",
  tabBarBackground: "#061224",
  tabBarBorder: "#1f3a5f",
  tabBarActive: "#5bb7ff",
  tabBarInactive: "#94a3b8",
  shadow: "#000",
};

export type ThemeColors = typeof lightTheme;
export type ThemeMode = "light" | "dark" | "automatic";

type ThemeModeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  theme: ThemeColors;
  isDarkMode: boolean;
  ready: boolean;
};

const THEME_MODE_KEY = "app_theme_mode";

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("automatic");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_MODE_KEY)
      .then((stored) => {
        if (!active) return;
        if (stored === "light" || stored === "dark" || stored === "automatic") {
          setModeState(stored);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setMode = (nextMode: ThemeMode) => {
    setModeState(nextMode);
    void AsyncStorage.setItem(THEME_MODE_KEY, nextMode);
  };

  const isDarkMode =
    mode === "automatic" ? systemScheme === "dark" : mode === "dark";

  const theme = isDarkMode ? darkTheme : lightTheme;

  const value = useMemo(
    () => ({ mode, setMode, theme, isDarkMode, ready }),
    [mode, theme, isDarkMode, ready],
  );

  return React.createElement(ThemeModeContext.Provider, { value }, children);
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext);
  const systemScheme = useColorScheme();
  if (!context) {
    const isDarkMode = systemScheme === "dark";
    return {
      mode: "automatic" as ThemeMode,
      setMode: () => {},
      theme: isDarkMode ? darkTheme : lightTheme,
      isDarkMode,
      ready: true,
    };
  }
  return context;
}

export function useTheme(): ThemeColors {
  return useThemeMode().theme;
}

export function useIsDarkMode() {
  return useThemeMode().isDarkMode;
}
