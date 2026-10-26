import { createMemo, For, onMount, Show } from "solid-js";
import { hapticMatch, hapticSolo } from "../../fx/haptics.js";
import { Avatar } from "../../ui/Avatar.js";
import type { GameScreenProps } from "../registry.js";
import { Cup } from "./Cup.js";
import { cleanSound, poisonSound } from "./sounds.js";
import "./zehirli-kadeh.css";
import { parseZehirliKadehPublicView } from "./view.js";

/** Sonuç açılışı: temiz kadehler altın, zehirliler mor-siyah dumanla. */
export default function Reveal(props: GameScreenProps) {
  const pub = createMemo(() => parseZehirliKadehPublicView(props.match.publicView));
  const result = () => pub()?.result ?? null;
  const person = (id: string) => props.players.find((p) => p.id === id);
  const isClean = (id: string) => result()?.clean.includes(id) ?? false;
  const mineClean = () => isClean(props.selfId);
  onMount(() => {
    if (!result() || props.spectator) return;
    if (mineClean()) {
      cleanSound();
      hapticMatch();
    } else {
      poisonSound();
      hapticSolo();
    }
  });
  return (
    <Show when={pub() && result()}>
      <section class="zkr rise" aria-label="Zehirli Kadeh sonucu">
        <h2 class="zkr__head" data-ok={!props.spectator && mineClean() ? "1" : undefined}>
          {props.spectator ? "Kadehler açıldı" : mineClean() ? "Kadehin temiz!" : "Kadehin zehirliydi"}
        </h2>
        <ul class="zkr__row">
          <For each={pub()?.players ?? []}>
            {(id, i) => (
              <li class="zkr__item" style={{ "--i": i() }}>
                <Cup
                  cup={pub()?.holdings[id] ?? 0}
                  mode={isClean(id) ? "clean" : "poison"}
                  class="zkr__cup"
                />
                <Show when={person(id)}>
                  {(p) => <Avatar index={p().avatar} size="var(--zkr-av)" connected={p().connected} />}
                </Show>
                <span class="zkr__pts" data-ok={isClean(id) ? "1" : undefined}>
                  {isClean(id) ? "+1" : "0"}
                </span>
                <span class="sr-only">{person(id)?.nickname}</span>
              </li>
            )}
          </For>
        </ul>
      </section>
    </Show>
  );
}
