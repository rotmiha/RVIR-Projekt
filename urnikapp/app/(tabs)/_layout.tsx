import { Tabs, Redirect } from "expo-router";
import React from "react";
import { AntDesign, MaterialIcons } from "@expo/vector-icons";
import { useAuth } from "@/components/AuthProvider";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
  const { user, isReady } = useAuth();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();

  if (!isReady) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,

        tabBarLabelStyle: {
          fontSize: 12,
          marginTop: -2,
          marginBottom: 2,
        },

        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 0,
          elevation: 12,

          position: "absolute",
          left: 12,
          right: 12,

          // ✅ to je ključno: tab bar je tik nad sistemskim “gesture/nav” delom
            top: insets.top + 8,

          borderRadius: 18,

          // ✅ normalna višina (ne požre cele spodnje površine)
          height: 62,

          paddingTop: 6,
          paddingBottom: 6,
        },

        tabBarActiveTintColor: "#0A84FF",
        tabBarInactiveTintColor: "#9AA0A6",
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Domov",
          tabBarIcon: ({ color }) => <MaterialIcons name="home" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Koledar",
          tabBarIcon: ({ color }) => <MaterialIcons name="calendar-today" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="conflicts"
        options={{
          title: "Conflikti",
          tabBarIcon: ({ color }) => (
            <AntDesign name="exclamation" size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="events"
        options={{
          title: "Dogodki",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="format-list-bulleted" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Nastavitve",
          tabBarIcon: ({ color }) => <MaterialIcons name="settings" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}
