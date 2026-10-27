import type { RoomSnapshot } from "@glix/engine";
import { For } from "solid-js";
import { formatScore, playersOnly } from "../screens/ranking.js";
import { Avatar } from "./Avatar.js";

/** Tablet/masaüstü (>= 1024 px) ikinci sütun: oyuncular, puanlar ve hazır durumları. Dar ekranda CSS ile gizlenir. */
export function SidePlayers(props: { snap: RoomSnapshot }) {
  const rows = () =>
    playersOnly(props.snap.players)
      .map((p, order) => ({ p, order }))
      .sort((a, b) => b.p.score - a.p.score || a.order - b.order)
      .map((r) => r.p);
  const ready = (id: string): boolean =>
    props.snap.phase === "briefing" && (props.snap.match?.readyIds.includes(id) ?? false);
  return (
    <aside class="side2" aria-label="Oyuncular">
      <p class="overline">Oyuncular</p>
      <ul class="side2__list">
        <For each={rows()}>
          {(p) => (
            <li class="side2__row" data-me={p.id === props.snap.selfId ? "1" : undefined}>
              <Avatar index={p.avatar} size={44} connected={p.connected} ready={ready(p.id)} />
              <span class="side2__name">
                {p.id === props.snap.selfId ? `${p.nickname} (sen)` : p.nickname}
              </span>
              <span class="side2__score">{formatScore(p.score)}</span>
            </li>
          )}
        </For>
      </ul>
    </aside>
  );
}
