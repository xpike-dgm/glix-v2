import { ZEHIRLI_KADEH_REVEAL, type ZehirliKadehPublicView } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { type Client, k, setupRoom, sleep, startPlaying, until, useServer } from "./testkit.js";

useServer();

let seq = 9000;
async function send(c: Client, payload: unknown): Promise<{ ok: boolean; reason?: string }> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  const ack = c.of("actionAck").find((a) => a.seq === n);
  if (!ack) throw new Error("onay gelmedi");
  return { ok: ack.ok, ...(ack.reason ? { reason: ack.reason } : {}) };
}

const pub = (c: Client) => c.room.match?.publicView as ZehirliKadehPublicView;

async function kadehOdasi(): Promise<{ cs: Client[]; startedAt: number }> {
  const cs = await setupRoom(["A", "B", "C", "D"]);
  (cs[0] as Client).send({ type: "setGames", gameIds: ["zehirli-kadeh"] });
  await until(() => (cs[0] as Client).room.gameIds[0] === "zehirli-kadeh", "oyun seçildi");
  const { startedAt } = await startPlaying(cs);
  return { cs, startedAt };
}

describe("geç gelen eylem payı (250 ms)", () => {
  it("süre dolduktan 249 ms sonra ulaşan eylem kabul edilir; sonuç açılmaz", async () => {
    const { cs, startedAt } = await kadehOdasi();
    const [a, , c] = cs as [Client, Client, Client, Client];
    const endsAt = pub(a).endsAt;
    expect(endsAt).toBe(startedAt + 20_000);

    k.clock.advance(endsAt - k.clock.now());
    await sleep(30);
    // Özgün bitiş anında faz değişmez, sonuç/zehir açılmaz.
    expect(a.room.phase).toBe("playing");
    expect(pub(a).ended).toBe(false);
    expect(pub(a).result).toBeNull();

    k.clock.advance(249);
    await sleep(30);
    expect(a.room.phase).toBe("playing");
    const target = (cs[1] as Client).session.playerId;
    expect(await send(a, { kind: "swap", target })).toEqual({ ok: true });
    await until(() => pub(c).swaps.length === 1, "geç takas yayınlandı");
    for (const x of cs) expect(JSON.stringify(x.msgs)).not.toMatch(/poisonedCups|"poisoned"|"clean"/);
  });

  it("sonuç özgün bitişte değil, 250 ms sonra açılır; sonrasında eylem reddedilir", async () => {
    const { cs } = await kadehOdasi();
    const [a, b] = cs as [Client, Client, Client, Client];
    const endsAt = pub(a).endsAt;

    k.clock.advance(endsAt + 249 - k.clock.now());
    await sleep(30);
    expect(a.room.phase).toBe("playing");
    expect(pub(a).ended).toBe(false);

    k.clock.advance(1);
    // Zehirli Kadeh'te süre bitince önce "Şerefe!" açılış evresi gelir (sonuç görünümü açılır), sonra sonuç fazı.
    await until(() => pub(a).ended, "açılış evresi");
    expect(await send(b, { kind: "swap", target: a.session.playerId })).toMatchObject({ ok: false });
    k.clock.advance(ZEHIRLI_KADEH_REVEAL.totalMs);
    await until(() => a.room.phase === "results", "sonuç");
    expect(a.room.match?.result).not.toBeNull();
  });

  it("paysız (zamanlama) oyunda bitişten 1 ms sonra eylem reddedilir", async () => {
    const cs = await setupRoom(["A", "B"], ["kor-kronometre"]);
    const [a, b] = cs as [Client, Client];
    await startPlaying(cs);
    const endsAt = ((a.room.match?.publicView ?? { endsAt: 0 }) as { endsAt: number }).endsAt;
    k.clock.advance(endsAt + 1 - k.clock.now());
    expect(await send(b, { kind: "press" })).toEqual({ ok: false, reason: "ended" });
  });
});
