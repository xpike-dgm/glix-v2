import type { RusRuletiPublicView, RusRuletiResult, RusRuletiShot, RusRuletiView } from "@glix/engine";

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
  return { survivors: v.survivors, eliminated: v.eliminated };
}

/** Sunucudan gelen `publicView` bilinmez; Rus Ruleti ortak görünümü olarak doğrulanır. */
export function parseRusRuletiPublicView(v: unknown): RusRuletiPublicView | null {
  if (!isRec(v)) return null;
  if (!isNum(v.startedAt) || !isNum(v.risk) || !isNum(v.shots) || !isNum(v.openAt)) return null;
  if (!isStrArr(v.players) || !isStrArr(v.alive) || !isStrArr(v.eliminated)) return null;
  if (typeof v.holder !== "string" || typeof v.over !== "boolean") return null;
  if (v.deadline !== null && !isNum(v.deadline)) return null;
  const last = parseShot(v.last);
  const result = parseResult(v.result);
  if (last === undefined || result === undefined) return null;
  return {
    startedAt: v.startedAt,
    players: v.players,
    alive: v.alive,
    eliminated: v.eliminated,
    holder: v.holder,
    risk: v.risk,
    shots: v.shots,
    last,
    openAt: v.openAt,
    deadline: v.deadline,
    over: v.over,
    result,
  };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseRusRuletiPrivateView(v: unknown): RusRuletiView | null {
  if (!isRec(v)) return null;
  return v.role === "alive" || v.role === "out" || v.role === "spectator" ? { role: v.role } : null;
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

/** Sahne evresi: son atışın sonucu gösteriliyor (eylem yok) / karar bekleniyor / oyun bitti. */
export type RusRuletiStage = "result" | "deciding" | "over";

export function stageOf(pub: RusRuletiPublicView, now: number): RusRuletiStage {
  if (pub.over) return "over";
  return pub.last !== null && now < pub.openAt ? "result" : "deciding";
}

/** Dilimlenmiş yüzde (halka dolgusu): 0–100. */
export function riskFraction(risk: number): number {
  return Math.min(1, Math.max(0, risk / 100));
}

/** Oyuncu ızgarası sütun sayısı: 2–4 kişi tek sıra, 5–8 kişi dört sütun. */
export function crewColumns(n: number): number {
  return n <= 4 ? Math.max(2, n) : 4;
}
