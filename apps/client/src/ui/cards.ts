import {
  CARD_GEMS,
  CARDS,
  type CardId,
  type CardLine,
  type CardRarity,
  type CardSettings,
  type CardsPublic,
  DEFAULT_CARD_SETTINGS,
  enabledCards,
  type PublicPlay,
} from "@glix/engine";
import { formatScore } from "../screens/ranking.js";

/** Nadirlik etiketi (renk körleri için elmas sayısıyla birlikte okunur). */
export const RARITY_LABEL: Readonly<Record<CardRarity, string>> = {
  siradan: "Sıradan",
  nadir: "Nadir",
  efsanevi: "Efsanevi",
  kotu: "Kötü kart",
};

/** Ekran okuyucu için kart özeti: "Çelme, sıradan kart, saldırı: seçtiğin oyuncu −1". */
export function cardLabel(id: CardId): string {
  const c = CARDS[id];
  return `${c.name}, ${RARITY_LABEL[c.rarity].toLowerCase()}${c.rarity === "kotu" ? "" : " kart"}${c.attack ? ", saldırı" : ""}: ${c.text}`;
}

export const gemCount = (id: CardId): number => CARD_GEMS[CARDS[id].rarity];

/** Hedef türü için kısa yönerge. */
export function targetPrompt(id: CardId): string | null {
  switch (CARDS[id].target) {
    case "player":
      return "Kimi seçiyorsun?";
    case "playerOrSelf":
      return "Kimi koruyacaksın?";
    case "game":
      return id === "veto" ? "Hangi oyun listeden çıksın?" : "Sıradaki oyun hangisi olsun?";
    default:
      return null;
  }
}

/** İşaretli puan: +2, −1, 0. */
export function signed(n: number): string {
  return n > 0 ? `+${n}` : formatScore(n);
}

export interface LineText {
  card: string;
  /** Kartı oynayan/çeken oyuncunun adı. */
  who: string;
  /** Puanı değişen oyuncunun adı; sahibiyle aynıysa null. */
  to: string | null;
  /** "+2 → +4", "korundu", "yansıdı", "etkisiz", "puan değişmedi". */
  text: string;
  /** İşaret: puan arttı / azaldı / değişmedi (renk ve ok için). */
  tone: "up" | "down" | "flat";
}

/** Sonuç ekranı etki satırı (K6): "Çift Puan: +2 → +4". */
export function describeLine(line: CardLine, nick: (id: string) => string): LineText {
  const card = CARDS[line.cardId].name;
  const who = nick(line.owner);
  const to = line.subject === line.owner ? null : nick(line.subject);
  const delta = line.after - line.before;
  const tone = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  if (line.note === "korundu") return { card, who, to, text: "korundu", tone: "flat" };
  if (line.note === "yansidi") return { card, who, to, text: "yansıdı", tone: "flat" };
  if (line.note === "etkisiz") return { card, who, to, text: "etkisiz", tone: "flat" };
  if (delta === 0) return { card, who, to, text: "puan değişmedi", tone: "flat" };
  return { card, who, to, text: `${signed(line.before)} → ${signed(line.after)}`, tone };
}

/** Düz metin: ekran okuyucu ve TV için. */
export function lineSentence(line: CardLine, nick: (id: string) => string): string {
  const t = describeLine(line, nick);
  const head = t.to ? `${t.who} → ${t.to}` : t.who;
  return `${head}: ${t.card} ${t.text}`;
}

/** Oyun başında açıklanan kartın cümlesi (K4.3). */
export function playSentence(
  play: PublicPlay,
  nick: (id: string) => string,
  gameName: (id: string) => string,
): string {
  const name = CARDS[play.cardId].name;
  const who = nick(play.playerId);
  if (play.void) return `${who}: ${name} (etkisiz)`;
  if (play.target) return `${who}, ${nick(play.target)} oyuncusuna ${name} oynadı`;
  if (play.gameId) {
    return play.cardId === "veto"
      ? `${who}, ${gameName(play.gameId)} oyununu listeden çıkardı`
      : `${who}, sıradaki oyunu seçti: ${gameName(play.gameId)}`;
  }
  return `${who}, ${name} oynadı`;
}

/** Kötü kart duyurusu (K3.4). */
export function badSentence(playerNick: string, id: CardId): string {
  return `${playerNick} kötü kart çekti: ${CARDS[id].name}`;
}

/** Oyun başında kimin ne oynadığı, oynanma sırasıyla. */
export function revealList(cards: CardsPublic | null | undefined): PublicPlay[] {
  return cards?.plays ?? [];
}

/** Lobi ayarı özeti: "Kapalı", "Hepsi açık", "27 / 29 kart açık". */
export function settingsSummary(settings: CardSettings | undefined): string {
  const s = settings ?? DEFAULT_CARD_SETTINGS;
  if (!s.enabled) return "Kapalı";
  const on = enabledCards(s).length;
  if (on === 0) return "Kapalı";
  if (on === Object.keys(CARDS).length) return "Hepsi açık";
  return `${on} / ${Object.keys(CARDS).length} kart açık`;
}

/** Ayarda bir kartı açıp kapatır; yeni ayarı döner (liste katalog sırasında). */
export function toggleCard(settings: CardSettings, id: CardId): CardSettings {
  const off = settings.off.includes(id) ? settings.off.filter((x) => x !== id) : [...settings.off, id];
  return {
    enabled: settings.enabled,
    off: Object.keys(CARDS).filter((c) => off.includes(c as CardId)) as CardId[],
  };
}

/** Bir sınıftaki kartlar (ayar sayfasında gruplama). */
export function cardsOfRarity(rarity: CardRarity): CardId[] {
  return (Object.keys(CARDS) as CardId[]).filter((id) => CARDS[id].rarity === rarity);
}

/** Seçimde kaç seçim hakkı kaldı: "2 kart seç", "1 kart daha". */
export function picksLeftText(total: number, got: number): string {
  const left = Math.max(0, total - got);
  if (total <= 1) return "Bir kart seç";
  return got === 0 ? `${total} kart seç` : left === 1 ? "1 kart daha seç" : `${left} kart daha seç`;
}
