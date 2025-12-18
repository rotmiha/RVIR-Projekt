import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";

export type CalendarEvent = {
  id: string;
  title: string;
  type: "učenje" | "osebno";
  startTime: Date;
  endTime: Date;
  location?: string;
};

type WeekCalendarProps = {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
};

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);
const DAYS = ["Pon", "Tor", "Sre", "Čet", "Pet", "Sob", "Ned"];

// Layout constants (px-ish)
const ROW_H = 60;
const TIME_COL_W = 58;
const DAY_COL_W = 120;

export function WeekCalendar({ events, onEventClick }: WeekCalendarProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });

  const weekRangeLabel = useMemo(() => {
    return `${format(weekStart, "MMM d")} - ${format(addDays(weekStart, 6), "MMM d, yyyy")}`;
  }, [weekStart]);

  const eventsByDay = useMemo(() => {
    return DAYS.map((_, index) => {
      const date = addDays(weekStart, index);
      return events.filter((e) => isSameDay(e.startTime, date));
    });
  }, [events, weekStart]);

  const getEventPosition = (event: CalendarEvent) => {
    const hour = event.startTime.getHours();
    const minute = event.startTime.getMinutes();

    const topHours = (hour - 7) + minute / 60;
    const top = topHours * ROW_H;

    const durationMin =
      (event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60);
    const height = Math.max(18, (durationMin / 60) * ROW_H); // min height for tap

    return { top, height };
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.cardTitle}>Tedenski urnik</Text>

        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setCurrentWeek(addDays(currentWeek, -7))}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="prev-week"
          >
            <Ionicons name="chevron-back" size={18} color="#0f172a" />
          </Pressable>

          <Text style={styles.weekLabel} numberOfLines={1}>
            {weekRangeLabel}
          </Text>

          <Pressable
            onPress={() => setCurrentWeek(addDays(currentWeek, 7))}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="next-week"
          >
            <Ionicons name="chevron-forward" size={18} color="#0f172a" />
          </Pressable>
        </View>
      </View>

      {/* Body */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ width: TIME_COL_W + DAY_COL_W * 7 }}>
          {/* Top row (days) */}
          <View style={styles.topRow}>
            <View style={[styles.topCell, { width: TIME_COL_W }]}>
              <Text style={styles.topMuted}>Čas</Text>
            </View>

            {DAYS.map((day, index) => {
              const date = addDays(weekStart, index);
              return (
                <View
                  key={day}
                  style={[
                    styles.topCell,
                    styles.dayHeaderCell,
                    { width: DAY_COL_W },
                  ]}
                >
                  <Text style={styles.dayName}>{day}</Text>
                  <Text style={styles.dayNumber}>{format(date, "d")}</Text>
                </View>
              );
            })}
          </View>

          {/* Grid */}
          <View style={styles.gridWrap}>
            {/* Time column */}
            <View style={{ width: TIME_COL_W }}>
              {HOURS.map((hour) => (
                <View key={hour} style={[styles.timeCell, { height: ROW_H }]}>
                  <Text style={styles.timeText}>
                    {String(hour).padStart(2, "0")}:00
                  </Text>
                </View>
              ))}
            </View>

            {/* Days columns */}
            {DAYS.map((_, dayIndex) => {
              const dayEvents = eventsByDay[dayIndex] || [];

              return (
                <View
                  key={dayIndex}
                  style={[styles.dayCol, { width: DAY_COL_W, height: HOURS.length * ROW_H }]}
                >
                  {/* hour rows */}
                  {HOURS.map((hour) => (
                    <View
                      key={hour}
                      style={[styles.hourCell, { height: ROW_H }]}
                    />
                  ))}

                  {/* events absolute */}
                  {dayEvents.map((event) => {
                    const { top, height } = getEventPosition(event);
                    const isStudy = event.type === "učenje";

                    return (
                      <Pressable
                        key={event.id}
                        onPress={() => onEventClick?.(event)}
                        style={({ pressed }) => [
                          styles.eventBox,
                          {
                            top,
                            height,
                            backgroundColor: isStudy ? "#0f172a" : "#e2e8f0",
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: isStudy ? "rgba(255,255,255,0.18)" : "#fff" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              { color: isStudy ? "#fff" : "#0f172a" },
                            ]}
                            numberOfLines={1}
                          >
                            {event.type}
                          </Text>
                        </View>

                        <Text
                          style={[
                            styles.eventTitle,
                            { color: isStudy ? "#fff" : "#0f172a" },
                          ]}
                          numberOfLines={1}
                        >
                          {event.title}
                        </Text>

                        {!!event.location && (
                          <Text
                            style={[
                              styles.eventLocation,
                              { color: isStudy ? "rgba(255,255,255,0.85)" : "#64748b" },
                            ]}
                            numberOfLines={1}
                          >
                            {event.location}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    backgroundColor: "#fff",
    overflow: "hidden",
  },

  header: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },

  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  weekLabel: { fontSize: 13, fontWeight: "700", color: "#0f172a", minWidth: 140, textAlign: "center" },

  topRow: { flexDirection: "row" },
  topCell: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  dayHeaderCell: { borderLeftWidth: 1, borderLeftColor: "#e2e8f0" },
  topMuted: { fontSize: 12, fontWeight: "700", color: "#64748b" },
  dayName: { fontSize: 12, fontWeight: "800", color: "#0f172a" },
  dayNumber: { fontSize: 12, color: "#64748b", marginTop: 2 },

  gridWrap: { flexDirection: "row" },

  timeCell: {
    paddingHorizontal: 8,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  timeText: { fontSize: 12, color: "#64748b" },

  dayCol: {
    borderLeftWidth: 1,
    borderLeftColor: "#e2e8f0",
    position: "relative",
    backgroundColor: "#fff",
  },
  hourCell: {
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },

  eventBox: {
    position: "absolute",
    left: 6,
    right: 6,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    overflow: "hidden",
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  badgeText: { fontSize: 10, fontWeight: "800" },
  eventTitle: { fontSize: 12, fontWeight: "800" },
  eventLocation: { fontSize: 10, marginTop: 2 },

  pressed: { opacity: 0.7 },
});
