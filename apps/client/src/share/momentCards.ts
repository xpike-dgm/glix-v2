import type { KaralamaStroke } from "@glix/engine";
import { formatScore, type RankedPlayer } from "../screens/ranking.js";
import type { RoundRecord, Title } from "../screens/titles.js";

/**
 * Paylaşım kartlarının seçimi (saf mantık). Girdi yalnız maç sonunda bu oyuncunun zaten gördüğü herkese açık veridir:
 * sıralama, unvanlar, tur ödülleri + özet cümleleri, galeri çizimleri. Gizli bilgi, kimlik ya da oda dışı veri yoktur;
 * kartlarda yalnız takma ad ve avatar sırası geçer.
 */
export const MAX_MOMENTS = 5;
/** En çok bu kadar "turun yıldızı" kartı. */
export const MAX_ROUND_MOMENTS = 3;

export type MomentKind = "winner" | "drawing" | "round" | "comeback";

export interface MomentPerson {
  nickname: string;
  avatar: number;
  /** 1, 2, 3 (yalnız kazanan kartı). */
  rank?: number;
  /** Adın altındaki küçük yazı (örn. puan). */
  caption?: string;
}

export interface Moment {
  id: string;
  kind: MomentKind;
  /** Kartın büyük başlığı. */
  title: string;
  /** Arka plan dünyası için oyun kimliği; yoksa genel arka plan. */
  world: string | null;
  people: MomentPerson[];
  /** Ana metin satırları (kısa cümleler). */
  lines: string[];
  strokes?: KaralamaStroke[];
}

export interface MomentPlayer {
  id: string;
  nickname: string;
  avatar: number;
}

export interface DrawingInput {
  key: string;
  game: "karalama" | "bozuk";
  playerId: string;
  strokes: KaralamaStroke[];
}

export interface MomentInput {
  /** Sıralama (izleyiciler hariç), puana göre azalan. */
  ranked: readonly RankedPlayer[];
  titles: readonly Title[];
  rounds: readonly RoundRecord[];
  drawings: readonly DrawingInput[];
  /** Oyun kimliği -> görünen ad. */
  gameNames: Readonly<Record<string, string>>;
}

const person = (p: MomentPlayer, extra: Partial<MomentPerson> = {}): MomentPerson => ({
  nickname: p.nickname,
  avatar: p.avatar,
  ...extra,
});

function winnerMoment(input: MomentInput): Moment | null {
  const top = input.ranked.slice(0, 3);
  const first = top[0];
  if (!first) return null;
  const winners = input.ranked.filter((r) => r.rank === 1);
  const lines: string[] = [];
  const label = input.titles.find((t) => winners.some((w) => w.player.id === t.playerId))?.label;
  if (label) lines.push(label);
  return {
    id: "kazanan",
    kind: "winner",
    title: winners.length > 1 ? "Berabere!" : "Kazanan",
    world: null,
    people: top.map((r) => person(r.player, { rank: r.rank, caption: `${formatScore(r.score)} puan` })),
    lines,
  };
}

/** Maç içi "en iyi çizim": Karalama'da turun en çok puan alan ressamının çizimi; yoksa en son çizim. */
function drawingMoment(input: MomentInput): Moment | null {
  if (input.drawings.length === 0) return null;
  const award = (d: DrawingInput): number => {
    const m = /^kd:(\d+):/.exec(d.key);
    const round = m?.[1] === undefined ? undefined : Number(m[1]);
    const rec = input.rounds.find((r) => r.round === round && r.gameId === "karalama-defteri");
    return rec?.awards[d.playerId] ?? Number.NEGATIVE_INFINITY;
  };
  let best: DrawingInput | undefined;
  let bestAward = Number.NEGATIVE_INFINITY;
  for (const d of input.drawings) {
    if (d.strokes.length === 0) continue;
    const a = award(d);
    if (best === undefined || a >= bestAward) {
      best = d;
      bestAward = a;
    }
  }
  if (!best) return null;
  const owner = input.ranked.find((r) => r.player.id === best.playerId)?.player;
  if (!owner) return null;
  return {
    id: "cizim",
    kind: "drawing",
    title: "En iyi çizim",
    world: best.game === "karalama" ? "karalama-defteri" : "bozuk-telefon",
    people: [person(owner)],
    lines: [],
    strokes: best.strokes,
  };
}

/** Oyun başına tek tur (o oyunun en yüksek tek tur ödülü), ödülü en büyük olanlar önde. */
function roundMoments(input: MomentInput, limit: number): Moment[] {
  if (limit <= 0) return [];
  const best = new Map<string, { rec: RoundRecord; top: number }>();
  for (const rec of input.rounds) {
    if (!rec.summary) continue;
    const top = Math.max(0, ...Object.values(rec.awards));
    if (top < 1) continue;
    const cur = best.get(rec.gameId);
    if (!cur || top > cur.top || (top === cur.top && rec.round > cur.rec.round))
      best.set(rec.gameId, { rec, top });
  }
  const sorted = [...best.values()].sort((a, b) => b.top - a.top || b.rec.round - a.rec.round);
  const out: Moment[] = [];
  for (const { rec, top } of sorted) {
    if (out.length >= limit) break;
    const star = input.ranked.find((r) => rec.awards[r.player.id] === top);
    if (!star || !rec.summary) continue;
    out.push({
      id: `tur-${rec.round}`,
      kind: "round",
      title: input.gameNames[rec.gameId] ?? "Turun yıldızı",
      world: rec.gameId,
      people: [person(star.player, { caption: `+${formatScore(top)} puan` })],
      lines: [rec.summary],
    });
  }
  return out;
}

/** Tur sonlarındaki sıralar (eşit puan aynı sırayı paylaşır). */
export function ranksAfterEachRound(
  rounds: readonly RoundRecord[],
  ids: readonly string[],
): Record<string, number>[] {
  const sorted = [...rounds].sort((a, b) => a.round - b.round);
  const total: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  return sorted.map((r) => {
    for (const id of ids) total[id] = (total[id] ?? 0) + (r.awards[id] ?? 0);
    const out: Record<string, number> = {};
    for (const id of ids) out[id] = 1 + ids.filter((o) => (total[o] ?? 0) > (total[id] ?? 0)).length;
    return out;
  });
}

/** En büyük dönüş: en kötü sıradan son sıraya en çok yükselen (en az 2 basamak, ilk üçte bitiren). */
function comebackMoment(input: MomentInput): Moment | null {
  const ids = input.ranked.map((r) => r.player.id);
  if (ids.length < 3 || input.rounds.length < 2) return null;
  const history = ranksAfterEachRound(input.rounds, ids);
  const last = history[history.length - 1];
  if (!last) return null;
  let pick: { r: RankedPlayer; worst: number; gain: number } | undefined;
  for (const r of input.ranked) {
    const final = last[r.player.id] ?? r.rank;
    if (final > 3) continue;
    const worst = Math.max(...history.slice(0, -1).map((h) => h[r.player.id] ?? 0));
    const gain = worst - final;
    if (gain >= 2 && (!pick || gain > pick.gain)) pick = { r, worst, gain };
  }
  if (!pick) return null;
  const final = last[pick.r.player.id] ?? pick.r.rank;
  return {
    id: "donus",
    kind: "comeback",
    title: "Büyük dönüş",
    world: null,
    people: [person(pick.r.player, { caption: `${formatScore(pick.r.score)} puan` })],
    lines: [`${pick.worst}. sıradan ${final}. sıraya yükseldi`],
  };
}

/** 1–5 kart: kazanan, en iyi çizim, turların yıldızları, varsa büyük dönüş. Sıra: kazanan, çizim, turlar, dönüş. */
export function selectMoments(input: MomentInput): Moment[] {
  const winner = winnerMoment(input);
  if (!winner) return [];
  const drawing = drawingMoment(input);
  const comeback = comebackMoment(input);
  const slots = Math.min(MAX_ROUND_MOMENTS, MAX_MOMENTS - 1 - (drawing ? 1 : 0) - (comeback ? 1 : 0));
  return [
    winner,
    ...(drawing ? [drawing] : []),
    ...roundMoments(input, slots),
    ...(comeback ? [comeback] : []),
  ];
}
