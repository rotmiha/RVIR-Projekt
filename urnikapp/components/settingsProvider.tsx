import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "react-native";

type ThemeMode = "system" | "light" | "dark";

const KEY_THEME = "settings.themeMode";
const KEY_A11Y = "settings.accessibleMode";

type SettingsState = {
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  accessibleMode: boolean;
  setAccessibleMode: (v: boolean) => void;
  resolvedTheme: "light" | "dark";
  a11yScale: number;
  hitSlop: number;
  hydrated: boolean;
};

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();

  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [accessibleMode, setAccessibleModeState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [t, a] = await Promise.all([
          AsyncStorage.getItem(KEY_THEME),
          AsyncStorage.getItem(KEY_A11Y),
        ]);

        if (t === "system" || t === "light" || t === "dark") setThemeModeState(t);
        if (a != null) setAccessibleModeState(a === "1");
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const resolvedTheme: "light" | "dark" = useMemo(() => {
    if (themeMode === "light") return "light";
    if (themeMode === "dark") return "dark";
    return systemScheme === "dark" ? "dark" : "light";
  }, [themeMode, systemScheme]);

  const setThemeMode = useCallback(async (m: ThemeMode) => {
    setThemeModeState(m);
    await AsyncStorage.setItem(KEY_THEME, m);
  }, []);

  const setAccessibleMode = useCallback(async (v: boolean) => {
    setAccessibleModeState(v);
    await AsyncStorage.setItem(KEY_A11Y, v ? "1" : "0");
  }, []);

  const a11yScale = accessibleMode ? 1.15 : 1;
  const hitSlop = accessibleMode ? 10 : 6;

  const value = useMemo(
    () => ({
      themeMode,
      setThemeMode,
      accessibleMode,
      setAccessibleMode,
      resolvedTheme,
      a11yScale,
      hitSlop,
      hydrated,
    }),
    [themeMode, accessibleMode, resolvedTheme, a11yScale, hitSlop, hydrated, setThemeMode, setAccessibleMode]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
