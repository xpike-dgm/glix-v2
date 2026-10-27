import type { PlayerInfo } from "@glix/engine";
import { createSignal, For, Show } from "solid-js";
import "../games/karalama-defteri/karalama.css";
import { hapticTap } from "../fx/haptics.js";
import { tap } from "../fx/sound.js";
import { DrawingCanvas } from "../games/karalama-defteri/DrawingCanvas.js";
import { galleryItems } from "./matchGallery.js";

/**
 * Maç sonu galerisi: bu maçta çizilenler küçük resimler olarak yatay kayar; dokununca çizim yeniden çizilir.
 * Veri, maç boyunca herkese açık görünümlerden birikir (bkz. matchGallery.ts); çizim yoksa hiçbir şey gösterilmez.
 */
export function MatchGallery(props: { players: PlayerInfo[] }) {
  const [replays, setReplays] = createSignal<Record<string, number>>({});
  const who = (id: string): string => props.players.find((p) => p.id === id)?.nickname ?? "";
  return (
    <Show when={galleryItems().length > 0}>
      <section class="kd gal rise" style={{ "--i": 3 }} aria-label="Maçın çizimleri">
        <p class="overline gal__title">Maçın çizimleri</p>
        <ul class="gal__strip" data-scroll>
          <For each={galleryItems()}>
            {(it) => (
              <li class="gal__item">
                <button
                  type="button"
                  class="gal__btn"
                  aria-label={`${who(it.playerId)} çizimini tekrar izle`}
                  onClick={() => {
                    tap();
                    hapticTap();
                    setReplays((r) => ({ ...r, [it.key]: (r[it.key] ?? 0) + 1 }));
                  }}
                >
                  <DrawingCanvas
                    class="gal__thumb"
                    strokes={it.strokes}
                    version={it.version}
                    replay={replays()[it.key] ?? 0}
                  />
                </button>
                <span class="gal__name">{who(it.playerId)}</span>
              </li>
            )}
          </For>
        </ul>
      </section>
    </Show>
  );
}
