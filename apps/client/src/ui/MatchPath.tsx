import { For } from "solid-js";
import { matchPath } from "./matchPath.js";

/** Maç yolu: oyun başına bir nokta; geçilen yeşil, şimdiki nabız atar, gelecek soluk. */
export function MatchPath(props: { round: number; total: number }) {
  return (
    <ol class="mpath" aria-label={`Maç yolu, ${props.round + 1}. oyun`}>
      <For each={matchPath(props.round, props.total)}>{(s) => <li class="mpath__dot" data-s={s} />}</For>
    </ol>
  );
}
