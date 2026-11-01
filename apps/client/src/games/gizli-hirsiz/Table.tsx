import type { PlayerInfo } from "@glix/engine";
import { For, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { type Seat, shortName } from "./view.js";

interface Props {
  seats: readonly Seat[];
  decided: readonly string[];
  playerOf: (id: string) => PlayerInfo | undefined;
  label: (id: string) => string;
  /** Karar kilitleri gösterilsin mi (açılışta gizlenir). */
  locks: boolean;
  class?: string;
}

/** Küçük kilit: "karar verdi" (ne seçtiği değil). */
export function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <title>Karar verdi</title>
      <rect x="5" y="11" width="14" height="10" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/**
 * GH-U1 / GH-U14: kasanın çevresinde masa. Bütün katılımcılar avatar ve kısa adla; kopanlar gri. Çalma bilgisi hiç
 * yoktur; GH-M1 ile yalnız "karar verdi" kilidi.
 */
export function Table(props: Props) {
  return (
    <ul class={`ghtable ${props.class ?? ""}`} data-n={props.seats.length} aria-label="Masadakiler">
      <For each={props.seats}>
        {(s) => {
          const p = () => props.playerOf(s.id);
          const off = () => p()?.connected === false;
          const done = () => props.locks && props.decided.includes(s.id);
          return (
            <li
              class="ghtable__seat"
              style={{ "--x": `${s.x}%`, "--y": `${s.y}%` }}
              data-self={s.self ? "1" : undefined}
              data-off={off() ? "1" : undefined}
              data-done={done() ? "1" : undefined}
            >
              <span class="ghtable__av">
                <Avatar index={p()?.avatar ?? 0} size="var(--gh-av)" connected={!off()} />
                <Show when={done()}>
                  <span class="ghtable__lock">
                    <LockIcon />
                  </span>
                </Show>
              </span>
              <span class="ghtable__name">{shortName(props.label(s.id))}</span>
              <span class="sr-only">
                {done() ? ", karar verdi" : ""}
                {off() ? ", bağlı değil" : ""}
              </span>
            </li>
          );
        }}
      </For>
    </ul>
  );
}
