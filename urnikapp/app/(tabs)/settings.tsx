import React, { useState } from "react";
import {
  Pressable,
  Text,
  Alert,
  View,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "@/components/AuthProvider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { refreshWiseSchedule } from "@/lib/wiseImport";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);

  const TAB_HEIGHT = 62;
  const GAP = 8;
  const topPad = insets.top + GAP + TAB_HEIGHT + 12;

  async function onImport() {
    if (loading) return;

    try {
      setLoading(true);

      if (!user?.id) throw new Error("Ni userja");
      if (!user.program || !user.year)
        throw new Error("Manjka program ali letnik");

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

  return (
    <View style={{ flex: 1, padding: 16, paddingTop: topPad, gap: 12 }}>
      <Pressable
        onPress={onImport}
        disabled={loading}
        style={{
          padding: 14,
          borderWidth: 1,
          borderRadius: 12,
          borderColor: "#0f172a",
          opacity: loading ? 0.6 : 1,
        }}
      >
        <Text style={{ textAlign: "center", fontWeight: "700" }}>
          {loading ? "Osvežujem..." : "Osveži WISE urnik"}
        </Text>
      </Pressable>

      <Pressable
        onPress={onLogout}
        disabled={loading}
        style={{
          padding: 14,
          borderWidth: 1,
          borderRadius: 12,
          borderColor: "#dc2626",
          backgroundColor: "#fee2e2",
          opacity: loading ? 0.7 : 1,
        }}
      >
        <Text style={{ textAlign: "center", fontWeight: "700", color: "#dc2626" }}>
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
          >
            <ActivityIndicator size="large" />
            <Text style={{ fontWeight: "600" }}>Osvežujem WISE urnik…</Text>
          </View>
        </View>
      )}
    </View>
  );
}
