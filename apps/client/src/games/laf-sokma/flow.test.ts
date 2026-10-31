import { LAF_FINAL_REVEAL_MS, LAF_REVEAL_MS, type LafCardResult } from "@glix/engine";
import { createRoot, createSignal } from "solid-js";
import { describe, expect, it } from "vitest";
import { createVoteChoice } from "./choice.js";
import { duelPlan, duelVerdict, finalPlan, LAF_REVEAL_PLAN } from "./timeline.js";
import { emptyWarning, scoresBefore } from "./view.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("oylama: dokun-seç, sonra onayla", () => {
  function setup(answer = true) {
    const sent: string[] = [];
    const [server, setServer] = createSignal<string | null>(null);
    const choice = createRoot(() =>
      createVoteChoice({
        canPick: (c) => c !== "mine" && c !== "empty",
        serverVote: server,
        send: async (c) => {
          sent.push(c);
          return answer;
        },
      }),
    );
    return { choice, sent, setServer };
  }

  it("dokunmak yalnız seçer; sunucuya bir şey gitmez", () => {
    const { choice, sent } = setup();
    choice.pick("k1");
    expect(choice.picked()).toBe("k1");
    expect(choice.confirmed()).toBe(false);
    expect(sent).toEqual([]);
  });

  it("onaydan önce seçim değiştirilebilir; onay seçili kartı gönderir ve kesinleştirir", async () => {
    const { choice, sent } = setup();
    choice.pick("k1");
    choice.pick("k2");
    expect(choice.picked()).toBe("k2");
    expect(await choice.confirm()).toBe(true);
    expect(sent).toEqual(["k2"]);
    expect(choice.confirmed()).toBe(true);
    choice.pick("k1");
    expect(choice.picked()).toBe("k2");
    expect(await choice.confirm()).toBe(false);
    expect(sent).toEqual(["k2"]);
  });

  it("seçim yokken onay bir şey göndermez; kendi kartın ve Cevap yok kartı seçilemez", async () => {
    const { choice, sent } = setup();
    expect(await choice.confirm()).toBe(false);
    choice.pick("mine");
    choice.pick("empty");
    expect(choice.picked()).toBeNull();
    expect(sent).toEqual([]);
  });

  it("oy reddedilirse seçim yerinde kalır ve yeniden onaylanabilir", async () => {
    const { choice, sent } = setup(false);
    choice.pick("k1");
    expect(await choice.confirm()).toBe(false);
    expect(choice.confirmed()).toBe(false);
    expect(choice.picked()).toBe("k1");
    await choice.confirm();
    expect(sent).toEqual(["k1", "k1"]);
  });

  it("sunucuda oy varsa (yeniden bağlanma) kesin sayılır; yeni soruda sıfırlanır", async () => {
    const { choice, setServer } = setup();
    setServer("k2");
    await tick();
    expect(choice.confirmed()).toBe(true);
    expect(choice.picked()).toBe("k2");
    setServer(null);
    choice.reset();
    expect(choice.picked()).toBeNull();
    expect(choice.confirmed()).toBe(false);
  });
});

describe("yazma akışı: boş soru uyarısı", () => {
  it("ikinci soru boşsa uyarır", () => {
    expect(emptyWarning([true, false])).toBe("2. soruyu boş bıraktın, emin misin?");
    expect(emptyWarning([false, true])).toBe("1. soruyu boş bıraktın, emin misin?");
  });
  it("ikisi doluysa, hiçbiri dolu değilse ya da tek soruysa uyarmaz", () => {
    expect(emptyWarning([true, true])).toBeNull();
    expect(emptyWarning([false, false])).toBeNull();
    expect(emptyWarning([false])).toBeNull();
    expect(emptyWarning([true])).toBeNull();
  });
});

const card = (id: string, author: string, voters: string[], over: Partial<LafCardResult> = {}) => ({
  id,
  author,
  text: `cevap ${id}`,
  voters,
  points: voters.length,
  master: false,
  ...over,
});

describe("açılış zaman çizelgesi", () => {
  const order = ["a", "b", "c", "d", "e", "f", "g", "h"];

  it("düello: oylar katılım sırasıyla tek tek uçar, kart başına sayı artar; hepsi 7 sn'ye sığar", () => {
    const cards = [card("k1", "a", ["e", "c", "g"]), card("k2", "b", ["d", "f", "h"])];
    const p = duelPlan(cards, order);
    expect(p.flights.map((f) => f.voter)).toEqual(["c", "d", "e", "f", "g", "h"]);
    expect(p.flights.find((f) => f.voter === "g")?.nth).toBe(3);
    for (let i = 1; i < p.flights.length; i++) {
      expect(p.flights[i]?.at).toBeGreaterThan(p.flights[i - 1]?.at ?? 0);
    }
    expect(p.flights[0]?.at).toBe(LAF_REVEAL_PLAN.votesAt);
    expect(p.verdictAt).toBeGreaterThan(p.flights[p.flights.length - 1]?.at ?? 0);
    expect(p.doneAt).toBeLessThanOrEqual(LAF_REVEAL_MS);
  });

  it("en çok oyda (6 oy) da karar ve damga açılışa sığar", () => {
    const cards = [
      card("k1", "a", ["c", "d", "e", "f", "g", "h"], { points: 7, master: true }),
      card("k2", "b", []),
    ];
    const p = duelPlan(cards, order);
    expect(p.stampAt + 600).toBeLessThan(LAF_REVEAL_MS);
  });

  it("sonuç türü: Laf Ustası, kazanan, berabere, oy yok, cevapsız", () => {
    expect(duelVerdict([card("k1", "a", ["c", "d"], { master: true }), card("k2", "b", [])])).toBe("master");
    expect(duelVerdict([card("k1", "a", ["c", "d"]), card("k2", "b", ["e"])])).toBe("win");
    expect(duelVerdict([card("k1", "a", ["c"]), card("k2", "b", ["e"])])).toBe("tie");
    expect(duelVerdict([card("k1", "a", []), card("k2", "b", [])])).toBe("none");
    expect(duelVerdict([card("k1", "a", [], { text: null }), card("k2", "b", [], { text: null })])).toBe(
      "empty",
    );
  });

  it("final: kartlar en az oydan en çoğa açılır, taç en çok oy alana; 12 sn'ye sığar", () => {
    const cards = [
      card("k1", "a", ["b", "c", "d"]),
      card("k2", "b", []),
      card("k3", "c", ["a"]),
      card("k4", "d", ["e", "f"]),
      card("k5", "e", []),
      card("k6", "f", []),
      card("k7", "g", ["h"]),
      card("k8", "h", ["g"]),
    ];
    const p = finalPlan(cards);
    const opened = p.opens.map((o) => o.card);
    expect(opened[opened.length - 1]).toBe("k1");
    expect(opened[opened.length - 2]).toBe("k4");
    const pts = opened.map((id) => cards.find((c) => c.id === id)?.points ?? 0);
    expect([...pts].sort((x, y) => x - y)).toEqual(pts);
    expect(p.crowned).toEqual(["k1"]);
    expect(p.crownAt).toBeGreaterThan(p.opens[p.opens.length - 1]?.at ?? 0);
    expect(p.crownAt + 1_500).toBeLessThan(LAF_FINAL_REVEAL_MS);
  });

  it("final: eşit birinciler tacı paylaşır; kimse oy almadıysa taç yok", () => {
    expect(finalPlan([card("k1", "a", ["b"]), card("k2", "b", ["a"])]).crowned).toEqual(["k1", "k2"]);
    expect(finalPlan([card("k1", "a", []), card("k2", "b", [])]).crowned).toEqual([]);
  });

  it("kahkaha şeridi karar anına kadar bu açılışın puanlarını eklemez", () => {
    const reveal = { id: "q1", prompt: "S?", cards: [card("k1", "a", ["c", "d"]), card("k2", "b", ["e"])] };
    expect(scoresBefore({ a: 5, b: 1, c: 0 }, reveal)).toEqual({ a: 3, b: 0, c: 0 });
  });
});
