/**
 * Bildirim kanıtı: bir oyunun sonuç aşamasında herkese zaten gösterilmiş (`publicView`) metinlerden, tek bir
 * oyuncunun yazdıklarını çıkarır. Gizli bilgi asla alınmaz: yalnız açılış (reveal) alanları okunur; açılmamış
 * ya da yazarı herkese gösterilmeyen metin kanıta girmez. Emin olunmayan oyun için boş döner.
 *
 * Oyun başına neyin eklendiği docs/ADMIN.md "Moderasyon" bölümünde tablodadır:
 *  - laf-sokma: açılmış düello kartlarındaki cevapları (geçmiş + son açılış)
 *  - sozluk-blofu: açılışta sahibi gösterilen sahte tanımları
 *  - kendim: açılışta sahibi gösterilen kelimeyi
 *  - yazi-yaz: yazan olarak açılan kelimeyi
 *  - cagrisim-agi: açılışta gösterilen cevabını
 *  - diğer tüm oyunlar (bozuk-telefon, karalama-defteri dahil): hiçbir şey
 */

/** Bir oyuncudan en çok bu kadar metin ve her metin en çok bu kadar karakter saklanır. */
export const EVIDENCE_MAX_TEXTS = 8;
export const EVIDENCE_TEXT_MAX = 120;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const recs = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter(isRec) : []);

function laf(view: Rec, playerId: string): string[] {
  const duels = [...recs(view.history), ...(isRec(view.reveal) ? [view.reveal] : [])];
  const out: string[] = [];
  for (const duel of duels) {
    for (const card of recs(duel.cards)) {
      if (card.author === playerId && typeof card.text === "string") out.push(card.text);
    }
  }
  return out;
}

function sozluk(view: Rec, playerId: string): string[] {
  const reveal = view.reveal;
  if (!isRec(reveal) || !isRec(reveal.authors)) return [];
  const out: string[] = [];
  for (const card of recs(view.cards)) {
    if (typeof card.id === "string" && typeof card.text === "string" && reveal.authors[card.id] === playerId)
      out.push(card.text);
  }
  return out;
}

function kendim(view: Rec, playerId: string): string[] {
  const reveal = view.reveal;
  if (!isRec(reveal)) return [];
  return recs(reveal.cards).flatMap((c) =>
    c.owner === playerId && typeof c.text === "string" ? [c.text] : [],
  );
}

function yaziYaz(view: Rec, playerId: string): string[] {
  const reveal = view.reveal;
  if (!isRec(reveal) || !isRec(reveal.words) || !Array.isArray(reveal.writers)) return [];
  if (!reveal.writers.includes(playerId)) return [];
  const word = reveal.words[playerId];
  return typeof word === "string" && word !== "" ? [word] : [];
}

function cagrisim(view: Rec, playerId: string): string[] {
  const reveal = view.reveal;
  if (!isRec(reveal)) return [];
  const out: string[] = [];
  for (const g of recs(reveal.groups)) {
    if (Array.isArray(g.members) && g.members.includes(playerId) && typeof g.text === "string")
      out.push(g.text);
  }
  for (const s of recs(reveal.singles)) {
    if (s.playerId === playerId && typeof s.text === "string") out.push(s.text);
  }
  return out;
}

const EXTRACTORS: Readonly<Record<string, (view: Rec, playerId: string) => string[]>> = {
  "laf-sokma": laf,
  "sozluk-blofu": sozluk,
  kendim,
  "yazi-yaz": yaziYaz,
  "cagrisim-agi": cagrisim,
};

/** Oyunun kanıt çıkarıcısı var mı (testler ve belgeler için). */
export function evidenceGames(): string[] {
  return Object.keys(EXTRACTORS);
}

/**
 * `publicView` sonuç aşamasındaki herkese açık görünümdür. Her oyuncu için kırpılmış, tekrarsız metin listesi döner
 * (yalnız en az bir metni olanlar).
 */
export function collectPublicTexts(
  gameId: string,
  publicView: unknown,
  playerIds: readonly string[],
): Record<string, string[]> {
  const extract = EXTRACTORS[gameId];
  if (!extract || !isRec(publicView)) return {};
  const out: Record<string, string[]> = {};
  for (const id of playerIds) {
    const seen = new Set<string>();
    for (const raw of extract(publicView, id)) {
      const text = Array.from(raw.replace(/\s+/gu, " ").trim()).slice(0, EVIDENCE_TEXT_MAX).join("");
      if (text !== "") seen.add(text);
      if (seen.size >= EVIDENCE_MAX_TEXTS) break;
    }
    if (seen.size > 0) out[id] = [...seen];
  }
  return out;
}
