import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { FIELDS } from "../data";
import { bandFor, bandStyle, colors } from "../theme";
import { Muted, Skeleton, Tap } from "../components/ui";

export function FieldsScreen({ onOpen, offline }: { onOpen: (id: string) => void; offline: boolean }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 350); return () => clearTimeout(t); }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: "600" }}>Your fields</Text>
      <Muted style={{ marginBottom: 14 }}>{offline ? "Offline · showing cached signals from 06:00 UTC" : "Live · synced 06:00 UTC"}</Muted>
      {loading
        ? [0, 1, 2, 3].map((i) => <Skeleton key={i} h={68} />)
        : FIELDS.map((f) => {
            const st = bandStyle[bandFor(f.score)];
            return (
              <Tap key={f.id} onPress={() => onOpen(f.id)} style={{ marginBottom: 8 }} accessibilityLabel={`${f.name}, Shift Score ${f.score}, ${st.label}`}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: st.color, marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: "500" }}>{f.name}</Text>
                    <Muted>{f.region} · {f.crop}</Muted>
                  </View>
                  <Text style={{ color: st.color, fontSize: 18, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{f.score}</Text>
                </View>
              </Tap>
            );
          })}
    </ScrollView>
  );
}
