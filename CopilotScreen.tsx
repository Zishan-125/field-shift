import React, { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { FIELDS, copilotReply } from "../data";
import { colors } from "../theme";
import { Muted, Tap } from "../components/ui";
import { useCachedState } from "../cache";

interface Msg { id: string; role: "user" | "ai"; text: string; cites?: ReturnType<typeof copilotReply>["citations"] }

export function CopilotScreen({ fieldId, onCitation }: { fieldId: string; onCitation: (id: string) => void }) {
  const field = FIELDS.find((f) => f.id === fieldId) ?? FIELDS[0];
  // Conversation is cached per field so it survives app restarts and lost signal.
  const [msgs, setMsgs] = useCachedState<Msg[]>(`chat:${field.id}`, []);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    const withUser = [...msgs, { id: `u${Date.now()}`, role: "user" as const, text: t }];
    setMsgs(withUser);
    setDraft("");
    setBusy(true);
    setTimeout(() => {
      const r = copilotReply(field);
      setMsgs([...withUser, { id: `a${Date.now()}`, role: "ai", text: r.text, cites: r.citations }]);
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }, 900);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16 }}>
        <Muted>{field.name}</Muted>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: 12 }}>Field Copilot</Text>
        {msgs.length === 0 && (
          <View style={{ gap: 8 }}>
            <Muted>Grounded in NASA data — every answer cites its satellite readings.</Muted>
            {["Why is this score what it is?", "Should I change my crop?"].map((p) => (
              <Tap key={p} onPress={() => send(p)}><Text style={{ color: colors.text, fontSize: 13 }}>{p}</Text></Tap>
            ))}
          </View>
        )}
        {msgs.map((m) => (
          <View key={m.id} style={{ alignItems: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}>
            <View style={{ maxWidth: "92%", padding: 12, borderRadius: 14, backgroundColor: m.role === "user" ? colors.cyan + "26" : colors.panel, borderWidth: 1, borderColor: m.role === "user" ? colors.cyan + "55" : colors.border }}>
              <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19 }}>{m.text}</Text>
            </View>
            {m.cites && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {m.cites.map((c) => (
                  <Tap key={c.label} onPress={() => onCitation(field.id)} style={{ minHeight: 44, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 }}
                    accessibilityLabel={`${c.label}, ${c.date}: ${c.value}`}>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{c.label} · {c.date}</Text>
                    <Text style={{ color: colors.text, fontSize: 11 }}>{c.value}</Text>
                  </Tap>
                ))}
              </View>
            )}
          </View>
        ))}
        {busy && <View accessibilityState={{ busy: true }} accessibilityLabel="Reading the latest signals"><Muted>Reading the latest signals…</Muted></View>}
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
        <TextInput
          value={draft} onChangeText={setDraft} editable={!busy} onSubmitEditing={() => send(draft)}
          placeholder="Ask about this field…" placeholderTextColor={colors.muted} accessibilityLabel="Ask the Copilot"
          style={{ flex: 1, minHeight: 44, color: colors.text, backgroundColor: colors.panel, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, opacity: busy ? 0.4 : 1 }}
        />
        <Tap disabled={busy || !draft.trim()} onPress={() => send(draft)} style={{ backgroundColor: colors.cyan, borderColor: colors.cyan, justifyContent: "center" }} accessibilityLabel="Send message">
          <Text style={{ color: colors.bg, fontWeight: "600" }}>Send</Text>
        </Tap>
      </View>
    </KeyboardAvoidingView>
  );
}
