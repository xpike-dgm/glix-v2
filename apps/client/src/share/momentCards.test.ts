import { describe, expect, it } from "vitest";
import { rankPlayers } from "../screens/ranking.js";
import type { RoundRecord } from "../screens/titles.js";
import { MAX_MOMENTS, type MomentInput, ranksAfterEachRound, selectMoments } from "./momentCards.js";

const mk = (id: string, i: number, score: number) => ({
  id,
  nickname: id.toUpperCase(),
  avatar: i,
  score,
  connected: true,
  spectator: false,
});
const ranked = (scores: Record<string, number>) =>
  rankPlayers(
    Object.keys(scores).map((id, i) => ({ ...mk(id, i, scores[id] ?? 0) })) as never,
    (p) => p.score,
  );
const base = (over: Partial<MomentInput> = {}): MomentInput => ({
  ranked: ranked({ a: 6, b: 4, c: 3, d: 0 }),
  titles: [],
  rounds: [],
  drawings: [],
  gameNames: { "kor-kronometre": "Kör Kronometre", "sozluk-blofu": "Sözlük Blöfü" },
  ...over,
});
const round = (n: number, gameId: string, awards: Record<string, number>, summary?: string): RoundRecord => ({
  round: n,
  gameId,
  awards,
  summary,
});

describe("selectMoments", () => {
  it("oyuncu yoksa kart yok; en azından kazanan kartı var", () => {
    expect(selectMoments(base({ ranked: [] }))).toEqual([]);
    const m = selectMoments(base());
    expect(m).toHaveLength(1);
    expect(m[0]?.kind).toBe("winner");
    expect(m[0]?.title).toBe("Kazanan");
    expect(m[0]?.people.map((p) => p.nickname)).toEqual(["A", "B", "C"]);
  });

  it("beraberlikte başlık Berabere ve unvan satırı eklenir", () => {
    const m = selectMoments(
      base({ ranked: ranked({ a: 5, b: 5, c: 1 }), titles: [{ playerId: "b", label: "Blöf kralı" }] }),
    )[0];
    expect(m?.title).toBe("Berabere!");
    expect(m?.lines).toEqual(["Blöf kralı"]);
  });

  it("her oyundan yalnız en yüksek ödüllü tur, özeti olan ve ödülü ≥ 1 olanlar", () => {
    const rounds = [
      round(0, "kor-kronometre", { a: 1 }, "A hedefi 0,50 sn farkla tutturdu"),
      round(1, "kor-kronometre", { b: 3 }, "B hedefi 0,01 sn farkla tutturdu"),
      round(2, "sozluk-blofu", { c: 2 }, undefined),
      round(3, "sozluk-blofu", { d: -1 }, "olmaz"),
    ];
    const m = selectMoments(base({ rounds }));
    const r = m.filter((x) => x.kind === "round");
    expect(r).toHaveLength(1);
    expect(r[0]?.title).toBe("Kör Kronometre");
    expect(r[0]?.lines).toEqual(["B hedefi 0,01 sn farkla tutturdu"]);
    expect(r[0]?.people[0]?.nickname).toBe("B");
    expect(r[0]?.world).toBe("kor-kronometre");
  });

  it("en iyi çizim: Karalama turunun en çok puan alanı; ressam sıralamada yoksa atlanır", () => {
    const strokes = [[1, 2, 3, 4, 5, 6]] as never;
    const rounds = [round(2, "karalama-defteri", { a: 1, c: 2 })];
    const m = selectMoments(
      base({
        rounds,
        drawings: [
          { key: "kd:2:a", game: "karalama", playerId: "a", strokes },
          { key: "kd:2:c", game: "karalama", playerId: "c", strokes },
          { key: "kd:2:zz", game: "karalama", playerId: "zz", strokes },
        ],
      }),
    );
    const d = m.find((x) => x.kind === "drawing");
    expect(d?.people[0]?.nickname).toBe("C");
    expect(d?.strokes).toBe(strokes);
    expect(d?.world).toBe("karalama-defteri");
  });

  it("büyük dönüş: sondan ilk üçe en az 2 basamak yükselen", () => {
    const rounds = [
      round(0, "x", { a: 3, b: 2, c: 1, d: 0 }),
      round(1, "x", { a: 3, b: 2, c: 1, d: 0 }),
      round(2, "x", { d: 6 }),
    ];
    expect(ranksAfterEachRound(rounds, ["a", "b", "c", "d"])[0]).toEqual({ a: 1, b: 2, c: 3, d: 4 });
    const m = selectMoments(base({ ranked: ranked({ a: 6, b: 4, c: 2, d: 6 }), rounds }));
    const c = m.find((x) => x.kind === "comeback");
    expect(c?.people[0]?.nickname).toBe("D");
    expect(c?.lines).toEqual(["4. sıradan 1. sıraya yükseldi"]);
  });

  it("dönüş yoksa (sıra hiç düşmedi) kart eklenmez", () => {
    const rounds = [round(0, "x", { a: 3, b: 2 }), round(1, "x", { a: 3, b: 2 })];
    expect(selectMoments(base({ rounds })).some((x) => x.kind === "comeback")).toBe(false);
  });

  it("en çok 5 kart", () => {
    const names: Record<string, string> = {};
    const rounds: RoundRecord[] = [];
    for (let i = 0; i < 8; i++) {
      names[`g${i}`] = `Oyun ${i}`;
      rounds.push(round(i, `g${i}`, { a: 1 }, `özet ${i}`));
    }
    rounds.push(round(20, "x", { d: 9 }));
    const strokes = [[1, 2, 3, 4]] as never;
    const m = selectMoments(
      base({
        gameNames: names,
        rounds,
        drawings: [{ key: "kd:0:a", game: "karalama", playerId: "a", strokes }],
      }),
    );
    expect(m.length).toBeLessThanOrEqual(MAX_MOMENTS);
    expect(m.map((x) => x.kind)).toEqual(["winner", "drawing", "round", "round", "round"]);
  });
});
