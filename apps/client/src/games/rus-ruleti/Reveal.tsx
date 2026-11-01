import { createMemo, For, onMount, Show } from "solid-js";
import { hapticMatch, hapticSolo } from "../../fx/haptics.js";
import { match as matchSound, solo as soloSound } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import type { GameScreenProps } from "../registry.js";
import "./rus-ruleti.css";
import { outEntries, parseRusRuletiPublicView, shortName } from "./view.js";

/**
 * Sonuç ekranının üstüne giren kısa açılış: hayatta kalanlar altın halkayla, adlarıyla +1; Kâhin rozetleri; elenenler
 * adlarıyla ve elenme sırasıyla, kimin vurduğu ve atışın riskiyle (RR-U8).
 */
export default function Reveal(props: GameScreenProps) {
  const pub = createMemo(() => parseRusRuletiPublicView(props.match.publicView));
  const result = () => pub()?.result ?? null;
  const person = (id: string) => props.players.find((p) => p.id === id);
  const name = (id: string): string => (id === props.selfId ? "Sen" : (person(id)?.nickname ?? "Oyuncu"));
  const mineAlive = () => result()?.survivors.includes(props.selfId) ?? false;
  const outs = () => {
    const p = pub();
    return p?.result ? outEntries(p.result.eliminated, p.history) : [];
  };
  onMount(() => {
    if (!result() || props.spectator) return;
    if (mineAlive()) {
      matchSound();
      hapticMatch();
    } else {
      soloSound();
      hapticSolo();
    }
  });
  return (
    <Show when={result()}>
      {(r) => (
        <section class="rrr rise" aria-label="Rus Ruleti sonucu">
          <h2 class="rrr__head">{r().survivors.length === 1 ? "Tek hayatta kalan" : "Hayatta kalanlar"}</h2>
          <ul class="rrr__row">
            <For each={r().survivors}>
              {(id) => (
                <li class="rrr__card">
                  <Avatar
                    index={person(id)?.avatar ?? 0}
                    size={44}
                    connected={person(id)?.connected ?? true}
                    ring="var(--amber)"
                  />
                  <span class="rrr__name">{shortName(name(id))}</span>
                  <span class="rrr__pts">+1</span>
                </li>
              )}
            </For>
          </ul>
          <Show when={r().kahinler.length > 0}>
            <ul class="rrr__row rrr__row--kahin" aria-label="Kâhin rozeti">
              <For each={r().kahinler}>
                {(id) => (
                  <li class="rrr__kahin">
                    <Avatar index={person(id)?.avatar ?? 0} size={30} mood="out" />
                    <span class="rrr__rozet">{name(id)} · Kâhin</span>
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <ol class="rrr__outs" aria-label="Elenenler">
            <For each={outs()}>
              {(o) => (
                <li class="rrr__gone">
                  <span class="rrr__no">{o.order}.</span>
                  <Avatar index={person(o.id)?.avatar ?? 0} size={24} mood="out" />
                  <span class="rrr__goname">{shortName(name(o.id))}</span>
                  <Show when={o.shooter}>
                    {(by) => (
                      <span class="rrr__by">
                        {o.self ? "kendine" : `← ${shortName(name(by()))}`}
                        {o.risk === null ? "" : ` · %${o.risk}`}
                      </span>
                    )}
                  </Show>
                </li>
              )}
            </For>
          </ol>
        </section>
      )}
    </Show>
  );
}
