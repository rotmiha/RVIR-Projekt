import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  addDays,
  format,
  isSameDay,
  startOfWeek,
  differenceInCalendarDays,
} from "date-fns";

/* ================= TYPES ================= */

export type CalendarEvent = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  location?: string;

  color: string;
  badgeLabel: string;
};

type WeekCalendarProps = {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
};

/* ================= CONSTANTS ================= */

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07..20
const DAYS = ["Pon", "Tor", "Sre", "Čet", "Pet", "Sob", "Ned"];

const ROW_H = 60; // keep stable; overlap layout handles cramped space
const TIME_COL_W = 58;
const DAY_COL_W_WEEK = 400;

type ViewMode = "week" | "day";

/* ================= HELPERS ================= */

const minutesFromStart = (d: Date) => {
  const h = d.getHours();
  const m = d.getMinutes();
  return (h - 7) * 60 + m; // 07:00 = 0
};

type LaidOut = CalendarEvent & {
  top: number;
  height: number;
  col: number;
  cols: number;
};

function layoutDayEvents(dayEvents: CalendarEvent[], dayColW: number): LaidOut[] {
  // 1) sort
  const ev = [...dayEvents].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );

  // 2) group into conflict clusters
  const groups: CalendarEvent[][] = [];
  let current: CalendarEvent[] = [];
  let groupEnd = -Infinity;

  for (const e of ev) {
    const s = e.startTime.getTime();
    const en = e.endTime.getTime();

    if (current.length === 0) {
      current = [e];
      groupEnd = en;
      continue;
    }

    if (s < groupEnd) {
      current.push(e);
      groupEnd = Math.max(groupEnd, en);
    } else {
      groups.push(current);
      current = [e];
      groupEnd = en;
    }
  }
  if (current.length) groups.push(current);

  // 3) within each group assign columns greedily
  const out: LaidOut[] = [];
  const SIDE_PAD = 6;
  const GUTTER = 6;

  for (const g of groups) {
    const colsEnd: number[] = []; // end times per column (ms)
    const placed: { e: CalendarEvent; col: number }[] = [];

    const sorted = [...g].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    for (const e of sorted) {
      const s = e.startTime.getTime();
      const en = e.endTime.getTime();

      let placedCol = -1;
      for (let i = 0; i < colsEnd.length; i++) {
        if (s >= colsEnd[i]) {
          placedCol = i;
          break;
        }
      }
      if (placedCol === -1) {
        colsEnd.push(en);
        placedCol = colsEnd.length - 1;
      } else {
        colsEnd[placedCol] = en;
      }

      placed.push({ e, col: placedCol });
    }

    const totalCols = colsEnd.length;

    // 4) compute pixel rects
    const usableW = dayColW - SIDE_PAD * 2;
    const colW = (usableW - GUTTER * (totalCols - 1)) / totalCols;

    for (const p of placed) {
      const startMin = minutesFromStart(p.e.startTime);
      const endMin = minutesFromStart(p.e.endTime);
      const durMin = Math.max(10, endMin - startMin);

      const top = (startMin / 60) * ROW_H;
      const height = Math.max(22, (durMin / 60) * ROW_H);

      out.push({
        ...p.e,
        top,
        height,
        col: p.col,
        cols: totalCols,
      });
    }
  }

  return out;
}




/* ================= COMPONENT ================= */

export function WeekCalendar({ events, onEventClick }: WeekCalendarProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();

  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [mode, setMode] = useState<ViewMode>("day");
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
    const diff = differenceInCalendarDays(new Date(), ws);
    return Math.min(6, Math.max(0, diff));
  });

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const selectedDate = useMemo(
    () => addDays(weekStart, selectedDayIndex),
    [weekStart, selectedDayIndex]
  );

  // width
  const horizontalPadding = 24;
  const dayColW =
    mode === "day"
      ? Math.max(260, screenW - TIME_COL_W - horizontalPadding)
      : DAY_COL_W_WEEK;

  const columnsCount = mode === "day" ? 1 : 7;
  const gridWidth = TIME_COL_W + dayColW * columnsCount;
  const gridHeight = HOURS.length * ROW_H;

  // IMPORTANT: give internal scroll a fixed height so it doesn't get cut / doesn't fight parent scroll
  const calendarViewportH = Math.max(360, Math.min(620, Math.floor(screenH * 0.68)));

  const headerLabel =
    mode === "week"
      ? `${format(weekStart, "MMM d")} - ${format(
          addDays(weekStart, 6),
          "MMM d, yyyy"
        )}`
      : `${DAYS[selectedDayIndex]}, ${format(selectedDate, "d. MMM yyyy")}`;

  const eventsByDay = useMemo(() => {
    if (mode === "day") {
      return [events.filter((e) => isSameDay(e.startTime, selectedDate))];
    }
    return DAYS.map((_, i) => {
      const date = addDays(weekStart, i);
      return events.filter((e) => isSameDay(e.startTime, date));
    });
  }, [events, weekStart, mode, selectedDate]);

  // ✅ compute layout per day with overlap columns
  const laidOutByDay = useMemo(() => {
    return eventsByDay.map((dayEvents) => layoutDayEvents(dayEvents, dayColW));
  }, [eventsByDay, dayColW]);

  const goPrev = () => {
    if (mode === "week") return setCurrentWeek(addDays(currentWeek, -7));
    if (selectedDayIndex === 0) {
      setCurrentWeek(addDays(currentWeek, -7));
      setSelectedDayIndex(6);
    } else setSelectedDayIndex((d) => d - 1);
  };

  const goNext = () => {
    if (mode === "week") return setCurrentWeek(addDays(currentWeek, 7));
    if (selectedDayIndex === 6) {
      setCurrentWeek(addDays(currentWeek, 7));
      setSelectedDayIndex(0);
    } else setSelectedDayIndex((d) => d + 1);
  };

  return (
    <View style={styles.card}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.cardTitle}>Urnik</Text>

        <View style={styles.headerRight}>
          <Pressable onPress={goPrev} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={18} color="#0f172a" />
          </Pressable>

          <Text style={styles.headerLabel} numberOfLines={1}>
            {headerLabel}
          </Text>

          <Pressable onPress={goNext} style={styles.iconBtn}>
            <Ionicons name="chevron-forward" size={18} color="#0f172a" />
          </Pressable>

          <Pressable
            onPress={() => setMode((m) => (m === "week" ? "day" : "week"))}
            style={styles.modeBtn}
          >
            <Text style={styles.modeBtnText}>
              {mode === "week" ? "Dan" : "Teden"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* GRID */}
      <ScrollView
        horizontal={mode === "week"}
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* ✅ fixed height viewport + vertical scroll inside */}
        <ScrollView
          style={{ height: calendarViewportH }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          contentContainerStyle={{ paddingBottom: 120 }} // extra so bottom never feels cut
        >
          <View style={{ width: gridWidth }}>
            {/* TOP ROW */}
            <View style={styles.topRow}>
              <View style={[styles.topCell, { width: TIME_COL_W }]}>
                <Text style={styles.topMuted}>Čas</Text>
              </View>

              {mode === "week" ? (
                DAYS.map((day, index) => {
                  const date = addDays(weekStart, index);
                  return (
                    <Pressable
                      key={day}
                      onPress={() => setSelectedDayIndex(index)}
                      style={[
                        styles.topCell,
                        styles.dayHeaderCell,
                        { width: dayColW },
                      ]}
                    >
                      <Text style={styles.dayName}>{day}</Text>
                      <Text style={styles.dayNumber}>{format(date, "d")}</Text>
                    </Pressable>
                  );
                })
              ) : (
                <View
                  style={[
                    styles.topCell,
                    styles.dayHeaderCell,
                    { width: dayColW },
                  ]}
                >
                  <Text style={styles.dayName}>{DAYS[selectedDayIndex]}</Text>
                  <Text style={styles.dayNumber}>{format(selectedDate, "d")}</Text>
                </View>
              )}
            </View>

            {/* BODY */}
            <View style={styles.gridWrap}>
              {/* TIME COL */}
              <View style={{ width: TIME_COL_W }}>
                {HOURS.map((h) => (
                  <View key={h} style={[styles.timeCell, { height: ROW_H }]}>
                    <Text style={styles.timeText}>
                      {String(h).padStart(2, "0")}:00
                    </Text>
                  </View>
                ))}
              </View>

              {/* DAY COLS */}
              {laidOutByDay.map((dayEvents, colIndex) => (
                <View
                  key={colIndex}
                  style={[styles.dayCol, { width: dayColW, height: gridHeight }]}
                >
                  {HOURS.map((h) => (
                    <View key={h} style={[styles.hourCell, { height: ROW_H }]} />
                  ))}

                  {dayEvents.map((event) => {
                    const SIDE_PAD = 6;
                    const GUTTER = 6;
                    const usableW = dayColW - SIDE_PAD * 2;
                    const colW =
                      (usableW - GUTTER * (event.cols - 1)) / event.cols;

                    const left = SIDE_PAD + event.col * (colW + GUTTER);

                    // little compact mode if short
                    const compact = event.height < 60;

                    return (
                      <Pressable
                        key={event.id}
                        onPress={() => onEventClick?.(event)}
                        style={[
                          styles.eventBox,
                          {
                            top: event.top,
                            height: event.height,
                            left,
                            width: colW,
                            backgroundColor: event.color,
                          },
                        ]}
                      >
                        <View style={styles.badge}>
                          <Text style={styles.badgeText} numberOfLines={1}>
                            {event.badgeLabel}
                          </Text>
                        </View>

                        <Text
                          style={styles.eventTitle}
                          numberOfLines={compact ? 1 : 2}
                        >
                          {event.title}
                        </Text>

                        {!!event.location && !compact && (
                          <Text style={styles.eventLocation} numberOfLines={1}>
                            {event.location}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

/* ================= STYLES ================= */

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

  headerRight: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },

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

  headerLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    minWidth: 0,
  },

  modeBtn: {
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    minWidth: 72,
  },
  modeBtnText: { fontSize: 12, fontWeight: "800", color: "#0f172a" },

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

  hourCell: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },

  eventBox: {
    position: "absolute",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    overflow: "hidden",
  },

  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  badgeText: { fontSize: 10, fontWeight: "900", color: "#fff" },

  eventTitle: { fontSize: 13, fontWeight: "900", color: "#fff" },
  eventLocation: { fontSize: 11, marginTop: 2, color: "rgba(255,255,255,0.9)" },
});
