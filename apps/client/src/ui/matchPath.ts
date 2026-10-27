export type PathState = "done" | "current" | "next";

/** Maç yolu: `round` 0 tabanlı mevcut oyun, `total` oyun sayısı. */
export function matchPath(round: number, total: number): PathState[] {
  const n = Math.max(0, Math.min(total, 12));
  return Array.from(
    { length: n },
    (_, i): PathState => (i < round ? "done" : i === round ? "current" : "next"),
  );
}

/** "2/5": 1 tabanlı sıra. */
export function roundLabel(round: number, total: number): string {
  return `${Math.min(total, Math.max(0, round) + 1)}/${total}`;
}
