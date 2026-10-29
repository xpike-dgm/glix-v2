import { describe, expect, it } from "vitest";
import { isRejected } from "../game.js";
import { createRng, type Rng } from "../rng.js";
import { deepClone, deepEqual, deepFreeze } from "../testing/deep.js";
import { BOTS } from "../testing/index.js";
import { checkResult, findLeaks } from "../testing/invariants.js";
import { GAMES } from "./index.js";

/** Ağdan JSON.parse ile gelebilecek düşman değerler (1e999 -> Infinity dahil). */
function hostile(rng: Rng): unknown {
  const pool: unknown[] = [
    null,
    true,
    false,
    0,
    -0,
    -1,
    1.5,
    1e308,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NaN,
    2 ** 53,
    2 ** 31,
    -(2 ** 31),
    "",
    " ",
    "__proto__",
    "constructor",
    "toString",
    "x".repeat(4000),
    "a‮b​c\u0000d",
    "ünİıĞğ😀\uD800",
    "p1",
    "ghost",
    [],
    {},
    [[], [[]]],
    JSON.parse('{"__proto__":{"polluted":1},"kind":"x"}'),
    JSON.parse('{"constructor":{"prototype":{"polluted":1}}}'),
  ];
  return pool[rng.int(pool.length)];
}

/** Geçerli eylemin rastgele bir alanını (iç içe de olabilir) düşman değerle değiştirir. */
function mutate(rng: Rng, value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) {
    if (value.length === 0 || rng.int(6) === 0) return hostile(rng);
    const out = [...value];
    const i = rng.int(out.length);
    out[i] = depth < 4 && rng.int(2) === 0 ? mutate(rng, out[i], depth + 1) : hostile(rng);
    return out;
  }
  if (typeof value === "object" && value !== null) {
    const keys = Object.keys(value);
    const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    const roll = rng.int(5);
    if (keys.length === 0 || roll === 0) {
      Object.defineProperty(out, hostile(rng) === null ? "__proto__" : "extra", {
        value: hostile(rng),
        enumerable: true,
        configurable: true,
        writable: true,
      });
      return out;
    }
    const k = keys[rng.int(keys.length)] as string;
    if (roll === 1) delete out[k];
    else out[k] = depth < 4 && rng.int(2) === 0 ? mutate(rng, out[k], depth + 1) : hostile(rng);
    return out;
  }
  return hostile(rng);
}

const ITER = 3;

/** Ağ sınırına (8 KB) sığan en derin iç içe değerler. */
function nested(depth: number, kind: "array" | "object"): unknown {
  let v: unknown = 1;
  for (let i = 0; i < depth; i++) v = kind === "array" ? [v] : { kind: v, a: v === 1 ? 1 : undefined };
  return v;
}

describe.each(Object.values(GAMES).map((g) => [g.id, g] as const))(
  "kötü niyetli eylemler: %s",
  (id, game) => {
    const bot = BOTS[id];

    it("çok derin iç içe eylem parseAction'da fırlatmaz", () => {
      const bad = [
        nested(3900, "array"),
        nested(1000, "object"),
        JSON.parse(`{"kind":${"[".repeat(3000)}${"]".repeat(3000)}}`),
      ];
      for (const raw of bad) expect(() => game.parseAction(raw)).not.toThrow();
    });

    it("bozulmuş/yanlış kişi/bitiş sonrası eylemde fırlatmaz, durum bozulmaz, sızıntı olmaz", () => {
      if (!bot) throw new Error("bot yok");
      for (let seed = 1; seed <= ITER; seed++) {
        const rng = createRng(seed * 7919 + 13);
        const count = Math.min(game.maxPlayers, Math.max(game.minPlayers, game.minPlayers + rng.int(3)));
        const players = Array.from({ length: count }, (_, i) => `p${i + 1}`);
        const start = 1_700_000_000_000 + seed * 1000;
        const ctxAt = (now: number) => ({ now, rng: createRng(99), connected: players });
        let state = deepFreeze(game.setup(players, { now: start, rng: createRng(seed), connected: players }));
        let now = start;
        const end = start + bot.durationMs + 5_000;
        const polluted = () => expect(({} as Record<string, unknown>).polluted).toBeUndefined();

        let steps = 0;
        while (now <= end + 4_000 && steps++ < 400) {
          now += 1 + rng.int(Math.max(50, Math.floor(bot.durationMs / 120)));
          const ticked = game.tick(state, ctxAt(now));
          state = deepFreeze(ticked);
          for (let n = 0; n < 1 + rng.int(4); n++) {
            const actor =
              rng.int(8) === 0
                ? (["ghost", "", "__proto__", "constructor"][rng.int(4)] as string)
                : (players[rng.int(count)] as string);
            const author = players[rng.int(count)] as string;
            const pub = game.publicView(state, ctxAt(now));
            const priv = game.view(state, author, ctxAt(now));
            let raw: unknown;
            try {
              raw = bot.generate(createRng(rng.int(2 ** 30)), author, pub, priv, players);
            } catch {
              continue; // bot bu durumda üretemiyor; oyunun suçu değil
            }
            if (rng.int(4) !== 0) raw = mutate(rng, raw);
            const before = deepClone(state);
            const viewsBefore = players.map((p) => JSON.stringify(game.view(state, p, ctxAt(now))));
            const parsed = game.parseAction(raw);
            if (parsed === null) continue;
            const finishedBefore = game.isFinished(state, ctxAt(now));
            const next = game.reduce(state, actor, parsed, ctxAt(now));
            expect(deepEqual(state, before), `${id}: reduce girdi durumu değiştirdi`).toBe(true);
            if (isRejected(next)) {
              expect(typeof next.rejected).toBe("string");
              const viewsAfter = players.map((p) => JSON.stringify(game.view(state, p, ctxAt(now))));
              expect(viewsAfter).toEqual(viewsBefore);
              continue;
            }
            if (finishedBefore) {
              expect(deepEqual(next, state), `${id}: bitişten sonra eylem durumu değiştirdi`).toBe(true);
            }
            if (!players.includes(actor))
              expect(deepEqual(next, state), `${id}: katılımcı olmayan etkiledi`).toBe(true);
            state = deepFreeze(next);
            // Kabul edilen durum görünümleri üretebilmeli, JSON'a girmeli ve sızdırmamalı.
            for (const p of [...players, null]) JSON.stringify(game.view(state, p, ctxAt(now)));
            JSON.stringify(game.publicView(state, ctxAt(now)));
            const leaks = findLeaks(game, state, players, now);
            expect(leaks, `${id}: ${leaks[0]?.message}`).toEqual([]);
          }
          polluted();
        }
        // Bitiş sonrası her şey reddedilir ya da etkisizdir; sonuç biçimi geçerlidir.
        now = end + 60_000;
        state = deepFreeze(game.tick(state, ctxAt(now)));
        if (game.isFinished(state, ctxAt(now))) {
          checkResult(game.result(state), players, id);
          for (const p of players) {
            const out = game.reduce(
              state,
              p,
              hostileParsed(game, bot, players, p, state, now, rng),
              ctxAt(now),
            );
            if (!isRejected(out)) expect(deepEqual(out, state), `${id}: bitişten sonra kabul`).toBe(true);
          }
        }
      }
    }, 60_000);
  },
);

function hostileParsed(
  game: (typeof GAMES)[string],
  bot: NonNullable<(typeof BOTS)[string]>,
  players: readonly string[],
  p: string,
  state: unknown,
  now: number,
  rng: Rng,
): unknown {
  const ctx = { now, rng: createRng(1), connected: players };
  const raw = bot.generate(
    createRng(rng.int(2 ** 30)),
    p,
    game.publicView(state, ctx),
    game.view(state, p, ctx),
    players,
  );
  return game.parseAction(raw) ?? { kind: "__yok__" };
}
