/** Tepki sayfaları (saf): ilk sayfa sabit emojiler, sonra sahip olunan her tepki paketi için bir sayfa. */
import {
  type CosmeticItem,
  LOBBY_EMOJIS,
  type LobbyEmoji,
  type ReactionId,
  STICKER_NAMES,
  STICKERS_PER_PACK,
  stickerId,
} from "@glix/engine";
import { packStickerSrc } from "./shopArt.js";

export interface ReactionChoice {
  id: ReactionId;
  /** Ekran okuyucu adı. */
  label: string;
  /** Emoji ise metin, çıkartma ise görsel yolu. */
  text?: string;
  src?: string;
}

export interface ReactionPage {
  id: string;
  label: string;
  items: ReactionChoice[];
  /** Sayfa düğmesinde görünen küçük görsel (paketin ilk çıkartması). */
  icon?: string;
}

/** Ekran okuyucu adları; tanımsız emoji için emojinin kendisi okunur. */
const EMOJI_NAMES: Partial<Record<LobbyEmoji, string>> = {
  "😂": "Kahkaha",
  "😱": "Şok",
  "🔥": "Ateş",
  "👏": "Alkış",
  "👋": "El sallama",
  "❤️": "Kalp",
};

export const emojiChoice = (e: LobbyEmoji): ReactionChoice => ({
  id: e,
  label: EMOJI_NAMES[e] ?? e,
  text: e,
});

export function packChoices(pack: CosmeticItem): ReactionChoice[] {
  const names = STICKER_NAMES[pack.asset ?? ""] ?? [];
  return Array.from({ length: STICKERS_PER_PACK }, (_, i) => ({
    id: stickerId(pack, i + 1),
    label: `${pack.name}: ${names[i] ?? i + 1}`,
    src: packStickerSrc(pack, i + 1),
  }));
}

/** İlk sayfa her zaman emojiler (verilen küme), ardından paket sayfaları. Paket yoksa tek sayfa. */
export function reactionPages(
  emojis: readonly LobbyEmoji[] = LOBBY_EMOJIS,
  packs: readonly CosmeticItem[] = [],
): ReactionPage[] {
  return [
    { id: "emoji", label: "Emojiler", items: emojis.map(emojiChoice) },
    ...packs.map((p) => ({
      id: p.id,
      label: p.name,
      items: packChoices(p),
      icon: packStickerSrc(p, 1),
    })),
  ];
}
