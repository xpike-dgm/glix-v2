import type {
  SonKisiEscape,
  SonKisiPhase,
  SonKisiPublicView,
  SonKisiRoundResult,
  SonKisiStanding,
  SonKisiTension,
  SonKisiView,
} from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown): v is number => isNum(v) && Number.isInteger(v) && v >= 0;
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

function parseTension(v: unknown): SonKisiTension | null {
  return v === 0 || v === 1 || v === 2 || v === 3 ? v : null;
}
function parsePhase(v: unknown): SonKisiPhase | null {
  return v === "play" || v === "gap" || v === "over" ? v : null;
}

function parseEscape(v: unknown): SonKisiEscape | null {
  if (
    !isRec(v) ||
    typeof v.id !== "string" ||
    !isNum(v.ms) ||
    !isNum(v.points) ||
    typeof v.close !== "boolean"
  )
    return null;
  return { id: v.id, ms: v.ms, points: v.points, close: v.close };
}

function parseRound(v: unknown): SonKisiRoundResult | null {
  if (!isRec(v) || !isInt(v.index) || !isNum(v.alarmMs) || typeof v.rang !== "boolean") return null;
  if (!Array.isArray(v.escapes) || !isStrArr(v.caught) || !isStrArr(v.last) || !isStrArr(v.second))
    return null;
  const points = parseNumberRecord(v.points);
  if (!points) return null;
  const escapes: SonKisiEscape[] = [];
  for (const e of v.escapes) {
    const p = parseEscape(e);
    if (!p) return null;
    escapes.push(p);
  }
  return {
    index: v.index,
    alarmMs: v.alarmMs,
    rang: v.rang,
    escapes,
    caught: v.caught,
    last: v.last,
    second: v.second,
    points,
  };
}

function parseStanding(v: unknown): SonKisiStanding | null {
  if (!isRec(v) || typeof v.playerId !== "string" || !isNum(v.total) || !isInt(v.rank) || !isNum(v.award))
    return null;
  if (!Array.isArray(v.roundPoints) || !v.roundPoints.every(isNum)) return null;
  return { playerId: v.playerId, total: v.total, roundPoints: v.roundPoints, rank: v.rank, award: v.award };
}

/** Sunucudan gelen `publicView` bilinmez; Son Kişi ortak görünümü olarak doğrulanır. */
export function parseSonKisiPublicView(v: unknown): SonKisiPublicView | null {
  if (!isRec(v) || !isNum(v.startedAt) || !isInt(v.rounds) || !isInt(v.round) || !isInt(v.escapedCount))
    return null;
  if (typeof v.finished !== "boolean" || !Array.isArray(v.results)) return null;
  const tension = parseTension(v.tension);
  const phase = parsePhase(v.phase);
  const totals = parseNumberRecord(v.totals);
  if (tension === null || phase === null || !totals) return null;
  const results: SonKisiRoundResult[] = [];
  for (const r of v.results) {
    const p = parseRound(r);
    if (!p) return null;
    results.push(p);
  }
  let final: SonKisiStanding[] | null = null;
  if (v.final !== null) {
    if (!Array.isArray(v.final)) return null;
    final = [];
    for (const s of v.final) {
      const p = parseStanding(s);
      if (!p) return null;
      final.push(p);
    }
  }
  return {
    startedAt: v.startedAt,
    rounds: v.rounds,
    round: v.round,
    phase,
    tension,
    escapedCount: v.escapedCount,
    results,
    totals,
    final,
    finished: v.finished,
  };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseSonKisiPrivateView(v: unknown): SonKisiView | null {
  if (!isRec(v) || typeof v.escaped !== "boolean") return null;
  if (v.myMs !== null && !isNum(v.myMs)) return null;
  return { escaped: v.escaped, myMs: v.myMs };
}

export interface SonKisiScreenView {
  pub: SonKisiPublicView;
  priv: SonKisiView;
}

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseSonKisiView(publicView: unknown, view: unknown): SonKisiScreenView | null {
  const pub = parseSonKisiPublicView(publicView);
  const priv = parseSonKisiPrivateView(view);
  return pub && priv ? { pub, priv } : null;
}

/** Süre metni: 12,4 sn (Türkçe virgül, onda bire aşağı yuvarlanır). */
export function formatSeconds(ms: number): string {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  return `${Math.floor(tenths / 10)},${tenths % 10} sn`;
}

/** Tur puanı rozeti: "+2", "0". */
export const pointsText = (p: number): string => (p > 0 ? `+${p}` : String(p));

/** Gerilim düzeyine göre titreşim/ışık nabzı süresi (ms); düzey arttıkça hızlanır. */
export function pulseMs(tension: SonKisiTension): number {
  return [2800, 1700, 1000, 520][tension] ?? 2800;
}

/** SK-U15: içerideki oyuncu için sürekli kalp atışı aralığı (ms): düzey 1 70/dk, 2 100/dk, 3 140/dk; 0'da yok. */
export function heartbeatMs(tension: SonKisiTension): number | null {
  return tension === 0 ? null : Math.round(60_000 / ([0, 70, 100, 140][tension] ?? 70));
}

/** SK-U2: başlık ve alt başlık (oyun sırasında). Kendi süren yalnız sende. */
export function playHeadline(opts: {
  spectator: boolean;
  escaped: boolean;
  myMs: number | null;
  inside: number;
  players: number;
}): { head: string; sub: string } {
  if (opts.spectator) return { head: "Koridoru izliyorsun", sub: "Son kaçan kazanır" };
  if (opts.escaped)
    return {
      head: opts.myMs === null ? "Kaçtın!" : `Kaçtın! · ${formatSeconds(opts.myMs).replace(" sn", " sn'de")}`,
      sub: "Alarm çalınca sonuç açılır",
    };
  if (opts.inside === 1 && opts.players >= 2)
    return { head: "Alarmdan önce kaç!", sub: "Herkes kaçtı. Şimdi kaçarsan +2 · son 1 saniyede +3" };
  if (opts.inside === 2 && opts.players >= 3)
    return { head: "Alarmdan önce kaç!", sub: "Son iki kişiden birisin!" };
  return { head: "Alarmdan önce kaç!", sub: "En son kaçan kazanır" };
}

/**
 * SK-U7: içeride kalan sayısı değişince herkese giden bant. Sahip kararı gereği ad yok: yalnız "SON İKİ" / "SON KİŞİ".
 * 2 oyuncuda "SON İKİ" yoktur (tur zaten iki kişiyle başlar).
 */
export function bandFor(inside: number, players: number): "SON İKİ!" | "SON KİŞİ!" | null {
  if (inside === 1 && players >= 2) return "SON KİŞİ!";
  if (inside === 2 && players >= 3) return "SON İKİ!";
  return null;
}

/** Alarm satırı (SK-M3): "Alarm 14,3 sn'de çaldı" ya da herkes erken kaçtıysa "… çalacaktı". */
export function alarmLine(r: SonKisiRoundResult): string {
  const at = formatSeconds(r.alarmMs).replace(" sn", " sn'de");
  return r.rang ? `Alarm ${at} çaldı` : `Alarm ${at} çalacaktı`;
}

/** Alarma en yakın kaçış (son kaçan) ve alarma kalan süre; kimse kaçmadıysa null. */
export function closest(r: SonKisiRoundResult): { escape: SonKisiEscape; gapMs: number } | null {
  const e = r.escapes[r.escapes.length - 1];
  return e ? { escape: e, gapMs: r.alarmMs - e.ms } : null;
}

/** SK-U5 kendi alarm anın: "SON KİŞİ!" (son kaçan), "Kurtuldun" (kaçtın), "YAKALANDIN!" (kaçmadın). */
export function alarmMoment(r: SonKisiRoundResult, selfId: string | null): "last" | "safe" | "caught" | null {
  if (selfId === null) return null;
  if (r.last.includes(selfId)) return "last";
  if (r.escapes.some((e) => e.id === selfId)) return "safe";
  return r.caught.includes(selfId) ? "caught" : null;
}

/**
 * SK-U9 kendi satırın: "12,4 sn'de kaçtın · Zeynep'ten 1,9 sn önce · alarma 2,3 sn vardı" ya da
 * "Alarm seni yakaladı · son kaçan 14,0 sn'deydi". Puan ayrı gösterilir.
 */
export function ownLine(
  r: SonKisiRoundResult,
  selfId: string,
  nameOf: (id: string) => string,
): string | null {
  const mine = r.escapes.find((e) => e.id === selfId);
  if (!mine) {
    if (!r.caught.includes(selfId)) return null;
    const c = closest(r);
    const tail = c ? ` · son kaçan ${formatSeconds(c.escape.ms).replace(" sn", " sn'deydi")}` : "";
    return `Alarm seni yakaladı${tail}`;
  }
  const parts = [`${formatSeconds(mine.ms).replace(" sn", " sn'de")} kaçtın`];
  const after = r.escapes.filter((e) => e.ms > mine.ms);
  const lastOne = after[after.length - 1];
  if (lastOne) parts.push(`${nameOf(lastOne.id)} ${formatSeconds(lastOne.ms - mine.ms)} sonra kaçtı`);
  parts.push(`alarma ${formatSeconds(r.alarmMs - mine.ms)} vardı`);
  return parts.join(" · ");
}

/** SK-U9: üç turun özeti tek satır: "+2 · 0 · +3 = 5". */
export function roundsLine(results: readonly SonKisiRoundResult[], selfId: string): string {
  const pts = results.map((r) => r.points[selfId] ?? 0);
  return `${pts.map(pointsText).join(" · ")} = ${pts.reduce((a, b) => a + b, 0)}`;
}

/** SK-U8 toplam puan şeridi: büyükten küçüğe "Zeynep 5 · Elif 3". */
export function totalsLine(totals: Record<string, number>, nameOf: (id: string) => string): string {
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([id, p]) => `${nameOf(id)} ${p}`)
    .join(" · ");
}

/** Tur arası/son açılış tek satır: "Son kaçan: Zeynep · alarm 14,3 sn" (SK-U5) ya da "Kimse kurtulamadı · …". */
export function roundHeadline(
  r: SonKisiRoundResult,
  nameOf: (id: string) => string,
  withAlarm = true,
): string {
  const alarm = withAlarm ? ` · alarm ${formatSeconds(r.alarmMs)}` : "";
  if (r.last.length === 0) return `Kimse kurtulamadı${alarm}`;
  return `${r.last.length > 1 ? "Son kaçanlar" : "Son kaçan"}: ${r.last.map(nameOf).join(", ")}${alarm}`;
}

/** Alarm çizgisinin yeri (%). */
export const ALARM_PERCENT = 90;

/** SK-U6 zaman çizelgesi: kaçışların ve alarmın şeritteki yeri (%; 0 altta, alarm üstte). */
export function timelinePercent(ms: number, alarmMs: number): number {
  if (alarmMs <= 0) return 0;
  return Math.max(0, Math.min(100, (ms / alarmMs) * ALARM_PERCENT));
}

/**
 * Zaman çizelgesinde iki yana sırayla (sol, sağ, sol…) dizilen kaçışların yerlerini aynı yanda en az `minGap` (%) aralıkla
 * yukarı iter; sıra bozulmaz, en üst sınır alarm çizgisinin hemen altıdır.
 */
export function spreadPercents(percents: readonly number[], minGap: number): number[] {
  const lastBySide = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  return percents.map((p, i) => {
    const side = i % 2;
    const at = Math.min(ALARM_PERCENT - 4, Math.max(p, (lastBySide[side] ?? 0) + minGap));
    lastBySide[side] = at;
    return at;
  });
}

/** SK-U6 sırayla yerleşme: kaçış başına 0,4 sn, ardından alarm çizgisi. */
export const TIMELINE_STEP_MS = 400;
export function timelineTotalMs(escapes: number): number {
  return escapes * TIMELINE_STEP_MS + 600;
}

/**
 * Ses/titreşim anları (her biri olay geçişinde BİR KEZ çalar; görünüm güncellemesi tekrarlamaz). Anahtar turu taşır:
 * aynı tur aynı anı yeniden üretse de `CueGate` ikinci kez geçirmez.
 */
export type SonKisiCue =
  | { kind: "tension"; key: string; level: SonKisiTension }
  | { kind: "door"; key: string; count: number }
  | { kind: "band"; key: string; text: "SON İKİ!" | "SON KİŞİ!" }
  | { kind: "alarm"; key: string; round: number }
  | { kind: "ready"; key: string; round: number }
  | { kind: "final"; key: string };

/** Görünümden o an geçerli olan anları çıkarır (saf; tekrar eden çağrı aynı anahtarları üretir). */
export function sonKisiCues(pub: SonKisiPublicView, players: number): SonKisiCue[] {
  const r = pub.round;
  const out: SonKisiCue[] = [];
  if (pub.phase === "play") {
    if (pub.tension > 0) out.push({ kind: "tension", key: `${r}:t${pub.tension}`, level: pub.tension });
    if (pub.escapedCount > 0)
      out.push({ kind: "door", key: `${r}:k${pub.escapedCount}`, count: pub.escapedCount });
    const band = bandFor(players - pub.escapedCount, players);
    if (band && pub.escapedCount > 0) out.push({ kind: "band", key: `${r}:${band}`, text: band });
  } else {
    out.push({ kind: "alarm", key: `${r}:alarm`, round: r });
    if (pub.phase === "over") out.push({ kind: "final", key: "final" });
  }
  if (pub.phase === "play" && r > 0) out.push({ kind: "ready", key: `${r}:ready`, round: r });
  return out;
}

/** Bir kez geçiren kapı: ilk görülen anahtar geçer, sonrakiler (aynı anahtar) geçmez. */
export class CueGate {
  private readonly seen = new Set<string>();
  /** İlk açılışta (ekrana sonradan gelen) eski anlar sessizce işaretlenir. */
  prime(cues: readonly SonKisiCue[]): void {
    for (const c of cues) this.seen.add(c.key);
  }
  fresh(cues: readonly SonKisiCue[]): SonKisiCue[] {
    const out: SonKisiCue[] = [];
    for (const c of cues) {
      if (this.seen.has(c.key)) continue;
      this.seen.add(c.key);
      out.push(c);
    }
    return out;
  }
}
