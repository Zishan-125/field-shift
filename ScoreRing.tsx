import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { bandFor, bandStyle, colors } from "../theme";

const R = 54;
const C = 2 * Math.PI * R;

export function ScoreRing({ score, size = 136 }: { score: number; size?: number }) {
  const { color, label } = bandStyle[bandFor(score)];
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Shift Score ${score} out of 100, ${label}`}
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <Svg width={size} height={size} viewBox="0 0 120 120" style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx="60" cy="60" r={R} stroke={colors.border} strokeWidth={8} fill="none" />
        <Circle
          cx="60" cy="60" r={R} stroke={color} strokeWidth={8} fill="none" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)}
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ color, fontSize: 38, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{score}</Text>
        <Text style={{ color: colors.muted, fontSize: 10 }}>/ 100</Text>
      </View>
    </View>
  );
}
