import { Platform } from "react-native";
import Constants from "expo-constants";

function getDevHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as any).expoConfig?.hostUri;

  // npr. "192.168.1.25:8081"
  return hostUri?.split(":")[0];
}

// ✅ tvoj backend teče na 5000
const DEV_PORT = 5000;

// ✅ Android emulator -> PC localhost
// ✅ iOS simulator / Expo Go -> host iz Expo dev serverja (tvoj LAN IP)
const HOST =
  Platform.OS === "android"
    ? "10.0.2.2"
    : getDevHost() || "localhost";

export const BASE_URL = "http://164.8.207.1:5000";

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
    console.log("STATUS:", res.status);

    if (!res.ok) {
      throw new Error(text || `HTTP ${res.status}`);
    }

    return (text ? JSON.parse(text) : null) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  getEvents: () => request<any[]>("/api/events"),
  getConflicts: () => request<any[]>("/api/conflicts"),
  createEvent: (data: any) =>
    request("/api/events", { method: "POST", body: JSON.stringify(data) }),
  deleteEvent: (id: string) =>
    request(`/api/events/${id}`, { method: "DELETE" }),
};
