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

import { WeekCalendar } from "@/components/week-calendar";
import { EventFormDialog } from "@/components/event-form-dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

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
  RV: "#f97316",     // orange
  SV: "#a855f7",     // purple
  PR: "#06b6d4",     // cyan
  OTHER: "#3b82f6",  // blue
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

/* ================= SCREEN ================= */

export default function CalendarScreen() {
  const [showEventDialog, setShowEventDialog] = useState(false);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const TAB_HEIGHT = 62;
  const GAP = 8;
  const topPad = insets.top + GAP + TAB_HEIGHT + 12;

  const userId = user?.id;
  const program = user?.program ? String(user.program) : undefined;
  const year = user?.year ? String(user.year) : undefined;

  const { data: events = [], isLoading } = useQuery<ApiEvent[]>({
    queryKey: ["/api/calendar-events", userId, program, year],
    enabled: !!userId && !!program && !!year,
    queryFn: () =>
      api.getCalendarEvents(userId as string, program as string, year as string),
  });

  /* ===== MAP EVENTS FOR WEEK CALENDAR ===== */

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

          color:
            e.type === "personal"
              ? PERSONAL_COLOR
              : STUDY_TAG_COLORS[tag ?? "OTHER"],

          badgeLabel:
            e.type === "personal" ? "Osebno" : tag ?? "OTHER",
        };
      }),
    [events]
  );

const tabBarHeight = useBottomTabBarHeight();
const bottomPad = insets.bottom + tabBarHeight + 24;
  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={[styles.container, { paddingTop: topPad ,  paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Tedenski koledar</Text>
          <Text style={styles.subtitle}>
            Vaš tedenski urnik
          </Text>
        </View>

        <Pressable
          onPress={() => setShowEventDialog(true)}
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryBtnText}>+ Dodaj</Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 14 }}>
        {isLoading ? (
          <View style={styles.centerPad}>
            <ActivityIndicator />
            <Text style={styles.mutedText}>Nalaganje…</Text>
          </View>
        ) : (
          <WeekCalendar
            events={calendarEvents}
            onEventClick={(event) => console.log("CLICK:", event)}
          />
        )}
      </View>

      <EventFormDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
      />
    </ScrollView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  bg: { backgroundColor: "#fff" },
  container: { padding: 20, paddingBottom: 40 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 28, fontWeight: "800", color: "#0f172a" },
  subtitle: { marginTop: 4, color: "#475569" },

  primaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#0f172a",
  },
  primaryBtnText: { color: "#fff", fontWeight: "800" },
  pressed: { opacity: 0.75 },

  centerPad: { paddingVertical: 22, alignItems: "center", gap: 8 },
  mutedText: { color: "#64748b" },
});
