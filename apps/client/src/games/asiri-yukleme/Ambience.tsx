import { Show } from "solid-js";
import { worldAllowed } from "../../ui/world.js";

/**
 * Dünya görselindeki üst reaktör tüpünü canlandırır: borularda nabız gibi parlama, ara ara buhar, dönen uyarı
 * lambaları. Hepsi yalnız ZAMANA bağlı CSS döngüleridir; doluluğu ya da tehlikeyi asla yansıtmaz (her durumda
 * aynıdır). Dünya görseli yüklenmeyen cihazda (veri tasarrufu, düşük bellek) çizilmez. Konumlar görselin
 * (720x1280, üstten hizalı, ekranı kaplar) birimine göre hesaplanır.
 */
export function Ambience() {
  return (
    <Show when={worldAllowed()}>
      <div class="ay-amb" aria-hidden="true">
        <i class="ay-amb__tube" />
        <i class="ay-amb__pipe ay-amb__pipe--l" />
        <i class="ay-amb__pipe ay-amb__pipe--r" />
        <i class="ay-amb__steam ay-amb__steam--l" />
        <i class="ay-amb__steam ay-amb__steam--r" />
        <i class="ay-amb__lamp ay-amb__lamp--l" />
        <i class="ay-amb__lamp ay-amb__lamp--r" />
      </div>
    </Show>
  );
}
