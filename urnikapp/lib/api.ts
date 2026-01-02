import { Platform } from "react-native";
import Constants from "expo-constants";

function getDevHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as any).expoConfig?.hostUri;

  return hostUri?.split(":")[0];
}

const DEV_PORT = 5000;

const HOST =
  Platform.OS === "android"
    ? "10.0.2.2"
    : getDevHost() || "localhost";

// ⚠️ priporočilo: uporabi HOST + port
export const BASE_URL = `http://192.168.0.102:5000`;

async function request<T>(
  path: string,
  options?: RequestInit,
  timeoutMs = 8000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${BASE_URL}${path}`;
    console.log("API:", options?.method ?? "GET", url);

    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
      signal: controller.signal,
    });

    const text = await res.text();

    if (!res.ok) {
      throw new Error(text || `HTTP ${res.status}`);
    }

    return (text ? JSON.parse(text) : null) as T;
  } finally {
    clearTimeout(timer);
  }
}

// ✅ VSE API FUNKCIJE NA ENEM MESTU
export const api = {
  // events
  getEvents: () =>
    request<{ events: any[] }>("/api/events").then((r) => r.events),

  getEventsForUser: (userId: string) =>
    request<{ events: any[] }>(
      `/api/events?userId=${encodeURIComponent(userId)}`
    ).then((r) => r.events),

  createEvent: (data: any) =>
    request("/api/events", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteEvent: (id: string) =>
    request(`/api/events/${id}`, { method: "DELETE" }),

  getConflicts: () =>
    request<any[]>("/api/conflicts"),
};
