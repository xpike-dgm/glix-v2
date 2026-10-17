import type { MatchSnapshot } from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";
import type { HudInfo } from "../registry.js";

/** Yer tutucu yatay sahnenin ortak görünümü: `{ startedAt, endsAt, scores }`. Doğrulanır, bozuksa null. */
export function hudOf(match: MatchSnapshot): HudInfo | null {
  const v = match.publicView;
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const rec = v as Record<string, unknown>;
  if (typeof rec.startedAt !== "number" || typeof rec.endsAt !== "number") return null;
  const scores = parseNumberRecord(rec.scores);
  if (!scores) return null;
  return { startedAt: rec.startedAt, endsAt: rec.endsAt, scores };
}
