import type { GameResult } from "../game.js";
import { summarizeAcgozlulukLimiti } from "./acgozluluk-limiti/summary.js";
import { summarizeAsiriYukleme } from "./asiri-yukleme/summary.js";
import { summarizeBozukTelefon } from "./bozuk-telefon/summary.js";
import { summarizeButonaBas } from "./butona-bas/summary.js";
import { summarizeCagrisimAgi } from "./cagrisim-agi/summary.js";
import { summarizeCaprazAtes } from "./capraz-ates/summary.js";
import { summarizeCizgiyiGecme } from "./cizgiyi-gecme/summary.js";
import { summarizeGizliAlisveris } from "./gizli-alisveris/summary.js";
import { summarizeGizliHirsiz } from "./gizli-hirsiz/summary.js";
import { summarizeGizliKareler } from "./gizli-kareler/summary.js";
import { summarizeIttifak } from "./ittifak/summary.js";
import { summarizeKaraBorsa } from "./kara-borsa/summary.js";
import { summarizeKaralamaDefteri } from "./karalama-defteri/summary.js";
import { summarizeKendim } from "./kendim/summary.js";
import { summarizeKontrolPaneliKaosu } from "./kontrol-paneli-kaosu/summary.js";
import { summarizeKorBomba } from "./kor-bomba/summary.js";
import { summarizeKorKronometre } from "./kor-kronometre/summary.js";
import { summarizeLafSokma } from "./laf-sokma/summary.js";
import { summarizeOrtalamaninYarisi } from "./ortalamanin-yarisi/summary.js";
import { summarizeRusRuleti } from "./rus-ruleti/summary.js";
import { summarizeRusvetDarbe } from "./rusvet-darbe/summary.js";
import { summarizeSizma } from "./sizma/summary.js";
import { summarizeSonKisi } from "./son-kisi/summary.js";
import { summarizeSozlukBlofu } from "./sozluk-blofu/summary.js";
import type { Summarize, SummaryPlayer } from "./summary.js";
import { summarizeYaziYaz } from "./yazi-yaz/summary.js";
import { summarizeZamanBombasiHafizasi } from "./zaman-bombasi-hafizasi/summary.js";
import { summarizeZehirliKadeh } from "./zehirli-kadeh/summary.js";

/** Oyun kimliği -> tur özeti fonksiyonu. Her oyunun kendi klasöründeki `summary.ts` buraya kaydedilir. */
export const SUMMARIES: Readonly<Record<string, Summarize>> = {
  "acgozluluk-limiti": summarizeAcgozlulukLimiti,
  "asiri-yukleme": summarizeAsiriYukleme,
  "bozuk-telefon": summarizeBozukTelefon,
  "butona-bas": summarizeButonaBas,
  "cagrisim-agi": summarizeCagrisimAgi,
  "capraz-ates": summarizeCaprazAtes,
  "cizgiyi-gecme": summarizeCizgiyiGecme,
  "gizli-alisveris": summarizeGizliAlisveris,
  "gizli-hirsiz": summarizeGizliHirsiz,
  "gizli-kareler": summarizeGizliKareler,
  ittifak: summarizeIttifak,
  "kara-borsa": summarizeKaraBorsa,
  "karalama-defteri": summarizeKaralamaDefteri,
  kendim: summarizeKendim,
  "kontrol-paneli-kaosu": summarizeKontrolPaneliKaosu,
  "kor-bomba": summarizeKorBomba,
  "kor-kronometre": summarizeKorKronometre,
  "laf-sokma": summarizeLafSokma,
  "ortalamanin-yarisi": summarizeOrtalamaninYarisi,
  "rus-ruleti": summarizeRusRuleti,
  "rusvet-darbe": summarizeRusvetDarbe,
  sizma: summarizeSizma,
  "son-kisi": summarizeSonKisi,
  "sozluk-blofu": summarizeSozlukBlofu,
  "yazi-yaz": summarizeYaziYaz,
  "zaman-bombasi-hafizasi": summarizeZamanBombasiHafizasi,
  "zehirli-kadeh": summarizeZehirliKadeh,
};

/**
 * Bir oyunun tur özetini üretir; oyun tanınmıyorsa ya da fonksiyon hata verirse null (sonuç ekranı satırı gizler).
 * İstemci bunu sonuç ekranında, sunucunun zaten yolladığı `result` ve `publicView` ile hesaplar.
 */
export function summarizeRound(
  gameId: string,
  result: GameResult,
  players: readonly SummaryPlayer[],
  publicView?: unknown,
): string | null {
  const fn = SUMMARIES[gameId];
  if (!fn) return null;
  try {
    return fn(result, players, publicView);
  } catch {
    return null;
  }
}
