import { For, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import type { CrewMember } from "./view.js";

/**
 * Alt şerit: herkesin avatarı ve altında kahkaha puanı. Hazır olanlar (yazmada "Tamam", oylamada oy verenler)
 * tikli ve lime halkalı; `dim` verilenler (ör. oylamada düellonun iki yazarı) soluk.
 */
export function CrewStrip(props: {
  crew: CrewMember[];
  ready: readonly string[];
  label: string;
  scores: Readonly<Record<string, number>>;
  dim?: readonly string[];
  selfId?: string;
  /** Puanı yeni artanlar: kısa bir sıçrama. */
  bumped?: readonly string[];
}) {
  return (
    <ul class="lf__crew" aria-label={props.label}>
      <For each={props.crew}>
        {(p) => {
          const done = () => props.ready.includes(p.id);
          const score = () => props.scores[p.id] ?? 0;
          return (
            <li
              class="lf__crewp"
              data-done={done() ? "1" : undefined}
              data-dim={props.dim?.includes(p.id) ? "1" : undefined}
              data-me={props.selfId === p.id ? "1" : undefined}
              aria-label={`${p.nickname}: ${score()} kahkaha`}
            >
              <Avatar
                index={p.avatar}
                size="min(36px, calc((100vw - 40px - 56px) / 8))"
                connected={p.connected}
                ready={done()}
                ring={done() ? "var(--lime)" : undefined}
              />
              {/* Puan değişince yeniden çizilir: artan puan kısa bir sıçramayla görünür. */}
              <Show when={String(score())} keyed>
                {(s) => (
                  <span
                    class="lf__laugh"
                    data-zero={s === "0" ? "1" : undefined}
                    data-bump={props.bumped?.includes(p.id) ? "1" : undefined}
                  >
                    {s}
                  </span>
                )}
              </Show>
            </li>
          );
        }}
      </For>
    </ul>
  );
}
