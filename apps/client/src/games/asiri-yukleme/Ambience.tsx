import { Show } from "solid-js";
import { Portal } from "solid-js/web";
import { createPortrait } from "../../ui/viewport.js";
import { worldAllowed } from "../../ui/world.js";

/**
 * Dünya görselindeki (dikey, 720x1280) öğeleri canlandırır; her öğe görseldeki gerçek bir parçanın üstüne oturur:
 * - reaktör tüpünün camında yumuşak nabız parıltısı (tüp biçiminde, 247..477 x 98..353),
 * - tüp tabanındaki çıkışlardan ara ara ince buhar,
 * - yan sütunlardaki kırmızı ışık şeritlerinde (yaklaşık x 82..98 ve 622..638, y 165..300) dönen lamba yansıması.
 * Hepsi yalnız ZAMANA bağlı CSS döngüleridir; doluluğu ya da tehlikeyi yansıtmaz. Yalnız dikey görsel kullanılırken
 * (dikey ekran) ve dünya görseli yüklenebiliyorken çizilir; konumlar görselin `cover` + üstten hizalı yerleşimine
 * göre hesaplanır (CSS `--u` = görselin 1 pikseli). Katman dünya görselinin kendi kutusuna (`.world`) taşınır
 * (Portal): böylece üst çubuk ya da ekranın giriş kayması hizayı bozmaz; görsel yoksa hiç çizilmez.
 */
export function Ambience() {
  const portrait = createPortrait();
  const world = worldAllowed() ? document.querySelector<HTMLElement>(".world") : null;
  return (
    <Show when={world !== null && portrait() ? world : null}>
      {(host) => (
        <Portal mount={host()}>
          <div class="ay-amb" aria-hidden="true">
            <i class="ay-amb__glass" />
            <i class="ay-amb__steam ay-amb__steam--l" />
            <i class="ay-amb__steam ay-amb__steam--r" />
            <i class="ay-amb__sweep ay-amb__sweep--l" />
            <i class="ay-amb__sweep ay-amb__sweep--r" />
          </div>
        </Portal>
      )}
    </Show>
  );
}
