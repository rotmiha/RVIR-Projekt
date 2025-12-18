import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation } from "@tanstack/react-query";

import { api } from "./../lib/api";
import { queryClient } from "./../lib/queryClient";

type EventType = "study" | "personal";

interface EventFormData {
  title: string;
  type: EventType;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endDate: string; // YYYY-MM-DD
  endTime: string; // HH:mm
  location: string;
  description: string;
}

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<EventFormData>;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toDateString(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function toTimeString(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function EventFormDialog({ open, onOpenChange, defaultValues }: EventFormDialogProps) {
  const initialState: EventFormData = useMemo(
    () => ({
      title: defaultValues?.title ?? "",
      type: defaultValues?.type ?? "personal",
      startDate: defaultValues?.startDate ?? "",
      startTime: defaultValues?.startTime ?? "",
      endDate: defaultValues?.endDate ?? "",
      endTime: defaultValues?.endTime ?? "",
      location: defaultValues?.location ?? "",
      description: defaultValues?.description ?? "",
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open] // ko odpreš dialog, naj “pobere” defaultValues
  );

  const [formData, setFormData] = useState<EventFormData>(initialState);


  useEffect(() => {
  if (formData.startDate) {
    setFormData((p) => ({
      ...p,
      endDate: p.startDate,
    }));
  }
}, [formData.startDate]);


  useEffect(() => {
    if (open) setFormData(initialState);
  }, [open, initialState]);

  // native picker state
  const [picker, setPicker] = useState<null | {
    mode: "date" | "time";
    field: "start" | "end";
    value: Date;
  }>(null);

  const createEventMutation = useMutation({
    mutationFn: (data: {
      title: string;
      type: EventType;
      startTime: string;
      endTime: string;
      location?: string;
      description?: string;
    }) => api.createEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conflicts"] });

      Alert.alert("Event Created", "Your event has been added to the schedule.");
      onOpenChange(false);

      setFormData({
        title: "",
        type: "personal",
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
        location: "",
        description: "",
      });
    },
    onError: (error: any) => {
      Alert.alert("Error", error?.message ?? "Failed to create event. Please try again.");
    },
  });

  const close = () => onOpenChange(false);

  const submit = () => {
    if (!formData.title || !formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime) {
      Alert.alert("Validation Error", "Please fill in all required fields.");
      return;
    }

    const startISO = new Date(`${formData.startDate}T${formData.startTime}`).toISOString();
    const endISO = new Date(`${formData.endDate}T${formData.endTime}`).toISOString();

    createEventMutation.mutate({
      title: formData.title,
      type: formData.type,
      startTime: startISO,
      endTime: endISO,
      location: formData.location.trim() ? formData.location.trim() : undefined,
      description: formData.description.trim() ? formData.description.trim() : undefined,
    });
  };

  const openPicker = (field: "start" | "end", mode: "date" | "time") => {
    const base =
      field === "start"
        ? new Date(`${formData.startDate || toDateString(new Date())}T${formData.startTime || "09:00"}`)
        : new Date(`${formData.endDate || toDateString(new Date())}T${formData.endTime || "10:00"}`);

    setPicker({ field, mode, value: isNaN(base.getTime()) ? new Date() : base });
  };

  const onPick = (event: any, selected?: Date) => {
    // Android: dismiss event when canceled
    if (Platform.OS === "android") {
      setPicker(null);
    }
    if (!selected) return;

    const field = picker?.field;
    const mode = picker?.mode;
    if (!field || !mode) return; 

    if (field === "start") { 
      if (mode === "date") setFormData((p) => ({ ...p, startDate: toDateString(selected) }));
      else setFormData((p) => ({ ...p, startTime: toTimeString(selected) }));
    } else {
      if (mode === "date") setFormData((p) => ({ ...p, endDate: toDateString(selected) }));
      else setFormData((p) => ({ ...p, endTime: toTimeString(selected) }));
    }

    // iOS: ostane odprt dokler ne zapreš – tu ga lahko zapreš takoj
    if (Platform.OS === "ios") setPicker(null);
  };

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Dodaj dogodek</Text>
          <Text style={styles.subtitle}>
            Ustvarite nov dogodek v vašem urniku. Učni dogodki imajo prednost pred osebnimi dogodki.
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.label}>Naslov dogodka *</Text>
          <TextInput
            value={formData.title}
            onChangeText={(t) => setFormData((p) => ({ ...p, title: t }))}
            placeholder="npr., Predavanje TIDS"
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Tip dogodka *</Text>
          <View style={styles.segment}>
            <Pressable
              onPress={() => setFormData((p) => ({ ...p, type: "study" }))}
              style={[styles.segmentBtn, formData.type === "study" && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, formData.type === "study" && styles.segmentTextActive]}>Učenje</Text>
            </Pressable>
            <Pressable
              onPress={() => setFormData((p) => ({ ...p, type: "personal" }))}
              style={[styles.segmentBtn, formData.type === "personal" && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, formData.type === "personal" && styles.segmentTextActive]}>Osebni</Text>
            </Pressable>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Datum *</Text>
              <Pressable onPress={() => openPicker("start", "date")} style={styles.pickerBtn}>
                <Text style={styles.pickerBtnText}>{formData.startDate || "Izberi datum"}</Text>
              </Pressable>
            </View>

          </View>


           <View style={styles.row}>
           <View style={{ flex: 1 }}>
              <Text style={styles.label}>Čas začetka *</Text>
              <Pressable onPress={() => openPicker("start", "time")} style={styles.pickerBtn}>
                <Text style={styles.pickerBtnText}>{formData.startTime || "Izberi čas"}</Text>
              </Pressable>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Čas konca *</Text>
              <Pressable onPress={() => openPicker("end", "time")} style={styles.pickerBtn}>
                <Text style={styles.pickerBtnText}>{formData.endTime || "Izberi čas"}</Text>
              </Pressable>
            </View>
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Lokacija (Neobvezno)</Text>
          <TextInput
            value={formData.location}
            onChangeText={(t) => setFormData((p) => ({ ...p, location: t }))}
            placeholder="npr., Soba P1-02, Laboratorij Gama"
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Opis (Neobvezno)</Text>
          <TextInput
            value={formData.description}
            onChangeText={(t) => setFormData((p) => ({ ...p, description: t }))}
            placeholder="Dodajte dodatne podrobnosti..."
            style={[styles.input, styles.textarea]}
            multiline
          />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable onPress={close} style={[styles.btn, styles.btnOutline]}>
            <Text style={styles.btnOutlineText}>Prekliči</Text>
          </Pressable>

          <Pressable
            onPress={submit}
            disabled={createEventMutation.isPending}
            style={[styles.btn, styles.btnPrimary, createEventMutation.isPending && styles.btnDisabled]}
          >
            <Text style={styles.btnPrimaryText}>
              {createEventMutation.isPending ? "Shranjujem..." : "Shrani dogodek"}
            </Text>
          </Pressable>
        </View>

        {!!picker && (
          <DateTimePicker
            value={picker.value}
            mode={picker.mode}
            onChange={onPick}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            is24Hour
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fff" },

  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  subtitle: { marginTop: 6, color: "#475569", lineHeight: 18 },

  content: { paddingHorizontal: 20, paddingBottom: 16 },

  label: { fontSize: 13, fontWeight: "700", color: "#0f172a", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  textarea: { minHeight: 90, textAlignVertical: "top" },

  row: { flexDirection: "row", gap: 12, marginTop: 12 },

  pickerBtn: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  pickerBtnText: { color: "#0f172a", fontWeight: "600" },

  segment: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    overflow: "hidden",
  },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: "center" },
  segmentBtnActive: { backgroundColor: "#0f172a" },
  segmentText: { fontWeight: "700", color: "#0f172a" },
  segmentTextActive: { color: "#fff" },

  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
  },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  btnOutline: { borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff" },
  btnOutlineText: { fontWeight: "800", color: "#0f172a" },
  btnPrimary: { backgroundColor: "#0f172a" },
  btnPrimaryText: { fontWeight: "800", color: "#fff" },
  btnDisabled: { opacity: 0.6 },
});
