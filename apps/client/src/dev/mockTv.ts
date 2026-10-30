/**
 * Yalnız geliştirme önizlemesi (üretim paketine girmez; TvApp `import.meta.env.DEV` ile korur).
 * Büyük ekran (TV) ekranlarını sahte verilerle açar: `?mock=tv-<ekran>`; `<ekran>` mevcut telefon önizlemelerinin
 * adıdır, durum TV'ye (sahne) çevrilir:
 *   tv-entry                  kod giriş ekranı
 *   tv-lobby | tv-briefing | tv-countdown | tv-playing | tv-results | tv-final   (`&n=8` oyuncu sayısı)
 *   tv-landscape              yatay oyun (Neon Masa) oynanıyor
 *   tv-zaman-*                Zaman Bombası Hafızası evreleri (özel TV görünümü)
 *   tv-karalama-*             Karalama Defteri evreleri (özel TV görünümü)
 *   tv-kart-*                 Kart sistemi ekranları (seçim, geri sayım, sonuç)
 *   tv-zehirli-*              Zehirli Kadeh evreleri (ör. tv-zehirli-spectator, tv-zehirli-reveal&t=2500)
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
    } else if (kind.startsWith("zehirli-")) {
      const m = await import("./mockZehirli.js");
      m.startZehirliMock(kind, params);
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
