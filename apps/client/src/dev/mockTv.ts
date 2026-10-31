/**
 * Yalnız geliştirme önizlemesi (üretim paketine girmez; TvApp `import.meta.env.DEV` ile korur).
 * Büyük ekran (TV) ekranlarını sahte verilerle açar: `?mock=tv-<ekran>`; `<ekran>` mevcut telefon önizlemelerinin
 * adıdır, durum TV'ye (sahne) çevrilir:
 *   tv-entry                  kod giriş ekranı
 *   tv-lobby | tv-briefing | tv-countdown | tv-playing | tv-results | tv-final   (`&n=8` oyuncu sayısı)
 *   tv-landscape              yatay oyun (Neon Masa) oynanıyor
 *   tv-zaman-*                Zaman Bombası Hafızası evreleri (özel TV görünümü)
 *   tv-karalama-*             Karalama Defteri evreleri (özel TV görünümü)
 *   tv-bozuk-*                Bozuk Telefon evreleri (özel TV görünümü; ör. tv-bozuk-show, tv-bozuk-vote)
 *   tv-kart-*                 Kart sistemi ekranları (seçim, geri sayım, sonuç)
 *   tv-zehirli-*              Zehirli Kadeh evreleri (ör. tv-zehirli-spectator, tv-zehirli-reveal&t=2500)
 *   tv-laf-*                  Laf Sokma evreleri (ör. tv-laf-vote, tv-laf-reveal-master&t=4800)
 *   tv-kara-*                 Kara Borsa evreleri (ör. tv-kara-bid-spectator, tv-kara-reveal&t=3000)
 *   tv-kule-*                 Kule Ustası evreleri (ör. tv-kule-turn, tv-kule-perfect, tv-kule-miss, tv-kule-end)
 *   tv-yazi-*                 Yazı Yaz evreleri (ör. tv-yazi-write, tv-yazi-talk, tv-yazi-reveal&t=3000)
 *   tv-kendim-*               Kendim evreleri (ör. tv-kendim-write, tv-kendim-match, tv-kendim-reveal&t=4000)
 *   tv-sizma-*                Sızma evreleri (ör. tv-sizma-clue, tv-sizma-runoff, tv-sizma-unmask&t=5200)
 */
import { setState } from "../net/store.js";

export async function startTvMock(mock: string, params: URLSearchParams): Promise<void> {
  const kind = mock.slice("tv-".length);
  if (kind !== "entry") {
    if (kind.startsWith("zaman-")) {
      const m = await import("./mockZamanBombasi.js");
      m.startZamanBombasiMock(kind, params);
    } else if (kind.startsWith("karalama-")) {
      const m = await import("./mockKaralama.js");
      m.startKaralamaMock(kind, params);
    } else if (kind.startsWith("bozuk-")) {
      const m = await import("./mockBozuk.js");
      m.startBozukMock(kind, params);
    } else if (kind.startsWith("zehirli-")) {
      const m = await import("./mockZehirli.js");
      m.startZehirliMock(kind, params);
    } else if (kind.startsWith("laf-")) {
      const m = await import("./mockLaf.js");
      m.startLafMock(kind, params);
    } else if (kind.startsWith("kara-")) {
      const m = await import("./mockBorsa.js");
      m.startBorsaMock(kind, params);
    } else if (kind.startsWith("kule-")) {
      const m = await import("./mockKule.js");
      m.startKuleMock(kind, params);
    } else if (kind.startsWith("yazi-")) {
      const m = await import("./mockYazi.js");
      m.startYaziMock(`${kind}-spectator`, params);
    } else if (kind.startsWith("kendim-")) {
      const m = await import("./mockKendim.js");
      m.startKendimMock(`${kind}-spectator`, params);
    } else if (kind.startsWith("sizma-")) {
      const m = await import("./mockSizma.js");
      m.startSizmaMock(kind, params);
    } else if (kind.startsWith("kart-")) {
      const m = await import("./mockKartlar.js");
      m.startKartMock(kind, params);
    } else if (kind === "landscape") {
      const m = await import("./mockShell.js");
      m.startShellMock(kind, params);
    } else {
      const m = await import("./mock.js");
      m.startMock(kind, params);
    }
    setState("stage", { roomCode: "KX7QP" });
  }
  setState({ tv: true, conn: "open", everOpen: true });
}
