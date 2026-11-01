import {
  CIZGI_RADAR_MIN_PLAYERS,
  cizgiPeakZone,
  cizgiZone,
  cizgiZoneRange,
  cizgiZoneWidth,
} from "@glix/engine";

const label = (z: number, w: number): string => {
  const { from, to } = cizgiZoneRange(z, w);
  return from === to ? String(from) : `${from}–${to}`;
};

/** Masanın gerçek çarpışma örneği: 95 ve 94 aynı platformdaysa onlar, değilse 95'in platformunun son iki sayısı. */
export function crashExample(width: number): [number, number] {
  if (cizgiZone(94, width) === cizgiZone(95, width)) return [95, 94];
  const { to } = cizgiZoneRange(cizgiZone(95, width), width);
  return [to, to - 1];
}

/**
 * CZ-U15: anlatım masanın kendi platformlarıyla. Motor maddelerindeki genel ifadeleri bu masanın sayılarıyla değiştirir
 * (anlatım kurulumdan önce gösterildiği için katılımcı sayısından hesaplanır). 2 kişide radar cümlesi çıkar.
 */
export function cizgiBriefing(steps: readonly string[], players: number): readonly string[] {
  const n = Math.min(8, Math.max(2, Math.trunc(players)));
  const w = cizgiZoneWidth(n);
  const peak = cizgiPeakZone(w);
  const zones = `${label(0, w)}, ${label(1, w)} … ${label(peak - 2, w)}, ${label(peak - 1, w)}, 100 Zirve`;
  const [a, b] = crashExample(w);
  return steps.map((step) => {
    let s = step.replace(
      "Platformlar oyuncu sayısına göre; 100 tek başına Zirve.",
      `${n} kişisiniz: her platform ${w} sayı (${zones}).`,
    );
    s = s.replace(
      "ikiniz de çarpışır, puan yok.",
      `ikiniz de çarpışır, puan yok. Örnek: ${a} ve ${b} → çarpıştı.`,
    );
    if (n < CIZGI_RADAR_MIN_PLAYERS)
      s = s.replace(" Turun ortasında radar kalabalık platformları yakar.", "");
    return s;
  });
}
