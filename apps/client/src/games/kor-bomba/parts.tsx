import type { KorBombaJourney, PlayerInfo } from "@glix/engine";
import { For, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { bildiText, formatSeconds, fuseLine, journeyStats, lastLinks } from "./view.js";

type PlayerOf = (id: string) => PlayerInfo | undefined;

/** BM-U3: el çipi ve son 4 taşıyıcının avatar zinciri (herkese açık bilgi; süre taşımaz). */
export function HandChain(props: {
  chip: string;
  trail: readonly string[];
  playerOf: PlayerOf;
  size: string;
  class?: string;
}) {
  return (
    <div class={`kbo-chain ${props.class ?? ""}`}>
      <span class="kbo-chain__chip">{props.chip}</span>
      <Show when={props.trail.length > 1}>
        <ol class="kbo-chain__links" aria-label="Son paslar">
          <For each={lastLinks(props.trail)}>
            {(id, i) => (
              <li
                class="kbo-chain__link"
                data-last={i() === lastLinks(props.trail).length - 1 ? "1" : undefined}
              >
                <Show when={i() > 0}>
                  <span class="kbo-chain__arrow" aria-hidden="true">
                    →
                  </span>
                </Show>
                <Avatar index={props.playerOf(id)?.avatar ?? 0} size={props.size} />
                <span class="sr-only">{props.playerOf(id)?.nickname ?? ""}</span>
              </li>
            )}
          </For>
        </ol>
      </Show>
    </div>
  );
}

/**
 * BM-U6: bombanın yolculuğu — her el bir kutu (taşıyan, tuttuğu süre), fitil hesabı, en uzun tutan, en hızlı kurtulan,
 * bahsi tutanlar. Yalnız patlamadan sonra gelen herkese açık `journey` ile çizilir.
 */
export function JourneyPanel(props: {
  journey: KorBombaJourney;
  winners: readonly string[];
  playerOf: PlayerOf;
  selfId: string;
  avatar: string;
  class?: string;
}) {
  const name = (id: string): string =>
    id === props.selfId ? "Sen" : (props.playerOf(id)?.nickname ?? "Oyuncu");
  const stats = () => journeyStats(props.journey);
  const winnerLine = () => {
    const names = props.winners.map(name);
    return names.length === 0
      ? "PATLAR! diyip bilen olmadı"
      : `PATLAR! diyip bilenler: ${names.join(", ")} (+1)`;
  };
  return (
    <section class={`kbo-trip ${props.class ?? ""}`} aria-label="Bombanın yolculuğu">
      <h2 class="kbo-trip__title">Bombanın yolculuğu</h2>
      <ol class="kbo-trip__strip">
        <For each={props.journey.hands}>
          {(h, i) => {
            const last = () => i() === props.journey.hands.length - 1;
            return (
              <li class="kbo-trip__hand" data-boom={last() ? "1" : undefined}>
                <Show when={i() > 0}>
                  <span class="kbo-trip__arrow" aria-hidden="true">
                    →
                  </span>
                </Show>
                <span class="kbo-trip__box">
                  <Avatar index={props.playerOf(h.holder)?.avatar ?? 0} size={props.avatar} />
                  <span class="kbo-trip__who">{name(h.holder)}</span>
                  <span class="kbo-trip__sec">{formatSeconds(h.heldMs)} sn</span>
                  <Show when={last()}>
                    <span class="kbo-trip__boom">PATLADI</span>
                  </Show>
                </span>
              </li>
            );
          }}
        </For>
      </ol>
      <p class="kbo-trip__fuse">{fuseLine(props.journey)}</p>
      <div class="kbo-trip__facts">
        <Show when={stats().longest}>
          {(h) => (
            <span>
              En uzun tutan: <b>{name(h().holder)}</b> {formatSeconds(h().heldMs)} sn
            </span>
          )}
        </Show>
        <Show when={stats().fastest}>
          {(h) => (
            <span>
              En hızlı kurtulan: <b>{name(h().holder)}</b> {formatSeconds(h().heldMs)} sn
            </span>
          )}
        </Show>
        <span>{winnerLine()}</span>
      </div>
    </section>
  );
}

/** "Bildi" yazısı için adlar (kendin "Sen"). */
export function bildiFor(ids: readonly string[], playerOf: PlayerOf, selfId: string): string {
  return bildiText(
    ids.flatMap((id) => {
      const n = playerOf(id)?.nickname;
      return n ? [id === selfId ? "Sen" : n] : [];
    }),
  );
}
