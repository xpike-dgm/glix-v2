import { createMemo, For } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import type { GameScreenProps } from "../registry.js";

/**
 * Yalnız geliştirme: yatay çerçeveyi sınamak için yer tutucu sahne. Neon bir masa ve çevresinde oyuncu
 * koltukları. Gerçek yatay oyunlar (A4) aynı çerçevenin içine kendi sahnesini koyar.
 */
export default function YatayMasaScreen(props: GameScreenProps) {
  const seated = createMemo(() => {
    const list = props.players.filter((p) => props.match.participants.includes(p.id));
    const mine = list.findIndex((p) => p.id === props.selfId);
    // Kendin altta (başparmağa yakın), diğerleri saat yönünde.
    const ordered = mine > 0 ? [...list.slice(mine), ...list.slice(0, mine)] : list;
    return ordered.map((player, i) => {
      const a = Math.PI / 2 + (i / Math.max(1, ordered.length)) * Math.PI * 2;
      return { player, x: 50 + 41 * Math.cos(a), y: 50 + 37 * Math.sin(a) };
    });
  });

  return (
    <div class="ytable">
      <div class="ytable__felt" aria-hidden="true">
        <div class="ytable__mark">
          <img class="ytable__logo" src="/assets/brand/logo-512.webp" width="512" height="256" alt="GLIX" />
          <span class="ytable__sub">Masa</span>
        </div>
      </div>
      <For each={seated()}>
        {(s) => (
          <div class="ytable__seat" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
            <Avatar
              index={s.player.avatar}
              size="var(--seat)"
              connected={s.player.connected}
              self={s.player.id === props.selfId}
            />
            <span class="ytable__name">{s.player.nickname}</span>
          </div>
        )}
      </For>
    </div>
  );
}
