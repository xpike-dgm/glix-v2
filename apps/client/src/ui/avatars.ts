export interface PlayerLook {
  name: string;
  color: string;
  bust: string;
  pip: string;
}

const NAMES = ["cyan", "magenta", "amber", "lime", "violet", "orange", "emerald", "cobalt"] as const;
const PIPS = ["arrow", "heart", "bolt", "bars", "wave", "hazard", "gem", "cross"] as const;
const COLORS = [
  "#2EF2FF",
  "#FF2BD6",
  "#FFC23B",
  "#B6FF3B",
  "#8B5CFF",
  "#FF8A3B",
  "#2BFFA8",
  "#3B7BFF",
] as const;

/** Avatar sırası (0–7) → renk, büst görseli ve simge. */
export function look(index: number): PlayerLook {
  const i = ((Math.trunc(index) % 8) + 8) % 8;
  const name = NAMES[i] ?? "cyan";
  return {
    name,
    color: COLORS[i] ?? "#2EF2FF",
    bust: `/assets/avatars/busts/p${i + 1}-${name}-bust-v1.webp`,
    pip: `/assets/avatars/hud-pips/p${i + 1}-${name}-${PIPS[i] ?? "arrow"}.svg`,
  };
}

/** Takma addan sabit bir avatar sırası (ana sayfa rozeti için). */
export function avatarFromName(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 8;
}
