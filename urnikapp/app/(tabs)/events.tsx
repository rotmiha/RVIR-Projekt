import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/components/AuthProvider";
import { useSettings } from "@/components/settingsProvider";

type EventItem = {
  id: string;
  title: string;
  type: string;
  source?: string | null;
  startTime?: string;
  endTime?: string;
};

const API_BASE = "http://164.8.207.68:5000";

function fmt(dt?: string) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function timeKey(dt?: string) {
  if (!dt) return Number.POSITIVE_INFINITY;
  const t = new Date(dt).getTime();
  return isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id;

  const { resolvedTheme, a11yScale, hitSlop } = useSettings();
  const isDark = resolvedTheme === "dark";

  const colors = useMemo(
    () => ({
      bg: isDark ? "#0b1220" : "#ffffff",
      text: isDark ? "#e5e7eb" : "#0f172a",
      muted: isDark ? "#94a3b8" : "#666666",

      card: isDark ? "#111827" : "#f5f5f5",
      cardBorder: isDark ? "#1f2937" : "#e7e7e7",

      btnBg: isDark ? "#111827" : "#f2f2f2",
      btnBorder: isDark ? "#334155" : "#e6e6e6",

      btnDisabledBg: isDark ? "#0f172a" : "#eeeeee",
      btnDisabledBorder: isDark ? "#1f2937" : "#e0e0e0",

      dangerBg: isDark ? "#3f1d1d" : "#ffdddd",
      dangerBorder: isDark ? "#7f1d1d" : "#ffb3b3",
      dangerDisabledBg: isDark ? "#2a1414" : "#dddddd",
      dangerDisabledBorder: isDark ? "#3a1a1a" : "#d0d0d0",
      dangerText: isDark ? "#fecaca" : "#991b1b",

      empty: isDark ? "#94a3b8" : "#888888",
    }),
    [isDark]
  );

  const TAB_HEIGHT = 62;
  const GAP = 8;
  const topPad = useMemo(() => insets.top + GAP + TAB_HEIGHT + 12, [insets.top]);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async (opts?: { silent?: boolean }) => {
    if (!userId) {
      setEvents([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (opts?.silent) setRefreshing(true);
      else setLoading(true);

      const res = await fetch(
        `${API_BASE}/api/events/personal-or-manual?userId=${encodeURIComponent(userId)}`
      );

      const data: { events?: EventItem[] } = await res.json();

      const personalOnly = Array.isArray(data.events)
        ? data.events.filter((e) => e?.type === "personal")
        : [];

      personalOnly.sort((a, b) => timeKey(a.startTime) - timeKey(b.startTime));
      setEvents(personalOnly);
    } catch (e) {
      console.error("Failed loading events:", e);
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const onDelete = (ev: EventItem) => {
    Alert.alert("Odstrani dogodek", `Želiš odstraniti:\n"${ev.title}"?`, [
      { text: "Prekliči", style: "cancel" },
      {
        text: "Odstrani",
        style: "destructive",
        onPress: async () => {
          try {
            setDeletingId(ev.id);

            // Optimistic UI
            const prev = events;
            setEvents((cur) => cur.filter((x) => x.id !== ev.id));

            const res = await fetch(
              `${API_BASE}/api/events/${encodeURIComponent(ev.id)}`,
              { method: "DELETE" }
            );

            if (!res.ok) {
              setEvents(prev);
              const msg = await res.text().catch(() => "");
              Alert.alert("Napaka", msg || "Brisanje ni uspelo.");
              return;
            }
          } catch (e) {
            console.error("Delete failed:", e);
            Alert.alert("Napaka", "Brisanje ni uspelo.");
            await load();
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, paddingTop: topPad, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <Text style={{ fontSize: 22 * a11yScale, fontWeight: "800", color: colors.text }}>
          Vsi osebni dogodki
        </Text>

        <Pressable
          onPress={() => load({ silent: true })}
          disabled={refreshing}
          hitSlop={hitSlop}
          style={{
            marginLeft: "auto",
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 10,
            backgroundColor: refreshing ? colors.btnDisabledBg : colors.btnBg,
            borderWidth: 1,
            borderColor: refreshing ? colors.btnDisabledBorder : colors.btnBorder,
            opacity: refreshing ? 0.85 : 1,
          }}
          accessibilityRole="button"
          accessibilityLabel="Osveži osebne dogodke"
        >
          <Text style={{ fontSize: 12 * a11yScale, fontWeight: "900", color: colors.text }}>
            {refreshing ? "Osvežujem…" : "Osveži"}
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => {
          const isDeleting = deletingId === item.id;

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
              <View style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 16 * a11yScale, fontWeight: "800", color: colors.text }}>
                  {item.title}
                </Text>

                <Text style={{ fontSize: 12 * a11yScale, color: colors.muted, marginTop: 6 }}>
                  Začne: {fmt(item.startTime)}
                </Text>

                <Text style={{ fontSize: 12 * a11yScale, color: colors.muted, marginTop: 2 }}>
                  Konča: {fmt(item.endTime)}
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => onDelete(item)}
                  disabled={isDeleting}
                  hitSlop={hitSlop}
                  style={{
                    marginLeft: "auto",
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: isDeleting ? colors.dangerDisabledBg : colors.dangerBg,
                    borderWidth: 1,
                    borderColor: isDeleting ? colors.dangerDisabledBorder : colors.dangerBorder,
                    opacity: isDeleting ? 0.85 : 1,
                    minHeight: 44 * a11yScale,
                    justifyContent: "center",
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Odstrani dogodek ${item.title}`}
                >
                  <Text style={{ fontSize: 12 * a11yScale, fontWeight: "800", color: colors.dangerText }}>
                    {isDeleting ? "Brišem..." : "Odstrani"}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={{ color: colors.empty, marginTop: 12, fontSize: 14 * a11yScale }}>
            Ni personal eventov.
          </Text>
        }
      />
    </View>
  );
}
