import { DEFAULT_DANCE } from "@glix/engine";
import { loadPixi } from "../fx/pixiLoad.js";

let started = false;

/**
 * Kürsü karakterlerinin takımını (iskelet, atlas, ~100 küçük görsel) ve Pixi'yi maç sürerken boşta önden yükler.
 * Sonuç ve final ekranlarında kürsü ilk kez açılırken bunlar beklenmez; karakterler daha çabuk belirir. Çıplak
 * Pixi/GL bağlamı burada kurulmaz: yalnız dosyalar iner ve takım hazırlanır. Hata sessizce geçilir (kürsü
 * kendi yüklemesini yapar). Oturum başına bir kez.
 */
export function preloadCharacters(): void {
  if (started) return;
  // Yalnız geliştirme önizlemesi (`?mock=`): ekran maçın ortasından açılır, kürsüsüz ekranların denetimi boşuna yüklenmesin.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("mock")) return;
  started = true;
  const run = (): void => {
    void Promise.all([
      // Alkış sonrası selam ve varsayılan dans: çoğu kürsüde gereken iki klip.
      import("../character/kit.js").then((m) =>
        Promise.all([m.loadKit(), m.loadDance("selam"), m.loadDance(DEFAULT_DANCE)]),
      ),
      loadPixi(),
    ]).catch(() => undefined);
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}
