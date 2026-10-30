import { describe, expect, it } from "vitest";
import {
  clientPhase,
  formatClock,
  fuseBurnt,
  fuseTickMs,
  isNewResult,
  isSuddenDeath,
  lengthTone,
  litIndexAt,
  litMs,
  parseZamanBombasiView,
  statusOf,
} from "./view.js";

const pub = {
  order: ["a", "b", "c"],
  eliminated: [],
  scores: { a: 0, b: 1, c: 0 },
  active: "a",
  pick: null,
  lastThrow: { from: "b", to: "a", at: 600, auto: false },
  length: 3,
  phase: "playback",
  turn: 2,
  turnStart: 1000,
  inputStart: 2800,
  deadline: 11_800,
  stepMs: 600,
  playbackIndex: 1,
  sequence: ["kirmizi", "mavi", "sari"],
  pressed: [],
  need: 2,
  startedAt: 0,
  endsAt: 90_000,
  suddenDeathAt: 60_000,
  timeUp: false,
  last: { turn: 1, player: "b", kind: "ok", at: 900 },
};
const priv = { isOut: false, myTurn: false, myPick: false, pickColor: null };
const pickPub = {
  ...pub,
  phase: "pick",
  sequence: null,
  pick: { by: "a", kind: "throw", opensAt: 3000, deadline: 7000, colorDone: false, blocked: "b" },
  last: { turn: 2, player: "a", kind: "ok", at: 2100 },
};

describe("Zaman Bombası Hafızası görünümü", () => {
  it("geçerli görünümleri birleştirir", () => {
    const v = parseZamanBombasiView(pub, priv);
    expect(v?.sequence).toEqual(["kirmizi", "mavi", "sari"]);
    expect(v?.myPick).toBe(false);
    expect(v?.last?.kind).toBe("ok");
    expect(v?.lastThrow).toEqual({ from: "b", to: "a", at: 600, auto: false });
  });

  it("giriş evresinde dizi null olabilir", () => {
    const v = parseZamanBombasiView({ ...pub, phase: "input", sequence: null, pressed: ["kirmizi"] }, priv);
    expect(v?.sequence).toBeNull();
    expect(v?.pressed).toEqual(["kirmizi"]);
  });

  it("bozuk görünümü reddeder", () => {
    expect(parseZamanBombasiView(null, priv)).toBeNull();
    expect(parseZamanBombasiView(pub, null)).toBeNull();
    expect(parseZamanBombasiView({ ...pub, phase: "x" }, priv)).toBeNull();
    expect(parseZamanBombasiView({ ...pub, sequence: ["mor"] }, priv)).toBeNull();
    expect(parseZamanBombasiView({ ...pub, scores: { a: "x" } }, priv)).toBeNull();
    expect(parseZamanBombasiView({ ...pub, stepMs: 0 }, priv)).toBeNull();
    expect(parseZamanBombasiView({ ...pub, length: 0 }, priv)).toBeNull();
    expect(parseZamanBombasiView({ ...pub, last: { turn: 1 } }, priv)).toBeNull();
    expect(parseZamanBombasiView({ ...pub, pressed: [1] }, priv)).toBeNull();
    expect(parseZamanBombasiView(pub, { ...priv, myTurn: 1 })).toBeNull();
    expect(parseZamanBombasiView(pub, { ...priv, pickColor: "mor" })).toBeNull();
    expect(parseZamanBombasiView(pub, { isOut: false, myTurn: false })).toBeNull();
    expect(parseZamanBombasiView({ ...pub, lastThrow: { to: "a" } }, priv)).toBeNull();
    // Seçim evresi ile seçim bilgisi birlikte gelir.
    expect(parseZamanBombasiView({ ...pub, phase: "pick" }, priv)).toBeNull();
    expect(parseZamanBombasiView({ ...pickPub, pick: null }, priv)).toBeNull();
    expect(parseZamanBombasiView({ ...pickPub, pick: { ...pickPub.pick, kind: "x" } }, priv)).toBeNull();
    expect(parseZamanBombasiView({ ...pickPub, pick: { ...pickPub.pick, deadline: 1 } }, priv)).toBeNull();
  });

  it("seçim görünümü: seçim bilgisi ve yalnız seçende seçilen renk", () => {
    const v = parseZamanBombasiView(pickPub, { ...priv, myPick: true, pickColor: "sari" });
    expect(v?.pick).toEqual(pickPub.pick);
    expect(v?.pickColor).toBe("sari");
    expect(clientPhase(pickPub as never, 2500)).toBe("pick");
    expect(clientPhase(pickPub as never, 6999)).toBe("pick");
    expect(clientPhase(pickPub as never, 7000)).toBe("expired");
    expect(clientPhase({ ...pickPub, endsAt: 5000 } as never, 5000)).toBe("expired");
  });

  it("evreyi mutlak zamandan türetir", () => {
    expect(clientPhase(pub as never, 999)).toBe("pause");
    expect(clientPhase(pub as never, 1000)).toBe("playback");
    expect(clientPhase(pub as never, 2799)).toBe("playback");
    expect(clientPhase(pub as never, 2800)).toBe("input");
    expect(clientPhase(pub as never, 11_799)).toBe("input");
    expect(clientPhase(pub as never, 11_800)).toBe("expired");
    expect(clientPhase({ ...pub, phase: "over" } as never, 0)).toBe("over");
  });

  it("toplam süre: ani ölüm 60 sn sonrası, bitişte kalkar; saat d:ss biçimlenir", () => {
    const w = { suddenDeathAt: 60_000, endsAt: 90_000 };
    expect(isSuddenDeath(w, 60_000)).toBe(false);
    expect(isSuddenDeath(w, 60_001)).toBe(true);
    expect(isSuddenDeath(w, 90_000)).toBe(false);
    expect(formatClock(90_000)).toBe("1:30");
    expect(formatClock(64_100)).toBe("1:05");
    expect(formatClock(-5)).toBe("0:00");
    expect(clientPhase({ ...pub, deadline: 120_000 } as never, 90_000)).toBe("expired");
    expect(clientPhase({ ...pub, deadline: 120_000 } as never, 89_999)).toBe("input");
    expect(parseZamanBombasiView({ ...pub, endsAt: 0 }, priv)).toBeNull();
    expect(parseZamanBombasiView({ ...pub, timeUp: "x" }, priv)).toBeNull();
  });

  it("yanan eleman: kısa dizide uzun, uzun dizide kısa yanar; aralarda söner", () => {
    expect(litMs(2, 350)).toBeGreaterThan(litMs(8, 350));
    const v = pub as never;
    expect(litIndexAt(v, 999)).toBe(-1);
    expect(litIndexAt(v, 1000)).toBe(0);
    expect(litIndexAt(v, 1000 + litMs(3, 600) - 1)).toBe(0);
    expect(litIndexAt(v, 1000 + litMs(3, 600))).toBe(-1);
    expect(litIndexAt(v, 1600)).toBe(1);
    expect(litIndexAt(v, 2200)).toBe(2);
    expect(litIndexAt(v, 2800)).toBe(-1);
  });

  it("yeni sonuç yalnız ekran açıkken gelen sıralar için", () => {
    expect(isNewResult(null, 1)).toBe(false);
    expect(isNewResult({ turn: 3, player: "a", kind: "fail", at: 1 }, null)).toBe(false);
    expect(isNewResult({ turn: 3, player: "a", kind: "fail", at: 1 }, 2)).toBe(true);
    expect(isNewResult({ turn: 3, player: "a", kind: "fail", at: 1 }, 3)).toBe(false);
  });

  it("seçim durumları: önce sonuç (TEMİZ/patlama), sonra renk → hedef; diğerleri bekler", () => {
    const own = parseZamanBombasiView(pickPub, { ...priv, myPick: true });
    const other = parseZamanBombasiView(pickPub, priv);
    if (!own || !other) throw new Error("görünüm okunamadı");
    const st = (v: typeof own, now: number, spectator = false) =>
      statusOf({ v, phase: clientPhase(v, now), spectator, now });
    expect(st(own, 2500)).toBe("ok");
    expect(st(own, 3000)).toBe("pickColor");
    expect(st({ ...own, pick: { ...own.pick, colorDone: true } as never }, 3000)).toBe("pickTarget");
    expect(st(other, 3000)).toBe("pickOther");
    expect(st(own, 3000, true)).toBe("pickOther");
    const restart = { ...own, pick: { ...own.pick, kind: "restart", colorDone: true } as never };
    expect(st({ ...restart, last: { turn: 2, player: "c", kind: "fail", at: 2000 } }, 2500)).toBe("fail");
    expect(st(restart, 3500)).toBe("pickTarget");
  });

  it("atış sonrası: hedef için uyarı, diğerleri için 'atıldı'; atanı olmayan elenmede önce patlama", () => {
    const paused = { ...pub, phase: "pause", turnStart: 2000, inputStart: 3050, deadline: 7550 };
    const mineV = parseZamanBombasiView(paused, { ...priv, myTurn: true });
    const otherV = parseZamanBombasiView(paused, priv);
    if (!mineV || !otherV) throw new Error("görünüm okunamadı");
    expect(statusOf({ v: mineV, phase: "pause", spectator: false, now: 1000 })).toBe("alert");
    expect(statusOf({ v: otherV, phase: "pause", spectator: false, now: 1000 })).toBe("thrown");
    expect(statusOf({ v: { ...otherV, lastThrow: null }, phase: "pause", spectator: false, now: 1000 })).toBe(
      "intro",
    );
    const blast = {
      ...mineV,
      lastThrow: { from: null, to: "a", at: 1500, auto: true },
      last: { turn: 1, player: "c", kind: "timeout" as const, at: 0 },
    };
    expect(statusOf({ v: blast, phase: "pause", spectator: false, now: 1000 })).toBe("timeout");
    expect(statusOf({ v: blast, phase: "pause", spectator: false, now: 1500 })).toBe("alert");
  });

  it("fitil: son 2 sn iki kat hızlı yanar; tik sıklaşır; dizi sayacı 8+ turuncu, 12+ kırmızı", () => {
    expect(fuseBurnt(6000, 6000)).toBe(0);
    expect(fuseBurnt(6000, 0)).toBe(1);
    // 4 sn sakin + 2 sn hızlı: sakin kısım toplam payın 4/8'i, hızlı kısım 4/8'i.
    expect(fuseBurnt(6000, 2000)).toBeCloseTo(0.5);
    const calmRate = fuseBurnt(6000, 5000) - fuseBurnt(6000, 6000);
    const rushRate = fuseBurnt(6000, 1000) - fuseBurnt(6000, 2000);
    expect(rushRate).toBeCloseTo(calmRate * 2);
    expect(fuseBurnt(1500, 0)).toBe(1);
    expect(fuseTickMs(5000)).toBeGreaterThan(fuseTickMs(1500));
    expect(fuseTickMs(1500)).toBeGreaterThan(fuseTickMs(500));
    expect([lengthTone(7), lengthTone(8), lengthTone(11), lengthTone(12)]).toEqual([
      "",
      "amber",
      "amber",
      "red",
    ]);
  });

  it("durum başlığı", () => {
    const base0 = parseZamanBombasiView(pub, priv);
    if (!base0) throw new Error("görünüm okunamadı");
    const base = base0;
    expect(statusOf({ v: base, phase: "playback", spectator: false, now: 0 })).toBe("watch");
    expect(statusOf({ v: { ...base, myTurn: true }, phase: "playback", spectator: false, now: 0 })).toBe(
      "watchMine",
    );
    expect(statusOf({ v: { ...base, myTurn: true }, phase: "input", spectator: false, now: 0 })).toBe("mine");
    expect(statusOf({ v: { ...base, myTurn: true }, phase: "input", spectator: true, now: 0 })).toBe("other");
    expect(statusOf({ v: { ...base, isOut: true }, phase: "input", spectator: false, now: 0 })).toBe(
      "eliminated",
    );
    expect(statusOf({ v: base, phase: "pause", spectator: false, now: 0 })).toBe("ok");
    expect(
      statusOf({
        v: { ...base, last: { turn: 1, player: "b", kind: "timeout", at: 1 } },
        phase: "pause",
        spectator: false,
        now: 0,
      }),
    ).toBe("timeout");
    expect(
      statusOf({ v: { ...base, last: null, lastThrow: null }, phase: "pause", spectator: false, now: 0 }),
    ).toBe("intro");
    expect(statusOf({ v: base, phase: "over", spectator: false, now: 0 })).toBe("over");
  });
});
