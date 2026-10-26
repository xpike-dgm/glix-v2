import { createMemo, For, onMount, Show } from "solid-js";
import { hapticMatch, hapticSolo } from "../../fx/haptics.js";
import { Avatar } from "../../ui/Avatar.js";
import type { GameScreenProps } from "../registry.js";
import { gold, siren } from "./sounds.js";
import "./son-kisi.css";
import { formatSeconds, parseSonKisiPublicView, resultHeadline } from "./view.js";

/** Sonuç ekranının üstüne giren açılış: alarm flaşı, son kaçanların altın kartları. */
export default function Reveal(props: GameScreenProps) {
  const result = createMemo(() => parseSonKisiPublicView(props.match.publicView)?.result ?? null);
  const last = () =>
    (result()?.last ?? []).flatMap((id) => {
      const p = props.players.find((x) => x.id === id);
      const e = result()?.escapes.find((x) => x.id === id);
      return p && e ? [{ p, ms: e.ms }] : [];
    });
  const missedPeople = () =>
    (result()?.missed ?? []).flatMap((id) => {
      const p = props.players.find((x) => x.id === id);
      return p ? [p] : [];
    });
  const missed = () => result()?.missed.length ?? 0;
  onMount(() => {
    const r = result();
    if (!r) return;
    siren();
    if (r.last.length > 0) {
      setTimeout(gold, 560);
      hapticMatch();
    } else hapticSolo();
  });
  return (
    <Show when={result()}>
      {(r) => (
        <section class="skr rise" data-none={r().escapes.length === 0 ? "1" : "0"} aria-label="Alarm sonucu">
          <div class="skr__siren" aria-hidden="true">
            <i />
          </div>
          <div class="skr__txt">
            <h2 class="skr__head">{resultHeadline(r())}</h2>
            <Show when={last().length > 0} fallback={<span class="skr__note">Herkes −1</span>}>
              <ul class="skr__crew">
                <For each={last()}>
                  {(x) => (
                    <li class="skr__card">
                      <Avatar index={x.p.avatar} size={36} connected={x.p.connected} ring="var(--amber)" />
                      <span class="skr__pts">+1</span>
                      <span class="skr__time">{formatSeconds(x.ms)}</span>
                      <span class="sr-only">{x.p.nickname}</span>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
            <Show when={last().length > 0 && missed() > 0}>
              <span class="skr__note skr__note--miss">
                Kaçmayan: −1
                <span class="skr__miss" aria-hidden="true">
                  <For each={missedPeople().slice(0, 8)}>
                    {(p) => <Avatar index={p.avatar} size={22} mood="out" connected={p.connected} />}
                  </For>
                </span>
              </span>
            </Show>
          </div>
        </section>
      )}
    </Show>
  );
}
