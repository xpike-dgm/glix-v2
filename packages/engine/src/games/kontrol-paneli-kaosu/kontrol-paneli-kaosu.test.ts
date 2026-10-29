import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import {
  chooseCondition,
  kontrolPaneliKaosu as game,
  matchingPanels,
  panelMatches,
  wirePermutations,
} from "./index.js";
import {
  KONTROL_DURATION_MS,
  KONTROL_PLAY_MS,
  KONTROL_REVEAL_MS,
  type KontrolPublicView,
  type KontrolView,
  WIRE_COLORS,
  type WireColor,
} from "./types.js";

type State = ReturnType<typeof start>;
const T0 = 1_000_000;
const ctx = (now: number, connected: readonly string[] = [], seed = 1) => ({
  now,
  rng: createRng(seed),
  connected,
});
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const start = (players: string[] = ids(4), seed = 1) => game.setup(players, ctx(T0, players, seed));
const tick = (s: State, at: number): State => game.tick(s, ctx(at, s.players));
const pub = (s: State, at: number) => game.publicView(tick(s, at), ctx(at, s.players)) as KontrolPublicView;
const priv = (s: State, who: string | null, at: number) =>
  game.view(tick(s, at), who, ctx(at, s.players)) as KontrolView;

function cut(s: State, who: string, color: WireColor, at = T0 + 1_000, connected?: readonly string[]): State {
  const parsed = game.parseAction({ kind: "cut", color });
  if (parsed === null) throw new Error("geçersiz");
  const r = game.reduce(s, who, parsed, ctx(at, connected ?? s.players));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
function reject(s: State, who: string, color: WireColor, at = T0 + 1_000): string {
  const parsed = game.parseAction({ kind: "cut", color });
  if (parsed === null) throw new Error("geçersiz");
  const r = game.reduce(s, who, parsed, ctx(at, s.players));
  if (!isRejected(r)) throw new Error("kabul edildi");
  return r.rejected;
}
/** Oyuncunun doğru rengi (testte sunucu durumundan). */
const answerOf = (s: State, id: string): WireColor => s.answers[id] as WireColor;
const wrongOf = (s: State, id: string): WireColor =>
  WIRE_COLORS.find((c) => c !== s.answers[id]) as WireColor;
const carrierOf = (s: State, target: string): string =>
  Object.entries(s.targets).find(([, t]) => t === target)?.[0] as string;

describe("kontrol paneli kaosu meta", () => {
  it("2-8 oyuncu, dikey, briefing en çok 3 madde ve teknik kelime yok", () => {
    expect(game.minPlayers).toBe(2);
    expect(game.maxPlayers).toBe(8);
    expect(game.orientation).toBe("portrait");
    expect(game.briefing.steps.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(game.briefing)).not.toMatch(/server|debug|protocol|stage/i);
  });

  it("tek aşama 60 saniye", () => {
    const s = start();
    expect(s.endsAt - s.startedAt).toBe(60_000);
    expect(KONTROL_PLAY_MS).toBe(60_000);
    expect(s.finishAt - s.startedAt).toBe(KONTROL_DURATION_MS);
    expect(KONTROL_REVEAL_MS).toBeLessThanOrEqual(10_000);
  });

  it("dört renk: mavi, yeşil, kırmızı, sarı", () => {
    expect([...WIRE_COLORS]).toEqual(["blue", "green", "red", "yellow"]);
    expect(wirePermutations()).toHaveLength(24);
  });
});

describe("paneller", () => {
  it("her panel dört rengin bir dizilimidir ve oyuncular arasında hepsi farklıdır (2-8 oyuncu, çok tohum)", () => {
    for (let n = 2; n <= 8; n++) {
      for (let seed = 1; seed <= 60; seed++) {
        const s = start(ids(n), seed);
        const seen = new Set<string>();
        for (const id of s.players) {
          const panel = s.panels[id] as WireColor[];
          expect([...panel].sort()).toEqual([...WIRE_COLORS].sort());
          seen.add(panel.join());
        }
        expect(seen.size).toBe(n);
      }
    }
  });

  it("panel dizilimi tohuma göre çeşitlidir (hep aynı sıra değil)", () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) orders.add((start(ids(3), seed).panels.p1 as WireColor[]).join());
    expect(orders.size).toBeGreaterThan(8);
  });
});

describe("ipucu döngüsü", () => {
  it("tek döngü: kimse kendini hedeflemez, herkes tam bir ipucu taşır ve her panelin tam bir taşıyıcısı vardır", () => {
    for (let n = 2; n <= 8; n++) {
      for (let seed = 1; seed <= 40; seed++) {
        const s = start(ids(n), seed);
        expect(Object.keys(s.targets).sort()).toEqual([...s.players].sort());
        expect(Object.values(s.targets).sort()).toEqual([...s.players].sort());
        for (const [carrier, target] of Object.entries(s.targets)) expect(carrier).not.toBe(target);
        // tek döngü: başlangıçtan izlenince tüm oyuncular dolaşılır.
        const seen = new Set<string>();
        let at = s.players[0] as string;
        for (let i = 0; i < n; i++) {
          seen.add(at);
          at = s.targets[at] as string;
        }
        expect(seen.size).toBe(n);
        expect(at).toBe(s.players[0]);
        for (const id of s.players) expect(s.clues[id]).toBeDefined();
      }
    }
  });

  it("iki oyuncuda ipuçları birbirinin panelini anlatır", () => {
    const s = start(ids(2), 3);
    expect(s.targets.p1).toBe("p2");
    expect(s.targets.p2).toBe("p1");
  });
});

describe("ipucu koşulu (özellik testi)", () => {
  it("koşul hedef panelde doğrudur ve hedef paneli kesin tanımlar: 2 ya da 3 konum, yalnız hedef eşleşir", () => {
    for (let n = 2; n <= 8; n++) {
      for (let seed = 1; seed <= 150; seed++) {
        const s = start(ids(n), seed);
        const all = s.players.map((id) => s.panels[id] as WireColor[]);
        for (const carrier of s.players) {
          const target = s.targets[carrier] as string;
          const clue = s.clues[carrier];
          if (!clue) throw new Error("ipucu yok");
          expect([2, 3]).toContain(clue.conditions.length);
          expect(panelMatches(s.panels[target] as WireColor[], clue.conditions)).toBe(true);
          expect(matchingPanels(all, clue.conditions)).toBe(1);
          const positions = clue.conditions.map((c) => c.position);
          expect(new Set(positions).size).toBe(positions.length);
          expect([...positions].sort()).toEqual(positions);
          for (const c of clue.conditions) {
            expect(c.position).toBeGreaterThanOrEqual(1);
            expect(c.position).toBeLessThanOrEqual(4);
            expect(WIRE_COLORS).toContain(c.color);
          }
          expect(WIRE_COLORS).toContain(clue.cut);
          expect(clue.cut).toBe(answerOf(s, target));
        }
      }
    }
  });

  it("tipik oyunlarda iki konum yeter; iki konum hedefi ayırmıyorsa üç konum kullanılır", () => {
    const sizes = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const s = start(ids(8), seed);
      for (const id of s.players) sizes.add(s.clues[id]?.conditions.length as number);
    }
    expect([...sizes]).toEqual([2]);
    // 24 panelin hepsi varken hiçbir iki konum tek paneli ayırmaz: üç konum kullanılır ve yine tek panel eşleşir.
    const every = wirePermutations();
    for (const target of every) {
      const cond = chooseCondition(every, target, () => 0);
      expect(cond).toHaveLength(3);
      expect(panelMatches(target, cond)).toBe(true);
      expect(matchingPanels(every, cond)).toBe(1);
    }
  });

  it("iki oyunculu oyunda tek konum farkı yeter ama ipucu yine de en az iki konumdur", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = start(ids(2), seed);
      for (const id of s.players) expect(s.clues[id]?.conditions.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("ipucu hedefin adını ya da kimliğini içermez", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = start(ids(5), seed);
      for (const id of s.players) {
        const json = JSON.stringify(s.clues[id]);
        for (const other of s.players) expect(json).not.toContain(`"${other}"`);
        expect(Object.keys(s.clues[id] ?? {}).sort()).toEqual(["conditions", "cut"]);
      }
    }
  });

  it("aynı dizilimli paneller varsa (gerçekte olmaz) en az eşleşen üç konumlu koşul seçilir ve hedefte doğrudur", () => {
    const a: WireColor[] = ["blue", "green", "red", "yellow"];
    const panels = [a, [...a], ["red", "blue", "green", "yellow"] as WireColor[]];
    const cond = chooseCondition(panels, a, () => 0);
    expect(cond).toHaveLength(3);
    expect(panelMatches(a, cond)).toBe(true);
    expect(matchingPanels(panels, cond)).toBe(2);
  });
});

describe("kesim", () => {
  it("herkes tek kablo keser; kesim geri alınamaz ve değiştirilemez", () => {
    let s = start();
    s = cut(s, "p1", "red");
    expect(reject(s, "p1", "blue")).toBe("already_cut");
    expect(reject(s, "p1", "red")).toBe("already_cut");
    expect(priv(s, "p1", T0 + 2_000).myCut).toBe("red");
  });

  it("geçersiz renk ayrıştırılmaz; katılımcı olmayan kesemez; süre bitince ve bitişten sonra kesim yok", () => {
    expect(game.parseAction({ kind: "cut", color: "purple" })).toBeNull();
    expect(game.parseAction({ kind: "cut", color: 3 })).toBeNull();
    expect(game.parseAction({ kind: "cut" })).toBeNull();
    expect(game.parseAction({ kind: "cut", color: "red", x: 1 })).toBeNull();
    expect(game.parseAction({ kind: "mavi" })).toBeNull();
    const s = start();
    expect(reject(s, "ghost", "red")).toBe("not_participant");
    expect(reject(s, "p1", "red", s.endsAt)).toBe("ended");
    expect(reject(s, "p1", "red", s.finishAt + 5)).toBe("ended");
    expect(reject(s, "p1", "red", T0 - 1)).toBe("not_started");
  });

  it("kesim sonuca kadar gizli: başkasının kesimi hiçbir görünümde yok, ortak görünüm yalnız kimlerin kestiğini söyler", () => {
    let s = start(ids(4), 7);
    s = cut(s, "p1", "red");
    expect(JSON.stringify(priv(s, "p2", T0 + 2_000))).not.toContain('"myCut":"red"');
    expect(priv(s, "p2", T0 + 2_000).myCut).toBeNull();
    const pj = JSON.stringify(pub(s, T0 + 2_000));
    expect(pub(s, T0 + 2_000).done).toEqual(["p1"]);
    expect(pj).not.toContain("red");
    expect(pj).not.toContain('"cuts"');
    expect(pub(s, T0 + 2_000).reveal).toBeNull();
  });
});

describe("puanlama", () => {
  it("doğru kabloyu kesen +1 ve o panelin ipucu taşıyıcısı +1", () => {
    let s = start(ids(4), 2);
    s = cut(s, "p1", answerOf(s, "p1"));
    const carrier = carrierOf(s, "p1");
    const r = game.result(s);
    expect(r.miniScores[carrier]).toBe(1);
    expect(r.miniScores.p1).toBe(1 + (carrier === "p1" ? 1 : 0));
    expect(carrier).not.toBe("p1");
    expect(r.awards).toEqual(r.miniScores);
  });

  it("yanlış ya da boş kesim 0'dır; ceza yok", () => {
    let s = start(ids(4), 2);
    s = cut(s, "p1", wrongOf(s, "p1"));
    const r = game.result(s);
    for (const id of s.players) expect(r.miniScores[id]).toBe(0);
  });

  it("kimse kesmezse herkes 0", () => {
    const r = game.result(start(ids(5), 4));
    expect(Object.values(r.miniScores)).toEqual([0, 0, 0, 0, 0]);
  });

  it("herkes doğru keserse herkes 2 alır (kendi kesimi + taşıdığı ipucunun hedefi)", () => {
    for (let n = 2; n <= 8; n++) {
      let s = start(ids(n), n);
      for (const id of s.players) s = cut(s, id, answerOf(s, id));
      for (const v of Object.values(game.result(s).miniScores)) expect(v).toBe(2);
    }
  });

  it("taşıyıcı, hedefinin doğru kesimi için +1 alır; yanlış kesimde almaz", () => {
    let s = start(ids(4), 6);
    const target = s.targets.p1 as string;
    s = cut(s, target, wrongOf(s, target));
    expect(game.result(s).miniScores.p1).toBe(0);
    let t = start(ids(4), 6);
    t = cut(t, target, answerOf(t, target));
    expect(game.result(t).miniScores.p1).toBe(1);
  });

  it("genel skora doğrudan eklenir (awards = miniScores)", () => {
    let s = start(ids(3), 9);
    for (const id of s.players) s = cut(s, id, id === "p2" ? wrongOf(s, id) : answerOf(s, id));
    const r = game.result(s);
    expect(r.awards).toEqual(r.miniScores);
  });
});

describe("erken bitiş (tek seferlik hamle)", () => {
  it("(a) herkes kestiyse oyun 1 sn sonra biter", () => {
    let s = start(ids(3));
    for (const id of s.players) s = cut(s, id, "red", T0 + 5_000);
    expect(s.endsAt).toBe(T0 + 6_000);
    expect(s.finishAt).toBe(T0 + 6_000 + KONTROL_REVEAL_MS);
    expect(pub(s, T0 + 5_500).reveal).toBeNull();
    expect(pub(s, T0 + 6_000).stage).toBe("reveal");
    expect(pub(s, T0 + 6_000).reveal).not.toBeNull();
  });

  it("(b) bağlı biri eksikken bitmez (süre dolar)", () => {
    let s = start(ids(3));
    s = cut(s, "p1", "red", T0 + 5_000);
    s = cut(s, "p2", "red", T0 + 5_000);
    expect(s.endsAt).toBe(T0 + KONTROL_PLAY_MS);
  });

  it("(b2) ÖNERİ: bağlantısı kopan oyuncu beklenmez; bağlı herkes kesince 1 sn sonra biter", () => {
    const on = ["p1", "p2"];
    let s = start(ids(3));
    s = cut(s, "p1", "red", T0 + 5_000, on);
    expect(s.endsAt).toBe(T0 + KONTROL_PLAY_MS);
    s = cut(s, "p2", "red", T0 + 5_200, on);
    expect(s.endsAt).toBe(T0 + 6_200);
    expect(pub(s, T0 + 6_200).reveal).not.toBeNull();
    // Kopuk p3 geri dönse de kapanış penceresi geçince kesemez.
    expect(reject(s, "p3", "red", T0 + 6_200)).toBe("ended");
  });

  it("(b3) kimse bağlı değilken erken bitiş olmaz", () => {
    let s = start(ids(2));
    s = cut(s, "p1", "red", T0 + 5_000, []);
    s = cut(s, "p2", "red", T0 + 5_000, []);
    expect(s.endsAt).toBe(T0 + KONTROL_PLAY_MS);
  });

  it("(d) kesimden sonra ikinci kesim reddedilir; kapanış penceresinde de", () => {
    let s = start(ids(2));
    s = cut(s, "p1", "red", T0 + 5_000);
    s = cut(s, "p2", "blue", T0 + 5_000);
    expect(reject(s, "p1", "green", T0 + 5_500)).toBe("already_cut");
  });

  it("(e) kesenler listesi renk sızdırmaz", () => {
    let s = start(ids(3), 11);
    s = cut(s, "p1", "yellow", T0 + 1_000);
    const json = JSON.stringify(pub(s, T0 + 1_100));
    expect(json).not.toContain("yellow");
    expect(pub(s, T0 + 1_100).done).toEqual(["p1"]);
  });
});

describe("gizlilik", () => {
  it("(yapısal) herkes yalnız kendi panelini görür; ortak görünümde sonuçtan önce panel, ipucu, hedef eşlemesi yok", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = start(ids(5), seed);
      const t = T0 + 5_000;
      const pj = JSON.stringify(pub(s, t));
      expect(pj).not.toContain("panel");
      expect(pj).not.toContain("clue");
      expect(pj).not.toContain("carrier");
      for (const id of s.players) {
        const v = priv(s, id, t);
        expect(v.panel).toEqual(s.panels[id]);
        const j = JSON.stringify(v);
        for (const other of s.players) {
          if (other !== id) expect(j).not.toContain(JSON.stringify(s.panels[other]));
        }
      }
    }
  });

  it("(yapısal) ipucu yalnız taşıyıcısının görünümünde; hedef panelin sahibi kendi ipucunu bilmez", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = start(ids(4), seed);
      for (const id of s.players) {
        const v = priv(s, id, T0 + 1_000);
        expect(v.clue).toEqual(s.clues[id]);
        for (const other of s.players) {
          if (other === id) continue;
          // başkasının ipucu (tam yapısal veri) görünümde yok
          expect(JSON.stringify(v)).not.toContain(JSON.stringify(s.clues[other]));
        }
      }
    }
  });

  it("secrets: paneller ve ipuçları yalnız sahibinde; sonuç açılınca boş", () => {
    const s = start(ids(3));
    const entries = game.secrets(s);
    expect(entries).toHaveLength(6);
    for (const e of entries) expect(e.ownerIds).toHaveLength(1);
    expect(game.secrets(tick(s, s.endsAt))).toEqual([]);
  });

  it("izleyici görünümü boştur", () => {
    const s = start();
    expect(priv(s, null, T0 + 1)).toEqual({ panel: [], clue: null, myCut: null });
    expect(priv(s, "ghost", T0 + 1)).toEqual({ panel: [], clue: null, myCut: null });
  });
});

describe("açılış", () => {
  it("sonuç tüm panelleri, kesimleri, doğruluğu ve ipucu taşıyıcılarını açar", () => {
    let s = start(ids(3), 5);
    s = cut(s, "p1", answerOf(s, "p1"));
    s = cut(s, "p2", wrongOf(s, "p2"));
    const rev = pub(s, s.endsAt).reveal;
    expect(rev?.rows.p1).toMatchObject({
      cut: answerOf(s, "p1"),
      correct: true,
      carrier: carrierOf(s, "p1"),
    });
    expect(rev?.rows.p2).toMatchObject({ correct: false });
    expect(rev?.rows.p3).toMatchObject({ cut: null, correct: false });
    expect(rev?.rows.p1?.panel).toEqual(s.panels.p1);
    expect(rev?.rows.p1?.clue).toEqual(s.clues[carrierOf(s, "p1")]);
    expect(rev?.scores).toEqual(game.result(s).miniScores);
  });

  it("aşama tick ile ilerler ve geçişte durum değişir (yayın tetiklenir)", () => {
    const s = start();
    const t1 = tick(s, s.endsAt);
    expect(t1).not.toBe(s);
    expect(t1.stage).toBe("reveal");
    expect(tick(t1, s.endsAt + 5)).toBe(t1);
    expect(game.isFinished(s, ctx(s.finishAt - 1))).toBe(false);
    expect(game.isFinished(s, ctx(s.finishAt))).toBe(true);
  });
});
