import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import {
  zamanBombasiHafizasi as game,
  ZAMAN_BOMBASI_COLORS,
  ZAMAN_BOMBASI_INTRO_MS,
  ZAMAN_BOMBASI_PAUSE_FAIL_MS,
  ZAMAN_BOMBASI_PAUSE_OK_MS,
  type ZamanBombasiColor,
  type ZamanBombasiState,
} from "./index.js";

const T0 = 1_000_000;
const ctx = (now: number, connected: readonly string[] = [], seed = 1) => ({
  now,
  rng: createRng(seed),
  connected,
});
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const start = (n = 4, seed = 1): ZamanBombasiState => game.setup(ids(n), ctx(T0, ids(n), seed));
/** Giriş evresinin başlangıcı (mutlak). */
const inputAt = (s: ZamanBombasiState) => s.turnStart + s.sequence.length * 600;
const deadlineAt = (s: ZamanBombasiState) => inputAt(s) + s.sequence.length * 3000;
const active = (s: ZamanBombasiState) => s.order[s.turnIndex] as string;

function press(s: ZamanBombasiState, id: string, color: ZamanBombasiColor, at: number): ZamanBombasiState {
  const r = game.reduce(s, id, { kind: "press", color }, ctx(at));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const rejection = (s: ZamanBombasiState, id: string, color: ZamanBombasiColor, at: number) => {
  const r = game.reduce(s, id, { kind: "press", color }, ctx(at));
  return isRejected(r) ? r.rejected : null;
};
const wrongColor = (c: ZamanBombasiColor): ZamanBombasiColor =>
  ZAMAN_BOMBASI_COLORS[(ZAMAN_BOMBASI_COLORS.indexOf(c) + 1) % 4] as ZamanBombasiColor;

/** Aktif oyuncu diziyi giriş evresinin başında doğru girer. */
function solve(s: ZamanBombasiState, at = inputAt(s)): ZamanBombasiState {
  let cur = s;
  const who = active(s);
  for (const c of s.sequence) cur = press(cur, who, c, at);
  return cur;
}
/** Aktif oyuncu ilk basışta yanlış basar. */
function failTurn(s: ZamanBombasiState, at = inputAt(s)): ZamanBombasiState {
  return press(s, active(s), wrongColor(s.sequence[0] as ZamanBombasiColor), at);
}

describe("kurulum", () => {
  it("4 renk, ilk dizi 2 eleman, herkes 0 puanda, sıra karıştırılmış tüm oyuncular", () => {
    const s = start(5);
    expect(s.sequence).toHaveLength(2);
    for (const c of s.sequence) expect(ZAMAN_BOMBASI_COLORS).toContain(c);
    expect([...s.order].sort()).toEqual(ids(5));
    expect(Object.values(s.scores)).toEqual([0, 0, 0, 0, 0]);
    expect(s.turnStart).toBe(T0 + ZAMAN_BOMBASI_INTRO_MS);
  });

  it("sıra ctx.rng ile karıştırılır: aynı tohum aynı sıra, farklı tohumlar farklı sıralar verir", () => {
    expect(start(8, 3).order).toEqual(start(8, 3).order);
    const orders = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) orders.add(start(8, seed).order.join());
    expect(orders.size).toBeGreaterThan(5);
  });

  it("aynı renk art arda gelebilir (dizi tekrarlı olabilir)", () => {
    let repeated = false;
    for (let seed = 1; seed <= 200 && !repeated; seed++) {
      const q = start(2, seed).sequence;
      repeated = q[0] === q[1];
    }
    expect(repeated).toBe(true);
  });

  it("dört rengin hepsi üretilir", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) for (const c of start(2, seed).sequence) seen.add(c);
    expect(seen.size).toBe(4);
  });

  it("2–8 oyuncu, dikey yön, anlatım ≤ 3 madde", () => {
    expect([game.minPlayers, game.maxPlayers, game.orientation]).toEqual([2, 8, "portrait"]);
    expect(game.briefing.steps.length).toBeLessThanOrEqual(3);
  });
});

describe("eylem ayrıştırma", () => {
  it("yalnız {kind:'press', color} kabul edilir", () => {
    expect(game.parseAction({ kind: "press", color: "mavi" })).toEqual({ kind: "press", color: "mavi" });
    for (const raw of [
      { kind: "press" },
      { kind: "press", color: "mor" },
      { kind: "press", color: 1 },
      { kind: "press", color: "mavi", extra: 1 },
      { kind: "tap", color: "mavi" },
      [],
      null,
      "mavi",
    ]) {
      expect(game.parseAction(raw)).toBeNull();
    }
  });
});

describe("evreler ve süreler (mutlak zamandan türer)", () => {
  it("hazırlık → oynatma (eleman başına 600 ms) → giriş", () => {
    const s = start(3);
    const t = s.turnStart;
    expect(game.publicView(s, ctx(t - 1)).phase).toBe("pause");
    const p0 = game.publicView(s, ctx(t));
    expect([p0.phase, p0.playbackIndex]).toEqual(["playback", 0]);
    expect(game.publicView(s, ctx(t + 599)).playbackIndex).toBe(0);
    expect(game.publicView(s, ctx(t + 600)).playbackIndex).toBe(1);
    expect(game.publicView(s, ctx(t + 1199)).playbackIndex).toBe(1);
    const inp = game.publicView(s, ctx(t + 1200));
    expect([inp.phase, inp.playbackIndex]).toEqual(["input", -1]);
  });

  it("süre = dizi uzunluğu × 3 sn; görünüm mutlak zamanları verir", () => {
    const s = start(3);
    const v = game.publicView(s, ctx(s.turnStart));
    expect(v.inputStart).toBe(s.turnStart + 1200);
    expect(v.deadline).toBe(v.inputStart + 6000);
    expect(v.stepMs).toBe(600);
    expect(v.length).toBe(2);
  });

  it("oynatma ve hazırlık evresinde basış reddedilir; giriş başlangıcında kabul edilir", () => {
    const s = start(3);
    const who = active(s);
    const c = s.sequence[0] as ZamanBombasiColor;
    expect(rejection(s, who, c, s.turnStart - 10)).toBe("not_input_yet");
    expect(rejection(s, who, c, s.turnStart + 100)).toBe("not_input_yet");
    expect(rejection(s, who, c, inputAt(s) - 1)).toBe("not_input_yet");
    expect(rejection(s, who, c, inputAt(s))).toBeNull();
  });

  it("süre bitiminden 1 ms önceki basış geçerli, bitiş anındaki basış zaman aşımı sayılır", () => {
    const s = start(4);
    const who = active(s);
    const ok = press(s, who, s.sequence[0] as ZamanBombasiColor, deadlineAt(s) - 1);
    expect(ok.entered).toHaveLength(1);
    expect(rejection(s, who, s.sequence[0] as ZamanBombasiColor, deadlineAt(s))).toBe("eliminated");
  });
});

describe("doğru cevap", () => {
  it("dizi 1 uzar, önceki dizi değişmeden başta kalır, sıra sonraki oyuncuya geçer", () => {
    const s = start(4);
    const first = active(s);
    const before = [...s.sequence];
    const t = inputAt(s) + 500;
    const n = solve(s, t);
    expect(n.sequence).toHaveLength(3);
    expect(n.sequence.slice(0, 2)).toEqual(before);
    expect(active(n)).toBe(s.order[1]);
    expect(active(n)).not.toBe(first);
    expect(n.turnStart).toBe(t + ZAMAN_BOMBASI_PAUSE_OK_MS);
    expect(n.eliminated).toEqual([]);
    expect(n.scores).toEqual(s.scores);
    expect(n.last).toMatchObject({ kind: "ok", player: first, at: t });
  });

  it("giriş süresi uzayan diziyle 3 × uzunluk olur", () => {
    const n = solve(start(4));
    expect(deadlineAt(n) - inputAt(n)).toBe(9000);
  });

  it("kısmi doğru basış yankılanır, sıra değişmez", () => {
    const s = start(3);
    const t = inputAt(s);
    const n = press(s, active(s), s.sequence[0] as ZamanBombasiColor, t);
    expect(n.entered).toEqual([s.sequence[0]]);
    expect(active(n)).toBe(active(s));
    expect(game.publicView(n, ctx(t + 10)).pressed).toEqual([s.sequence[0]]);
  });

  it("sıra sabit çevrimde döner: a-c-b-d-a-c-b-d", () => {
    let s = start(4, 7);
    const order = [...s.order];
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) {
      seen.push(active(s));
      s = solve(s);
    }
    expect(seen).toEqual([...order, ...order]);
  });
});

describe("yanlış basış", () => {
  it("ilk yanlış basış anında eler: −1, diğer aktifler +1, dizi yeni 2 renge döner", () => {
    let s = start(4);
    const who = active(s);
    s = solve(s);
    s = solve(s); // dizi 4 uzunluğa çıktı
    expect(s.sequence).toHaveLength(4);
    const victim = active(s);
    const t = inputAt(s) + 700;
    const expected = s.sequence[0] as ZamanBombasiColor;
    const wrong = wrongColor(expected);
    const n = press(s, victim, wrong, t);
    expect(n.eliminated).toEqual([victim]);
    expect(n.scores[victim]).toBe(-1);
    for (const id of ids(4)) if (id !== victim) expect(n.scores[id]).toBe(1);
    expect(n.sequence).toHaveLength(2);
    expect(n.last).toMatchObject({ kind: "fail", player: victim, color: wrong, expected, at: t });
    expect(n.turnStart).toBe(t + ZAMAN_BOMBASI_PAUSE_FAIL_MS);
    expect(who).not.toBe(victim);
  });

  it("yeni dizi 2 elemanlıdır ve eskisinin devamı değildir (yeniden rastgele)", () => {
    let differs = false;
    for (let seed = 1; seed <= 30; seed++) {
      let s = start(4, seed);
      const first = [...s.sequence];
      s = solve(s);
      s = failTurn(s);
      expect(s.sequence).toHaveLength(2);
      if (s.sequence.join() !== first.join()) differs = true;
    }
    expect(differs).toBe(true);
  });

  it("elenen oyuncu sıraya bir daha girmez ve basışı reddedilir", () => {
    let s = start(6);
    const victim = active(s);
    s = failTurn(s);
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      seen.add(active(s));
      s = solve(s);
    }
    expect(seen.has(victim)).toBe(false);
    expect(seen.size).toBe(5);
    expect(rejection(s, victim, "mavi", inputAt(s))).toBe("eliminated");
  });

  it("elenenden sonra sıra çevrimdeki bir sonraki aktif oyuncuya geçer (atlama)", () => {
    let s = start(6, 4);
    s = solve(s); // order[0] doğru
    const victim = active(s); // order[1]
    expect(victim).toBe(s.order[1]);
    s = failTurn(s);
    expect(active(s)).toBe(s.order[2]);
    // sıra tekrar order[0]'a geldiğinde order[1] atlanır
    s = solve(s); // order[2]
    s = solve(s); // order[3]
    s = solve(s); // order[4]
    s = solve(s); // order[5]
    expect(active(s)).toBe(s.order[0]);
    s = solve(s);
    expect(active(s)).toBe(s.order[2]);
  });

  it("puanlar her elenmede birikir: sonradan elenen daha önce kazandığı +1'leri korur", () => {
    let s = start(6);
    const a = active(s);
    s = failTurn(s); // a elenir, diğer 5 kişi +1
    const b = active(s);
    s = failTurn(s); // b elenir: kalan 4 kişi +1 daha
    expect(s.scores[a]).toBe(-1);
    expect(s.scores[b]).toBe(1 - 1);
    const rest = ids(6).filter((x) => x !== a && x !== b);
    for (const id of rest) expect(s.scores[id]).toBe(2);
  });

  it("yanlıştan sonra yeni sıra hazırlık evresiyle başlar (çatlama/pasif gösterimi için)", () => {
    let s = start(4);
    const t = inputAt(s);
    s = failTurn(s, t);
    const v = game.publicView(s, ctx(t + 1));
    expect(v.phase).toBe("pause");
    expect(v.sequence).toHaveLength(2);
    expect(game.publicView(s, ctx(t + ZAMAN_BOMBASI_PAUSE_FAIL_MS)).phase).toBe("playback");
  });
});

describe("zaman aşımı", () => {
  it("hiç cevap gelmezse süre bitiminde yanlışla aynı sonuç uygulanır (tick ile)", () => {
    const s = start(4);
    const victim = active(s);
    const at = deadlineAt(s);
    expect(game.tick(s, ctx(at - 1))).toBe(s);
    const n = game.tick(s, ctx(at));
    expect(n.eliminated).toEqual([victim]);
    expect(n.scores[victim]).toBe(-1);
    for (const id of ids(4)) if (id !== victim) expect(n.scores[id]).toBe(1);
    expect(n.last).toMatchObject({ kind: "timeout", player: victim, at });
    expect(n.turnStart).toBe(at + ZAMAN_BOMBASI_PAUSE_FAIL_MS);
    expect(n.sequence).toHaveLength(2);
  });

  it("yarım girilmiş dizi de süre bitince elenir", () => {
    let s = start(4);
    const who = active(s);
    s = press(s, who, s.sequence[0] as ZamanBombasiColor, inputAt(s));
    const n = game.tick(s, ctx(deadlineAt(s)));
    expect(n.eliminated).toEqual([who]);
    expect(n.entered).toEqual([]);
  });

  it("zaman aşımı kesin an olarak deadline'a işlenir; geç tick sonucu değiştirmez", () => {
    const s = start(5);
    const early = game.tick(s, ctx(deadlineAt(s)));
    const late = game.tick(s, ctx(deadlineAt(s) + 1500));
    expect(late).toEqual(early);
  });

  it("uzun süre tick gelmese de ardışık zaman aşımları sırayla işlenir (tick takviminden bağımsız)", () => {
    const s = start(8);
    const jump = game.tick(s, ctx(T0 + 20_000));
    let step = s;
    for (let t = T0; t <= T0 + 20_000; t += 250) step = game.tick(step, ctx(t));
    expect(jump).toEqual(step);
    expect(jump.eliminated.length).toBeGreaterThanOrEqual(2);
  });

  it("bağlantısı kopan aktif oyuncu yalnız zamanla elenir (tick connected'a bakmaz)", () => {
    const s = start(4);
    const victim = active(s);
    const connectedWithout = ids(4).filter((x) => x !== victim);
    const a = game.tick(s, ctx(deadlineAt(s), connectedWithout));
    const b = game.tick(s, ctx(deadlineAt(s), ids(4)));
    expect(a).toEqual(b);
    expect(a.eliminated).toEqual([victim]);
    // zaman dolmadan kopma sıra atlatmaz
    expect(game.tick(s, ctx(deadlineAt(s) - 1, connectedWithout))).toBe(s);
  });

  it("kopuk oyuncunun sırasından sonra çevrim devam eder", () => {
    const s = start(4);
    const n = game.tick(s, ctx(deadlineAt(s), []));
    expect(active(n)).toBe(s.order[1]);
  });

  it("zaman aşımından sonra gelen eski basış reddedilir, yeni sıranın sahibi önce basamaz", () => {
    const s = start(4);
    const first = active(s);
    const at = deadlineAt(s) + 100;
    expect(rejection(s, first, "mavi", at)).toBe("eliminated");
    const next = s.order[1] as string;
    // yeni sıranın hazırlık evresi: henüz giriş yok
    expect(rejection(s, next, "mavi", at)).toBe("not_input_yet");
  });
});

describe("bitiş", () => {
  const needFor = (n: number) => Math.ceil(n / 2);

  it.each([
    [2, 1],
    [3, 2],
    [4, 2],
    [5, 3],
    [6, 3],
    [7, 4],
    [8, 4],
  ])("%i oyuncu: %i eleme olunca biter (⌈n/2⌉)", (n, need) => {
    expect(needFor(n)).toBe(need);
    let s = start(n);
    for (let i = 0; i < need; i++) {
      expect(game.isFinished(s, ctx(inputAt(s)))).toBe(false);
      s = failTurn(s);
    }
    expect(s.finished).toBe(true);
    expect(s.eliminated).toHaveLength(need);
    expect(game.isFinished(s, ctx(s.endedAt ?? 0))).toBe(true);
  });

  it("son elenme anında biter: sonuç o hatadan hemen sonra açılır", () => {
    let s = start(4);
    s = failTurn(s);
    const t = inputAt(s) + 123;
    s = failTurn(s, t);
    expect(s.endedAt).toBe(t);
    const v = game.publicView(s, ctx(t));
    expect(v.phase).toBe("over");
    expect(v.active).toBeNull();
    expect(v.last?.kind).toBe("fail");
  });

  it("son elenmede kalan aktifler yine +1 alır", () => {
    let s = start(4);
    const a = active(s);
    s = failTurn(s);
    const b = active(s);
    s = failTurn(s);
    expect(s.scores[a]).toBe(-1); // a ilk elendi; b'nin elenmesinde a aktif değil, puan almaz
    expect(s.scores[b]).toBe(0); // elenmeden önce +1 almıştı, sonra −1
    const rest = ids(4).filter((x) => x !== a && x !== b);
    for (const id of rest) expect(s.scores[id]).toBe(2);
  });

  it("zaman aşımıyla da biter", () => {
    let s = start(2);
    const victim = active(s);
    s = game.tick(s, ctx(deadlineAt(s)));
    expect(game.isFinished(s, ctx(deadlineAt(s)))).toBe(true);
    expect(s.scores[victim]).toBe(-1);
  });

  it("isFinished tick'siz de fark eder (zaman aşımı bekleyen son eleme)", () => {
    let s = start(2);
    expect(game.isFinished(s, ctx(deadlineAt(s) - 1))).toBe(false);
    expect(game.isFinished(s, ctx(deadlineAt(s)))).toBe(true);
    s = game.tick(s, ctx(deadlineAt(s)));
    expect(s.finished).toBe(true);
  });

  it("bitişten sonra eylem reddedilir (tick edilmemiş olsa da)", () => {
    const s = start(2);
    const late = deadlineAt(s) + 1;
    const who = active(s);
    const other = ids(2).find((x) => x !== who) as string;
    expect(rejection(s, other, "mavi", late)).toBe("ended");
    const done = game.tick(s, ctx(late));
    expect(rejection(done, other, "mavi", late + 5000)).toBe("ended");
  });

  it("katılımcı olmayan reddedilir; sırası olmayan katılımcı reddedilir", () => {
    const s = start(4);
    expect(rejection(s, "ghost", "mavi", inputAt(s))).toBe("not_participant");
    const other = s.order[1] as string;
    expect(rejection(s, other, "mavi", inputAt(s))).toBe("not_your_turn");
  });

  it("awards = miniScores = puanlar; toplamı tutarlı", () => {
    let s = start(4);
    s = failTurn(s);
    s = failTurn(s);
    const r = game.result(s);
    expect(r.awards).toEqual(r.miniScores);
    expect(r.awards).toEqual(s.scores);
    expect(Object.values(r.awards).sort()).toEqual([-1, 0, 2, 2]);
  });

  it("8 oyuncuda dört eleme: elenenin puanı = (öncesinde aldığı +1 sayısı) − 1, kalanlar 4", () => {
    let s = start(8);
    const victims: string[] = [];
    for (let i = 0; i < 4; i++) {
      victims.push(active(s));
      s = failTurn(s);
    }
    expect(s.finished).toBe(true);
    // i. elenen (0 tabanlı), elenmeden önce aktifken i kez +1 aldı, sonra −1.
    for (const [i, v] of victims.entries()) expect(s.scores[v]).toBe(i - 1);
    for (const id of ids(8).filter((x) => !victims.includes(x))) expect(s.scores[id]).toBe(4);
  });
});

describe("gizlilik ve hafıza oyunu", () => {
  it("gizli bilgi yok", () => {
    expect(game.secrets(start(4))).toEqual([]);
  });

  it("oynatma evresinde dizi herkese görünür (izleyici dahil, aynı publicView)", () => {
    const s = start(4);
    const v = game.publicView(s, ctx(s.turnStart + 10));
    expect(v.sequence).toEqual(s.sequence);
    expect(v.phase).toBe("playback");
  });

  it("giriş evresinde publicView diziyi göstermeye devam etmez", () => {
    let s = start(4);
    s = solve(s); // uzunluk 3
    const t = inputAt(s);
    const v = game.publicView(s, ctx(t + 50));
    expect(v.phase).toBe("input");
    expect(v.sequence).toBeNull();
    expect(JSON.stringify(v)).not.toContain(JSON.stringify(s.sequence));
    expect(v.pressed).toEqual([]);
    // kısmi girişte yalnız basılan önek görünür, tam dizi asla
    const n = press(s, active(s), s.sequence[0] as ZamanBombasiColor, t + 100);
    const v2 = game.publicView(n, ctx(t + 150));
    expect(v2.sequence).toBeNull();
    expect(v2.pressed).toEqual([s.sequence[0]]);
    expect(v2.pressed.length).toBeLessThan(v2.length);
  });

  it("kişisel görünüm de diziyi içermez", () => {
    const s = start(4);
    for (const now of [s.turnStart + 10, inputAt(s) + 10]) {
      for (const id of [...ids(4), null]) {
        const json = JSON.stringify(game.view(s, id, ctx(now)));
        expect(json).not.toContain('"sequence"');
        for (const c of s.sequence) expect(json).not.toContain(`"${c}"`);
      }
    }
  });

  it("zaman aşımı/hata özeti yalnız tek beklenen rengi verir, tam diziyi değil", () => {
    let s = start(4);
    s = failTurn(s);
    const v = game.publicView(s, ctx(s.last?.at ?? 0));
    expect(v.last?.expected).toBeDefined();
    expect(JSON.stringify(v.last)).not.toContain("[");
  });

  it("sıra gelmeden önce dizi hazırlıkta görünür ve giriş başlayınca kaybolur", () => {
    const s = start(3);
    expect(game.publicView(s, ctx(s.turnStart - 100)).sequence).toEqual(s.sequence);
    expect(game.publicView(s, ctx(inputAt(s))).sequence).toBeNull();
  });
});

describe("özel görünüm", () => {
  it("sıra, elenme ve kaç sıra sonra durumu", () => {
    const s = start(4);
    const t = s.turnStart + 1;
    s.order.forEach((id, i) => {
      expect(game.view(s, id, ctx(t))).toEqual({ isOut: false, myTurn: i === 0, turnsAway: i });
    });
    expect(game.view(s, null, ctx(t))).toEqual({ isOut: false, myTurn: false, turnsAway: null });
    expect(game.view(s, "ghost", ctx(t))).toEqual({ isOut: false, myTurn: false, turnsAway: null });
  });

  it("elenen oyuncu pasif; çevrim eleneni atlayarak sayılır", () => {
    let s = start(6, 2);
    s = solve(s);
    const victim = active(s);
    s = failTurn(s);
    expect(game.view(s, victim, ctx(s.turnStart))).toEqual({
      isOut: true,
      myTurn: false,
      turnsAway: null,
    });
    // order[0] şimdi sıranın en sonunda: order[2..5] sonra o → 4 sıra uzakta
    expect(game.view(s, s.order[0] as string, ctx(s.turnStart))).toMatchObject({ turnsAway: 4 });
  });

  it("oyun bitince kimsenin sırası yok", () => {
    let s = start(2);
    s = failTurn(s);
    for (const id of ids(2)) expect(game.view(s, id, ctx(s.endedAt ?? 0)).myTurn).toBe(false);
  });
});

describe("saflık ve belirlilik", () => {
  it("reduce girdi durumunu değiştirmez", () => {
    const s = start(4);
    const snap = JSON.stringify(s);
    press(s, active(s), s.sequence[0] as ZamanBombasiColor, inputAt(s));
    failTurn(s);
    game.tick(s, ctx(deadlineAt(s) + 5000));
    game.publicView(s, ctx(deadlineAt(s) + 5000));
    expect(JSON.stringify(s)).toBe(snap);
  });

  it("görünümler ctx.rng tüketmez (tohum bağımsız, tick takvimi bağımsız)", () => {
    const s = start(4);
    const rng = createRng(9);
    const before = createRng(9).next();
    game.publicView(s, { now: deadlineAt(s) + 20_000, rng, connected: [] });
    game.view(s, "p1", { now: deadlineAt(s) + 20_000, rng, connected: [] });
    expect(rng.next()).toBe(before);
  });

  it("rastgele renkler setup tohumundan türer: aynı tohumla aynı oyun, ardışık diziler tutarlı", () => {
    const a = start(4, 11);
    const b = start(4, 11);
    expect(solve(solve(a)).sequence).toEqual(solve(solve(b)).sequence);
  });
});

describe("bot takvimi", () => {
  it("hem doğru bitmiş sıralar hem elenmeler üretir ve her zaman süre içinde biter", async () => {
    const { BOTS, buildActions, buildTicks, runSimulation } = await import("../../testing/index.js");
    const bot = BOTS["zaman-bombasi-hafizasi"];
    if (!bot) throw new Error("bot yok");
    let withOk = 0;
    let ended = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const players = ids(2 + (seed % 7));
      const out = runSimulation(game, {
        seed,
        players,
        startedAt: 0,
        actions: buildActions(bot, seed, players, 0),
        ticks: buildTicks(seed, "irregular", 0, bot.durationMs),
        durationMs: bot.durationMs,
        disconnectProbability: 0,
      });
      const st = out.state as ZamanBombasiState;
      ended += st.finished ? 1 : 0;
      if (st.turn > st.eliminated.length) withOk++;
    }
    expect(ended).toBe(150);
    expect(withOk).toBeGreaterThan(0);
  });
});
