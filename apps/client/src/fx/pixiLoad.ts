/**
 * Pixi'nin tek yükleme kapısı. Sunucunun içerik politikası `unsafe-eval` vermez (`script-src 'self'`); Pixi'nin varsayılan
 * gölgelendirici eşitleyicisi `new Function` kullandığı için bu paket olmadan `Application.init` hata verir ve
 * (çağıranlar hatayı yuttuğundan) konfeti, ana sayfa zemini ve kürsü karakterleri sessizce hiç çıkmaz.
 * Dinamik `import("pixi.js")` yalnız burada yapılır (bkz. `pixiLoad.test.ts`).
 */
export async function loadPixi(): Promise<typeof import("pixi.js")> {
  const [pixi] = await Promise.all([import("pixi.js"), import("pixi.js/unsafe-eval")]);
  return pixi;
}

/**
 * `Application.destroy` için oluşturucu seçeneği. `true` vermek Pixi'nin **genel** havuzlarını da boşaltır
 * (`GlobalResourceRegistry.release`); o sırada canlı başka bir uygulamanın (örn. yeniden açılan ana sayfa zemini) toplu
 * çizim parçaları yok edilir ve sonraki karede "Cannot read properties of null (reading 'clear')" ile çöker.
 * Yalnız tuvali kaldırmak yeter.
 */
export const APP_VIEW_ONLY = { removeView: true } as const;
