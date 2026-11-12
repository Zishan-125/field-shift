import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_PATTERN_PRIORITIES, type PatternPriorities } from "../types/pattern";
import { rerank, type StaticRecommendations } from "./staticRanking";

// Written by backend/offline/export_static.py from the live API.
const fixture = JSON.parse(
  readFileSync(join(__dirname, "__fixtures__", "api-rankings.json"), "utf-8"),
) as Record<string, { priorities: PatternPriorities | null; ranking: string[]; scores: number[]; current_score: number }>;

function exported(fieldId: string): StaticRecommendations {
  return JSON.parse(
    readFileSync(join(__dirname, "..", "..", "public", "data", "recommendations", `${fieldId}.json`), "utf-8"),
  );
}

describe("static ranking matches the API", () => {
  it("covers three fields and three priority settings", () => {
    expect(Object.keys(fixture)).toHaveLength(9);
  });

  for (const [key, expected] of Object.entries(fixture)) {
    it(key, () => {
      const [fieldId] = key.split("|");
      const result = rerank(exported(fieldId), expected.priorities ?? DEFAULT_PATTERN_PRIORITIES);

      expect(result.results.map((p) => p.pattern_id)).toEqual(expected.ranking);
      result.results.forEach((p, i) => expect(p.score).toBeCloseTo(expected.scores[i], 6));
      expect(result.current.score).toBeCloseTo(expected.current_score, 6);
    });
  }
});
