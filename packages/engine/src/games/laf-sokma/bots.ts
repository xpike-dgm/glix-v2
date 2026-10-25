import type { GameBot } from "../../testing/simulate.js";
import { lafMaxDurationMs } from "./types.js";

/** Görünmez (sıfır genişlikli) karakter: temizlik denenir. */
const ZWSP = String.fromCodePoint(0x200b);

const PARTS = [
  "kedim kapıyı açıp çıktı",
  "annem yine haklı çıktı",
  "bir kutu mandalina",
  "uyku tulumuyla toplantı",
  "ördek gibi yürüdüm",
  "yarın erken kalkacağım",
  "çorbada saç buldum",
  "sihirli bir eldiven",
  "dondurmayı tabakla yedim",
  "komşunun papağanı",
];

/**
 * Yazmada rastgele bir soruya cevap yazar (ara sıra boş, çok uzun, kaba, görünmez karakterli metin ya da erken
 * "Tamam" dener), oylamada rastgele karta oy verir (ara sıra kendi kartı, olmayan kart, ikinci oy).
 * Cevaplar küçük harfli sözcüklerden oluşur: soru metinleri ve kimliklerle çakışmaz.
 */
export const lafSokmaBot: GameBot = {
  durationMs: lafMaxDurationMs(8),
  burstJitterMs: [100, 800, 4_000],
  generate: (rng, _playerId, pub, priv) => {
    const roll = rng.int(100);
    const phase = (pub as { phase?: string } | null)?.phase;
    const mine = priv as {
      tasks?: { id: string; answer: string | null }[];
      myCard?: string | null;
      myVote?: string | null;
    } | null;
    const tasks = mine?.tasks ?? [];
    if (phase === "write" || phase === "finalWrite" || tasks.length > 0) {
      const task = tasks[rng.int(Math.max(1, tasks.length))];
      const id = task?.id ?? "q1";
      if (roll < 4) return { kind: "answer", prompt: id, text: `   ${ZWSP}\t ` };
      if (roll < 8) return { kind: "answer", prompt: id, text: "uzun ".repeat(30) };
      if (roll < 12) return { kind: "answer", prompt: id, text: "siktir git" };
      if (roll < 15) return { kind: "answer", prompt: "q99", text: "olmayan soru" };
      if (roll < 18) return { kind: "answer", prompt: id, text: "" };
      if (roll < 30) return { kind: "lock" };
      const a = PARTS[rng.int(PARTS.length)] as string;
      return { kind: "answer", prompt: id, text: `  ${a}\n ${rng.int(1000)}  ` };
    }
    const cards = (pub as { duel?: { cards?: { id: string }[] } | null } | null)?.duel?.cards ?? [];
    if (roll < 6) return { kind: "vote", card: "k99" };
    if (roll < 14 && mine?.myCard) return { kind: "vote", card: mine.myCard };
    if (roll < 20 && mine?.myVote) return { kind: "vote", card: mine.myVote };
    if (roll < 24) return { kind: "lock" };
    const card = cards[rng.int(Math.max(1, cards.length))];
    return { kind: "vote", card: card?.id ?? "k1" };
  },
};
