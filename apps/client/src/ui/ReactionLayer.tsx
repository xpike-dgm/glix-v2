import type { ReactionId } from "@glix/engine";
import { createSignal, For, onCleanup, onMount } from "solid-js";
import { reducedMotion } from "../fx/motion.js";
import { onReaction, REACTION_FLIGHT_MS } from "../net/reactions.js";
import { stickerSrc } from "./shopArt.js";

interface Floating {
  key: number;
  playerId: string;
  emoji: ReactionId;
  x: number;
  y: number;
  drift: number;
  still: boolean;
}

/** Aynı anda ekranda en çok bu kadar emoji kalır (eskisi silinir). */
const MAX_FLOATING = 10;

/** Avatarın ekrandaki yeri: `data-pid` işaretli öğenin üst orta noktası. */
function anchor(playerId: string): { x: number; y: number; w: number } | null {
  const el = document.querySelector(`[data-pid="${playerId}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  // Kaydırma alanında görünmeyen avatarın emojisi ekran dışına uçmaz.
  if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight - 24) return null;
  return { x: r.left + r.width / 2, y: r.top + Math.min(r.height, 90) * 0.35, w: r.width };
}

/**
 * Lobide gelen emoji tepkilerini göndericinin avatarının üstünde uçurur. Hareket azaltma açıksa uçmaz;
 * avatarın köşesinde 1,5 sn sabit bir rozet olarak kalır.
 */
export function ReactionLayer() {
  const [items, setItems] = createSignal<Floating[]>([]);
  let n = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  onMount(() => {
    const off = onReaction((playerId, emoji) => {
      const a = anchor(playerId);
      if (!a) return;
      const still = reducedMotion();
      const item: Floating = {
        key: ++n,
        playerId,
        emoji,
        x: still ? a.x + a.w * 0.32 : a.x,
        y: a.y,
        drift: Math.round((Math.random() - 0.5) * 36),
        still,
      };
      setItems((cur) => [...cur.filter((c) => c.playerId !== playerId), item].slice(-MAX_FLOATING));
      const t = setTimeout(() => {
        timers.delete(t);
        setItems((cur) => cur.filter((c) => c.key !== item.key));
      }, REACTION_FLIGHT_MS);
      timers.add(t);
    });
    onCleanup(() => {
      off();
      for (const t of timers) clearTimeout(t);
    });
  });
  return (
    <div class="reactions" aria-hidden="true">
      <For each={items()}>
        {(it) => (
          <span
            class="reaction"
            classList={{ "reaction--still": it.still }}
            style={{
              left: `${it.x}px`,
              top: `${it.y}px`,
              "--drift": `${it.drift}px`,
              "--flight": `${REACTION_FLIGHT_MS}ms`,
            }}
          >
            {/* Çıkartma kimliği katalogda yoksa (bilinmeyen paket) hiçbir şey çizilmez; emoji metin kalır. */}
            {stickerSrc(it.emoji) ? (
              <img class="reaction__sticker" src={stickerSrc(it.emoji)} alt="" draggable={false} />
            ) : (
              it.emoji
            )}
          </span>
        )}
      </For>
    </div>
  );
}
