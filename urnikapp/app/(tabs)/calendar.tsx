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

import { WeekCalendar } from "@/components/week-calendar";
import { EventFormDialog } from "@/components/event-form-dialog";
import { api } from "@/lib/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/components/AuthProvider";

type ApiEvent = {
  id: string;
  userId?: string; // optional
  title: string;
  type: "study" | "personal";
  startTime: string;
  endTime: string;
  location?: string | null;
};

export default function CalendarScreen() {
  const [showEventDialog, setShowEventDialog] = useState(false);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const TAB_HEIGHT = 62;
  const GAP = 8;
  const topPad = insets.top + GAP + TAB_HEIGHT + 12;

  const userId = user?.id;

  const {
    data: events = [],
    isLoading,
    isFetching,
    error,
  } = useQuery<ApiEvent[]>({
    queryKey: ["/api/events", userId],
    enabled: !!userId,
    queryFn: () => api.getEventsForUser(userId as string),
  });



  const calendarEvents = useMemo(
    () =>
      events.map((event) => ({
        id: event.id,
        title: event.title,
        type: event.type as "study" | "personal",
        startTime: new Date(event.startTime),
        endTime: new Date(event.endTime),
        location: event.location || undefined,
      })),
    [events]
  );

  return (
    <ScrollView style={styles.bg} contentContainerStyle={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Tedenski koledar</Text>
          <Text style={styles.subtitle}>
            {isFetching ? "Osveževanje…" : "Vaš celoten urnik na enem mestu"}
          </Text>
          {!!error && (
            <Text style={{ marginTop: 6, color: "crimson" }}>
              Napaka pri nalaganju dogodkov.
            </Text>
          )}
        </View>

        <Pressable
          onPress={() => setShowEventDialog(true)}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.primaryBtnText}>+ Dodaj</Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 14 }}>
        {isLoading ? (
          <View style={styles.centerPad}>
            <ActivityIndicator />
            <Text style={styles.mutedText}>Nalaganje koledarja…</Text>
          </View>
        ) : (
          <WeekCalendar
            events={calendarEvents}
            onEventClick={(event: any) => console.log("Event clicked:", event)}
          />
        )}
      </View>

      <EventFormDialog open={showEventDialog} onOpenChange={setShowEventDialog} />
    </ScrollView>
  );
}

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
