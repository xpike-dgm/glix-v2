import { GAMES } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { Client, join, k, loginCookie, sync, until, useServer } from "./testkit.js";

/** Rastgele havuzdaki oyunlar (`randomPool: false` olanlar yalnız elle seçilir). */
const POOL = Object.values(GAMES).filter((g) => g.randomPool !== false);
const TWO_PLAYER = POOL.filter((g) => g.minPlayers <= 2 && g.maxPlayers >= 2).map((g) => g.id);

async function open(nickname: string): Promise<Client> {
  const c = await Client.connect(loginCookie());
  c.send({ type: "createRoom", nickname });
  await until(() => c.updates.length > 0, "oda kuruldu");
  return c;
}

async function lobbyOf(names: string[]): Promise<Client[]> {
  const host = await open(names[0] ?? "A");
  const out = [host];
  for (const n of names.slice(1)) out.push(await join(host.session.roomCode, n));
  await sync();
  return out;
}

describe("rastgele oyun seçimi: varsayılan ve geçişler", () => {
  useServer({ defaultGameIds: undefined });

  it("yeni oda rastgele 5 ile açılır ve lobide oyun listesi boştur", async () => {
    const host = await open("Ayşe");
    expect(host.room.selection).toEqual({ mode: "random", count: 5 });
    expect(host.room.gameIds).toEqual([]);
  });

  it("setRandom sayıyı katalog boyuna sıkıştırır; setGames el ile moda geçirir", async () => {
    const host = await open("Ayşe");
    host.send({ type: "setRandom", count: 64 });
    const size = host.room.catalog.length;
    await until(
      () => host.room.selection.mode === "random" && host.room.selection.count === size,
      "sıkıştırma",
    );
    host.send({ type: "setRandom", count: 2 });
    await until(() => host.room.selection.mode === "random" && host.room.selection.count === 2, "sayı 2");
    host.send({ type: "setGames", gameIds: ["butona-bas"] });
    await until(() => host.room.selection.mode === "manual", "el ile");
    expect(host.room.gameIds).toEqual(["butona-bas"]);
    host.send({ type: "setRandom", count: 3 });
    await until(() => host.room.selection.mode === "random", "rastgele");
    expect(host.room.selection).toEqual({ mode: "random", count: 3 });
    expect(host.room.gameIds).toEqual([]);
  });

  it("setRandom yalnız host ve yalnız lobide çalışır", async () => {
    const [a, b] = await lobbyOf(["Ayşe", "Mehmet"]);
    if (!a || !b) throw new Error("oyuncular yok");
    b.send({ type: "setRandom", count: 2 });
    await until(() => b.lastError?.code === "not_host", "not_host");
    expect(a.room.selection).toEqual({ mode: "random", count: 5 });
    b.send({ type: "setGames", gameIds: ["butona-bas"] });
    await until(() => b.of("error").length === 2, "ikinci hata");
    expect(a.room.selection.mode).toBe("random");

    a.send({ type: "startMatch" });
    await until(() => a.room.phase === "briefing", "briefing");
    a.send({ type: "setRandom", count: 1 });
    await until(() => a.lastError?.code === "wrong_phase", "wrong_phase");
    expect(a.room.selection).toEqual({ mode: "random", count: 5 });
  });

  it("geçersiz setRandom iletisi reddedilir", async () => {
    const host = await open("Ayşe");
    host.send({ type: "setRandom", count: 0 });
    await until(() => host.lastError?.code === "invalid_message", "invalid_message");
    expect(host.room.selection).toEqual({ mode: "random", count: 5 });
  });
});

describe("rastgele oyun seçimi: başlatma", () => {
  useServer({ defaultGameIds: undefined, randomInt: () => 0 });

  it("2 oyuncuyla yalnız 2 kişiyle oynanabilen oyunlar seçilir", async () => {
    expect(TWO_PLAYER.length).toBeLessThan(Object.keys(GAMES).length);
    const [a] = await lobbyOf(["Ayşe", "Mehmet"]);
    if (!a) throw new Error("host yok");
    a.send({ type: "setRandom", count: Object.keys(GAMES).length });
    await until(
      () => a.room.selection.mode === "random" && a.room.selection.count === Object.keys(GAMES).length,
    );
    a.send({ type: "startMatch" });
    await until(() => a.room.phase === "briefing", "briefing");
    // eligible sayısından fazla istendi: hepsi oynanır, tekrarsız
    expect([...a.room.gameIds].sort()).toEqual([...TWO_PLAYER].sort());
    expect(new Set(a.room.gameIds).size).toBe(a.room.gameIds.length);
    expect(a.room.match?.total).toBe(TWO_PLAYER.length);
  });

  it("count uygun oyun sayısından azsa tam count kadar oyun seçilir", async () => {
    const [a] = await lobbyOf(["Ayşe", "Mehmet"]);
    if (!a) throw new Error("host yok");
    a.send({ type: "setRandom", count: 2 });
    await until(() => a.room.selection.mode === "random" && a.room.selection.count === 2);
    a.send({ type: "startMatch" });
    await until(() => a.room.phase === "briefing", "briefing");
    expect(a.room.gameIds).toHaveLength(2);
    for (const id of a.room.gameIds) expect(TWO_PLAYER).toContain(id);
  });

  it("tek oyuncuyla uygun oyun yoksa not_enough_players", async () => {
    const host = await open("Ayşe");
    host.send({ type: "startMatch" });
    await until(() => host.lastError !== undefined, "hata");
    expect(host.lastError?.code).toBe("not_enough_players");
    expect(host.room.phase).toBe("lobby");
  });

  it("enjekte edilen rng ile seçim deterministiktir ve rng sırayı değiştirir", async () => {
    const pick = async (): Promise<string[]> => {
      const [a] = await lobbyOf(["Ayşe", "Mehmet", "Can"]);
      if (!a) throw new Error("host yok");
      a.send({ type: "setRandom", count: 64 });
      await until(() => a.room.selection.mode === "random" && a.room.selection.count > 5);
      a.send({ type: "startMatch" });
      await until(() => a.room.phase === "briefing", "briefing");
      return [...a.room.gameIds];
    };
    const first = await pick();
    expect(await pick()).toEqual(first);
    expect(first).toHaveLength(POOL.length);
    expect(first).toContain("kule-ustasi");
  });

  it("lobiye dönünce seçim korunur, oyun listesi yine boş olur", async () => {
    const [a, b] = await lobbyOf(["Ayşe", "Mehmet"]);
    if (!a || !b) throw new Error("oyuncular yok");
    a.send({ type: "setRandom", count: 1 });
    await until(() => a.room.selection.mode === "random" && a.room.selection.count === 1);
    a.send({ type: "startMatch" });
    await until(() => a.room.phase === "briefing", "briefing");
    expect(a.room.gameIds).toHaveLength(1);
    // Maçı final'e kadar götürmek yerine oyuncunun odadan çıkıp host'un ayrılmasına gerek yok:
    // abort yolu clearMatch'i kullanır; burada doğrudan final'i beklemek için süreyi atlarız.
    for (const c of [a, b]) c.send({ type: "ready" });
    await until(() => a.room.phase === "countdown", "countdown");
    k.clock.advance(3000);
    await until(() => a.room.phase === "playing", "playing");
    for (let i = 0; i < 400 && a.room.phase !== "final"; i++) {
      k.clock.advance(5000);
      await sync();
      if (a.room.phase === "briefing") for (const c of [a, b]) c.send({ type: "ready" });
    }
    expect(a.room.phase).toBe("final");
    a.send({ type: "returnToLobby" });
    await until(() => a.room.phase === "lobby", "lobi");
    expect(a.room.selection).toEqual({ mode: "random", count: 1 });
    expect(a.room.gameIds).toEqual([]);
  });
});

describe("el ile mod değişmedi", () => {
  useServer();
  it("defaultGameIds verilince oda el ile moddadır", async () => {
    const host = await open("Ayşe");
    expect(host.room.selection).toEqual({ mode: "manual" });
    expect(host.room.gameIds).toEqual(["butona-bas"]);
  });
});
