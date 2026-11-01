import {
  RUS_RULETI_MAX_RISK,
  RUS_RULETI_OPEN_MS,
  RUS_RULETI_RISK_STEP,
  RUS_RULETI_SPIN_MS,
  type RusRuletiHandoff,
  type RusRuletiLastWord,
  type RusRuletiPredictionResult,
  type RusRuletiPublicView,
  type RusRuletiResult,
  type RusRuletiShot,
  type RusRuletiTally,
  type RusRuletiView,
} from "@glix/engine";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

function parseShot(v: unknown): RusRuletiShot | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  if (
    !isNum(v.seq) ||
    typeof v.shooter !== "string" ||
    typeof v.target !== "string" ||
    typeof v.auto !== "boolean" ||
    typeof v.exploded !== "boolean" ||
    !isNum(v.risk) ||
    !isNum(v.at)
  )
    return undefined;
  return {
    seq: v.seq,
    shooter: v.shooter,
    target: v.target,
    auto: v.auto,
    exploded: v.exploded,
    risk: v.risk,
    at: v.at,
  };
}

function parseResult(v: unknown): RusRuletiResult | null | undefined {
  if (v === null) return null;
  if (!isRec(v) || !isStrArr(v.survivors) || !isStrArr(v.eliminated)) return undefined;
  return {
    survivors: v.survivors,
    eliminated: v.eliminated,
    kahinler: isStrArr(v.kahinler) ? v.kahinler : [],
  };
}

/** RR-U3: atış geçmişi; alan yoksa boş (eski sunucu), bozuksa geçersiz. */
function parseHistory(v: unknown): RusRuletiShot[] | undefined {
  if (v === undefined) return [];
  if (!Array.isArray(v)) return undefined;
  const out: RusRuletiShot[] = [];
  for (const x of v) {
    const s = parseShot(x);
    if (!s) return undefined;
    out.push(s);
  }
  return out;
}

function parseLastWord(v: unknown): RusRuletiLastWord | null | undefined {
  if (v === undefined || v === null) return null;
  if (!isRec(v) || typeof v.from !== "string" || !isNum(v.opensAt) || !isNum(v.endsAt)) return undefined;
  return { from: v.from, opensAt: v.opensAt, endsAt: v.endsAt };
}

function parseHandoff(v: unknown): RusRuletiHandoff | null | undefined {
  if (v === undefined || v === null) return null;
  if (!isRec(v) || typeof v.from !== "string" || typeof v.to !== "string" || typeof v.chosen !== "boolean")
    return undefined;
  return { from: v.from, to: v.to, chosen: v.chosen };
}

/** Sunucudan gelen `publicView` bilinmez; Rus Ruleti ortak görünümü olarak doğrulanır. */
export function parseRusRuletiPublicView(v: unknown): RusRuletiPublicView | null {
  if (!isRec(v)) return null;
  if (!isNum(v.startedAt) || !isNum(v.risk) || !isNum(v.shots) || !isNum(v.openAt)) return null;
  if (!isStrArr(v.players) || !isStrArr(v.alive) || !isStrArr(v.eliminated)) return null;
  if (typeof v.holder !== "string" || typeof v.over !== "boolean") return null;
  if (v.deadline !== null && !isNum(v.deadline)) return null;
  if (v.noReturn !== undefined && v.noReturn !== null && typeof v.noReturn !== "string") return null;
  const last = parseShot(v.last);
  const result = parseResult(v.result);
  const history = parseHistory(v.history);
  const lastWord = parseLastWord(v.lastWord);
  const handoff = parseHandoff(v.handoff);
  if (
    last === undefined ||
    result === undefined ||
    history === undefined ||
    lastWord === undefined ||
    handoff === undefined
  )
    return null;
  return {
    startedAt: v.startedAt,
    players: v.players,
    alive: v.alive,
    eliminated: v.eliminated,
    holder: v.holder,
    risk: v.risk,
    shots: v.shots,
    last,
    history,
    noReturn: typeof v.noReturn === "string" ? v.noReturn : null,
    lastWord,
    handoff,
    openAt: v.openAt,
    deadline: v.deadline,
    over: v.over,
    result,
  };
}

const EMPTY_TALLY: RusRuletiTally = { made: 0, hit: 0, yes: 0, yesHit: 0 };

function parseTally(v: unknown): RusRuletiTally | undefined {
  if (v === undefined) return EMPTY_TALLY;
  if (!isRec(v) || !isNum(v.made) || !isNum(v.hit) || !isNum(v.yes) || !isNum(v.yesHit)) return undefined;
  return { made: v.made, hit: v.hit, yes: v.yes, yesHit: v.yesHit };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseRusRuletiPrivateView(v: unknown): RusRuletiView | null {
  if (!isRec(v)) return null;
  if (v.role === "alive" || v.role === "spectator") return { role: v.role };
  if (v.role !== "out" || !isNum(v.turn)) return null;
  if (v.prediction !== null && typeof v.prediction !== "boolean") return null;
  let lastResult: RusRuletiPredictionResult | null = null;
  if (v.lastResult !== null && v.lastResult !== undefined) {
    const r = v.lastResult;
    if (!isRec(r) || !isNum(r.turn) || typeof r.correct !== "boolean") return null;
    lastResult = { turn: r.turn, correct: r.correct };
  }
  const tally = parseTally(v.tally);
  if (!tally) return null;
  return { role: "out", turn: v.turn, prediction: v.prediction, lastResult, tally };
}

export interface RusRuletiScreenView {
  pub: RusRuletiPublicView;
  priv: RusRuletiView;
}

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseRusRuletiView(publicView: unknown, view: unknown): RusRuletiScreenView | null {
  const pub = parseRusRuletiPublicView(publicView);
  const priv = parseRusRuletiPrivateView(view);
  return pub && priv ? { pub, priv } : null;
}

/**
 * Sahne evresi:
 * - `spin` (RR-U5): son atışın tamburu dönüyor (sonuç henüz gösterilmez),
 * - `result`: son atışın sonucu ("Klik!" / "BAM!"),
 * - `lastWord` (RR-M3): elenen silahı kime vereceğini seçiyor,
 * - `handoff`: son söz verildi, karar penceresi birazdan açılır,
 * - `deciding`: karar bekleniyor,
 * - `over`: oyun bitti, oyun içi açılış (RR-U8).
 */
export type RusRuletiStage = "spin" | "result" | "lastWord" | "handoff" | "deciding" | "over";

export function stageOf(pub: RusRuletiPublicView, now: number): RusRuletiStage {
  const l = pub.last;
  if (l && now < l.at + RUS_RULETI_SPIN_MS) return "spin";
  if (l && now < l.at + RUS_RULETI_OPEN_MS) return "result";
  if (pub.over) return "over";
  if (pub.lastWord) return "lastWord";
  if (now < pub.openAt && pub.handoff) return "handoff";
  if (now < pub.openAt && l) return "result";
  return "deciding";
}

/**
 * RR-U5: tambur dönerken ekran atışın sonucunu ele vermez: masa, sayaç, geçmiş ve silah sahibi atıştan önceki
 * hâliyle çizilir (sonuç sunucuda belli olsa da 1,2 sn gösterilmez).
 */
export function displayPub(pub: RusRuletiPublicView, now: number): RusRuletiPublicView {
  const l = pub.last;
  if (!l || stageOf(pub, now) !== "spin") return pub;
  const out = l.exploded;
  const history = pub.history.slice(0, -1);
  return {
    ...pub,
    alive: out ? pub.players.filter((id) => pub.alive.includes(id) || id === l.target) : pub.alive,
    eliminated: out ? pub.eliminated.filter((id) => id !== l.target) : pub.eliminated,
    holder: l.shooter,
    risk: l.risk,
    shots: l.seq - 1,
    history,
    noReturn: null,
    lastWord: null,
    handoff: null,
    over: false,
    result: null,
  };
}

/** RR-U5: halkanın gösterdiği risk: tambur dönerken atışın riski, sonra sıradaki risk. */
export function shownRisk(pub: RusRuletiPublicView, now: number): number {
  return stageOf(pub, now) === "spin" && pub.last ? pub.last.risk : pub.risk;
}

/** Dilimlenmiş yüzde (halka dolgusu): 0–100. */
export function riskFraction(risk: number): number {
  return Math.min(1, Math.max(0, risk / 100));
}

/** RR-U4: boş geçerse sıradaki risk. */
export function nextRisk(risk: number): number {
  return Math.min(RUS_RULETI_MAX_RISK, risk + RUS_RULETI_RISK_STEP);
}

/** RR-U4: halkanın altındaki satır. */
export function riskLine(risk: number): string {
  return risk >= RUS_RULETI_MAX_RISK
    ? `Risk tavanda: %${RUS_RULETI_MAX_RISK}`
    : `Boş geçerse sıradaki: %${nextRisk(risk)}`;
}

/** RR-U2: oyunun bitmesi için daha kaç elenme gerekiyor. */
export function outsLeft(players: number, eliminated: number): number {
  return Math.max(0, players - Math.floor(players / 2) - eliminated);
}

/** RR-U2: bitiş sayacı yazısı. */
export function outsText(left: number): string {
  if (left <= 0) return "Oyun bitti";
  return left === 1 ? "Son kurşun!" : `${left} elenme daha → oyun biter`;
}

/** RR-U3: atış kaydı satırı ("Mert → Elif · %26 · klik"; otomatik atış ⏱). */
export function shotLine(s: RusRuletiShot, nameOf: (id: string) => string): string {
  const who = `${nameOf(s.shooter)} → ${nameOf(s.target)}`;
  return `${s.auto ? "⏱ " : ""}${who} · %${s.risk} · ${s.exploded ? "BAM" : "klik"}`;
}

/** RR-U3: son `n` atış, en yenisi önde. */
export function recentShots(history: readonly RusRuletiShot[], n = 4): RusRuletiShot[] {
  return history.slice(-n).reverse();
}

/** RR-U8: elenme kaydı: kimi kim, hangi riskte vurdu (elenme sırasıyla). */
export interface OutEntry {
  id: string;
  order: number;
  shooter: string | null;
  risk: number | null;
  self: boolean;
}
export function outEntries(eliminated: readonly string[], history: readonly RusRuletiShot[]): OutEntry[] {
  return eliminated.map((id, i) => {
    const shot = history.find((h) => h.exploded && h.target === id);
    return {
      id,
      order: i + 1,
      shooter: shot?.shooter ?? null,
      risk: shot?.risk ?? null,
      self: shot !== undefined && shot.shooter === shot.target,
    };
  });
}

/** Masadaki koltuk: kap içinde yüzde konum. */
export interface SeatPos {
  id: string;
  x: number;
  y: number;
}

/**
 * RR-U1: oyuncular oval masanın çevresinde, maç başındaki sırayla. "Sen" her zaman altta ortada (başparmak bölgesi);
 * diğerleri saat yönünde eşit aralıkla (2 kişide karşılıklı, 3'te üçgen, 4'te kare, 5–8 oval).
 */
export function seatPositions(ids: readonly string[], selfId: string): SeatPos[] {
  const mine = ids.indexOf(selfId);
  const ordered = mine > 0 ? [...ids.slice(mine), ...ids.slice(0, mine)] : [...ids];
  const n = Math.max(1, ordered.length);
  const rx = n >= 7 ? 39 : 37;
  const ry = 38;
  return ordered.map((id, i) => {
    const deg = 90 + (i * 360) / n;
    const a = (deg * Math.PI) / 180;
    return { id, x: 50 + rx * Math.cos(a), y: 50 + ry * Math.sin(a) };
  });
}

/** RR-U1: tabancanın namlusunun bakacağı açı (derece; 0 = sağ, saat yönü). Koltuk yoksa yukarı. */
export function aimAngle(seat: SeatPos | undefined): number {
  if (!seat) return -90;
  return (Math.atan2(seat.y - 50, seat.x - 50) * 180) / Math.PI;
}

/** RR-U1: ad en çok 8 harf; uzunsa "…". */
export function shortName(name: string, max = 8): string {
  const chars = Array.from(name);
  return chars.length > max ? `${chars.slice(0, max).join("")}…` : name;
}

/** Sahibin bir koltuğa dokunup dokunamayacağı (kural sunucudadır; yalnız işaretler). */
export type SeatTap = "ok" | "self" | "return" | "dead";
export function seatTap(pub: RusRuletiPublicView, id: string, selfId: string): SeatTap {
  if (!pub.alive.includes(id)) return "dead";
  if (id === selfId) return "self";
  return pub.noReturn === id ? "return" : "ok";
}

const BACK = "aıou";
const FRONT = "eiöü";
const VOWELS = BACK + FRONT;
const HARD = "fstkçşhp";

function lastVowel(word: string): string {
  const lower = word.toLocaleLowerCase("tr");
  for (let i = lower.length - 1; i >= 0; i--) {
    const c = lower[i] as string;
    if (VOWELS.includes(c)) return c;
  }
  return "e";
}
const endsVowel = (name: string): boolean => VOWELS.includes(name.toLocaleLowerCase("tr").slice(-1));
const narrow = (v: string): string =>
  v === "a" || v === "ı" ? "ı" : v === "e" || v === "i" ? "i" : v === "o" || v === "u" ? "u" : "ü";

/** İlgi eki: Mert'in, Kaan'ın, Ayşe'nin. */
export function genitive(name: string): string {
  return `${name}'${endsVowel(name) ? "n" : ""}${narrow(lastVowel(name))}n`;
}

/** Belirtme eki: Elif'i, Kaan'ı, Ayşe'yi. */
export function accusative(name: string): string {
  return `${name}'${endsVowel(name) ? "y" : ""}${narrow(lastVowel(name))}`;
}

/** Yönelme eki: Mert'e, Kaan'a, Ayşe'ye. */
export function dative(name: string): string {
  const a = BACK.includes(lastVowel(name)) ? "a" : "e";
  return `${name}'${endsVowel(name) ? "y" : ""}${a}`;
}

/** Bulunma eki: Mert'te, Elif'te, Kaan'da, Ayşe'de. */
export function locative(name: string): string {
  const last = name.toLocaleLowerCase("tr").slice(-1);
  const a = BACK.includes(lastVowel(name)) ? "a" : "e";
  return `${name}'${HARD.includes(last) ? "t" : "d"}${a}`;
}

/** RR-U6: BAM alt satırı ("Mert, Elif'i vurdu" / "Elif kendine sıktı"). */
export function bamLine(shot: RusRuletiShot, nameOf: (id: string) => string, selfId: string): string {
  if (shot.shooter === shot.target)
    return shot.target === selfId ? "Kendine sıktın" : `${nameOf(shot.target)} kendine sıktı`;
  if (shot.shooter === selfId) return `${accusative(nameOf(shot.target))} vurdun`;
  if (shot.target === selfId) return `Seni ${nameOf(shot.shooter)} vurdu`;
  return `${nameOf(shot.shooter)}, ${accusative(nameOf(shot.target))} vurdu`;
}

/** RR-U13: elenenin karnesi ("Tahminlerin: 3 · bildiğin 1 · Evet: 2'de 1"). */
export function tallyLine(t: RusRuletiTally): string {
  if (t.made === 0) return "Henüz tahminin yok";
  const base = `Tahminlerin: ${t.made} · bildiğin ${t.hit}`;
  return t.yes > 0 ? `${base} · Evet: ${numLocative(t.yes)} ${t.yesHit}` : base;
}

const UNIT_LOC = ["", "de", "de", "te", "te", "te", "da", "de", "de", "da"];
const TEN_LOC = ["", "da", "de", "da", "ta", "de", "ta", "te", "de", "da"];

/** Sayıya bulunma eki: 1'de, 3'te, 6'da, 10'da, 40'ta, 100'de. */
export function numLocative(n: number): string {
  const v = Math.abs(Math.trunc(n));
  if (v === 0) return "0'da";
  const unit = v % 10;
  const ten = Math.floor(v / 10) % 10;
  const suffix = unit > 0 ? UNIT_LOC[unit] : ten > 0 ? TEN_LOC[ten] : "de";
  return `${v}'${suffix}`;
}
