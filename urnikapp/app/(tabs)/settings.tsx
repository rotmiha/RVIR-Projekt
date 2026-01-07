import React, { useState } from "react";
import {
  Pressable,
  Text,
  Alert,
  View,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useAuth } from "@/components/AuthProvider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { refreshWiseSchedule } from "@/lib/wiseImport";
import { useSettings } from "../../components/settingsProvider";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { themeMode, setThemeMode, accessibleMode, setAccessibleMode, resolvedTheme, a11yScale, hitSlop } =
    useSettings();

  const [loading, setLoading] = useState(false);

  const TAB_HEIGHT = 62;
  const GAP = 8;
  const topPad = insets.top + GAP + TAB_HEIGHT + 12;

  const isDark = resolvedTheme === "dark";

  const colors = {
    bg: isDark ? "#0b1220" : "#ffffff",
    text: isDark ? "#e5e7eb" : "#0f172a",
    card: isDark ? "#111827" : "#ffffff",
    border: isDark ? "#334155" : "#0f172a",
    muted: isDark ? "#94a3b8" : "#475569",
    danger: "#dc2626",
    dangerBg: isDark ? "#3f1d1d" : "#fee2e2",
  };

  async function onImport() {
    if (loading) return;

    try {
      setLoading(true);

      if (!user?.id) throw new Error("Ni userja");
      if (!user.program || !user.year) throw new Error("Manjka program ali letnik");

      const programValue = String(user.program);
      const yearValue = String(user.year);

      const r = await refreshWiseSchedule(programValue, yearValue);

      const key = ["/api/calendar-events", user.id, programValue, yearValue] as const;
      await queryClient.invalidateQueries({ queryKey: key });
      await queryClient.refetchQueries({ queryKey: key });

      Alert.alert(
        "OK",
        r.imported === 0
          ? "Urnik je že posodobljen (ni sprememb)."
          : `Urnik posodobljen. Uvoženih: ${r.imported} dogodkov`
      );
    } catch (e: any) {
      Alert.alert("Napaka", e?.message ?? "Import fail");
    } finally {
      setLoading(false);
    }
  }

  function onLogout() {
    Alert.alert("Odjava", "Ali se res želiš odjaviti?", [
      { text: "Prekliči", style: "cancel" },
      {
        text: "Odjava",
        style: "destructive",
        onPress: async () => {
          await logout();
          queryClient.clear();
          router.replace("/login");
        },
      },
    ]);
  }

  const Row = ({
    title,
    subtitle,
    right,
    onPress,
  }: {
    title: string;
    subtitle?: string;
    right?: React.ReactNode;
    onPress?: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={hitSlop}
      style={{
        padding: 14,
        borderWidth: 1,
        borderRadius: 12,
        borderColor: isDark ? "#1f2937" : "#e2e8f0",
        backgroundColor: colors.card,
        gap: 6,
        opacity: loading ? 0.7 : 1,
      }}
      accessibilityRole={onPress ? "button" : "none"}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 * a11yScale }}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={{ color: colors.muted, marginTop: 2, fontSize: 13 * a11yScale }}>
              {subtitle}
            </Text>
          )}
        </View>
        {right}
      </View>
    </Pressable>
  );

  const ThemeButton = ({ label, value }: { label: string; value: "system" | "light" | "dark" }) => {
    const selected = themeMode === value;
    return (
      <Pressable
        onPress={() => setThemeMode(value)}
        hitSlop={hitSlop}
        style={{
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderRadius: 10,
          borderColor: selected ? colors.border : (isDark ? "#334155" : "#cbd5e1"),
          backgroundColor: selected ? (isDark ? "#0f172a" : "#f1f5f9") : "transparent",
          opacity: loading ? 0.7 : 1,
        }}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 * a11yScale }}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        flex: 1,
        padding: 16,
        paddingTop: topPad,
        gap: 12,
        backgroundColor: colors.bg,
      }}
    >
      {/* Tema */}
      <Row
        title="Tema"
        subtitle="Izberi videz aplikacije (sistem / svetla / temna)."
        right={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <ThemeButton label="Sistem" value="system" />
            <ThemeButton label="Svetla" value="light" />
            <ThemeButton label="Temna" value="dark" />
          </View>
        }
      />

      {/* Dostopni način */}
      <Row
        title="Dostopni način"
        subtitle="Večji tekst, večji gumbi in bolj berljiv vmesnik."
        right={
          <Switch
            value={accessibleMode}
            onValueChange={(v) => setAccessibleMode(v)}
            disabled={loading}
            accessibilityLabel="Preklopi dostopni način"
          />
        }
        onPress={() => setAccessibleMode(!accessibleMode)}
      />

      {/* Osveži WISE urnik */}
      <Pressable
        onPress={onImport}
        disabled={loading}
        hitSlop={hitSlop}
        style={{
          padding: 14,
          borderWidth: 1,
          borderRadius: 12,
          borderColor: colors.border,
          backgroundColor: colors.card,
          opacity: loading ? 0.6 : 1,
        }}
        accessibilityRole="button"
        accessibilityLabel="Osveži WISE urnik"
      >
        <Text
          style={{
            textAlign: "center",
            fontWeight: "700",
            color: colors.text,
            fontSize: 15 * a11yScale,
          }}
        >
          {loading ? "Osvežujem..." : "Osveži WISE urnik"}
        </Text>
      </Pressable>

      {/* Odjava */}
      <Pressable
        onPress={onLogout}
        disabled={loading}
        hitSlop={hitSlop}
        style={{
          padding: 14,
          borderWidth: 1,
          borderRadius: 12,
          borderColor: colors.danger,
          backgroundColor: colors.dangerBg,
          opacity: loading ? 0.7 : 1,
        }}
        accessibilityRole="button"
        accessibilityLabel="Odjava"
      >
        <Text
          style={{
            textAlign: "center",
            fontWeight: "700",
            color: colors.danger,
            fontSize: 15 * a11yScale,
          }}
        >
          Odjava
        </Text>
      </Pressable>

      {/* ✅ Toast-like loading overlay */}
      {loading && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.35)",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            elevation: 999, // Android
          }}
        >
          <View
            style={{
              backgroundColor: "white",
              paddingVertical: 16,
              paddingHorizontal: 18,
              borderRadius: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              maxWidth: "85%",
            }}
            accessibilityRole="alert"
            accessibilityLabel="Osvežujem WISE urnik"
          >
            <ActivityIndicator size="large" />
            <Text style={{ fontWeight: "600" }}>Osvežujem WISE urnik…</Text>
          </View>
        </View>
      )}
    </View>
  );
}

