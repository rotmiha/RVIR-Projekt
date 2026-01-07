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

// ⚠️ trenutno imaš hardcoded IP – OK za zdaj
export const BASE_URL = `http://164.8.207.68:5000`; 

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
  // legacy / generic
  getEvents: () =>
    request<{ events: any[] }>("/api/events").then((r) => r.events),

  getEventsForUser: (userId: string) =>
    request<{ events: any[] }>(
      `/api/events?userId=${encodeURIComponent(userId)}`
    ).then((r) => r.events),

  // ✅ NOVO: calendar (shared + personal)
    getCalendarEvents: (userId: string, program: string, year: string) =>
      request<any[]>(
        `/api/calendar-events?userId=${encodeURIComponent(userId)}&program=${encodeURIComponent(program)}&year=${encodeURIComponent(year)}`
      ),

  // events CRUD
  createEvent: (data: any) =>
    request("/api/events", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteEvent: (id: string) =>
    request(`/api/events/${id}`, { method: "DELETE" }),

  // misc
  getConflicts: () =>
    request<any[]>("/api/conflicts"),
};
