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
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "./../lib/api";
import { useAuth } from "@/components/AuthProvider";

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
function addMinutes(d: Date, minutes: number) {
  return new Date(d.getTime() + minutes * 60 * 1000);
}

export function EventFormDialog({
  open,
  onOpenChange,
  defaultValues,
}: EventFormDialogProps) {
  const { user } = useAuth();
  const userId = user?.id;

  const queryClient = useQueryClient();

  const initialState: EventFormData = useMemo(() => {
    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setHours(9, 0, 0, 0);
    const defaultEnd = addMinutes(defaultStart, 60);

    return {
      title: defaultValues?.title ?? "",
      type: defaultValues?.type ?? "personal",
      startDate: defaultValues?.startDate ?? toDateString(defaultStart),
      startTime: defaultValues?.startTime ?? toTimeString(defaultStart),
      endDate: defaultValues?.endDate ?? toDateString(defaultEnd),
      endTime: defaultValues?.endTime ?? toTimeString(defaultEnd),
      location: defaultValues?.location ?? "",
      description: defaultValues?.description ?? "",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const [formData, setFormData] = useState<EventFormData>(initialState);

  // Ko se dialog odpre, naloži initialState
  useEffect(() => {
    if (open) setFormData(initialState);
  }, [open, initialState]);

  // Če uporabnik spremeni startDate, uskladi endDate (da ostane isti dan)
  useEffect(() => {
    if (!open) return;
    setFormData((p) => {
      if (!p.startDate) return p;
      if (p.endDate === p.startDate) return p;
      return { ...p, endDate: p.startDate };
    });
  }, [open, formData.startDate]);

  // native picker state
  const [picker, setPicker] = useState<null | {
    mode: "date" | "time";
    field: "start" | "end";
    value: Date;
  }>(null);

  const createEventMutation = useMutation({
    mutationFn: async (data: {
      userId: string;
      title: string;
      type: EventType;
      startTime: Number;
      endTime: Number;
      location?: string;
      description?: string;
    }) => {
      // če tvoj backend userId ne rabi, lahko ga ignorira
      return api.createEvent(data);
    },
    onSuccess: async () => {
      // ✅ Ključno: invalidiraj točno tisti key, ki ga uporablja CalendarScreen
      if (userId) {
        await queryClient.invalidateQueries({ queryKey: ["/api/events", userId] });
        await queryClient.refetchQueries({ queryKey: ["/api/events", userId] });
      } else {
        // fallback
        await queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/conflicts"] });

      Alert.alert("Dogodek ustvarjen", "Dogodek je bil uspešno dodan v vaš urnik.");
  
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-events", userId] });
      onOpenChange(false);

      setFormData(initialState);
    },
    onError: (error: any) => {
      Alert.alert("Napaka", error?.message ?? "Failed to create event. Please try again.");
    },
  });

  const close = () => onOpenChange(false);

  const submit = () => {
    try {
      if (!userId) {
        Alert.alert("Napaka", "Ni prijavljenega uporabnika.");
        return;
      }

      if (!formData.title.trim()) {
        Alert.alert("Validation Error", "Prosim vnesi naslov dogodka.");
        return;
      }

      if (!formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime) {
        Alert.alert("Validation Error", "Prosim izberi datum in čas začetka/konca.");
        return;
      }

      const start = new Date(`${formData.startDate}T${formData.startTime}:00`);
      const end = new Date(`${formData.endDate}T${formData.endTime}:00`);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        Alert.alert("Napaka", "Neveljaven datum/čas.");
        return;
      }

      if (end.getTime() <= start.getTime()) {
        Alert.alert("Napaka", "Čas konca mora biti po času začetka.");
        return;
      }

      createEventMutation.mutate({
        userId,
        title: formData.title.trim(),
        type: formData.type,
        startTime: start.getTime(), // ✅
        endTime: end.getTime(),     // ✅
        location: formData.location.trim() || undefined,
        description: formData.description.trim() || undefined,
      });
    } catch (e: any) {
      Alert.alert("Napaka", e?.message ?? "Neznana napaka.");
    }
  };

  const openPicker = (field: "start" | "end", mode: "date" | "time") => {
    const base =
      field === "start"
        ? new Date(`${formData.startDate}T${formData.startTime}:00`)
        : new Date(`${formData.endDate}T${formData.endTime}:00`);

    setPicker({ field, mode, value: isNaN(base.getTime()) ? new Date() : base });
  };

  const onPick = (_evt: any, selected?: Date) => {
    if (Platform.OS === "android") setPicker(null);
    if (!selected) return;

    const field = picker?.field;
    const mode = picker?.mode;
    if (!field || !mode) return;

    setFormData((p) => {
      let next = { ...p };

      if (field === "start") {
        if (mode === "date") next.startDate = toDateString(selected);
        else next.startTime = toTimeString(selected);

        // ✅ če end manjka ali je <= start, ga avtomatsko prestavi na +60min (isti dan)
        const start = new Date(`${next.startDate}T${next.startTime}:00`);
        const end = new Date(`${next.endDate}T${next.endTime}:00`);

        if (isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
          const newEnd = addMinutes(start, 60);
          next.endDate = toDateString(newEnd);
          next.endTime = toTimeString(newEnd);
        }
      } else {
        if (mode === "date") next.endDate = toDateString(selected);
        else next.endTime = toTimeString(selected);
      }

      return next;
    });

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
              <Text style={[styles.segmentText, formData.type === "study" && styles.segmentTextActive]}>
                Učenje
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setFormData((p) => ({ ...p, type: "personal" }))}
              style={[styles.segmentBtn, formData.type === "personal" && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, formData.type === "personal" && styles.segmentTextActive]}>
                Osebni
              </Text>
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
