import type { MatchSnapshot, PlayerInfo } from "@glix/engine";
import { type Component, lazy } from "solid-js";
import { hudOf } from "./yatay-masa/hud.js";

export interface GameScreenProps {
  match: MatchSnapshot;
  selfId: string;
  players: PlayerInfo[];
  /** Sunucu saati (ms). */
  now: () => number;
  /** Oyuncu bu oyunun katılımcısı değil, izliyor: eylem düğmesi gösterilmez, gönderilmez. */
  spectator?: boolean;
}

/** Yatay oyunlarda çerçevenin yan şeridinin göstereceği özet. */
export interface HudInfo {
  startedAt: number;
  endsAt: number;
  /** Oyuncu kimliği → oyun içi puan. */
  scores: Record<string, number>;
  /** Kendi puanın; yoksa `scores[selfId]`. */
  myScore?: number | null;
}

export interface GameEntry {
  /** Oyun ekranı (tembel yüklenir). */
  Screen: Component<GameScreenProps>;
  /** Anlatım ekranındaki küçük canlı görsel. */
  Art: Component;
  /** Sonuç ekranının üstüne giren oyuna özel kısa açılış (ör. bilgisiz oyuncunun maskesi düşer). */
  Reveal?: Component<GameScreenProps>;
  /** Yatay oyunlar: yan şerit (süre çubuğu, puan, avatarlar) için görünümden özet çıkarır. */
  hud?: (match: MatchSnapshot, selfId: string) => HudInfo | null;
}

/** Yeni oyun: buraya gameId ile bir giriş eklemek yeterli. */
const registry: Record<string, GameEntry> = {
  "acgozluluk-limiti": {
    Screen: lazy(() => import("./acgozluluk-limiti/AcgozlulukLimitiScreen.js")),
    Art: lazy(() => import("./acgozluluk-limiti/BriefingArt.js")),
  },
  "butona-bas": {
    Screen: lazy(() => import("./butona-bas/ButonaBasScreen.js")),
    Art: lazy(() => import("./butona-bas/BriefingArt.js")),
  },
  "kor-bomba": {
    Screen: lazy(() => import("./kor-bomba/KorBombaScreen.js")),
    Art: lazy(() => import("./kor-bomba/BriefingArt.js")),
  },
  "asiri-yukleme": {
    Screen: lazy(() => import("./asiri-yukleme/AsiriYuklemeScreen.js")),
    Art: lazy(() => import("./asiri-yukleme/BriefingArt.js")),
  },
  "kor-kronometre": {
    Screen: lazy(() => import("./kor-kronometre/KorKronometreScreen.js")),
    Art: lazy(() => import("./kor-kronometre/BriefingArt.js")),
  },
  "cagrisim-agi": {
    Screen: lazy(() => import("./cagrisim-agi/CagrisimAgiScreen.js")),
    Art: lazy(() => import("./cagrisim-agi/BriefingArt.js")),
  },
  "zaman-bombasi-hafizasi": {
    Screen: lazy(() => import("./zaman-bombasi-hafizasi/ZamanBombasiScreen.js")),
    Art: lazy(() => import("./zaman-bombasi-hafizasi/BriefingArt.js")),
  },
  "capraz-ates": {
    Screen: lazy(() => import("./capraz-ates/CaprazAtesScreen.js")),
    Art: lazy(() => import("./capraz-ates/BriefingArt.js")),
  },
  "karalama-defteri": {
    Screen: lazy(() => import("./karalama-defteri/KaralamaDefteriScreen.js")),
    Art: lazy(() => import("./karalama-defteri/BriefingArt.js")),
    Reveal: lazy(() => import("./karalama-defteri/Reveal.js")),
  },
};

// Yalnız geliştirme: yatay çerçeveyi gerçek yatay oyunlar gelmeden denemek için yer tutucu sahne.
if (import.meta.env.DEV) {
  registry["yatay-masa"] = {
    Screen: lazy(() => import("./yatay-masa/YatayMasaScreen.js")),
    Art: lazy(() => import("./yatay-masa/YatayMasaArt.js")),
    hud: hudOf,
  };
}

export function gameEntry(gameId: string): GameEntry | null {
  return registry[gameId] ?? null;
}
