/**
 * Eski sürüm parçası: telefon bir önceki sürümle açıkken yeni sürüm canlıya alınırsa, oyun ekranı gibi sonradan
 * yüklenen parçalar sunucuda artık yoktur ve yükleme düşer ("Bir şeyler ters gitti"). Bu durumda hata ekranı
 * yerine uygulama kendini yeni sürüme yeniler; oturum anahtarı saklı olduğundan odaya/maça geri bağlanır.
 * Sonsuz yenileme olmasın diye 60 sn içinde ikinci kez denenmez (o zaman normal hata ekranı çıkar).
 */
const GUARD_KEY = "glix.staleChunkReload";
const GUARD_MS = 60_000;

const PATTERNS = [
  /importing a module script failed/i,
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /unable to preload css/i,
  /loading (css )?chunk .* failed/i,
];

export function isStaleChunkError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String((error as { message?: unknown })?.message ?? "");
  return PATTERNS.some((p) => p.test(message));
}

/** Yenileme başlatıldıysa true (çağıran hata ekranını göstermez). */
export function recoverFromStaleChunk(reload: () => void): boolean {
  try {
    const last = Number(sessionStorage.getItem(GUARD_KEY) ?? "0");
    if (Date.now() - last < GUARD_MS) return false;
    sessionStorage.setItem(GUARD_KEY, String(Date.now()));
  } catch {
    // Koruma kaydedilemiyorsa yenileme döngüsü riskine girme: normal hata ekranı.
    return false;
  }
  reload();
  return true;
}
