import { YAZI_YAZ_REVEAL_MS } from "@glix/engine";

/**
 * Yazı Yaz zamanlamaları (ms). Tek sabit: süreler yalnız buradan değişir. Açılış anları, açılışın başından (sunucu
 * saatinde `guessEndsAt`) ölçülür; ekran `atServerTime` ile sunucu saatine bağlanır.
 */
export const YY_PLAN = {
  /** Yazmada büyük sayaç bu kadar saniye kala kırmızıya döner (kabuk saati de tikler). */
  writeWarnSec: 5,
  /** Tartışmada son bu kadar saniye: saat kırmızı, nabız, tik ve hafif titreşim. */
  talkWarnSec: 10,
  /** Yazılan her harf bu kadar görünür, sonra ● olur (YY-U1). */
  maskDelayMs: 600,
  /** Panoya basılı tutma bu kadar sürünce kelime görünür (kısa dokunuş yalnız odaklar). */
  holdRevealMs: 220,
  /** Rol kartı: bu kadar basılı tutunca döner ve sayılır (kısa dokunuş yetmez). */
  cardHoldMs: 260,
} as const;

/**
 * "Yazanlar…" açılışı (YY-U5): davul → yazan kartları tek tek döner, kelime harf harf yazılır → bulanların avatarları
 * karta uçar, damga ("4 kişi buldu" / "İZ BIRAKMADI") → oyuncu satırları → kendi satırın parlar. Tamamı oyunun en az
 * açılış süresine (YAZI_YAZ_REVEAL_MS, 8 sn) sığar; ardından "Devam et".
 */
export const YY_REVEAL_PLAN = {
  /** "Yazanlar…" davulu. */
  drumMs: 1_500,
  /** Kartlar arası (ikinci kart bu kadar sonra döner). */
  cardGapMs: 1_900,
  /** Kart döndükten sonra ilk harf. */
  typeStartMs: 320,
  /** Harf başına (uzun kelimede kısalır; kelime en çok `typeSpanMs`'e sığar). */
  letterMs: 110,
  typeSpanMs: 900,
  /** Kelime bitince bulanların avatarları uçar (biri arası). */
  flyGapMs: 180,
  flyStepMs: 110,
  /** Uçuşlardan sonra damga. */
  stampGapMs: 260,
  /** Satırlar: son kartın damgasından sonra; satır arası. */
  rowsGapMs: 300,
  rowStepMs: 90,
  /** Son satırdan sonra kendi satırın parlar ve puan büyür. */
  meGapMs: 250,
} as const;

export interface CardPlan {
  writer: string;
  flipAt: number;
  /** Harflerin yazıldığı anlar (kelime boşsa boş). */
  letters: number[];
  flyAt: number[];
  stampAt: number;
}

export interface RevealPlan {
  cards: CardPlan[];
  rowsAt: number;
  rowStep: number;
  meAt: number;
}

/** Açılış planı: kartlar katılım sırasıyla; her şey açılış süresine sığar. */
export function revealPlan(
  writers: readonly string[],
  words: Readonly<Record<string, string>>,
  finders: (writer: string) => readonly string[],
  rows: number,
): RevealPlan {
  const p = YY_REVEAL_PLAN;
  const cards = writers.map((writer, i) => {
    const flipAt = p.drumMs + i * p.cardGapMs;
    const n = Array.from(words[writer] ?? "").length;
    const step = n > 0 ? Math.min(p.letterMs, p.typeSpanMs / n) : 0;
    const letters = Array.from({ length: n }, (_, k) => Math.round(flipAt + p.typeStartMs + k * step));
    const typed = flipAt + p.typeStartMs + n * step;
    const who = finders(writer);
    const flyStep = who.length > 0 ? Math.min(p.flyStepMs, 700 / who.length) : 0;
    const flyAt = who.map((_, k) => Math.round(typed + p.flyGapMs + k * flyStep));
    const stampAt = Math.round(typed + p.flyGapMs + who.length * flyStep + p.stampGapMs);
    return { writer, flipAt, letters, flyAt, stampAt };
  });
  const lastStamp = cards.reduce<number>((m, c) => Math.max(m, c.stampAt), p.drumMs);
  const rowStep = Math.min(p.rowStepMs, 600 / Math.max(1, rows));
  const rowsAt = Math.min(lastStamp + p.rowsGapMs, YAZI_YAZ_REVEAL_MS - 1_200);
  const meAt = Math.min(rowsAt + rows * rowStep + p.meGapMs, YAZI_YAZ_REVEAL_MS - 300);
  return { cards, rowsAt, rowStep, meAt };
}
