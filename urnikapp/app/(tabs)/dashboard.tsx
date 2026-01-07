import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { startOfWeek, endOfWeek } from "date-fns";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../../lib/api";
import { queryClient } from "../../lib/queryClient";
import { StatCard } from "@/components/stat-card";
import { EventCard } from "../../components/event-card";
import { EventFormDialog } from "@/components/event-form-dialog";
import { useAuth } from "@/components/AuthProvider";
import { useSettings } from "@/components/settingsProvider";

type EventType = "study" | "personal";

type EventDto = {
  id: string;
  title: string;
  type: EventType;
  startTime: string;
  endTime: string;
  location?: string | null;
};

type ConflictDto = {
  id: string;
  manualEvent: EventDto;
  importedEvent: EventDto;
  priority: string | null;
  resolution: string;
};

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;

  const { resolvedTheme, a11yScale, hitSlop } = useSettings();
  const isDark = resolvedTheme === "dark";

  const colors = useMemo(
    () => ({
      bg: isDark ? "#0b1220" : "#ffffff",
      text: isDark ? "#e5e7eb" : "#0f172a",
      muted: isDark ? "#94a3b8" : "#475569",
      muted2: isDark ? "#9ca3af" : "#64748b",

      card: isDark ? "#111827" : "#ffffff",
      border: isDark ? "#1f2937" : "#e2e8f0",
      divider: isDark ? "#1f2937" : "#eef2f7",

      primaryBg: isDark ? "#e5e7eb" : "#0f172a",
      primaryText: isDark ? "#0f172a" : "#ffffff",

      ghostText: isDark ? "#e5e7eb" : "#0f172a",

      chipBg: isDark ? "#3f1d1d" : "#fee2e2",
      chipBorder: isDark ? "#7f1d1d" : "#fecaca",
      chipText: isDark ? "#fecaca" : "#991b1b",

      miniBtnBg: isDark ? "#0f172a" : "#f2f2f2",
      miniBtnBorder: isDark ? "#334155" : "#e6e6e6",

      overlay: "rgba(0,0,0,0.25)",

      inputBg: isDark ? "#0f172a" : "#ffffff",
      inputBorder: isDark ? "#334155" : "#e5e7eb",
      inputText: isDark ? "#e5e7eb" : "#0f172a",
      placeholder: isDark ? "#94a3b8" : "#94a3b8",

      btnBg: isDark ? "#0f172a" : "#f8fafc",
      btnBorder: isDark ? "#334155" : "#e5e7eb",
      btnText: isDark ? "#e5e7eb" : "#0f172a",

      toastPrimaryBg: isDark ? "#e5e7eb" : "#0f172a",
      toastPrimaryText: isDark ? "#0f172a" : "#ffffff",

      error: isDark ? "#fecaca" : "#991b1b",
    }),
    [isDark]
  );

  const [showEventDialog, setShowEventDialog] = useState(false);

  // ✅ EDIT TOAST state
  const [editOpen, setEditOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<EventDto | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editType, setEditType] = useState<EventType>("personal");
  const notifiedRef = useRef<Set<string>>(new Set());

  const insets = useSafeAreaInsets();
  const TAB_HEIGHT = 62;
  const GAP = 8;
  const topPad = insets.top + GAP + TAB_HEIGHT + 12;

  const program = user?.program ? String(user.program) : undefined;
  const year = user?.year ? String(user.year) : undefined;

  const eventsKey = ["/api/calendar-events", userId, program, year] as const;
  const conflictsKey = ["/api/conflicts", userId, program, year] as const;

  const {
    data: allEvents = [],
    isLoading: eventsLoading,
    refetch: refetchEvents,
  } = useQuery<EventDto[]>({
    queryKey: eventsKey,
    enabled: !!userId && !!program && !!year,
    queryFn: () =>
      api.getCalendarEvents(userId as string, program as string, year as string),
  });

  const {
    data: conflictsData,
    isLoading: conflictsLoading,
    refetch: refetchConflicts,
  } = useQuery<{ conflicts: ConflictDto[] }>({
    queryKey: conflictsKey,
    enabled: !!userId && !!program && !!year,
    queryFn: async () => {
      const qs = new URLSearchParams({
        userId: userId as string,
        program: program as string,
        year: year as string,
      });

      const res = await fetch(`http://164.8.207.68:5000/api/conflicts?${qs.toString()}`);
      if (!res.ok) throw new Error(`Conflicts HTTP ${res.status}`);
      return res.json();
    },
  });
      const conflicts = (conflictsData?.conflicts ?? []).filter(
        (c): c is ConflictDto =>
          !!c &&
          !!c.id &&
          !!c.manualEvent &&
          !!c.importedEvent &&
          !!c.manualEvent.startTime &&
          !!c.importedEvent.startTime
      );

      const conflictsPreview = conflicts.slice(0, 3);

  const deleteEventMutation = useMutation({
    mutationFn: (id: string) => api.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventsKey });
      queryClient.invalidateQueries({ queryKey: conflictsKey });
    },
  });

  useEffect(() => {
    if (!allEvents?.length) return;

    const CHECK_EVERY_MS = 5000;
    const BEFORE_MS = 15 * 60 * 1000;

    const iv = setInterval(() => {
      const now = Date.now();

      for (const e of allEvents) {
        const start = new Date(e.startTime).getTime();
        if (!start) continue;

        const beforeKey = `${e.id}-before`;
        if (
          start - BEFORE_MS <= now &&
          start - BEFORE_MS > now - CHECK_EVERY_MS &&
          !notifiedRef.current.has(beforeKey)
        ) {
          notifiedRef.current.add(beforeKey);
          Alert.alert("Dogodek prihaja ⏰", `${e.title} se začne čez 15 minut.`, [{ text: "OK" }]);
        }

        const startKey = `${e.id}-start`;
        if (start <= now && start > now - CHECK_EVERY_MS && !notifiedRef.current.has(startKey)) {
          notifiedRef.current.add(startKey);
          Alert.alert("Dogodek se je začel 🎉", e.title, [{ text: "OK" }]);
        }
      }
    }, CHECK_EVERY_MS);

    return () => clearInterval(iv);
  }, [allEvents]);

  const updateEventMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      userId: string;
      title: string;
      location: string | null;
      type: EventType;
    }) => {
      const res = await fetch(
        `http://164.8.207.68:5000/api/events/${encodeURIComponent(payload.id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: payload.userId,
            title: payload.title,
            location: payload.location,
            type: payload.type,
          }),
        }
      );

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Update failed (${res.status})`);
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventsKey });
      queryClient.invalidateQueries({ queryKey: conflictsKey });
      setEditOpen(false);
      setEditEvent(null);
    },
  });

  const openEditToast = (e: EventDto) => {
    setEditEvent(e);
    setEditTitle(e.title ?? "");
    setEditLocation(e.location ?? "");
    setEditType(e.type);
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!userId || !editEvent) return;
    const t = editTitle.trim();
    if (!t) return;

    updateEventMutation.mutate({
      id: editEvent.id,
      userId,
      title: t,
      location: editLocation.trim() ? editLocation.trim() : null,
      type: editType,
    });
  };

  const { personalThisWeekCount, totalStudyHours, upcomingEvents } = useMemo(() => {
    const now = new Date();
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const personal = allEvents.filter((e) => e.type === "personal");
    const shared = allEvents.filter((e) => e.type === "personal"); // tvoj komentar: FIX

    const personalThisWeek = personal.filter((event) => {
      const eventStart = new Date(event.startTime);
      return eventStart >= thisWeekStart && eventStart <= thisWeekEnd;
    });

    const studyHours = shared.reduce((acc, event) => {
      const duration =
        (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) /
        (1000 * 60 * 60);
      return acc + duration;
    }, 0);

    const upcoming = personal
      .filter((event) => new Date(event.startTime) > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 3);

    return {
      personalThisWeekCount: personalThisWeek.length,
      totalStudyHours: studyHours,
      upcomingEvents: upcoming,
    };
  }, [allEvents]);

  const handleRefresh = async () => {
    await Promise.all([refetchEvents(), refetchConflicts()]);
  };

  return (
    <ScrollView
      style={[styles.bgBase, { backgroundColor: colors.bg }]}
      contentContainerStyle={[styles.container, { paddingTop: topPad }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.titleBase, { color: colors.text, fontSize: 28 * a11yScale }]}>
            Domov
          </Text>
          <Text style={[styles.subtitleBase, { color: colors.muted, fontSize: 14 * a11yScale }]}>
            Pregled nad urnikom in aktivnostmi
          </Text>
        </View>

        <Pressable
          onPress={handleRefresh}
          hitSlop={hitSlop}
          style={({ pressed }) => [
            styles.refreshBtnBase,
            { borderColor: colors.border, backgroundColor: colors.card },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Osveži podatke"
        >
          <Text style={[styles.refreshBtnTextBase, { color: colors.text, fontSize: 18 * a11yScale }]}>
            ⟳
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setShowEventDialog(true)}
          hitSlop={hitSlop}
          style={({ pressed }) => [
            styles.primaryBtnBase,
            { backgroundColor: colors.primaryBg },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Dodaj aktivnost"
        >
          <Text style={[styles.primaryBtnTextBase, { color: colors.primaryText, fontSize: 13 * a11yScale }]}>
            + Dodaj aktivnost
          </Text>
        </Pressable>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCell}>
          <StatCard
            title="Ure osebnih aktivnosti"
            value={totalStudyHours.toFixed(1)}
            icon={"clock"}
            description="je/so zapisane"
          />
        </View>

        <View style={styles.statCell}>
          <StatCard
            title="Tedenske aktivnosti"
            value={personalThisWeekCount}
            icon={"users"}
            description="aktivnosti"
          />
        </View>
      </View>

      {/* CONFLICTS QUICK VIEW */}
      <View style={[styles.cardBase, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitleBase, { color: colors.text, fontSize: 16 * a11yScale }]}>
            Konflikti
          </Text>
          <Pressable
            onPress={() => router.push("/(tabs)/conflicts")}
            hitSlop={hitSlop}
            style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
          >
            <Text style={[styles.ghostBtnTextBase, { color: colors.ghostText, fontSize: 13 * a11yScale }]}>
              Poglej vse
            </Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 10 }}>
          {conflictsLoading ? (
            <View style={styles.centerPad}>
              <ActivityIndicator />
              <Text style={[styles.mutedTextBase, { color: colors.muted2, fontSize: 14 * a11yScale }]}>
                Nalaganje…
              </Text>
            </View>
          ) : conflicts.length === 0 ? (
            <View style={styles.centerPad}>
              <Text style={[styles.mutedTextBase, { color: colors.muted2, fontSize: 14 * a11yScale }]}>
                Ni konfliktov 🎉
              </Text>
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.conflictPillBase,
                  { backgroundColor: colors.chipBg, borderColor: colors.chipBorder },
                ]}
              >
                <Text style={[styles.conflictPillTextBase, { color: colors.chipText, fontSize: 12 * a11yScale }]}>
                  {conflicts.length} {conflicts.length === 1 ? "konflikt" : "konfliktov"}
                </Text>
              </View>

              <View style={{ marginTop: 10 }}>
                {conflictsPreview.map((c) => (
                  <View key={c.id} style={[styles.conflictRow, { borderTopColor: colors.divider }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.conflictTitleBase, { color: colors.text }]} numberOfLines={1}>
                        {c.manualEvent?.title ?? "Manual"} ↔ {c.importedEvent?.title ?? "Imported"}
                      </Text>
                      <Text style={[styles.conflictSubBase, { color: colors.muted2 }]} numberOfLines={1}>
                        {(c.manualEvent?.startTime ? new Date(c.manualEvent.startTime).toLocaleString() : "—")} ·{" "}
                        {(c.importedEvent?.startTime ? new Date(c.importedEvent.startTime).toLocaleString() : "—")}
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => router.push("/(tabs)/conflicts")}
                      hitSlop={hitSlop}
                      style={({ pressed }) => [
                        styles.conflictMiniBtnBase,
                        {
                          backgroundColor: colors.miniBtnBg,
                          borderColor: colors.miniBtnBorder,
                        },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.conflictMiniBtnTextBase, { color: colors.text, fontSize: 12 * a11yScale }]}>
                        Odpri
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </View>

      {/* UPCOMING */}
      <View style={[styles.cardBase, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitleBase, { color: colors.text, fontSize: 16 * a11yScale }]}>
            Prihajajoči dogodki
          </Text>
          <Pressable
            onPress={() => router.push("/(tabs)/events")}
            hitSlop={hitSlop}
            style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
          >
            <Text style={[styles.ghostBtnTextBase, { color: colors.ghostText, fontSize: 13 * a11yScale }]}>
              Pregled vseh
            </Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 8 }}>
          {eventsLoading ? (
            <View style={styles.centerPad}>
              <ActivityIndicator />
              <Text style={[styles.mutedTextBase, { color: colors.muted2, fontSize: 14 * a11yScale }]}>
                Nalaganje…
              </Text>
            </View>
          ) : upcomingEvents.length === 0 ? (
            <View style={styles.centerPad}>
              <Text style={[styles.mutedTextBase, { color: colors.muted2, fontSize: 14 * a11yScale }]}>
                Ni prihajajočih dogodkov
              </Text>
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
                  onEdit={() => openEditToast(event)}
                  onDelete={(id: string) => deleteEventMutation.mutate(id)}
                />
              </View>
            ))
          )}
        </View>
      </View>

      <EventFormDialog open={showEventDialog} onOpenChange={setShowEventDialog} />

      {/* ✅ EDIT TOAST (CENTER) */}
      {editOpen && editEvent && (
        <Pressable
          style={[styles.toastOverlay, { backgroundColor: colors.overlay }]}
          onPress={() => !updateEventMutation.isPending && setEditOpen(false)}
        >
          <Pressable
            style={[
              styles.toastCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => {}}
          >
            <Text style={[styles.toastTitleBase, { color: colors.text, fontSize: 16 * a11yScale }]}>
              Uredi dogodek
            </Text>

            <Text style={[styles.toastLabelBase, { color: colors.muted2 }]}>Naslov</Text>
            <TextInput
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Naslov"
              placeholderTextColor={colors.placeholder}
              style={[
                styles.inputBase,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.inputText,
                  fontSize: 14 * a11yScale,
                },
              ]}
            />

            <Text style={[styles.toastLabelBase, { color: colors.muted2 }]}>Lokacija</Text>
            <TextInput
              value={editLocation}
              onChangeText={setEditLocation}
              placeholder="Lokacija (opcijsko)"
              placeholderTextColor={colors.placeholder}
              style={[
                styles.inputBase,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.inputText,
                  fontSize: 14 * a11yScale,
                },
              ]}
            />

            <Text style={[styles.toastLabelBase, { color: colors.muted2 }]}>Tip</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setEditType("personal")}
                hitSlop={hitSlop}
                style={[
                  styles.pillBase,
                  {
                    backgroundColor: editType === "personal" ? colors.primaryBg : colors.card,
                    borderColor: editType === "personal" ? colors.primaryBg : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pillTextBase,
                    {
                      color: editType === "personal" ? colors.primaryText : colors.text,
                      fontSize: 13 * a11yScale,
                    },
                  ]}
                >
                  Personal
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setEditType("study")}
                hitSlop={hitSlop}
                style={[
                  styles.pillBase,
                  {
                    backgroundColor: editType === "study" ? colors.primaryBg : colors.card,
                    borderColor: editType === "study" ? colors.primaryBg : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pillTextBase,
                    {
                      color: editType === "study" ? colors.primaryText : colors.text,
                      fontSize: 13 * a11yScale,
                    },
                  ]}
                >
                  Study
                </Text>
              </Pressable>
            </View>

            <View style={{ marginTop: 12 }}>
              <Text style={[styles.toastHintBase, { color: colors.muted2, fontSize: 12 * a11yScale }]} numberOfLines={2}>
                Čas: {new Date(editEvent.startTime).toLocaleString()} →{" "}
                {new Date(editEvent.endTime).toLocaleString()}
              </Text>
            </View>

            <View style={styles.toastActions}>
              <Pressable
                onPress={() => setEditOpen(false)}
                hitSlop={hitSlop}
                style={[
                  styles.toastBtnBase,
                  { backgroundColor: colors.btnBg, borderColor: colors.btnBorder, minHeight: 44 * a11yScale },
                ]}
                disabled={updateEventMutation.isPending}
              >
                <Text style={[styles.toastBtnTextBase, { color: colors.btnText, fontSize: 13 * a11yScale }]}>
                  Zapri
                </Text>
              </Pressable>

              <Pressable
                onPress={saveEdit}
                hitSlop={hitSlop}
                style={[
                  styles.toastBtnBase,
                  {
                    backgroundColor: colors.toastPrimaryBg,
                    borderColor: colors.toastPrimaryBg,
                    minHeight: 44 * a11yScale,
                    opacity: updateEventMutation.isPending || !editTitle.trim() ? 0.6 : 1,
                  },
                ]}
                disabled={updateEventMutation.isPending || !editTitle.trim()}
              >
                <Text style={[styles.toastPrimaryTextBase, { color: colors.toastPrimaryText, fontSize: 13 * a11yScale }]}>
                  {updateEventMutation.isPending ? "Shranjujem…" : "Shrani"}
                </Text>
              </Pressable>
            </View>

            {!!(updateEventMutation.error as any)?.message && (
              <Text style={[styles.toastErrorBase, { color: colors.error }]}>
                {(updateEventMutation.error as any)?.message}
              </Text>
            )}
          </Pressable>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bgBase: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },

  titleBase: { fontWeight: "800" },
  subtitleBase: { marginTop: 4 },

  refreshBtnBase: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshBtnTextBase: { fontWeight: "900" },

  primaryBtnBase: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryBtnTextBase: { fontWeight: "700" },
  pressed: { opacity: 0.75 },

  statsGrid: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  statCell: { width: "48%" },

  cardBase: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitleBase: { fontWeight: "800" },

  ghostBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  ghostBtnTextBase: { fontWeight: "700" },

  centerPad: { paddingVertical: 16, alignItems: "center", gap: 8 },
  mutedTextBase: {},

  conflictPillBase: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  conflictPillTextBase: { fontWeight: "900" },

  conflictRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
  },

  conflictTitleBase: { fontSize: 13, fontWeight: "900" },
  conflictSubBase: { marginTop: 2, fontSize: 12 },

  conflictMiniBtnBase: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  conflictMiniBtnTextBase: { fontWeight: "900" },

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

  toastTitleBase: { fontWeight: "900", marginBottom: 10 },
  toastLabelBase: { marginTop: 10, marginBottom: 6, fontSize: 12, fontWeight: "800" },
  toastHintBase: {},
  toastActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 },

  toastBtnBase: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  toastBtnTextBase: { fontWeight: "800" },
  toastPrimaryTextBase: { fontWeight: "900" },

  toastErrorBase: { marginTop: 10, fontWeight: "700" },

  inputBase: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  pillBase: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillTextBase: { fontWeight: "800" },
});
