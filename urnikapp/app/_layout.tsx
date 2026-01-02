import "@/lib/cryptoInit";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/components/AuthProvider";
import { initDb } from "@/lib/db";

export default function RootLayout() {
  useEffect(() => {
    initDb();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#fff" } }} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
