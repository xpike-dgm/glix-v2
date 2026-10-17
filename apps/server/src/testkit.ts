import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import { applyMerge, type RoomSnapshot, type ServerMessage } from "@glix/engine";
import { afterEach, beforeEach } from "vitest";
import { WebSocket } from "ws";
import { createManualClock, type ManualClock } from "./clock.js";
import { type RunningServer, type ServerOptions, startServer } from "./server.js";

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Testin sunucusu ve sahte saati; `useServer` her testten önce yeniler. */
export const k = {} as { clock: ManualClock; srv: RunningServer };
const clients: Client[] = [];

export class Client {
  readonly msgs: ServerMessage[] = [];
  /** Alınan tam `room` ve uygulanmış `patch` mesajlarından kurulan snapshot geçmişi. */
  readonly updates: { snapshot: RoomSnapshot }[] = [];
  /** Uygulanamayan (baseRev uyuşmayan) yama sayısı: 0 olmalı. */
  gaps = 0;
  /** Alınan toplam bayt ve her güncellemenin tam `room` olarak gönderilseydi tutacağı bayt (yama öncesi düzen). */
  bytesIn = 0;
  fullEquivalentBytes = 0;
  closeCode: number | null = null;
  private constructor(readonly ws: WebSocket) {
    ws.on("message", (d) => {
      const text = d.toString();
      const msg = JSON.parse(text) as ServerMessage;
      this.bytesIn += Buffer.byteLength(text);
      this.msgs.push(msg);
      if (msg.type === "room") {
        this.updates.push({ snapshot: msg.snapshot });
        this.fullEquivalentBytes += Buffer.byteLength(text);
      } else if (msg.type === "patch") {
        const cur = this.updates.at(-1)?.snapshot;
        if (!cur || cur.rev !== msg.baseRev) this.gaps += 1;
        else {
          const next = applyMerge(cur, msg.patch) as RoomSnapshot;
          this.updates.push({ snapshot: next });
          this.fullEquivalentBytes += Buffer.byteLength(JSON.stringify({ type: "room", snapshot: next }));
        }
      }
    });
    ws.on("close", (code) => {
      this.closeCode = code;
    });
  }
  static async connect(): Promise<Client> {
    const ws = new WebSocket(`ws://127.0.0.1:${k.srv.port}/ws`);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });
    const c = new Client(ws);
    clients.push(c);
    return c;
  }
  send(obj: unknown): void {
    this.ws.send(typeof obj === "string" ? obj : JSON.stringify(obj));
  }
  of<T extends ServerMessage["type"]>(type: T): Extract<ServerMessage, { type: T }>[] {
    return this.msgs.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);
  }
  /** En son oda görüntüsü. */
  get room(): RoomSnapshot {
    const last = this.updates.at(-1);
    if (!last) throw new Error("oda görüntüsü yok");
    return last.snapshot;
  }
  get session() {
    const s = this.of("session").at(-1);
    if (!s) throw new Error("oturum yok");
    return s;
  }
  get lastError() {
    return this.of("error").at(-1);
  }
  mark(): number {
    return this.msgs.length;
  }
  since(mark: number): ServerMessage[] {
    return this.msgs.slice(mark);
  }
}

/** Mesajların işlenmesi için gerçek zaman tanır, sahte saati ilerletip yayınları boşaltır. */
export async function sync(): Promise<void> {
  await sleep(15);
  k.clock.advance(60);
  await sleep(15);
}

export async function until(pred: () => boolean, label = "koşul"): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (pred()) return;
    await sync();
  }
  throw new Error(`zaman aşımı: ${label}`);
}

export async function create(nickname: string): Promise<Client> {
  const c = await Client.connect();
  c.send({ type: "createRoom", nickname });
  await until(() => c.updates.length > 0, "oda kuruldu");
  return c;
}

export async function join(code: string, nickname: string): Promise<Client> {
  const c = await Client.connect();
  c.send({ type: "joinRoom", code, nickname });
  await until(() => c.updates.length > 0 || c.of("error").length > 0, "katılım");
  return c;
}

/** `games` verilirse host oyun seçimini buna indirger (varsayılan: kayıt defterindeki tüm oyunlar). */
export async function setupRoom(names: string[], games?: string[]): Promise<Client[]> {
  const host = await create(names[0] ?? "A");
  const out = [host];
  for (const n of names.slice(1)) out.push(await join(host.session.roomCode, n));
  if (games) {
    host.send({ type: "setGames", gameIds: games });
    await until(() => host.room.gameIds.length === games.length, "oyun seçimi");
  }
  await sync();
  return out;
}

export async function startPlaying(cs: Client[]): Promise<{ startedAt: number }> {
  const host = cs[0] as Client;
  host.send({ type: "startMatch" });
  await until(() => host.room.phase === "briefing", "briefing");
  for (const c of cs) c.send({ type: "ready" });
  await until(() => host.room.phase === "countdown", "countdown");
  k.clock.advance(3000);
  await until(() => host.room.phase === "playing", "playing");
  const view = host.room.match?.publicView as { startedAt: number };
  return { startedAt: view.startedAt };
}

let seq = 0;
export async function press(c: Client): Promise<void> {
  const n = ++seq;
  c.send({ type: "action", seq: n, payload: { kind: "press" } });
  for (let i = 0; i < 100 && !c.of("actionAck").some((a) => a.seq === n); i++) await sleep(5);
  const ack = c.of("actionAck").find((a) => a.seq === n);
  if (!ack?.ok) throw new Error(`basış reddedildi: ${ack?.reason}`);
}

export function useServer(extra: Partial<ServerOptions> = {}): void {
  beforeEach(async () => {
    k.clock = createManualClock();
    k.srv = await startServer({
      host: "127.0.0.1",
      port: 0,
      clientDir: mkdtempSync(pathJoin(tmpdir(), "glix-flow-")),
      allowedOrigins: null,
      revision: "t",
      clock: k.clock,
      // Sahte saat atlamalı testlerde pong'a zaman kalmaz; kalp atışı yalnızca ilgili testlerde açılır.
      heartbeatMs: 1_000_000_000,
      // Mevcut akış testleri tek oyun (Butona Bas) varsayar; kayıt defterine oyun eklemek onları bozmasın.
      defaultGameIds: ["butona-bas"],
      ...extra,
    });
  });
  afterEach(async () => {
    for (const c of clients.splice(0)) c.ws.terminate();
    await k.srv.close();
  });
}
