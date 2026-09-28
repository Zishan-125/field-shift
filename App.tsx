import React, { useState } from "react";
import { Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { colors } from "./src/theme";
import { Tap } from "./src/components/ui";
import { FieldsScreen } from "./src/screens/FieldsScreen";
import { DetailScreen } from "./src/screens/DetailScreen";
import { CopilotScreen } from "./src/screens/CopilotScreen";
import { LeaderboardScreen } from "./src/screens/LeaderboardScreen";
import { useCachedState } from "./src/cache";
import { FIELDS } from "./src/data";

type Tab = "fields" | "copilot" | "ranks";
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "fields", label: "Fields", icon: "🛰️" },
  { id: "copilot", label: "Copilot", icon: "💬" },
  { id: "ranks", label: "Ranks", icon: "🏆" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("fields");
  const [fieldId, setFieldId] = useCachedState<string>("selectedField", FIELDS[0].id);
  const [detail, setDetail] = useState(false);

  const open = (id: string) => { setFieldId(id); setDetail(true); setTab("fields"); };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style="light" />
        <View style={{ flex: 1 }}>
          {tab === "fields" && (detail
            ? <DetailScreen key={fieldId} fieldId={fieldId} onBack={() => setDetail(false)} />
            : <FieldsScreen onOpen={open} offline={false} />)}
          {tab === "copilot" && <CopilotScreen key={fieldId} fieldId={fieldId} onCitation={open} />}
          {tab === "ranks" && <LeaderboardScreen onOpen={open} />}
        </View>
        <View accessibilityRole="tablist" style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.panel }}>
          {TABS.map((t) => (
            <Tap key={t.id} selected={tab === t.id} onPress={() => { setTab(t.id); if (t.id === "fields") setDetail(false); }}
              accessibilityLabel={t.label} style={{ flex: 1, borderWidth: 0, borderRadius: 0, alignItems: "center", backgroundColor: "transparent" }}>
              <Text style={{ fontSize: 18 }}>{t.icon}</Text>
              <Text style={{ fontSize: 10, color: tab === t.id ? colors.cyan : colors.muted }}>{t.label}</Text>
            </Tap>
          ))}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
