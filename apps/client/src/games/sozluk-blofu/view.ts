import {
  SOZLUK_WORD_TYPES,
  type SozlukCard,
  type SozlukPhase,
  type SozlukPublicView,
  type SozlukReveal,
  type SozlukView,
  type SozlukWordType,
} from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((p) => typeof p === "string");
const PHASES: readonly SozlukPhase[] = ["write", "pick", "reveal"];

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type SozlukScreenView = SozlukPublicView & SozlukView;

export interface CrewMember {
  id: string;
  nickname: string;
  avatar: number;
  connected: boolean;
}

function parseStringRecord(v: unknown): Record<string, string> | null {
  if (!isRec(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, s] of Object.entries(v)) {
    if (typeof s !== "string") return null;
    out[k] = s;
  }
  return out;
}

function parseCards(v: unknown): SozlukCard[] | null {
  if (!Array.isArray(v)) return null;
  const out: SozlukCard[] = [];
  for (const c of v) {
    if (!isRec(c) || typeof c.id !== "string" || typeof c.text !== "string") return null;
    out.push({ id: c.id, text: c.text });
  }
  return out;
}

function parseReveal(v: unknown): SozlukReveal | null {
  if (!isRec(v) || typeof v.realCard !== "string") return null;
  const authors = parseStringRecord(v.authors);
  const picks = parseStringRecord(v.picks);
  const scores = parseNumberRecord(v.scores);
  // Eski sunucu ödül göndermezse (geçiş dönemi) ödül rozeti görünmez: boş kabul edilir.
  const awards = v.awards === undefined ? {} : parseNumberRecord(v.awards);
  if (!authors || !picks || !scores || !awards) return null;
  return { realCard: v.realCard, authors, picks, scores, awards };
}

/** Sunucudan gelen `publicView` bilinmez; Sözlük Blöfü ortak görünümü olarak doğrulanır. */
export function parseSozlukPublicView(v: unknown): SozlukPublicView | null {
  if (!isRec(v)) return null;
  if (!isStrArr(v.players) || !isStrArr(v.ready) || typeof v.word !== "string") return null;
  if (typeof v.phase !== "string" || !PHASES.includes(v.phase as SozlukPhase)) return null;
  if (!isNum(v.startedAt) || !isNum(v.writeEndsAt) || !isNum(v.pickEndsAt) || !isNum(v.finishAt)) return null;
  const cards = v.cards === null || v.cards === undefined ? null : parseCards(v.cards);
  if (v.cards !== null && v.cards !== undefined && cards === null) return null;
  const reveal = v.reveal === null || v.reveal === undefined ? null : parseReveal(v.reveal);
  if (v.reveal !== null && v.reveal !== undefined && reveal === null) return null;
  const wordType =
    typeof v.wordType === "string" && (SOZLUK_WORD_TYPES as readonly string[]).includes(v.wordType)
      ? (v.wordType as SozlukWordType)
      : null;
  return {
    players: [...v.players],
    phase: v.phase as SozlukPhase,
    word: v.word,
    wordType,
    startedAt: v.startedAt,
    writeEndsAt: v.writeEndsAt,
    pickEndsAt: v.pickEndsAt,
    finishAt: v.finishAt,
    ready: [...v.ready],
    cards,
    reveal,
  };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseSozlukPrivateView(v: unknown): SozlukView | null {
  if (!isRec(v)) return null;
  for (const key of ["myBluff", "myCard", "myPick"] as const) {
    if (v[key] !== null && typeof v[key] !== "string") return null;
  }
  if (typeof v.locked !== "boolean") return null;
  return {
    myBluff: v.myBluff as string | null,
    myCard: v.myCard as string | null,
    myPick: v.myPick as string | null,
    locked: v.locked,
    myKnew: v.myKnew === true,
  };
}

/** Kişisel bilgisi olmayan görünüm (TV sahnesi `view: null` verir). */
const NOBODY: SozlukView = { myBluff: null, myCard: null, myPick: null, locked: false, myKnew: false };

export function parseSozlukView(publicView: unknown, view: unknown): SozlukScreenView | null {
  const pub = parseSozlukPublicView(publicView);
  const priv = view === null ? NOBODY : parseSozlukPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** Sunucunun reddetme nedeni → oyuncuya gösterilen dostça Türkçe cümle (teknik kod gösterilmez). */
export function bluffErrorText(reason: string | undefined): string {
  switch (reason) {
    case "same_as_real":
      return "Bu zaten gerçek anlam! Kendi cümleni yaz.";
    case "too_long":
      return "Biraz kısalt, en çok 100 karakter.";
    case "empty":
      return "Önce bir şeyler yaz.";
    case "not_writing":
    case "ended":
      return "Süre doldu.";
    case "already_written":
      return "Tanımın zaten gönderildi.";
    default:
      return "Gönderemedim, tekrar dene.";
  }
}

/** Gönder düğmesi için: görünür karakter var mı ve en çok 100 karakter mi. */
export function canSubmitBluff(text: string, max = 100): boolean {
  const trimmed = text.replace(/\s+/gu, " ").trim();
  return trimmed.length > 0 && [...trimmed].length <= max;
}

export interface RevealCard {
  id: string;
  /** Seçme ekranındaki ortak numara (1'den; herkes için aynı). */
  no: number;
  text: string;
  real: boolean;
  author: string | null;
  /** Bu kartı seçenler (katılım sırasıyla). */
  pickers: string[];
}

/** Kart numarası: ortak kart sırasındaki yer (1'den). Kendi kartın listeden çıksa da numaralar değişmez (SB-U4). */
export function cardNumber(cards: readonly SozlukCard[], id: string | null): number | null {
  if (id === null) return null;
  const i = cards.findIndex((c) => c.id === id);
  return i < 0 ? null : i + 1;
}

/**
 * Açılış kartları, son sıra: gerçek kart başta, sonra sahte kartlar seçilme sayısına göre (eşitte kart sırasıyla).
 * Bilinmeyen/bozuk eşleşmeler atılır.
 */
export function revealCards(
  cards: readonly SozlukCard[],
  reveal: SozlukReveal,
  order: readonly string[],
): RevealCard[] {
  const out = cards.map((c, i) => ({
    id: c.id,
    no: i + 1,
    text: c.text,
    real: c.id === reveal.realCard,
    author: reveal.authors[c.id] ?? null,
    pickers: order.filter((p) => reveal.picks[p] === c.id),
  }));
  return out
    .map((c, i) => ({ c, i }))
    .sort(
      (a, b) => Number(b.c.real) - Number(a.c.real) || b.c.pickers.length - a.c.pickers.length || a.i - b.i,
    )
    .map((x) => x.c);
}

/** Açılış zamanlaması (SB-U5, ms; açılışın başından). Tamamı en az açılış süresine (12 sn) sığar. */
export const SB_REVEAL = {
  /** Sahte kart başına (8 kişide en çok 8 sahte kart = 8 sn). */
  fakeMs: 1_000,
  /** "Gerçek anlam…" bekleyişi (kalan kart titrer, davul). */
  suspenseMs: 1_500,
  /** Mühür vuruşu ve mürekkep. */
  stampMs: 1_000,
  /** Özet (özel damga) gösterilir; sonra kartlar son sıraya kayar. */
  summaryMs: 1_500,
  /** Hareket azaltmada kartlar bu arayla belirir. */
  calmMs: 600,
} as const;

export interface RevealPlan {
  /** Sahte kartların çevrilme anı (kart kimliği → ms); azdan çoğa kandırana. */
  flipAt: Record<string, number>;
  /** "Gerçek anlam…" yazısının çıktığı an. */
  suspenseAt: number;
  /** Gerçek kartın mühürlendiği an. */
  stampAt: number;
  /** Özel damga ve kendi puan özetinin çıktığı an. */
  summaryAt: number;
  /** Kartların son sıraya (gerçek üstte) kaydığı, dizinin bittiği an. */
  doneAt: number;
  /** En çok kişiyi kandıran sahte kart (tekse; kimse kandırılmadıysa ya da eşitse null). */
  champion: string | null;
}

/**
 * Mühürlü açılış (SB-U5, yalnız sunum): önce sahte kartlar azdan çoğa kandırana doğru tek tek çevrilir, en son
 * "Gerçek anlam…" ve mühür. Eşitlikte kart sırası korunur. Yalnız açılışta zaten herkese giden veriden hesaplanır.
 */
export function revealPlan(cards: readonly RevealCard[], calm = false): RevealPlan {
  const fakes = cards
    .filter((c) => !c.real)
    .sort((a, b) => a.pickers.length - b.pickers.length || a.no - b.no);
  const step = calm ? SB_REVEAL.calmMs : SB_REVEAL.fakeMs;
  const flipAt: Record<string, number> = {};
  fakes.forEach((c, i) => {
    flipAt[c.id] = i * step;
  });
  const suspenseAt = fakes.length * step;
  const stampAt = suspenseAt + (calm ? SB_REVEAL.calmMs : SB_REVEAL.suspenseMs);
  const summaryAt = stampAt + (calm ? SB_REVEAL.calmMs : SB_REVEAL.stampMs);
  const doneAt = summaryAt + (calm ? SB_REVEAL.calmMs : SB_REVEAL.summaryMs);
  const max = Math.max(0, ...fakes.map((c) => c.pickers.length));
  const tops = fakes.filter((c) => c.pickers.length === max);
  const champion = max > 0 && tops.length === 1 ? (tops[0]?.id ?? null) : null;
  return { flipAt, suspenseAt, stampAt, summaryAt, doneAt, champion };
}

export type SpecialMoment = "sozluk" | "usta" | "herkes" | null;

/**
 * Açılış sonundaki tek özel damga (SB-U8): gerçeği kimse bulamadıysa "SÖZLÜK KAZANDI", tek bir en çok kandıran varsa
 * "BLÖF USTASI", seçim yapan herkes gerçeği bulduysa "HERKES BİLDİ". Öncelik bu sıradadır. ("AYNI BLÖF!" ikiz kart
 * maddesi onaylanmadığı için yoktur.)
 */
export function specialMoment(cards: readonly RevealCard[], champion: string | null): SpecialMoment {
  const real = cards.find((c) => c.real);
  const picked = cards.reduce((n, c) => n + c.pickers.length, 0);
  if (!real || picked === 0) return null;
  if (real.pickers.length === 0) return "sozluk";
  if (champion !== null) return "usta";
  if (real.pickers.length === picked && cards.length > 1) return "herkes";
  return null;
}

export interface MyOutcome {
  /** Gerçeği buldun mu (seçmediysen null). */
  found: boolean | null;
  /** Blöfünü seçen kişi sayısı. */
  fooled: number;
  /** Blöf puanı (mini puan). */
  points: number;
  /** Genel skor ödülü (SB-M1). */
  award: number;
  /** Seçtiğin kart; seçmediysen null. */
  pick: string | null;
  /** Kandırıldıysan kandıranın kimliği. */
  fooledBy: string | null;
  /** Blöf yazdın mı. */
  wrote: boolean;
}

export function myOutcome(reveal: SozlukReveal, selfId: string): MyOutcome {
  const pick = reveal.picks[selfId] ?? null;
  const mine = Object.entries(reveal.authors).find(([, a]) => a === selfId)?.[0];
  const fooled = mine === undefined ? 0 : Object.values(reveal.picks).filter((c) => c === mine).length;
  return {
    found: pick === null ? null : pick === reveal.realCard,
    fooled,
    points: reveal.scores[selfId] ?? 0,
    award: reveal.awards[selfId] ?? 0,
    pick,
    fooledBy: pick !== null && pick !== reveal.realCard ? (reveal.authors[pick] ?? null) : null,
    wrote: mine !== undefined,
  };
}

/** Puan başlığı (SB-U9): iki parçalı satır; puan almayan için tek satır. */
export function scoreLine(o: MyOutcome): string {
  const parts: string[] = [];
  if (o.found) parts.push("Gerçeği buldun +1");
  if (o.fooled > 0) parts.push(`${o.fooled} kişiyi kandırdın +${o.fooled}`);
  if (parts.length > 0) return parts.join(" · ");
  if (!o.wrote) return o.found === false ? "Bu sefer olmadı · gerçeği bulamadın" : "Bu sefer olmadı";
  return "Bu sefer olmadı · blöfün kimseyi kandırmadı";
}

/** İsim çipi (SB-U7): 8 harften uzun ad kesilir. */
export function chipName(name: string): string {
  const chars = [...name];
  return chars.length > 8 ? `${chars.slice(0, 8).join("")}…` : name;
}

/** Ekran okuyucu için açılış özeti (SB-U18). */
export function revealAnnouncement(cards: readonly RevealCard[], o: MyOutcome | null): string {
  const real = cards.find((c) => c.real);
  if (!real) return "";
  const found = real.pickers.length;
  let text = `Gerçek anlam ${real.no} numaraydı, ${found === 0 ? "kimse bulamadı" : `${found} kişi buldu`}.`;
  if (o?.wrote) text += o.fooled > 0 ? ` Blöfün ${o.fooled} kişiyi kandırdı.` : " Blöfün kimseyi kandırmadı.";
  return text;
}

/**
 * Tanım kalıpları (SB-U2): sabit liste, tür başına 6; yapay zekâ üretmez. `before` alana eklenir, imleç ikisinin
 * arasına konur (`after` imlecin sağında kalır).
 */
export interface Template {
  label: string;
  before: string;
  after: string;
}
const T = (label: string): Template => {
  const at = label.indexOf("…");
  return at < 0
    ? { label, before: label, after: "" }
    : { label, before: label.slice(0, at), after: label.slice(at + 1) };
};
export const TEMPLATES: Readonly<Record<SozlukWordType, readonly Template[]>> = {
  isim: ["bir tür …", "… için kullanılan", "… olan kimse", "eskiden …", "… yapan usta", "… gibi olan"].map(T),
  sıfat: ["… olan", "… gibi", "çok … olan", "… görünen", "… yapmayan", "… özelliği olan"].map(T),
  fiil: ["… -mek", "… hâle getirmek", "… yapmak", "birini …", "bir şeyi …", "… olmak"].map(T),
  zarf: ["… biçimde", "… olarak", "… gibi", "… zamanda", "çok …", "… iken"].map(T),
};
export const templatesFor = (type: SozlukWordType | null): readonly Template[] => TEMPLATES[type ?? "isim"];

/** Kalıbı metne ekler: imleç konumundaki seçimin yerine `before`+`after`, imleç `before`'un sonuna. */
export function insertTemplate(
  text: string,
  start: number,
  end: number,
  t: Template,
): { text: string; caret: number } {
  const head = text.slice(0, start);
  const tail = text.slice(end);
  const lead = t.before !== "" && head !== "" && !/\s$/u.test(head) && !/^\s/u.test(t.before) ? " " : "";
  const before = lead + t.before;
  return { text: head + before + t.after + tail, caret: head.length + before.length };
}

/** Kalan saniye ve uyarı düzeyi (SB-U1): son 10 sn amber, son 5 sn kırmızı. */
export function clockLevel(secs: number): "calm" | "warn" | "hot" {
  if (secs <= 5) return "hot";
  return secs <= 10 ? "warn" : "calm";
}
