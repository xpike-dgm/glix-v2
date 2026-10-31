import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import {
  answerFor,
  basicConditions,
  buildClue,
  conditionHolds,
  kontrolPaneliKaosu as game,
  type KontrolState,
  matchingPanels,
  panelMatches,
  phaseAt,
  rankAwards,
  wirePermutations,
} from "./index.js";
import {
  type Clue,
  KONTROL_DURATION_MS,
  KONTROL_REVEAL_MS,
  KONTROL_TIMELINE,
  type KontrolPublicView,
  type KontrolView,
  WIRE_COLORS,
  type WireColor,
  waveColors,
} from "./types.js";

type State = KontrolState;
const T0 = 1_000_000;
const W1 = 25_000;
const BR = 4_000;
const ctx = (now: number, connected: readonly string[] = [], seed = 1) => ({
  now,
  rng: createRng(seed),
  connected,
});
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const start = (players: string[] = ids(4), seed = 1): State => game.setup(players, ctx(T0, players, seed));
const tick = (s: State, at: number): State => game.tick(s, ctx(at, s.players));
const pub = (s: State, at: number) => game.publicView(tick(s, at), ctx(at, s.players)) as KontrolPublicView;
const priv = (s: State, who: string | null, at: number) =>
  game.view(tick(s, at), who, ctx(at, s.players)) as KontrolView;

function cut(s: State, who: string, color: WireColor, at = T0 + 1_000, connected?: readonly string[]): State {
  const parsed = game.parseAction({ kind: "cut", color, wave: phaseAt(s, at).wave });
  if (parsed === null) throw new Error("geçersiz");
  const r = game.reduce(s, who, parsed, ctx(at, connected ?? s.players));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
function reject(
  s: State,
  who: string,
  color: WireColor,
  at = T0 + 1_000,
  wave = phaseAt(s, at).wave,
): string {
  const parsed = game.parseAction({ kind: "cut", color, wave });
  if (parsed === null) throw new Error("geçersiz");
  const r = game.reduce(s, who, parsed, ctx(at, s.players));
  if (!isRejected(r)) throw new Error("kabul edildi");
  return r.rejected;
}
const wv = (s: State, w: number) => {
  const x = s.waves[w];
  if (!x) throw new Error("dalga yok");
  return x;
};
/** Oyuncunun o dalgadaki doğru rengi (testte sunucu durumundan). */
const answerOf = (s: State, id: string, w = 0): WireColor => wv(s, w).answers[id] as WireColor;
const wrongOf = (s: State, id: string, w = 0): WireColor =>
  waveColors(w).find((c) => c !== answerOf(s, id, w)) as WireColor;
const carrierOf = (s: State, target: string, w = 0): string =>
  Object.entries(wv(s, w).targets).find(([, t]) => t === target)?.[0] as string;
/** Dalganın içinden bir an. */
const inWave = (s: State, w: number, after = 1_000) => wv(s, w).startedAt + after;

describe("kontrol paneli kaosu meta", () => {
  it("2-8 oyuncu, dikey, briefing en çok 3 madde ve teknik kelime yok", () => {
    expect(game.minPlayers).toBe(2);
    expect(game.maxPlayers).toBe(8);
    expect(game.orientation).toBe("portrait");
    expect(game.briefing.steps.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(game.briefing)).not.toMatch(/server|debug|protocol|stage/i);
  });

  it("zaman çizelgesi tek sabitte: 25 / 25 / 20 sn dalga, 4 sn ara, 8 sn sonuç = 86 sn", () => {
    expect([...KONTROL_TIMELINE.waveMs]).toEqual([25_000, 25_000, 20_000]);
    expect(KONTROL_TIMELINE.breakMs).toBe(4_000);
    expect(KONTROL_REVEAL_MS).toBe(8_000);
    expect(KONTROL_DURATION_MS).toBe(86_000);
    const s = start();
    expect(s.waves.map((w) => w.endsAt - w.startedAt)).toEqual([25_000, 25_000, 20_000]);
    expect(wv(s, 1).startedAt - wv(s, 0).endsAt).toBe(4_000);
    expect(wv(s, 2).startedAt - wv(s, 1).endsAt).toBe(4_000);
    expect(s.finishAt - wv(s, 2).endsAt).toBe(8_000);
    expect(s.finishAt - s.startedAt).toBe(KONTROL_DURATION_MS);
  });

  it("renkler: dalga 1-2'de mavi, yeşil, kırmızı, sarı; dalga 3'te 5. renk mor", () => {
    expect([...WIRE_COLORS]).toEqual(["blue", "green", "red", "yellow", "purple"]);
    expect(waveColors(0)).toEqual(["blue", "green", "red", "yellow"]);
    expect(waveColors(1)).toEqual(["blue", "green", "red", "yellow"]);
    expect(waveColors(2)).toEqual([...WIRE_COLORS]);
    expect(wirePermutations()).toHaveLength(24);
    expect(wirePermutations(waveColors(2))).toHaveLength(120);
  });
});

describe("dalga akışı", () => {
  it("aşamalar: dalga 1 → ara → dalga 2 → ara → dalga 3 → sonuç; oyun sonuç süresinin sonunda biter", () => {
    const s = start();
    expect(phaseAt(s, T0)).toEqual({ stage: "play", wave: 0 });
    expect(phaseAt(s, T0 + W1 - 1)).toEqual({ stage: "play", wave: 0 });
    expect(phaseAt(s, T0 + W1)).toEqual({ stage: "break", wave: 0 });
    expect(phaseAt(s, T0 + W1 + BR)).toEqual({ stage: "play", wave: 1 });
    expect(phaseAt(s, T0 + 2 * W1 + BR)).toEqual({ stage: "break", wave: 1 });
    expect(phaseAt(s, T0 + 2 * W1 + 2 * BR)).toEqual({ stage: "play", wave: 2 });
    expect(phaseAt(s, T0 + 78_000)).toEqual({ stage: "reveal", wave: 2 });
    const ctxAt = (t: number) => ctx(t, s.players);
    expect(game.isFinished(s, ctxAt(T0 + 85_999))).toBe(false);
    expect(game.isFinished(s, ctxAt(T0 + 86_000))).toBe(true);
  });

  it("tick aşama ya da dalga değişince yeni durum döner, yoksa aynı nesne", () => {
    const s = start();
    expect(tick(s, T0 + 10_000)).toBe(s);
    const b = tick(s, T0 + W1);
    expect(b).not.toBe(s);
    expect(b.stage).toBe("break");
    expect(tick(b, T0 + W1 + 100)).toBe(b);
    const w2 = tick(b, T0 + W1 + BR);
    expect([w2.stage, w2.wave]).toEqual(["play", 1]);
  });

  it("nextWake bir sonraki geçişi söyler", () => {
    const s = start();
    expect(game.nextWake?.(s, ctx(T0, s.players))).toBe(T0 + W1);
    expect(game.nextWake?.(s, ctx(T0 + W1, s.players))).toBe(T0 + W1 + BR);
    expect(game.nextWake?.(s, ctx(T0 + 80_000, s.players))).toBe(T0 + 86_000);
    expect(game.nextWake?.(s, ctx(T0 + 86_000, s.players))).toBeNull();
  });

  it("ortak görünüm dalga numarası, kablo sayısı, saat ve arada sonraki dalganın başlangıcını verir", () => {
    const s = start();
    const p = pub(s, T0 + 1_000);
    expect([p.stage, p.wave, p.waves, p.wires]).toEqual(["play", 0, 3, 4]);
    expect([p.startedAt, p.endsAt]).toEqual([T0, T0 + W1]);
    const b = pub(s, T0 + W1 + 10);
    expect(b.stage).toBe("break");
    expect(b.nextAt).toBe(T0 + W1 + BR);
    expect(b.results).toHaveLength(1);
    const w3 = pub(s, inWave(s, 2));
    expect([w3.wave, w3.wires]).toEqual([2, 5]);
    expect(w3.results).toHaveLength(2);
    const r = pub(s, T0 + 80_000);
    expect(r.stage).toBe("reveal");
    expect(r.nextAt).toBe(s.finishAt);
    expect(r.results).toHaveLength(3);
    expect(r.reveal).not.toBeNull();
  });

  it("her dalgada yeni paneller ve tek kesim hakkı: önceki dalgada kesen yeni dalgada yine keser", () => {
    const s0 = start(ids(3));
    let s = cut(s0, "p1", answerOf(s0, "p1"));
    expect(reject(s, "p1", answerOf(s, "p1"))).toBe("already_cut");
    expect(priv(s, "p1", inWave(s, 0)).panel).toEqual(wv(s, 0).panels.p1);
    expect(priv(s, "p1", inWave(s, 1)).panel).toEqual(wv(s, 1).panels.p1);
    expect(priv(s, "p1", inWave(s, 1)).myCut).toBeNull();
    s = cut(s, "p1", answerOf(s, "p1", 1), inWave(s, 1));
    expect(priv(s, "p1", inWave(s, 1, 2_000)).myCut).toBe(answerOf(s, "p1", 1));
    expect(wv(s, 0).panels.p1).not.toEqual(wv(s, 1).panels.p1);
  });

  it("arada ve sonuçta kesim reddedilir ('ended'); kişiye özel görünüm aradayken boştur", () => {
    const s = start();
    expect(reject(s, "p1", "blue", T0 + W1)).toBe("ended");
    expect(reject(s, "p1", "blue", T0 + W1 + BR - 1)).toBe("ended");
    expect(reject(s, "p1", "blue", T0 + 80_000)).toBe("ended");
    expect(reject(s, "p1", "blue", T0 + 90_000)).toBe("ended");
    expect(priv(s, "p1", T0 + W1 + 100)).toEqual({ panel: [], clue: null, myCut: null });
    expect(priv(s, "p1", T0 + 80_000)).toEqual({ panel: [], clue: null, myCut: null });
  });

  it("mor yalnız dalga 3'te kesilebilir ('no_wire'); geçersiz renk ayrıştırılmaz; katılımcı olmayan kesemez", () => {
    const s = start();
    expect(reject(s, "p1", "purple")).toBe("no_wire");
    expect(cut(s, "p1", "purple", inWave(s, 2)).waves[2]?.cuts.p1).toBe("purple");
    expect(game.parseAction({ kind: "cut", color: "orange", wave: 0 })).toBeNull();
    expect(game.parseAction({ kind: "cut", color: "blue", wave: 0, extra: 1 })).toBeNull();
    expect(game.parseAction({ kind: "cut", color: "blue" })).toBeNull();
    expect(game.parseAction({ kind: "cut", color: "blue", wave: 3 })).toBeNull();
    expect(game.parseAction({ kind: "cut", color: "blue", wave: 0.5 })).toBeNull();
    expect(game.parseAction(null)).toBeNull();
    expect(reject(s, "x", "blue")).toBe("not_participant");
    expect(reject(s, "p1", "blue", T0 - 1)).toBe("not_started");
  });
});

describe("kesimin dalgası", () => {
  it("kesim yalnız sürmekte olan dalgaya sayılır; başka dalga için gönderilen kesim reddedilir ('wrong_wave')", () => {
    const s = start();
    expect(reject(s, "p1", answerOf(s, "p1"), T0 + 1_000, 1)).toBe("wrong_wave");
    expect(reject(s, "p1", answerOf(s, "p1", 1), inWave(s, 1), 0)).toBe("wrong_wave");
    expect(reject(s, "p1", "blue", inWave(s, 2), 1)).toBe("wrong_wave");
    expect(cut(s, "p1", answerOf(s, "p1", 1), inWave(s, 1)).waves[1]?.cuts.p1).toBe(answerOf(s, "p1", 1));
  });
});

describe("dalga başına erken bitiş", () => {
  it("bağlı herkes kesince dalga 1 sn sonra biter; sonraki dalgalar ve oyun sonu öne kayar", () => {
    let s = start(ids(3));
    for (const id of s.players) s = cut(s, id, answerOf(s, id), T0 + 5_000);
    expect(wv(s, 0).endsAt).toBe(T0 + 6_000);
    expect(wv(s, 0).closing).toBe(true);
    expect(wv(s, 1).startedAt).toBe(T0 + 10_000);
    expect(wv(s, 1).endsAt).toBe(T0 + 35_000);
    expect(s.finishAt).toBe(T0 + 6_000 + 4_000 + 25_000 + 4_000 + 20_000 + 8_000);
    expect(phaseAt(s, T0 + 6_000).stage).toBe("break");
  });

  it("bağlı biri eksikken bitmez; kopuk oyuncu beklenmez; kimse bağlı değilken erken bitiş olmaz", () => {
    let s = start(ids(3));
    s = cut(s, "p1", answerOf(s, "p1"));
    s = cut(s, "p2", answerOf(s, "p2"));
    expect(wv(s, 0).endsAt).toBe(T0 + W1);
    let k = start(ids(3));
    k = cut(k, "p1", answerOf(k, "p1"), T0 + 2_000, ["p1", "p2"]);
    k = cut(k, "p2", answerOf(k, "p2"), T0 + 2_000, ["p1", "p2"]);
    expect(wv(k, 0).endsAt).toBe(T0 + 3_000);
    const none = cut(start(ids(2)), "p1", answerOf(start(ids(2)), "p1"), T0 + 2_000, []);
    expect(wv(none, 0).endsAt).toBe(T0 + W1);
  });

  it("dalga 2 ve 3'te de erken bitiş çalışır", () => {
    let s = start(ids(2));
    for (const w of [0, 1, 2]) {
      const at = inWave(s, w, 2_000);
      for (const id of s.players) s = cut(s, id, answerOf(s, id, w), at);
      expect(wv(s, w).endsAt).toBe(at + 1_000);
    }
    expect(s.finishAt).toBe(wv(s, 2).endsAt + 8_000);
  });
});

describe("ortak bomba saati", () => {
  it("yanlış kesim herkesin saatinden 5 sn düşer; doğru kesim düşürmez; atlama herkese görünür, kesim rengi değil", () => {
    let s = start(ids(4));
    s = cut(s, "p1", answerOf(s, "p1"), T0 + 1_000);
    expect(wv(s, 0).endsAt).toBe(T0 + W1);
    expect(pub(s, T0 + 1_100).jumps).toBe(0);
    s = cut(s, "p2", wrongOf(s, "p2"), T0 + 2_000);
    expect(wv(s, 0).endsAt).toBe(T0 + W1 - 5_000);
    const p = pub(s, T0 + 2_100);
    expect(p.jumps).toBe(1);
    expect(p.lastJumpAt).toBe(T0 + 2_000);
    expect(p.endsAt).toBe(T0 + 20_000);
    expect(JSON.stringify(p)).not.toContain(wrongOf(s, "p2"));
    // Sonraki dalgalar da kayar.
    expect(wv(s, 1).startedAt).toBe(T0 + 24_000);
  });

  it("saat 3 sn'nin altına inmez; 3 sn'de (ya da altında) gelen yanlış kesim süre düşürmez", () => {
    let s = start(ids(5));
    // 7 sn kala yanlış: 3 sn'ye iner (2'ye değil).
    s = cut(s, "p1", wrongOf(s, "p1"), T0 + W1 - 7_000);
    expect(wv(s, 0).endsAt).toBe(T0 + W1 - 4_000);
    // Kalan tam 3 sn: düşmez, atlama sayılmaz.
    const at3 = wv(s, 0).endsAt - 3_000;
    s = cut(s, "p2", wrongOf(s, "p2"), at3);
    expect(wv(s, 0).endsAt).toBe(at3 + 3_000);
    expect(wv(s, 0).jumps).toHaveLength(1);
    // Kalan 2 sn: düşmez.
    const at2 = wv(s, 0).endsAt - 2_000;
    s = cut(s, "p3", wrongOf(s, "p3"), at2);
    expect(wv(s, 0).endsAt).toBe(at2 + 2_000);
    // Kalan 4 sn: 3'e iner.
    let t = start(ids(3));
    t = cut(t, "p1", wrongOf(t, "p1"), T0 + W1 - 4_000);
    expect(wv(t, 0).endsAt - (T0 + W1 - 4_000)).toBe(3_000);
  });

  it("art arda yanlış kesimler her biri 5 sn düşer", () => {
    let s = start(ids(5));
    s = cut(s, "p1", wrongOf(s, "p1"), T0 + 1_000);
    s = cut(s, "p2", wrongOf(s, "p2"), T0 + 1_000);
    s = cut(s, "p3", wrongOf(s, "p3"), T0 + 1_000);
    expect(wv(s, 0).endsAt).toBe(T0 + W1 - 15_000);
    expect(pub(s, T0 + 1_100).jumps).toBe(3);
  });
});

describe("paneller ve ipucu zinciri (çok tohum)", () => {
  it("her dalgada paneller oyuncular arasında farklı; dalga 1 ve 2 dizilimleri ayrı; dalga 3'te 5 kablo ve mor var", () => {
    for (let n = 2; n <= 8; n++)
      for (let seed = 1; seed <= 25; seed++) {
        const s = start(ids(n), seed);
        for (const [w, x] of s.waves.entries()) {
          const ps = Object.values(x.panels).map((p) => p.join());
          expect(new Set(ps).size).toBe(n);
          for (const p of Object.values(x.panels)) expect([...p].sort()).toEqual([...waveColors(w)].sort());
        }
        const first = new Set(Object.values(wv(s, 0).panels).map((p) => p.join()));
        for (const p of Object.values(wv(s, 1).panels)) expect(first.has(p.join())).toBe(false);
        for (const p of Object.values(wv(s, 2).panels)) {
          expect(p).toHaveLength(5);
          expect(p).toContain("purple");
        }
      }
  });

  it("tek döngü: kimse kendini hedeflemez, herkes tam bir ipucu taşır; 3+ oyuncuda hiçbir taşıyıcı önceki dalgadaki hedefini taşımaz", () => {
    for (let n = 2; n <= 8; n++)
      for (let seed = 1; seed <= 30; seed++) {
        const s = start(ids(n), seed);
        s.waves.forEach((x, w) => {
          const t = x.targets;
          expect(Object.keys(t).sort()).toEqual([...s.players].sort());
          expect(new Set(Object.values(t)).size).toBe(n);
          for (const [c, target] of Object.entries(t)) expect(target).not.toBe(c);
          // Tek döngü: p1'den başlayıp n adımda geri dönülür.
          let at = "p1";
          const seen = new Set<string>();
          for (let i = 0; i < n; i++) {
            seen.add(at);
            at = t[at] as string;
          }
          expect(at).toBe("p1");
          expect(seen.size).toBe(n);
          const prev = s.waves[w - 1];
          if (prev && n >= 3) for (const c of s.players) expect(t[c]).not.toBe(prev.targets[c]);
        });
      }
  });
});

describe("ipucu türleri", () => {
  const P: WireColor[] = ["blue", "green", "red", "yellow"];
  it("her koşul türü doğru değerlendirilir", () => {
    expect(conditionHolds(P, { kind: "at", position: 1, color: "blue" })).toBe(true);
    expect(conditionHolds(P, { kind: "at", position: 2, color: "blue" })).toBe(false);
    expect(conditionHolds(P, { kind: "notAt", position: 2, color: "red" })).toBe(true);
    expect(conditionHolds(P, { kind: "notAt", position: 3, color: "red" })).toBe(false);
    expect(conditionHolds(P, { kind: "adjacent", a: "blue", b: "green" })).toBe(true);
    expect(conditionHolds(P, { kind: "adjacent", a: "green", b: "blue" })).toBe(true);
    expect(conditionHolds(P, { kind: "adjacent", a: "blue", b: "red" })).toBe(false);
    expect(conditionHolds(P, { kind: "adjacent", a: "blue", b: "purple" })).toBe(false);
    expect(conditionHolds(P, { kind: "above", a: "blue", b: "yellow" })).toBe(true);
    expect(conditionHolds(P, { kind: "above", a: "yellow", b: "blue" })).toBe(false);
    expect(answerFor(P, { kind: "color", color: "red" })).toBe("red");
    expect(answerFor(P, { kind: "position", position: 4 })).toBe("yellow");
    expect(answerFor(P, { kind: "position", position: 1 })).toBe("blue");
  });

  it("(özellik) her ipucu hedefte doğrudur, dalganın panelleri arasında YALNIZ hedefi tanımlar ve doğru kablo kesin hesaplanır", () => {
    const kinds = new Set<string>();
    let positionCuts = 0;
    let mixed = 0;
    for (let n = 2; n <= 8; n++)
      for (let seed = 1; seed <= 80; seed++) {
        const s = start(ids(n), seed);
        s.waves.forEach((x, w) => {
          const panels = Object.values(x.panels);
          for (const [carrier, target] of Object.entries(x.targets)) {
            const clue = x.clues[carrier] as Clue;
            const panel = x.panels[target] as WireColor[];
            expect(clue.wave).toBe(w + 1);
            expect(clue.wires).toBe(waveColors(w).length);
            expect(panelMatches(panel, clue.conditions)).toBe(true);
            expect(matchingPanels(panels, clue.conditions)).toBe(1);
            expect(x.answers[target]).toBe(answerFor(panel, clue.cut));
            expect(clue.conditions.length).toBeGreaterThanOrEqual(1);
            if (w === 0) {
              expect(clue.conditions.every((c) => c.kind === "at")).toBe(true);
              expect(clue.conditions.length).toBeGreaterThanOrEqual(2);
              expect(clue.cut.kind).toBe("color");
            }
            if (w >= 1) for (const c of clue.conditions) kinds.add(c.kind);
            if (clue.cut.kind === "position") {
              expect(w).toBeGreaterThanOrEqual(1);
              expect([1, clue.wires]).toContain(clue.cut.position);
              positionCuts++;
            }
            if (w === 2 && clue.conditions.some((c) => c.kind !== "at")) mixed++;
            // İpucu kimsenin kimliğini ya da adını taşımaz.
            const json = JSON.stringify(clue);
            for (const id of s.players) expect(json).not.toContain(`"${id}"`);
          }
        });
      }
    expect([...kinds].sort()).toEqual(["above", "adjacent", "at", "notAt"]);
    expect(positionCuts).toBeGreaterThan(50);
    expect(mixed).toBeGreaterThan(50);
  }, 30_000);

  it("dalga 3'te mor bir ipucunda geçer ya da kestirilir", () => {
    let purple = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = start(ids(6), seed);
      for (const [carrier, target] of Object.entries(wv(s, 2).targets)) {
        const clue = wv(s, 2).clues[carrier] as Clue;
        if (JSON.stringify(clue).includes("purple") || wv(s, 2).answers[target] === "purple") purple++;
      }
    }
    expect(purple).toBeGreaterThan(20);
  });

  it("istenen tür yalnız hedefi tanımlayamazsa daha basit 'N. kablo R' türüne düşülür", () => {
    const all = wirePermutations();
    const target = all[5] as WireColor[];
    // Bütün 24 dizilim masadaysa iki koşul yetmez; "değilse" türü düşer ve üç konumlu basit ipucu gelir.
    const clue = buildClue({
      wave: 1,
      panels: all,
      target,
      colors: waveColors(1),
      answer: "red",
      pick: () => 0,
    });
    expect(clue.conditions.every((c) => c.kind === "at")).toBe(true);
    expect(clue.conditions).toHaveLength(3);
    expect(clue.cut).toEqual({ kind: "color", color: "red" });
    expect(matchingPanels(all, clue.conditions)).toBe(1);
  });

  it("aynı dizilimli paneller varsa (gerçekte olmaz) en az eşleşen koşul seçilir ve hedefte doğrudur", () => {
    const p: WireColor[] = ["blue", "green", "red", "yellow"];
    const c = basicConditions([p, [...p]], p, () => 0);
    expect(panelMatches(p, c)).toBe(true);
    expect(c).toHaveLength(3);
  });
});

describe("puanlama", () => {
  it("dalgada doğru kesen +1 ve o panelin ipucu taşıyıcısı +1; yanlış ya da boş 0", () => {
    let s = start(ids(4));
    s = cut(s, "p1", answerOf(s, "p1"));
    s = cut(s, "p2", wrongOf(s, "p2"));
    const r = pub(s, T0 + W1 + 10).results[0];
    if (!r) throw new Error("sonuç yok");
    const expected: Record<string, number> = { p1: 0, p2: 0, p3: 0, p4: 0 };
    expected.p1 = 1;
    expected[carrierOf(s, "p1")] = (expected[carrierOf(s, "p1")] ?? 0) + 1;
    expect(r.scores).toEqual(expected);
    expect(r.rows.p1?.correct).toBe(true);
    expect(r.rows.p2?.correct).toBe(false);
    expect(r.rows.p3?.cut).toBeNull();
    expect(r.rows.p2?.answer).toBe(answerOf(s, "p2"));
  });

  it("toplam imha puanı sıralaması: +2 / +1 / 0", () => {
    const P = ["a", "b", "c", "d"];
    expect(rankAwards(P, { a: 4, b: 2, c: 1, d: 0 })).toEqual({ a: 2, b: 1, c: 0, d: 0 });
    // Birincide eşitlik: hepsi +2, sonraki farklı değer +1.
    expect(rankAwards(P, { a: 3, b: 3, c: 1, d: 1 })).toEqual({ a: 2, b: 2, c: 1, d: 1 });
    // Toplamı 0 olan ödül almaz.
    expect(rankAwards(P, { a: 3, b: 3, c: 0, d: 0 })).toEqual({ a: 2, b: 2, c: 0, d: 0 });
    expect(rankAwards(P, { a: 2, b: 0, c: 0, d: 0 })).toEqual({ a: 2, b: 0, c: 0, d: 0 });
    // Herkes eşit ve > 0: herkes +1; herkes 0: kimse almaz.
    expect(rankAwards(P, { a: 6, b: 6, c: 6, d: 6 })).toEqual({ a: 1, b: 1, c: 1, d: 1 });
    expect(rankAwards(P, { a: 0, b: 0, c: 0, d: 0 })).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    expect(rankAwards(P, {})).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    // Eksi puan yok.
    for (const v of Object.values(rankAwards(P, { a: 1, b: 2, c: 3, d: 0 })))
      expect(v).toBeGreaterThanOrEqual(0);
  });

  it("herkes her dalgayı doğru keserse herkes 6 imha puanı ve +1 alır", () => {
    let s = start(ids(3));
    for (const w of [0, 1, 2]) {
      const at = inWave(s, w);
      for (const id of s.players) s = cut(s, id, answerOf(s, id, w), at);
    }
    const r = pub(s, s.finishAt - 10).reveal;
    expect(r?.totals).toEqual({ p1: 6, p2: 6, p3: 6 });
    expect(r?.awards).toEqual({ p1: 1, p2: 1, p3: 1 });
    expect(game.result(s)).toEqual({ miniScores: r?.awards, awards: r?.awards });
  });

  it("kimse kesmezse herkes 0; mini puan genel skora doğrudan eklenir (awards = miniScores)", () => {
    const s = start(ids(4));
    expect(game.result(s)).toEqual({
      miniScores: { p1: 0, p2: 0, p3: 0, p4: 0 },
      awards: { p1: 0, p2: 0, p3: 0, p4: 0 },
    });
  });

  it("üç dalgalık bir maçta toplam imha puanı dalgaların toplamıdır ve ödül sıralamadan gelir", () => {
    let s = start(ids(4), 7);
    // Dalga 1: yalnız p1 doğru; dalga 2: p1 ve p2 doğru; dalga 3: kimse.
    s = cut(s, "p1", answerOf(s, "p1", 0), inWave(s, 0));
    s = cut(s, "p1", answerOf(s, "p1", 1), inWave(s, 1));
    s = cut(s, "p2", answerOf(s, "p2", 1), inWave(s, 1));
    const view = pub(s, s.finishAt - 10);
    const totals: Record<string, number> = { p1: 0, p2: 0, p3: 0, p4: 0 };
    for (const r of view.results)
      for (const [id, v] of Object.entries(r.scores)) totals[id] = (totals[id] ?? 0) + v;
    expect(view.reveal?.totals).toEqual(totals);
    expect(view.reveal?.awards).toEqual(rankAwards(s.players, totals));
    expect(game.result(s).awards).toEqual(view.reveal?.awards);
  });
});

describe("gizlilik", () => {
  it("(yapısal) süren dalgada ortak görünümde panel, ipucu, hedef eşlemesi, doğru kablo ve kesim rengi yok", () => {
    for (const w of [0, 1, 2]) {
      let s = start(ids(4), 3);
      const at = inWave(s, w);
      s = cut(s, "p1", answerOf(s, "p1", w), at);
      const p = pub(s, at + 10);
      expect(p.results).toHaveLength(w);
      expect(p.reveal).toBeNull();
      const json = JSON.stringify(p);
      for (const id of s.players) expect(json).not.toContain(JSON.stringify(wv(s, w).panels[id]));
      for (const id of s.players) expect(json).not.toContain(JSON.stringify(wv(s, w).clues[id]));
      expect(json).not.toContain(`"wave":${w + 1},"wires"`);
      expect(p.done).toEqual(["p1"]);
      // Biten dalgalar açıktır, süren dalga değil.
      for (const r of p.results) expect(r.wave).toBeLessThan(w);
    }
  });

  it("(yapısal) herkes yalnız kendi panelini ve kendi taşıdığı ipucunu görür; hedef kendi ipucunu bilmez", () => {
    for (const w of [0, 1, 2]) {
      const s = start(ids(5), 9);
      const at = inWave(s, w);
      for (const id of s.players) {
        const v = priv(s, id, at);
        expect(v.panel).toEqual(wv(s, w).panels[id]);
        expect(v.clue).toEqual(wv(s, w).clues[id]);
        const json = JSON.stringify(v);
        for (const other of s.players) {
          if (other === id) continue;
          expect(json).not.toContain(JSON.stringify(wv(s, w).panels[other]));
          expect(json).not.toContain(JSON.stringify(wv(s, w).clues[other]));
        }
        expect(JSON.stringify(v.clue)).not.toEqual(JSON.stringify(wv(s, w).clues[carrierOf(s, id, w)]));
      }
    }
  });

  it("(yapısal) kesim rengi dalga bitene kadar yalnız kesende; doğru/yanlış bilgisi kesene de gösterilmez", () => {
    let s = start(ids(3), 4);
    s = cut(s, "p1", wrongOf(s, "p1"));
    const mine = priv(s, "p1", T0 + 1_100);
    expect(mine.myCut).toBe(wrongOf(s, "p1"));
    expect(JSON.stringify(mine)).not.toMatch(/correct|answer/);
    expect(priv(s, "p2", T0 + 1_100).myCut).toBeNull();
    expect(priv(s, null, T0 + 1_100)).toEqual({ panel: [], clue: null, myCut: null });
    expect(JSON.stringify(pub(s, T0 + 1_100))).not.toMatch(/correct|answer/);
  });

  it("secrets: süren dalganın panelleri ve ipuçları yalnız sahibinde; ara ve sonuçta boş", () => {
    const s = start(ids(3));
    const sec = game.secrets(tick(s, T0 + 100));
    expect(sec).toHaveLength(6);
    for (const e of sec) expect(e.ownerIds).toHaveLength(1);
    expect(game.secrets(tick(s, T0 + W1 + 10))).toEqual([]);
    expect(game.secrets(tick(s, T0 + 80_000))).toEqual([]);
    const s3 = game.secrets(tick(s, inWave(s, 2)));
    expect(s3.some((e) => e.value.includes("purple"))).toBe(true);
  });

  it("izleyici görünümü boştur; dalga bitince o dalganın panelleri ve kesimleri herkese açılır", () => {
    let s = start(ids(3));
    s = cut(s, "p2", answerOf(s, "p2"));
    expect(priv(s, null, T0 + 2_000)).toEqual({ panel: [], clue: null, myCut: null });
    const r = pub(s, T0 + W1 + 10).results[0];
    expect(r?.rows.p2?.cut).toBe(answerOf(s, "p2"));
    expect(r?.rows.p1?.panel).toEqual(wv(s, 0).panels.p1);
    expect(r?.rows.p1?.carrier).toBe(carrierOf(s, "p1"));
  });
});
