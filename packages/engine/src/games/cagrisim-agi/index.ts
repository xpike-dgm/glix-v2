import type { GameContext, GameDefinition, Rejected, SecretEntry } from "../../game.js";
import { rankAwards } from "../scoring.js";
import {
  CAGRISIM_ANSWER_MS,
  CAGRISIM_LOCK_GRACE_MS,
  CAGRISIM_MAX_LENGTH,
  CAGRISIM_REVEAL_MS,
  CAGRISIM_TOTAL_MS,
  type CagrisimAgiAction,
  type CagrisimAgiPublicView,
  type CagrisimAgiView,
  type CagrisimGroup,
  type CagrisimReveal,
} from "./types.js";
import { CAGRISIM_WORDS } from "./words.js";

export * from "./types.js";
export { CAGRISIM_WORDS } from "./words.js";

export interface CagrisimAgiState {
  players: string[];
  word: string;
  startedAt: number;
  answerEndsAt: number;
  endsAt: number;
  /** Oyuncu -> gönderdiği cevap (kırpılmış, ham). Yalnız gönderenlerde anahtar vardır. */
  answers: Record<string, string>;
  /** Cevap süresi bitti ve cevaplar açıldı (tick ile). */
  revealed: boolean;
}

/** Türkçe küçük harf, baş/son boşluk kırpılır, iç boşluklar teke iner. */
export function normalizeAnswer(text: string): string {
  return text.toLocaleLowerCase("tr").trim().replace(/\s+/g, " ");
}

/** Gruplar (≥2 kişi, büyükten küçüğe), tek kalanlar ve susanlar. Oyuncu sırası belirleyicidir. */
export function groupAnswers(players: readonly string[], answers: Record<string, string>): CagrisimReveal {
  const byKey = new Map<string, string[]>();
  const silent: string[] = [];
  for (const id of players) {
    const raw = answers[id];
    if (raw === undefined) {
      silent.push(id);
      continue;
    }
    const key = normalizeAnswer(raw);
    const list = byKey.get(key);
    if (list) list.push(id);
    else byKey.set(key, [id]);
  }
  const groups: CagrisimGroup[] = [];
  const singles: CagrisimReveal["singles"] = [];
  for (const [text, members] of byKey) {
    if (members.length >= 2) groups.push({ text, members, points: members.length });
    else singles.push({ playerId: members[0] as string, text });
  }
  groups.sort((a, b) => b.members.length - a.members.length);
  return { groups, singles, silent };
}

function jsonHas(json: string, value: string): boolean {
  return json.includes(value) || json.includes(JSON.stringify(value).slice(1, -1));
}

export const cagrisimAgi: GameDefinition<
  CagrisimAgiState,
  CagrisimAgiAction,
  CagrisimAgiView,
  CagrisimAgiPublicView
> = {
  id: "cagrisim-agi",
  name: "Çağrışım Ağı",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Arkadaşlarınla aynı şeyi düşün!",
    steps: [
      "Ortadaki kelimeyi oku",
      "Aklına gelen tek çağrışımı yaz",
      "Aynısını yazanlar ağ kurar: kaç kişiyseniz o kadar puan",
    ],
  },

  parseAction(raw: unknown): CagrisimAgiAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const keys = Object.keys(raw);
    const rec = raw as Record<string, unknown>;
    if (keys.length !== 2 || rec.kind !== "answer" || typeof rec.text !== "string") return null;
    const text = rec.text.trim();
    if (text.length > CAGRISIM_MAX_LENGTH) return null;
    return { kind: "answer", text };
  },

  setup(players: readonly string[], ctx: GameContext): CagrisimAgiState {
    return {
      players: [...players],
      word: CAGRISIM_WORDS[ctx.rng.int(CAGRISIM_WORDS.length)] as string,
      startedAt: ctx.now,
      answerEndsAt: ctx.now + CAGRISIM_ANSWER_MS,
      endsAt: ctx.now + CAGRISIM_TOTAL_MS,
      answers: {},
      revealed: false,
    };
  },

  reduce(state, playerId, action, ctx): CagrisimAgiState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now >= state.answerEndsAt) return { rejected: "ended" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (Object.hasOwn(state.answers, playerId)) return { rejected: "already_answered" };
    const text = action.text.trim();
    if (normalizeAnswer(text) === "") return { rejected: "empty" };
    if (text.length > CAGRISIM_MAX_LENGTH) return { rejected: "too_long" };
    const answers = { ...state.answers, [playerId]: text };
    const waiting = state.players.some((id) => ctx.connected.includes(id) && !Object.hasOwn(answers, id));
    if (waiting) return { ...state, answers };
    // Bağlı herkes cevapladı: cevap aşaması 1 sn sonra biter (cevaplar zaten kesin).
    const answerEndsAt = Math.min(state.answerEndsAt, ctx.now + CAGRISIM_LOCK_GRACE_MS);
    return { ...state, answers, answerEndsAt, endsAt: answerEndsAt + CAGRISIM_REVEAL_MS };
  },

  tick(state, ctx): CagrisimAgiState {
    if (state.revealed || ctx.now < state.answerEndsAt) return state;
    return { ...state, revealed: true };
  },

  publicView(state): CagrisimAgiPublicView {
    return {
      startedAt: state.startedAt,
      answerEndsAt: state.answerEndsAt,
      endsAt: state.endsAt,
      word: state.word,
      phase: state.revealed ? "reveal" : "answer",
      answeredIds: state.players.filter((id) => Object.hasOwn(state.answers, id)),
      reveal: state.revealed ? groupAnswers(state.players, state.answers) : null,
    };
  },

  view(state, playerId): CagrisimAgiView {
    const mine = playerId === null ? undefined : state.answers[playerId];
    return { myAnswer: mine ?? null };
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= state.endsAt;
  },

  secrets(state): readonly SecretEntry[] {
    if (state.revealed) return [];
    const entries: SecretEntry[] = [];
    for (const id of state.players) {
      const value = state.answers[id];
      // Çok kısa cevaplar alt dizgi sızıntı denetimine uygun değildir; yapısal testlerle korunur.
      if (value === undefined || value.length < 3) continue;
      // Başkasının kendi cevabı, bu cevabı içeriyorsa (aynı ya da daha uzun yazdıysa) onun da görmeye hakkı var.
      const owners = state.players.filter((other) => {
        const mine = state.answers[other];
        return other === id || (mine !== undefined && jsonHas(JSON.stringify({ myAnswer: mine }), value));
      });
      entries.push({ ownerIds: owners, value, label: `${id} cevabı` });
    }
    return entries;
  },

  result(state) {
    const { groups } = groupAnswers(state.players, state.answers);
    const miniScores: Record<string, number> = {};
    for (const id of state.players) miniScores[id] = 0;
    for (const g of groups) for (const id of g.members) miniScores[id] = g.points;
    // Genel skora aktarım (sahip kararı): sıralamaya göre +2/+1; grup kuramayan (0 puan) ödül alamaz.
    return { miniScores, awards: rankAwards(miniScores, { positiveOnly: true }) };
  },
};
