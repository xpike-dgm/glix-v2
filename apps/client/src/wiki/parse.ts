/**
 * Oyun ansiklopedisi yanıtlarının doğrulaması: ağdan gelen her şey burada şekle sokulur. İçerik dosyaları bizimdir,
 * yine de eksik alan boş değere düşer, yanlış türdeki alan atlanır; not listesi ise satır satır sıkı denetlenir.
 */
import { isWikiFeedbackSection, isWikiFeedbackStatus, type WikiBox, type WikiFeedback } from "@glix/engine";

export interface WikiStep {
  ad: string;
  sureSn: number | null;
  kim: string;
  aciklama: string;
  gizli: string;
}

export interface WikiScreen {
  dosya: string;
  baslik: string;
  aciklama: string;
  tv: boolean;
}

export interface WikiGame {
  id: string;
  ad: string;
  slogan: string;
  kategori: string;
  etiketler: string[];
  oyuncu: { min: number; max: number };
  sure: { tahminiSn: number; not: string };
  ozet: string;
  akis: WikiStep[];
  kurallar: string[];
  puanlama: {
    ozet: string;
    kalemler: { olay: string; puan: string; not: string }[];
    ornek: string;
    beraberlik: string;
  };
  ozelDurumlar: { baslik: string; aciklama: string }[];
  kartlar: { kart: string; etki: string }[];
  sabitler: { ad: string; deger: string; kaynak: string }[];
  strateji: string[];
  tv: string;
  ekranlar: WikiScreen[];
  bilinenSorunlar: string[];
  sonDegisiklikler: string[];
  kaynaklar: string[];
}

export interface WikiData {
  games: WikiGame[];
  screens: string[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const obj = (v: unknown): Obj => (isObj(v) ? v : {});
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
const list = <T>(v: unknown, f: (o: Obj) => T): T[] => (Array.isArray(v) ? v.filter(isObj).map(f) : []);
const NAME = /^[a-z0-9][a-z0-9-]{0,99}$/;

export function parseGame(v: unknown): WikiGame | null {
  if (!isObj(v) || typeof v.id !== "string" || !NAME.test(v.id)) return null;
  const oyuncu = obj(v.oyuncu);
  const sure = obj(v.sure);
  const p = obj(v.puanlama);
  return {
    id: v.id,
    ad: str(v.ad) || v.id,
    slogan: str(v.slogan),
    kategori: str(v.kategori) || "Diğer",
    etiketler: strs(v.etiketler),
    oyuncu: { min: num(oyuncu.min), max: num(oyuncu.max) },
    sure: { tahminiSn: num(sure.tahminiSn), not: str(sure.not) },
    ozet: str(v.ozet),
    akis: list(v.akis, (a) => ({
      ad: str(a.ad),
      sureSn: typeof a.sureSn === "number" && Number.isFinite(a.sureSn) ? a.sureSn : null,
      kim: str(a.kim),
      aciklama: str(a.aciklama),
      gizli: str(a.gizli),
    })),
    kurallar: strs(v.kurallar),
    puanlama: {
      ozet: str(p.ozet),
      kalemler: list(p.kalemler, (k) => ({ olay: str(k.olay), puan: str(k.puan), not: str(k.not) })),
      ornek: str(p.ornek),
      beraberlik: str(p.beraberlik),
    },
    ozelDurumlar: list(v.ozelDurumlar, (d) => ({ baslik: str(d.baslik), aciklama: str(d.aciklama) })),
    kartlar: list(v.kartlar, (k) => ({ kart: str(k.kart), etki: str(k.etki) })),
    sabitler: list(v.sabitler, (s) => ({ ad: str(s.ad), deger: str(s.deger), kaynak: str(s.kaynak) })),
    strateji: strs(v.strateji),
    tv: str(v.tv),
    ekranlar: list(v.ekranlar, (e) => ({
      dosya: str(e.dosya),
      baslik: str(e.baslik),
      aciklama: str(e.aciklama),
      tv: e.tv === true,
    })).filter((e) => NAME.test(e.dosya)),
    bilinenSorunlar: strs(v.bilinenSorunlar),
    sonDegisiklikler: strs(v.sonDegisiklikler),
    kaynaklar: strs(v.kaynaklar),
  };
}

export function parseData(v: unknown): WikiData | null {
  if (!isObj(v) || !Array.isArray(v.games) || !Array.isArray(v.screens)) return null;
  return {
    games: v.games.map(parseGame).filter((g): g is WikiGame => g !== null),
    screens: v.screens.filter((s): s is string => typeof s === "string" && NAME.test(s)),
  };
}

const unit = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;

function parseBox(v: unknown): WikiBox | null | undefined {
  if (v === null) return null;
  if (!isObj(v) || !unit(v.x) || !unit(v.y) || !unit(v.w) || !unit(v.h)) return undefined;
  return { x: v.x, y: v.y, w: v.w, h: v.h };
}

const posInt = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;

function parseFeedback(v: unknown): WikiFeedback | null {
  if (!isObj(v)) return null;
  const box = parseBox(v.box);
  if (
    !posInt(v.id) ||
    typeof v.gameId !== "string" ||
    !isWikiFeedbackSection(v.section) ||
    typeof v.text !== "string" ||
    !isWikiFeedbackStatus(v.status) ||
    (v.screen !== null && typeof v.screen !== "string") ||
    box === undefined ||
    typeof v.hasImage !== "boolean" ||
    typeof v.reply !== "string" ||
    typeof v.createdAt !== "number" ||
    typeof v.updatedAt !== "number"
  )
    return null;
  return {
    id: v.id,
    gameId: v.gameId,
    section: v.section,
    text: v.text,
    status: v.status,
    screen: v.screen,
    box,
    hasImage: v.hasImage,
    reply: v.reply,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

/** Bozuk satır tüm listeyi düşürmez; yalnız o satır atlanır. */
export function parseFeedbackList(v: unknown): WikiFeedback[] | null {
  if (!isObj(v) || !Array.isArray(v.items)) return null;
  return v.items.map(parseFeedback).filter((f): f is WikiFeedback => f !== null);
}

/** Yönetici erişim durumu (`/api/admin/status`). */
export function parseState(v: unknown): "ready" | "need_otp" | null {
  if (!isObj(v)) return null;
  return v.state === "ready" || v.state === "need_otp" ? v.state : null;
}
