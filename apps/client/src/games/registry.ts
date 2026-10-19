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
  "cizgiyi-gecme": {
    Screen: lazy(() => import("./cizgiyi-gecme/CizgiyiGecmeScreen.js")),
    Art: lazy(() => import("./cizgiyi-gecme/BriefingArt.js")),
  },
  "gizli-alisveris": {
    Screen: lazy(() => import("./gizli-alisveris/GizliAlisverisScreen.js")),
    Art: lazy(() => import("./gizli-alisveris/BriefingArt.js")),
  },
  "gizli-kareler": {
    Screen: lazy(() => import("./gizli-kareler/GizliKarelerScreen.js")),
    Art: lazy(() => import("./gizli-kareler/BriefingArt.js")),
  },
  "ortalamanin-yarisi": {
    Screen: lazy(() => import("./ortalamanin-yarisi/OrtalamaninYarisiScreen.js")),
    Art: lazy(() => import("./ortalamanin-yarisi/BriefingArt.js")),
  },
  "zaman-bombasi-hafizasi": {
    Screen: lazy(() => import("./zaman-bombasi-hafizasi/ZamanBombasiScreen.js")),
    Art: lazy(() => import("./zaman-bombasi-hafizasi/BriefingArt.js")),
  },
  "capraz-ates": {
    Screen: lazy(() => import("./capraz-ates/CaprazAtesScreen.js")),
    Art: lazy(() => import("./capraz-ates/BriefingArt.js")),
  },
  "gizli-hirsiz": {
    Screen: lazy(() => import("./gizli-hirsiz/GizliHirsizScreen.js")),
    Art: lazy(() => import("./gizli-hirsiz/BriefingArt.js")),
    Reveal: lazy(() => import("./gizli-hirsiz/Reveal.js")),
  },
  "son-kisi": {
    Screen: lazy(() => import("./son-kisi/SonKisiScreen.js")),
    Art: lazy(() => import("./son-kisi/BriefingArt.js")),
    Reveal: lazy(() => import("./son-kisi/Reveal.js")),
  },
  "rus-ruleti": {
    Screen: lazy(() => import("./rus-ruleti/RusRuletiScreen.js")),
    Art: lazy(() => import("./rus-ruleti/BriefingArt.js")),
    Reveal: lazy(() => import("./rus-ruleti/Reveal.js")),
  },
  "zehirli-kadeh": {
    Screen: lazy(() => import("./zehirli-kadeh/ZehirliKadehScreen.js")),
    Art: lazy(() => import("./zehirli-kadeh/BriefingArt.js")),
    Reveal: lazy(() => import("./zehirli-kadeh/Reveal.js")),
  },
  ittifak: {
    Screen: lazy(() => import("./ittifak/IttifakScreen.js")),
    Art: lazy(() => import("./ittifak/BriefingArt.js")),
  },
  "rusvet-darbe": {
    Screen: lazy(() => import("./rusvet-darbe/RusvetDarbeScreen.js")),
    Art: lazy(() => import("./rusvet-darbe/BriefingArt.js")),
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
