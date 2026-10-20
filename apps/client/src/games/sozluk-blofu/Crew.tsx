import { For } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import type { CrewMember } from "./view.js";

/** Avatar şeridi: hazır olanlar tikli ve lime halkalı. */
export function CrewStrip(props: { crew: CrewMember[]; ready: readonly string[]; label: string }) {
  return (
    <ul class="sb__crew" aria-label={props.label}>
      <For each={props.crew}>
        {(p) => {
          const done = () => props.ready.includes(p.id);
          return (
            <li class="sb__crewp" data-done={done() ? "1" : undefined}>
              <Avatar
                index={p.avatar}
                size="min(40px, calc((100vw - 40px - 56px) / 8))"
                connected={p.connected}
                ready={done()}
                ring={done() ? "var(--lime)" : undefined}
              />
            </li>
          );
        }}
      </For>
    </ul>
  );
}
