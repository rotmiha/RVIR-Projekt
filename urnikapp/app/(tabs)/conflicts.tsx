import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/components/AuthProvider";
import { useSettings } from "@/components/settingsProvider";

const API_BASE = "http://164.8.207.68:5000";

type EventItem = {
  id: string;
  title?: string;
  type?: string;
  source?: string | null;
  startTime?: string;
  endTime?: string;
  location?: string | null;
  ownerUserId?: string | null;
};

type ConflictItem = {
  id: string;
  manualEvent: EventItem;
  importedEvent: EventItem;
  priority: string | null;
  resolution: string;
};

function fmt(dt?: string) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function ConflictsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { resolvedTheme, a11yScale, hitSlop } = useSettings();
  const isDark = resolvedTheme === "dark";

  const colors = {
    bg: isDark ? "#0b1220" : "#ffffff",
    text: isDark ? "#e5e7eb" : "#0f172a",
    muted: isDark ? "#94a3b8" : "#666666",
    card: isDark ? "#111827" : "#ffffff",
    cardBorder: isDark ? "#1f2937" : "#eeeeee",
    soft: isDark ? "#0f172a" : "#f7f7f7",
    softBorder: isDark ? "#1f2937" : "#ededed",

    buttonBg: isDark ? "#111827" : "#f2f2f2",
    buttonBorder: isDark ? "#334155" : "#e6e6e6",

    errorBg: isDark ? "#3f1d1d" : "#ffecec",
    errorBorder: isDark ? "#7f1d1d" : "#ffbdbd",
  };

  const userId = user?.id;
  const program = (user as any)?.program ?? "";
  const year = (user as any)?.year ?? "";

  const TAB_HEIGHT = 62;
  const GAP = 8;
  const topPad = useMemo(() => insets.top + GAP + TAB_HEIGHT + 12, [insets.top]);

  const [loading, setLoading] = useState(true);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!userId) {
      setConflicts([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);

      const qs = new URLSearchParams({
        userId,
        ...(program && year ? { program, year } : {}),
      });

      const res = await fetch(`${API_BASE}/api/conflicts?${qs.toString()}`);

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }

      const data: { conflicts?: ConflictItem[] } = await res.json();
      setConflicts(Array.isArray(data.conflicts) ? data.conflicts : []);
    } catch (e: any) {
      console.error("Failed loading conflicts:", e);
      setError(e?.message ?? "Failed loading conflicts");
      setConflicts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [userId, program, year]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, paddingTop: topPad, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <Text style={{ fontSize: 22 * a11yScale, fontWeight: "800", color: colors.text }}>
          Konflikti
        </Text>

        <Pressable
          onPress={load}
          hitSlop={hitSlop}
          style={{
            marginLeft: "auto",
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 10,
            backgroundColor: colors.buttonBg,
            borderWidth: 1,
            borderColor: colors.buttonBorder,
          }}
          accessibilityRole="button"
          accessibilityLabel="Osveži konflikte"
        >
          <Text style={{ fontWeight: "800", color: colors.text, fontSize: 14 * a11yScale }}>
            Osveži
          </Text>
        </Pressable>
      </View>

      {!!error && (
        <View
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: colors.errorBg,
            borderWidth: 1,
            borderColor: colors.errorBorder,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontWeight: "800", color: colors.text, fontSize: 14 * a11yScale }}>
            Napaka
          </Text>
          <Text style={{ color: colors.muted, marginTop: 4, fontSize: 13 * a11yScale }}>
            {error}
          </Text>
        </View>
      )}

      <FlatList
        data={conflicts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => {
          const manual = item?.manualEvent;
          const imported = item?.importedEvent;
          if (!manual || !imported) return null;

          return (
            <View
              style={{
                padding: 14,
                borderRadius: 14,
                backgroundColor: colors.card,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: colors.cardBorder,
              }}
            >
              <Text
                style={{
                  fontSize: 14 * a11yScale,
                  fontWeight: "900",
                  marginBottom: 8,
                  color: colors.text,
                }}
              >
                {(manual.title ?? "Untitled manual")} ↔ {(imported.title ?? "Untitled imported")}
              </Text>

              <Text style={{ fontSize: 12 * a11yScale, color: colors.muted }}>
                Osebno: {fmt(manual.startTime)} → {fmt(manual.endTime)}
              </Text>

              <Text style={{ fontSize: 12 * a11yScale, color: colors.muted, marginTop: 2 }}>
                Faks: {fmt(imported.startTime)} → {fmt(imported.endTime)}
              </Text>

              <View
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: colors.soft,
                  borderWidth: 1,
                  borderColor: colors.softBorder,
                }}
              >
                <Text style={{ fontSize: 12 * a11yScale, color: colors.text }}>
                  {item.resolution ?? "Conflict detected."}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={{ color: colors.muted, marginTop: 12, fontSize: 14 * a11yScale }}>
            Ni konfliktov 🎉
          </Text>
        }
      />
    </View>
  );
}
