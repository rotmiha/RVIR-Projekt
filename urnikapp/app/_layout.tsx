import "@/lib/cryptoInit";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/components/AuthProvider";
import { initDb } from "@/lib/db";
import { SettingsProvider, useSettings } from "@/components/settingsProvider";

function ThemedStack() {
  const { resolvedTheme } = useSettings();
  const bg = resolvedTheme === "dark" ? "#0b1220" : "#ffffff";

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: bg }, // ✅ global background
      }}
    />
  );
}

export default function RootLayout() {
  useEffect(() => {
    initDb();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <AuthProvider>
          <ThemedStack />
        </AuthProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}
