import type {
  CagrisimAgiPublicView,
  CagrisimAgiView,
  CagrisimGroup,
  CagrisimReveal,
  CagrisimSingle,
} from "@glix/engine";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

function parseGroup(v: unknown): CagrisimGroup | null {
  if (!isRec(v) || !isStr(v.text) || !isStrArr(v.members) || !isNum(v.points)) return null;
  if (v.members.length < 2) return null;
  return { text: v.text, members: v.members, points: v.points };
}

function parseSingle(v: unknown): CagrisimSingle | null {
  if (!isRec(v) || !isStr(v.playerId) || !isStr(v.text)) return null;
  return { playerId: v.playerId, text: v.text };
}

function parseReveal(v: unknown): CagrisimReveal | null {
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

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type CagrisimScreenView = CagrisimAgiPublicView & CagrisimAgiView;

/** Sunucudan gelen `publicView` bilinmez; Çağrışım Ağı ortak görünümü olarak doğrulanır. */
export function parseCagrisimPublicView(v: unknown): CagrisimAgiPublicView | null {
  if (!isRec(v)) return null;
  if (!isNum(v.startedAt) || !isNum(v.answerEndsAt) || !isNum(v.endsAt) || !isStr(v.word)) return null;
  if (v.phase !== "answer" && v.phase !== "reveal") return null;
  if (!isStrArr(v.answeredIds)) return null;
  let reveal: CagrisimReveal | null = null;
  if (v.reveal !== null && v.reveal !== undefined) {
    reveal = parseReveal(v.reveal);
    if (!reveal) return null;
  }
  // Açılış aşamasında sonuç şarttır; cevap aşamasında yoktur.
  if (v.phase === "reveal" && !reveal) return null;
  return {
    startedAt: v.startedAt,
    answerEndsAt: v.answerEndsAt,
    endsAt: v.endsAt,
    word: v.word,
    phase: v.phase,
    answeredIds: v.answeredIds,
    reveal: v.phase === "reveal" ? reveal : null,
  };
}

/** Sunucudan gelen `view` bilinmez; Çağrışım Ağı kişisel görünümü olarak doğrulanır. */
export function parseCagrisimPrivateView(v: unknown): CagrisimAgiView | null {
  if (!isRec(v)) return null;
  if (v.myAnswer !== null && !isStr(v.myAnswer)) return null;
  return { myAnswer: v.myAnswer };
}

export function parseCagrisimView(publicView: unknown, view: unknown): CagrisimScreenView | null {
  const pub = parseCagrisimPublicView(publicView);
  const priv = parseCagrisimPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
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

/** Cevap alanındaki metnin gönderilebilir olup olmadığı (boş ya da yalnız boşluk gönderilmez). */
export function canSubmit(text: string): boolean {
  return text.trim().length > 0;
}

/**
 * Ana kelimenin dairenin genişliğine göre yazı boyutu (cqw): kısa kelime büyük, uzun kelime küçük yazılır
 * ve her zaman dairenin içine sığar.
 */
export function wordScale(word: string): number {
  const n = Math.max(1, [...word].length);
  return Math.min(22, 68 / (n * 0.9));
}
