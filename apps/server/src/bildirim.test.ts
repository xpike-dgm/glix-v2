import { describe, expect, it } from "vitest";
import { createManualClock } from "./clock.js";
import { notifyPlayers, PUSH_MIN_GAP_MS } from "./push.js";
import { addPlayer, createRoom, createRuntime, removePlayer } from "./rooms.js";
import type { Connection } from "./runtime.js";
import { Client, k, setupRoom, startPlaying, sync, until, useServer } from "./testkit.js";
import type { PushGateway, PushResult, PushTarget } from "./webpush.js";

const P256DH = "B".repeat(87);
const AUTH = "a".repeat(22);
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc";

/** Gerçek ağa çıkmayan gönderici: yapılan gönderimleri kaydeder. */
function fakeGateway(result: PushResult = "ok") {
  const sent: { target: PushTarget; payload: string }[] = [];
  const gateway: PushGateway = {
    enabled: true,
    publicKey: "SAHTE-ANAHTAR",
    send: (target, payload) => {
      sent.push({ target, payload });
      return Promise.resolve(result);
    },
  };
  return { gateway, sent };
}

function stubConn(): Connection {
  return {
    send: () => undefined,
    sendRaw: () => undefined,
    lastSent: null,
    sentVer: -1,
    close: () => undefined,
    player: null,
    stage: null,
    ip: "127.0.0.1",
    failedJoins: 0,
    account: null,
  };
}

function unitRoom(result: PushResult = "ok") {
  const clock = createManualClock();
  const { gateway, sent } = fakeGateway(result);
  const rt = createRuntime(clock, 10, 10, undefined, undefined, undefined, gateway);
  const room = createRoom(rt);
  const a = addPlayer(rt, room, "Ayşe", stubConn());
  const b = addPlayer(rt, room, "Berk", stubConn());
  b.push = { endpoint: ENDPOINT, p256dh: P256DH, auth: AUTH };
  return { clock, rt, room, a, b, sent };
}

describe("bildirim kuralları", () => {
  it("yalnız arka plandaki oyuncuya gider", () => {
    const { rt, room, b, sent } = unitRoom();
    notifyPlayers(rt, room, "start", [b.id]);
    expect(sent.length).toBe(0); // sayfa görünür ve bağlı

    b.hidden = true;
    notifyPlayers(rt, room, "start", [b.id]);
    expect(sent.length).toBe(1);
  });

  it("bağlantısı kopmuş (yeniden bağlanabilir) oyuncuya gider", () => {
    const { rt, room, b, sent } = unitRoom();
    b.conn = null;
    notifyPlayers(rt, room, "turn", [b.id]);
    expect(sent.length).toBe(1);
  });

  it("aboneliği olmayana gitmez", () => {
    const { rt, room, a, sent } = unitRoom();
    a.hidden = true;
    notifyPlayers(rt, room, "start", [a.id]);
    expect(sent.length).toBe(0);
  });

  it("20 sn içinde ikinci bildirim gitmez, sonra gider", () => {
    const { clock, rt, room, b, sent } = unitRoom();
    b.hidden = true;
    notifyPlayers(rt, room, "start", [b.id]);
    clock.advance(PUSH_MIN_GAP_MS - 1);
    notifyPlayers(rt, room, "turn", [b.id]);
    expect(sent.length).toBe(1);
    clock.advance(1);
    notifyPlayers(rt, room, "turn", [b.id]);
    expect(sent.length).toBe(2);
  });

  it("metin geneldir: başlık, 'Oda KOD' ve etiket; başka hiçbir alan yok", () => {
    const { rt, room, b, sent } = unitRoom();
    b.hidden = true;
    for (const [kind, title] of [
      ["start", "Oyun başlıyor!"],
      ["turn", "Sıra sende!"],
      ["rematch", "Yeni maç"],
    ] as const) {
      sent.length = 0;
      b.lastPushAt = Number.NEGATIVE_INFINITY;
      notifyPlayers(rt, room, kind, [b.id]);
      const payload = JSON.parse(sent[0]?.payload ?? "{}") as Record<string, string>;
      expect(Object.keys(payload).sort()).toEqual(["body", "tag", "title"]);
      expect(payload.title).toBe(title);
      expect(payload.body).toBe(`Oda ${room.code}`);
      expect(sent[0]?.payload).not.toContain("Berk");
      expect(sent[0]?.payload).not.toContain("Ayşe");
    }
  });

  it("push servisi 410 dönerse abonelik silinir", async () => {
    const { rt, room, b } = unitRoom("gone");
    b.hidden = true;
    notifyPlayers(rt, room, "start", [b.id]);
    await Promise.resolve();
    await Promise.resolve();
    expect(b.push).toBeNull();
  });

  it("oyuncu ayrılınca abonelik silinir ve artık gönderilmez", () => {
    const { rt, room, b, sent } = unitRoom();
    b.hidden = true;
    removePlayer(rt, room, b);
    expect(b.push).toBeNull();
    notifyPlayers(rt, room, "start", [b.id]);
    expect(sent.length).toBe(0);
  });

  it("gönderici kapalıysa hiçbir şey olmaz", () => {
    const clock = createManualClock();
    const rt = createRuntime(clock);
    const room = createRoom(rt);
    const p = addPlayer(rt, room, "Ayşe", stubConn());
    p.push = { endpoint: ENDPOINT, p256dh: P256DH, auth: AUTH };
    p.hidden = true;
    expect(() => notifyPlayers(rt, room, "start", [p.id])).not.toThrow();
    expect(p.lastPushAt).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe("bildirim akışı (sunucu)", () => {
  const { gateway, sent } = fakeGateway();
  useServer({ push: gateway });

  async function subscribe(c: Client, over: Record<string, unknown> = {}): Promise<void> {
    c.send({ type: "pushSubscribe", endpoint: ENDPOINT, p256dh: P256DH, auth: AUTH, ...over });
    await sync();
  }

  it("hoş geldin mesajı VAPID anahtarını taşır", async () => {
    const c = await Client.connect();
    c.send({ type: "hello", clientVersion: "t" });
    await until(() => c.of("welcome").length > 0, "welcome");
    expect(c.of("welcome")[0]?.pushKey).toBe("SAHTE-ANAHTAR");
  });

  it("izin listesinde olmayan uç nokta reddedilir", async () => {
    const [a] = (await setupRoom(["A"])) as [Client];
    await subscribe(a, { endpoint: "https://127.0.0.1/x" });
    expect(a.lastError?.code).toBe("invalid_message");
  });

  it("maç başlayınca yalnız gizlenmiş oyuncu bildirim alır; geri gelince almaz", async () => {
    sent.length = 0;
    const cs = await setupRoom(["A", "B", "C"]);
    const [a, b, c] = cs as [Client, Client, Client];
    for (const x of [a, b, c]) await subscribe(x);
    b.send({ type: "visibility", hidden: true });
    await sync();
    await startPlaying(cs);
    expect(sent.length).toBe(1);
    expect(JSON.parse(sent[0]?.payload ?? "{}").title).toBe("Oyun başlıyor!");
    expect(JSON.parse(sent[0]?.payload ?? "{}").body).toBe(`Oda ${a.session.roomCode}`);
  });

  it("abonelikten çıkan bildirim almaz", async () => {
    sent.length = 0;
    const cs = await setupRoom(["A", "B"]);
    const [, b] = cs as [Client, Client];
    await subscribe(b);
    b.send({ type: "pushUnsubscribe" });
    b.send({ type: "visibility", hidden: true });
    await sync();
    k.clock.advance(1);
    await startPlaying(cs);
    expect(sent.length).toBe(0);
  });
});
