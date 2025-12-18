import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { startOfWeek, endOfWeek } from "date-fns";

import { api } from "../../lib/api";
import { queryClient } from "../../lib/queryClient";
import { ConflictAlert } from "@/components/conflict-alert";
import { StatCard } from "@/components/stat-card";
import { EventCard } from "../../components/event-card";
import { EventFormDialog } from "@/components/event-form-dialog";

// Če imaš svoj toast hook v Expo, ga lahko vključiš nazaj.
// import { useToast } from "@/hooks/use-toast";

type EventType = "study" | "personal";

type EventDto = {
  id: string;
  title: string;
  type: EventType;
  startTime: string;
  endTime: string;
  location?: string | null;
};

export default function DashboardScreen() {
  const router = useRouter();
  const [showEventDialog, setShowEventDialog] = useState(false);
  // const { toast } = useToast();

  const { data: allEvents = [], isLoading: eventsLoading } = useQuery<EventDto[]>({
    queryKey: ["/api/events"],
    queryFn: () => api.getEvents(),
  });

  const { data: conflicts = [] } = useQuery<any[]>({
    queryKey: ["/api/conflicts"],
    queryFn: () => api.getConflicts(),
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id: string) => api.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conflicts"] });

      // toast?.({ title: "Event Deleted", description: "The event has been removed." });
      console.log("Event deleted");
    },
    onError: () => {
      // toast?.({ title: "Error", description: "Failed to delete event.", variant: "destructive" });
      console.log("Delete failed");
    },
  });

  const { thisWeekEventsCount, totalStudyHours, upcomingEvents } = useMemo(() => {
    const now = new Date();

    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const thisWeekEvents = allEvents.filter((event) => {
      const eventStart = new Date(event.startTime);
      return eventStart >= thisWeekStart && eventStart <= thisWeekEnd;
    });

    const studyEvents = allEvents.filter((e) => e.type === "study");
    const hours = studyEvents.reduce((acc, event) => {
      const duration =
        (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) /
        (1000 * 60 * 60);
      return acc + duration;
    }, 0);

    const upcoming = allEvents
      .filter((event) => new Date(event.startTime) > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 3);

    return {
      thisWeekEventsCount: thisWeekEvents.length,
      totalStudyHours: hours,
      upcomingEvents: upcoming,
    };
  }, [allEvents]);

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Domov</Text>
          <Text style={styles.subtitle}>Pregled nad urnikom in aktivnostmi</Text>
        </View>

        <Pressable
          onPress={() => setShowEventDialog(true)}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryBtnText}>+ Dodaj aktivnost</Text>
        </Pressable>
      </View>

      {conflicts.length > 0 && (
        <ConflictAlert
          count={conflicts.length}
          onView={() => router.push("/(tabs)/dashboard")}
        />
      )}

      <View style={styles.statsGrid}>
        <View style={styles.statCell}>
          <StatCard title="Vse aktivnosti" value={allEvents.length} icon={"calendar"} description="je/so zapisane" />
        </View>
        <View style={styles.statCell}>
          <StatCard
            title="Študijski ur"
            value={totalStudyHours.toFixed(1)}
            icon={"clock"}
            description="je/so zapisane"
          />
        </View>
        <View style={styles.statCell}>
          <StatCard
            title="Konflikti"
            value={conflicts.length}
            icon={"alert-octagon"}
            description={conflicts.length > 0 ? "Potrebna " : "Brez problemov"}
          />
        </View>
        <View style={styles.statCell}>
          <StatCard title="Ta teden" value={thisWeekEventsCount} icon={"users"} description="Aktivnosti zabeleženih" />
        </View>
      </View>

      {/* Upcoming events card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Prihajajoči dogodki</Text>
          <Pressable
            onPress={() => router.push("/(tabs)/events")}
            style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
          >
            <Text style={styles.ghostBtnText}>Pregled vseh</Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 8 }}>
          {eventsLoading ? (
            <View style={styles.centerPad}>
              <ActivityIndicator />
              <Text style={styles.mutedText}>Nalaganje…</Text>
            </View>
          ) : upcomingEvents.length === 0 ? (
            <View style={styles.centerPad}>
              <Text style={styles.mutedText}>Ni prihajajočih dogodkov</Text>
            </View>
          ) : (
            upcomingEvents.map((event) => (
              <View key={event.id} style={{ marginBottom: 10 }}>
                <EventCard
                  id={event.id}
                  title={event.title}
                  type={event.type}
                  startTime={new Date(event.startTime)}
                  endTime={new Date(event.endTime)}
                  location={event.location || undefined}
                  onEdit={(id) => console.log("Edit:", id)}
                  onDelete={(id: string) => deleteEventMutation.mutate(id)}
                />
              </View>
            ))
          )}
        </View>
      </View>

      {/* Quick actions card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Hitre akcije</Text>

        <View style={{ marginTop: 10, gap: 10 }}>
          <Pressable
            style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
            onPress={() => router.push("/(tabs)/import")}
          >
            <Text style={styles.outlineBtnText}>Uvozi urnik</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
            onPress={() => router.push("/(tabs)/calendar")}
          >
            <Text style={styles.outlineBtnText}>View Weekly Calendar</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
            onPress={() => router.push("/(tabs)/settings")}
          >
            <Text style={styles.outlineBtnText}>Configure Notifications</Text>
          </Pressable>
        </View>
      </View>

      <EventFormDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
        // če ima tvoj RN dialog submit handler:
        // onSubmit={(payload) => console.log("New event", payload)}
      />
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
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  pressed: { opacity: 0.75 },

  statsGrid: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  statCell: { width: "48%" },

  card: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#fff",
  },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },

  ghostBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  ghostBtnText: { color: "#0f172a", fontWeight: "700" },

  outlineBtn: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  outlineBtnText: { color: "#0f172a", fontWeight: "700" },

  centerPad: { paddingVertical: 16, alignItems: "center", gap: 8 },
  mutedText: { color: "#64748b" },
});
