import { DEFAULT_DANCE } from "@glix/engine";
import { loadPixi } from "../fx/pixiLoad.js";

let started = false;
/** Önden istenen giysi katmanları (tekil); kit yüklenince bunlar da inilir. */
const wanted = new Set<string>();

const fetchLayers = (): void => {
  const layers = [...wanted];
  if (layers.length === 0) return;
  void import("../character/kit.js")
    .then((m) => m.loadKit())
    .then((kit) => kit.ensureLayers(layers))
    .catch(() => undefined);
};

/**
 * Kürsü karakterlerinin takımını (iskelet, gövde, atlas yerleşimi) ve Pixi'yi maç sürerken boşta önden yükler.
 * Giysi görselleri takıma dahil değildir, katman katman ilk istekte iner: burada yalnız `layers` (odadaki
 * oyuncuların, özellikle kendi kuşandıkların) önden indirilir. Sonuç ve final ekranlarında kürsü ilk kez açılırken
 * bunlar beklenmez; karakterler daha çabuk belirir. Çıplak Pixi/GL bağlamı burada kurulmaz: yalnız dosyalar iner ve
 * takım hazırlanır. Hata sessizce geçilir (kürsü kendi yüklemesini yapar). Takım oturum başına bir kez kurulur;
 * sonraki çağrılar yalnız yeni katmanları ister.
 */
export function preloadCharacters(layers: readonly string[] = []): void {
  // Yalnız geliştirme önizlemesi (`?mock=`): ekran maçın ortasından açılır, kürsüsüz ekranların denetimi boşuna yüklenmesin.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("mock")) return;
  let added = false;
  for (const l of layers)
    if (!wanted.has(l)) {
      wanted.add(l);
      added = true;
    }
  if (started) {
    if (added) fetchLayers();
    return;
  }
  started = true;
  const run = (): void => {
    void Promise.all([
      // Alkış sonrası selam ve varsayılan dans: çoğu kürsüde gereken iki klip.
      import("../character/kit.js").then((m) =>
        Promise.all([m.loadKit(), m.loadDance("selam"), m.loadDance(DEFAULT_DANCE)]),
      ),
      loadPixi(),
    ])
      .then(fetchLayers)
      .catch(() => undefined);
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}
