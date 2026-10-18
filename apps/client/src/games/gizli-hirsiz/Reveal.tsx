import { createMemo, For, onMount, Show } from "solid-js";
import { hapticMatch, hapticSolo } from "../../fx/haptics.js";
import { Avatar } from "../../ui/Avatar.js";
import type { GameScreenProps } from "../registry.js";
import { Core } from "./Core.js";
import "./gizli-hirsiz.css";
import { alarm, hollow, vaultOpen } from "./sounds.js";
import { parseGizliHirsizPublicView, revealHeadline } from "./view.js";

/** Sonuç ekranının üstüne giren açılış: çekirdek açılır, hırsızlar ortaya çıkar. */
export default function Reveal(props: GameScreenProps) {
  const reveal = createMemo(() => parseGizliHirsizPublicView(props.match.publicView)?.reveal ?? null);
  const thieves = () =>
    (reveal()?.thieves ?? []).flatMap((id) => {
      const p = props.players.find((x) => x.id === id);
      return p ? [p] : [];
    });
  onMount(() => {
    const r = reveal();
    if (!r) return;
    if (r.outcome === "solo") {
      vaultOpen();
      hapticMatch();
    } else if (r.outcome === "multi") {
      alarm();
      hapticSolo();
    } else hollow();
  });
  return (
    <Show when={reveal()}>
      {(r) => (
        <section class="ghr rise" data-outcome={r().outcome} aria-label="Kasa sonucu">
          <div class="ghr__core">
            <Core state={r().outcome} opening />
          </div>
          <div class="ghr__txt">
            <h2 class="ghr__head">{revealHeadline(r())}</h2>
            <Show when={thieves().length > 0}>
              <ul class="ghr__crew">
                <For each={thieves()}>
                  {(p) => (
                    <li class="ghr__thief">
                      <Avatar
                        index={p.avatar}
                        size={34}
                        connected={p.connected}
                        ring={r().outcome === "solo" ? "var(--lime)" : "var(--red)"}
                      />
                      <span class="ghr__pts">{r().outcome === "solo" ? "+1" : "−1"}</span>
                      <span class="sr-only">{p.nickname}</span>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </div>
        </section>
      )}
    </Show>
  );
}
