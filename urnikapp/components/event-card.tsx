import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";

type EventType = "study" | "personal";

interface EventCardProps {
  id: string;
  title: string;
  type: EventType;
  startTime: Date;
  endTime: Date;
  location?: string;
  hasConflict?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function EventCard({
  id,
  title,
  type,
  startTime,
  endTime,
  location,
  hasConflict,
  onEdit,
  onDelete,
}: EventCardProps) {
  return (
    <View style={[styles.card, hasConflict && styles.cardConflict]} accessibilityLabel={`event-${id}`}>
      <View style={styles.row}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>

            <View style={[styles.badge, type === "study" ? styles.badgeStudy : styles.badgePersonal]}>
              <Text style={[styles.badgeText, type === "study" ? styles.badgeTextStudy : styles.badgeTextPersonal]}>
                {type}
              </Text>
            </View>

            {hasConflict && (
              <View style={[styles.badge, styles.badgeConflict]}>
                <Text style={[styles.badgeText, styles.badgeTextConflict]}>Conflict</Text>
              </View>
            )}
          </View>

          <View style={styles.meta}>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={16} color="#64748b" />
              <Text style={styles.metaText}>
                {format(startTime, "HH:mm")} - {format(endTime, "HH:mm")}
              </Text>
            </View>

            {!!location && (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={16} color="#64748b" />
                <Text style={styles.metaText} numberOfLines={1}>
                  {location}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => onEdit?.(id)}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="edit"
          >
            <Ionicons name="pencil-outline" size={18} color="#0f172a" />
          </Pressable>

          <Pressable
            onPress={() => onDelete?.(id)}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="delete"
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 14,
  },
  cardConflict: {
    borderLeftWidth: 4,
    borderLeftColor: "#ef4444",
  },

  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },

  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: "700", color: "#0f172a" },

  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 12, fontWeight: "700" },

  badgeStudy: { backgroundColor: "#0f172a" },
  badgeTextStudy: { color: "#fff" },

  badgePersonal: { backgroundColor: "#e2e8f0" },
  badgeTextPersonal: { color: "#0f172a" },

  badgeConflict: { backgroundColor: "#fee2e2" },
  badgeTextConflict: { color: "#991b1b" },

  meta: { gap: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { color: "#64748b", fontSize: 13, flexShrink: 1 },

  actions: { flexDirection: "row", gap: 6 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  pressed: { opacity: 0.6 },
});
