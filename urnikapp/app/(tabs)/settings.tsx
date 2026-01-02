import { Pressable, Text, Alert, View } from "react-native";
import { debugPrintEvents, importWiseForUser } from "@/lib/wiseImport";
import { useAuth } from "@/components/AuthProvider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

export default function SettingsScreen() {
  const { user, logout } = useAuth(); // 👈 logout iz AuthProvider
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const TAB_HEIGHT = 62;
  const GAP = 8;
  const topPad = insets.top + GAP + TAB_HEIGHT + 12;

  async function onImport() {
    try {
      if (!user?.id) throw new Error("Ni userja");

      const programValue = String(user.program);
      const yearValue = String(user.year);

      console.log("Importing WISE for:", user.id, programValue, yearValue);
      const r = await importWiseForUser(user.id, programValue, yearValue);

      debugPrintEvents(user.id);

      Alert.alert("OK", `Uvoženih: ${r.imported} dogodkov`);
    } catch (e: any) {
      Alert.alert("Napaka", e?.message ?? "Import fail");
    }
  }

  function onLogout() {
    Alert.alert(
      "Odjava",
      "Ali se res želiš odjaviti?",
      [
        { text: "Prekliči", style: "cancel" },
        {
          text: "Odjava",
          style: "destructive",
          onPress: async () => {
            await logout();          // 👈 pobriše auth state
            router.replace("/login"); // 👈 redirect na login
          },
        },
      ]
    );
  }

  return (
    <View style={{ padding: 16, paddingTop: topPad, gap: 12 }}>
      {/* IMPORT WISE */}
      <Pressable
        onPress={onImport}
        style={{
          padding: 14,
          borderWidth: 1,
          borderRadius: 12,
          borderColor: "#0f172a",
        }}
      >
        <Text style={{ textAlign: "center", fontWeight: "700" }}>
          Import WISE urnik
        </Text>
      </Pressable>

      {/* LOGOUT */}
      <Pressable
        onPress={onLogout}
        style={{
          padding: 14,
          borderWidth: 1,
          borderRadius: 12,
          borderColor: "#dc2626",
          backgroundColor: "#fee2e2",
        }}
      >
        <Text
          style={{
            textAlign: "center",
            fontWeight: "700",
            color: "#dc2626",
          }}
        >
          Odjava
        </Text>
      </Pressable>
    </View>
  );
}
