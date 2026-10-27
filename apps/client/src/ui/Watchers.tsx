import type { PlayerInfo } from "@glix/engine";
import { For, Show } from "solid-js";
import { Avatar } from "./Avatar.js";
import { EyeIcon } from "./Icons.js";

/**
 * Maçı izleyenler: sıralamaya girmez, tek satırda küçük karakterler ve "izliyor" etiketi.
 * Kimse izlemiyorsa hiçbir şey çizmez.
 */
export function Watchers(props: { players: PlayerInfo[]; selfId: string }) {
  const names = () => props.players.map((p) => (p.id === props.selfId ? "Sen" : p.nickname)).join(", ");
  return (
    <Show when={props.players.length > 0}>
      <div class="watchers" role="status">
        <EyeIcon size={16} />
        <span class="watchers__avs" aria-hidden="true">
          <For each={props.players}>
            {(p) => <Avatar index={p.avatar} size={26} connected={p.connected} />}
          </For>
        </span>
        <span class="watchers__text">
          <b>{names()}</b> izliyor
        </span>
      </div>
    </Show>
  );
}
