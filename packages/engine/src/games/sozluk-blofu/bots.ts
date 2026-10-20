import type { GameBot } from "../../testing/simulate.js";
import { SOZLUK_DURATION_MS } from "./types.js";

/** Görünmez (sıfır genişlikli) karakter: temizlik denenir. */
const ZWSP = String.fromCodePoint(0x200b);

const PARTS = [
  "bir tür",
  "eski zamanlarda kullanılan",
  "ince ve uzun",
  "denizcilerin taktığı",
  "köylerde yapılan",
  "ağır bir yük",
  "küçük bir alet",
  "yağmurlu bir gün",
  "kumaştan dikilen",
  "dağlık yerlerde yaşayan",
  "sert kabuklu bir meyve",
  "gürültülü kalabalık",
];

/**
 * Sahte tanım yazar (ara sıra boş, çok uzun ya da çöp metin dener), sonra rastgele bir kart seçer; kendi kartını
 * ve olmayan kartı da dener (reddedilir). Metinler küçük harfli sözcüklerden oluşur: kelime ya da anahtar adlarıyla çakışmaz.
 */
export const sozlukBlofuBot: GameBot = {
  durationMs: SOZLUK_DURATION_MS,
  burstJitterMs: [100, 800, 4_000],
  generate: (rng, _playerId, pub, priv) => {
    const roll = rng.int(100);
    const phase = (pub as { phase?: string } | null)?.phase;
    const cards = (pub as { cards?: { id: string }[] | null } | null)?.cards ?? [];
    const mine = priv as { myCard?: string | null; myPick?: string | null } | null;
    if (phase === "write" || cards.length === 0) {
      if (roll < 6) return { kind: "bluff", text: `   ${ZWSP}\t ` };
      if (roll < 10) return { kind: "bluff", text: "uzun ".repeat(30) };
      if (roll < 14) return { kind: "lock" };
      const a = PARTS[rng.int(PARTS.length)] as string;
      const b = PARTS[rng.int(PARTS.length)] as string;
      return { kind: "bluff", text: `  ${a}\n${ZWSP} ${b}.  ` };
    }
    if (roll < 8) return { kind: "pick", card: "k99" };
    if (roll < 16 && mine?.myCard) return { kind: "pick", card: mine.myCard };
    if (roll < 40 && mine?.myPick) return { kind: "lock" };
    const card = cards[rng.int(cards.length)];
    return { kind: "pick", card: card?.id ?? "k1" };
  },
};
