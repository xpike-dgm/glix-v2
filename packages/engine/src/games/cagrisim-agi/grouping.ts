import { foldKey } from "../text.js";
import {
  CAGRISIM_PLURAL_ROOT_MIN,
  CAGRISIM_TYPO_MIN,
  type CagrisimGroup,
  type CagrisimReveal,
} from "./types.js";

/** Gösterim için: baş/son boşluk kırpılır, iç boşluklar teke iner; harf büyüklüğüne dokunulmaz (CG-M3). */
export function displayAnswer(text: string): string {
  return text.trim().replace(/\s+/gu, " ");
}

/** Türkçe küçük harf, kırpma, iç boşluklar teke iner (gösterim karşılaştırması ve eski kayıtlar için). */
export function normalizeAnswer(text: string): string {
  return displayAnswer(text).toLocaleLowerCase("tr");
}

/**
 * Eşleşme anahtarı (CG-M3 kural 1–2): klavyeden bağımsız katlama (`foldKey`: büyük/küçük harf, ç/c, ş/s …, noktalama),
 * boşluk ve tire yok sayılır ("deniz kenarı" = "denizkenarı" = "deniz-kenarı"); sondaki çoğul eki (-lar/-ler) kalan
 * kök en az 3 harfse atılır ("dalgalar" = "dalga"; "dolar", "kiler" dokunulmaz).
 */
export function matchKey(text: string): string {
  const key = foldKey(text).replace(/\s+/gu, "");
  const letters = Array.from(key);
  if (letters.length - 3 >= CAGRISIM_PLURAL_ROOT_MIN && (key.endsWith("lar") || key.endsWith("ler")))
    return letters.slice(0, -3).join("");
  return key;
}

/**
 * Tek harf yazım hatası (CG-M3 kural 3): iki anahtar en az 6 harf, aynı uzunlukta ve yalnız bir harfi farklıysa
 * true ("kumsal" = "kumsak"). Daha kısa cevaplarda tam eşleşme gerekir.
 */
export function oneLetterApart(a: string, b: string): boolean {
  const x = Array.from(a);
  const y = Array.from(b);
  if (x.length !== y.length || x.length < CAGRISIM_TYPO_MIN) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i] && ++diff > 1) return false;
  return diff === 1;
}

const TURKISH_LETTERS = /[çğıöşüÇĞİÖŞÜ]/gu;
const turkishScore = (t: string): number => (t.match(TURKISH_LETTERS) ?? []).length;

interface Cluster {
  key: string;
  /** Kesin gruptaki oyuncular, cevap sırasıyla. */
  core: string[];
  /** Bu kümeye katılan diğer kesin kümeler. */
  joined: Cluster[];
  /** Cevap sırasındaki ilk üyenin sırası. */
  first: number;
  /** Başka bir kümeye katıldı. */
  absorbed: boolean;
  /** Gösterilecek yazılış hangi kesin kümeden seçilir (eşit büyüklükte birleşmede ilk cevap verenin). */
  display: Cluster | null;
}

/**
 * Gruplar (≥2 kişi, büyükten küçüğe), tek kalanlar ve susanlar (CG-M3). İki adım: önce eşleşme anahtarıyla kesin
 * kümeler kurulur; sonra her küçük küme (ya da tek cevap), tek harf uzaktaki **en büyük** kesin kümeye katılır.
 * Zincirleme yoktur: başkasını almış küme başka yere katılmaz, katılan küme başkasını almaz; uzaklık yalnız kesin
 * kümelerin anahtarlarıyla ölçülür. Eşit büyüklükte iki küme birleşirse gösterilen yazılış ilk cevap verenin
 * kümesinden seçilir. Gösterilen yazılış oyuncunun yazdığıdır; birden çok yazılışta Türkçe harf içeren, eşitlikte ilk
 * cevap verenin. `order` cevap sırasıdır (yoksa oyuncu sırası); sonuç oyuncu sırasına göre belirleyicidir.
 */
export function groupAnswers(
  players: readonly string[],
  answers: Readonly<Record<string, string>>,
  order: readonly string[] = [],
): CagrisimReveal {
  const answered = players.filter((id) => Object.hasOwn(answers, id));
  const rank = new Map<string, number>();
  for (const id of order) if (!rank.has(id) && answered.includes(id)) rank.set(id, rank.size);
  for (const id of answered) if (!rank.has(id)) rank.set(id, rank.size);
  const byRank = [...answered].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
  const text = (id: string): string => displayAnswer(answers[id] ?? "");

  const clusters = new Map<string, Cluster>();
  for (const id of byRank) {
    const key = matchKey(answers[id] ?? "");
    const c = clusters.get(key);
    if (c) c.core.push(id);
    else
      clusters.set(key, {
        key,
        core: [id],
        joined: [],
        first: rank.get(id) ?? 0,
        absorbed: false,
        display: null,
      });
  }
  const all = [...clusters.values()];
  // Küçükten büyüğe (eşitlikte geç cevap veren önce): her küme kendinden büyük ya da eşit en büyük komşuya katılır.
  const candidates = [...all].sort((a, b) => a.core.length - b.core.length || b.first - a.first);
  for (const c of candidates) {
    if (c.absorbed || c.joined.length > 0) continue;
    let best: Cluster | null = null;
    for (const t of all) {
      if (t === c || t.absorbed || t.core.length < c.core.length) continue;
      if (!oneLetterApart(c.key, t.key)) continue;
      if (
        !best ||
        t.core.length > best.core.length ||
        (t.core.length === best.core.length && t.first < best.first)
      )
        best = t;
    }
    if (!best) continue;
    best.joined.push(c);
    c.absorbed = true;
    if (c.core.length === best.core.length && c.first < (best.display ?? best).first) best.display = c;
  }

  const groups: (CagrisimGroup & { first: number })[] = [];
  const singles: CagrisimReveal["singles"] = [];
  for (const c of all) {
    if (c.absorbed) continue;
    const ids = [c, ...c.joined].flatMap((x) => x.core);
    if (ids.length < 2) {
      const id = ids[0] as string;
      singles.push({ playerId: id, text: text(id) });
      continue;
    }
    const source = (c.display ?? c).core;
    let shown = text(source[0] as string);
    for (const id of source.slice(1)) if (turkishScore(text(id)) > turkishScore(shown)) shown = text(id);
    const seen = new Set<string>();
    const variants: string[] = [];
    for (const id of [...ids].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0))) {
      const t = text(id);
      const k = t.toLocaleLowerCase("tr");
      if (seen.has(k)) continue;
      seen.add(k);
      variants.push(t);
    }
    groups.push({
      text: shown,
      members: players.filter((id) => ids.includes(id)),
      points: ids.length,
      variants: variants.length >= 2 ? variants : [],
      first: c.first,
    });
  }
  groups.sort((a, b) => b.members.length - a.members.length || a.first - b.first);
  singles.sort((a, b) => players.indexOf(a.playerId) - players.indexOf(b.playerId));
  return {
    groups: groups.map(({ first: _first, ...g }) => g),
    singles,
    silent: players.filter((id) => !Object.hasOwn(answers, id)),
  };
}
