import {
  CAGRISIM_ROUNDS,
  type CagrisimAgiPublicView,
  type CagrisimAgiView,
  type CagrisimGroup,
  type CagrisimPhase,
  type CagrisimReveal,
  type CagrisimRoundResult,
  type CagrisimSingle,
  matchKey,
  oneLetterApart,
} from "@glix/engine";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const PHASES: readonly CagrisimPhase[] = ["answer", "mini", "final"];

function parseGroup(v: unknown): CagrisimGroup | null {
  if (!isRec(v) || !isStr(v.text) || !isStrArr(v.members) || !isNum(v.points)) return null;
  if (v.members.length < 2) return null;
  const variants = isStrArr(v.variants) ? v.variants.slice(0, 8) : [];
  return { text: v.text, members: v.members, points: v.points, variants };
}

function parseSingle(v: unknown): CagrisimSingle | null {
  if (!isRec(v) || !isStr(v.playerId) || !isStr(v.text)) return null;
  return { playerId: v.playerId, text: v.text };
}

export function parseReveal(v: unknown): CagrisimReveal | null {
  if (!isRec(v) || !Array.isArray(v.groups) || !Array.isArray(v.singles) || !isStrArr(v.silent)) return null;
  const groups: CagrisimGroup[] = [];
  for (const g of v.groups) {
    const parsed = parseGroup(g);
    if (!parsed) return null;
    groups.push(parsed);
  }
  const singles: CagrisimSingle[] = [];
  for (const s of v.singles) {
    const parsed = parseSingle(s);
    if (!parsed) return null;
    singles.push(parsed);
  }
  return { groups, singles, silent: v.silent };
}

function parseScores(v: unknown): Record<string, number> | null {
  if (!isRec(v)) return null;
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v)) {
    if (!isNum(n)) return null;
    out[k] = n;
  }
  return out;
}

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type CagrisimScreenView = CagrisimAgiPublicView & CagrisimAgiView;

/** Sunucudan gelen `publicView` bilinmez; Çağrışım Ağı ortak görünümü olarak doğrulanır. */
export function parseCagrisimPublicView(v: unknown): CagrisimAgiPublicView | null {
  if (!isRec(v)) return null;
  const times = [v.startedAt, v.roundStartedAt, v.answerEndsAt, v.revealEndsAt, v.endsAt];
  if (!times.every(isNum) || !isNum(v.round) || !isNum(v.rounds) || !isStr(v.word)) return null;
  const phase = PHASES.find((p) => p === v.phase);
  if (!phase || !isStrArr(v.answeredIds) || !Array.isArray(v.results)) return null;
  const round = Math.trunc(v.round);
  const rounds = Math.trunc(v.rounds);
  if (rounds < 1 || rounds > 6 || round < 0 || round >= rounds) return null;
  const results: CagrisimRoundResult[] = [];
  for (const r of v.results.slice(0, rounds)) {
    if (!isRec(r) || !isStr(r.word)) return null;
    const reveal = parseReveal(r.reveal);
    if (!reveal) return null;
    results.push({ word: r.word, reveal });
  }
  // Açılış aşamasında bu kelimenin sonucu şarttır.
  if (results.length !== (phase === "answer" ? round : round + 1)) return null;
  const totals = parseScores(v.totals);
  if (!totals) return null;
  const awards = v.awards === null || v.awards === undefined ? null : parseScores(v.awards);
  if (phase === "final" && !awards) return null;
  return {
    startedAt: v.startedAt as number,
    round,
    rounds,
    roundStartedAt: v.roundStartedAt as number,
    answerEndsAt: v.answerEndsAt as number,
    revealEndsAt: v.revealEndsAt as number,
    endsAt: v.endsAt as number,
    word: v.word,
    phase,
    answeredIds: v.answeredIds,
    results,
    totals,
    awards: phase === "final" ? awards : null,
  };
}

/** Sunucudan gelen `view` bilinmez; Çağrışım Ağı kişisel görünümü olarak doğrulanır. */
export function parseCagrisimPrivateView(v: unknown): CagrisimAgiView | null {
  if (v === null || v === undefined) return { myAnswer: null };
  if (!isRec(v)) return null;
  if (v.myAnswer !== null && !isStr(v.myAnswer)) return null;
  return { myAnswer: v.myAnswer };
}

export function parseCagrisimView(publicView: unknown, view: unknown): CagrisimScreenView | null {
  const pub = parseCagrisimPublicView(publicView);
  const priv = parseCagrisimPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** Açılmakta olan (mini ya da büyük açılıştaki) kelimenin sonucu; cevap aşamasında null. */
export function currentReveal(v: CagrisimAgiPublicView): CagrisimReveal | null {
  return v.phase === "answer" ? null : (v.results[v.round]?.reveal ?? null);
}

export type MyOutcome =
  | { kind: "group"; group: CagrisimGroup; index: number }
  | { kind: "single"; text: string }
  | { kind: "silent" };

/** Açılışta bu oyuncunun durumu; izleyici ya da katılımcı olmayan için null. */
export function outcomeOf(reveal: CagrisimReveal, playerId: string): MyOutcome | null {
  const index = reveal.groups.findIndex((g) => g.members.includes(playerId));
  const group = reveal.groups[index];
  if (group) return { kind: "group", group, index };
  const single = reveal.singles.find((s) => s.playerId === playerId);
  if (single) return { kind: "single", text: single.text };
  if (reveal.silent.includes(playerId)) return { kind: "silent" };
  return null;
}

/** Genel skor rozeti (CG-U6): +2 altın, +1 gümüş, yoksa null. */
export function medalOf(awards: Record<string, number> | null, playerId: string): "gold" | "silver" | null {
  const a = awards?.[playerId] ?? 0;
  return a >= 2 ? "gold" : a >= 1 ? "silver" : null;
}

/** Üstteki büyük satır (CG-U6): ağ puanı "n kişilik ağ"; tek kalan ve yazmayan için kısa cümle. */
export function headlineOf(o: MyOutcome): { big: string; small: string; tone: "win" | "none" } {
  if (o.kind === "group") return { big: `${o.group.points} kişilik ağ`, small: "Ağ kurdun!", tone: "win" };
  if (o.kind === "single") return { big: "Bu sefer tek kaldın", small: `“${o.text}”`, tone: "none" };
  return { big: "Yazmadın", small: "Bu kelime boş geçti", tone: "none" };
}

/**
 * Özel damga (CG-U7, puan etkisi yok): herkes tek ağdaysa "TEK YÜREK"; 4+ oyuncuda biri hariç herkes tek ağdaysa ve
 * dışarıdaki bir cevap yazdıysa "KARA KOYUN" (dışarıdaki oyuncu).
 */
export type Stamp = { kind: "heart" } | { kind: "sheep"; playerId: string } | null;
export function stampOf(reveal: CagrisimReveal): Stamp {
  const total = reveal.groups.reduce((n, g) => n + g.members.length, 0) + reveal.singles.length;
  const everyone = total + reveal.silent.length;
  if (reveal.groups.length !== 1 || everyone < 2) return null;
  if (reveal.singles.length === 0 && reveal.silent.length === 0) return { kind: "heart" };
  const lone = reveal.singles[0];
  if (everyone >= 4 && reveal.singles.length === 1 && reveal.silent.length === 0 && lone)
    return { kind: "sheep", playerId: lone.playerId };
  return null;
}

/** Kısa isim (CG-U8): en çok 7 harf, uzunsa "…" ile kesilir; kendin "Sen". */
export function shortName(nickname: string, self: boolean): string {
  if (self) return "Sen";
  const chars = Array.from(nickname.trim());
  return chars.length <= 7 ? chars.join("") : `${chars.slice(0, 6).join("")}…`;
}

/** Cevap alanındaki metnin gönderilebilir olup olmadığı (boş ya da yalnız boşluk gönderilmez). */
export function canSubmit(text: string): boolean {
  return text.trim().length > 0;
}

/** Uzun cevap uyarısı (CG-U9): üç kelimeyi ya da 20 karakteri aşarsa. Gönderme engellenmez. */
export function isLongAnswer(text: string): boolean {
  const t = text.trim();
  return t.split(/\s+/u).filter((w) => w !== "").length > 3 || Array.from(t).length > 20;
}

/** Son 5 sn uyarısı (CG-U15): alan boşsa "empty", yazılmış ama gönderilmemişse "unsent", aksi hâlde null. */
export function lateHint(text: string, remainingMs: number, sent: boolean): "empty" | "unsent" | null {
  if (sent || remainingMs > 5_000 || remainingMs <= 0) return null;
  return canSubmit(text) ? "unsent" : "empty";
}

/**
 * İzleyicinin "Sen de dene" cevabı (CG-U12) hangi ağa düşerdi: aynı eşleşme kurallarıyla (CG-M3) ağın yazılışlarından
 * birine eşit ya da (6+ harfte) bir harf uzaksa o ağ. Yalnız kendi ekranında; sunucuya gitmez.
 */
export function guessGroup(reveal: CagrisimReveal, guess: string): CagrisimGroup | null {
  const key = matchKey(guess);
  if (key === "") return null;
  for (const g of reveal.groups) {
    const keys = [g.text, ...g.variants].map(matchKey);
    if (keys.includes(key)) return g;
  }
  for (const g of reveal.groups) {
    if ([g.text, ...g.variants].map(matchKey).some((k) => oneLetterApart(k, key))) return g;
  }
  return null;
}

/** Mini açılış şeridi (CG-U4): "mavi (4) · dalga (2)"; ağ yoksa null. */
export function miniLine(reveal: CagrisimReveal): string | null {
  if (reveal.groups.length === 0) return null;
  return reveal.groups.map((g) => `${g.text} (${g.members.length})`).join(" · ");
}

/** Mini açılışta isim çipleri (CG-U4): en çok `max` isim, kalanı "+n kişi". */
export function chipList<T>(items: readonly T[], max: number): { shown: T[]; more: number } {
  return { shown: items.slice(0, max), more: Math.max(0, items.length - max) };
}

/**
 * Ana kelimenin dairenin genişliğine göre yazı boyutu (cqw): kısa kelime büyük, uzun kelime küçük yazılır
 * ve her zaman dairenin içine sığar.
 */
export function wordScale(word: string): number {
  const n = Math.max(1, [...word].length);
  return Math.min(22, 68 / (n * 0.9));
}

/** Kürenin sayaç halkası (CG-U2): kalan oran (1 → 0) ve son 5 sn. */
export function ringState(
  now: number,
  startedAt: number,
  endsAt: number,
): { left: number; secs: number; urgent: boolean } {
  const total = Math.max(1, endsAt - startedAt);
  const remain = Math.max(0, endsAt - now);
  return {
    left: Math.min(1, remain / total),
    secs: Math.ceil(remain / 1000),
    urgent: remain > 0 && remain <= 5_000,
  };
}

/** Yörüngedeki/halkadaki i. noktanın konumu (yüzde; merkez 50,50): saat 12'den başlayıp saat yönünde. */
export function ringPoint(i: number, n: number, radius: number): { x: number; y: number } {
  const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
  return { x: 50 + Math.cos(a) * radius, y: 50 + Math.sin(a) * radius };
}

export interface RingPlan {
  /** Adım 0: herkesin kartı ters belirir. Tek kalanlar tek tek, sonra ağlar küçükten büyüğe; en büyük ağ en son. */
  steps: number;
  /** Oyuncu -> kartının açıldığı adım (yazmayanlar tek kalanlarla birlikte). */
  flipAt: Record<string, number>;
  /** `reveal.groups` sırasıyla: her ağın bağlandığı adım. */
  groupStep: number[];
  /** En büyük ağın (`reveal.groups` içindeki) sırası; ağ yoksa null. */
  champion: number | null;
}

/**
 * Büyük açılış sırası (CG-U5): (0) ters kartlar, (1…) tek kalanlar ve yazmayanlar tek tek söner, ardından ağlar
 * küçükten büyüğe bağlanır; en büyük ağ en son ("EN BÜYÜK AĞ"). Eşitlikte sonraki ağ geç gelir. Yalnız sunum.
 */
export function ringPlan(reveal: CagrisimReveal): RingPlan {
  const flipAt: Record<string, number> = {};
  let step = 1;
  for (const s of reveal.singles) flipAt[s.playerId] = step++;
  if (reveal.silent.length > 0) {
    for (const id of reveal.silent) flipAt[id] = step;
    step++;
  }
  const order = reveal.groups
    .map((g, i) => ({ g, i }))
    .sort((a, b) => a.g.members.length - b.g.members.length || b.i - a.i);
  const groupStep = reveal.groups.map(() => 0);
  for (const { g, i } of order) {
    groupStep[i] = step;
    for (const id of g.members) flipAt[id] = step;
    step++;
  }
  const top = order[order.length - 1];
  return { steps: step, flipAt, groupStep, champion: top ? top.i : null };
}

export const SERIES_ROUNDS = CAGRISIM_ROUNDS;
