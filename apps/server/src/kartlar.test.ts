import {
  type AnyGame,
  CARD_IDS,
  CARDS_DONE_GRACE_MS,
  CARDS_MS,
  type CardId,
  type CardsState,
  GAMES,
  type GameResult,
  replayCards,
  replayWithCards,
} from "@glix/engine";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Client, join, k, setupRoom, sync, until, useServer } from "./testkit.js";

/** Tohum sabit: maç tohumu (`randomInt(2**32)`) her testte aynı. */
useServer({ randomInt: (max) => (max > 1_000_000 ? 12345 : 0) });

/** Hemen biten sahte oyunlar: sıra katılım sırasıdır (ilk oyuncu birinci). Ham puan: 2 / 1 / 0. */
const QUICK_IDS = Array.from({ length: 24 }, (_, i) => `kt-${i + 1}`);
let failing = false;

function quickGame(id: string): AnyGame {
  return {
    id,
    name: `Deneme ${id.slice(3)}`,
    minPlayers: 2,
    maxPlayers: 8,
    orientation: "portrait",
    briefing: { goal: "g", steps: [] },
    parseAction: () => null,
    setup: (players: string[]) => ({ players }),
    reduce: () => ({ rejected: "no" }),
    tick: (s: unknown) => s,
    publicView: () => ({}),
    view: () => ({}),
    isFinished: () => true,
    result(s: { players: string[] }): GameResult {
      if (failing) throw new Error("kasıtlı hata");
      const n = s.players.length;
      return {
        miniScores: Object.fromEntries(s.players.map((id, i) => [id, (n - i) * 10])),
        awards: Object.fromEntries(s.players.map((id, i) => [id, Math.max(0, n - 1 - i)])),
      };
    },
    secrets: () => [],
  };
}

beforeAll(() => {
  for (const id of QUICK_IDS) GAMES[id] = quickGame(id);
});
afterAll(() => {
  for (const id of QUICK_IDS) delete GAMES[id];
});

const rt = () => k.srv.runtime;
const roomOf = (c: Client) => {
  const room = rt().rooms.get(c.session.roomCode);
  if (!room) throw new Error("oda yok");
  return room;
};
const cardsOf = (c: Client): CardsState => {
  const cards = roomOf(c).match?.cards;
  if (!cards) throw new Error("kart durumu yok");
  return cards;
};
const idOf = (c: Client): string => c.session.playerId;
const setHand = (host: Client, who: Client, hand: CardId[]): void => {
  const pc = cardsOf(host).by[idOf(who)];
  if (pc) pc.hand = [...hand];
};
const setPending = (host: Client, who: Client, cards: CardId[]): void => {
  const pc = cardsOf(host).by[idOf(who)];
  if (pc) pc.pending = [...cards];
};
const scoreOf = (c: Client, who: Client): number =>
  c.room.players.find((p) => p.id === idOf(who))?.score ?? NaN;
const mine = (c: Client) => c.room.match?.mine ?? null;

/** Tüm kartlar açık, yalnız `only` açık, ya da özel ayar. */
async function configure(host: Client, enabled: boolean, off: CardId[] = []): Promise<void> {
  host.send({ type: "setCards", enabled, off });
  await until(
    () => host.room.cardSettings?.enabled === enabled && host.room.cardSettings.off.length === off.length,
    "kart ayarı",
  );
}
const allBut = (...keep: CardId[]): CardId[] => CARD_IDS.filter((id) => !keep.includes(id));

async function start(cs: Client[], games: string[]): Promise<void> {
  const host = cs[0] as Client;
  host.send({ type: "setGames", gameIds: games });
  await until(
    () => host.room.gameIds.length === games.length && host.room.gameIds[0] === games[0],
    "oyun seçimi",
  );
  host.send({ type: "startMatch" });
  await until(() => host.room.phase === "briefing", "briefing");
}

/** Anlatımdan sonuç ekranına kadar: herkes hazır, geri sayım, oyun hemen biter. */
async function playOut(cs: Client[]): Promise<void> {
  const host = cs[0] as Client;
  for (const c of cs) c.send({ type: "ready" });
  await until(() => host.room.phase === "countdown", "countdown");
  k.clock.advance(3000);
  await until(() => host.room.phase === "results", "results");
}

/** Sonuç ekranından sonra: kart seçimi varsa onun açıldığı, yoksa sıradaki anlatımın açıldığı ana kadar. */
async function afterResults(cs: Client[]): Promise<"cards" | "briefing" | "final"> {
  const host = cs[0] as Client;
  k.clock.advance(30_000);
  await until(() => ["cards", "briefing", "final"].includes(host.room.phase), "sonuç sonrası");
  return host.room.phase as "cards" | "briefing" | "final";
}

/** Kart seçimini sürenin dolmasıyla geçer. */
async function skipCards(cs: Client[]): Promise<void> {
  const host = cs[0] as Client;
  k.clock.advance(CARDS_MS);
  await until(() => host.room.phase === "briefing", "kart seçimi bitti");
}

/** `n` oyunu sırayla oynar (kart aşamaları süreyle geçilir); sonda sonuç ekranında bırakır. */
async function playGames(cs: Client[], n: number): Promise<void> {
  const host = cs[0] as Client;
  for (let g = 0; g < n; g++) {
    await playOut(cs);
    if (g === n - 1) return;
    const next = await afterResults(cs);
    if (next === "cards") await skipCards(cs);
    await until(() => host.room.match?.round === g + 1, "sıradaki oyun");
  }
}

describe("kart seçimi aşaması", () => {
  it("her 3. oyundan sonra gelir, son oyundan sonra gelmez", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const host = cs[0] as Client;
    await start(cs, QUICK_IDS.slice(0, 7));
    const phases: string[] = [];
    for (let g = 0; g < 7; g++) {
      await playOut(cs);
      const next = await afterResults(cs);
      phases.push(next);
      if (next === "cards") await skipCards(cs);
      else if (next === "briefing") await sync();
    }
    // Oyun 1,2 → briefing; 3 → cards; 4,5 → briefing; 6 → cards; 7 → final
    expect(phases).toEqual(["briefing", "briefing", "cards", "briefing", "briefing", "cards", "final"]);
    expect(host.room.phase).toBe("final");
  });

  it("tam 6 oyunluk maçta son oyundan önce yalnız bir kez (3. sonrası)", async () => {
    const cs = await setupRoom(["A", "B"]);
    await start(cs, QUICK_IDS.slice(0, 6));
    const phases: string[] = [];
    for (let g = 0; g < 6; g++) {
      await playOut(cs);
      const next = await afterResults(cs);
      phases.push(next);
      if (next === "cards") await skipCards(cs);
    }
    expect(phases.filter((p) => p === "cards")).toHaveLength(1);
    expect(phases.at(-1)).toBe("final");
  });

  it("herkes 15 sn süreyle 3 seçenek görür; seçenekler benzersiz ve kendisine özel", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const [a, b] = cs as [Client, Client, Client];
    await start(cs, QUICK_IDS.slice(0, 4));
    await playGames(cs, 3);
    expect(await afterResults(cs)).toBe("cards");
    const m = a.room.match;
    expect((m?.phaseEndsAt ?? 0) - (m?.phaseStartedAt ?? 0)).toBe(CARDS_MS);
    for (const c of cs) {
      const opts = mine(c)?.pick?.options ?? [];
      expect(opts).toHaveLength(3);
      expect(new Set(opts).size).toBe(3);
      expect(opts.every((o) => o !== null)).toBe(true);
    }
    expect(mine(a)?.pick?.options).toEqual(cardsOf(a).picking?.[idOf(a)]?.options);
    expect(mine(b)?.pick?.options).toEqual(cardsOf(a).picking?.[idOf(b)]?.options);
    // Herkese açık görünümde yalnız kimlerin bitirdiği vardır
    expect(a.room.match?.cards?.phase).toEqual({ done: [], silenced: [] });
  });

  it("süre dolunca seçmeyen herkes rastgele kart alır", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const [a] = cs as [Client, Client, Client];
    await start(cs, QUICK_IDS.slice(0, 4));
    await playGames(cs, 3);
    await afterResults(cs);
    await skipCards(cs);
    const state = cardsOf(a);
    for (const c of cs) {
      const pc = state.by[idOf(c)];
      const bad = state.announce.filter((x) => x.playerId === idOf(c)).length;
      expect((pc?.hand.length ?? 0) + bad).toBeGreaterThanOrEqual(1);
    }
    expect(a.room.phase).toBe("briefing");
    expect(a.room.match?.round).toBe(3);
  });

  it("bağlı herkes seçince aşama 1 sn sonra erken biter", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a] = cs as [Client, Client];
    await configure(
      a,
      true,
      CARD_IDS.filter((id) => id !== "kalkan" && id !== "takviye" && id !== "sigorta"),
    );
    await start(cs, QUICK_IDS.slice(0, 4));
    await playGames(cs, 3);
    await afterResults(cs);
    for (const c of cs) c.send({ type: "pickCard", index: 0 });
    await until(() => (a.room.match?.cards?.phase?.done.length ?? 0) === 2, "iki kişi bitirdi");
    expect((a.room.match?.phaseEndsAt ?? 0) - k.clock.now()).toBeLessThanOrEqual(CARDS_DONE_GRACE_MS);
    k.clock.advance(CARDS_DONE_GRACE_MS);
    await until(() => a.room.phase === "briefing", "erken bitti");
    expect(a.room.match?.cards?.hands).toEqual({ [idOf(a)]: 1, [idOf(cs[1] as Client)]: 1 });
  });

  it("el dolu iken iyi kart seçilirse değiştirme adımı gelir", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    await configure(a, true, allBut("kalkan", "takviye", "sigorta", "ayna"));
    await start(cs, QUICK_IDS.slice(0, 4));
    await playGames(cs, 3);
    // Eller kart seçiminden önce doldurulur
    setHand(a, a, ["tahmin", "vergi"]);
    setHand(a, b, ["tahmin", "vergi"]);
    await afterResults(cs);
    const first = mine(a)?.pick?.options[0] as CardId;
    a.send({ type: "pickCard", index: 0 });
    await until(() => mine(a)?.pick?.held === first, "değiştirme bekliyor");
    expect(mine(a)?.pick?.done).toBe(false);
    // Başka seçim yapamaz
    a.send({ type: "pickCard", index: 1 });
    await until(() => a.of("error").length > 0, "ikinci seçim reddi");
    expect(a.lastError?.code).toBe("card_invalid");
    a.send({ type: "discardCard", index: 0 });
    await until(() => mine(a)?.pick?.done === true, "değiştirme bitti");
    expect(mine(a)?.hand).toEqual(["vergi", first]);
    // b: süre dolunca yeni kart atılır, el korunur
    k.clock.advance(CARDS_MS);
    await until(() => a.room.phase === "briefing", "briefing");
    expect(mine(b)?.hand).toEqual(["tahmin", "vergi"]);
  });

  it("kötü kart ele girmez, duyurulur (aşama bitince) ve sonraki oyunda işler", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    await configure(a, true, allBut("talihsizlik"));
    await start(cs, QUICK_IDS.slice(0, 4));
    await playGames(cs, 3);
    await afterResults(cs);
    a.send({ type: "pickCard", index: 0 });
    await until(() => mine(a)?.pick?.done ?? false, "a seçti");
    // Aşama sürerken kimin ne çektiği açıklanmaz
    expect(a.room.match?.cards?.announce).toEqual([]);
    expect(JSON.stringify(b.room.match?.cards)).not.toContain("talihsizlik");
    k.clock.advance(CARDS_MS);
    await until(() => a.room.phase === "briefing", "briefing");
    const ann = a.room.match?.cards?.announce ?? [];
    expect(ann.map((x) => x.cardId)).toEqual(["talihsizlik", "talihsizlik"]);
    expect(mine(a)?.hand).toEqual([]);
    const beforeA = scoreOf(a, a);
    const beforeB = scoreOf(a, b);
    await playOut(cs); // 4. oyun: ham 1 / 0, Talihsizlik −1 → 0 / −1
    expect([scoreOf(a, a) - beforeA, scoreOf(a, b) - beforeB]).toEqual([0, -1]);
    expect(a.room.match?.cards?.announce).toEqual([]);
    expect(a.room.match?.result?.awards).toEqual({ [idOf(a)]: 0, [idOf(b)]: -1 });
  });
});

describe("gizlilik", () => {
  it("izleyici ve sahne seçenekleri, eli, oynanan gizli kartı görmez", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    await start(cs, QUICK_IDS.slice(0, 5));
    setHand(a, a, ["ters-kose", "kalkan"]);
    setHand(a, b, ["ayna", "kendine-guven"]);
    const spec = await join(a.session.roomCode, "İzleyici");
    const tv = await (async () => {
      const { Client: C } = await import("./testkit.js");
      const c = await C.connect();
      c.send({ type: "joinStage", code: a.session.roomCode });
      await until(() => c.updates.length > 0, "sahne");
      return c;
    })();
    expect(spec.room.players.find((p) => p.id === idOf(spec))?.spectator).toBe(true);
    await sync();
    for (const c of [spec, tv]) {
      expect(c.room.match?.mine ?? null).toBeNull();
      expect(c.room.match?.cards?.hands).toEqual({ [idOf(a)]: 2, [idOf(b)]: 2 });
    }
    // b Ayna oynar; a ve izleyiciler görmez
    b.send({ type: "playCard", card: "ayna" });
    await until(() => mine(b)?.staged?.cardId === "ayna", "staged");
    await sync();
    const wire = (c: Client) => JSON.stringify(c.msgs);
    for (const c of [a, spec, tv]) {
      expect(wire(c)).not.toContain("kendine-guven");
    }
    expect(wire(spec)).not.toContain("ters-kose");
    expect(wire(tv)).not.toContain("ters-kose");
    expect(wire(b)).not.toContain("ters-kose");
    // Kesinleşince Ayna herkese açık oynayış listesine girmez; sahibi görür
    await playOut(cs);
    for (const c of [a, spec, tv]) expect(c.room.match?.cards?.plays ?? []).toEqual([]);
    expect(mine(b)?.played?.cardId).toBeUndefined(); // sonuç ekranında oynanan temizlendi
  });

  it("kart seçimi sürerken izleyici ve diğer oyuncu seçenekleri görmez; yalnız bitenler görünür", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    await configure(a, true, ["ters-kose"]);
    await start(cs, QUICK_IDS.slice(0, 4));
    await playGames(cs, 3);
    const spec = await join(a.session.roomCode, "İzleyici");
    await afterResults(cs);
    await until(() => spec.room.phase === "cards", "izleyici de aşamada");
    expect(mine(spec)).toBeNull();
    const optsA = mine(a)?.pick?.options as CardId[];
    // Seçenekler yalnız kendi görünümünde: izleyicinin hiçbir mesajında a'nın seçeneğine özgü sayım yoktur
    expect(JSON.stringify(spec.room.match)).not.toContain('"options"');
    expect(JSON.stringify(b.room.match?.cards)).not.toContain('"options"');
    expect(optsA).toHaveLength(3);
    a.send({ type: "pickCard", index: 0 });
    await until(() => spec.room.match?.cards?.phase?.done.includes(idOf(a)) === true, "bitti bilgisi");
  });
});

describe("yeniden bağlanma", () => {
  it("kart seçimi sırasında dönen oyuncu seçeneklerini ve elini görür", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    await start(cs, QUICK_IDS.slice(0, 4));
    await playGames(cs, 3);
    setHand(a, b, ["kalkan"]);
    await afterResults(cs);
    const opts = mine(b)?.pick?.options;
    const token = b.session.token;
    b.ws.terminate();
    await until(() => a.room.players.find((p) => p.id === idOf(b))?.connected === false, "koptu");
    const { Client: C } = await import("./testkit.js");
    const back = await C.connect();
    back.send({ type: "resume", token });
    await until(() => back.updates.length > 0, "döndü");
    expect(mine(back)?.pick?.options).toEqual(opts);
    expect(mine(back)?.hand).toEqual(["kalkan"]);
    back.send({ type: "pickCard", index: 0 });
    await until(() => mine(back)?.pick?.got.length === 1, "seçti");
  });

  it("anlatımda dönen oyuncu elini ve oynadığı kartı görür", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    await start(cs, QUICK_IDS.slice(0, 3));
    setHand(a, b, ["takviye", "kalkan"]);
    b.send({ type: "playCard", card: "takviye" });
    await until(() => mine(b)?.staged?.cardId === "takviye", "oynadı");
    const token = b.session.token;
    b.ws.terminate();
    await sync();
    const { Client: C } = await import("./testkit.js");
    const back = await C.connect();
    back.send({ type: "resume", token });
    await until(() => back.updates.length > 0, "döndü");
    expect(mine(back)?.hand).toEqual(["kalkan"]);
    expect(mine(back)?.staged?.cardId).toBe("takviye");
  });
});

describe("lobi ayarı", () => {
  it("varsayılan: açık ve hiçbir kart kapalı değil; misafir yalnız okur", async () => {
    const [a, b] = (await setupRoom(["A", "B"])) as [Client, Client];
    expect(a.room.cardSettings).toEqual({ enabled: true, off: [] });
    b.send({ type: "setCards", enabled: false, off: [] });
    await until(() => b.of("error").length > 0, "reddedildi");
    expect(b.lastError?.code).toBe("not_host");
    await configure(a, true, ["kalkan", "bos-el"]);
    await until(() => b.room.cardSettings?.off.length === 2, "misafir görür");
    expect(b.room.cardSettings).toEqual({ enabled: true, off: ["kalkan", "bos-el"] });
  });

  it("geçersiz ayar reddedilir; maç sürerken değişmez; lobiye dönünce korunur", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a] = cs as [Client, Client];
    a.send({ type: "setCards", enabled: true, off: ["yok-boyle-kart"] });
    a.send({ type: "setCards", enabled: true, off: ["kalkan", "kalkan"] });
    await until(() => a.of("error").length >= 2, "iki geçersiz");
    expect(a.of("error").every((e) => e.code === "invalid_message")).toBe(true);
    await configure(a, true, ["kalkan"]);
    await start(cs, QUICK_IDS.slice(0, 1));
    a.send({ type: "setCards", enabled: false, off: [] });
    await until(() => a.of("error").some((e) => e.code === "wrong_phase"), "maçta reddedildi");
    expect(a.room.cardSettings).toEqual({ enabled: true, off: ["kalkan"] });
    await playOut(cs);
    k.clock.advance(30_000);
    await until(() => a.room.phase === "final", "final");
    a.send({ type: "returnToLobby" });
    await until(() => a.room.phase === "lobby", "lobi");
    expect(a.room.cardSettings).toEqual({ enabled: true, off: ["kalkan"] });
  });

  it("ana anahtar kapalıyken kart seçimi, el ve kart bilgisi yoktur", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a] = cs as [Client, Client];
    await configure(a, false);
    await start(cs, QUICK_IDS.slice(0, 5));
    expect(a.room.match?.cards ?? null).toBeNull();
    expect(a.room.match?.mine ?? null).toBeNull();
    await playGames(cs, 4);
    expect(a.room.match?.round).toBe(3);
    expect(a.room.phase).toBe("results");
    a.send({ type: "playCard", card: "kalkan" });
    await until(() => a.of("error").length > 0, "hata");
    expect(a.lastError?.code).toBe("wrong_phase");
  });

  it("bütün kartlar kapatılınca aşama atlanır", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a] = cs as [Client, Client];
    await configure(a, true, [...CARD_IDS]);
    await start(cs, QUICK_IDS.slice(0, 5));
    await playGames(cs, 4);
    expect(a.room.match?.round).toBe(3);
    expect(a.room.match?.cards ?? null).toBeNull();
  });

  it("yalnız kötü kartlar etkinse herkes kötü kart çeker", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a] = cs as [Client, Client];
    await configure(
      a,
      true,
      CARD_IDS.filter((id) => !["talihsizlik", "agir-yuk"].includes(id)),
    );
    await start(cs, QUICK_IDS.slice(0, 4));
    await playGames(cs, 3);
    await afterResults(cs);
    expect(mine(a)?.pick?.options).toHaveLength(2);
    await skipCards(cs);
    expect(a.room.match?.cards?.announce).toHaveLength(2);
    expect(a.room.match?.cards?.hands).toEqual({ [idOf(a)]: 0, [idOf(cs[1] as Client)]: 0 });
  });
});

describe("kart oynama ve oyun sonu", () => {
  it("oynanan kart oyun başında açıklanır, sonuç satırı ve puan etkisi oluşur", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const [a, b, c] = cs as [Client, Client, Client];
    await start(cs, QUICK_IDS.slice(0, 2));
    setHand(a, c, ["cift-puan"]); // C sonuncu: ham 0 → ×2 = 0, A'ya Takviye
    setHand(a, a, ["takviye"]);
    setHand(a, b, ["celme"]);
    c.send({ type: "playCard", card: "cift-puan" });
    a.send({ type: "playCard", card: "takviye" });
    b.send({ type: "playCard", card: "celme", target: idOf(a) });
    await until(() => mine(b)?.staged?.cardId === "celme", "staged");
    // Anlatım sırasında kimse başkasının kartını görmez
    expect(a.room.match?.cards?.plays).toEqual([]);
    for (const x of cs) x.send({ type: "ready" });
    await until(() => a.room.phase === "countdown", "countdown");
    // Kesinleşti: herkese açık, oynanma sırasıyla
    expect(a.room.match?.cards?.plays.map((p) => [p.cardId, p.target])).toEqual([
      ["cift-puan", undefined],
      ["takviye", undefined],
      ["celme", idOf(a)],
    ]);
    expect(mine(a)?.played?.cardId).toBe("takviye");
    expect(mine(a)?.hand).toEqual([]);
    k.clock.advance(3000);
    await until(() => a.room.phase === "results", "results");
    // Ham: A 2, B 1, C 0 → Takviye A 3, Çelme A 2 → A 2; B 1; C 0
    expect(a.room.match?.result?.awards).toEqual({ [idOf(a)]: 2, [idOf(b)]: 1, [idOf(c)]: 0 });
    expect(a.room.match?.cards?.lines.map((l) => l.cardId).sort()).toEqual(["celme", "cift-puan", "takviye"]);
    expect(a.room.match?.cards?.plays).toEqual([]);
    expect([scoreOf(a, a), scoreOf(a, b), scoreOf(a, c)]).toEqual([2, 1, 0]);
    // Oynanan kartlar yandı
    expect(cardsOf(a).by[idOf(a)]?.hand).toEqual([]);
  });

  it("anlatım bitmeden geri alınan kart ele döner; bitince kesinleşir", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a] = cs as [Client, Client];
    await start(cs, QUICK_IDS.slice(0, 2));
    setHand(a, a, ["takviye"]);
    a.send({ type: "playCard", card: "takviye" });
    await until(() => mine(a)?.staged !== null, "oynadı");
    a.send({ type: "unplayCard" });
    await until(() => mine(a)?.staged === null, "geri alındı");
    expect(mine(a)?.hand).toEqual(["takviye"]);
    a.send({ type: "playCard", card: "takviye" });
    await until(() => mine(a)?.staged !== null, "yine oynadı");
    await playOut(cs);
    expect(scoreOf(a, a)).toBe(2); // ham 1 (iki oyuncu: 1 / 0) + Takviye 1
    a.send({ type: "unplayCard" });
    await until(() => a.of("error").some((e) => e.code === "wrong_phase"), "sonuçta geri alınamaz");
  });

  it("geçersiz kart eylemleri reddedilir", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const [a, b] = cs as [Client, Client, Client];
    await start(cs, QUICK_IDS.slice(0, 3));
    setHand(a, a, ["celme", "takviye"]);
    const errs = () => a.of("error").length;
    const expectBad = async (msg: Record<string, unknown>, code: string): Promise<void> => {
      const n = errs();
      a.send(msg);
      await until(() => errs() > n, "hata bekleniyor");
      expect(a.lastError?.code).toBe(code);
    };
    await expectBad({ type: "playCard", card: "kalkan" }, "card_invalid"); // elinde yok
    await expectBad({ type: "playCard", card: "celme" }, "card_invalid"); // hedef yok
    await expectBad({ type: "playCard", card: "celme", target: idOf(a) }, "card_invalid"); // kendine
    await expectBad({ type: "playCard", card: "celme", target: "yok" }, "card_invalid");
    await expectBad({ type: "playCard", card: "takviye", target: idOf(b) }, "card_invalid");
    await expectBad({ type: "pickCard", index: 0 }, "wrong_phase");
    const n = errs();
    a.send({ type: "playCard", card: "bilinmeyen" });
    await until(() => errs() > n, "bilinmeyen kart");
    expect(a.lastError?.code).toBe("invalid_message");
    // İzleyici oynayamaz
    const spec = await join(a.session.roomCode, "İzleyici");
    spec.send({ type: "playCard", card: "takviye" });
    await until(() => spec.of("error").length > 0, "izleyici");
    expect(spec.lastError?.code).toBe("not_participant");
  });

  it("oynayan ayrılırsa kartı etkisiz kalır", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const [a, b, c] = cs as [Client, Client, Client];
    await start(cs, QUICK_IDS.slice(0, 2));
    setHand(a, c, ["celme"]);
    c.send({ type: "playCard", card: "celme", target: idOf(a) });
    await until(() => mine(c)?.staged !== null, "oynadı");
    c.send({ type: "leaveRoom" });
    await sync();
    await until(() => a.room.players.length === 2, "ayrıldı");
    await playOut([a, b]);
    expect(a.room.match?.result?.awards[idOf(a)]).toBe(2);
    expect(a.room.match?.cards?.lines).toEqual([]);
  });
});

describe("her kartın etkisi (maç içinde)", () => {
  /**
   * Üç oyuncu (A birinci, B ikinci, C son; ham puan 2/1/0), her oyunda bir senaryo: ellerin ve bekleyen kötü kartların
   * kurulumu, oynananlar ve beklenen nihai puanlar [A, B, C].
   */
  interface Scenario {
    name: string;
    hands?: Partial<Record<"A" | "B" | "C", CardId[]>>;
    pending?: Partial<Record<"A" | "B" | "C", CardId[]>>;
    plays: { who: "A" | "B" | "C"; card: CardId; target?: "A" | "B" | "C" }[];
    expect: [number, number, number];
  }
  const T = (...a: [string, Scenario["plays"], Scenario["expect"], Partial<Scenario>?]): Scenario => ({
    name: a[0],
    plays: a[1],
    expect: a[2],
    ...(a[3] ?? {}),
  });
  const scenarios: Scenario[] = [
    T("Kalkan", [{ who: "C", card: "kalkan" }], [2, 1, 0], {
      hands: { C: ["kalkan"] },
      pending: { C: ["talihsizlik"] },
    }),
    T("Sigorta", [{ who: "C", card: "sigorta" }], [2, 1, 1], { hands: { C: ["sigorta"] } }),
    T("Takviye", [{ who: "B", card: "takviye" }], [2, 2, 0], { hands: { B: ["takviye"] } }),
    T("Kendine Güven", [{ who: "A", card: "kendine-guven" }], [4, 1, 0], { hands: { A: ["kendine-guven"] } }),
    T("Tahmin", [{ who: "C", card: "tahmin", target: "A" }], [2, 1, 2], { hands: { C: ["tahmin"] } }),
    T("Ortaklık", [{ who: "C", card: "ortaklik", target: "A" }], [1, 1, 1], { hands: { C: ["ortaklik"] } }),
    T(
      "Koruma + Çelme",
      [
        { who: "B", card: "koruma", target: "A" },
        { who: "C", card: "celme", target: "A" },
      ],
      [2, 1, 0],
      { hands: { B: ["koruma"], C: ["celme"] } },
    ),
    T(
      "Ayna + Çelme",
      [
        { who: "A", card: "ayna" },
        { who: "C", card: "celme", target: "A" },
      ],
      [2, 1, -1],
      { hands: { A: ["ayna"], C: ["celme"] } },
    ),
    T("Vergi", [{ who: "C", card: "vergi", target: "A" }], [1, 1, 1], { hands: { C: ["vergi"] } }),
    T("Çelme", [{ who: "C", card: "celme", target: "B" }], [2, 0, 0], { hands: { C: ["celme"] } }),
    T("Geniş Seçim", [{ who: "A", card: "genis-secim" }], [2, 1, 0], { hands: { A: ["genis-secim"] } }),
    T("Çift Puan", [{ who: "A", card: "cift-puan" }], [4, 1, 0], { hands: { A: ["cift-puan"] } }),
    T("Takas", [{ who: "C", card: "takas", target: "A" }], [0, 1, 2], { hands: { C: ["takas"] } }),
    T("Lanet", [{ who: "C", card: "lanet", target: "A" }], [0, 1, 0], { hands: { C: ["lanet"] } }),
    T("Hırsız", [{ who: "C", card: "hirsiz" }], [1, 1, 1], { hands: { C: ["hirsiz"] } }),
    T("Kart Çal", [{ who: "C", card: "kart-cal", target: "A" }], [2, 1, 0], {
      hands: { C: ["kart-cal"], A: ["kalkan"] },
    }),
    T("Altın Dokunuş", [{ who: "A", card: "altin-dokunus" }], [6, 1, 0], { hands: { A: ["altin-dokunus"] } }),
    T("Ters Köşe", [{ who: "C", card: "ters-kose" }], [0, 1, 2], { hands: { C: ["ters-kose"] } }),
    T("Talihsizlik", [], [1, 1, 0], { pending: { A: ["talihsizlik"] } }),
    T("Ağır Yük", [], [1, 1, 0], { pending: { A: ["agir-yuk"] } }),
    T("Hayırsever", [], [1, 1, 1], { pending: { A: ["hayirsever"] } }),
    T("Açık Hedef", [{ who: "C", card: "celme", target: "A" }], [0, 1, 0], {
      hands: { C: ["celme"] },
      pending: { A: ["acik-hedef"] },
    }),
    T("Kumarbaz", [], [0, 1, 0], { pending: { A: ["kumarbaz"] } }),
    T("Lanetli Hediye", [], [1, 1, 0], { pending: { A: ["lanetli-hediye"] } }),
  ];

  it("her senaryo beklenen nihai puanları ve genel skoru verir", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const [a, b, c] = cs as [Client, Client, Client];
    const who = { A: a, B: b, C: c };
    await configure(a, false); // aşamayı kapat: eller doğrudan kurulur
    // Kapalı ana anahtarda kart durumu yoktur; senaryolar için açık anahtar ve 3 oyunda bir aşama atlanır
    await configure(a, true, [...CARD_IDS]);
    await configure(a, true, []);
    await start(cs, QUICK_IDS.slice(0, scenarios.length));
    let total: [number, number, number] = [0, 0, 0];
    for (const [i, s] of scenarios.entries()) {
      for (const [k2, cl] of Object.entries(who)) {
        setHand(a, cl, s.hands?.[k2 as "A" | "B" | "C"] ?? []);
        setPending(a, cl, s.pending?.[k2 as "A" | "B" | "C"] ?? []);
      }
      for (const p of s.plays) {
        const cl = who[p.who];
        cl.send({
          type: "playCard",
          card: p.card,
          ...(p.target ? { target: idOf(who[p.target]) } : {}),
        });
        await until(() => mine(cl)?.staged?.cardId === p.card, `${s.name}: oynandı`);
      }
      await playOut(cs);
      const awards = a.room.match?.result?.awards ?? {};
      expect([awards[idOf(a)], awards[idOf(b)], awards[idOf(c)]], s.name).toEqual(s.expect);
      total = [total[0] + s.expect[0], total[1] + s.expect[1], total[2] + s.expect[2]];
      expect([scoreOf(a, a), scoreOf(a, b), scoreOf(a, c)], `${s.name}: genel skor`).toEqual(total);
      if (i < scenarios.length - 1) {
        const next = await afterResults(cs);
        if (next === "cards") await skipCards(cs);
        await until(() => a.room.match?.round === i + 1, "sıradaki");
      }
    }
  });
});

describe("Veto ve Sıradaki Oyunu Seç", () => {
  it("Veto seçilen oyunu listeden çıkarır; toplam, liste ve sonraki oyun güncellenir; lobiye dönünce liste geri gelir", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a] = cs as [Client, Client];
    const games = QUICK_IDS.slice(0, 4);
    await start(cs, games);
    setHand(a, a, ["veto"]);
    // Anlatımda seçenekler yalnız oynayana sunulur
    await until(() => (mine(a)?.gameOptions.veto.length ?? 0) === 3, "veto listesi");
    expect(mine(a)?.gameOptions.veto.map((g) => g.id)).toEqual(games.slice(1));
    a.send({ type: "playCard", card: "veto", gameId: games[2] as string });
    await until(() => mine(a)?.staged?.cardId === "veto", "staged");
    expect(a.room.match?.total).toBe(4); // kesinleşmeden liste değişmez
    await playOut(cs);
    expect(a.room.match?.total).toBe(3);
    expect(a.room.gameIds).toEqual([games[0], games[1], games[3]]);
    expect(a.room.match?.cards?.plays).toEqual([]);
    // Sonuç ekranından sonra sıradaki oyun 2. oyun
    await afterResults(cs);
    await until(() => a.room.match?.round === 1, "oyun 2");
    expect(a.room.match?.gameId).toBe(games[1]);
    await playOut(cs);
    await afterResults(cs);
    await until(() => a.room.match?.round === 2, "oyun 3");
    expect(a.room.match?.gameId).toBe(games[3]);
    await playOut(cs);
    k.clock.advance(30_000);
    await until(() => a.room.phase === "final", "final");
    a.send({ type: "returnToLobby" });
    await until(() => a.room.phase === "lobby", "lobi");
    expect(a.room.gameIds).toEqual(games);
  });

  it("Veto geçersiz oyunla ve kalan 1 oyunken oynanamaz", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a] = cs as [Client, Client];
    await start(cs, QUICK_IDS.slice(0, 2));
    setHand(a, a, ["veto"]);
    a.send({ type: "playCard", card: "veto", gameId: QUICK_IDS[1] as string });
    await until(() => a.of("error").length > 0, "kalan 1");
    expect(a.lastError?.code).toBe("card_invalid");
    a.send({ type: "playCard", card: "veto", gameId: QUICK_IDS[0] as string });
    await until(() => a.of("error").length > 1, "geçmiş oyun");
  });

  it("Sıradaki Oyunu Seç: seçilebilen oyunlar açık ve sığan oyunlardır; seçilen sıradaki oyunun yerine geçer", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a] = cs as [Client, Client];
    const games = QUICK_IDS.slice(0, 4);
    await start(cs, games);
    setHand(a, a, ["oyunu-sec"]);
    await until(() => (mine(a)?.gameOptions.pick.length ?? 0) > 0, "seçilebilenler");
    const pickable = mine(a)?.gameOptions.pick.map((g) => g.id) ?? [];
    expect(pickable).toContain("butona-bas");
    expect(pickable).not.toContain(games[0]); // zaten oynanan/oynanan sayılan
    expect(pickable.every((id) => rt().catalog.some((g) => g.id === id))).toBe(true);
    a.send({ type: "playCard", card: "oyunu-sec", gameId: "butona-bas" });
    await until(() => mine(a)?.staged?.cardId === "oyunu-sec", "staged");
    await playOut(cs);
    expect(a.room.gameIds).toEqual([games[0], "butona-bas", games[2], games[3]]);
    expect(a.room.match?.total).toBe(4);
    await afterResults(cs);
    await until(() => a.room.match?.round === 1, "oyun 2");
    expect(a.room.match?.gameId).toBe("butona-bas");
  });

  it("Oyunu Seç: kapalı oyun ya da listedeki oyun öne alınır; geçersiz oyun reddedilir", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a] = cs as [Client, Client];
    const games = QUICK_IDS.slice(0, 4);
    await start(cs, games);
    setHand(a, a, ["oyunu-sec"]);
    a.send({ type: "playCard", card: "oyunu-sec", gameId: "olmayan-oyun" });
    await until(() => a.of("error").length > 0, "geçersiz");
    expect(a.lastError?.code).toBe("card_invalid");
    // Listedeki ama havuz dışı sahte oyun kataloğa girmediği için seçilemez
    a.send({ type: "playCard", card: "oyunu-sec", gameId: games[3] as string });
    await until(() => a.of("error").length > 1, "katalogda yok");
  });
});

describe("Kart Çal", () => {
  it("hedefin rastgele kartı sahibine geçer (kayıtla tutarlı)", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    await start(cs, QUICK_IDS.slice(0, 2));
    setHand(a, a, ["kart-cal"]);
    setHand(a, b, ["kalkan", "ayna"]);
    a.send({ type: "playCard", card: "kart-cal", target: idOf(b) });
    await until(() => mine(a)?.staged !== null, "oynadı");
    await playOut(cs);
    const stolen = mine(a)?.hand ?? [];
    expect(stolen).toHaveLength(1);
    expect(["kalkan", "ayna"]).toContain(stolen[0]);
    expect(mine(b)?.hand).toHaveLength(1);
    expect(a.room.match?.cards?.hands).toEqual({ [idOf(a)]: 1, [idOf(b)]: 1 });
  });
});

describe("oyun hatası ve kayıt", () => {
  it("oyun çökerse maç biter, kart durumu silinir, oynanan kart kaybolur, puanlar korunur", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    await start(cs, QUICK_IDS.slice(0, 6));
    await playGames(cs, 1);
    expect(scoreOf(a, a)).toBe(1);
    await afterResults(cs);
    setHand(a, a, ["takviye"]);
    a.send({ type: "playCard", card: "takviye" });
    await until(() => mine(a)?.staged !== null, "oynadı");
    failing = true;
    try {
      for (const c of cs) c.send({ type: "ready" });
      await until(() => a.room.phase === "countdown", "countdown");
      k.clock.advance(3000);
      await until(() => a.room.phase === "lobby", "lobiye döndü");
    } finally {
      failing = false;
    }
    expect(roomOf(a).match).toBeNull();
    expect([scoreOf(a, a), scoreOf(a, b)]).toEqual([1, 0]);
    expect(k.srv.recentCardLogs.length).toBeGreaterThan(0);
    // Yeni maç boş elle başlar
    await start(cs, QUICK_IDS.slice(0, 3));
    expect(cardsOf(a).by[idOf(a)]?.hand).toEqual([]);
  });

  it("maç bitince eller yanar; yeni maç boş başlar; kart kaydı tekrar oynatılınca aynı durum çıkar", async () => {
    const cs = await setupRoom(["A", "B", "C"]);
    const [a, b] = cs as [Client, Client, Client];
    await start(cs, QUICK_IDS.slice(0, 4));
    await playGames(cs, 3);
    await afterResults(cs);
    a.send({ type: "pickCard", index: 0 });
    b.send({ type: "pickCard", index: 1 });
    await sync();
    k.clock.advance(CARDS_MS);
    await until(() => a.room.phase === "briefing", "briefing");
    const live = JSON.parse(JSON.stringify(cardsOf(a))) as CardsState;
    // Oyun 4'ü de bitir
    await playOut(cs);
    k.clock.advance(30_000);
    await until(() => a.room.phase === "final", "final");
    const log = k.srv.recentCardLogs.at(-1);
    expect(log).toBeDefined();
    if (!log) return;
    expect(log.events.map((e) => e.event.k)).toContain("open");
    const replayed = replayCards(log);
    // 4. oyunda kart oynanmadı: kayıttan kurulan eller canlı ellerle aynıdır.
    expect(Object.fromEntries(Object.entries(replayed.by).map(([id, pc]) => [id, pc.hand]))).toEqual(
      Object.fromEntries(Object.entries(live.by).map(([id, pc]) => [id, pc.hand])),
    );
    expect(replayed.phaseNo).toBe(live.phaseNo);
    a.send({ type: "returnToLobby" });
    await until(() => a.room.phase === "lobby", "lobi");
    await start(cs, QUICK_IDS.slice(0, 2));
    for (const c of cs) expect(cardsOf(a).by[idOf(c)]?.hand).toEqual([]);
  });

  it("oyun kaydı kart girdilerini taşır ve replayWithCards nihai puanları yeniden üretir", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    await start(cs, QUICK_IDS.slice(0, 2));
    setHand(a, a, ["cift-puan"]);
    setHand(a, b, ["celme"]);
    a.send({ type: "playCard", card: "cift-puan" });
    b.send({ type: "playCard", card: "celme", target: idOf(a) });
    await until(() => mine(b)?.staged !== null, "oynadı");
    await playOut(cs);
    const log = k.srv.recentLogs.at(-1);
    expect(log?.cards?.plays.map((p) => p.cardId)).toEqual(["cift-puan", "celme"]);
    if (!log) return;
    const game = GAMES[log.gameId];
    if (!game) throw new Error("oyun yok");
    const out = replayWithCards(game, log);
    expect(out.cards?.awards).toEqual(a.room.match?.result?.awards);
    expect(out.cards?.awards[idOf(a)]).toBe(1); // ham 1 ×2 = 2, Çelme −1
  });

  it("hesap istatistiğindeki maç puanı kart etkilerini içerir", async () => {
    const rows: { score: number; place: number }[] = [];
    rt().accountStats = {
      gameFinished() {},
      matchFinished(rec) {
        rows.push(...rec.rows.map((r) => ({ score: r.score, place: r.place })));
      },
    };
    const cs = await setupRoom(["A", "B"]);
    const [a] = cs as [Client, Client];
    await start(cs, QUICK_IDS.slice(0, 1));
    setHand(a, a, ["cift-puan"]);
    a.send({ type: "playCard", card: "cift-puan" });
    await until(() => mine(a)?.staged !== null, "oynadı");
    await playOut(cs);
    k.clock.advance(30_000);
    await until(() => a.room.phase === "final", "final");
    // Ham 1 → Çift Puan ile 2; yalnız hesaplı host satır yazar.
    expect(scoreOf(a, a)).toBe(2);
    expect(rows).toEqual([{ score: 2, place: 1 }]);
  });
});

describe("kart seçimi bayrakları (sunucu akışı)", () => {
  it("Sessizlik: bir sonraki aşamayı kaçırtır ve bu herkese açık görünür", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    await start(cs, QUICK_IDS.slice(0, 8));
    await playGames(cs, 3);
    const pc = cardsOf(a).by[idOf(b)];
    if (pc) pc.silenced = true;
    await afterResults(cs);
    expect(mine(b)?.pick?.silenced).toBe(true);
    expect(mine(b)?.pick?.options).toEqual([]);
    expect(a.room.match?.cards?.phase?.silenced).toEqual([idOf(b)]);
    expect(mine(a)?.pick?.options).toHaveLength(3);
    b.send({ type: "pickCard", index: 0 });
    await until(() => b.of("error").length > 0, "reddedildi");
    expect(b.lastError?.code).toBe("card_invalid");
    // Yalnız a seçince aşama (bağlı herkes bitti) erken biter
    a.send({ type: "pickCard", index: 0 });
    await until(() => mine(a)?.pick?.done === true, "a bitti");
    k.clock.advance(CARDS_DONE_GRACE_MS + 100);
    await until(() => a.room.phase === "briefing", "briefing");
  });

  it("Kör Seçim ve Geniş Seçim: sonraki aşamada seçenekler gizli / 4 adet", async () => {
    const cs = await setupRoom(["A", "B"]);
    const [a, b] = cs as [Client, Client];
    await start(cs, QUICK_IDS.slice(0, 8));
    await playGames(cs, 3);
    const A = cardsOf(a).by[idOf(a)];
    const B = cardsOf(a).by[idOf(b)];
    if (A) A.blind = true;
    if (B) B.wide = true;
    await afterResults(cs);
    expect(mine(a)?.pick?.blind).toBe(true);
    expect(mine(a)?.pick?.options).toEqual([null, null, null]);
    expect(mine(b)?.pick?.options).toHaveLength(4);
    expect(JSON.stringify(a.room.match?.mine)).not.toMatch(/"(kalkan|celme)"/);
    a.send({ type: "pickCard", index: 1 });
    await until(() => (mine(a)?.pick?.got.length ?? 0) === 1, "kör seçildi");
  });
});
