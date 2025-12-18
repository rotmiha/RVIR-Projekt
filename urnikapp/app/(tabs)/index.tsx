import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ConflictAlert } from "@/components/conflict-alert";
import { EventFormDialog } from "@/components/event-form-dialog";
import { StatCard } from "@/components/stat-card";

export default function HomeScreen() {
  const [showEventDialog, setShowEventDialog] = useState(false);

  return (
    <ScrollView style={{ backgroundColor: "#fff" }} contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Dashboard</Text>
      <Text style={styles.subheading}>Overview of your schedule in Expo.</Text>

      {/* ... StatCards ... */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Create event</Text>
        <Text style={styles.sectionHint}>Opens a native modal; ready for API wiring.</Text>

        <Pressable style={styles.btn} onPress={() => setShowEventDialog(true)}>
          <Text style={styles.btnText}>Add event</Text>
        </Pressable>

        <EventFormDialog open={showEventDialog} onOpenChange={setShowEventDialog} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  heading: { fontSize: 28, fontWeight: "800", color: "#0f172a" },
  subheading: { color: "#475569", fontSize: 15, marginTop: 4, marginBottom: 16 },
  section: { marginTop: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  sectionHint: { color: "#475569", fontSize: 14, marginBottom: 8 },

  btn: { backgroundColor: "#0f172a", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "800" },
});
