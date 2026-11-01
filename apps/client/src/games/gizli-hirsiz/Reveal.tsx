import { createMemo, For, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import type { GameScreenProps } from "../registry.js";
import { Core } from "./Core.js";
import "./gizli-hirsiz.css";
import { parseGizliHirsizPublicView, revealHeadline, revealSubline, shortName } from "./view.js";

/**
 * GH-U8: genel sonuç ekranının üstündeki kasa şeridi: başlık (360 px'te tek satır), hırsızların adları ve puanları,
 * alt satır. Açılışın sesi ve titreşimi oyun içi açılışta (GH-U5) çaldığı için burada tekrar çalmaz.
 */
export default function Reveal(props: GameScreenProps) {
  const reveal = createMemo(() => parseGizliHirsizPublicView(props.match.publicView)?.reveal ?? null);
  const thieves = () =>
    (reveal()?.thieves ?? []).flatMap((id) => {
      const p = props.players.find((x) => x.id === id);
      return p ? [p] : [];
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
            <p class="ghr__sub">{revealSubline(r())}</p>
            <Show when={thieves().length > 0}>
              <ul class="ghr__crew">
                <For each={thieves()}>
                  {(p) => (
                    <li class="ghr__thief">
                      <Avatar
                        index={p.avatar}
                        size={28}
                        connected={p.connected}
                        ring={r().outcome === "solo" ? "var(--lime)" : "var(--red)"}
                      />
                      <span class="ghr__name">{shortName(p.nickname)}</span>
                      <span class="ghr__pts">{r().outcome === "solo" ? "+1" : "−1"}</span>
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
