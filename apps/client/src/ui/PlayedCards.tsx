import type { CardsPublic, PlayerInfo } from "@glix/engine";
import { createSignal, Show } from "solid-js";
import { tap } from "../fx/sound.js";
import { BottomSheet } from "./BottomSheet.js";
import { GemMark } from "./CardFace.js";
import { CardReveal } from "./CardNotices.js";
import { playedBadge } from "./cards.js";

/**
 * Oyun içinde üst çubukta duran küçük "oynanan kartlar" rozeti: bu oyun için oynanan kartların sayısı. Dokununca
 * kim hangi kartı oynadı listesi açılır. Yalnız oyun başında herkese açıklanan bilgiyi gösterir; yeni veri yoktur.
 */
export function PlayedCards(props: {
  cards: CardsPublic | null | undefined;
  players: readonly PlayerInfo[];
  gameName: (id: string) => string;
}) {
  const [open, setOpen] = createSignal(false);
  const badge = () => playedBadge(props.cards);
  return (
    <Show when={badge()}>
      {(b) => (
        <>
          <button
            type="button"
            class="pcb"
            aria-label={`Oynanan kartlar: ${b().count}`}
            onClick={() => {
              tap();
              setOpen(true);
            }}
          >
            <span class="pcb__pill" aria-hidden="true">
              <GemMark rarity={b().rarities[0] ?? "siradan"} size={12} />
              <span class="pcb__n">{b().count}</span>
            </span>
          </button>
          <BottomSheet open={open()} onClose={() => setOpen(false)} title="Oynanan kartlar">
            <CardReveal cards={props.cards} players={props.players} gameName={props.gameName} />
          </BottomSheet>
        </>
      )}
    </Show>
  );
}
