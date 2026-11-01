/**
 * Oda botlarının oynama stratejileri (botStratejileri/): metinler oyunların doğrulamasından ve denetimden geçer, görünmez
 * karakter taşımaz; bütün oyunlarda (hareketsiz insan + 3 bot) botların gönderdiği her metin temizdir ve yazı oyunlarında
 * en az bir metin kabul edilir. Zamanlama: Kör Kronometre hedefe yakın basar, Son Kişi makul anda kaçar. Ortalamanın
 * Yarısı'nda botlar her tur kendisi seçer (rastgele sayıya düşmez, OY-M2).
 */
import {
  CAGRISIM_WORDS,
  createRng,
  GAMES,
  KENDIM_TOPICS,
  moderateText,
  SOZLUK_MAX_LENGTH,
  SOZLUK_WORD_TYPES,
  YAZI_YAZ_TOPIC_POOL,
} from "@glix/engine";
import { afterEach, describe, expect, it } from "vitest";
import { PLAY_STRATEGIES, TEXT_GAMES } from "./botStratejileri/index.js";
import {
  BOT_TEXT_MAX,
  BOZUK_GUESSES,
  BOZUK_SENTENCES,
  cagrisimAnswer,
  GUESS_WORDS,
  isCleanBotText,
  kendimAnswer,
  LAF_ANSWERS,
  sozlukBluff,
  yaziWord,
} from "./botStratejileri/metin.js";
import { type BotTraceEvent, botsOf, botTrace } from "./bots.js";
import { createManualClock } from "./clock.js";
import { handleMessage } from "./handlers.js";
import { runTick, TICK_MS } from "./match.js";
import { createRuntime } from "./rooms.js";
import type { Connection, Room } from "./runtime.js";

const INVISIBLE = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}\p{Cn}\p{Zl}\p{Zp}]/u;

function parses(gameId: string, payload: unknown): boolean {
  return GAMES[gameId]?.parseAction(payload) !== null;
}

describe("bot metinleri: oyun doğrulaması ve denetim", () => {
  const rng = createRng(42);
  it("Sözlük Blöfü sahte tanımları: tek cümle, en çok 70 karakter, temiz", () => {
    for (const type of [...SOZLUK_WORD_TYPES, null]) {
      for (let i = 0; i < 200; i++) {
        const text = sozlukBluff(rng, type);
        expect(isCleanBotText(text), text).toBe(true);
        expect(Array.from(text).length).toBeLessThanOrEqual(Math.min(70, SOZLUK_MAX_LENGTH));
        expect(text.endsWith(".")).toBe(true);
        expect(parses("sozluk-blofu", { kind: "bluff", text }), text).toBe(true);
      }
    }
  });
  it("Çağrışım Ağı: havuzdaki her kelimeye geçerli bir cevap", () => {
    for (const word of CAGRISIM_WORDS) {
      const text = cagrisimAnswer(rng, word);
      expect(isCleanBotText(text), `${word} -> ${text}`).toBe(true);
      expect(parses("cagrisim-agi", { kind: "answer", text })).toBe(true);
    }
  });
  it("Yazı Yaz: her konuya geçerli kelime", () => {
    for (const topic of YAZI_YAZ_TOPIC_POOL.builtin) {
      for (let i = 0; i < 5; i++) {
        const text = yaziWord(rng, topic);
        expect(isCleanBotText(text), `${topic} -> ${text}`).toBe(true);
        expect(parses("yazi-yaz", { kind: "write", text }), text).toBe(true);
        expect(parses("yazi-yaz", { kind: "guessWord", text }), text).toBe(true);
      }
    }
  });
  it("Kendim: her konuya geçerli kısa cevap", () => {
    for (const { topic } of KENDIM_TOPICS) {
      for (let i = 0; i < 5; i++) {
        const text = kendimAnswer(rng, topic);
        expect(isCleanBotText(text), `${topic} -> ${text}`).toBe(true);
        expect(parses("kendim", { kind: "write", text }), text).toBe(true);
      }
    }
  });
  it("Laf Sokma, Bozuk Telefon, tahmin sözcükleri: temiz ve geçerli", () => {
    for (const text of LAF_ANSWERS) {
      expect(isCleanBotText(text), text).toBe(true);
      expect(parses("laf-sokma", { kind: "answer", prompt: "q1", text }), text).toBe(true);
    }
    for (const text of [...BOZUK_SENTENCES, ...BOZUK_GUESSES]) {
      expect(isCleanBotText(text), text).toBe(true);
      expect(parses("bozuk-telefon", { kind: "text", text }), text).toBe(true);
    }
    for (const text of GUESS_WORDS) {
      expect(isCleanBotText(text), text).toBe(true);
      expect(parses("karalama-defteri", { kind: "guess", text }), text).toBe(true);
      expect(parses("sizma", { kind: "guess", text }), text).toBe(true);
    }
  });
  it("son kapı kirli metni reddeder", () => {
    for (const bad of ["", " a", "a  b", "a​b", "x".repeat(BOT_TEXT_MAX + 1), "123", "a\tb", "siktir git"])
      expect(isCleanBotText(bad), JSON.stringify(bad)).toBe(false);
    expect(moderateText("Bir kutu mandalina").ok).toBe(true);
  });
});

function conn(): Connection {
  return {
    player: null,
    stage: null,
    lastSent: null,
    sentVer: -1,
    ip: "1.2.3.4",
    failedJoins: 0,
    account: { id: 9, username: "Sahip" },
    close() {},
    send() {},
    sendRaw() {},
  };
}

/** Metinle ilgili ret sebepleri: bot metni bunlara asla takılmamalı. */
const TEXT_REJECTIONS = ["invalid_action", "empty", "too_long", "invalid", "inappropriate", "bad_guess"];

function playGame(id: string): { events: BotTraceEvent[]; room: Room; view: () => unknown } {
  const events: BotTraceEvent[] = [];
  botTrace.hook = (e) => events.push(e);
  const clock = createManualClock();
  const rt = createRuntime(clock);
  rt.botsEnabled = true;
  const host = conn();
  handleMessage(rt, host, { type: "createRoom", nickname: "Sahip" });
  const room = [...rt.rooms.values()][0] as Room;
  handleMessage(rt, host, { type: "setGames", gameIds: [id] });
  for (let i = 0; i < 3; i++) handleMessage(rt, host, { type: "addBot" });
  handleMessage(rt, host, { type: "startMatch" });
  for (let t = 0; t < 20 * 60_000 && room.phase !== "final"; t += TICK_MS) {
    clock.advance(TICK_MS);
    runTick(rt);
  }
  const view = (): unknown => {
    const match = room.match;
    if (!match) return null;
    return GAMES[id]?.publicView(match.state, { now: clock.now(), rng: createRng(1), connected: [] });
  };
  return { events, room, view };
}

describe("bütün oyunlar: botların gönderdiği metin temiz, oyun biter", () => {
  afterEach(() => {
    botTrace.hook = null;
  });
  for (const id of Object.keys(GAMES)) {
    it(id, () => {
      const { events, room } = playGame(id);
      expect(room.phase, `${id} bitmedi`).toBe("final");
      const texts = events.filter((e) => typeof (e.payload as { text?: unknown }).text === "string");
      for (const e of texts) {
        const text = (e.payload as { text: string }).text;
        expect(INVISIBLE.test(text), text).toBe(false);
        expect(isCleanBotText(text), text).toBe(true);
        expect(TEXT_REJECTIONS.includes(e.ack?.reason ?? ""), `${text}: ${e.ack?.reason}`).toBe(false);
      }
      if (PLAY_STRATEGIES[id]) {
        // Oynama stratejisi olan oyunda bot hiç ayrıştırılamayan eylem göndermez.
        const bad = events.filter((e) => e.ack?.reason === "invalid_action");
        expect(bad.map((e) => JSON.stringify(e.payload))).toEqual([]);
        expect(
          events.some((e) => e.ack?.ok),
          `${id}: kabul edilen bot eylemi yok`,
        ).toBe(true);
      }
      if (TEXT_GAMES.has(id) && id !== "karalama-defteri" && id !== "sizma") {
        expect(
          texts.some((e) => e.ack?.ok),
          `${id}: kabul edilen bot metni yok`,
        ).toBe(true);
      }
      expect(botsOf(room)).toHaveLength(3);
    });
  }
});

describe("zamanlama", () => {
  afterEach(() => {
    botTrace.hook = null;
  });
  it("Açgözlülük Limiti: botlar üç turun hepsinde 0..N arası seçer", () => {
    const { room, view } = playGame("acgozluluk-limiti");
    const bots = botsOf(room).map((p) => p.id);
    const pv = view() as {
      maxChoice: number;
      history: { reveal: { choices: Record<string, number>; missing: string[] } }[];
      reveal: { choices: Record<string, number>; missing: string[] } | null;
    };
    const rounds = [...pv.history.map((h) => h.reveal), ...(pv.reveal ? [pv.reveal] : [])];
    expect(rounds).toHaveLength(3);
    for (const r of rounds) {
      for (const id of bots) {
        expect(r.missing).not.toContain(id);
        expect(r.choices[id] ?? -1).toBeGreaterThanOrEqual(0);
        expect(r.choices[id] ?? 99).toBeLessThanOrEqual(pv.maxChoice);
      }
    }
  });

  it("Kör Kronometre: botlar her elde hedefe 0,3–1,5 sn uzaklıkta basar", () => {
    const { room, view } = playGame("kor-kronometre");
    const bots = new Set(botsOf(room).map((p) => p.id));
    const played = (
      view() as { played: { reveal: { entries: { playerId: string; distance: number | null }[] } }[] }
    ).played;
    expect(played.length).toBe(3);
    for (const hand of played) {
      const mine = hand.reveal.entries.filter((e) => bots.has(e.playerId));
      expect(mine).toHaveLength(3);
      for (const e of mine) {
        expect(e.distance).not.toBeNull();
        expect(e.distance ?? 0).toBeGreaterThanOrEqual(250);
        expect(e.distance ?? 0).toBeLessThanOrEqual(1_600);
      }
    }
  });
  it("Ortalamanın Yarısı: botlar her tur kendisi seçer (rastgele sayıya düşmez), sayılar 0–100", () => {
    const { room, view } = playGame("ortalamanin-yarisi");
    const bots = new Set(botsOf(room).map((p) => p.id));
    const pub = view() as {
      previous: { choices: Record<string, number>; random: string[] }[];
      reveal: { choices: Record<string, number>; random: string[] } | null;
    };
    const rounds = [...pub.previous, ...(pub.reveal ? [pub.reveal] : [])];
    expect(rounds).toHaveLength(3);
    for (const r of rounds) {
      for (const id of bots) {
        expect(r.random).not.toContain(id);
        const v = r.choices[id] ?? -1;
        expect(v >= 0 && v <= 100).toBe(true);
      }
    }
  });
  it("Son Kişi: botlar her alarmda turun başından 3–10,5 sn sonra kaçar", () => {
    const { room, view } = playGame("son-kisi");
    const bots = new Set(botsOf(room).map((p) => p.id));
    const results = (view() as { results: { escapes: { id: string; ms: number }[] }[] }).results;
    expect(results).toHaveLength(3);
    const mine = results.flatMap((r) => r.escapes.filter((e) => bots.has(e.id)));
    expect(mine.length).toBeGreaterThan(0);
    for (const e of mine) {
      expect(e.ms).toBeGreaterThanOrEqual(3_000);
      expect(e.ms).toBeLessThanOrEqual(10_500);
    }
  });
});
