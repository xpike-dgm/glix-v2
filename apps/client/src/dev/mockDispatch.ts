/**
 * Geliştirme önizlemesi (`?mock=`) ve önizleme sayfası (`onizleme.html`, oyun anı) için ortak sahte ekran
 * dağıtıcısı: ekran adının önekine göre ilgili sahte veri modülünü yükler ve başlatır.
 */
export function startDevMock(mock: string, params: URLSearchParams): Promise<void> {
  if (mock.startsWith("kart-")) {
    return import("./mockKartlar.js").then((m) => void m.startKartMock(mock, params));
  } else if (mock.startsWith("sonkisi-")) {
    return import("./mockSonKisi.js").then((m) => void m.startSonKisiMock(mock, params));
  } else if (mock.startsWith("siralama") || mock.startsWith("rozet-")) {
    return import("./mockSiralama.js").then((m) => void m.startSiralamaMock(mock, params));
  } else if (mock.startsWith("arkadas")) {
    return import("./mockArkadas.js").then((m) => void m.startArkadasMock(mock, params));
  } else if (mock.startsWith("zehirli-")) {
    return import("./mockZehirli.js").then((m) => void m.startZehirliMock(mock, params));
  } else if (mock.startsWith("rus-")) {
    return import("./mockRusRuleti.js").then((m) => void m.startRusRuletiMock(mock, params));
  } else if (mock.startsWith("gizli-")) {
    return import("./mockGizliHirsiz.js").then((m) => void m.startGizliHirsizMock(mock, params));
  } else if (mock.startsWith("kor-bomba")) {
    return import("./mockKorBomba.js").then((m) => void m.startKorBombaMock(mock, params));
  } else if (mock.startsWith("asiri-yukleme")) {
    return import("./mockAsiri.js").then((m) => void m.startAsiriMock(mock, params));
  } else if (mock.startsWith("kor-kronometre")) {
    return import("./mockKronometre.js").then((m) => void m.startKronometreMock(mock, params));
  } else if (mock.startsWith("cagrisim")) {
    return import("./mockCagrisim.js").then((m) => void m.startCagrisimMock(mock, params));
  } else if (mock.startsWith("zaman-")) {
    return import("./mockZamanBombasi.js").then((m) => void m.startZamanBombasiMock(mock, params));
  } else if (mock.startsWith("kule-")) {
    return import("./mockKule.js").then((m) => void m.startKuleMock(mock, params));
  } else if (mock.startsWith("capraz-")) {
    return import("./mockCapraz.js").then((m) => void m.startCaprazMock(mock, params));
  } else if (mock.startsWith("bozuk-")) {
    return import("./mockBozuk.js").then((m) => void m.startBozukMock(mock, params));
  } else if (mock.startsWith("kara-")) {
    return import("./mockBorsa.js").then((m) => void m.startBorsaMock(mock, params));
  } else if (mock.startsWith("karalama-")) {
    return import("./mockKaralama.js").then((m) => void m.startKaralamaMock(mock, params));
  } else if (mock.startsWith("acgozluluk-")) {
    return import("./mockAcgozluluk.js").then((m) => void m.startAcgozlulukMock(mock, params));
  } else if (mock.startsWith("cizgi-")) {
    return import("./mockCizgi.js").then((m) => void m.startCizgiMock(mock, params));
  } else if (mock.startsWith("alisveris-")) {
    return import("./mockAlisveris.js").then((m) => void m.startAlisverisMock(mock, params));
  } else if (mock.startsWith("kareler-")) {
    return import("./mockKareler.js").then((m) => void m.startKarelerMock(mock, params));
  } else if (mock.startsWith("ittifak-")) {
    return import("./mockIttifak.js").then((m) => void m.startIttifakMock(mock, params));
  } else if (mock.startsWith("kontrol-")) {
    return import("./mockKontrol.js").then((m) => void m.startKontrolMock(mock, params));
  } else if (mock.startsWith("kendim-")) {
    return import("./mockKendim.js").then((m) => void m.startKendimMock(mock, params));
  } else if (mock.startsWith("yazi-")) {
    return import("./mockYazi.js").then((m) => void m.startYaziMock(mock, params));
  } else if (mock.startsWith("sozluk-")) {
    return import("./mockSozluk.js").then((m) => void m.startSozlukMock(mock, params));
  } else if (mock.startsWith("laf-")) {
    return import("./mockLaf.js").then((m) => void m.startLafMock(mock, params));
  } else if (mock.startsWith("sizma-")) {
    return import("./mockSizma.js").then((m) => void m.startSizmaMock(mock, params));
  } else if (mock.startsWith("rusvet-")) {
    return import("./mockRusvet.js").then((m) => void m.startRusvetMock(mock, params));
  } else if (/^(ortak-nokta|tek-ve-kucuk|sessiz-sira)-/.test(mock)) {
    return import("./mockTaslak.js").then((m) => void m.startTaslakMock(mock, params));
  } else if (mock.startsWith("ortalama-")) {
    return import("./mockOrtalama.js").then((m) => void m.startOrtalamaMock(mock, params));
  } else if (/^(landscape|briefing-ready|spectator-)/.test(mock)) {
    return import("./mockShell.js").then((m) => void m.startShellMock(mock, params));
  } else {
    return import("./mock.js").then((m) => void m.startMock(mock, params));
  }
}
