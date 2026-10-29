/**
 * Yalnız geliştirme önizlemesi: TASLAK oyunların ekranları (`&n=3..8` oyuncu sayısı, `&tur=` tur). Durumlar gerçek
 * oyun kurallarıyla (setup/reduce) kurulur; eylemler de aynı kurallardan geçer.
 *
 *   ?mock=ortak-nokta-briefing | -choosing | -locked | -reveal | -reveal-none | -spectator   (`tur=1..4`, `chosen=0`)
 *   ?mock=tek-ve-kucuk-briefing | -choosing | -locked | -reveal | -reveal-none | -spectator (`tur=1..5`, `chosen=0`)
 *   ?mock=sessiz-sira-briefing | -look | -play | -play-late | -reveal-ok | -reveal-bad | -end | -dead | -spectator
 */
import {
  type AnyGame,
  createRng,
  type GameInfo,
  type MatchSnapshot,
  ortakNokta,
  type PlayerInfo,
  type RoomPhase,
  type RoomSnapshot,
  sessizSira,
  tekVeKucuk,
} from "@glix/engine";
import { useMockSender } from "../net/client.js";
import { applySnapshot, setState } from "../net/store.js";

const NAMES = ["Cihad", "Elif", "Mert", "Zeynep", "Kaan", "Defne", "Burak", "Ayşe"];
const SELF = "p0";

interface Built {
  /** Oyun durumu (kuralların ürettiği). */
  state: unknown;
  /** Görünümlerin hesaplandığı sunucu saati. */
  at: number;
}

interface Scenario {
  game: AnyGame;
  /** Anlatım ekranı mı. */
  briefing: boolean;
  spectator: boolean;
  build: (ids: string[], now: number) => Built;
}

const ctxAt = (now: number, connected: readonly string[]) => ({ now, rng: createRng(7), connected });

/** Eylemi kurallardan geçirir; reddedilirse durum değişmez. */
function applyAction(
  game: AnyGame,
  state: unknown,
  id: string,
  raw: unknown,
  now: number,
  ids: string[],
): unknown {
  const action = game.parseAction(raw);
  if (action === null) return state;
  const next = game.reduce(state, id, action, ctxAt(now, ids));
  return typeof next === "object" && next !== null && "rejected" in next ? state : next;
}

/** Ortak Nokta: `tur` turuna kadar tüm turlar oynanmış gibi kurar. */
function ortakScenario(kind: string, params: URLSearchParams): Scenario {
  const round = Math.min(4, Math.max(1, Number(params.get("tur")) || 1)) - 1;
  const reveal = kind.includes("reveal");
  const none = kind.endsWith("reveal-none");
  const noChoice = params.get("chosen") === "0";
  return {
    game: ortakNokta,
    briefing: kind.endsWith("briefing"),
    spectator: kind.endsWith("spectator"),
    build: (ids, now) => {
      const unit = 12_000 + 5_000;
      const t0 = now - round * unit - (reveal ? 12_000 + 1_500 : 3_000);
      let st: unknown = ortakNokta.setup(ids, ctxAt(t0, ids));
      for (let r = 0; r <= round; r++) {
        const base = t0 + r * unit + 1_000;
        const last = r === round;
        ids.forEach((id, i) => {
          if (last && !reveal && (id !== SELF || noChoice) && !(kind.endsWith("locked") && i % 2 === 1))
            return;
          if (last && !reveal && id === SELF && noChoice) return;
          const tile = none ? i % 6 : i < 3 ? (r * 2 + 1) % 6 : (i + r) % 6;
          st = applyAction(ortakNokta, st, id, { kind: "choose", tile }, base, ids);
          if (last && !reveal && kind.endsWith("locked")) {
            st = applyAction(ortakNokta, st, id, { kind: "lock" }, base + 100, ids);
          }
        });
      }
      return { state: st, at: now };
    },
  };
}

/** Tek ve Küçük. */
function tekScenario(kind: string, params: URLSearchParams): Scenario {
  const round = Math.min(5, Math.max(1, Number(params.get("tur")) || 1)) - 1;
  const reveal = kind.includes("reveal");
  const none = kind.endsWith("reveal-none");
  const noChoice = params.get("chosen") === "0";
  return {
    game: tekVeKucuk,
    briefing: kind.endsWith("briefing"),
    spectator: kind.endsWith("spectator"),
    build: (ids, now) => {
      const unit = 10_000 + 4_000;
      const t0 = now - round * unit - (reveal ? 10_000 + 1_500 : 3_000);
      let st: unknown = tekVeKucuk.setup(ids, ctxAt(t0, ids));
      for (let r = 0; r <= round; r++) {
        const base = t0 + r * unit + 1_000;
        const last = r === round;
        ids.forEach((id, i) => {
          if (last && !reveal && (id !== SELF || noChoice) && !(kind.endsWith("locked") && i % 2 === 1))
            return;
          // Çakışmalar: ilk iki oyuncu 1'de, üçüncü 2'de (tek kalan), diğerleri dağınık.
          const value = none
            ? 1 + (i % 2)
            : i < 2
              ? 1
              : i === 2
                ? 2 + (r % 2)
                : 3 + ((i + r) % Math.max(1, ids.length - 1));
          st = applyAction(
            tekVeKucuk,
            st,
            id,
            { kind: "choose", value: Math.min(value, ids.length + 2) },
            base,
            ids,
          );
          if (last && !reveal && kind.endsWith("locked")) {
            st = applyAction(tekVeKucuk, st, id, { kind: "lock" }, base + 100, ids);
          }
        });
      }
      return { state: st, at: now };
    },
  };
}

/** Sessiz Sıra: elleri sabit kartlarla kurar; olaylar gerçek kurallardan geçer. */
function sessizScenario(kind: string): Scenario {
  const tail = kind.replace("sessiz-sira-", "");
  const phase =
    tail === "look" || tail === "briefing" || tail === "spectator"
      ? "look"
      : tail.startsWith("play")
        ? "play"
        : "reveal";
  const bad = tail === "reveal-bad" || tail === "dead" || tail === "play-late";
  const finale = tail === "end" || tail === "dead";
  return {
    game: sessizSira,
    briefing: tail === "briefing",
    spectator: tail === "spectator",
    build: (ids, now) => {
      type St = { hands: Record<string, number[]> };
      const hands = Object.fromEntries(ids.map((id, i) => [id, [10 + i * 9, 55 + i * 4]]));
      /** t0'a göre kurar; son eylemin t0'dan uzaklığını da döner. */
      const run = (t0: number): { st: unknown; last: number } => {
        const base = sessizSira.setup(ids, ctxAt(t0, ids));
        let st: unknown = { ...base, hands, deals: [hands, hands, hands] };
        let last = 3_000;
        let k = 0;
        const play = (id: string): void => {
          last = 3_200 + 300 * k++;
          st = applyAction(sessizSira, st, id, { kind: "play" }, t0 + last, ids);
        };
        const lowest = (): string | null => {
          let best: string | null = null;
          for (const id of ids) {
            const c = (st as St).hands[id]?.[0];
            if (c !== undefined && (best === null || c < ((st as St).hands[best]?.[0] ?? 999))) best = id;
          }
          return best;
        };
        if (phase === "look") return { st, last };
        if (bad) {
          const first = lowest();
          if (tail === "play-late" && first) play(first);
          // Hatalı hamle: en büyük ilk karta sahip olan, küçükler dururken oynar.
          const big = [...ids].sort(
            (a, b) => ((st as St).hands[b]?.[0] ?? 0) - ((st as St).hands[a]?.[0] ?? 0),
          )[0];
          if (big) play(big);
        } else if (tail === "play") {
          for (let i = 0; i < Math.max(2, Math.floor(ids.length / 2)); i++) {
            const id = lowest();
            if (id) play(id);
          }
          return { st, last };
        }
        if (phase === "reveal") {
          for (let guard = 0; guard < 40; guard++) {
            const id = lowest();
            if (!id) break;
            play(id);
          }
        }
        return { st, last };
      };
      const probe = run(0).last;
      const t0 =
        phase === "look"
          ? now - 1_200
          : phase === "play"
            ? now - (probe + 1_500)
            : now - (probe + 1_000 + 800);
      let { st } = run(t0);
      if (finale) {
        const scores = Object.fromEntries(ids.map((id, i) => [id, Math.max(0, ids.length - i)]));
        const cur = st as { phaseStartedAt: number };
        st = {
          ...(st as object),
          round: 2,
          lives: tail === "dead" ? 0 : 2,
          scores,
          phase: "reveal",
          phaseEndsAt: cur.phaseStartedAt + 5_000,
        };
      }
      return { state: st, at: now };
    },
  };
}

function scenarioFor(kind: string, params: URLSearchParams): Scenario {
  if (kind.startsWith("ortak-nokta")) return ortakScenario(kind, params);
  if (kind.startsWith("tek-ve-kucuk")) return tekScenario(kind, params);
  return sessizScenario(kind);
}

export function startTaslakMock(kind: string, params: URLSearchParams): void {
  const n = Math.min(8, Math.max(3, Number(params.get("n")) || 5));
  const players: PlayerInfo[] = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: NAMES[i] ?? `Oyuncu${i}`,
    avatar: i,
    connected: true,
    score: 0,
    spectator: false,
  }));
  const ids = players.map((p) => p.id);
  const sc = scenarioFor(kind, params);
  const game = sc.game;
  const info: GameInfo = {
    id: game.id,
    name: game.name,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    orientation: "portrait",
    randomPool: false,
  };
  const participants = ids.filter((id) => !(sc.spectator && id === SELF));
  let state = sc.build(participants, Date.now()).state;
  let rev = 1;

  const snapshot = (): RoomSnapshot => {
    const now = Date.now();
    const ctx = ctxAt(now, participants);
    const phase: RoomPhase = sc.briefing ? "briefing" : "playing";
    const pub = game.publicView(state, ctx) as { phaseStartedAt?: number; phaseEndsAt?: number };
    const match: MatchSnapshot = {
      round: 0,
      total: 3,
      gameId: info.id,
      gameName: info.name,
      briefing: { goal: game.briefing.goal, steps: [...game.briefing.steps] },
      orientation: "portrait",
      participants,
      readyIds: sc.briefing ? participants.slice(1, 3) : [],
      continueIds: [],
      phaseStartedAt: pub.phaseStartedAt ?? now,
      phaseEndsAt: sc.briefing ? now + 40_000 : null,
      publicView: pub,
      view: game.view(state, sc.spectator ? null : SELF, ctx),
      result: null,
    };
    return {
      rev: ++rev,
      serverNow: now,
      code: "KX7QP",
      hostId: SELF,
      selfId: SELF,
      phase,
      players,
      gameIds: [info.id],
      selection: { mode: "manual" },
      joinPolicy: "izleyici",
      lobbyReady: [],
      stageCount: 0,
      catalog: [info],
      match,
    };
  };

  setState({ conn: "open", everOpen: true, nickname: "Cihad" });
  useMockSender((msg) => {
    if (msg.type !== "action" || sc.spectator) return;
    const next = applyAction(game, state, SELF, msg.payload, Date.now(), participants);
    if (next !== state) {
      state = next;
      applySnapshot(snapshot());
    }
  });
  setState("session", { token: "mock", playerId: SELF, roomCode: "KX7QP" });
  applySnapshot(snapshot());
}
