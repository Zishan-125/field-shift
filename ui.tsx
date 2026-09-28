import React from "react";
import { Pressable, PressableProps, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors } from "../theme";

export function Card({ children, glow }: { children: React.ReactNode; glow?: string }) {
  return (
    <View style={[s.card, glow ? { borderColor: glow + "66", shadowColor: glow, shadowOpacity: 0.35, shadowRadius: 14 } : null]}>
      {children}
    </View>
  );
}

/** Pressable with explicit pressed / disabled visuals and a 44pt minimum touch target. */
export function Tap({ selected, style, children, ...rest }: Omit<PressableProps, "style"> & { selected?: boolean; style?: ViewStyle }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!rest.disabled, selected: !!selected }}
      style={({ pressed }) => [
        s.tap,
        selected && s.tapSelected,
        pressed && { backgroundColor: "#ffffff10" },
        rest.disabled && { opacity: 0.4 },
        style,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

export const Muted = ({ children, style }: { children: React.ReactNode; style?: object }) => (
  <Text style={[{ color: colors.muted, fontSize: 12 }, style]}>{children}</Text>
);

export function Skeleton({ h = 52 }: { h?: number }) {
  return <View accessibilityLabel="Loading" accessibilityState={{ busy: true }} style={{ height: h, borderRadius: 12, backgroundColor: colors.panel, opacity: 0.6, marginBottom: 8 }} />;
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 },
  tap: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 12, justifyContent: "center" },
  tapSelected: { borderColor: colors.cyan + "88", backgroundColor: colors.cyan + "12" },
});
