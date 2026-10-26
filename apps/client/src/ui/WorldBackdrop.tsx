import { createSignal, Show } from "solid-js";
import { createPortrait } from "./viewport.js";
import { worldAllowed, worldSrc } from "./world.js";

/**
 * Oyunun dünyası: ekranların arkasında, okunurluk örtüsüyle. Görsel yüklenene kadar mevcut arka plan
 * görünür; yüklenince yumuşakça belirir. Dokunulmaz, ekran okuyucuya görünmez.
 */
export function WorldBackdrop(props: { gameId: string }) {
  const portrait = createPortrait();
  const allowed = worldAllowed();
  const [loaded, setLoaded] = createSignal<string | null>(null);
  const src = () => worldSrc(props.gameId, portrait() ? "portrait" : "landscape");
  return (
    <Show when={allowed}>
      <div class="world" aria-hidden="true" data-on={loaded() === src() ? "1" : undefined}>
        <img
          class="world__img"
          src={src()}
          alt=""
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(src())}
        />
        <div class="world__scrim" />
      </div>
    </Show>
  );
}
