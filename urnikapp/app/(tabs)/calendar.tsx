import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import { WeekCalendar, type CalendarEvent } from "@/components/week-calendar";
import { EventFormDialog } from "@/components/event-form-dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { format } from "date-fns";
import { useSettings } from "@/components/settingsProvider";

/* ================= TYPES ================= */

type ApiEvent = {
  id: string;
  ownerUserId?: string | null;
  program?: string | null;
  year?: string | null;

  title: string;
  type: "study" | "personal";
  startTime: string;
  endTime: string;
  location?: string | null;
  description?: string | null;
};

/* ================= COLORS ================= */

type StudyTag = "RV" | "SV" | "PR" | "OTHER";

const STUDY_TAG_COLORS: Record<StudyTag, string> = {
  RV: "#f97316",
  SV: "#a855f7",
  PR: "#06b6d4",
  OTHER: "#3b82f6",
};

const PERSONAL_COLOR = "#22c55e";

/* ================= HELPERS ================= */

function getStudyTag(e: ApiEvent): StudyTag {
  const text = `${e.description ?? ""} ${e.title ?? ""}`.toUpperCase();
  if (/\bRV\b/.test(text)) return "RV";
  if (/\bSV\b/.test(text)) return "SV";
  if (/\bPR\b/.test(text)) return "PR";
  return "OTHER";
}

const API_BASE = "http://164.8.207.68:5000";

function fmtRange(start: Date, end: Date) {
  return `${format(start, "d. MMM yyyy HH:mm")} – ${format(end, "HH:mm")}`;
}

/* ================= SCREEN ================= */

export default function CalendarScreen() {
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { resolvedTheme, a11yScale, hitSlop } = useSettings();
  const isDark = resolvedTheme === "dark";

  const colors = useMemo(
    () => ({
      bg: isDark ? "#0b1220" : "#ffffff",
      text: isDark ? "#e5e7eb" : "#0f172a",
      muted: isDark ? "#94a3b8" : "#475569",
      muted2: isDark ? "#9ca3af" : "#64748b",

      card: isDark ? "#111827" : "#ffffff",
      border: isDark ? "#1f2937" : "#e5e7eb",

      btnBg: isDark ? "#e5e7eb" : "#0f172a", // primary button bg
      btnText: isDark ? "#0f172a" : "#ffffff",

      toastOverlay: "rgba(0,0,0,0.25)",
      toastBtnBg: isDark ? "#0f172a" : "#f8fafc",
      toastBtnBorder: isDark ? "#334155" : "#e5e7eb",
      toastBtnText: isDark ? "#e5e7eb" : "#0f172a",

      toastDeleteBg: isDark ? "#3f1d1d" : "#fee2e2",
      toastDeleteBorder: isDark ? "#7f1d1d" : "#fecaca",
      toastDeleteText: "#991b1b",
      toastText: isDark ? "#cbd5e1" : "#334155",
    }),
    [isDark]
  );

  const TAB_HEIGHT = 62;
  const GAP = 8;
  const topPad = insets.top + GAP + TAB_HEIGHT + 12;

  const userId = user?.id;
  const program = user?.program ? String(user.program) : undefined;
  const year = user?.year ? String(user.year) : undefined;

  const { data: events = [], isLoading } = useQuery<ApiEvent[]>({
    queryKey: ["/api/calendar-events", userId, program, year],
    enabled: !!userId && !!program && !!year,
    queryFn: () => api.getCalendarEvents(userId as string, program as string, year as string),
  });

  const calendarEvents = useMemo(
    () =>
      events.map((e) => {
        const tag = e.type === "study" ? getStudyTag(e) : null;
        return {
          id: e.id,
          title: e.title,
          startTime: new Date(e.startTime),
          endTime: new Date(e.endTime),
          location: e.location || undefined,
          color: e.type === "personal" ? PERSONAL_COLOR : STUDY_TAG_COLORS[tag ?? "OTHER"],
          badgeLabel: e.type === "personal" ? "Osebno" : tag ?? "OTHER",
        } as CalendarEvent;
      }),
    [events]
  );

  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const visibleCalendarEvents = useMemo(() => {
    if (deletedIds.size === 0) return calendarEvents;
    return calendarEvents.filter((e) => !deletedIds.has(e.id));
  }, [calendarEvents, deletedIds]);

  const tabBarHeight = useBottomTabBarHeight();
  const bottomPad = insets.bottom + tabBarHeight + 24;

  const deleteSelected = async () => {
    if (!selectedEvent) return;

    try {
      setDeleting(true);

      const res = await fetch(
        `${API_BASE}/api/events/${encodeURIComponent(selectedEvent.id)}`,
        { method: "DELETE" }
      );

      if (!res.ok && res.status !== 204) {
        throw new Error(`Delete failed (${res.status})`);
      }

      setDeletedIds((prev) => {
        const next = new Set(prev);
        next.add(selectedEvent.id);
        return next;
      });

      setSelectedEvent(null);
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.bgBase, { backgroundColor: colors.bg }]}
      contentContainerStyle={[
        styles.container,
        { paddingTop: topPad, paddingBottom: bottomPad },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.titleBase, { color: colors.text, fontSize: 28 * a11yScale }]}>
            Tedenski koledar
          </Text>
          <Text style={[styles.subtitleBase, { color: colors.muted, fontSize: 14 * a11yScale }]}>
            Vaš tedenski urnik
          </Text>
        </View>

        <Pressable
          onPress={() => setShowEventDialog(true)}
          hitSlop={hitSlop}
          style={({ pressed }) => [
            styles.primaryBtnBase,
            { backgroundColor: colors.btnBg },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Dodaj dogodek"
        >
          <Text style={[styles.primaryBtnTextBase, { color: colors.btnText, fontSize: 14 * a11yScale }]}>
            + Dodaj
          </Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 14 }}>
        {isLoading ? (
          <View style={styles.centerPad}>
            <ActivityIndicator />
            <Text style={[styles.mutedTextBase, { color: colors.muted2, fontSize: 14 * a11yScale }]}>
              Nalaganje…
            </Text>
          </View>
        ) : (
          <WeekCalendar
            events={visibleCalendarEvents}
            onEventClick={(event) => setSelectedEvent(event)}
          />
        )}
      </View>

      <EventFormDialog open={showEventDialog} onOpenChange={setShowEventDialog} />

      {selectedEvent && (
        <Pressable
          style={[styles.toastOverlay, { backgroundColor: colors.toastOverlay }]}
          onPress={() => !deleting && setSelectedEvent(null)}
        >
          <Pressable
            style={[
              styles.toastCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => {}}
          >
            <Text style={[styles.toastTitleBase, { color: colors.text, fontSize: 16 * a11yScale }]}>
              {selectedEvent.title}
            </Text>

            <Text style={[styles.toastTextBase, { color: colors.toastText, fontSize: 13 * a11yScale }]}>
              🕒 {fmtRange(selectedEvent.startTime, selectedEvent.endTime)}
            </Text>

            {!!selectedEvent.location && (
              <Text style={[styles.toastTextBase, { color: colors.toastText, fontSize: 13 * a11yScale }]}>
                📍 {selectedEvent.location}
              </Text>
            )}

            <View style={styles.toastActions}>
              <Pressable
                onPress={() => setSelectedEvent(null)}
                style={[
                  styles.toastBtn,
                  {
                    backgroundColor: colors.toastBtnBg,
                    borderColor: colors.toastBtnBorder,
                    minHeight: 44 * a11yScale,
                  },
                ]}
                disabled={deleting}
                hitSlop={hitSlop}
              >
                <Text style={[styles.toastBtnTextBase, { color: colors.toastBtnText, fontSize: 13 * a11yScale }]}>
                  Zapri
                </Text>
              </Pressable>

              <Pressable
                onPress={deleteSelected}
                style={[
                  styles.toastBtn,
                  {
                    backgroundColor: colors.toastDeleteBg,
                    borderColor: colors.toastDeleteBorder,
                    minHeight: 44 * a11yScale,
                  },
                ]}
                disabled={deleting}
                hitSlop={hitSlop}
              >
                <Text style={[styles.toastDeleteTextBase, { fontSize: 13 * a11yScale }]}>
                  {deleting ? "Brišem…" : "Odstrani"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      )}
    </ScrollView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  bgBase: { flex: 1 }, // ✅ no hard-coded bg
  container: { padding: 20, paddingBottom: 40 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },

  titleBase: { fontWeight: "800" },
  subtitleBase: { marginTop: 4 },

  primaryBtnBase: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryBtnTextBase: { fontWeight: "800" },
  pressed: { opacity: 0.75 },

  centerPad: { paddingVertical: 22, alignItems: "center", gap: 8 },
  mutedTextBase: {},

  toastOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },

  toastCard: {
    width: "100%",
    maxWidth: 420,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  toastTitleBase: {
    textAlign: "center",
    fontWeight: "900",
    marginBottom: 8,
  },
  toastTextBase: { marginBottom: 4 },

  toastActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 14,
  },

  toastBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  toastBtnTextBase: { fontWeight: "800" },

  toastDeleteTextBase: {
    fontWeight: "900",
    color: "#991b1b",
  },
});
