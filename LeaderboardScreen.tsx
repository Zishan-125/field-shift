import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { FIELDS, RANKS } from "../data";
import { bandFor, bandStyle, colors } from "../theme";
import { Muted, Tap } from "../components/ui";

const PODIUM = [colors.amber, colors.text, colors.crimson];

export function LeaderboardScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const [by, setBy] = useState<"score" | "streak">("score");
  const rows = [...RANKS].sort((a, b) => b[by] - a[by] || b.score - a.score);
  const mine = new Set(FIELDS.map((f) => f.id));

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: "600" }}>🏆 Leaderboard</Text>
      <Muted style={{ marginBottom: 10 }}>Community field health</Muted>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        {(["score", "streak"] as const).map((k) => (
          <Tap key={k} selected={by === k} onPress={() => setBy(k)} style={{ paddingVertical: 8, paddingHorizontal: 16 }}>
            <Text style={{ color: by === k ? colors.cyan : colors.muted, fontSize: 12, fontWeight: "500" }}>{k === "score" ? "Score" : "Streak"}</Text>
          </Tap>
        ))}
      </View>
      {rows.map((r, i) => {
        const inWs = mine.has(r.fieldId);
        return (
          <Tap key={r.fieldId} disabled={!inWs} onPress={() => onOpen(r.fieldId)} style={{ marginBottom: 6 }} accessibilityLabel={`Rank ${i + 1}, ${r.name}, score ${r.score}`}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ width: 26, color: PODIUM[i] ?? colors.muted, fontWeight: "700", fontSize: 15 }}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: "500" }}>{r.name}</Text>
                <Muted>{r.handle}{r.streak > 0 ? `  🔥 ${r.streak}` : ""}</Muted>
              </View>
              <Text style={{ color: r.change > 0 ? colors.emerald : r.change < 0 ? colors.crimson : colors.muted, fontSize: 11, marginRight: 10 }}>
                {r.change > 0 ? `▲${r.change}` : r.change < 0 ? `▼${-r.change}` : "–"}
              </Text>
              <Text style={{ color: bandStyle[bandFor(r.score)].color, fontWeight: "600", fontSize: 15 }}>{r.score}</Text>
            </View>
          </Tap>
        );
      })}
    </ScrollView>
  );
}
