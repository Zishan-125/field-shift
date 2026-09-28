import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { FIELDS, ROTATIONS, SIGNAL_LABEL } from "../data";
import { bandFor, bandStyle, colors } from "../theme";
import { Card, Muted, Tap } from "../components/ui";
import { ScoreRing } from "../components/ScoreRing";

const WATER = { low: colors.cyan, medium: colors.amber, high: colors.crimson } as const;

export function DetailScreen({ fieldId, onBack }: { fieldId: string; onBack: () => void }) {
  const field = FIELDS.find((f) => f.id === fieldId)!;
  const crops = ROTATIONS[fieldId] ?? [];
  const st = bandStyle[bandFor(field.score)];
  const [open, setOpen] = useState(true);
  const [pick, setPick] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const chosen = crops.find((c) => c.id === pick);

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Tap onPress={onBack} style={{ alignSelf: "flex-start", marginBottom: 12 }} accessibilityLabel="Back to fields">
        <Text style={{ color: colors.text, fontSize: 13 }}>← Fields</Text>
      </Tap>
      <Muted>{field.region}</Muted>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: 12 }}>{field.name}</Text>

      <Card glow={st.color}>
        <View style={{ alignItems: "center" }}>
          <ScoreRing score={field.score} />
          <Text style={{ color: st.color, fontWeight: "500", marginTop: 10 }}>{st.label}</Text>
          <Muted style={{ textAlign: "center", marginTop: 6, lineHeight: 18 }}>{field.summary}</Muted>
        </View>
      </Card>

      <Tap onPress={() => setOpen(!open)} style={{ marginTop: 12 }} accessibilityLabel="Toggle signal breakdown">
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "500" }}>Signal breakdown {open ? "▴" : "▾"}</Text>
      </Tap>
      {open && field.breakdown.map((b) => (
        <View key={b.signal} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View>
            <Text style={{ color: colors.text, fontSize: 13 }}>{SIGNAL_LABEL[b.signal]}</Text>
            <Muted>{b.raw} · {b.observedAt}</Muted>
          </View>
          <Text style={{ color: b.points >= 0 ? colors.emerald : colors.crimson, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
            {b.points >= 0 ? "+" : ""}{b.points} pts
          </Text>
        </View>
      ))}

      <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600", marginTop: 22, marginBottom: 8 }}>Rotation planner</Text>
      {confirmed && chosen ? (
        <Card glow={colors.emerald}>
          <Text style={{ color: colors.emerald, fontWeight: "600" }}>✓ Rotation plan confirmed</Text>
          <Muted style={{ marginTop: 4 }}>{field.name} → {chosen.crop}, planting {chosen.window.split(" – ")[0]}.</Muted>
          <Tap onPress={() => { setConfirmed(false); setPick(null); }} style={{ marginTop: 10 }}><Text style={{ color: colors.muted }}>Plan a different crop</Text></Tap>
        </Card>
      ) : (
        <>
          {crops.map((c) => {
            const bad = c.score < 40;
            return (
              <Tap key={c.id} disabled={bad} selected={pick === c.id} onPress={() => setPick(c.id)} style={{ marginBottom: 8 }}
                accessibilityLabel={`${c.crop}, suitability ${c.score}${bad ? ", not recommended" : ""}`}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: "500" }}>{c.crop}</Text>
                  <Text style={{ color: bandStyle[bandFor(c.score)].color, fontWeight: "600" }}>{c.score}</Text>
                </View>
                {bad ? <Text style={{ color: colors.crimson, fontSize: 11, marginTop: 4 }}>Not recommended this cycle</Text> : (
                  <>
                    <Muted style={{ marginTop: 4 }}>📅 {c.window}  <Text style={{ color: WATER[c.water] }}>💧 {c.water}</Text></Muted>
                    <Muted style={{ marginTop: 4, lineHeight: 17 }}>{c.rationale}</Muted>
                  </>
                )}
              </Tap>
            );
          })}
          <Tap disabled={!pick} onPress={() => setConfirmed(true)} style={{ backgroundColor: colors.cyan, borderColor: colors.cyan }} accessibilityLabel="Confirm rotation plan">
            <Text style={{ color: colors.bg, fontWeight: "600", textAlign: "center" }}>{chosen ? `Confirm ${chosen.crop}` : "Select a crop"}</Text>
          </Tap>
        </>
      )}
    </ScrollView>
  );
}
