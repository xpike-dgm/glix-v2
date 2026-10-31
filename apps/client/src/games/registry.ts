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
  /** Kuralı gereği süresi gizli oyun (Kör Kronometre, Kör Bomba, Son Kişi, Aşırı Yükleme) ya da kendi toplam saatini çizen oyun (Zaman Bombası): kabuk saati çizilmez. */
  noClock?: boolean;
  /** Büyük ekran (TV) için oyuna özel yatay görünüm; yoksa telefon ekranı izleyici kipinde büyütülerek gösterilir. */
  StageView?: Component<GameScreenProps>;
  /**
   * TV'de kabuğun sağdaki "Oyuncular" (genel skor) panelini gizler; oyunun `StageView`'i oyuncuları ve genel skoru
   * kendi sütununda gösterir ve alan tüm genişliği kullanır. Verilmezse panel görünür (diğer oyunlar değişmez).
   */
  tvOwnBoard?: boolean;
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
    noClock: true,
    Screen: lazy(() => import("./kor-bomba/KorBombaScreen.js")),
    Art: lazy(() => import("./kor-bomba/BriefingArt.js")),
  },
  "asiri-yukleme": {
    noClock: true,
    Screen: lazy(() => import("./asiri-yukleme/AsiriYuklemeScreen.js")),
    Art: lazy(() => import("./asiri-yukleme/BriefingArt.js")),
  },
  "kor-kronometre": {
    noClock: true,
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
    noClock: true,
    Screen: lazy(() => import("./zaman-bombasi-hafizasi/ZamanBombasiScreen.js")),
    Art: lazy(() => import("./zaman-bombasi-hafizasi/BriefingArt.js")),
    StageView: lazy(() => import("./zaman-bombasi-hafizasi/StageView.js")),
    tvOwnBoard: true,
  },
  "kule-ustasi": {
    noClock: true,
    Screen: lazy(() => import("./kule-ustasi/KuleUstasiScreen.js")),
    Art: lazy(() => import("./kule-ustasi/BriefingArt.js")),
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
    noClock: true,
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
    // "Şerefe!" açılışı oyun ekranının kendi evresidir (tam ekran, TV dahil); sonuç ekranında ayrı açılış yok.
    StageView: lazy(() => import("./zehirli-kadeh/StageView.js")),
  },
  ittifak: {
    Screen: lazy(() => import("./ittifak/IttifakScreen.js")),
    Art: lazy(() => import("./ittifak/BriefingArt.js")),
  },
  sizma: {
    Screen: lazy(() => import("./sizma/SizmaScreen.js")),
    Art: lazy(() => import("./sizma/BriefingArt.js")),
  },
  "sozluk-blofu": {
    Screen: lazy(() => import("./sozluk-blofu/SozlukBlofuScreen.js")),
    Art: lazy(() => import("./sozluk-blofu/BriefingArt.js")),
  },
  "rusvet-darbe": {
    Screen: lazy(() => import("./rusvet-darbe/RusvetDarbeScreen.js")),
    Art: lazy(() => import("./rusvet-darbe/BriefingArt.js")),
  },
  "kontrol-paneli-kaosu": {
    // Ortak bomba saatini oyun kendisi çizer (cezalarla atlar); kabuk saati çizilmez.
    noClock: true,
    Screen: lazy(() => import("./kontrol-paneli-kaosu/KontrolScreen.js")),
    Art: lazy(() => import("./kontrol-paneli-kaosu/BriefingArt.js")),
  },
  kendim: {
    Screen: lazy(() => import("./kendim/KendimScreen.js")),
    Art: lazy(() => import("./kendim/BriefingArt.js")),
  },
  "yazi-yaz": {
    Screen: lazy(() => import("./yazi-yaz/YaziYazScreen.js")),
    Art: lazy(() => import("./yazi-yaz/BriefingArt.js")),
  },
  "bozuk-telefon": {
    Screen: lazy(() => import("./bozuk-telefon/BozukTelefonScreen.js")),
    Art: lazy(() => import("./bozuk-telefon/BriefingArt.js")),
    StageView: lazy(() => import("./bozuk-telefon/StageView.js")),
  },
  "kara-borsa": {
    Screen: lazy(() => import("./kara-borsa/KaraBorsaScreen.js")),
    Art: lazy(() => import("./kara-borsa/BriefingArt.js")),
  },
  "laf-sokma": {
    Screen: lazy(() => import("./laf-sokma/LafSokmaScreen.js")),
    Art: lazy(() => import("./laf-sokma/BriefingArt.js")),
  },
  // TASLAK oyunlar (sahip onayı bekliyor): sunucu bunları yalnız taslak yolu açıksa gönderir (docs/TASLAK-OYUNLAR.md).
  "ortak-nokta": {
    Screen: lazy(() => import("./ortak-nokta/OrtakNoktaScreen.js")),
    Art: lazy(() => import("./ortak-nokta/BriefingArt.js")),
  },
  "tek-ve-kucuk": {
    Screen: lazy(() => import("./tek-ve-kucuk/TekVeKucukScreen.js")),
    Art: lazy(() => import("./tek-ve-kucuk/BriefingArt.js")),
  },
  "sessiz-sira": {
    noClock: true,
    Screen: lazy(() => import("./sessiz-sira/SessizSiraScreen.js")),
    Art: lazy(() => import("./sessiz-sira/BriefingArt.js")),
  },
  "karalama-defteri": {
    Screen: lazy(() => import("./karalama-defteri/KaralamaDefteriScreen.js")),
    Art: lazy(() => import("./karalama-defteri/BriefingArt.js")),
    Reveal: lazy(() => import("./karalama-defteri/Reveal.js")),
    StageView: lazy(() => import("./karalama-defteri/StageView.js")),
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
