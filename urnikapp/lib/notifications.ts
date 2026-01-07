import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_SIG_KEY = "scheduled_events_signature_v1";
const STORAGE_IDS_KEY = "scheduled_events_notification_ids_v1";

// ✅ SDK 54 handler (brez deprecated shouldShowAlert)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("events", {
      name: "Events",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  return true;
}

const toMs = (v: any) => new Date(v).getTime();

function buildSignature(events: any[]) {
  // NOTE: events naj bodo že sortirani
  return (events ?? [])
    .map((e) => {
      const title = String(e.title ?? "").trim();
      return `${String(e.id)}:${toMs(e.startTime)}:${toMs(e.endTime)}:${title}`;
    })
    .join("|");
}

function triggerAt(date: Date) {
  // typing v expo-notifications je malo stricter, zato cast.
  return Platform.OS === "android"
    ? ({ date, channelId: "events" } as any)
    : ({ date } as any);
}

async function cancelPreviouslyScheduled() {
  const raw = await AsyncStorage.getItem(STORAGE_IDS_KEY);
  const ids: string[] = raw ? JSON.parse(raw) : [];

  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // ignore (če je že pobrisan)
    }
  }
}

export async function scheduleEventNotifications(events: any[]) {
  const now = Date.now();

  // ✅ samo prihodnji, sortirani, omejeni
  const upcoming = (events ?? [])
    .filter((e) => {
      const start = toMs(e.startTime);
      return !!start && !Number.isNaN(start) && start > now;
    })
    .sort((a, b) => toMs(a.startTime) - toMs(b.startTime))
    .slice(0, 20);

  // ✅ dedupe – če se ni nič spremenilo, ne delaj nič
  const signature = buildSignature(upcoming);
  const prevSignature = await AsyncStorage.getItem(STORAGE_SIG_KEY);
  if (prevSignature === signature) return;

  // ✅ pobriši samo naše prejšnje scheduled notificatione
  await cancelPreviouslyScheduled();

  const newIds: string[] = [];

  for (const ev of upcoming) {
    const start = toMs(ev.startTime);
    if (!start || Number.isNaN(start) || start <= now) continue;

    const title = String(ev.title ?? "Dogodek").trim() || "Dogodek";

    // 15 min prej
    const before = start - 15 * 60 * 1000;
    if (before > now) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Dogodek prihaja",
          body: `${title} se začne čez 15 minut.`,
          sound: true,
          data: { kind: "before", eventId: ev.id },
        },
        trigger: triggerAt(new Date(before)),
      });
      newIds.push(id);
    }

    // ob začetku
    {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Dogodek se je začel",
          body: title,
          sound: true,
          data: { kind: "start", eventId: ev.id },
        },
        trigger: triggerAt(new Date(start)),
      });
      newIds.push(id);
    }
  }

  await AsyncStorage.setItem(STORAGE_IDS_KEY, JSON.stringify(newIds));
  await AsyncStorage.setItem(STORAGE_SIG_KEY, signature);
}

// Optional helper: če hočeš “reset” (npr. logout)
export async function clearScheduledEventNotifications() {
  await cancelPreviouslyScheduled();
  await AsyncStorage.removeItem(STORAGE_IDS_KEY);
  await AsyncStorage.removeItem(STORAGE_SIG_KEY);
}
