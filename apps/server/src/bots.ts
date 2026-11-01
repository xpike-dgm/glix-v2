/**
 * Test ortamı botları (yalnız `GLIX_ORTAM=test|test2`; canlıda `rt.botsEnabled` false, hiçbir uç açılmaz).
 *
 * Bot, sunucu içinde sanal bir oyuncudur: odaya `addPlayer` ile girer, bağlantısı sunucu içidir (hiçbir şey
 * göndermez, yayın ona hesaplanmaz) ve her niyetini insan istemcisiyle AYNI yoldan, `handleMessage` ile gönderir.
 * Böylece sunucu tek otorite kalır: doğrulama, aşama ve hız kuralları bota da aynen uygulanır.
 *
 * Her botun tek bir zamanlayıcısı vardır: insan benzeri bir gecikmeyle uyanır, odanın aşamasına bakar, gerekiyorsa
 * bir şey yapar ve kendini yeniden kurar. Lobide "Hazırım", anlatımda "Hazırım", sonuç ekranlarında "Devam", kart
 * seçiminde rastgele bir kart; oyunda o oyunun test botu (`BOTS`, packages/engine/src/games/bots.ts) bir eylem üretir.
 * Botun kararı yalnız herkese açık görünüme ve KENDİ `view(durum, botId)` görünümüne dayanır (bkz. `botInputs`).
 * Strateji yoksa ya da hata verirse bot o adımı pas geçer; oyun süresi dolunca kendiliğinden ilerler.
 *
 * Temizlik: bot çıkarılınca (`removePlayer`), oda kapanınca (`deleteRoom`) ve son insan odadan çıkınca zamanlayıcı
 * iptal edilir. Botun hesabı yoktur (`accountId` null): hesap istatistiği, Glix, rozet ve görev yazılmaz.
 */
import { randomInt } from "node:crypto";
import { type ClientMessage, createRng, GAMES, MAX_PLAYERS, type Rng, TASLAK_BOTLAR } from "@glix/engine";
import { BOTS } from "@glix/engine/testing";
import type { Cancel } from "./clock.js";
import { handleMessage } from "./handlers.js";
import { log } from "./log.js";
import { botInputs, matchMineFor } from "./match.js";
import { errorMessage } from "./messages.js";
import { addPlayer, isNicknameTaken, removePlayer } from "./rooms.js";
import type { BotHandle, Connection, Player, Room, Runtime } from "./runtime.js";

/** Bot adları: kısa, Türkçe, şirin. Hepsi doluysa "Bot 1", "Bot 2"… */
export const BOT_NAMES: readonly string[] = [
  "Pamuk",
  "Fıstık",
  "Boncuk",
  "Tarçın",
  "Lokum",
  "Zeytin",
  "Simit",
  "Kurabiye",
  "Pofuduk",
  "Mısır",
];

type Range = readonly [number, number];

/** Hızlı tepki oyunları: kısa gecikme. */
const FAST: Range = [250, 900];
/** Yazı ve oylama oyunları: düşünür gibi daha uzun. */
const SLOW: Range = [1_200, 3_500];
const DEFAULT: Range = [400, 2_000];

/** Oyuna göre iki eylem arasındaki gecikme (ms). Listede olmayan oyun `DEFAULT` kullanır. */
export const BOT_ACTION_DELAY: Readonly<Record<string, Range>> = {
  "butona-bas": FAST,
  "asiri-yukleme": FAST,
  "kontrol-paneli-kaosu": FAST,
  "kule-ustasi": FAST,
  "zaman-bombasi-hafizasi": FAST,
  "kor-bomba": FAST,
  "capraz-ates": FAST,
  // Tahmine dayalı basış: hemen basmasın.
  "kor-kronometre": [1_500, 5_000],
  "son-kisi": [1_500, 6_000],
  "karalama-defteri": [500, 1_400],
  "bozuk-telefon": [700, 2_000],
  "sozluk-blofu": SLOW,
  "yazi-yaz": SLOW,
  kendim: SLOW,
  "cagrisim-agi": SLOW,
  "laf-sokma": SLOW,
  sizma: SLOW,
  "rusvet-darbe": SLOW,
  ittifak: SLOW,
  "kara-borsa": SLOW,
  "gizli-alisveris": SLOW,
};

/** Sunucu içi bağlantı: hiçbir şey göndermez, kapanmaz; yalnız `handleMessage`'ın beklediği biçimi taşır. */
function botConnection(): Connection {
  return {
    send() {},
    sendRaw() {},
    lastSent: null,
    sentVer: -1,
    close() {},
    player: null,
    stage: null,
    ip: "bot",
    account: null,
    sessionHash: null,
    failedJoins: 0,
  };
}

class Bot implements BotHandle {
  private cancel: Cancel | null = null;
  private stopped = false;
  private seq = 0;
  private readonly rng: Rng = createRng(randomInt(0, 2 ** 31));

  constructor(
    private readonly rt: Runtime,
    readonly player: Player,
    private readonly conn: Connection,
  ) {}

  stop(): void {
    this.stopped = true;
    if (this.cancel) this.cancel();
    this.cancel = null;
  }

  /** Bekleyen zamanlayıcı var mı (yalnız testler için). */
  get pending(): boolean {
    return this.cancel !== null;
  }

  schedule(ms: number): void {
    if (this.stopped) return;
    if (this.cancel) this.cancel();
    this.cancel = this.rt.clock.setTimeout(() => this.wake(), Math.max(1, ms));
  }

  private between([lo, hi]: Range): number {
    return lo + this.rng.int(hi - lo + 1);
  }

  private send(msg: ClientMessage): void {
    handleMessage(this.rt, this.conn, msg);
  }

  private wake(): void {
    this.cancel = null;
    if (this.stopped) return;
    const room = this.player.room;
    if (room.players.get(this.player.id) !== this.player) {
      this.stop();
      return;
    }
    let next = 1_500;
    try {
      next = this.step(room);
    } catch (err) {
      log.warn("bot_failed", { roomCode: room.code, error: String(err) });
    }
    this.schedule(next);
  }

  /** Aşamaya göre bir adım; dönen değer sonraki uyanmaya kadarki gecikme (ms). */
  private step(room: Room): number {
    const me = this.player;
    const match = room.match;
    switch (room.phase) {
      case "lobby":
        if (room.hostId !== me.id && !me.lobbyReady) this.send({ type: "setReady", ready: true });
        return this.between([1_000, 2_500]);
      case "briefing":
        if (match?.participants.includes(me.id) && !match.readyIds.has(me.id)) this.send({ type: "ready" });
        return this.between([800, 2_000]);
      case "countdown":
        return this.between([300, 800]);
      case "playing":
        return this.play(room);
      case "results":
        if (match?.participants.includes(me.id) && !match.continueIds.has(me.id))
          this.send({ type: "continue" });
        return this.between([1_200, 3_000]);
      case "cards":
        this.pickCard(room);
        return this.between([1_000, 2_500]);
      default:
        return this.between([2_000, 4_000]);
    }
  }

  private play(room: Room): number {
    const me = this.player;
    const match = room.match;
    if (!match?.participants.includes(me.id)) return this.between(DEFAULT);
    // Oyunun kendi sonuç açılışı: bot izler gibi bekler, sonra "Devam et" der.
    if (match.reveal) {
      if (!match.reveal.continueIds.has(me.id)) this.send({ type: "revealContinue", round: match.index });
      return this.between([1_500, 3_000]);
    }
    const gameId = match.games[match.index]?.id ?? "";
    const delay = this.between(BOT_ACTION_DELAY[gameId] ?? DEFAULT);
    // Taslak oyunların (test2'de açık) botları ayrı kayıttadır.
    const strategy = BOTS[gameId] ?? TASLAK_BOTLAR[gameId];
    const inputs = botInputs(this.rt, room, me.id);
    if (!strategy || !inputs) return delay;
    let payload: unknown;
    try {
      payload = strategy.generate(this.rng, me.id, inputs.publicView, inputs.privateView, inputs.connected);
      // Ağdan gelmiş gibi: düz JSON kopyası (paylaşılan nesne, `undefined` alan kalmaz).
      payload = payload === undefined ? undefined : JSON.parse(JSON.stringify(payload));
    } catch (err) {
      log.warn("bot_strategy_failed", { roomCode: room.code, gameId, error: String(err) });
      return delay;
    }
    if (payload === undefined) return delay;
    this.seq += 1;
    this.send({ type: "action", seq: this.seq, payload });
    return delay;
  }

  /** Kart seçimi: alınmamış bir seçenek; el doluyken gelen kart için yeni kartı bırakır. */
  private pickCard(room: Room): void {
    const pick = matchMineFor(this.rt, room, this.player.id)?.pick;
    if (!pick || pick.done) return;
    if (pick.held !== null) {
      this.send({ type: "discardCard", index: null });
      return;
    }
    const free = pick.options.map((_, i) => i).filter((i) => !pick.taken.includes(i));
    const index = free[this.rng.int(free.length)];
    if (index !== undefined) this.send({ type: "pickCard", index });
  }
}

export function isBot(player: Player): boolean {
  return player.bot !== undefined;
}

function botName(room: Room): string {
  const free = BOT_NAMES.filter((n) => !isNicknameTaken(room, n));
  if (free.length > 0) return free[randomInt(free.length)] as string;
  for (let n = 1; ; n++) if (!isNicknameTaken(room, `Bot ${n}`)) return `Bot ${n}`;
}

/** Odaya bir bot ekler; kapalıysa, oda lobide değilse ya da doluysa null. */
export function addBot(rt: Runtime, room: Room): Player | null {
  if (!rt.botsEnabled || room.phase !== "lobby" || room.players.size >= MAX_PLAYERS) return null;
  if (room.players.size === 0) return null;
  const conn = botConnection();
  const player = addPlayer(rt, room, botName(room), conn);
  // Botun oturumu yoktur: belirteçle hiçbir bağlantı onun yerine geçemez.
  rt.tokens.delete(player.token);
  const bot = new Bot(rt, player, conn);
  player.bot = bot;
  bot.schedule(600 + randomInt(900));
  rt.broadcaster.markDirty(room);
  return player;
}

/** "Doldur" hedefi: elle seçimde seçili oyunların en küçük üst sınırı, değilse odanın üst sınırı. */
export function botFillTarget(room: Room): number {
  if (room.selection.mode !== "manual" || room.gameIds.length === 0) return MAX_PLAYERS;
  const caps = room.gameIds.map((id) => GAMES[id]?.maxPlayers ?? MAX_PLAYERS);
  return Math.max(1, Math.min(MAX_PLAYERS, ...caps));
}

/** Odadaki botlar (katılım sırasıyla). */
export function botsOf(room: Room): Player[] {
  return [...room.players.values()].filter(isBot).sort((a, b) => a.joinOrder - b.joinOrder);
}

/**
 * `addBot` / `fillBots` / `removeBot` / `clearBots`. Canlıda (`botsEnabled` false) tanınmayan mesaj gibi reddedilir.
 * Yalnız host, yalnız lobi.
 */
export function handleBotMessage(
  rt: Runtime,
  conn: Connection,
  msg: Extract<ClientMessage, { type: "addBot" | "fillBots" | "removeBot" | "clearBots" }>,
): void {
  if (!rt.botsEnabled || conn.player?.bot) {
    conn.send(errorMessage("invalid_message"));
    return;
  }
  const me = conn.player;
  if (!me) {
    conn.send(errorMessage("not_in_room"));
    return;
  }
  const room = me.room;
  if (room.hostId !== me.id) {
    conn.send(errorMessage("not_host"));
    return;
  }
  if (room.phase !== "lobby") {
    conn.send(errorMessage("wrong_phase"));
    return;
  }
  switch (msg.type) {
    case "addBot":
      if (!addBot(rt, room)) conn.send(errorMessage("room_full"));
      return;
    case "fillBots": {
      const target = botFillTarget(room);
      let added = 0;
      while (room.players.size < target && addBot(rt, room)) added += 1;
      if (added === 0) conn.send(errorMessage("room_full"));
      return;
    }
    case "removeBot": {
      const target = room.players.get(msg.playerId);
      if (!target?.bot) {
        conn.send(errorMessage("not_in_room", "Bu bot odada değil."));
        return;
      }
      removePlayer(rt, room, target);
      return;
    }
    case "clearBots":
      for (const bot of botsOf(room)) removePlayer(rt, room, bot);
      return;
  }
}
