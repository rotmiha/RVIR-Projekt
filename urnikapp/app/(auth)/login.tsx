import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import { loginUser, registerUser } from "@/lib/authlib";
import { useAuth } from "@/components/AuthProvider";

type ProgramLevel = "undergrad" | "master" | "phd" | "other";

const PROGRAMS: { value: string; label: string; level: ProgramLevel }[] = [
  { value: "0", label: "", level: "other" },
  { value: "1", label: "ELEKTROTEHNIKA (BU10)", level: "undergrad" },
  { value: "2", label: "ELEKTROTEHNIKA (BV10)", level: "undergrad" },
  { value: "29", label: "INFORMATIKA IN PODATKOVNE TEHNOLOGIJE (BU80)", level: "undergrad" },
  { value: "8", label: "INFORMATIKA IN TEHNOLOGIJE KOMUNICIRANJA (BV30)", level: "undergrad" },
  { value: "10", label: "MEDIJSKE KOMUNIKACIJE (BU50)", level: "undergrad" },
  { value: "11", label: "RAČUNALNIŠTVO IN INFORMACIJSKE TEHNOLOGIJE (BU20)", level: "undergrad" },
  { value: "12", label: "RAČUNALNIŠTVO IN INFORMACIJSKE TEHNOLOGIJE (BV20)", level: "undergrad" },
  { value: "16", label: "TELEKOMUNIKACIJE (BU40)", level: "undergrad" },
  { value: "17", label: "MEHATRONIKA (BU70)", level: "undergrad" },
  { value: "26", label: "MEHATRONIKA (BV70)", level: "undergrad" },

  { value: "18", label: "MEHATRONIKA (BMM7) - 2. stopnja", level: "master" },
  { value: "19", label: "ELEKTROTEHNIKA (BM10) - 2. stopnja", level: "master" },
  { value: "30", label: "INFORMATIKA IN PODATKOVNE TEHNOLOGIJE (BM80) - 2. stopnja", level: "master" },
  { value: "22", label: "MEDIJSKE KOMUNIKACIJE (BM50) - 2. stopnja", level: "master" },
  { value: "23", label: "RAČUNALNIŠTVO IN INFORMACIJSKE TEHNOLOGIJE (BM20) - 2. stopnja", level: "master" },
  { value: "24", label: "TELEKOMUNIKACIJE (BM40) - 2. stopnja", level: "master" },

  { value: "28", label: "ERASMUS", level: "other" },
  { value: "31", label: "KOOD", level: "other" },
  { value: "33", label: "DOKTORSKI ŠTUDIJ", level: "phd" },
];

function yearsForLevel(level: ProgramLevel) {
  if (level === "undergrad") return ["1", "2", "3"];
  if (level === "master") return ["1", "2"];
  if (level === "phd") return ["1", "2", "3"];
  return ["1"];
}

function programValueToLabel(value: string): string {
  const p = PROGRAMS.find((x) => x.value === value);
  return p?.label ?? value;
}

export default function LoginScreen() {
  const { setLoggedIn } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [program, setProgram] = useState("0");
  const [year, setYear] = useState("1");

  const [loading, setLoading] = useState(false);

  const selectedLevel = useMemo<ProgramLevel>(() => {
    const p = PROGRAMS.find((x) => x.value === program);
    return p?.level ?? "other";
  }, [program]);

  const yearOptions = useMemo(() => yearsForLevel(selectedLevel), [selectedLevel]);

      async function onSubmit() {
        try {
          setLoading(true);

          if (mode === "register") {
            if (!username.trim()) throw new Error("Vpiši uporabniško ime");
            if (password.length < 6) throw new Error("Geslo naj bo vsaj 6 znakov");
            if (program === "0") throw new Error("Izberi študijski program");


            const programLabel = programValueToLabel(program);

            console.log("Registering with:", username, email, password, programLabel, year);
            await registerUser(username, email, password, programLabel, year);

            Alert.alert("OK", "Registracija uspešna. Zdaj se prijavi.");
            setMode("login");
            return;
          }

          const user = await loginUser(email, password);
          await setLoggedIn(user);
          router.replace("/(tabs)/dashboard");
        } catch (e: any) {
          Alert.alert("Napaka", e?.message ?? "Nekaj je šlo narobe");
        } finally {
          setLoading(false);
        }
}

  return (
    <View style={{ flex: 1, padding: 16, gap: 12, justifyContent: "center" }}>
      <Text style={{ fontSize: 28, fontWeight: "700" }}>
        {mode === "login" ? "Login" : "Registracija"}
      </Text>

      {mode === "register" && (
        <TextInput
          placeholder="Uporabniško ime"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
        />
      )}

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
      />

      <TextInput
        placeholder="Geslo"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
      />

      {mode === "register" && (
        <>
          <View style={{ borderWidth: 1, borderRadius: 10, overflow: "hidden" }}>
            <Picker selectedValue={program} onValueChange={(v) => setProgram(String(v))}>
              {PROGRAMS.map((p) => (
                <Picker.Item key={p.value} label={p.label} value={p.value} />
              ))}
            </Picker>
          </View>

          <View style={{ borderWidth: 1, borderRadius: 10, overflow: "hidden" }}>
            <Picker selectedValue={year} onValueChange={(v) => setYear(String(v))}>
              {yearOptions.map((y) => (
                <Picker.Item key={y} label={`Letnik ${y}`} value={y} />
              ))}
            </Picker>
          </View>
        </>
      )}

      <Pressable
        disabled={loading}
        onPress={onSubmit}
        style={{
          padding: 14,
          borderRadius: 10,
          borderWidth: 1,
          opacity: loading ? 0.6 : 1,
        }}
      >
        <Text style={{ textAlign: "center", fontWeight: "700" }}>
          {mode === "login" ? "Login" : "Ustvari račun"}
        </Text>
      </Pressable>

      <Pressable disabled={loading} onPress={() => setMode(mode === "login" ? "register" : "login")}>
        <Text style={{ textAlign: "center" }}>
          {mode === "login" ? "Nimam računa → Register" : "Imam račun → Login"}
        </Text>
      </Pressable>

        {loading && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.25)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              style={{
                backgroundColor: "#fff",
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                elevation: 8,
              }}
            >
              <ActivityIndicator />
              <Text style={{ fontSize: 15, fontWeight: "600" }}>
                {mode === "login" ? "Prijavljam..." : "Registriram..."}
              </Text>
            </View>
          </View>
        )}
    </View>
  );
}
